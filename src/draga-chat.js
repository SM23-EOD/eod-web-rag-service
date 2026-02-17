/**
 * DRAGA Chat Widget — Web Component
 * <draga-chat agent="..." api-key="..." base-url="..."></draga-chat>
 *
 * Supports 3 backend protocols:
 *   - openai  → POST /api/v2/chat/completions (streaming SSE + batch)
 *   - rag     → POST /api/v2/agents/{agent}/query
 *   - mcp     → EventSource /api/v2/mcp/sse + POST /api/v2/mcp/tools/call
 *
 * @version 1.0.0
 */

/* ═══════════════════════════════════════════════════════════════════════════
   I18N — Externalized strings
   ═══════════════════════════════════════════════════════════════════════════ */

const DRAGA_I18N = {
  es: {
    openChat: 'Abrir chat',
    closeChat: 'Cerrar chat',
    minimize: 'Minimizar',
    maximize: 'Maximizar',
    clearChat: 'Limpiar conversación',
    clearConfirm: '¿Limpiar toda la conversación?',
    sendMessage: 'Enviar mensaje',
    stopStreaming: 'Detener',
    placeholder: 'Escribe tu consulta...',
    typing: 'Escribiendo...',
    online: 'En línea',
    offline: 'Sin conexión',
    reconnecting: 'Reconectando...',
    errorGeneric: 'No se pudo procesar la consulta.',
    errorNetwork: 'Error de conexión. Reintentando...',
    errorRetryFailed: 'No se pudo conectar después de varios intentos.',
    retry: 'Reintentar',
    sources: 'Fuentes consultadas',
    confidence: 'Confianza',
    confidenceHigh: 'Alta',
    confidenceMedium: 'Media',
    confidenceLow: 'Baja',
    grounding: 'Verificación de datos',
    groundingGrounded: 'verificado',
    groundingPartial: 'parcial',
    groundingUngrounded: 'no verificado',
    feedbackThanks: '¡Gracias por tu feedback!',
    feedbackUseful: 'Útil',
    feedbackNotUseful: 'No útil',
    feedbackComment: 'Comentario opcional...',
    feedbackSend: 'Enviar feedback',
    welcome: '¡Hola! ¿En qué puedo ayudarte?',
    poweredBy: 'Powered by DRAGA',
    enterToSend: 'Enter para enviar',
    shiftEnter: 'Shift+Enter nueva línea',
    loadingConfig: 'Cargando configuración...',
    chunkLoading: 'Cargando contenido...',
    chunkError: 'No se pudo cargar el contenido.',
    closePanel: 'Cerrar panel',
  },
  en: {
    openChat: 'Open chat',
    closeChat: 'Close chat',
    minimize: 'Minimize',
    maximize: 'Maximize',
    clearChat: 'Clear conversation',
    clearConfirm: 'Clear all conversation?',
    sendMessage: 'Send message',
    stopStreaming: 'Stop',
    placeholder: 'Type your question...',
    typing: 'Typing...',
    online: 'Online',
    offline: 'Offline',
    reconnecting: 'Reconnecting...',
    errorGeneric: 'Could not process the query.',
    errorNetwork: 'Connection error. Retrying...',
    errorRetryFailed: 'Could not connect after several attempts.',
    retry: 'Retry',
    sources: 'Sources consulted',
    confidence: 'Confidence',
    confidenceHigh: 'High',
    confidenceMedium: 'Medium',
    confidenceLow: 'Low',
    grounding: 'Data verification',
    groundingGrounded: 'verified',
    groundingPartial: 'partial',
    groundingUngrounded: 'unverified',
    feedbackThanks: 'Thanks for your feedback!',
    feedbackUseful: 'Useful',
    feedbackNotUseful: 'Not useful',
    feedbackComment: 'Optional comment...',
    feedbackSend: 'Send feedback',
    welcome: 'Hello! How can I help you?',
    poweredBy: 'Powered by DRAGA',
    enterToSend: 'Enter to send',
    shiftEnter: 'Shift+Enter new line',
    loadingConfig: 'Loading configuration...',
    chunkLoading: 'Loading content...',
    chunkError: 'Could not load content.',
    closePanel: 'Close panel',
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   SERVICES
   ═══════════════════════════════════════════════════════════════════════════ */

/** UUID v4 generator */
function dragaUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/** Session manager — generates and persists session ID per widget instance */
class DragaSessionManager {
  constructor(agent) {
    this._key = `draga_session_${agent}`;
    this.sessionId = this._load() || this._create();
    this.history = []; // {role, content} array
  }

  _load() {
    try { return sessionStorage.getItem(this._key); } catch { return null; }
  }

  _create() {
    const id = dragaUUID();
    try { sessionStorage.setItem(this._key, id); } catch { /* noop */ }
    return id;
  }

  addMessage(role, content) {
    this.history.push({ role, content });
  }

  getMessages(maxHistory, systemPrompt) {
    const msgs = [];
    if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
    const slice = this.history.slice(-(maxHistory * 2));
    msgs.push(...slice);
    return msgs;
  }

  clear() {
    this.history = [];
  }
}

/** Health checker with retry */
class DragaHealthChecker {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.healthy = null;
  }

  async check() {
    try {
      const h = {};
      if (this.apiKey) h['X-API-Key'] = this.apiKey;
      const res = await fetch(`${this.baseUrl}/health`, { headers: h, signal: AbortSignal.timeout(5000) });
      this.healthy = res.ok;
    } catch {
      this.healthy = false;
    }
    return this.healthy;
  }
}

/** Config loader — fetches widget-config from backend */
class DragaConfigLoader {
  static async load(baseUrl, agent, apiKey) {
    try {
      const h = { 'Content-Type': 'application/json' };
      if (apiKey) h['X-API-Key'] = apiKey;
      const res = await fetch(`${baseUrl}/agents/${agent}/widget-config`, { headers: h, signal: AbortSignal.timeout(8000) });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }
}

/** Feedback sender */
class DragaFeedbackSender {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async send({ query, response, rating, tenantId, agentId, sessionId, comment }) {
    const h = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    const body = { query, response, rating, tenant_id: tenantId, session_id: sessionId };
    if (agentId && agentId !== 'default') body.agent_id = agentId;
    if (comment) body.comment = comment;
    const res = await fetch(`${this.baseUrl}/feedback`, { method: 'POST', headers: h, body: JSON.stringify(body) });
    return res.ok;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROTOCOL LAYER
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Base protocol interface.
 * Every protocol must implement:
 *   - sendMessage(text, opts) → { content, sources, confidence, groundingRate, itemsEvaluated, usage, model }
 *   - sendMessageStream(text, opts, onDelta, onDone) → void (streams tokens)
 *   - abort() → cancel current request
 */

class DragaProtocolOpenAI {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this._abort = null;
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    return h;
  }

  _buildBody(messages, opts) {
    const body = {
      model: opts.model || 'eod-rag',
      messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 2048,
      stream: !!opts.stream,
      tenant_id: opts.tenantId,
      top_k: opts.topK ?? 5,
      similarity_threshold: opts.similarityThreshold ?? 0.3,
      include_sources: opts.includeSources !== false,
    };
    if (opts.agentId && opts.agentId !== 'default') body.agent_id = opts.agentId;
    if (opts.sessionId) body.session_id = opts.sessionId;
    if (opts.documentIds) body.document_ids = opts.documentIds;
    return body;
  }

  /** Non-streaming request */
  async sendMessage(messages, opts = {}) {
    this._abort = new AbortController();
    const body = this._buildBody(messages, { ...opts, stream: false });

    const res = await this._fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST', headers: this._headers(), body: JSON.stringify(body), signal: this._abort.signal,
    }, opts.maxRetries ?? 3);

    const data = await res.json();
    this._abort = null;

    const choice = data.choices?.[0]?.message || {};
    return {
      content: choice.content || '',
      sources: choice.sources || [],
      confidence: choice.confidence ?? null,
      groundingRate: choice.grounding_rate ?? null,
      itemsEvaluated: choice.items_evaluated || [],
      usage: data.usage || null,
      model: data.model || opts.model,
    };
  }

  /** Streaming request — calls onDelta(text) for each token, onMeta(meta) at end */
  async sendMessageStream(messages, opts = {}, onDelta, onDone) {
    this._abort = new AbortController();
    const body = this._buildBody(messages, { ...opts, stream: true });

    const res = await this._fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: 'POST', headers: this._headers(), body: JSON.stringify(body), signal: this._abort.signal,
    }, opts.maxRetries ?? 3);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';
    let model = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') {
            onDone?.({ content: fullContent, model });
            this._abort = null;
            return;
          }
          try {
            const chunk = JSON.parse(payload);
            if (!model && chunk.model) model = chunk.model;
            const delta = chunk.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              onDelta(delta, fullContent);
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        onDone?.({ content: fullContent, model, aborted: true });
        return;
      }
      throw e;
    }

    onDone?.({ content: fullContent, model });
    this._abort = null;
  }

  abort() {
    this._abort?.abort();
    this._abort = null;
  }

  async _fetchWithRetry(url, init, maxRetries = 3) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const res = await fetch(url, init);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || err.message || `HTTP ${res.status}`);
        }
        return res;
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        lastError = e;
        if (i < maxRetries) {
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
        }
      }
    }
    throw lastError;
  }
}

