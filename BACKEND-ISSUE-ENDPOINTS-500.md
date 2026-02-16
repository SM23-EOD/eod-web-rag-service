# [BACKEND] 🔴 8 Endpoints Retornan 500 + Retrieval Roto Post-Migración

**Prioridad**: 🔴 ALTA  
**Reportado**: 2026-02-15  
**Contexto**: Tras la corrección de tenant isolation (eliminación de tenant `eod`, migración de chunks de `documents` → `kb_envios23`), múltiples endpoints dejaron de funcionar.

---

## 📋 Resumen

Después de los fixes de tenant isolation, el backend tiene **8 endpoints retornando 500** y el **retrieval no recupera chunks** a pesar de que existen 5 en la colección `kb_envios23`.

**Estado del sistema verificado**:
- `GET /health` → ✅ 200 healthy
- `GET /tenants` → ✅ 1 tenant (`envios23`), `document_count: 5`
- `GET /stats?tenant_id=envios23` → ✅ `kb_envios23`, 5 chunks, categorías: `{faq: 5}`
- `GET /documents?tenant_id=envios23` → ✅ 200 pero retorna `{documents: [], total: 0}`
- `GET /documents/stats/summary?tenant_id=envios23` → ✅ 200 pero `total_documents: 0, total_chunks: 0`

---

## 🐛 Bug 1: Feedback — Todos los Endpoints 500

### Endpoints afectados
| Método | Endpoint | HTTP | Error |
|--------|----------|------|-------|
| `POST` | `/api/v2/feedback` | 500 | `"Error interno al guardar feedback."` |
| `GET` | `/api/v2/feedback?limit=5` | 500 | `"Error interno al obtener feedback."` |
| `GET` | `/api/v2/feedback/stats` | 500 | `"Error interno al obtener estadísticas."` |

### Reproducción
```bash
# POST feedback
curl -sS -X POST "http://167.172.225.44/api/v2/feedback" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"envios23","query":"test","response":"test","rating":"positive"}'
# → 500: {"detail":"Error interno al guardar feedback."}

# GET feedback
curl -sS "http://167.172.225.44/api/v2/feedback?limit=5"
# → 500: {"detail":"Error interno al obtener feedback."}

# GET feedback stats
curl -sS "http://167.172.225.44/api/v2/feedback/stats"
# → 500: {"detail":"Error interno al obtener estadísticas."}
```

### Impacto Frontend
- Chat: los botones 👍/👎 de feedback fallan silenciosamente
- Admin Analytics: panel de satisfacción y tabla de feedback muestran "no disponible"
- Quality Dashboard: sección de feedback reciente vacía

### Hipótesis
Posible problema con la tabla/colección de feedback tras la migración. Puede que la tabla se haya eliminado o que haya un schema mismatch.

---

## 🐛 Bug 2: Metrics — Todos los Endpoints 500

### Endpoints afectados
| Método | Endpoint | HTTP | Error |
|--------|----------|------|-------|
| `GET` | `/api/v2/metrics/dashboard?tenant_id=envios23` | 500 | `internal_error` |
| `GET` | `/api/v2/metrics/coverage?tenant_id=envios23` | 500 | `internal_error` |
| `GET` | `/api/v2/metrics/gaps?tenant_id=envios23` | 500 | `internal_error` |
| `GET` | `/api/v2/metrics/grounding?tenant_id=envios23` | 500 | `internal_error` |

### Reproducción
```bash
curl -sS "http://167.172.225.44/api/v2/metrics/dashboard?tenant_id=envios23"
# → 500: {"error":"internal_error","message":"Ha ocurrido un error interno..."}

curl -sS "http://167.172.225.44/api/v2/metrics/coverage?tenant_id=envios23"
# → 500 (mismo error)

curl -sS "http://167.172.225.44/api/v2/metrics/gaps?tenant_id=envios23"
# → 500 (mismo error)

curl -sS "http://167.172.225.44/api/v2/metrics/grounding?tenant_id=envios23"
# → 500 (mismo error)
```

### Impacto Frontend
- Quality Dashboard: todas las métricas muestran "—"
- Admin Analytics: sin datos de cobertura ni grounding

### Hipótesis
Los endpoints de metrics probablemente dependen de feedback data (que también está rota) o de alguna tabla/store que se eliminó durante la migración.

---

## 🐛 Bug 3: Reset-Reindex — 500

### Reproducción
```bash
curl -sS -X POST "http://167.172.225.44/api/v2/documents/reset-reindex?tenant_id=envios23"
# → 500: {"detail":"An internal error occurred during reset and reindex."}
```

### Impacto Frontend
- KB: el botón "☢️ Reset" no funciona
- System: el "Reset Nuclear" en admin no funciona

---

## 🐛 Bug 4: Retrieval No Recupera Chunks (0 de 5)

### Descripción
El endpoint `/query` busca en 5 chunks pero no recupera ninguno. La confianza siempre es 0.0 y no hay fuentes.

### Reproducción
```bash
curl -sS -X POST "http://167.172.225.44/api/v2/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"que servicios ofrecen","tenant_id":"envios23","top_k":5}' | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(f'chunks_searched: {d[\"metadata\"][\"total_chunks_searched\"]}')
print(f'chunks_retrieved: {len(d.get(\"retrieved_chunks\",[]))}')
print(f'confidence: {d[\"confidence\"]}')
print(f'sources: {d.get(\"sources\",[])}')
print(f'answer: {d[\"answer\"][:80]}...')"
```

