# [BACKEND] 🔴 ISSUE-002: Servicio de Embeddings Caído — DNS Resolution Failure

**Fecha:** 2026-02-20  
**Severidad:** P0 — BLOQUEANTE — Toda funcionalidad de búsqueda inoperativa  
**Afecta:** Pipeline RAG (`/query`), búsqueda vectorial (`search_knowledge_base`), `generate_rag_answer`, `/chat/completions`  
**Componente:** TEI Embedding Adapter → Docker networking  

---

## Síntoma

El servicio de embeddings (`TEI — Text Embeddings Inference`) no es alcanzable desde el contenedor del backend. Health check reporta `embedding: ok=false`. Toda operación que requiere generar embeddings falla con:

```
[Errno -3] Temporary failure in name resolution
```

Esto bloquea **el 100% de las funcionalidades core** de la plataforma: ni el pipeline RAG ni la búsqueda vectorial funcionan.

---

## Evidencia (2026-02-20)

### Health Deep

```bash
curl -s "http://167.172.225.44:9999/api/v2/health/deep"
```

```json
{
    "status": "degraded",
    "checks": {
        "qdrant":    { "ok": true,  "latency_ms": 73.7, "collections": 5 },
        "redis":     { "ok": true,  "latency_ms": 4.7 },
        "embedding": { "ok": false, "latency_ms": 23.7 },
        "llm":       { "ok": true,  "latency_ms": 112.7 }
    }
}
```

### REST `/query` — Falla en `retrieve_chunks`

```bash
curl -s -X POST "http://167.172.225.44:9999/api/v2/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"regulaciones","tenant_id":"eod-sm23","agent_id":"envio23","top_k":3}'
```

```
answer: "Lo siento, no puedo procesar la consulta en este momento..."
confidence: 0.0
error_step: retrieve_chunks
error_detail: [Errno -3] Temporary failure in name resolution
chunks_searched: 0
```

### MCP `search_knowledge_base` — Misma falla

```bash
curl -s -X POST "http://167.172.225.44:9999/api/v2/mcp/tools/call" \
  -H "Content-Type: application/json" \
  -d '{"tool_name":"search_knowledge_base","arguments":{"query":"regulaciones","tenant_id":"eod-sm23","top_k":2}}'
```

```
success: true
result: "Error al buscar en la base de conocimientos: [Errno -3] Temporary failure in name resolution"
```

### Nota: Qdrant SÍ funciona

Qdrant tiene 5 colecciones con datos (1223+ chunks), latencia 73ms. El problema NO es el vector DB sino el servicio de embeddings que genera los vectores de la query.

---

## Diagnóstico

### Configuración actual (`.env`)

```
EMBEDDING_MODE=server
EMBEDDING_SERVICE_URL=http://embeddings:80
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2
```

El hostname `embeddings` debe resolverse via Docker DNS interno. El error `[Errno -3]` indica que:

1. El contenedor TEI no está corriendo, ó
2. No está en la misma red Docker que el backend, ó
3. El nombre del servicio no coincide con el definido en `docker-compose.yml`

### Verificación requerida

```bash
# 1. ¿El contenedor TEI está corriendo?
docker ps | grep -i "embed\|tei"

# 2. ¿Está en la misma red Docker?
docker network inspect rag-network | grep -A5 embeddings

# 3. ¿El DNS Docker resuelve?
docker exec hex-rag-service ping -c1 embeddings

# 4. ¿TEI responde directamente?
docker exec hex-rag-service curl -s http://embeddings:80/health
```

---

## Fix Requerido

### Inmediato (P0): Restaurar TEI

1. Verificar que el contenedor `embeddings` esté en running
2. Si no, `docker compose up -d embeddings` (o el nombre del servicio)
3. Verificar que esté en `rag-network`
4. Test: `curl -s http://167.172.225.44:9999/api/v2/health/deep` → `embedding.ok: true`

### Corto plazo: Health check con auto-recovery

El backend debería detectar que el servicio de embeddings está caído e intentar reconectar automáticamente en vez de fallar en cada request.

### Medio plazo: Adapter de fallback (ver EVAL-001)

Implementar `OpenAIEmbeddingAdapter` como fallback si TEI falla. Ver [EVAL-001](adr/EVAL-001-openai-embeddings-online.md) para datos de viabilidad.

