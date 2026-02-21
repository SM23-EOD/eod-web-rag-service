# [BACKEND] ⚠️ 7 Endpoints Rotos — Metrics, Feedback, Retrieval, Reset

**Prioridad**: 🔴 ALTA  
**Reportado**: 2026-02-15  
**Última revisión**: 2026-02-16 (auditoría completa)  
**Contexto**: Tras la corrección de tenant isolation y migración de datos, varios subsistemas tienen bugs persistentes. El frontend está adaptado con `retries: 0` y degradación elegante.

---

## 📋 Resumen

**29 endpoints testeados** — 22 funcionan, 7 fallan.

**✅ FUNCIONAN (22 endpoints)**:
- `/health`, `/tenants`, `/tenants/{id}`, `/stats`, `/models` → 200
- `/agents`, `/api-keys`, `/conversations`, `/tasks` → 200
- `/documents`, `/documents/{id}`, `/documents/stats/summary`, `/documents/upload`, `/documents/process-pending` → 200
- `/chat/completions`, `/query` (200 pero sin retrieval — ver Bug 4)
- `DELETE /cache` → 200
- `/mcp/health`, `/mcp/tools`, `/mcp/prompts`, `/mcp/resources` → 200

**❌ ROTOS (7 endpoints)**:
- `POST/GET /feedback`, `/feedback/stats` → 500 (intermitente, asyncpg bug)
- `GET /metrics/dashboard|coverage|gaps|grounding` → 500
- `POST /documents/reset-reindex` → 500
- `POST /documents/sync/directory` → 500
- `POST /query` → 200 pero 0 chunks retrieved de 26 disponibles

**✅ RESUELTOS desde último reporte**:
- `/api-keys`, `/conversations`, `/tasks` → Antes 502, ahora 200
- `/documents` → 7 documentos con metadata correcta

---

## 🐛 Bug 1: Feedback — Intermitente 200/500 (asyncpg event loop)

### Estado: ⚠️ INTERMITENTE — funciona a veces, falla otras

### Endpoints afectados
| Método | Endpoint | HTTP | Error |
|--------|----------|------|-------|
| `POST` | `/api/v2/feedback` | 200/500 | `Error interno al guardar feedback.` |
| `GET` | `/api/v2/feedback?limit=5` | 200/500 | `Error interno al obtener feedback.` |
| `GET` | `/api/v2/feedback/stats` | 200/500 | `Error interno al obtener estadísticas.` |

### Reproducción
```bash
# A veces retorna 200, a veces 500 (race condition)
curl -sS -w "\nHTTP: %{http_code}" -X POST "http://167.172.225.44/api/v2/feedback" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"envios23","query":"test","response":"test","rating":"positive"}'

curl -sS -w "\nHTTP: %{http_code}" "http://167.172.225.44/api/v2/feedback/stats"
```

### Causa raíz (identificada en docker logs)
```
RuntimeError: Task <...> got Future <Future pending> attached to a different loop
```
Archivos afectados en el backend:
- `pg_feedback_repository.py` — pool de conexiones asyncpg con event loop corrupto
- `pg_feedback_insights.py` — mismo problema
- `pg_gap_log.py` — mismo problema
- `pg_cost_tracker.py` — mismo problema

### Fix requerido
Inicializar el pool de conexiones asyncpg en el event loop correcto. Cambiar la creación del pool para usar `asyncpg.create_pool()` dentro del handler de startup de FastAPI, no en tiempo de importación del módulo.

### Impacto Frontend
- Chat: feedback a veces se guarda, a veces muestra error
- Quality: feedback list vacía o con error intermitente
- Admin Analytics: panel de feedback intermitente

---

## 🐛 Bug 2: Metrics — Todos los Endpoints 500

### Endpoints afectados
| Método | Endpoint | HTTP | Error |
|--------|----------|------|-------|
| `GET` | `/api/v2/metrics/dashboard?tenant_id=envios23` | 500 | `Error al obtener métricas del dashboard.` |
| `GET` | `/api/v2/metrics/coverage?tenant_id=envios23` | 500 | `internal_error` |
| `GET` | `/api/v2/metrics/gaps?tenant_id=envios23` | 500 | `internal_error` |
| `GET` | `/api/v2/metrics/grounding?tenant_id=envios23` | 500 | `internal_error` |

