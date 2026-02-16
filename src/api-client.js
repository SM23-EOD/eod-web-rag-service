/**
 * DRAGA Platform API Client
 * Cliente centralizado para todos los endpoints de la API v2
 * Base URL: /api/v2/ (via Traefik reverse proxy)
 *
 * Endpoint alignment status (verified 2025-06-16):
 *   ✅ Working: /health, /query, /chat/completions, /models, /tenants, /agents,
 *              /documents, /documents/{id}, /documents/stats/summary,
 *              /documents/upload, /documents/process-pending, /stats, /cache,
 *              /mcp/health, /mcp/tools, /mcp/prompts, /mcp/resources
 *   ⚠️  Degraded (backend bugs #252-#255): /feedback, /metrics/*,
 *              /documents/reset-reindex, /documents/sync/directory
 *
 * ADR-018 Multi-DRAGA: All methods that accept tenantId now also accept
 * optional agentId (defaults to 'default'). Scope key: (tenant_id, agent_id).
 */
class RAGApiClient {
    constructor(baseUrl = '/api/v2') {
        this.baseUrl = baseUrl;
        this.apiKey = localStorage.getItem('rag-api-key') || null;
    }

    // ── Scope helpers (ADR-018: tenant_id + agent_id) ─────────────

    /**
     * Build URLSearchParams with (tenant_id, agent_id) scope.
     * agent_id is optional — omitted when 'default' to maintain backward compat.
     */
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

    // ── HTTP helpers ──────────────────────────────────────────────

    async _request(method, path, body = null, options = {}) {
        const maxRetries = options.retries ?? 2;        // up to 3 total attempts
        const retryDelay = options.retryDelay ?? 800;   // ms, doubles each retry

        const url = `${this.baseUrl}${path}`;
        const headers = { 'Content-Type': 'application/json' };
        if (this.apiKey) headers['X-API-Key'] = this.apiKey;

        const config = { method, headers };
        if (body && method !== 'GET') config.body = JSON.stringify(body);

        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const res = await fetch(url, config);
                if (!res.ok) {
                    const err = await res.json().catch(() => ({ detail: res.statusText }));
                    const apiErr = new ApiError(res.status, err.detail || err.message || res.statusText, err);
                    // Retry only on 5xx (server) errors
                    if (res.status >= 500 && attempt < maxRetries) {
                        lastError = apiErr;
                        await new Promise(r => setTimeout(r, retryDelay * Math.pow(2, attempt)));
                        continue;
                    }
                    throw apiErr;
                }
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
                lastError = new ApiError(0, e.message || 'Network error', { original: e });
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
        const q = agentId && agentId !== 'default' ? `?agent_id=${agentId}` : '';
        return this.get(`/agents/${tenantId}${q}`);
    }
    async deleteAgent(tenantId, agentId = null) {
        const p = new URLSearchParams({ confirm: 'true' });
        if (agentId && agentId !== 'default') p.set('agent_id', agentId);
        return this.del(`/agents/${tenantId}?${p}`);
    }
    async queryAgent(tenantId, data, agentId = null) {
        if (agentId && agentId !== 'default') data.agent_id = agentId;
        return this.post(`/agents/${tenantId}/query`, data);
    }
    async ingestAgent(tenantId, docs, agentId = null) {
        if (agentId && agentId !== 'default') docs.agent_id = agentId;
        return this.post(`/agents/${tenantId}/ingest`, docs);
    }
    async agentStats(tenantId, agentId = null) {
        const q = agentId && agentId !== 'default' ? `?agent_id=${agentId}` : '';
        return this.get(`/agents/${tenantId}/stats${q}`);
    }

    // ── API Keys (502 on current backend — service not deployed) ──

    async listApiKeys(tenantId) {
        const q = tenantId ? `?tenant_id=${tenantId}` : '';
        return this._request('GET', `/api-keys${q}`, null, { retries: 0 });
    }
    async createApiKey(data) { return this._request('POST', '/api-keys', data, { retries: 0 }); }
    async revokeApiKey(keyId) { return this._request('DELETE', `/api-keys/${keyId}`, null, { retries: 0 }); }

    // ── Conversations (502 on current backend — service not deployed) ──

    async listConversations(tenantId, limit = 20, agentId = null) {
        const params = this._scopeParams(tenantId, agentId);
        if (limit) params.set('limit', limit);
        return this._request('GET', `/conversations?${params}`, null, { retries: 0 });
    }
    async getConversation(sessionId) {
        return this._request('GET', `/conversations/${sessionId}`, null, { retries: 0 });
    }

    // ── Widget Config ─────────────────────────────────────────────

    async getWidgetConfig(tenantId, agentId = null) {
        const q = agentId && agentId !== 'default' ? `?agent_id=${agentId}` : '';
        return this.get(`/agents/${tenantId}/widget-config${q}`);
    }
    async updateWidgetConfig(tenantId, data, agentId = null) {
        const q = agentId && agentId !== 'default' ? `?agent_id=${agentId}` : '';
        return this.put(`/agents/${tenantId}/widget-config${q}`, data);
    }
    async resetWidgetConfig(tenantId, agentId = null) {
        const q = agentId && agentId !== 'default' ? `?agent_id=${agentId}` : '';
        return this.del(`/agents/${tenantId}/widget-config${q}`);
    }

