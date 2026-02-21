# Frontend Audit — eod-web-rag-service

**Fecha:** Febrero 2026  
**Auditor:** Agente automatizado  
**Scope:** 4 archivos principales (admin.html, tenant.html, draga.html, src/api-client.js)

---

## 1. Inventario de Archivos

| Archivo | Líneas | Rol |
|---|---|---|
| `src/api-client.js` | 591 | Cliente centralizado (~50+ métodos), singleton `window.api` |
| `admin.html` | 1918 | Dashboard Plataforma (Level 1): tenants, agents, api keys, analytics, system |
| `tenant.html` | 984 | Dashboard Tenant (Level 2): lista de DRAGAs, analytics, search cross-DRAGA |
| `draga.html` | 4336 | Dashboard DRAGA (Level 3): overview, KB, pipeline, quality, chat, widgets, config |

**Total:** 7829 líneas de código frontend.

---

## 2. Estructura de Módulos

### api-client.js (591 líneas)

| Sección | Líneas | Descripción |
|---|---|---|
| `ApiError` class | ~1-10 | Error custom con status/message |
| `RAGApiClient` constructor | ~12-40 | Base URL `/api/v2`, retry config (2 retries, 800ms backoff, 15s timeout) |
| HTTP helpers | ~42-93 | `_request()` con retry 429/5xx, `get/post/put/del/patch`, `_scopeParams/Query` |
| RAG Core | ~125-137 | `query()`, `getStats()`, `clearCache()`, `health()`, `healthDeep()` |
| Agents | ~141-175 | `createAgent()`, `listAgents()`, `getAgent()`, `updateAgent()`, `deleteAgent()`, `destroyAgent()` |
| API Keys | ~177-190 | `listApiKeys()`, `createApiKey()`, `revokeApiKey()`, `revokeAllApiKeys()` |
| Conversations | ~192-204 | `listConversations()`, `getConversation()`, `deleteConversation()` |
| Widget Config | ~206-218 | `getWidgetConfig()`, `updateWidgetConfig()`, `resetWidgetConfig()` |
| Tasks | ~220-230 | `listTasks()`, `getTask()`, `cleanupTasks()` |
| Metrics | ~232-270 | 9 endpoints: `metricsOperational`, `Dashboard`, `Coverage`, `Gaps`, `Grounding`, `KbCoverage`, `Trends`, `Prometheus` |
| Documents | ~272-340 | 14 endpoints: upload, list, get, delete, reindex, rename, ingestUrl, syncDirectory, etc. |
| Quality | ~342-350 | `qualitySummary()`, `qualityRecent()` |
| Ingestion | ~352-365 | `ingestionStats()`, `ingestionJobs()`, `getIngestionJob()` |
| Admin | ~367-375 | `adminDashboard()`, `adminDashboardOverview()` |
| Tenants | ~377-420 | `listTenants()` (con fallback chain), `create/get/update/deleteTenant()` |
| MCP | ~422-455 | `mcpHealth/Tools/CallTool/Prompts/RenderPrompt/Resources/GetResource/Session/ClearSession` |
| Feedback | ~457-480 | `submitFeedback()`, `listFeedback()`, `feedbackStats()`, `markReviewed()` |
| Labels | ~482-515 | `list/create/get/update/deleteLabel()`, `getDocumentLabels()`, `assign/unassignLabel()` |
| Admin extended | ~517-530 | `adminTenantUsage()`, `adminTenantAudit()` |
| Feature Flags | ~532-570 | 8 endpoints: list, reload, get/set/delete tenant flags, global flags, platformReset |
| OpenAI compat | ~572-591 | `chatCompletions()`, `listModels()`, `chatCompletionsStream()` |

### admin.html (1918 líneas)

| Módulo | Función | Línea aprox. | Descripción |
|---|---|---|---|
| Nav | `nav()` | ~876 | Navegación entre módulos, hash-based |
| Health | `checkHealth()` | ~895 | Deep health check con badge de estado |
| DRAGA Modal | `showDragaModal()` / `createDraga()` | ~928-1110 | Creación de DRAGA: selección tenant, validación, wizard |
| Dashboard | `loadDashboard()` | ~1115-1230 | Hero stats, tenant hierarchy, per-agent cards |
| Tenants | `loadTenants()` / `saveTenant()` / `editTenant()` / `deleteTenantAction()` | ~1235-1330 | CRUD de tenants |
| Agents | `loadAgents()` / `deleteAgentAction()` | ~1335-1440 | Listado y borrado de agents agrupados por tenant |
| API Keys | `loadApiKeys()` / `createApiKeyAction()` / `revokeApiKeyAction()` | ~1500-1590 | Gestión de API keys |
| Analytics | `loadAnalytics()` | ~1595 | Orquestación: health, feedback, system, quality |
| Quality | `loadQualityGlobal()` | ~1700-1760 | Métricas agregadas: coverage, grounding, feedback |
| System | `loadSystem()` / `loadMcpTools/Prompts/Resources()` / `loadModels()` | ~1780-1870 | Info de sistema, MCP, modelos |

