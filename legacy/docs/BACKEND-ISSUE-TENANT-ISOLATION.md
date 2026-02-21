# [BACKEND] 🔴 BUG CRÍTICO: Aislamiento de Tenants Roto — Cross-Tenant Data Leakage

**Prioridad**: 🔴 CRÍTICA  
**Epic**: Multi-Tenant Isolation  
**Componente**: ChromaDB / Tenant Service / Query Pipeline  
**Reportado**: 2026-02-15  
**Afecta**: Todos los tenants — datos de un tenant se filtran a otros

---

## 📋 Descripción

Al crear un nuevo tenant (`eod`) y hacer queries contra él, el sistema retorna **datos de otro tenant** (`envios23`). Hay 3 bugs concurrentes que rompen el aislamiento multi-tenant.

**Impacto**: Un tenant puede ver/buscar información confidencial de otro tenant. Esto es un **data leak** crítico para cualquier despliegue SaaS.

---

## 🐛 Bug 1: `document_count` Global (No Filtrado por Tenant)

### Descripción
El endpoint `GET /api/v2/tenants` retorna el mismo `document_count` para TODOS los tenants en vez de filtrar por tenant.

### Reproducción
```bash
curl -sS "http://167.172.225.44/api/v2/tenants" | python3 -m json.tool
```

### Resultado Actual
```json
{
  "tenants": [
    { "tenant_id": "envios23", "document_count": 167 },
    { "tenant_id": "eod",      "document_count": 167 }
  ]
}
```

### Resultado Esperado
```json
{
  "tenants": [
    { "tenant_id": "envios23", "document_count": 6 },
    { "tenant_id": "eod",      "document_count": 0 }
  ]
}
```

### Evidencia
- `GET /api/v2/documents?tenant_id=eod` → retorna **0 documentos**
- `GET /api/v2/documents?tenant_id=envios23` → retorna **6 documentos**
- Pero ambos tenants muestran `document_count: 167` en el listado

### Fix Sugerido
El `document_count` en el listado de tenants probablemente cuenta **todos** los chunks o documentos en la base de datos sin filtrar por `tenant_id`. Agregar `WHERE tenant_id = ?` al conteo.

---

## 🐛 Bug 2: Colección ChromaDB Incorrecta — Mismatch Config vs Realidad

### Descripción
El tenant `envios23` tiene `collection_name: "kb_envios23"` en su configuración, pero sus chunks realmente están almacenados en una colección legacy llamada `"documents"`.

### Reproducción
```bash
# Config dice kb_envios23
curl -sS "http://167.172.225.44/api/v2/tenants/envios23" | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(f'collection_name config: {d.get(\"collection_name\")}')"

# Stats muestran colección "documents" con 167 chunks
curl -sS "http://167.172.225.44/api/v2/stats?tenant_id=envios23" | python3 -c "
import json,sys; d=json.load(sys.stdin)
vdb=d.get('vector_database',{})
print(f'collection real: {vdb.get(\"collection_name\")}')
print(f'chunks: {vdb.get(\"total_chunks\")}')"
```

### Resultado
```
collection_name config:  kb_envios23
collection real:         documents       ← ⚠️ MISMATCH
chunks:                  167
```

### Fix Sugerido
Opción A: Migrar chunks de `documents` → `kb_envios23`  
Opción B: Actualizar config de envios23: `collection_name = "documents"`

---

## 🐛 Bug 3: Query Cross-Tenant — No Respeta Aislamiento de Colección

### Descripción
Al hacer un query con `tenant_id=eod`, el sistema busca en **167 chunks** que pertenecen a `envios23`. La respuesta incluye contenido de envios23 (menciona "envíos a Cuba", "ayuda@envios23.com").

### Reproducción
```bash
# EOD tiene 0 docs, 0 chunks en kb_eod
curl -sS "http://167.172.225.44/api/v2/stats?tenant_id=eod" | python3 -c "
import json,sys; d=json.load(sys.stdin)
vdb=d.get('vector_database',{})
print(f'collection: {vdb.get(\"collection_name\")} chunks: {vdb.get(\"total_chunks\")}')"
# → collection: kb_eod chunks: 0

# Pero un query retorna datos de envios23
curl -m 30 -sS -X POST "http://167.172.225.44/api/v2/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"que servicios ofrecen","tenant_id":"eod","top_k":3}'
```

### Resultado Actual
```json
{
  "answer": "...envíos a Cuba...ayuda@envios23.com...",
  "confidence": 0.0,
  "sources": [],
  "metadata": {
    "total_chunks_searched": 167
  }
}
```

### Resultado Esperado
```json
{
  "answer": "No tengo información disponible para responder...",
  "confidence": 0.0,
  "sources": [],
  "metadata": {
    "total_chunks_searched": 0
  }
}
```

### Hipótesis de la Causa
El query pipeline probablemente tiene un **fallback** que busca en la colección default `"documents"` cuando la colección del tenant (`kb_eod`) no tiene chunks. O hay un bug donde siempre busca en `"documents"` independientemente del `collection_name` del tenant.

### Fix Sugerido
1. El query pipeline DEBE usar exclusivamente la `collection_name` del tenant
2. Si la colección está vacía o no existe, retornar respuesta vacía — **nunca** fallback a otra colección
3. Agregar validación: si `total_chunks_searched > 0` pero `chunks_retrieved = 0`, verificar que los chunks pertenezcan al tenant_id correcto

---

## 📊 Estado Actual de Tenants

| Tenant | collection_name (config) | Colección Real (stats) | Chunks | Docs (API) | document_count (listado) |
|--------|--------------------------|------------------------|--------|------------|--------------------------|
| envios23 | `kb_envios23` | `documents` ⚠️ | 167 | 6 | 167 |
| eod | `kb_eod` | `kb_eod` | 0 | 0 | 167 ⚠️ |

---

## ✅ Verificaciones Requeridas Post-Fix

```bash
# 1. document_count debe ser per-tenant
curl -sS "http://167.172.225.44/api/v2/tenants" | python3 -c "
import json,sys
for t in json.load(sys.stdin)['tenants']:
    print(f\"{t['tenant_id']}: doc_count={t.get('document_count')}\")"
# Esperado: envios23=6, eod=0

# 2. Query eod NO debe retornar datos de envios23
curl -sS -X POST "http://167.172.225.44/api/v2/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"envios cuba","tenant_id":"eod","top_k":3}' | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d['metadata']['total_chunks_searched'] == 0, 'FAIL: searching wrong chunks'
assert len(d.get('sources',[])) == 0, 'FAIL: returning wrong sources'
print('PASS: eod query returns no cross-tenant data')"

# 3. Stats collection_name debe coincidir con config
curl -sS "http://167.172.225.44/api/v2/stats?tenant_id=envios23" | python3 -c "
import json,sys; d=json.load(sys.stdin)
col = d['vector_database']['collection_name']
assert col == 'kb_envios23', f'FAIL: expected kb_envios23 got {col}'
print('PASS: collection name matches config')"
```

---

## 🏗️ Notas de Arquitectura

- **Frontend** fue auditado y está correcto: todos los calls a la API pasan `tenant_id` / `App.tenantId` consistentemente
- El issue es 100% backend: ChromaDB collection routing + document_count aggregation
- El `system_prompt` de `eod` es `null` pero aún así retorna el prompt default de envios23 en las respuestas, lo que confirma que el query pipeline no está respetando el tenant boundary