class DragaProtocolRAG {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this._abort = null;
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    return h;
  }

  async sendMessage(query, opts = {}) {
    this._abort = new AbortController();
    const body = {
      query,
      top_k: opts.topK ?? 5,
      similarity_threshold: opts.similarityThreshold ?? 0.3,
      include_sources: opts.includeSources !== false,
      session_id: opts.sessionId,
      ab_session_id: opts.abSessionId,
    };
    if (opts.agentId && opts.agentId !== 'default') body.agent_id = opts.agentId;
    if (opts.documentIds) body.document_ids = opts.documentIds;

    const url = `${this.baseUrl}/agents/${opts.tenantId}/query`;
    const res = await this._fetchWithRetry(url, {
      method: 'POST', headers: this._headers(), body: JSON.stringify(body), signal: this._abort.signal,
    }, opts.maxRetries ?? 3);

    const data = await res.json();
    this._abort = null;

    return {
      content: data.response || '',
      sources: (data.sources || []).map(s => ({
        document: s.document || s.source || '',
        chunk: s.chunk,
        similarity: s.similarity ?? null,
      })),
      confidence: data.confidence ?? null,
      groundingRate: data.metadata?.grounding_rate ?? null,
      itemsEvaluated: data.metadata?.items_evaluated || [],
      cached: data.cached ?? false,
      processingTime: data.processing_time_ms ?? null,
    };
  }

  /** RAG protocol doesn't support streaming — falls back to non-streaming */
  async sendMessageStream(query, opts, onDelta, onDone) {
    const result = await this.sendMessage(query, opts);
    // Simulate token-by-token for consistent UX
    const words = result.content.split(' ');
    let full = '';
    for (let i = 0; i < words.length; i++) {
      const token = (i > 0 ? ' ' : '') + words[i];
      full += token;
      onDelta(token, full);
      await new Promise(r => setTimeout(r, 15));
    }
    onDone?.(result);
  }

  abort() {
    this._abort?.abort();
    this._abort = null;
  }

  async _fetchWithRetry(url, init, maxRetries = 3) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const res = await fetch(url, init);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || err.message || `HTTP ${res.status}`);
        }
        return res;
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        lastError = e;
        if (i < maxRetries) await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
      }
    }
    throw lastError;
  }
}

class DragaProtocolMCP {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this._abort = null;
    this._sse = null;
    this.connected = false;
    this.onConnectionChange = null;
  }

  /** Open persistent SSE connection for heartbeat/capabilities */
  connect() {
    if (this._sse) return;
    try {
      this._sse = new EventSource(`${this.baseUrl}/mcp/sse`);
      this._sse.onopen = () => { this.connected = true; this.onConnectionChange?.(true); };
      this._sse.onerror = () => { this.connected = false; this.onConnectionChange?.(false); };
    } catch { this.connected = false; }
  }

  disconnect() {
    this._sse?.close();
    this._sse = null;
    this.connected = false;
  }

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (this.apiKey) h['X-API-Key'] = this.apiKey;
    return h;
  }

  async sendMessage(query, opts = {}) {
    this._abort = new AbortController();
    const args = {
      query: query,
      tenant_id: opts.tenantId,
      top_k: opts.topK ?? 5,
      include_sources: opts.includeSources !== false,
      session_id: opts.sessionId,
    };
    if (opts.agentId && opts.agentId !== 'default') args.agent_id = opts.agentId;
    if (opts.documentIds) args.document_ids = opts.documentIds;
    const body = { tool_name: 'generate_rag_answer', arguments: args };

    const res = await this._fetchWithRetry(`${this.baseUrl}/mcp/tools/call`, {
      method: 'POST', headers: this._headers(), body: JSON.stringify(body), signal: this._abort.signal,
    }, opts.maxRetries ?? 3);

    const data = await res.json();
    this._abort = null;

    return {
      content: data.result || data.response || '',
      sources: data.sources || [],
      confidence: data.confidence ?? null,
      groundingRate: null,
      itemsEvaluated: [],
    };
  }

  /** MCP doesn't support streaming—simulates like RAG */
  async sendMessageStream(query, opts, onDelta, onDone) {
    const result = await this.sendMessage(query, opts);
    const words = result.content.split(' ');
    let full = '';
    for (let i = 0; i < words.length; i++) {
      const token = (i > 0 ? ' ' : '') + words[i];
      full += token;
      onDelta(token, full);
      await new Promise(r => setTimeout(r, 15));
    }
    onDone?.(result);
  }

  /** Fetch a specific document chunk via MCP tool */
  async getDocumentChunk(chunkUri) {
    const body = { tool_name: 'get_document_chunk', arguments: { chunk_uri: chunkUri } };
    const res = await fetch(`${this.baseUrl}/mcp/tools/call`, {
      method: 'POST', headers: this._headers(), body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  abort() {
    this._abort?.abort();
    this._abort = null;
  }

  async _fetchWithRetry(url, init, maxRetries = 3) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const res = await fetch(url, init);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: res.statusText }));
          throw new Error(err.detail || err.message || `HTTP ${res.status}`);
        }
        return res;
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        lastError = e;
        if (i < maxRetries) await new Promise(r => setTimeout(r, Math.pow(2, i) * 500));
      }
    }
    throw lastError;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   DRAGA CHAT — Main Web Component
   ═══════════════════════════════════════════════════════════════════════════ */