### Reproducción
```bash
curl -sS "http://167.172.225.44/api/v2/metrics/dashboard?tenant_id=envios23"
# → 500: {"detail":{"error":"internal_error","message":"Error al obtener métricas del dashboard."}}

curl -sS "http://167.172.225.44/api/v2/metrics/coverage?tenant_id=envios23"
# → 500 (mismo patrón)

curl -sS "http://167.172.225.44/api/v2/metrics/gaps?tenant_id=envios23"
# → 500

curl -sS "http://167.172.225.44/api/v2/metrics/grounding?tenant_id=envios23"
# → 500
```

### Causa raíz (identificada en docker logs)
```
AttributeError: 'Column' object has no attribute 'isnull'
```
SQLAlchemy no tiene `.isnull()` — debería ser `.is_(None)`.

### Fix requerido
Buscar todas las ocurrencias de `.isnull()` en el código de metrics y reemplazar por `.is_(None)`.

### Impacto Frontend
- Quality Dashboard: todas las métricas muestran "—"
- Admin Analytics: sin datos de cobertura ni grounding
- Frontend adaptado con `retries: 0` — no reintenta, degrada elegante

---

## 🐛 Bug 3: Reset-Reindex + Sync Directory — 500

### Endpoints afectados
| Método | Endpoint | HTTP | Error |
|--------|----------|------|-------|
| `POST` | `/api/v2/documents/reset-reindex?tenant_id=envios23` | 500 | `An internal error occurred during reset and reindex.` |
| `POST` | `/api/v2/documents/sync/directory?directory=/app/storage` | 500 | `An internal error occurred while syncing the directory.` |

### Reproducción
```bash
curl -sS -X POST "http://167.172.225.44/api/v2/documents/reset-reindex?tenant_id=envios23"
# → 500: {"detail":"An internal error occurred during reset and reindex."}

curl -sS -X POST "http://167.172.225.44/api/v2/documents/sync/directory?directory=/app/storage&tenant_id=envios23"
# → 500: {"detail":"An internal error occurred while syncing the directory."}
```

### Causa raíz (identificada en docker logs)
```
AttributeError: 'DocumentManagementService' object has no attribute 'full_reset_and_reindex'
```
El método `full_reset_and_reindex` no existe en `DocumentManagementService`. Falta implementar o renombrar.

### Fix requerido
Implementar `full_reset_and_reindex()` en `DocumentManagementService`, o corregir la referencia al método correcto.

### Impacto Frontend
- KB: botón "☢️ Reset" no funciona
- Admin System: "Reset Nuclear" no funciona
- KB: "Sync Directory" no funciona
- Frontend adaptado con `retries: 0`

---

## 🐛 Bug 4: Retrieval No Recupera Chunks (0 de 26)

### Descripción
El endpoint `/query` retorna 200 pero con 0 chunks searched y 0 retrieved. La colección `kb_envios23` tiene **26 chunks** (confirmado vía `/stats`) pero el pipeline RAG no los consulta.

### Reproducción
```bash
curl -sS -X POST "http://167.172.225.44/api/v2/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"envio de paquetes a Cuba","tenant_id":"envios23","top_k":5}' | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(f'chunks_searched: {d[\"metadata\"][\"total_chunks_searched\"]}')
print(f'chunks_retrieved: {len(d.get(\"retrieved_chunks\",[]))}')
print(f'confidence: {d[\"confidence\"]}')
print(f'answer: {d[\"answer\"][:100]}...')"
```

### Resultado (2026-02-16)
```
chunks_searched: 0
chunks_retrieved: 0
confidence: 0.0
answer: Lo siento, no puedo procesar la consulta en este momento debido a un problema técnico...
```

### Contexto
```bash
# La colección SÍ tiene datos:
curl -sS "http://167.172.225.44/api/v2/stats?tenant_id=envios23"
# → collection: kb_envios23, total_chunks: 26, categories: {faq: 26}

# Los documentos SÍ están registrados:
# 7 docs total: 3 indexed (21 chunks), 4 pending
```

### Resultado Esperado
Con 26 chunks de FAQ sobre envíos, debería recuperar al menos 3-5 chunks relevantes con confianza > 0.

