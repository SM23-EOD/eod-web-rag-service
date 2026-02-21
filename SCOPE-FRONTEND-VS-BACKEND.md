# Separación de Scope: Frontend vs Backend — Estado 2026-02-20

## Estado Actual del Sistema

```
health/deep:
  qdrant:    ✅ ok (73ms, 5 collections)
  redis:     ✅ ok (4.7ms)
  embedding: ❌ FAIL (23ms — DNS resolution failure)
  llm:       ✅ ok (112ms)
  
  metrics/*:    ✅ 200 (antes 500 — ARREGLADO)
  feedback/*:   ✅ 200 (antes intermitente — ARREGLADO)
```

---

## ✅ FRONTEND — Lo que YA se hizo (esta sesión)

| # | Cambio | Archivo(s) | Estado |
|---|--------|-----------|--------|
| F1 | `rag_query` → `generate_rag_answer` (6 ocurrencias) | draga.html | ✅ Aplicado |
| F2 | `getStats(tid, aid)` → `getStats(tid)` (tenant-scoped) | draga.html, admin.html, tenant.html, api-client.js | ✅ Aplicado |
| F3 | `listApiKeys(tid)` → `listApiKeys()` (auth-scoped) | draga.html, admin.html, tenant.html, api-client.js | ✅ Aplicado |
| F4 | `agent_id` en `search_knowledge_base` | draga.html (2 lugares) | ✅ Aplicado |
| F5 | Widget config/tasks sin agent_id innecesario | draga.html, api-client.js | ✅ Aplicado |
| F6 | `getConversation` con scope completo | draga.html, api-client.js | ✅ Aplicado |
| F7 | Labels: `assignLabel/unassignLabel` con agent_id | api-client.js, draga.html | ✅ Aplicado |
| F8 | `updateAgent` warning (PUT no existe en backend) | api-client.js | ✅ Aplicado |
| F9 | Pending inbox banner + batch upload mode | draga.html | ✅ Aplicado |
| F10 | Web import: error handling SPA/JS + gateway errors | draga.html | ✅ Aplicado |
| F11 | Crear DRAGA modal en tenant.html | tenant.html | ✅ Aplicado |
| F12 | Nuevos métodos API: `destroyAgent`, `mcpClearSession`, `metricsKbCoverage`, `metricsTrends`, feature flags, `platformReset` | api-client.js | ✅ Aplicado |
| F13 | Degradation UI: banner "⚠️ Servicio no disponible" cuando embedding/otros caídos | draga.html | ✅ Aplicado |
| F14 | Health indicator: pill con `healthDeep()` + estado degradado en header | draga.html, admin.html | ✅ Aplicado |
| F15 | Pipeline module: de dead code `() => {}` a inicialización con health de servicios | draga.html | ✅ Aplicado |
| F16 | Quality stats: verificado — `Promise.allSettled` correcto, fix `catch {}` vacío | draga.html | ✅ Verificado |

**Eval Spec:** [FRONTEND-EVAL-F13-F16.md](FRONTEND-EVAL-F13-F16.md)

## 🔧 FRONTEND — Pendiente

| # | Mejora | Descripción | Esfuerzo |
|---|--------|-------------|----------|
| F17 | Deploy frontend actual | `bash deploy.sh` — los cambios F1-F16 no están en producción aún | 5min |

## ❌ BACKEND — Lo que TIENE que hacerse en el backend

### ISSUE-002: 🔴 P0 — Servicio de Embeddings Caído
**Archivo:** [BACKEND-ISSUE-002-EMBEDDING-SERVICE-DOWN.md](BACKEND-ISSUE-002-EMBEDDING-SERVICE-DOWN.md)

- **Síntoma:** `embedding.ok: false`, error `[Errno -3] Temporary failure in name resolution`
- **Impacto:** 100% de búsqueda y pipeline RAG bloqueados
- **Fix:** Restaurar contenedor TEI, verificar red Docker
- **Eval Spec:** EVAL-002 — Resiliencia del servicio de embeddings (scripts de validación incluidos)

### ISSUE-003: 🟡 P1 — OpenAI Embedding Adapter como Fallback
**Archivo:** [BACKEND-ISSUE-003-OPENAI-EMBEDDING-ADAPTER.md](BACKEND-ISSUE-003-OPENAI-EMBEDDING-ADAPTER.md)

