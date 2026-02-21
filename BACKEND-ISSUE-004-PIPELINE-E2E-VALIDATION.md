# [BACKEND] 🟡 ISSUE-004: Pipeline RAG — Validación E2E Post-Fix Embedding

**Fecha:** 2026-02-20  
**Severidad:** P1 — Validación requerida tras resolución de ISSUE-002  
**Afecta:** Pipeline de 14 pasos, todos los protocolos (REST, OpenAI, MCP)  
**Prerequisito:** ISSUE-002 resuelto (embedding service healthy)  

---

## Contexto

El pipeline RAG de 14 pasos ha estado inoperativo desde al menos 2026-02-20 por dos razones secuenciales:

1. **`metadata_filters` bug** (reportado en BACKEND-ISSUE-PIPELINE-BROKEN.md) — Backend reportó que fue arreglado, pero no se pudo verificar porque...
2. **Embedding service caído** (ISSUE-002) — El pipeline falla en `retrieve_chunks` porque no puede generar embeddings de la query

El bug de `metadata_filters` fue **supuestamente arreglado** pero **no se ha podido verificar** porque el servicio de embeddings sigue caído. Una vez que ISSUE-002 se resuelva, necesitamos validación E2E completa del pipeline.

---

## Historial de Errores

| Fecha | Error | Paso | Estado |
|---|---|---|---|
| 2026-02-20 (AM) | `QdrantDBService.query() got unexpected kwarg 'metadata_filters'` | `retrieve_chunks` | ¿Arreglado? |
| 2026-02-20 (PM) | `[Errno 111] Connection refused` | `retrieve_chunks` | Transitorio (Qdrant restart) |
| 2026-02-20 (PM) | `[Errno -3] Temporary failure in name resolution` | `retrieve_chunks` | **ACTIVO** — embedding DNS |

---

## Objective Eval Spec (Mandatorio)

### EVAL-004: Validación End-to-End del Pipeline RAG

**Objetivo:** Confirmar que el pipeline de 14 pasos funciona correctamente a través de los 3 protocolos (REST, OpenAI, MCP) tras las correcciones de ISSUE-002 y el fix de `metadata_filters`.

#### Setup

- Tenant: `eod-sm23`
- Agent: `envio23`  
- Colección: `kb_eod-sm23` (1223 chunks)
- Queries de test: 5 queries representativas del dominio

#### Queries de Test

| # | Query | Dominio | Chunks esperados |
|---|---|---|---|
| Q1 | "regulaciones de envío a Cuba" | regulaciones | > 0 chunks, confianza > 0 |
| Q2 | "¿puedo enviar baterías de litio?" | restricciones | > 0 chunks |
| Q3 | "documentos necesarios para importar medicamentos" | documentación | > 0 chunks |
| Q4 | "tarifas de envío internacional" | precios | > 0 chunks |
| Q5 | "horarios de atención al cliente" | servicio | > 0 chunks (o respuesta "no tengo info" con confianza 0 si no hay datos) |

#### Protocolo 1: REST `/query`

```bash
for Q in "regulaciones de envío a Cuba" "puedo enviar baterías de litio" "documentos para importar medicamentos" "tarifas de envío internacional" "horarios de atención al cliente"; do
  echo "=== Query: $Q ==="
  curl -s -X POST "http://167.172.225.44:9999/api/v2/query" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"$Q\",\"tenant_id\":\"eod-sm23\",\"agent_id\":\"envio23\",\"top_k\":5}" | python3 -c "
import json,sys; d=json.load(sys.stdin)
m = d.get('metadata',{})
print(f'  confidence: {d.get(\"confidence\")}')
print(f'  chunks_searched: {m.get(\"total_chunks_searched\")}')
print(f'  chunks_retrieved: {m.get(\"chunks_retrieved\",len(d.get(\"retrieved_chunks\",[])))}')
print(f'  error_step: {m.get(\"error_step\",\"none\")}')
print(f'  cached: {d.get(\"cached\",False)}')
print(f'  answer: {d.get(\"answer\",\"\")[:80]}...')
print()
"
done
```

#### Protocolo 2: OpenAI `/chat/completions`

```bash
curl -s -X POST "http://167.172.225.44:9999/api/v2/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{
    "model":"envio23",
    "messages":[{"role":"user","content":"regulaciones de envío a Cuba"}],
    "tenant_id":"eod-sm23",
    "agent_id":"envio23"
  }' | python3 -c "
import json,sys; d=json.load(sys.stdin)
if 'error' in d:
    print(f'FAIL: {d[\"error\"]}: {d.get(\"message\",\"\")}')
else:
    c = d.get('choices',[{}])[0]
    msg = c.get('message',{}).get('content','')
    print(f'PASS: {msg[:120]}...')
"
```

#### Protocolo 3: MCP `generate_rag_answer`

```bash
curl -s -X POST "http://167.172.225.44:9999/api/v2/mcp/tools/call" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name":"generate_rag_answer",
    "arguments":{"query":"regulaciones de envío a Cuba","tenant_id":"eod-sm23","agent_id":"envio23"}
  }' | python3 -c "
import json,sys; d=json.load(sys.stdin)
if not d.get('success'):
    print(f'FAIL: {d.get(\"error\",\"unknown\")}')
else:
    r = d.get('result','')
    has_content = 'Confianza: 0.00%' not in r
    print(f'PASS: has_content={has_content}')
    print(r[:200])
"
```

#### Métricas de Aceptación

| Métrica | Criterio |
|---|---|
| REST `/query` → error_step | `none` (sin error) para todas las queries |
| REST `/query` → chunks_searched | `> 0` para al menos 4/5 queries |
| REST `/query` → confidence | `> 0.0` para queries con chunks relevantes |
| REST `/query` → answer | Respuesta coherente con el dominio, no genérica |
| OpenAI `/chat/completions` | 200 OK, respuesta con contenido RAG |
| MCP `generate_rag_answer` | success=true, respuesta con confianza > 0 |
| MCP `search_knowledge_base` | Retorna chunks reales con scores > 0.5 |
| Latencia E2E REST | < 5 segundos (pipeline completo) |

#### Regresiones a verificar

| Regresión | Test |
|---|---|
| `metadata_filters` no reaparece | Query con `document_ids` filter si soportado |
| Cross-tenant isolation | Query con `tenant_id=sm23-dani` NO retorna datos de `eod-sm23` |
| Cache funciona | Segunda query idéntica → `cached: true` |

---

## Acciones Post-Validación

### Si PASA todo:
1. Cerrar ISSUE-002, ISSUE-004
2. Desplegar frontend actualizado (`deploy.sh`)
3. Verificar que dashboards (draga.html, admin.html, tenant.html) cargan datos

### Si FALLA pipeline pero embedding funciona:
1. El bug de `metadata_filters` NO fue arreglado → reabrir con evidencia fresca
2. Capturar `error_step` y `error_detail` exactos
3. Revisar docker logs del backend: `docker logs hex-rag-service --tail 100`

### Si FALLA OpenAI protocol:
1. Verificar `llm.ok` en health/deep (actualmente `true`, latencia 112ms)
2. Capturar error exacto del endpoint `/chat/completions`

---

## Referencias

- [BACKEND-ISSUE-PIPELINE-BROKEN.md](BACKEND-ISSUE-PIPELINE-BROKEN.md) — Issue original (metadata_filters)
- [ISSUE-002: Embedding Service Down](BACKEND-ISSUE-002-EMBEDDING-SERVICE-DOWN.md) — Prerrequisito
- [EVAL-001: OpenAI Embeddings](adr/EVAL-001-openai-embeddings-online.md) — Datos de referencia