    // ── Tasks (502 on current backend — service not deployed) ──

    async listTasks(tenantId = null, state = null, limit = null, agentId = null) {
        const params = this._scopeParams(tenantId, agentId);
        if (state) params.set('state', state);
        if (limit) params.set('limit', limit);
        const q = params.toString() ? `?${params}` : '';
        return this._request('GET', `/tasks${q}`, null, { retries: 0 });
    }
    async getTask(taskId) { return this._request('GET', `/tasks/${taskId}`, null, { retries: 0 }); }
    async cleanupTasks(tenantId = null, agentId = null) {
        return this._request('DELETE', `/tasks${this._scopeQuery(tenantId, agentId)}`, null, { retries: 0 });
    }

    // ── Metrics ───────────────────────────────────────────────────

    async metricsDashboard(tenantId = null, agentId = null) {
        return this._request('GET', `/metrics/dashboard${this._scopeQuery(tenantId, agentId)}`, null, { retries: 0 });
    }
    async metricsCoverage(tenantId = null, agentId = null) {
        return this._request('GET', `/metrics/coverage${this._scopeQuery(tenantId, agentId)}`, null, { retries: 0 });
    }
    async metricsGaps(tenantId = null, agentId = null, unresolvedOnly = false, limit = 20) {
        const params = this._scopeParams(tenantId, agentId);
        if (unresolvedOnly) params.set('unresolved_only', 'true');
        if (limit) params.set('limit', limit);
        return this._request('GET', `/metrics/gaps?${params}`, null, { retries: 0 });
    }
    async metricsGrounding(tenantId = null, agentId = null) {
        return this._request('GET', `/metrics/grounding${this._scopeQuery(tenantId, agentId)}`, null, { retries: 0 });
    }

    // ── Document Management (v2 /documents/* endpoints) ──────────

    async uploadDocuments(files, tenantId, autoIndex = true, background = false, agentId = null) {
        if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
            throw new ApiError(400, 'tenant_id is required for document upload');
        }
        const params = new URLSearchParams({ tenant_id: tenantId, auto_index: autoIndex, background });
        if (agentId && agentId !== 'default') params.set('agent_id', agentId);
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
        return this._request('POST', `/documents/reset-reindex${this._scopeQuery(tenantId, agentId)}`, null, { retries: 0 });
    }

    /**
     * Retrieve chunks for a specific document by querying with a broad query
     * and filtering retrieved_chunks by document_id on the client side.
     * This is a workaround since the backend has no /documents/{id}/chunks endpoint.
     * Note: backend top_k max is 20.
     */
    async getDocumentChunks(documentId, tenantId = null, topK = 20, filenameHint = null, agentId = null) {
        const queryText = filenameHint
            ? filenameHint.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
            : 'contenido completo del documento';
        const queryParams = {
            query: queryText,
            tenant_id: tenantId,
            top_k: Math.min(topK, 20),
            use_cache: false
        };
        if (agentId && agentId !== 'default') queryParams.agent_id = agentId;
        const res = await this.query(queryParams);
        const all = res.retrieved_chunks || [];
        // Filter to only chunks from this document
        const filtered = all.filter(c =>
            c.document_id === documentId ||
            c.metadata?.document_id === documentId ||
            (c.metadata?.source || '').includes(documentId)
        );
        return filtered.length > 0 ? filtered : all;
    }

    // Legacy aliases (registry endpoints — kept for backward compat)
    /** @deprecated Use uploadDocuments() with explicit tenantId */
    async registryIngest(file, forceReindex = false) {
        console.warn('[api] registryIngest is deprecated — use uploadDocuments with tenantId');
        return this.uploadDocuments([file], null, !forceReindex, false);
    }
    async registryStats() { return this.documentStats(); }
    async scanInbox(tenantId = null, force = false) {
        return this.processPending(tenantId, force);
    }

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

    async submitFeedback(data) { return this._request('POST', '/feedback', data, { retries: 0 }); }
    async listFeedback(filters = {}, tenantId = null, agentId = null) {
        const params = this._scopeParams(tenantId, agentId);
        if (filters.rating) params.set('rating', filters.rating);
        if (filters.reviewed !== undefined) params.set('reviewed', filters.reviewed);
        if (filters.low_confidence) params.set('low_confidence', true);
        if (filters.limit) params.set('limit', filters.limit);
        const q = params.toString() ? `?${params}` : '';
        return this._request('GET', `/feedback${q}`, null, { retries: 0 });
    }
    async feedbackStats(tenantId = null, agentId = null) {
        return this._request('GET', `/feedback/stats${this._scopeQuery(tenantId, agentId)}`, null, { retries: 0 });
    }
    async markReviewed(id, action = null, tenantId = null, agentId = null) {
        const params = this._scopeParams(tenantId, agentId);
        if (action) params.set('action_taken', action);
        const q = params.toString() ? `?${params}` : '';
        return this._request('POST', `/feedback/${id}/review${q}`, null, { retries: 0 });
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