class DragaChat extends HTMLElement {
  static get observedAttributes() {
    return [
      'agent', 'api-key', 'base-url', 'protocol', 'theme', 'position',
      'locale', 'model', 'streaming', 'show-sources', 'show-confidence',
      'show-grounding', 'feedback', 'max-history',
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // State
    this._state = {
      isOpen: false,
      isMinimized: false,
      isLoading: false,
      isOnline: true,
      messages: [],            // UI messages: {id, role, content, meta, timestamp, feedback}
      streamingMsgId: null,    // ID of message currently being streamed
      sourceDetailOpen: null,  // chunk URI being viewed
      sourceDetailData: null,  // loaded chunk content
      feedbackOpen: null,      // message ID with open feedback form
    };

    // Services (initialized on connect)
    this._session = null;
    this._health = null;
    this._feedback = null;
    this._protocol = null;
    this._widgetConfig = null;
    this._initialized = false;
  }

  // ── Attribute getters ───────────────────────────────────────────

  get agent()          { return this.getAttribute('agent') || ''; }
  get apiKey()         { return this.getAttribute('api-key') || ''; }
  get baseUrl()        { return (this.getAttribute('base-url') || '').replace(/\/+$/, ''); }
  get protocol()       { return this.getAttribute('protocol') || 'openai'; }
  get theme()          { return this.getAttribute('theme') || 'auto'; }
  get position()       { return this.getAttribute('position') || 'bottom-right'; }
  get locale()         { return this.getAttribute('locale') || 'es'; }
  get model()          { return this.getAttribute('model') || 'eod-rag'; }
  get streamingAttr()  { return this.getAttribute('streaming') !== 'false'; }
  get showSources()    { return this.getAttribute('show-sources') !== 'false'; }
  get showConfidence() { return this.getAttribute('show-confidence') === 'true'; }
  get showGrounding()  { return this.getAttribute('show-grounding') === 'true'; }
  get feedbackEnabled(){ return this.getAttribute('feedback') !== 'false'; }
  get maxHistory()     { return parseInt(this.getAttribute('max-history')) || 20; }

  get t() { return DRAGA_I18N[this.locale] || DRAGA_I18N.es; }

  // ── Lifecycle ───────────────────────────────────────────────────

  async connectedCallback() {
    this._render();
    this._setupKeyboard();
    await this._initialize();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._kbHandler);
    if (this._protocol instanceof DragaProtocolMCP) this._protocol.disconnect();
  }

  attributeChangedCallback(name) {
    if (this._initialized && name !== 'api-key') this._render();
  }

  // ── Initialization ──────────────────────────────────────────────

  async _initialize() {
    // 1. Services
    this._session = new DragaSessionManager(this.agent);
    this._health = new DragaHealthChecker(this.baseUrl, this.apiKey);
    this._feedback = new DragaFeedbackSender(this.baseUrl, this.apiKey);

    // 2. Health check
    const healthy = await this._health.check();
    this._setState({ isOnline: healthy });

    // 3. Widget config from backend
    this._widgetConfig = await DragaConfigLoader.load(this.baseUrl, this.agent, this.apiKey);

    // 4. Create protocol instance
    this._initProtocol();

    // 5. Welcome message
    const welcome = this._widgetConfig?.branding?.welcome_message || this.t.welcome;
    this._addMessage('assistant', welcome);

    this._initialized = true;
    this._render();
  }

  _initProtocol() {
    const url = this.baseUrl;
    const key = this.apiKey;
    switch (this.protocol) {
      case 'rag':
        this._protocol = new DragaProtocolRAG(url, key);
        break;
      case 'mcp':
        this._protocol = new DragaProtocolMCP(url, key);
        this._protocol.onConnectionChange = (online) => this._setState({ isOnline: online });
        this._protocol.connect();
        break;
      default: // 'openai'
        this._protocol = new DragaProtocolOpenAI(url, key);
    }
  }

  // ── State management ────────────────────────────────────────────

  _setState(patch) {
    Object.assign(this._state, patch);
    this._render();
  }

  _addMessage(role, content, meta = {}) {
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const msg = { id, role, content, meta, timestamp: new Date().toISOString(), feedback: null };
    this._state.messages = [...this._state.messages, msg];
    if (role !== 'system') this._session?.addMessage(role, content);
    this._render();
    requestAnimationFrame(() => this._scrollToBottom());
    return id;
  }

  _updateMessage(id, patch) {
    this._state.messages = this._state.messages.map(m => m.id === id ? { ...m, ...patch } : m);
    this._render();
  }

  // ── Actions ─────────────────────────────────────────────────────

  _toggleOpen() {
    this._setState({ isOpen: !this._state.isOpen });
    if (this._state.isOpen) {
      requestAnimationFrame(() => {
        this.shadowRoot.querySelector('.draga-input')?.focus();
      });
    }
  }

  _toggleMinimize() {
    this._setState({ isMinimized: !this._state.isMinimized });
  }

  _clearChat() {
    if (!confirm(this.t.clearConfirm)) return;
    this._protocol?.abort();
    this._session?.clear();
    const welcome = this._widgetConfig?.branding?.welcome_message || this.t.welcome;
    this._state.messages = [];
    this._state.streamingMsgId = null;
    this._addMessage('assistant', welcome);
  }

  _stopStreaming() {
    this._protocol?.abort();
    this._setState({ isLoading: false, streamingMsgId: null });
  }