### tenant.html (984 líneas)

| Objeto | Línea aprox. | Descripción |
|---|---|---|
| `TenantApp` | ~375 | Controlador principal: init, carga tenant, nav |
| `TenantApp._renderDragaCards()` | ~540 | Render de tarjetas DRAGA con stats |
| `TenantAnalytics` | ~640 | Analytics tenant: health, quality, metrics, feedback |
| `TenantSearch` | ~800 | Búsqueda cross-DRAGA con Promise.all por agent |

### draga.html (4336 líneas)

| Objeto | Línea aprox. | Descripción |
|---|---|---|
| `DocViewer` | ~1190 | Overlay de visualización de documentos/chunks |
| `DangerZone` | ~1420 | Eliminación de DRAGA (cascade) |
| `App` | ~1470 | Controlador: init, nav, checkHealth, loadAgents, switchAgent |
| `Overview` | ~1706 | Stats, pipeline models, protocol checks |
| `SourceFilter` | ~1920 | Filtro de fuentes para queries (localStorage) |
| `KB` | ~1943 | Knowledge Base: docs CRUD, upload, URL ingest, text docs, labels, search vectorial |
| `PipelineModule` | ~2869 | Cargador de módulo pipeline con health check |
| `Pipeline` | ~2930 | Test pipeline en vivo: REST/OpenAI/MCP |
| `Quality` | ~3095 | Métricas de calidad, gaps, feedback |
| `Chat` | ~3182 | Chat multi-protocolo con feedback, fuentes, streaming |
| `ConvHistory` | ~3477 | Historial de conversaciones |
| `Widgets` | ~3530 | Generador de widgets: config, preview live/mockup, embed/iframe code |
| `ApiKeys` | ~3925 | API keys por DRAGA |
| `Config` | ~3986 | Config retrieval, system prompt, MCP prompts, embed codes |
| `WidgetCfg` | ~4195 | Configuración visual del widget (theme, branding, behavior) |
| `TasksMod` | ~4292 | Monitor de tareas de ingesta |

---

## 3. Bugs Confirmados

