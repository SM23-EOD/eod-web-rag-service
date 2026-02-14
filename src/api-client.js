/**
 * RAG API Client - Envios23
 * Cliente centralizado para todos los endpoints de la API RAG v2
 * Base URL: /api/v2/ (via Traefik reverse proxy)
 */
class RAGApiClient {
    constructor(baseUrl = '/api/v2') {
        this.baseUrl = baseUrl;
        this.apiKey = localStorage.getItem('rag-api-key') || null;
    }

    // ── HTTP helpers ──────────────────────────────────────────────

    async _request(method, path, body = null, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['X-API-Key'] = this.apiKey;

        const config = { method, headers };
        if (body && method !== 'GET') config.body = JSON.stringify(body);

        try {
            const res = await fetch(url, config);
            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: res.statusText }));
                throw new ApiError(res.status, err.detail || err.message || res.statusText, err);
            }
            return await res.json();
        } catch (e) {
            if (e instanceof ApiError) throw e;
            throw new ApiError(0, e.message || 'Network error', { original: e });
        }
    }

    get(path) { return this._request('GET', path); }
    post(path, body) { return this._request('POST', path, body); }
    put(path, body) { return this._request('PUT', path, body); }
    del(path) { return this._request('DELETE', path); }

    // ── RAG Core ──────────────────────────────────────────────────

    async query(params) { return this.post('/query', params); }
    async ingest(docs) { return this.post('/ingest', docs); }
    async getStats(tenantId = 'default') { return this.get(`/stats?tenant_id=${tenantId}`); }
    async clearCache(tenantId = 'default') { return this.del(`/cache?tenant_id=${tenantId}`); }
    async health() { return this.get('/health'); }

    // ── Agents ────────────────────────────────────────────────────

    async createAgent(data) { return this.post('/agents', data); }
    async listAgents(status = null) {
        const q = status ? `?status_filter=${status}` : '';
        return this.get(`/agents${q}`);
    }
    async getAgent(id) { return this.get(`/agents/${id}`); }
    async deleteAgent(id) { return this.del(`/agents/${id}?confirm=true`); }
    async queryAgent(id, data) { return this.post(`/agents/${id}/query`, data); }
    async ingestAgent(id, docs) { return this.post(`/agents/${id}/ingest`, docs); }
    async agentStats(id) { return this.get(`/agents/${id}/stats`); }

    // ── Widget Config ─────────────────────────────────────────────

    async getWidgetConfig(tenantId) { return this.get(`/agents/${tenantId}/widget-config`); }
    async updateWidgetConfig(tenantId, data) { return this.put(`/agents/${tenantId}/widget-config`, data); }
    async resetWidgetConfig(tenantId) { return this.del(`/agents/${tenantId}/widget-config`); }

    // ── Tasks ─────────────────────────────────────────────────────

    async listTasks(tenantId = null, state = null, limit = null) {
        const params = new URLSearchParams();
        if (tenantId) params.set('tenant_id', tenantId);
        if (state) params.set('state', state);
        if (limit) params.set('limit', limit);
        const q = params.toString() ? `?${params}` : '';
        return this.get(`/tasks${q}`);
    }
    async getTask(taskId) { return this.get(`/tasks/${taskId}`); }
    async cleanupTasks(tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.del(`/tasks${q}`);
    }

    // ── Metrics ───────────────────────────────────────────────────

    async metricsDashboard(tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.get(`/metrics/dashboard${q}`);
    }
    async metricsCoverage(tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.get(`/metrics/coverage${q}`);
    }
    async metricsGaps(tenantId = null, unresolvedOnly = false, limit = 20) {
        const params = new URLSearchParams();
        if (tenantId) params.set('tenant_id', tenantId);
        if (unresolvedOnly) params.set('unresolved_only', 'true');
        if (limit) params.set('limit', limit);
        return this.get(`/metrics/gaps?${params}`);
    }
    async metricsGrounding(tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.get(`/metrics/grounding${q}`);
    }

    // ── Document Management (v2 /documents/* endpoints) ──────────

    async uploadDocuments(files, tenantId, autoIndex = true, background = false) {
        const params = new URLSearchParams({ tenant_id: tenantId, auto_index: autoIndex, background });
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

    async listDocuments(tenantId = null, statusFilter = null, categoryFilter = null) {
        const params = new URLSearchParams();
        if (tenantId) params.set('tenant_id', tenantId);
        if (statusFilter) params.set('status_filter', statusFilter);
        if (categoryFilter) params.set('category_filter', categoryFilter);
        const q = params.toString() ? `?${params}` : '';
        return this.get(`/documents${q}`);
    }
    async getDocument(id, tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.get(`/documents/${id}${q}`);
    }
    async deleteDocument(id, tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.del(`/documents/${id}${q}`);
    }
    async deleteAllDocuments(tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.del(`/documents${q}`);
    }
    async reindexDocument(id, tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.post(`/documents/${id}/reindex${q}`);
    }
    async documentStats(tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.get(`/documents/stats/summary${q}`);
    }
    async processPending(tenantId = null, forceReindex = false) {
        const params = new URLSearchParams();
        if (tenantId) params.set('tenant_id', tenantId);
        if (forceReindex) params.set('force_reindex', 'true');
        return this.post(`/documents/process-pending?${params}`);
    }
    async syncDirectory(dir, tenantId = null, recursive = true, forceReindex = false) {
        const params = new URLSearchParams({ directory: dir, recursive, force_reindex: forceReindex });
        if (tenantId) params.set('tenant_id', tenantId);
        return this.post(`/documents/sync/directory?${params}`);
    }
    async resetReindex(tenantId = null) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this.post(`/documents/reset-reindex${q}`);
    }

    // Legacy aliases (registry endpoints — kept for backward compat)
    async registryIngest(file, forceReindex = false) {
        return this.uploadDocuments([file], null, !forceReindex, false);
    }
    async registryStats() { return this.documentStats(); }
    async scanInbox(tenantId = null, force = false) {
        return this.processPending(tenantId, force);
    }

    // ── Tenants ───────────────────────────────────────────────────

    async listTenants(includeInactive = false) {
        return this.get(`/tenants?include_inactive=${includeInactive}`);
    }
    async createTenant(data) { return this.post('/tenants', data); }
    async getTenant(id) { return this.get(`/tenants/${id}`); }
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

    async submitFeedback(data) { return this.post('/feedback', data); }
    async listFeedback(filters = {}) {
        const params = new URLSearchParams();
        if (filters.rating) params.set('rating', filters.rating);
        if (filters.reviewed !== undefined) params.set('reviewed', filters.reviewed);
        if (filters.low_confidence) params.set('low_confidence', true);
        if (filters.limit) params.set('limit', filters.limit);
        const q = params.toString() ? `?${params}` : '';
        return this.get(`/feedback${q}`);
    }
    async feedbackStats() { return this.get('/feedback/stats'); }
    async markReviewed(id, action = null) {
        const q = action ? `?action_taken=${encodeURIComponent(action)}` : '';
        return this.post(`/feedback/${id}/review${q}`);
    }

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
                    if (data === '[DONE]') { onDone?.(); return; }
                    try { onChunk(JSON.parse(data)); } catch {}
                }
            }
        }
        onDone?.();
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