### Hipótesis
1. **Similarity threshold demasiado alto** — si quedó en 0.9+ tras migración, nada pasa el filtro
2. **Embeddings incompatibles** — si se migraron chunks sin re-generar embeddings con el modelo actual (`sentence-transformers/paraphrase-multilingual-mpnet-base-v2`), la similitud será ~0
3. **Error silenciado en retrieval** — el pipeline podría estar catch-eando una excepción y retornando vacío (el mensaje "problema técnico" sugiere esto)
4. **Conexión a Qdrant/ChromaDB rota** — el vector store podría no estar accesible para queries aunque `/stats` lea metadata

### Impacto Frontend
- Chat: respuestas genéricas sin contexto
- Pipeline: 0 fuentes, 0% confianza
- DocViewer: "Sin chunks recuperados"

---

## ~~🐛 Bug 5: Documents Metadata~~ ✅ RESUELTO

> Documents retorna 7 documentos correctos (3 indexed, 4 pending). Stats: 21 chunks, 1.2 MB. Vector DB: 26 chunks en `kb_envios23`.

---

## ~~🐛 Bug 6: API Keys / Conversations / Tasks~~ ✅ RESUELTO (2026-02-16)

> Antes retornaban 502 (servicio no desplegado). Ahora retornan 200. Datos vacíos pero funcionales:
> - API Keys: `{"keys":[], "count":0}` → 200
> - Conversations: `{"sessions":[], "total":0}` → 200
> - Tasks: `{"tasks":[], "total":0}` → 200

---

## 📊 Resumen de Estado

| # | Grupo | Endpoints | Estado |
|---|-------|-----------|--------|
| 1 | Health/Core | `/health`, `/tenants`, `/stats`, `/models` | ✅ OK |
| 2 | Agents | `/agents` CRUD | ✅ OK |
| 3 | ~~API Keys~~ | `/api-keys` | ✅ OK (antes 502) |
| 4 | ~~Conversations~~ | `/conversations` | ✅ OK (antes 502) |
| 5 | ~~Tasks~~ | `/tasks` | ✅ OK (antes 502) |
| 6 | Documents CRUD | `/documents`, `/documents/{id}`, `/documents/upload` | ✅ OK (7 docs) |
| 7 | Documents Stats | `/documents/stats/summary` | ✅ OK (21 chunks, 1.2 MB) |
| 8 | Documents Process | `/documents/process-pending` | ✅ OK |
| 9 | Widget/Config | `/agents/{id}/widget-config` | ✅ OK |
| 10 | MCP | `/mcp/health`, `/mcp/tools`, `/mcp/prompts`, `/mcp/resources` | ✅ OK |
| 11 | Cache | `DELETE /cache` | ✅ OK |
| 12 | Chat | `/chat/completions` | ✅ OK |
| 13 | **Feedback** | `POST/GET /feedback`, `/feedback/stats` | **⚠️ INTERMITENTE (asyncpg)** |
| 14 | **Metrics** | `/metrics/dashboard,coverage,gaps,grounding` | **❌ 500 (SQLAlchemy)** |
| 15 | **Reset** | `/documents/reset-reindex` | **❌ 500 (missing method)** |
| 16 | **Sync** | `/documents/sync/directory` | **❌ 500** |
| 17 | **Retrieval** | `POST /query` | **⚠️ 200 pero 0/26 chunks** |

---

## 🔧 Resumen de Fixes Backend Requeridos

### Fix 1: asyncpg event loop (Feedback + dependientes)
**Archivos**: `pg_feedback_repository.py`, `pg_feedback_insights.py`, `pg_gap_log.py`, `pg_cost_tracker.py`  
**Error**: `RuntimeError: Task got Future attached to a different loop`  
**Solución**: Mover `asyncpg.create_pool()` al startup handler de FastAPI en vez de crearlo en import-time.  
**Desbloquea**: Feedback POST/GET/Stats + potencialmente Metrics (dependen de feedback data)

### Fix 2: SQLAlchemy `.isnull()` (Metrics)
**Archivos**: Queries de metrics (dashboard, coverage, gaps, grounding)  
**Error**: `AttributeError: 'Column' object has no attribute 'isnull'`  
**Solución**: Reemplazar `.isnull()` → `.is_(None)` en todas las queries de SQLAlchemy.  
**Desbloquea**: Los 4 endpoints de `/metrics/*`

