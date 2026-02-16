# ADR-0008: Multi-DRAGA UI Alignment (Backend ADR-018)

**Fecha**: 2025-06-17  
**Estado**: ✅ Aceptado  
**Autores**: EOD Frontend Team  
**Decisión clave**: Propagate `agent_id` (second scope dimension) across entire frontend to support multiple DRAGAs per tenant

---

## Contexto y Problema

Backend ADR-018 "Multi-DRAGA per Tenant" introduced a fundamental architectural change: the single-tenant scope `(tenant_id)` evolved to a composite scope `(tenant_id, agent_id)`. Each DRAGA instance is now identified as an agent within a tenant, with `agent_id` defaulting to `"default"` for backward compatibility.

### Backend Changes (8 PRs merged)

| PR | Scope |
|---|---|
| #248 | Identity layer — composite PK `(tenant_id, agent_id)` |
| #249 | Adapter multi-DRAGA isolation |
| #250 | Migration & legacy fallback |
| #251 | API propagation (REST, OpenAI, MCP) |
| #252-255 | Vector, cache, metrics, feedback isolation |
| #259 | Deflection agent config |
| #260 | Guardrails per agent |

### Frontend Contract

- All endpoints now accept optional `agent_id` parameter
- When omitted, defaults to `"default"` → fully backward compatible
- Collection naming: `kb_{tenant_id}_{agent_id}` (legacy fallback: `kb_{tenant_id}`)
- Widget config: scoped per `(tenant_id, agent_id)`
- Plans: Free=1 DRAGA, Starter=3, Pro=10, Enterprise=unlimited

---

## Decisión

Align the entire frontend codebase with ADR-018 by:

1. **API Client (`api-client.js`)**: Add `agentId` parameter to all ~30 methods that accept `tenantId`. Use scope helpers (`_scopeParams`, `_scopeQuery`) for consistent URL construction.

2. **Instance Dashboard (`draga.html`)**: Add `App.agentId` alongside `App.tenantId`. Add agent selector dropdown in header. All 46 API call sites now pass both dimensions.

3. **Admin Dashboard (`admin.html`)**: Agent CRUD uses `(tenant_id, agent_id)` composite key. Agent modal includes tenant selector + agent_id field. Agent cards show both identifiers.

4. **URL Schema**: `draga.html?tenant=X&agent=Y#module` — `agent` param is optional (defaults to first available).

---

## Implementación

### API Client Scope Helpers

```javascript
_scopeParams(tenantId, agentId = null) {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenant_id', tenantId);
    if (agentId && agentId !== 'default') params.set('agent_id', agentId);
    return params;
}

_scopeQuery(tenantId, agentId = null) {
    const p = this._scopeParams(tenantId, agentId);
    return p.toString() ? `?${p}` : '';
}
```

### App Controller (draga.html)

```javascript
const App = {
    tenantId: null,
    agentId: null,    // ADR-018
    agents: [],
    
    async loadAgents(tenantId) { ... },
    switchAgent(aid) { ... },
    _updateUrl() {
        // ?tenant=X&agent=Y (omit agent when 'default')
    }
};
```

### Backward Compatibility

- `agent_id` is **never** sent when value is `"default"` → old backends work unchanged
- All parameters are **optional** → graceful degradation
- Legacy `registryIngest()` marked deprecated with console warning

---

## Consecuencias

### Positivas
- Full alignment with backend multi-DRAGA architecture
- Users can manage multiple DRAGAs within a single tenant
- Widget config, KB, metrics, feedback all scoped per agent
- Embed codes include `agent-id` attribute when non-default
- Zero breaking changes for existing single-DRAGA deployments

### Negativas
- ~80 lines of additional code across 3 files
- Agent selector adds minor UI complexity

### Riesgos
- Backend `listAgents(tenantId)` endpoint must be stable
- Plan tier enforcement (max DRAGAs) not yet implemented in frontend

---

## Archivos Impactados

| Archivo | Cambios |
|---|---|
| `src/api-client.js` | +40 lines — scope helpers, agentId on ~30 methods |
| `draga.html` | +50 lines — App.agentId, agent selector, 46 call sites |
| `admin.html` | +25 lines — agent modal with tenant selector, CRUD with composite key |