### Resultado
```
chunks_searched: 5
chunks_retrieved: 0
confidence: 0.0
sources: []
answer: **Sugerencias para ayudarte:**
- Intenta reformular tu pregunta usando palabras dif...
```

### Resultado Esperado
Con 5 chunks de FAQ sobre envíos, debería recuperar al menos 1-3 chunks relevantes con confianza > 0.

### Hipótesis
- **Similarity threshold demasiado alto**: si `similarity_threshold` quedó en un valor alto (e.g., 0.9) tras la migración, los chunks podrían no superar el umbral
- **Embeddings incompatibles**: si los chunks se migraron sin re-generar embeddings, o si el modelo de embedding cambió, las búsquedas por similitud no encontrarán nada relevante
- **Metadata mismatch**: los 5 chunks tienen categoría `faq` pero posiblemente les falta metadata que el pipeline de retrieval necesita

---

## 🐛 Bug 5: Documents Metadata Perdida

### Descripción
`/documents` retorna 0 documentos y `/documents/stats/summary` retorna 0 docs / 0 chunks, aunque el vector DB (`/stats`) confirma 5 chunks en `kb_envios23`.

### Reproducción
```bash
# Documents API dice 0
curl -sS "http://167.172.225.44/api/v2/documents?tenant_id=envios23"
# → {"documents":[],"total":0}

# Document stats dice 0
curl -sS "http://167.172.225.44/api/v2/documents/stats/summary?tenant_id=envios23"
# → {"total_documents":0,"total_size_bytes":0,"total_chunks":0,"by_status":{},...}

# Pero el vector DB tiene 5 chunks
curl -sS "http://167.172.225.44/api/v2/stats?tenant_id=envios23" | python3 -c "
import json,sys;d=json.load(sys.stdin)
print(d['vector_database'])"
# → collection_name=kb_envios23, total_chunks=5, categories={faq: 5}
```

### Impacto
- KB: la tabla de documentos muestra "Sin documentos" aunque hay 5 chunks vectorizados
- No se pueden gestionar documentos individuales (re-indexar, eliminar, ver fuente)
- El upload funciona (200) pero no persiste metadata

### Hipótesis
La metadata de documentos (filename, status, file_size, etc.) se almacena en un store separado de los vectores (probablemente un JSON file o tabla). Durante la migración, esta metadata se perdió o no se migró junto con los chunks.

---

## 📊 Resumen de Estado

| Grupo | Endpoints | Estado |
|-------|-----------|--------|
| Health/Core | `/health`, `/tenants`, `/stats`, `/models` | ✅ OK |
| CRUD | `/agents`, `/api-keys`, `/conversations`, `/tasks` | ✅ OK (vacíos pero funcionales) |
| Documents CRUD | `/documents`, `/documents/upload` | ⚠️ 200 pero sin metadata |
| Widget/Config | `/agents/{id}/widget-config` | ✅ OK |
| MCP | `/mcp/health`, `/mcp/tools`, etc. | ✅ OK |
| Cache | `DELETE /cache` | ✅ OK |
| Chat | `/chat/completions` | ✅ OK (pero sin RAG data) |
| **Feedback** | `POST/GET /feedback`, `/feedback/stats` | **❌ 500** |
| **Metrics** | `/metrics/dashboard,coverage,gaps,grounding` | **❌ 500** |
| **Reset** | `/documents/reset-reindex` | **❌ 500** |
| **Query/Retrieval** | `POST /query` | **⚠️ 200 pero 0 chunks retrieved** |

---

## ✅ Verificaciones Post-Fix

```bash
#!/bin/bash
echo "=== Test Suite: Backend Endpoints ==="

# 1. Feedback POST
echo -n "1. Feedback POST: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "http://167.172.225.44/api/v2/feedback" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"envios23","query":"test","response":"test","rating":"positive"}')
[[ "$HTTP" == "200" || "$HTTP" == "201" ]] && echo "PASS ($HTTP)" || echo "FAIL ($HTTP)"

# 2. Feedback GET
echo -n "2. Feedback GET: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/feedback?limit=5")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# 3. Feedback Stats
echo -n "3. Feedback Stats: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/feedback/stats")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# 4. Metrics Dashboard
echo -n "4. Metrics Dashboard: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/metrics/dashboard?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# 5. Metrics Coverage
echo -n "5. Metrics Coverage: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/metrics/coverage?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# 6. Metrics Gaps
echo -n "6. Metrics Gaps: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/metrics/gaps?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# 7. Metrics Grounding
echo -n "7. Metrics Grounding: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/metrics/grounding?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# 8. Reset Reindex
echo -n "8. Reset Reindex: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "http://167.172.225.44/api/v2/documents/reset-reindex?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# 9. Query Retrieval
echo -n "9. Query Retrieval: "
RETRIEVED=$(curl -sS -X POST "http://167.172.225.44/api/v2/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"servicios de envio","tenant_id":"envios23","top_k":5}' | \
  python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d.get('retrieved_chunks',[])))")
[[ "$RETRIEVED" -gt "0" ]] && echo "PASS ($RETRIEVED chunks)" || echo "FAIL (0 chunks retrieved)"

# 10. Documents Metadata
echo -n "10. Documents Metadata: "
TOTAL=$(curl -sS "http://167.172.225.44/api/v2/documents?tenant_id=envios23" | \
  python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('total',len(d.get('documents',[]))))")
[[ "$TOTAL" -gt "0" ]] && echo "PASS ($TOTAL docs)" || echo "FAIL (0 docs)"

echo "=== Done ==="
```
