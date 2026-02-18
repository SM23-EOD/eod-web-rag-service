/**
 * DRAGA Platform API Client
 * Cliente centralizado para todos los endpoints de la API v2
 * Base URL: /api/v2/ (via Traefik reverse proxy)
 *
 * Aligned with FRONTEND-API-REFERENCE.md (Febrero 2026):
 *   - Tenant = organización ligera, DRAGA = dueño de config RAG
 *   - Al crear tenant se auto-provisiona DRAGA 'default'
 *   - agent_id SIEMPRE se envía (incluso 'default')
 *   - Scope key: (tenant_id, agent_id) en todos los endpoints
 *   - Config RAG se lee/escribe en el DRAGA, no en el tenant
 *   - ~97 endpoints cubiertos
 */
class RAGApiClient {
    constructor(baseUrl = '/api/v2') {
        this.baseUrl = baseUrl;
        this.apiKey = localStorage.getItem('rag-api-key') || null;
    }

    // ── Scope helpers (ADR-018: tenant_id + agent_id) ─────────────

    /**
     * Build URLSearchParams with (tenant_id, agent_id) scope.
     * agent_id is ALWAYS sent (API requires it for DRAGA scoping).
     */
    _scopeParams(tenantId, agentId = null) {
        const params = new URLSearchParams();
        if (tenantId) params.set('tenant_id', tenantId);
        params.set('agent_id', agentId || 'default');
        return params;
    }

    _scopeQuery(tenantId, agentId = null) {
        const p = this._scopeParams(tenantId, agentId);
        return p.toString() ? `?${p}` : '';
    }

    // ── HTTP helpers ──────────────────────────────────────────────