### Fix 3: Missing method (Reset/Sync)
**Archivos**: `DocumentManagementService`  
**Error**: `AttributeError: object has no attribute 'full_reset_and_reindex'`  
**Solución**: Implementar el método o corregir la referencia.  
**Desbloquea**: `/documents/reset-reindex` + `/documents/sync/directory`

### Fix 4: Retrieval pipeline (Query)
**Síntoma**: `/query` retorna 200 pero busca 0 chunks de 26 disponibles  
**Posible causa**: Error silenciado en el adapter de vector store, threshold demasiado alto, o embeddings incompatibles  
**Necesita**: Revisar logs del retrieval pipeline, verificar conexión a vector store en runtime

---

## ✅ Verificaciones Post-Fix

```bash
#!/bin/bash
echo "=== Test Suite: Backend Endpoints (29 tests) ==="

# ── Core ──
echo -n "1. Health: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/health")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "2. Tenants LIST: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/tenants")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "3. Tenant GET: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/tenants/envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "4. Stats: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/stats?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "5. Models: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/models")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# ── Agents / Keys / Conversations / Tasks ──
echo -n "6. Agents: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/agents?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "7. API Keys: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/api-keys?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "8. Conversations: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/conversations?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "9. Tasks: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/tasks?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# ── Documents ──
echo -n "10. Documents LIST: "
TOTAL=$(curl -sS "http://167.172.225.44/api/v2/documents?tenant_id=envios23" | \
  python3 -c "import json,sys;d=json.load(sys.stdin);print(d.get('total',len(d.get('documents',[]))))")
[[ "$TOTAL" -gt "0" ]] && echo "PASS ($TOTAL docs)" || echo "FAIL (0 docs)"

echo -n "11. Document GET: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/documents/0e28d5358e022c93?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "12. Documents Stats: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/documents/stats/summary?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "13. Process Pending: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "http://167.172.225.44/api/v2/documents/process-pending?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "14. Reset Reindex: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "http://167.172.225.44/api/v2/documents/reset-reindex?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "15. Sync Directory: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "http://167.172.225.44/api/v2/documents/sync/directory?directory=/app/storage&tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# ── Cache / Chat ──
echo -n "16. Cache DELETE: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X DELETE "http://167.172.225.44/api/v2/cache?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "17. Chat Completions: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" \
  -d '{"model":"rag","messages":[{"role":"user","content":"hola"}],"tenant_id":"envios23"}' \
  "http://167.172.225.44/api/v2/chat/completions")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# ── Query/Retrieval ──
echo -n "18. Query Retrieval: "
RETRIEVED=$(curl -sS -X POST "http://167.172.225.44/api/v2/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"servicios de envio a Cuba","tenant_id":"envios23","top_k":5}' | \
  python3 -c "import json,sys;d=json.load(sys.stdin);print(len(d.get('retrieved_chunks',[])))")
[[ "$RETRIEVED" -gt "0" ]] && echo "PASS ($RETRIEVED chunks)" || echo "FAIL (0 chunks of 26)"

# ── Feedback ──
echo -n "19. Feedback POST: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" -X POST "http://167.172.225.44/api/v2/feedback" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"envios23","query":"test","response":"test","rating":"positive"}')
[[ "$HTTP" == "200" || "$HTTP" == "201" ]] && echo "PASS ($HTTP)" || echo "FAIL ($HTTP)"

echo -n "20. Feedback GET: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/feedback?limit=5")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "21. Feedback Stats: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/feedback/stats")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# ── Metrics ──
echo -n "22. Metrics Dashboard: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/metrics/dashboard?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "23. Metrics Coverage: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/metrics/coverage?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "24. Metrics Gaps: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/metrics/gaps?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "25. Metrics Grounding: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/metrics/grounding?tenant_id=envios23")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

# ── MCP ──
echo -n "26. MCP Health: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/mcp/health")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "27. MCP Tools: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/mcp/tools")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "28. MCP Prompts: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/mcp/prompts")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo -n "29. MCP Resources: "
HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44/api/v2/mcp/resources")
[[ "$HTTP" == "200" ]] && echo "PASS" || echo "FAIL ($HTTP)"

echo ""
echo "=== Done ==="
```