  async _handleSubmit(text) {
    if (!text.trim() || this._state.isLoading) return;
    const query = text.trim();

    // Add user message
    this._addMessage('user', query);

    // Placeholder for assistant response
    const msgId = this._addMessage('assistant', '', { streaming: true });
    this._setState({ isLoading: true, streamingMsgId: msgId });

    try {
      const streamEnabled = this._widgetConfig?.behavior?.streaming_enabled ?? this.streamingAttr;
      const opts = {
        model: this.model,
        tenantId: this.agent,
        sessionId: this._session.sessionId,
        topK: 5,
        similarityThreshold: 0.3,
        temperature: 0.3,
        includeSources: this.showSources,
        maxRetries: 3,
        stream: streamEnabled,
      };

      if (this.protocol === 'openai') {
        // Build full messages array
        const systemPrompt = this._widgetConfig?.branding?.system_prompt || null;
        const messages = this._session.getMessages(this.maxHistory, systemPrompt);

        if (streamEnabled) {
          await this._protocol.sendMessageStream(messages, opts,
            (_delta, fullText) => {
              this._updateStreamContent(msgId, fullText);
            },
            (result) => {
              this._finalizeMessage(msgId, result);
            },
          );
        } else {
          const result = await this._protocol.sendMessage(messages, opts);
          this._finalizeMessage(msgId, result);
        }
      } else {
        // RAG and MCP — send just the query
        if (streamEnabled) {
          await this._protocol.sendMessageStream(query, opts,
            (_delta, fullText) => {
              this._updateStreamContent(msgId, fullText);
            },
            (result) => {
              this._finalizeMessage(msgId, result);
            },
          );
        } else {
          const result = await this._protocol.sendMessage(query, opts);
          this._finalizeMessage(msgId, result);
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        this._updateMessage(msgId, {
          content: `❌ ${error.message || this.t.errorGeneric}`,
          meta: { error: true, streaming: false },
        });
      }
      this._setState({ isLoading: false, streamingMsgId: null });
    }
  }

  _updateStreamContent(msgId, fullText) {
    const bubble = this.shadowRoot.querySelector(`[data-msg-id="${msgId}"] .draga-bubble-content`);
    if (bubble) {
      bubble.innerHTML = this._md(fullText);
      this._scrollToBottom();
    }
  }

  _finalizeMessage(msgId, result) {
    // Update session history with final content
    const existing = this._state.messages.find(m => m.id === msgId);
    if (existing) {
      // Replace placeholder in session
      const idx = this._session.history.findIndex(h => h === existing);
      if (idx >= 0) this._session.history[idx] = { role: 'assistant', content: result.content };
      else this._session.addMessage('assistant', result.content);
    }

    this._updateMessage(msgId, {
      content: result.content,
      meta: {
        streaming: false,
        sources: result.sources || [],
        confidence: result.confidence,
        groundingRate: result.groundingRate,
        itemsEvaluated: result.itemsEvaluated || [],
        usage: result.usage || null,
        model: result.model || this.model,
        cached: result.cached,
        processingTime: result.processingTime,
      },
    });
    this._setState({ isLoading: false, streamingMsgId: null });
    requestAnimationFrame(() => this._scrollToBottom());
  }

  // ── Feedback ────────────────────────────────────────────────────

  async _sendFeedback(msgId, rating, comment = '') {
    const msg = this._state.messages.find(m => m.id === msgId);
    if (!msg) return;
    // Find the preceding user message
    const idx = this._state.messages.indexOf(msg);
    const userMsg = this._state.messages.slice(0, idx).reverse().find(m => m.role === 'user');

    await this._feedback.send({
      query: userMsg?.content || '',
      response: msg.content,
      rating,
      tenantId: this.agent,
      sessionId: this._session.sessionId,
      comment,
    });

    this._updateMessage(msgId, { feedback: rating });
    this._setState({ feedbackOpen: null });
  }

  // ── Source detail panel ─────────────────────────────────────────

  async _openSourceDetail(chunkUri) {
    this._setState({ sourceDetailOpen: chunkUri, sourceDetailData: null });
    try {
      if (this._protocol instanceof DragaProtocolMCP) {
        const data = await this._protocol.getDocumentChunk(chunkUri);
        this._setState({ sourceDetailData: data });
      } else {
        // For non-MCP protocols, just show the URI
        this._setState({ sourceDetailData: { content: chunkUri, source: chunkUri } });
      }
    } catch {
      this._setState({ sourceDetailData: { error: true } });
    }
  }

  _closeSourceDetail() {
    this._setState({ sourceDetailOpen: null, sourceDetailData: null });
  }

  // ── Keyboard ────────────────────────────────────────────────────

  _setupKeyboard() {
    this._kbHandler = (e) => {
      if (e.key === 'Escape' && this._state.isOpen) this._toggleOpen();
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); this._toggleOpen(); }
    };
    document.addEventListener('keydown', this._kbHandler);
  }

  // ── Helpers ─────────────────────────────────────────────────────

  _scrollToBottom() {
    const el = this.shadowRoot.querySelector('.draga-messages');
    if (el) el.scrollTop = el.scrollHeight;
  }

  _md(text) {
    if (typeof marked !== 'undefined') {
      try { return marked.parse(text || ''); } catch { /* fallback */ }
    }
    return this._esc(text || '').replace(/\n/g, '<br>');
  }

  _esc(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  _adjustColor(hex, pct) {
    const n = parseInt((hex || '#2563eb').replace('#', ''), 16);
    const a = Math.round(2.55 * pct);
    const R = Math.min(255, Math.max(0, (n >> 16) + a));
    const G = Math.min(255, Math.max(0, (n >> 8 & 0xff) + a));
    const B = Math.min(255, Math.max(0, (n & 0xff) + a));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  _rgba(hex, a) {
    const h = (hex || '#2563eb').replace('#', '');
    return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${a})`;
  }

  _confidenceLevel(c) {
    if (c == null) return null;
    if (c >= 0.8) return { level: 'high', emoji: '🟢', label: this.t.confidenceHigh };
    if (c >= 0.6) return { level: 'medium', emoji: '🟡', label: this.t.confidenceMedium };
    return { level: 'low', emoji: '🔴', label: this.t.confidenceLow };
  }

  _sourceColor(similarity) {
    if (similarity == null) return '#6b7280';
    if (similarity >= 0.8) return '#059669';
    if (similarity >= 0.6) return '#d97706';
    return '#dc2626';
  }

  _timeStr(iso) {
    return new Date(iso).toLocaleTimeString(this.locale === 'en' ? 'en' : 'es', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Resolved config (HTML attrs > widget-config > defaults) ────

  get _primary() {
    const cssVar = getComputedStyle(this).getPropertyValue('--draga-primary').trim();
    if (cssVar) return cssVar;
    return this._widgetConfig?.theme?.primary_color || '#2563eb';
  }

  get _bg() {
    return getComputedStyle(this).getPropertyValue('--draga-bg').trim() || this._widgetConfig?.theme?.background_color || '#ffffff';
  }

  get _font() {
    return getComputedStyle(this).getPropertyValue('--draga-font').trim() || this._widgetConfig?.theme?.font_family || "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
  }

  get _radius() {
    return getComputedStyle(this).getPropertyValue('--draga-radius').trim() || this._widgetConfig?.theme?.border_radius || '16px';
  }

  get _agentName() {
    return this._widgetConfig?.branding?.agent_name || 'DRAGA Assistant';
  }

  get _agentAvatar() {
    return this._widgetConfig?.branding?.agent_avatar_url || null;
  }

  get _placeholderText() {
    return this._widgetConfig?.branding?.placeholder_text || this.t.placeholder;
  }

  get _isInline() {
    return this.position === 'inline';
  }

  // ═══════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════

  _render() {
    const { isOpen, isMinimized, messages, isLoading, isOnline, streamingMsgId, sourceDetailOpen, sourceDetailData, feedbackOpen } = this._state;
    const pc = this._primary;
    const bg = this._bg;
    const font = this._font;
    const rad = this._radius;
    const isInline = this._isInline;
    const pos = this.position === 'bottom-left' ? 'left:20px;right:auto;' : 'right:20px;left:auto;';
    const containerH = isMinimized ? '56px' : '640px';

    this.shadowRoot.innerHTML = `
      <style>
        *{margin:0;padding:0;box-sizing:border-box}

        :host{
          ${isInline ? 'display:block;position:relative;' : `position:fixed;bottom:20px;${pos}`}
          font-family:${font};
          z-index:2147483647;
          line-height:1.5;
        }

        /* ── Launcher bubble ── */
        .draga-launcher{
          width:60px;height:60px;border-radius:50%;
          background:linear-gradient(135deg,${pc},${this._adjustColor(pc,20)});
          border:none;cursor:pointer;
          display:${isOpen || isInline ? 'none' : 'flex'};
          align-items:center;justify-content:center;
          box-shadow:0 4px 24px ${this._rgba(pc,0.35)};
          transition:all .3s ease;color:#fff;font-size:26px;position:relative;
        }
        .draga-launcher:hover{transform:scale(1.08);box-shadow:0 6px 28px ${this._rgba(pc,0.45)}}
        .draga-launcher:active{transform:scale(0.95)}
        .draga-launcher:focus-visible{outline:3px solid ${pc};outline-offset:3px}

        /* ── Chat container ── */
        .draga-container{
          width:${isInline ? '100%' : '420px'};
          max-width:${isInline ? '100%' : 'calc(100vw - 40px)'};
          height:${isInline ? '100%' : containerH};
          min-height:${isInline ? '500px' : 'auto'};
          max-height:${isInline ? '100%' : 'calc(100vh - 120px)'};
          background:${bg};
          border-radius:${rad};
          box-shadow:${isInline ? 'none' : `0 16px 56px rgba(0,0,0,0.18),0 4px 16px rgba(0,0,0,0.1)`};
          display:${isOpen || isInline ? 'flex' : 'none'};
          flex-direction:column;
          overflow:hidden;
          ${!isInline ? 'animation:draga-slideUp .3s cubic-bezier(0.4,0,0.2,1);' : ''}
        }
        @keyframes draga-slideUp{from{opacity:0;transform:translateY(16px) scale(0.96)}to{opacity:1;transform:none}}

        /* ── Header ── */
        .draga-header{
          background:linear-gradient(135deg,${pc},${this._adjustColor(pc,25)});
          color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;
          flex-shrink:0;
        }
        .draga-hdr-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0}
        .draga-hdr-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;overflow:hidden}
        .draga-hdr-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
        .draga-hdr-info{min-width:0}
        .draga-hdr-name{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .draga-hdr-status{font-size:11px;opacity:.9;display:flex;align-items:center;gap:5px}
        .draga-status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
        .draga-status-dot.online{background:#34d399}
        .draga-status-dot.offline{background:#f87171}
        .draga-hdr-proto{font-size:9px;background:rgba(255,255,255,.18);padding:2px 8px;border-radius:10px;margin-left:6px;text-transform:uppercase;letter-spacing:.3px}
        .draga-hdr-actions{display:flex;gap:4px}
        .draga-hdr-btn{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.12);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s}
        .draga-hdr-btn:hover{background:rgba(255,255,255,.22);transform:scale(1.05)}
        .draga-hdr-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}

        /* ── Messages ── */
        .draga-messages{
          flex:1;padding:18px;overflow-y:auto;background:#f8fafc;
          display:${isMinimized ? 'none' : 'flex'};flex-direction:column;gap:16px;
        }
        .draga-messages::-webkit-scrollbar{width:5px}
        .draga-messages::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}

        /* ── Empty state ── */
        .draga-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;padding:30px 20px;text-align:center}
        .draga-empty-icon{font-size:52px;margin-bottom:12px;opacity:.5}
        .draga-empty-title{font-size:17px;font-weight:600;color:#1e293b;margin-bottom:6px}
        .draga-empty-text{font-size:13px;color:#64748b;line-height:1.6}

        /* ── Message row ── */
        .draga-msg{display:flex;gap:10px;animation:draga-fadeIn .3s ease-out}
        @keyframes draga-fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        .draga-msg.user{flex-direction:row-reverse}
        .draga-msg-avatar{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0}
        .draga-msg.user .draga-msg-avatar{background:linear-gradient(135deg,${pc},${this._adjustColor(pc,20)});color:#fff}
        .draga-msg.assistant .draga-msg-avatar{background:#e2e8f0;overflow:hidden}
        .draga-msg.assistant .draga-msg-avatar img{width:100%;height:100%;object-fit:cover;border-radius:50%}
        .draga-msg-body{flex:1;display:flex;flex-direction:column;gap:6px;max-width:85%}

        /* ── Bubble ── */
        .draga-bubble{padding:12px 16px;border-radius:14px;font-size:14px;line-height:1.65;word-wrap:break-word;overflow-wrap:break-word}
        .draga-msg.user .draga-bubble{background:linear-gradient(135deg,${pc},${this._adjustColor(pc,20)});color:#fff;border-bottom-right-radius:4px}
        .draga-msg.assistant .draga-bubble{background:#fff;color:#1e293b;border:1px solid #e2e8f0;border-bottom-left-radius:4px}

        /* Markdown content */
        .draga-bubble-content p{margin:0 0 8px}.draga-bubble-content p:last-child{margin:0}
        .draga-bubble-content ul,.draga-bubble-content ol{margin:6px 0;padding-left:18px}
        .draga-bubble-content li{margin:3px 0}
        .draga-bubble-content code{background:rgba(0,0,0,.06);padding:1px 5px;border-radius:4px;font-size:13px;font-family:monospace}
        .draga-msg.user .draga-bubble-content code{background:rgba(255,255,255,.2)}
        .draga-bubble-content pre{background:#1e293b;color:#e2e8f0;padding:12px;border-radius:8px;overflow-x:auto;margin:8px 0;font-size:13px}
        .draga-bubble-content pre code{background:none;padding:0;color:inherit}
        .draga-bubble-content a{color:${pc}}
        .draga-msg.user .draga-bubble-content a{color:#fff;text-decoration:underline}
        .draga-bubble-content blockquote{border-left:3px solid ${pc};padding-left:12px;margin:8px 0;color:#64748b}

        /* Streaming cursor */
        .draga-streaming .draga-bubble-content::after{content:'▌';animation:draga-blink .7s infinite;color:${pc};font-weight:bold}
        @keyframes draga-blink{0%,100%{opacity:1}50%{opacity:0}}

        /* ── Confidence badge ── */
        .draga-confidence{display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:3px 8px;border-radius:8px;cursor:help}
        .draga-confidence.high{background:#ecfdf5;color:#065f46}
        .draga-confidence.medium{background:#fffbeb;color:#92400e}
        .draga-confidence.low{background:#fef2f2;color:#991b1b}

        /* ── Source chips ── */
        .draga-sources{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
        .draga-sources-label{font-size:11px;font-weight:600;color:${pc};display:flex;align-items:center;gap:4px;width:100%;margin-bottom:2px}
        .draga-source-chip{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;font-size:11px;color:#0369a1;cursor:pointer;transition:all .2s}
        .draga-source-chip:hover{background:#e0f2fe;transform:translateY(-1px)}
        .draga-source-chip .sim{font-size:10px;font-weight:600;border-radius:4px;padding:1px 4px;color:#fff}

        /* ── Grounding detail ── */
        .draga-grounding{margin-top:6px;font-size:12px}
        .draga-grounding-toggle{cursor:pointer;color:${pc};font-weight:500;display:flex;align-items:center;gap:4px;padding:4px 0}
        .draga-grounding-toggle:hover{text-decoration:underline}
        .draga-grounding-list{padding:8px 0 0 4px;display:flex;flex-direction:column;gap:3px}
        .draga-ground-item{display:flex;align-items:center;gap:6px;padding:3px 0}
        .draga-ground-item .icon{font-size:13px}
        .draga-ground-item .label{color:#475569}
        .draga-ground-item .status{font-weight:500;font-size:11px;padding:1px 6px;border-radius:4px}
        .draga-ground-item .status.grounded{background:#ecfdf5;color:#065f46}
        .draga-ground-item .status.partial{background:#fffbeb;color:#92400e}
        .draga-ground-item .status.ungrounded{background:#fef2f2;color:#991b1b}

        /* ── Feedback controls ── */
        .draga-feedback{display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap}
        .draga-fb-btn{padding:4px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-size:12px;display:flex;align-items:center;gap:4px;transition:all .2s}
        .draga-fb-btn:hover:not([disabled]){border-color:#94a3b8}
        .draga-fb-btn.pos:hover:not([disabled]){background:#ecfdf5;border-color:#34d399}
        .draga-fb-btn.neg:hover:not([disabled]){background:#fef2f2;border-color:#f87171}
        .draga-fb-btn.selected.pos{background:#ecfdf5;border-color:#34d399;color:#065f46}
        .draga-fb-btn.selected.neg{background:#fef2f2;border-color:#f87171;color:#991b1b}
        .draga-fb-btn[disabled]{opacity:.5;cursor:not-allowed}
        .draga-fb-thanks{font-size:11px;color:#64748b;padding:2px 0}
        .draga-fb-comment{display:flex;gap:6px;width:100%;margin-top:4px}
        .draga-fb-comment input{flex:1;padding:6px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-family:inherit}
        .draga-fb-comment input:focus{outline:none;border-color:${pc}}
        .draga-fb-comment button{padding:6px 12px;background:${pc};color:#fff;border:none;border-radius:8px;font-size:12px;cursor:pointer}

        /* ── Message meta ── */
        .draga-msg-meta{display:flex;align-items:center;gap:8px;font-size:10px;color:#94a3b8;flex-wrap:wrap}
        .draga-meta-tag{background:#f1f5f9;padding:1px 6px;border-radius:5px;color:#64748b}

        /* ── Typing indicator ── */
        .draga-typing{display:flex;align-items:center;gap:10px}
        .draga-typing-dots{display:flex;gap:4px;padding:10px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:14px;border-bottom-left-radius:4px}
        .draga-dot{width:7px;height:7px;border-radius:50%;background:#94a3b8;animation:draga-bounce 1.4s infinite}
        .draga-dot:nth-child(2){animation-delay:.2s}
        .draga-dot:nth-child(3){animation-delay:.4s}
        @keyframes draga-bounce{0%,60%,100%{transform:translateY(0);opacity:.6}30%{transform:translateY(-8px);opacity:1}}

        /* ── Offline banner ── */
        .draga-offline{background:#fef2f2;color:#991b1b;padding:8px 14px;font-size:12px;display:flex;align-items:center;gap:6px;justify-content:center;flex-shrink:0}
        .draga-offline button{background:#dc2626;color:#fff;border:none;padding:3px 10px;border-radius:6px;font-size:11px;cursor:pointer}

        /* ── Input area ── */
        .draga-input-area{
          padding:14px 18px;border-top:1px solid #e2e8f0;background:${bg};
          display:${isMinimized ? 'none' : 'flex'};flex-direction:column;gap:10px;flex-shrink:0;
        }
        .draga-input-row{display:flex;gap:8px;align-items:flex-end}
        .draga-input{
          flex:1;min-height:42px;max-height:120px;padding:10px 14px;
          border:1px solid #e2e8f0;border-radius:${rad};font-size:14px;font-family:${font};
          resize:none;transition:all .2s;background:${bg};color:#1e293b;
        }
        .draga-input:focus{outline:none;border-color:${pc};box-shadow:0 0 0 3px ${this._rgba(pc,.1)}}
        .draga-input::placeholder{color:#94a3b8}
        .draga-send{
          width:42px;height:42px;border-radius:12px;border:none;color:#fff;cursor:pointer;
          display:flex;align-items:center;justify-content:center;font-size:18px;transition:all .2s;flex-shrink:0;
        }
        .draga-send.primary{background:linear-gradient(135deg,${pc},${this._adjustColor(pc,20)})}
        .draga-send.stop{background:linear-gradient(135deg,#ef4444,#dc2626)}
        .draga-send:hover:not([disabled]){transform:scale(1.05)}
        .draga-send[disabled]{opacity:.5;cursor:not-allowed}
        .draga-input-footer{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8}
        .draga-proto-badge{display:inline-flex;align-items:center;gap:4px;background:#f0fdf4;color:#059669;padding:2px 8px;border-radius:8px;font-weight:600;font-size:10px}
        .draga-proto-badge.rag{background:#fef3c7;color:#92400e}
        .draga-proto-badge.mcp{background:#eff6ff;color:#2563eb}

        /* ── Source detail panel ── */
        .draga-source-panel{
          position:absolute;top:0;right:0;bottom:0;width:320px;max-width:80%;
          background:${bg};border-left:1px solid #e2e8f0;
          display:flex;flex-direction:column;
          animation:draga-slideLeft .2s ease-out;
          z-index:10;box-shadow:-4px 0 20px rgba(0,0,0,.08);
        }
        @keyframes draga-slideLeft{from{transform:translateX(100%)}to{transform:none}}
        .draga-source-panel-header{padding:14px 16px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between}
        .draga-source-panel-header h3{font-size:14px;color:#1e293b}
        .draga-source-panel-close{width:28px;height:28px;border:none;background:#f1f5f9;border-radius:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px}
        .draga-source-panel-body{flex:1;padding:16px;overflow-y:auto;font-size:13px;line-height:1.7;color:#475569}

        /* ── Responsive ── */
        @media(max-width:768px){
          :host:not([position="inline"]){bottom:0 !important;left:0 !important;right:0 !important}
          .draga-container{width:100vw;max-width:100vw;height:100vh;max-height:100vh;border-radius:0}
          .draga-launcher{bottom:16px;right:16px;position:fixed}
          .draga-source-panel{width:100%}
        }
      </style>

      <!-- Launcher -->
      ${isInline ? '' : `
        <button class="draga-launcher" aria-label="${this.t.openChat}" title="${this.t.openChat} (Ctrl+K)">
          💬
        </button>
      `}

      <!-- Chat container -->
      <div class="draga-container" role="dialog" aria-label="${this._agentName}" style="position:relative">
        <!-- Header -->
        <div class="draga-header">
          <div class="draga-hdr-left">
            <div class="draga-hdr-avatar">
              ${this._agentAvatar ? `<img src="${this._esc(this._agentAvatar)}" alt="">` : '🤖'}
            </div>
            <div class="draga-hdr-info">
              <div class="draga-hdr-name">${this._esc(this._agentName)}</div>
              <div class="draga-hdr-status">
                <span class="draga-status-dot ${isOnline ? 'online' : 'offline'}"></span>
                ${isOnline ? this.t.online : this.t.offline}
                <span class="draga-hdr-proto">${this.protocol}</span>
              </div>
            </div>
          </div>
          <div class="draga-hdr-actions">
            <button class="draga-hdr-btn draga-clear-btn" title="${this.t.clearChat}" aria-label="${this.t.clearChat}">🗑️</button>
            ${!isInline ? `<button class="draga-hdr-btn draga-min-btn" title="${isMinimized ? this.t.maximize : this.t.minimize}" aria-label="${isMinimized ? this.t.maximize : this.t.minimize}">${isMinimized ? '🔼' : '🔽'}</button>` : ''}
            ${!isInline ? `<button class="draga-hdr-btn draga-close-btn" title="${this.t.closeChat} (Esc)" aria-label="${this.t.closeChat}">✕</button>` : ''}
          </div>
        </div>

        <!-- Offline banner -->
        ${!isOnline ? `<div class="draga-offline" role="alert">
          <span>⚠️ ${this.t.offline}</span>
          <button class="draga-retry-btn">${this.t.retry}</button>
        </div>` : ''}

        <!-- Messages -->
        <div class="draga-messages" aria-live="polite">
          ${messages.length <= 1 && messages[0]?.role === 'assistant' ? this._renderEmpty() : ''}
        </div>

        <!-- Source detail panel -->
        ${sourceDetailOpen ? `
          <div class="draga-source-panel">
            <div class="draga-source-panel-header">
              <h3>📄 ${this._esc(typeof sourceDetailOpen === 'string' ? sourceDetailOpen.split('/').pop() : '')}</h3>
              <button class="draga-source-panel-close draga-close-source" aria-label="${this.t.closePanel}">✕</button>
            </div>
            <div class="draga-source-panel-body">
              ${!sourceDetailData ? `<em>${this.t.chunkLoading}</em>` :
                sourceDetailData.error ? `<em style="color:#dc2626">${this.t.chunkError}</em>` :
                `<pre style="white-space:pre-wrap;font-size:12px">${this._esc(sourceDetailData.content || JSON.stringify(sourceDetailData, null, 2))}</pre>`}
            </div>
          </div>
        ` : ''}

        <!-- Input -->
        <form class="draga-input-area">
          <div class="draga-input-row">
            <textarea class="draga-input" placeholder="${this._placeholderText}" rows="1" aria-label="${this.t.sendMessage}"></textarea>
            ${isLoading
              ? `<button type="button" class="draga-send stop draga-stop-btn" aria-label="${this.t.stopStreaming}">⏹</button>`
              : `<button type="submit" class="draga-send primary" ${!isOnline ? 'disabled' : ''} aria-label="${this.t.sendMessage}">➤</button>`
            }
          </div>
          <div class="draga-input-footer">
            <span>${this.t.enterToSend} · ${this.t.shiftEnter}</span>
            <span class="draga-proto-badge ${this.protocol}">${this.protocol === 'openai' ? (this.streamingAttr ? '🔴 stream' : '📦 batch') : this.protocol} · ${this.model}</span>
          </div>
        </form>
      </div>
    `;

    // ── Bind events ──
    this._bindEvents();

    // ── Render messages into container ──
    this._renderMessages();
  }

  _renderEmpty() {
    // The welcome message IS the empty state decoration
    return '';
  }

  _renderMessages() {
    const container = this.shadowRoot.querySelector('.draga-messages');
    if (!container) return;

    const { messages, isLoading, streamingMsgId } = this._state;
    const html = messages.map(m => this._renderMessage(m)).join('');
    container.innerHTML = html;

    // Typing indicator
    if (isLoading && !streamingMsgId) {
      container.innerHTML += `
        <div class="draga-msg assistant">
          <div class="draga-msg-avatar">${this._agentAvatar ? `<img src="${this._esc(this._agentAvatar)}" alt="">` : '🤖'}</div>
          <div class="draga-typing-dots"><div class="draga-dot"></div><div class="draga-dot"></div><div class="draga-dot"></div></div>
        </div>`;
    }

    this._scrollToBottom();
  }

  _renderMessage(msg) {
    const isUser = msg.role === 'user';
    const avatar = isUser ? '👤' : (this._agentAvatar ? `<img src="${this._esc(this._agentAvatar)}" alt="">` : '🤖');
    const content = isUser ? this._esc(msg.content) : this._md(msg.content || '');
    const ts = this._timeStr(msg.timestamp);
    const isStreaming = msg.meta?.streaming && this._state.isLoading;
    const meta = msg.meta || {};

    // Source chips
    const sources = meta.sources || [];
    let sourcesHtml = '';
    if (!isUser && this.showSources && sources.length > 0) {
      sourcesHtml = `
        <div class="draga-sources">
          <div class="draga-sources-label">📚 ${this.t.sources}</div>
          ${sources.map(s => {
            const name = typeof s === 'string' ? s : (s.document || s.source_name || s.name || JSON.stringify(s));
            const sim = typeof s === 'object' ? s.similarity : null;
            const simStr = sim != null ? `<span class="sim" style="background:${this._sourceColor(sim)}">${Math.round(sim * 100)}%</span>` : '';
            const uri = typeof s === 'string' ? s : (s.chunk_uri || s.document || '');
            return `<span class="draga-source-chip" data-chunk-uri="${this._esc(uri)}" tabindex="0" role="button">📄 ${this._esc(name.split('/').pop())} ${simStr}</span>`;
          }).join('')}
        </div>`;
    }

    // Confidence badge
    let confidenceHtml = '';
    if (!isUser && this.showConfidence && meta.confidence != null) {
      const cl = this._confidenceLevel(meta.confidence);
      if (cl) {
        confidenceHtml = `<span class="draga-confidence ${cl.level}" title="${this.t.confidence}: ${(meta.confidence * 100).toFixed(0)}%">${cl.emoji} ${cl.label} (${(meta.confidence * 100).toFixed(0)}%)</span>`;
      }
    }

    // Grounding detail
    let groundingHtml = '';
    if (!isUser && this.showGrounding && meta.itemsEvaluated?.length > 0) {
      const items = meta.itemsEvaluated.map(it => {
        const icon = it.status === 'grounded' ? '✅' : it.status === 'partial' ? '⚠️' : '❌';
        const statusLabel = this.t[`grounding${it.status.charAt(0).toUpperCase() + it.status.slice(1)}`] || it.status;
        const statusClass = it.status;
        const conf = it.confidence != null ? ` (${(it.confidence * 100).toFixed(0)}%)` : '';
        return `<div class="draga-ground-item"><span class="icon">${icon}</span><span class="label">${this._esc(it.item)}</span><span class="status ${statusClass}">${statusLabel}${conf}</span></div>`;
      }).join('');
      groundingHtml = `
        <div class="draga-grounding">
          <div class="draga-grounding-toggle" data-grounding-toggle tabindex="0" role="button" aria-expanded="false">▸ ${this.t.grounding} (${meta.itemsEvaluated.length})</div>
          <div class="draga-grounding-list" style="display:none">${items}</div>
        </div>`;
    }

    // Feedback
    let feedbackHtml = '';
    if (!isUser && this.feedbackEnabled && msg.role === 'assistant' && !meta.streaming && msg.content) {
      if (msg.feedback != null) {
        feedbackHtml = `<div class="draga-fb-thanks">✓ ${this.t.feedbackThanks}</div>`;
      } else if (this._state.feedbackOpen === msg.id) {
        feedbackHtml = `
          <div class="draga-feedback">
            <button class="draga-fb-btn pos selected" data-fb-rating="positive" data-fb-id="${msg.id}">👍 ${this.t.feedbackUseful}</button>
            <button class="draga-fb-btn neg" data-fb-rating="negative" data-fb-id="${msg.id}">👎 ${this.t.feedbackNotUseful}</button>
          </div>
          <div class="draga-fb-comment">
            <input type="text" class="draga-fb-input" placeholder="${this.t.feedbackComment}" data-fb-id="${msg.id}">
            <button class="draga-fb-send" data-fb-id="${msg.id}">${this.t.feedbackSend}</button>
          </div>`;
      } else {
        feedbackHtml = `
          <div class="draga-feedback">
            <button class="draga-fb-btn pos" data-fb-rating="positive" data-fb-id="${msg.id}">👍</button>
            <button class="draga-fb-btn neg" data-fb-rating="negative" data-fb-id="${msg.id}">👎</button>
          </div>`;
      }
    }

    // Meta line
    let metaHtml = `<span>${ts}</span>`;
    if (meta.model) metaHtml += `<span class="draga-meta-tag">${this._esc(meta.model)}</span>`;
    if (meta.processingTime) metaHtml += `<span class="draga-meta-tag">${meta.processingTime}ms</span>`;
    if (meta.cached) metaHtml += `<span class="draga-meta-tag">cached</span>`;
    if (meta.usage) metaHtml += `<span class="draga-meta-tag">${meta.usage.total_tokens || '?'} tok</span>`;
    if (isStreaming) metaHtml += `<span style="color:${this._primary};font-weight:500">streaming...</span>`;

    return `
      <div class="draga-msg ${msg.role} ${isStreaming ? 'draga-streaming' : ''}" data-msg-id="${msg.id}">
        <div class="draga-msg-avatar">${avatar}</div>
        <div class="draga-msg-body">
          <div class="draga-bubble"><div class="draga-bubble-content">${content || '&nbsp;'}</div></div>
          ${confidenceHtml}
          ${sourcesHtml}
          ${groundingHtml}
          ${feedbackHtml}
          <div class="draga-msg-meta">${metaHtml}</div>
        </div>
      </div>`;
  }

  // ── Event binding ───────────────────────────────────────────────

  _bindEvents() {
    const root = this.shadowRoot;

    // Launcher
    root.querySelector('.draga-launcher')?.addEventListener('click', () => this._toggleOpen());

    // Header buttons
    root.querySelector('.draga-close-btn')?.addEventListener('click', () => this._toggleOpen());
    root.querySelector('.draga-min-btn')?.addEventListener('click', () => this._toggleMinimize());
    root.querySelector('.draga-clear-btn')?.addEventListener('click', () => this._clearChat());
    root.querySelector('.draga-stop-btn')?.addEventListener('click', () => this._stopStreaming());
    root.querySelector('.draga-retry-btn')?.addEventListener('click', async () => {
      const ok = await this._health.check();
      this._setState({ isOnline: ok });
      if (ok && this._protocol instanceof DragaProtocolMCP) this._protocol.connect();
    });

    // Source detail
    root.querySelector('.draga-close-source')?.addEventListener('click', () => this._closeSourceDetail());

    // Form submit
    const form = root.querySelector('form.draga-input-area');
    form?.addEventListener('submit', (e) => { e.preventDefault(); this._submitFromInput(); });

    // Textarea
    const ta = root.querySelector('.draga-input');
    if (ta) {
      ta.addEventListener('input', () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
      });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._submitFromInput(); }
      });
    }

    // Delegated clicks on messages area
    root.querySelector('.draga-messages')?.addEventListener('click', (e) => {
      // Source chips
      const chip = e.target.closest('.draga-source-chip');
      if (chip) {
        const uri = chip.dataset.chunkUri;
        if (uri) this._openSourceDetail(uri);
        return;
      }

      // Grounding toggle
      const toggle = e.target.closest('[data-grounding-toggle]');
      if (toggle) {
        const list = toggle.nextElementSibling;
        if (list) {
          const visible = list.style.display !== 'none';
          list.style.display = visible ? 'none' : 'flex';
          toggle.textContent = (visible ? '▸' : '▾') + toggle.textContent.slice(1);
          toggle.setAttribute('aria-expanded', !visible);
        }
        return;
      }

      // Feedback buttons
      const fbBtn = e.target.closest('.draga-fb-btn');
      if (fbBtn) {
        const msgId = fbBtn.dataset.fbId;
        const rating = fbBtn.dataset.fbRating;
        if (this._state.feedbackOpen === msgId) {
          // Already in feedback mode — send immediately
          this._sendFeedback(msgId, rating);
        } else {
          // Open feedback form
          this._setState({ feedbackOpen: msgId });
        }
        return;
      }

      // Feedback send button
      const fbSend = e.target.closest('.draga-fb-send');
      if (fbSend) {
        const msgId = fbSend.dataset.fbId;
        const input = root.querySelector(`.draga-fb-input[data-fb-id="${msgId}"]`);
        const comment = input?.value || '';
        // Find which rating was selected
        const selectedBtn = root.querySelector(`.draga-fb-btn.selected[data-fb-id="${msgId}"]`);
        const rating = selectedBtn?.dataset.fbRating || 'positive';
        this._sendFeedback(msgId, rating, comment);
        return;
      }
    });
  }

  _submitFromInput() {
    const ta = this.shadowRoot.querySelector('.draga-input');
    if (!ta) return;
    const text = ta.value;
    ta.value = '';
    ta.style.height = 'auto';
    this._handleSubmit(text);
  }
}

customElements.define('draga-chat', DragaChat);