    async _request(method, path, body = null, options = {}) {
        const maxRetries = options.retries ?? 2;        // up to 3 total attempts
        const retryDelay = options.retryDelay ?? 800;   // ms, doubles each retry
        const timeout = options.timeout ?? 15000;       // 15s default request timeout

        const url = `${this.baseUrl}${path}`;
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['X-API-Key'] = this.apiKey;

        const config = { method, headers };
        if (body && method !== 'GET') config.body = JSON.stringify(body);

        // AbortController for request timeout
        if (timeout > 0) {
            const controller = new AbortController();
            config.signal = controller.signal;
            setTimeout(() => controller.abort(), timeout);
        }

        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const res = await fetch(url, config);
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: res.statusText }));
                    const apiErr = new ApiError(res.status, err.detail || err.message || res.statusText, err);
                    // Retry on 429 (rate-limited) — honour Retry-After header
                    if (res.status === 429 && attempt < maxRetries) {
                        lastError = apiErr;
                        const retryAfter = res.headers.get('Retry-After');
                        const wait = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 10000) : retryDelay * Math.pow(2, attempt + 1);
                        await new Promise(r => setTimeout(r, wait || 2000));
                        continue;
                    }
                    // Retry only on 5xx (server) errors
                    if (res.status >= 500 && attempt < maxRetries) {
                        lastError = apiErr;
                        await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt)));
                        continue;
                    }
                    throw apiErr;
                }
                // 204 No Content or empty body — return null
                if (res.status === 204 || res.headers.get('content-length') === '0') return null;
                return await res.json();
            } catch (e) {
                if (e instanceof ApiError) {
                    if (e.status >= 500 && attempt < maxRetries) {
                        lastError = e;
                        await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt)));
                        continue;
                    }
                    throw e;
                }
                // Network errors — also retry
                if (e.name === 'AbortError') {
                    lastError = new ApiError(0, 'Request timeout — el servidor no responde', { original: e });
                } else {
                    lastError = new ApiError(0, e.message || 'Network error', { original: e });
                }
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt)));
                    continue;
                }
                throw lastError;
            }
        }
        throw lastError;
    }

    get(path) { return this._request('GET', path); }
    post(path, body) { return this._request('POST', path, body); }
    put(path, body) { return this._request('PUT', path, body); }
    del(path) { return this._request('DELETE', path); }

    // ── RAG Core ──────────────────────────────────────────────────

    /**
     * POST /query — RAG pipeline query.
     * Supports optional document_ids[] to restrict retrieval to specific documents.
     * @param {object} params - { query, tenant_id, agent_id?, top_k?, use_cache?, category_filter?, document_ids? }
     */
    async query(params) { return this.post('/query', params); }
    async ingest(docs) { return this.post('/ingest', docs); }
    async getStats(tenantId = null, agentId = null) {
        return this.get(`/stats${this._scopeQuery(tenantId, agentId)}`);
    }
    async clearCache(tenantId = null, agentId = null) {
        if (!tenantId) throw new ApiError(400, 'tenant_id requerido para limpiar caché');
        const p = this._scopeParams(tenantId, agentId);
        return this.del(`/cache?${p}`);
    }
    async health() { return this.get('/health'); }
    async healthDeep() { return this.get('/health/deep'); }

    // ── Agents ────────────────────────────────────────────────────

    async createAgent(data) { return this.post('/agents', data); }
    async listAgents(tenantId = null, status = null) {
        const params = new URLSearchParams();
        if (tenantId) params.set('tenant_id', tenantId);
        if (status) params.set('status_filter', status);
        const q = params.toString() ? `?${params}` : '';
        return this.get(`/agents${q}`);
    }
    async getAgent(tenantId, agentId = null) {
        const p = new URLSearchParams({ agent_id: agentId || 'default' });
        return this.get(`/agents/${tenantId}?${p}`);
    }
    async updateAgent(tenantId, agentId, data) {
        return this.put(`/agents/${tenantId}?agent_id=${agentId || 'default'}`, data);
    }
    async deleteAgent(tenantId, agentId = null) {
        const p = new URLSearchParams({ confirm: 'true', agent_id: agentId || 'default' });
        return this.del(`/agents/${tenantId}?${p}`);
    }
    async queryAgent(tenantId, data, agentId = null) {
        data.agent_id = agentId || 'default';
        return this.post(`/agents/${tenantId}/query`, data);
    }
    async ingestAgent(tenantId, docs, agentId = null) {
        docs.agent_id = agentId || 'default';
        return this.post(`/agents/${tenantId}/ingest`, docs);
    }
    async agentStats(tenantId, agentId = null) {
        const p = new URLSearchParams({ agent_id: agentId || 'default' });
        return this.get(`/agents/${tenantId}/stats?${p}`);
    }

    // ── API Keys ─────────────────────────────────────────────────

    async listApiKeys(tenantId) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.get(`/api-keys${q}`);
    }
    async createApiKey(data) { return this.post('/api-keys', data); }
    async revokeApiKey(keyId) { return this.del(`/api-keys/${keyId}`); }
    async revokeAllApiKeys(tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.post(`/api-keys/revoke-all${q}`);
    }

    // ── Conversations ────────────────────────────────────────────

    async listConversations(tenantId, limit = 20, agentId = null) {
        const params = this._scopeParams(tenantId, agentId);
        if (limit) params.set('limit', limit);
        return this.get(`/conversations?${params}`);
    }
    async getConversation(sessionId, tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.get(`/conversations/${sessionId}${q}`);
    }
    async deleteConversation(sessionId, tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.del(`/conversations/${sessionId}${q}`);
    }

    // ── Widget Config ─────────────────────────────────────────────

    async getWidgetConfig(tenantId, agentId = null) {
        return this.get(`/agents/${tenantId}/widget-config?agent_id=${agentId || 'default'}`);
    }
    async updateWidgetConfig(tenantId, data, agentId = null) {
        return this.put(`/agents/${tenantId}/widget-config?agent_id=${agentId || 'default'}`, data);
    }
    async resetWidgetConfig(tenantId, agentId = null) {
        return this.del(`/agents/${tenantId}/widget-config?agent_id=${agentId || 'default'}`);
    }

    // ── Tasks ──────────────────────────────────────────────────────

    async listTasks(tenantId = null, state = null, limit = null, agentId = null) {
        const params = this._scopeParams(tenantId, agentId);
        if (state) params.set('state', state);
        if (limit) params.set('limit', limit);
        const q = params.toString() ? `?${params}` : '';
        return this.get(`/tasks${q}`);
    }
    async getTask(taskId) { return this.get(`/tasks/${taskId}`); }
    async cleanupTasks(tenantId = null, agentId = null) {
        return this.del(`/tasks${this._scopeQuery(tenantId, agentId)}`);
    }

    // ── Metrics ───────────────────────────────────────────────────

    async metricsOperational(tenantId = null, agentId = null) {
        return this.get(`/metrics/operational${this._scopeQuery(tenantId, agentId)}`);
    }
    async metricsDashboard(tenantId = null, agentId = null) {
        return this.get(`/metrics/dashboard${this._scopeQuery(tenantId, agentId)}`);
    }
    async metricsCoverage(tenantId = null, agentId = null) {
        return this.get(`/metrics/coverage${this._scopeQuery(tenantId, agentId)}`);
    }
    async metricsGaps(tenantId = null, agentId = null, unresolvedOnly = false, limit = 20) {
        const params = this._scopeParams(tenantId, agentId);
        if (unresolvedOnly) params.set('unresolved_only', 'true');
        if (limit) params.set('limit', limit);
        return this.get(`/metrics/gaps?${params}`);
    }
    async metricsGrounding(tenantId = null, agentId = null) {
        return this.get(`/metrics/grounding${this._scopeQuery(tenantId, agentId)}`);
    }
    async metricsPrometheus() {
        const url = `${this.baseUrl}/metrics/prometheus`;
        const headers = {};
        if (this.apiKey) headers['X-API-Key'] = this.apiKey;
        const res = await fetch(url, { headers });
        return res.text();
    }

    // ── Document Management (v2 /documents/* endpoints) ──────────

    async uploadDocuments(files, tenantId, autoIndex = true, background = false, agentId = null) {
        if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
            throw new ApiError(400, 'tenant_id is required for document upload');
        }
        const params = new URLSearchParams({ tenant_id: tenantId, auto_index: autoIndex, background });
        params.set('agent_id', agentId || 'default');
        const url = `${this.baseUrl}/documents/upload?${params}`;
        const form = new FormData();
        files.forEach(f => form.append('files', f));
        const headers = {};
        if (this.apiKey) headers['X-API-Key'] = this.apiKey;
        const res = await fetch(url, { method: 'POST', headers, body: form });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: res.statusText }));
            throw new ApiError(res.status, err.detail || res.statusText, err);
        }
        return res.json();
    }

    async listDocuments(tenantId = null, statusFilter = null, categoryFilter = null, agentId = null) {
        const params = this._scopeParams(tenantId, agentId);
        if (statusFilter) params.set('status_filter', statusFilter);
        if (categoryFilter) params.set('category_filter', categoryFilter);
        const q = params.toString() ? `?${params}` : '';
        return this.get(`/documents${q}`);
    }
    async getDocument(id, tenantId = null, agentId = null) {
        return this.get(`/documents/${id}${this._scopeQuery(tenantId, agentId)}`);
    }
    async deleteDocument(id, tenantId = null, agentId = null) {
        return this.del(`/documents/${id}${this._scopeQuery(tenantId, agentId)}`);
    }
    async deleteAllDocuments(tenantId = null, agentId = null) {
        return this.del(`/documents${this._scopeQuery(tenantId, agentId)}`);
    }
    async reindexDocument(id, tenantId = null, agentId = null) {
        return this.post(`/documents/${id}/reindex${this._scopeQuery(tenantId, agentId)}`);
    }
    /**
     * Get the URL to the original source file for a document.
     * The backend serves the file with correct MIME type and Content-Disposition: inline.
     */
    getDocumentSourceUrl(documentId, tenantId = null, agentId = null) {
        return `${this.baseUrl}/documents/${documentId}/source${this._scopeQuery(tenantId, agentId)}`;
    }
    async documentStats(tenantId = null, agentId = null) {
        return this.get(`/documents/stats/summary${this._scopeQuery(tenantId, agentId)}`);
    }
    async renameDocument(id, displayName, tenantId = null, agentId = null) {
        const q = this._scopeQuery(tenantId, agentId);
        return this._request('PATCH', `/documents/${id}/rename${q}`, { display_name: displayName });
    }
    async cleanupPendingDeletes(tenantId = null, agentId = null) {
        return this.post(`/documents/maintenance/cleanup-pending-deletes${this._scopeQuery(tenantId, agentId)}`);
    }
    async processPending(tenantId = null, forceReindex = false, agentId = null) {
        const params = this._scopeParams(tenantId, agentId);
        if (forceReindex) params.set('force_reindex', 'true');
        return this.post(`/documents/process-pending?${params}`);
    }
    async syncDirectory(dir, tenantId = null, recursive = true, forceReindex = false, agentId = null) {
        const params = this._scopeParams(tenantId, agentId);
        params.set('directory', dir);
        params.set('recursive', recursive);
        params.set('force_reindex', forceReindex);
        return this.post(`/documents/sync/directory?${params}`);
    }
    async resetReindex(tenantId = null, agentId = null) {
        return this.post(`/documents/reset-reindex${this._scopeQuery(tenantId, agentId)}`);
    }

    /**
     * Retrieve chunks for a specific document by querying with a broad query
     * and filtering retrieved_chunks by document_id on the client side.
     * This is a workaround since the backend has no /documents/{id}/chunks endpoint.
     * Note: backend top_k max is 20.
     * IMPORTANT: Always requires tenant_id for tenant isolation.
     */
    async getDocumentChunks(documentId, tenantId = null, topK = 20, filenameHint = null, agentId = null) {
        if (!tenantId) {
            console.warn('[api] getDocumentChunks called without tenantId — returning empty');
            return [];
        }
        const queryText = filenameHint
            ? filenameHint.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
            : 'contenido completo del documento';
        const queryParams = {
            query: queryText,
            tenant_id: tenantId,
            top_k: Math.min(topK, 20),
            use_cache: false
        };
        queryParams.agent_id = agentId || 'default';
        const res = await this.query(queryParams);
        const all = res.retrieved_chunks || [];
        // Filter strictly to only chunks from this document
        return all.filter(c =>
            c.document_id === documentId ||
            c.metadata?.document_id === documentId
        );
    }

    // ── Quality (tenant_id in PATH per backend OpenAPI spec) ──────

    async qualitySummary(tenantId) {
        if (!tenantId) throw new ApiError(400, 'tenant_id required for quality summary');
        return this.get(`/quality/${tenantId}/summary`);
    }
    async qualityRecent(tenantId, limit = 20) {
        const q = limit ? `?limit=${limit}` : '';
        if (!tenantId) throw new ApiError(400, 'tenant_id required for quality recent');
        return this.get(`/quality/${tenantId}/recent${q}`);
    }

    // ── Ingestion ─────────────────────────────────────────────────

    async ingestionStats(tenantId = null, agentId = null) {
        return this.get(`/ingestion/stats${this._scopeQuery(tenantId, agentId)}`);
    }
    async ingestionJobs(tenantId = null, agentId = null, state = null, limit = null) {
        const params = this._scopeParams(tenantId, agentId);
        if (state) params.set('state', state);
        if (limit) params.set('limit', limit);
        const q = params.toString() ? `?${params}` : '';
        return this.get(`/ingestion/jobs${q}`);
    }
    async getIngestionJob(jobId) { return this.get(`/ingestion/jobs/${jobId}`); }

    // ── Admin Dashboard ───────────────────────────────────────────

    async adminDashboard() { return this.get('/admin/dashboard'); }
    async adminDashboardOverview() { return this.get('/admin/dashboard/overview'); }

    // ── Tenants ───────────────────────────────────────────────────

    async listTenants(includeInactive = false) {
        try {
            return await this.get(`/tenants?include_inactive=${includeInactive}`);
        } catch (e) {
            // Fallback 1: try without include_inactive param (handles 500)
            if (includeInactive) {
                console.warn('[api] listTenants with include_inactive failed, retrying without:', e.message);
                try {
                    return await this.get('/tenants');
                } catch (e2) {
                    // Fallback 2: if 403/401, return default tenant so pages don't break
                    if (e2.status === 403 || e2.status === 401) {
                        console.warn('[api] listTenants 403 — returning default tenant');
                        return { tenants: [{ tenant_id: 'default', name: 'Default', is_active: true }] };
                    }
                    throw e2;
                }
            }
            // Fallback 2: if 403/401, return default tenant
            if (e.status === 403 || e.status === 401) {
                console.warn('[api] listTenants 403 — returning default tenant');
                return { tenants: [{ tenant_id: 'default', name: 'Default', is_active: true }] };
            }
            throw e;
        }
    }
    async createTenant(data) { return this.post('/tenants', data); }
    async getTenant(id) {
        if (!id || id === 'null') return { tenant_id: id || 'default', name: 'Default' };
        return this.get(`/tenants/${id}`);
    }
    async updateTenant(id, data) { return this.put(`/tenants/${id}`, data); }
    async deleteTenant(id, deleteCollection = false) {
        return this.del(`/tenants/${id}?delete_collection=${deleteCollection}`);
    }

    // ── MCP ───────────────────────────────────────────────────────

    async mcpHealth() { return this.get('/mcp/health'); }
    async mcpTools() { return this.get('/mcp/tools'); }
    async mcpCallTool(toolName, args = {}, sessionId = 'default') {
        return this.post('/mcp/tools/call', { tool_name: toolName, arguments: args, session_id: sessionId });
    }
    async mcpPrompts() { return this.get('/mcp/prompts'); }
    async mcpRenderPrompt(name, args = {}) {
        return this.post('/mcp/prompts/render', { prompt_name: name, arguments: args });
    }
    async mcpResources() { return this.get('/mcp/resources'); }
    async mcpGetResource(path) { return this.get(`/mcp/resources/${path}`); }
    async mcpSession(id) { return this.get(`/mcp/sessions/${id}`); }
    async mcpClearSession(id) { return this.del(`/mcp/sessions/${id}`); }

    // ── Feedback ──────────────────────────────────────────────────

    async submitFeedback(data, tenantId = null, agentId = null) {
        const q = this._scopeQuery(tenantId, agentId);
        return this.post(`/feedback${q}`, data);
    }
    async listFeedback(filters = {}, tenantId = null, agentId = null) {
        const params = this._scopeParams(tenantId, agentId);
        if (filters.rating) params.set('rating', filters.rating);
        if (filters.reviewed !== undefined) params.set('reviewed', filters.reviewed);
        if (filters.low_confidence) params.set('low_confidence', true);
        if (filters.limit) params.set('limit', filters.limit);
        const q = params.toString() ? `?${params}` : '';
        return this.get(`/feedback${q}`);
    }
    async feedbackStats(tenantId = null, agentId = null) {
        return this.get(`/feedback/stats${this._scopeQuery(tenantId, agentId)}`);
    }
    async markReviewed(id, action = null, tenantId = null, agentId = null) {
        const params = this._scopeParams(tenantId, agentId);
        if (action) params.set('action_taken', action);
        const q = params.toString() ? `?${params}` : '';
        return this.post(`/feedback/${id}/review${q}`);
    }

    // ── Document Labels ───────────────────────────────────────────

    async listLabels(tenantId) {
        return this.get(`/agents/${tenantId}/labels`);
    }
    async createLabel(tenantId, data) {
        return this.post(`/agents/${tenantId}/labels`, data);
    }
    async getLabel(tenantId, labelId) {
        return this.get(`/agents/${tenantId}/labels/${labelId}`);
    }
    async updateLabel(tenantId, labelId, data) {
        return this._request('PATCH', `/agents/${tenantId}/labels/${labelId}`, data);
    }
    async deleteLabel(tenantId, labelId) {
        return this.del(`/agents/${tenantId}/labels/${labelId}`);
    }
    async getDocumentLabels(tenantId, documentId) {
        return this.get(`/agents/${tenantId}/documents/${documentId}/labels`);
    }
    async assignLabel(tenantId, documentId, labelId) {
        return this.post(`/agents/${tenantId}/documents/${documentId}/labels/${labelId}`);
    }
    async unassignLabel(tenantId, documentId, labelId) {
        return this.del(`/agents/${tenantId}/documents/${documentId}/labels/${labelId}`);
    }

    // ── Admin ─────────────────────────────────────────────────────

    async adminTenantUsage() { return this.get('/admin/tenants/usage'); }
    async adminTenantAudit(tenantId, filters = {}) {
        const params = new URLSearchParams();
        if (filters.action) params.set('action', filters.action);
        if (filters.resource_type) params.set('resource_type', filters.resource_type);
        if (filters.limit) params.set('limit', filters.limit);
        const q = params.toString() ? `?${params}` : '';
        return this.get(`/admin/tenants/${tenantId}/audit${q}`);
    }

    // ── Feature Flags ─────────────────────────────────────────────

    async listFeatureFlags() { return this.get('/admin/feature-flags'); }

    // ── OpenAI Compatible ─────────────────────────────────────────

    async chatCompletions(data) { return this.post('/chat/completions', data); }
    async listModels() { return this.get('/models'); }

    async chatCompletionsStream(data, onChunk, onDone) {
        const url = `${this.baseUrl}/chat/completions`;
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['X-API-Key'] = this.apiKey;

        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...data, stream: true })
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') { await onDone?.(); return; }
                    try { onChunk(JSON.parse(data)); } catch {}
                }
            }
        }
        await onDone?.();
    }
}

class ApiError extends Error {
    constructor(status, message, data = {}) {
        super(message);
        this.status = status;
        this.data = data;
    }
}

// Singleton
window.api = new RAGApiClient();