- **Síntoma:** Sin fallback cuando TEI cae — 100% downtime de búsqueda
- **Impacto:** Disponibilidad de la plataforma atada a un único punto de fallo
- **Fix:** Implementar `OpenAIEmbeddingAdapter` + `FallbackEmbeddingAdapter`
- **Eval Spec:** EVAL-003 — Viabilidad del fallback de embeddings (golden set de 30 queries, MRR@5, switchover time)
- **Datos de referencia:** [EVAL-001](adr/EVAL-001-openai-embeddings-online.md)

### ISSUE-004: 🟡 P1 — Validación E2E del Pipeline Post-Fix
**Archivo:** [BACKEND-ISSUE-004-PIPELINE-E2E-VALIDATION.md](BACKEND-ISSUE-004-PIPELINE-E2E-VALIDATION.md)

- **Síntoma:** Pipeline falla en `retrieve_chunks` — no se ha podido verificar si el fix de `metadata_filters` funciona
- **Impacto:** No hay certeza de que el pipeline funcione incluso después de restaurar embeddings
- **Fix:** Validación completa de los 3 protocolos con 5 queries
- **Eval Spec:** EVAL-004 — Validación E2E del pipeline RAG (REST, OpenAI, MCP × 5 queries)

### Issues Legacy (ya documentados, parcialmente resueltos)

| Issue | Estado | Ref |
|---|---|---|
| metadata_filters en QdrantDBService | ¿Arreglado? (no verificable sin embeddings) | [BACKEND-ISSUE-PIPELINE-BROKEN.md](BACKEND-ISSUE-PIPELINE-BROKEN.md) |
| Feedback asyncpg event loop | ✅ Arreglado (retorna 200) | [legacy/docs/BACKEND-ISSUE-ENDPOINTS-500.md](legacy/docs/BACKEND-ISSUE-ENDPOINTS-500.md) |
| Metrics SQLAlchemy .isnull() | ✅ Arreglado (retorna 200) | [legacy/docs/BACKEND-ISSUE-ENDPOINTS-500.md](legacy/docs/BACKEND-ISSUE-ENDPOINTS-500.md) |
| Reset-reindex missing method | Desconocido (no testeado hoy) | [legacy/docs/BACKEND-ISSUE-ENDPOINTS-500.md](legacy/docs/BACKEND-ISSUE-ENDPOINTS-500.md) |
| PUT agents no existe | Conocido — frontend tiene workaround | [api-client.js](src/api-client.js) |

---

## Orden de Ejecución Recomendado

```
1. [BACKEND] ISSUE-002: Restaurar TEI         ← P0, 30min fix infra
   └─→ Ejecutar EVAL-002 (scripts incluidos)
   
2. [BACKEND] ISSUE-004: Validar pipeline E2E  ← P1, depende de #1
   └─→ Ejecutar EVAL-004 (3 protocolos × 5 queries)
   
3. [FRONTEND] F17: Deploy                     ← Una vez que #1+#2 pasen
   └─→ bash deploy.sh
   
4. [FRONTEND] F13-F16: Mejoras de UX          ← Paralelo a #3
   
5. [BACKEND] ISSUE-003: Fallback adapter      ← P1, sprint siguiente
   └─→ Ejecutar EVAL-003 (golden set + MRR@5)
```

---

## Resumen de Eval Specs Creadas

| ID | Título | Ubicación | Tipo |
|---|---|---|---|
| EVAL-001 | OpenAI Embeddings Online | [adr/EVAL-001](adr/EVAL-001-openai-embeddings-online.md) | ✅ Completada |
| EVAL-002 | Resiliencia Embedding Service | [ISSUE-002](BACKEND-ISSUE-002-EMBEDDING-SERVICE-DOWN.md#objective-eval-spec-mandatorio) | Pendiente |
| EVAL-003 | Fallback Embeddings | [ISSUE-003](BACKEND-ISSUE-003-OPENAI-EMBEDDING-ADAPTER.md#objective-eval-spec-mandatorio) | Pendiente |
| EVAL-004 | Pipeline E2E Post-Fix | [ISSUE-004](BACKEND-ISSUE-004-PIPELINE-E2E-VALIDATION.md#objective-eval-spec-mandatorio) | Pendiente |