### BUG-1: admin.html — "DOCUMENTOS" muestra conteo inexacto
**Severidad:** Media  
**Ubicación:** [admin.html#L1150-L1169](admin.html#L1150-L1169)

**Problema:** El hero stat `statDocs` agrega documentos usando `getStats(tenantId)` por tenant, NO por agent. Como `getStats()` solo acepta `tenant_id` (sin `agent_id`), si un tenant tiene múltiples DRAGAs, los docs se cuentan una sola vez y se asignan al primer agent del `agentStatsMap`. Además, el campo `total_documents` de `getStats()` puede no existir — el endpoint retorna stats del vector store, no el registro de documentos.

```javascript
// Línea ~1150: getStats llamado por tenant_id único, no per-agent
const uniqueTenants = [...new Set(allAgents.map(a => a.tenant_id))];
const statsResults = await Promise.all(
    uniqueTenants.map(tid => api.getStats(tid).catch(() => ({})))
);
uniqueTenants.forEach((tid, i) => {
    // MISMA stats asignada a TODOS los agents del tenant
    allAgents.filter(a => a.tenant_id === tid).forEach(a => {
        agentStatsMap[`${a.tenant_id}/${a.agent_id}`] = statsResults[i] || {};
    });
});
// Línea ~1165: Suma agentDocSum = DOBLE/TRIPLE conteo si >1 agent por tenant
const agentDocSum = Object.values(agentStatsMap).reduce(
    (s, st) => s + (st.total_documents || st.document_count || 0), 0);
```

**Impacto:** Si un tenant tiene 3 DRAGAs, los documentos se cuentan ×3 en el hero stat.

**Fix recomendado:** Usar `documentStats(tenantId, agentId)` per-agent en lugar de `getStats(tenantId)` per-tenant. O sumar solo por `uniqueTenants` en vez de por agents.

---

### BUG-2: admin.html — Quality stats siempre "—"
**Severidad:** Baja  
**Ubicación:** [admin.html#L1700-L1740](admin.html#L1700-L1740)

**Problema:** `loadQualityGlobal()` depende de:
- `metricsGrounding()` → `avg_grounding_rate` — requiere historial de queries con NLI scoring
- `metricsCoverage()` per-agent → `coverage_rate` — requiere evaluación de cobertura
- `feedbackStats()` → `total_feedback` — requiere que usuarios hayan dado feedback

Si no hay queries previas (plataforma recién instalada o sin uso activo), todos los endpoints retornan datos vacíos/null, resultando en "—" para todas las métricas.

**Impacto:** Las métricas de calidad parecen rotas cuando en realidad no hay datos suficientes.

**Fix recomendado:** Mostrar un mensaje explícito tipo "Sin datos de queries — las métricas aparecerán después de interacciones" en lugar de "—" genérico.

---

### BUG-3: tenant.html — Per-DRAGA stats todas iguales (CRÍTICO)
**Severidad:** Alta  
**Ubicación:** [tenant.html#L541-L547](tenant.html#L541-L547)

**Problema:**
```javascript
// Línea ~541: UNA sola llamada para todo el tenant
const tenantStats = await api.getStats(this.tenantId).catch(() => ({}));
// Línea ~544-546: CADA card DRAGA usa el MISMO objeto de stats
this.agents.map((a, i) => {
    const s = tenantStats || {};  // ← SIEMPRE lo mismo
    const docs = s.total_documents || s.document_count || 0;
    const chunks = s.total_chunks || s.chunk_count || 0;
```

**Impacto:** Si un tenant tiene 3 DRAGAs con 10, 20 y 5 documentos respectivamente, las 3 tarjetas muestran el mismo número (el total del tenant).

**Fix recomendado:**
```javascript
// Opción A: documentStats per-agent
const statsMap = {};
await Promise.all(this.agents.map(async a => {
    try {
        statsMap[a.agent_id] = await api.documentStats(this.tenantId, a.agent_id);
    } catch { statsMap[a.agent_id] = {}; }
}));
// En el .map():
const s = statsMap[a.agent_id] || {};
const docs = s.total_documents || 0;
const chunks = s.total_chunks || 0;
```

---

### BUG-4: api-client.js — `updateAgent()` workaround roto
**Severidad:** Media  
**Ubicación:** [api-client.js#L155-L172](src/api-client.js#L155-L172)

**Problema:** El backend NO tiene endpoint PUT para agents. El método `updateAgent()` hace un workaround:
1. GET agent actual
2. Merge data
3. DELETE agent
4. POST crear agente nuevo con datos mergeados

Esto es frágil: si el DELETE sucede pero el POST falla (cuerpo inválido, red, etc.), se pierde el agente completamente. Además hay un `console.warn` visible en producción.

**Impacto:** `Config.saveRetrieval()` y `Config.saveSystemPrompt()` en draga.html dependen de `updateAgent()`. Si falla, la config del DRAGA se pierde.

**Fix recomendado:** Coordinar con backend para implementar `PUT /agents/{tenant_id}/{agent_id}`. Mientras tanto, documentar el riesgo y considerar backup del agente previo en localStorage antes del delete+create.

---

### BUG-5: draga.html — Labels deshabilitados (UI oculta)
**Severidad:** Baja (funcional pero sin UI)  
**Ubicación:** [draga.html#L564](draga.html#L564) (HTML) + [draga.html#L1957](draga.html#L1957) (JS)

**Problema:** La barra de labels está comentada en el HTML:
```html
<!-- Label Management Bar (DISABLED — pending rate-limit solution) -->
```
Y en el KB.load():
```javascript
// Labels disabled: await this.loadLabels();
```

Toda la infraestructura de labels está completa (create/edit/delete/assign/unassign, picker UI, render), pero deshabilitada por problemas de rate-limit pendientes.

**Impacto:** Feature completa no accesible. ~200 líneas de código muerto (labels en KB).

**Fix recomendado:** Implementar debounce/throttle en `toggleDocLabel()` y habilitar la feature.

---

### BUG-6: admin.html — Hero stat docs DUPLICA conteo multi-agent
**Severidad:** Media  
**Ubicación:** [admin.html#L1165](admin.html#L1165)

**Problema:** Directamente relacionado con BUG-1. La suma en `agentDocSum` itera `Object.values(agentStatsMap)` que contiene N copias de los MISMOS stats cuando un tenant tiene N agents. Esto multiplica artificialmente el conteo.

**Ejemplo:** Tenant `eod-sm23` con agents `draga` y `envio23` → getStats para `eod-sm23` retorna 500 chunks → `agentStatsMap` tiene `eod-sm23/draga = 500` y `eod-sm23/envio23 = 500` → hero muestra 1000 (×2).

---

### BUG-7: api-client.js — `getStats()` no acepta `agent_id`
**Severidad:** Media  
**Ubicación:** [api-client.js#L128-L131](src/api-client.js#L128-L131)

**Problema:**
```javascript
async getStats(tenantId = null) {
    const q = tenantId ? `?tenant_id=${tenantId}` : '';
    return this.get(`/stats${q}`);
}
```
El método solo acepta `tenant_id`, no `agent_id`. Esto hace que cualquier uso de `getStats()` para obtener stats per-DRAGA sea imposible — siempre retorna stats a nivel tenant.

**Impacto:** BUG-1, BUG-3, BUG-6 son consecuencia directa de esta limitación.

**Fix recomendado:** Aceptar `agentId` como segundo parámetro y enviarlo como query param (si el backend lo soporta), o migrar todos los usos de conteo a `documentStats(tenantId, agentId)`.

---

## 4. API Methods: Used vs Unused

### Métodos USADOS (por al menos 1 UI)

| Método | admin | tenant | draga |
|---|---|---|---|
| `query()` | | ✅ | ✅ |
| `getStats()` | ✅ | ✅ | ✅ |
| `health()` | ✅ | | ✅ |
| `healthDeep()` | ✅ | ✅ | ✅ |
| `createAgent()` | ✅ | ✅ | ✅ |
| `listAgents()` | ✅ | ✅ | ✅ |
| `getAgent()` | | | ✅ |
| `updateAgent()` | | | ✅ |
| `deleteAgent()` | ✅ | ✅ | ✅ |
| `listApiKeys()` | ✅ | ✅ | ✅ |
| `createApiKey()` | ✅ | | ✅ |
| `revokeApiKey()` | ✅ | | ✅ |
| `listConversations()` | | | ✅ |
| `getConversation()` | | | ✅ |
| `getWidgetConfig()` | | | ✅ |
| `updateWidgetConfig()` | | | ✅ |
| `resetWidgetConfig()` | | | ✅ |
| `listTasks()` | | | ✅ |
| `getTask()` | | | ✅ |
| `cleanupTasks()` | | | ✅ |
| `metricsCoverage()` | ✅ | ✅ | ✅ |
| `metricsGaps()` | | | ✅ |
| `metricsGrounding()` | ✅ | ✅ | ✅ |
| `uploadDocuments()` | | | ✅ |
| `listDocuments()` | | | ✅ |
| `getDocument()` | | | ✅ |
| `deleteDocument()` | | | ✅ |
| `reindexDocument()` | | | ✅ |
| `getDocumentSourceUrl()` | | | ✅ |
| `ingestUrl()` | | | ✅ |
| `documentStats()` | | | ✅ |
| `renameDocument()` | | | ✅ |
| `processPending()` | | | ✅ |
| `syncDirectory()` | | | ✅ |
| `resetReindex()` | | | ✅ |
| `getDocumentChunks()` | | | ✅ |
| `listTenants()` | ✅ | ✅ | ✅ |
| `createTenant()` | ✅ | | |
| `getTenant()` | | | ✅ |
| `updateTenant()` | ✅ | | ✅ |
| `deleteTenant()` | ✅ | ✅ | |
| `mcpHealth()` | | | ✅ |
| `mcpTools()` | ✅ | | ✅ |
| `mcpCallTool()` | | | ✅ |
| `mcpPrompts()` | ✅ | | ✅ |
| `mcpRenderPrompt()` | | | ✅ |
| `mcpResources()` | ✅ | | |
| `submitFeedback()` | | | ✅ |
| `listFeedback()` | ✅ | ✅ | ✅ |
| `feedbackStats()` | ✅ | ✅ | ✅ |
| `markReviewed()` | ✅ | | |
| `listLabels()` | | | ✅ |
| `createLabel()` | | | ✅ |
| `updateLabel()` | | | ✅ |
| `deleteLabel()` | | | ✅ |
| `getDocumentLabels()` | | | ✅ |
| `assignLabel()` | | | ✅ |
| `unassignLabel()` | | | ✅ |
| `chatCompletions()` | | | ✅ |
| `chatCompletionsStream()` | | | ✅ |
| `listModels()` | ✅ | | ✅ |
| `adminDashboardOverview()` | ✅ | | |

**Total usados: ~55 métodos**

### Métodos NO USADOS por ninguna UI (25 métodos)

| Método | Línea | Motivo probable |
|---|---|---|
| `clearCache()` | ~132 | Sin botón de cache clear en ninguna UI |
| `destroyAgent()` | ~174 | `deleteAgent()` se usa en su lugar |
| `revokeAllApiKeys()` | ~189 | Solo revocación individual implementada |
| `deleteConversation()` | ~204 | Historial es read-only en la UI |
| `metricsOperational()` | ~232 | Sin panel de métricas operacionales |
| `metricsDashboard()` | ~236 | Nunca referenciado |
| `metricsKbCoverage()` | ~256 | Se usa `metricsCoverage()` en su lugar |
| `metricsTrends()` | ~260 | Sin gráficos de tendencias |
| `metricsPrometheus()` | ~264 | Endpoint Prometheus sin integración |
| `deleteAllDocuments()` | ~298 | Solo borrado individual (tiene `resetReindex` como nuclear) |
| `cleanupPendingDeletes()` | ~310 | Sin botón de cleanup deletes |
| `qualitySummary()` | ~342 | Se usa `metricsGrounding()` + desglose manual |
| `qualityRecent()` | ~346 | Sin historial reciente de quality checks |
| `ingestionStats()` | ~352 | Se usa `listTasks()` en su lugar |
| `ingestionJobs()` | ~356 | Se usa `listTasks()` en su lugar |
| `getIngestionJob()` | ~362 | Se usa `getTask()` en su lugar |
| `adminDashboard()` | ~367 | Se usa `adminDashboardOverview()` |
| `mcpSession()` | ~448 | Sesiones MCP no gestionadas desde UI |
| `mcpClearSession()` | ~450 | Sesiones MCP no gestionadas desde UI |
| `mcpGetResource()` | ~444 | Solo `mcpResources()` (listing) se usa |
| `adminTenantUsage()` | ~517 | Sin panel de usage por tenant |
| `adminTenantAudit()` | ~522 | Sin audit log en UI |
| `listFeatureFlags()` | ~532 | Sin UI de feature flags |
| `reloadFeatureFlags()` | ~536 | Sin UI de feature flags |
| `getTenantFlags()` | ~540 | Sin UI de feature flags |
| `getTenantFlagsResolved()` | ~544 | Sin UI de feature flags |
| `setTenantFlag()` | ~548 | Sin UI de feature flags |
| `deleteTenantFlag()` | ~554 | Sin UI de feature flags |
| `setGlobalFlag()` | ~560 | Sin UI de feature flags |
| `platformReset()` | ~566 | Sin botón de reset de plataforma |
| `getLabel()` | ~494 | Se usa `listLabels()` y filtra client-side |

**~30 métodos sin usar** (~42% del total de endpoints definidos).

---

## 5. Hallazgos de Código Adicionales

### 5.1 PipelineModule — YA NO es dead code
**Ubicación:** [draga.html#L2869](draga.html#L2869)

El AGENTS.md mencionaba que `PipelineModule` era `() => {}` (dead code). Esto ya fue corregido. Ahora tiene implementación real:
```javascript
const PipelineModule = {
    async load() {
        await Promise.all([Pipeline.load(), this._updateStepHealth()]);
    },
    async _updateStepHealth() { ... } // Marks pipeline steps based on healthDeep()
};
```

### 5.2 Error handling robusto pero inconsistente
- **draga.html** usa `Promise.allSettled()` en Quality.loadMetrics() — **buena práctica**
- **admin.html** usa `Promise.all()` con `.catch(() => null)` pattern — funcional pero menos limpio
- **tenant.html** usa `.catch(() => ({}))` inline — propenso a errores silenciosos
- Hay varios `catch {}` vacíos en tenant.html y admin.html (viola la regla del AGENTS.md)

### 5.3 Redundancia en health checks
`healthDeep()` se llama múltiples veces en draga.html:
1. `App.checkHealth()` (línea ~1550)
2. `Overview.load()` (línea ~1720, vector DB detection)
3. `Overview.load()` (línea ~1760, pipeline steps)
4. `PipelineModule._updateStepHealth()` (línea ~2880)

**Recomendación:** Cachear el resultado de `healthDeep()` durante el ciclo de carga de un módulo:
```javascript
App._healthCache = null;
App.getCachedHealth = async () => App._healthCache ??= await api.healthDeep();
```

### 5.4 XSS — función `esc()` como única barrera
Todos los HTML files usan una función `esc()` para sanitizar, pero hay lugares donde se bypasea:
- En `showDetail()` y templates con `onclick` handlers que concatenan strings directamente
- Filenames con comillas o caracteres especiales podrían romper atributos onclick

### 5.5 KB es el objeto más complejo
El objeto `KB` en draga.html (~900 líneas, ~1943-2860) maneja:
- Listado/paginación de docs
- Upload con drag & drop
- URL ingestion
- Text document creation
- Labels (CRUD + assign/unassign, aunque deshabilitado)
- Polling de ingestion tasks con tracker UI
- Vector search via MCP
- Rename, reindex, delete individual y nuclear
- Source filter integration
- Stabilization polling (espera a que docs se indexen)

**Recomendación:** Extraer a módulo separado `src/kb-module.js`.

### 5.6 Widget generator almacena en localStorage
`Widgets` (draga.html ~3530-3920) guarda configs de widgets en `localStorage` bajo `draga-widgets-{tenant}-{agent}`. Esto significa:
- Los widgets no se sincronizan entre browsers/dispositivos
- No hay respaldo server-side
- Se pierden al limpiar localStorage

### 5.7 SourceFilter — Buen diseño
El objeto `SourceFilter` (~1920-1940) está bien diseñado:
- Persiste en localStorage por `tenant_id + agent_id`
- Se integra limpiamente con queries (chat, pipeline, quality test)
- `getActiveIds()` retorna `null` cuando no hay filtro (no filtra innecesariamente)

---

## 6. Discrepancias con AGENTS.md

| Claim en AGENTS.md | Estado Real |
|---|---|
| "Pipeline module es `() => {}` (dead code)" | **CORREGIDO** — PipelineModule tiene implementación real |
| "Labels deshabilitados" | **CONFIRMADO** — HTML comentado, JS commented out |
| "`updateAgent` roto" | **CONFIRMADO** — workaround DELETE+POST, no hay PUT |
| "DOCUMENTOS muestra chunks en vez de documentos" | **PARCIALMENTE** — muestra `total_documents` de getStats (que puede ser inexacto), no chunks directamente |
| "Quality stats muestran —" | **CONFIRMADO** — sin datos de queries, métricas retornan null |
| "per-DRAGA stats usan single getStats()" | **CONFIRMADO** — todas las cards muestran el mismo número |
| "~15 métodos definidos que ninguna UI usa" | **SUBESTIMADO** — son ~30 métodos no usados |

---

## 7. Resumen de Prioridades

### Prioridad Alta (fix inmediato)
1. **BUG-3:** tenant.html per-DRAGA stats (todas iguales) → usar `documentStats()` per-agent
2. **BUG-1/6:** admin.html docs duplicados → sumar por unique tenant, no por agent entries

### Prioridad Media (mejora planificada)
3. **BUG-4:** updateAgent() workaround → coordinar PUT con backend
4. **BUG-7:** getStats() sin agent_id → agregar parámetro o migrar a documentStats()
5. Cachear healthDeep() por ciclo de carga en draga.html

### Prioridad Baja (deuda técnica)
6. **BUG-5:** Habilitar labels (requiere rate-limit solution)
7. **BUG-2:** Reemplazar "—" con mensaje explicativo en quality stats
8. Limpiar ~30 métodos no usados en api-client.js (o crear UI para feature flags, metrics dashboard, etc.)
9. Extraer KB de draga.html a módulo separado
10. Eliminar catch vacíos, agregar error logging consistente

---

## 8. Métricas de Cobertura

| Métrica | Valor |
|---|---|
| Total API methods definidos | ~55 |
| API methods usados por UI | ~55 (algunos duplicados en la tabla) |
| API methods sin usar | ~30 |
| % cobertura de uso | ~58% |
| Total líneas frontend | 7829 |
| Líneas en draga.html (% del total) | 4336 (55%) |
| Bugs confirmados | 7 |
| Bugs severidad alta | 1 |
| Bugs severidad media | 3 |
| Bugs severidad baja | 3 |