---

## Objective Eval Spec (Mandatorio)

### EVAL-002: Resiliencia del Servicio de Embeddings

**Objetivo:** Verificar que el servicio de embeddings es resiliente a fallos y se recupera automáticamente.

**Hipótesis:** Tras restaurar el servicio TEI, el pipeline RAG debe funcionar extremo a extremo (query → embedding → search → LLM → answer) con confianza > 0 y chunks recuperados > 0.

#### Métricas de Aceptación

| Métrica | Criterio de Éxito |
|---|---|
| `health/deep.embedding.ok` | `true` |
| `health/deep.embedding.latency_ms` | `< 500ms` |
| Pipeline `/query` → `chunks_searched` | `> 0` |
| Pipeline `/query` → `confidence` | `> 0.0` |
| Pipeline `/query` → `error_step` | `none` (sin error) |
| `search_knowledge_base` → resultado | Chunks con scores > 0.5 |
| `generate_rag_answer` → resultado | Respuesta con fuentes |

#### Queries de Test

```bash
# 1. Health check
curl -s "http://167.172.225.44:9999/api/v2/health/deep" | python3 -c "
import json,sys; d=json.load(sys.stdin)
e = d['checks']['embedding']
assert e['ok'] == True, f'FAIL: embedding ok={e[\"ok\"]}'
assert e['latency_ms'] < 500, f'FAIL: latency {e[\"latency_ms\"]}ms'
print('PASS: embedding healthy')"

# 2. Pipeline E2E
curl -s -X POST "http://167.172.225.44:9999/api/v2/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"regulaciones de envío","tenant_id":"eod-sm23","agent_id":"envio23","top_k":5}' | python3 -c "
import json,sys; d=json.load(sys.stdin)
m = d.get('metadata',{})
assert m.get('error_step') is None or m.get('error_step') == 'none', f'FAIL: error at {m.get(\"error_step\")}: {m.get(\"error_detail\")}'
assert m.get('total_chunks_searched',0) > 0, f'FAIL: 0 chunks searched'
assert d.get('confidence',0) > 0, f'FAIL: confidence={d.get(\"confidence\")}'
print(f'PASS: {m.get(\"total_chunks_searched\")} chunks, confidence={d.get(\"confidence\")}')"

# 3. Búsqueda vectorial directa
curl -s -X POST "http://167.172.225.44:9999/api/v2/mcp/tools/call" \
  -H "Content-Type: application/json" \
  -d '{"tool_name":"search_knowledge_base","arguments":{"query":"regulaciones de envío","tenant_id":"eod-sm23","top_k":3}}' | python3 -c "
import json,sys; d=json.load(sys.stdin)
assert d.get('success') == True, 'FAIL: not success'
r = d.get('result','')
assert 'Error' not in r, f'FAIL: {r[:100]}'
print('PASS: search returned results')"
```

#### Eval Post-Fallback (si se implementa OpenAIEmbeddingAdapter)

| Métrica | TEI (baseline) | OpenAI (fallback) | Criterio |
|---|---|---|---|
| Latencia embedding | ~50ms | ~731ms | < 1000ms aceptable para fallback |
| Calidad top-5 | baseline | debe re-indexar | Ver EVAL-001 |
| Disponibilidad | depende de Docker | 99.9% SLA | Mejora significativa |

---

## Impacto Frontend

| Funcionalidad | Estado | Consecuencia UI |
|---|---|---|
| Chat (todos protocolos) | ❌ Bloqueado | "Error al procesar la consulta" |
| Pipeline Monitor | ❌ Bloqueado | 0 chunks, 0% confianza |
| Búsqueda Vectorial | ❌ Bloqueado | "Error al buscar" |
| Knowledge Base (lectura) | ✅ Funciona | Docs y chunks se ven, pero no se pueden buscar |
| Ingesta de docs | ⚠️ Parcial | Upload funciona, embedding falla al indexar |

---

## Referencias

- [EVAL-001: OpenAI Embeddings Online](adr/EVAL-001-openai-embeddings-online.md) — Evaluación de alternativa a TEI
- [BACKEND-ISSUE-PIPELINE-BROKEN.md](BACKEND-ISSUE-PIPELINE-BROKEN.md) — Issue original del pipeline (metadata_filters, ya parcialmente resuelto)
