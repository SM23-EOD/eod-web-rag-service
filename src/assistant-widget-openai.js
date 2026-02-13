/**
 * RagAssistantOpenAI - Widget de chat usando protocolo OpenAI compatible
 * Usa POST /api/v2/chat/completions con streaming SSE
 * 
 * A diferencia de los widgets MCP (v1, v2) que usan /api/v2/mcp/tools/call,
 * este widget habla el protocolo estándar OpenAI Chat Completions API.
 * 
 * Atributos soportados:
 *   endpoint     - Base URL del API (default: /api/v2)  
 *   model        - Modelo a usar (default: eod-rag)
 *   title        - Título del widget
 *   session-id   - ID de sesión
 *   placeholder  - Placeholder del textarea
 *   position     - bottom-right | bottom-left
 *   theme-color  - Color HEX principal
 *   stream       - true/false para activar streaming (default: true)
 *   top-k        - Número de documentos para RAG (default: 5)
 *   temperature  - Temperatura del modelo (default: 0.7)
 *   system-prompt - Prompt del sistema (opcional)
 */
class RagAssistantOpenAI extends HTMLElement {
  static get observedAttributes() {
    return [
      "endpoint", "model", "title", "session-id", "placeholder",
      "position", "theme-color", "stream", "top-k", "temperature",
      "system-prompt",
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = {
      isOpen: false,
      isMinimized: false,
      isLoading: false,
      messages: [],         // UI messages
      chatHistory: [],      // OpenAI message history for context
      unreadCount: 0,
      streamingText: null,  // Current streaming text (null = not streaming)
    };
    this._abortController = null;
  }

  connectedCallback() {
    this.render();
    this._setupKeyboardShortcuts();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._keyHandler);
    this._abortStreaming();
  }

  attributeChangedCallback() {
    this.render();
  }

  // ── Attribute getters ─────────────────────────────────────────

  get endpoint()      { return this.getAttribute("endpoint") || "/api/v2"; }
  get model()         { return this.getAttribute("model") || "eod-rag"; }
  get title()         { return this.getAttribute("title") || "Asistente IA"; }
  get sessionId()     { return this.getAttribute("session-id") || "web"; }
  get placeholder()   { return this.getAttribute("placeholder") || "Escribe tu mensaje..."; }
  get position()      { return this.getAttribute("position") || "bottom-right"; }
  get themeColor()    { return this.getAttribute("theme-color") || "#059669"; }
  get streamEnabled() { return this.getAttribute("stream") !== "false"; }
  get topK()          { return parseInt(this.getAttribute("top-k")) || 5; }
  get temperature()   { return parseFloat(this.getAttribute("temperature")) || 0.7; }
  get systemPrompt()  { return this.getAttribute("system-prompt") || null; }

  // ── State management ──────────────────────────────────────────

  setState(nextState) {
    this.state = { ...this.state, ...nextState };
    this.render();
  }

  addMessage(role, content, metadata = {}) {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.setState({
      messages: [...this.state.messages, {
        id: messageId, role, content, metadata,
        timestamp: new Date().toISOString(),
        feedbackSent: false,
      }],
      unreadCount: !this.state.isOpen ? this.state.unreadCount + 1 : 0,
    });
    setTimeout(() => this.scrollToBottom(), 100);
    return messageId;
  }

  /** Update the content of an existing message by ID */
  updateMessage(messageId, content, metadata = {}) {
    this.setState({
      messages: this.state.messages.map(m =>
        m.id === messageId ? { ...m, content, metadata: { ...m.metadata, ...metadata } } : m
      ),
    });
  }

  scrollToBottom() {
    const el = this.shadowRoot.querySelector(".chat-messages");
    if (el) el.scrollTop = el.scrollHeight;
  }

  // ── Keyboard shortcuts ────────────────────────────────────────

  _setupKeyboardShortcuts() {
    this._keyHandler = (e) => {
      if (e.key === 'Escape' && this.state.isOpen) this.toggleOpen();
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.toggleOpen();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  // ── OpenAI Chat Completions ───────────────────────────────────

  _buildMessages(userText) {
    const messages = [];
    // System prompt
    if (this.systemPrompt) {
      messages.push({ role: 'system', content: this.systemPrompt });
    }
    // Conversation history (last 20 turns)
    const history = this.state.chatHistory.slice(-20);
    messages.push(...history);
    // Current user message
    messages.push({ role: 'user', content: userText });
    return messages;
  }

  _buildRequestBody(userText) {
    return {
      model: this.model,
      messages: this._buildMessages(userText),
      stream: this.streamEnabled,
      top_k: this.topK,
      temperature: this.temperature,
    };
  }

  /** Non-streaming request */
  async _sendNonStreaming(userText) {
    const url = `${this.endpoint}/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._buildRequestBody(userText)),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || err.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || 'Sin respuesta.';
    const usage = data.usage || null;
    return { content, usage, model: data.model };
  }

  /** Streaming request with SSE */
  async _sendStreaming(userText, msgId) {
    const url = `${this.endpoint}/chat/completions`;
    this._abortController = new AbortController();

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this._buildRequestBody(userText)),
      signal: this._abortController.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || err.message || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let model = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') break;

        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta?.content || '';
          if (!model && chunk.model) model = chunk.model;
          if (delta) {
            fullText += delta;
            // Live-update the message bubble in shadow DOM for smooth streaming
            this._updateStreamingBubble(msgId, fullText);
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    this._abortController = null;
    return { content: fullText || 'Sin respuesta.', model };
  }

  _abortStreaming() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  /** Directly update the DOM of a streaming message without full re-render */
  _updateStreamingBubble(msgId, text) {
    const bubble = this.shadowRoot.querySelector(`[data-msg-id="${msgId}"] .message-bubble`);
    if (bubble) {
      bubble.innerHTML = this._renderMarkdown(text);
      this.scrollToBottom();
    }
  }

  // ── Handle Submit ─────────────────────────────────────────────

  async handleSubmit(event) {
    event.preventDefault();
    if (this.state.isLoading) return;

    const input = this.shadowRoot.querySelector("textarea");
    const text = input.value.trim();
    if (!text) return;

    this.addMessage("user", text);
    input.value = "";
    input.style.height = 'auto';

    this.setState({ isLoading: true, streamingText: '' });

    // Add a placeholder assistant message for streaming
    const msgId = this.addMessage("assistant", "", { streaming: true });

    try {
      let result;

      if (this.streamEnabled) {
        result = await this._sendStreaming(text, msgId);
      } else {
        result = await this._sendNonStreaming(text);
      }

      // Final update of the message
      this.updateMessage(msgId, result.content, {
        streaming: false,
        model: result.model,
        usage: result.usage || null,
      });

      // Update chat history for context
      this.state.chatHistory.push(
        { role: 'user', content: text },
        { role: 'assistant', content: result.content },
      );

    } catch (error) {
      if (error.name === 'AbortError') {
        this.updateMessage(msgId, '⏹️ Streaming cancelado.', { streaming: false });
      } else {
        this.updateMessage(msgId, `❌ Error: ${error.message}`, { streaming: false, error: true });
      }
    } finally {
      this.setState({ isLoading: false, streamingText: null });
    }
  }

  // ── UI Actions ────────────────────────────────────────────────

  toggleOpen() {
    this.setState({ isOpen: !this.state.isOpen, unreadCount: 0 });
    if (this.state.isOpen) {
      setTimeout(() => {
        const ta = this.shadowRoot.querySelector("textarea");
        if (ta) ta.focus();
      }, 100);
    }
  }

  toggleMinimize() {
    this.setState({ isMinimized: !this.state.isMinimized });
  }

  clearChat() {
    if (confirm('¿Limpiar conversación?')) {
      this._abortStreaming();
      this.setState({ messages: [], unreadCount: 0, streamingText: null });
      this.state.chatHistory = [];
    }
  }

  stopStreaming() {
    this._abortStreaming();
  }

  // ── Markdown / HTML helpers ───────────────────────────────────

  _renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
      try { return marked.parse(text); } catch { /* fallback */ }
    }
    return this._escapeHtml(text).replace(/\n/g, '<br>');
  }

  _escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  // ── Color utilities ───────────────────────────────────────────

  _adjustColor(hex, pct) {
    const n = parseInt(hex.replace('#', ''), 16);
    const a = Math.round(2.55 * pct);
    const R = (n >> 16) + a, G = (n >> 8 & 0xff) + a, B = (n & 0xff) + a;
    return '#' + (0x1000000 +
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  _hexToRgba(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // ── Render ────────────────────────────────────────────────────

  render() {
    const { isOpen, isMinimized, messages, isLoading, unreadCount } = this.state;
    const tc = this.themeColor;
    const pos = this.position === 'bottom-left' ? 'left:20px;right:auto;' : 'right:20px;left:auto;';
    const containerH = isMinimized ? '60px' : '600px';

    this.shadowRoot.innerHTML = `
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        :host{position:fixed;bottom:20px;${pos}font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;z-index:2147483647;transition:all .3s ease}

        .launcher{width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,${tc},${this._adjustColor(tc,20)});border:none;cursor:pointer;display:${isOpen?'none':'flex'};align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,0,0,.15);transition:all .3s;color:#fff;font-size:26px;position:relative}
        .launcher:hover{transform:scale(1.1);box-shadow:0 6px 24px rgba(0,0,0,.2)}
        .badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;border-radius:50%;width:22px;height:22px;display:${unreadCount>0?'flex':'none'};align-items:center;justify-content:center;font-size:11px;font-weight:700;border:2px solid #fff}

        .chat-box{width:420px;max-width:calc(100vw - 40px);height:${containerH};max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.18);display:${isOpen?'flex':'none'};flex-direction:column;overflow:hidden;animation:slideUp .3s ease-out}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}

        .header{background:linear-gradient(135deg,${tc},${this._adjustColor(tc,20)});color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between}
        .header-left{display:flex;align-items:center;gap:10px;flex:1}
        .hdr-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:17px}
        .hdr-title{font-size:15px;font-weight:600}
        .hdr-sub{font-size:11px;opacity:.85;display:flex;align-items:center;gap:5px}
        .hdr-dot{width:6px;height:6px;border-radius:50%;background:#10b981}
        .hdr-protocol{font-size:10px;background:rgba(255,255,255,.2);padding:2px 7px;border-radius:10px;margin-left:6px}
        .hdr-actions{display:flex;gap:6px}
        .hdr-btn{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.15);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;transition:all .2s}
        .hdr-btn:hover{background:rgba(255,255,255,.25);transform:scale(1.05)}

        .chat-messages{flex:1;padding:18px;overflow-y:auto;background:#f9fafb;display:${isMinimized?'none':'flex'};flex-direction:column;gap:14px}
        .chat-messages::-webkit-scrollbar{width:5px}
        .chat-messages::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:3px}

        .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;padding:30px 20px;text-align:center}
        .empty-icon{font-size:56px;margin-bottom:14px;opacity:.6}
        .empty-title{font-size:17px;font-weight:600;color:#1f2937;margin-bottom:6px}
        .empty-text{font-size:13px;color:#6b7280;line-height:1.6;max-width:280px}
        .suggestions{margin-top:18px;display:flex;flex-direction:column;gap:7px;width:100%;max-width:300px}
        .sug-btn{padding:11px 14px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;font-size:13px;color:#374151;text-align:left;transition:all .2s}
        .sug-btn:hover{background:${tc};color:#fff;border-color:${tc};transform:translateX(4px)}

        .msg-row{display:flex;gap:10px;animation:fadeIn .3s ease-out}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .msg-row.user{flex-direction:row-reverse}
        .msg-avatar{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0}
        .msg-row.user .msg-avatar{background:linear-gradient(135deg,${tc},${this._adjustColor(tc,20)});color:#fff}
        .msg-row.assistant .msg-avatar{background:#e5e7eb}
        .msg-body{flex:1;display:flex;flex-direction:column;gap:6px}
        .message-bubble{padding:11px 15px;border-radius:14px;font-size:14px;line-height:1.6;word-wrap:break-word}
        .msg-row.user .message-bubble{background:linear-gradient(135deg,${tc},${this._adjustColor(tc,20)});color:#fff;border-bottom-right-radius:4px}
        .msg-row.assistant .message-bubble{background:#fff;color:#1f2937;border:1px solid #e5e7eb;border-bottom-left-radius:4px}
        .message-bubble p{margin:0 0 8px}
        .message-bubble p:last-child{margin:0}
        .message-bubble ul,.message-bubble ol{margin:6px 0;padding-left:18px}
        .message-bubble code{background:rgba(0,0,0,.06);padding:1px 5px;border-radius:4px;font-size:13px;font-family:monospace}
        .msg-row.user .message-bubble code{background:rgba(255,255,255,.2)}
        .message-bubble pre{background:#1f2937;color:#e5e7eb;padding:10px;border-radius:8px;overflow-x:auto;margin:6px 0}
        .message-bubble pre code{background:none;padding:0;color:inherit}
        .message-bubble a{color:${tc}}
        .msg-row.user .message-bubble a{color:#fff}

        .msg-meta{display:flex;align-items:center;gap:8px;font-size:11px;color:#9ca3af}
        .meta-model{background:#f3f4f6;padding:1px 6px;border-radius:6px;font-size:10px;color:#6b7280}
        .meta-stream{color:${tc};font-weight:500}

        .typing{display:flex;align-items:center;gap:5px;padding:10px 14px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;border-bottom-left-radius:4px;width:fit-content}
        .dot{width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:bounce 1.4s infinite}
        .dot:nth-child(2){animation-delay:.2s}
        .dot:nth-child(3){animation-delay:.4s}
        @keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.7}30%{transform:translateY(-8px);opacity:1}}

        .cursor-blink::after{content:'▌';animation:blink-cursor .8s infinite;color:${tc}}
        @keyframes blink-cursor{0%,100%{opacity:1}50%{opacity:0}}

        .chat-input{padding:14px 18px;border-top:1px solid #e5e7eb;background:#fff;display:${isMinimized?'none':'flex'};flex-direction:column;gap:10px}
        .input-row{display:flex;gap:8px;align-items:flex-end}
        textarea{flex:1;min-height:42px;max-height:120px;padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;font-size:14px;font-family:inherit;resize:none;transition:all .2s}
        textarea:focus{outline:none;border-color:${tc};box-shadow:0 0 0 3px ${this._hexToRgba(tc,.1)}}
        textarea::placeholder{color:#9ca3af}
        .send-btn{width:42px;height:42px;border-radius:12px;background:linear-gradient(135deg,${tc},${this._adjustColor(tc,20)});border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:19px;transition:all .2s;flex-shrink:0}
        .send-btn:hover:not([disabled]){transform:scale(1.05);box-shadow:0 4px 12px ${this._hexToRgba(tc,.3)}}
        .send-btn[disabled]{opacity:.5;cursor:not-allowed}
        .stop-btn{background:linear-gradient(135deg,#ef4444,#dc2626)}
        .stop-btn:hover:not([disabled]){box-shadow:0 4px 12px rgba(239,68,68,.3)}

        .input-footer{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#9ca3af}
        .mode-badge{display:inline-flex;align-items:center;gap:4px;background:#ecfdf5;color:#059669;padding:2px 8px;border-radius:8px;font-weight:600;font-size:10px}
        .mode-badge.no-stream{background:#fef3c7;color:#92400e}

        @media(max-width:480px){:host{bottom:10px;${this.position==='bottom-left'?'left:10px;':'right:10px;'}}.chat-box{width:calc(100vw - 20px);max-height:calc(100vh - 20px)}.launcher{width:54px;height:54px}}
      </style>

      <!-- Launcher -->
      <button class="launcher" aria-label="Abrir asistente" title="Chat (Ctrl+K)">
        ⚡ <span class="badge">${unreadCount}</span>
      </button>

      <!-- Chat box -->
      <div class="chat-box" role="dialog" aria-label="${this.title}">
        <div class="header">
          <div class="header-left">
            <div class="hdr-avatar">⚡</div>
            <div>
              <div class="hdr-title">${this.title}</div>
              <div class="hdr-sub">
                <span class="hdr-dot"></span> En línea
                <span class="hdr-protocol">${this.streamEnabled ? 'OpenAI Stream' : 'OpenAI'}</span>
              </div>
            </div>
          </div>
          <div class="hdr-actions">
            <button class="hdr-btn clear-btn" title="Limpiar">🗑️</button>
            <button class="hdr-btn min-btn" title="${isMinimized?'Maximizar':'Minimizar'}">${isMinimized?'🔼':'🔽'}</button>
            <button class="hdr-btn close-btn" title="Cerrar (Esc)">✕</button>
          </div>
        </div>

        <div class="chat-messages">
          ${messages.length === 0 ? this._renderEmpty() : ''}
        </div>

        <form class="chat-input">
          <div class="input-row">
            <textarea placeholder="${this.placeholder}" rows="1" aria-label="Mensaje"></textarea>
            ${isLoading
              ? `<button type="button" class="send-btn stop-btn" aria-label="Detener">⏹</button>`
              : `<button type="submit" class="send-btn" aria-label="Enviar">➤</button>`
            }
          </div>
          <div class="input-footer">
            <span>Enter para enviar | Shift+Enter nueva línea</span>
            <span class="mode-badge ${this.streamEnabled ? '' : 'no-stream'}">
              ${this.streamEnabled ? '🔴 streaming' : '📦 batch'} · ${this.model}
            </span>
          </div>
        </form>
      </div>
    `;

    // Event delegation
    this.shadowRoot.addEventListener("click", this._onClick);
    this.shadowRoot.addEventListener("submit", this._onSubmit);

    // Textarea auto-resize + Shift+Enter
    const ta = this.shadowRoot.querySelector("textarea");
    if (ta) {
      ta.addEventListener('input', () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
      });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.shadowRoot.querySelector('form.chat-input')?.requestSubmit();
        }
      });
    }

    // Render messages
    if (messages.length > 0) {
      const container = this.shadowRoot.querySelector(".chat-messages");
      if (container) {
        container.innerHTML = messages.map(m => this._renderMsg(m)).join('');
        // Typing indicator if loading and not yet streaming content
        if (isLoading && !messages.some(m => m.metadata?.streaming && m.content)) {
          container.innerHTML += `
            <div class="msg-row assistant">
              <div class="msg-avatar">⚡</div>
              <div class="typing"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
            </div>`;
        }
      }
      this.scrollToBottom();
    }
  }

  _renderEmpty() {
    return `
      <div class="empty">
        <div class="empty-icon">⚡</div>
        <div class="empty-title">${this.title}</div>
        <div class="empty-text">Widget OpenAI Compatible con ${this.streamEnabled ? 'streaming' : 'batch'} mode. Modelo: <strong>${this.model}</strong></div>
        <div class="suggestions">
          <button class="sug-btn" data-sug="¿Cómo puedo rastrear mi envío?">📦 ¿Cómo rastrear mi envío?</button>
          <button class="sug-btn" data-sug="¿Qué opciones de envío ofrecen?">🚚 Opciones de envío</button>
          <button class="sug-btn" data-sug="¿Cuáles son los tiempos de entrega?">⏱️ Tiempos de entrega</button>
        </div>
      </div>`;
  }

  _renderMsg(msg) {
    const isUser = msg.role === 'user';
    const avatar = isUser ? '👤' : '⚡';
    const content = isUser ? this._escapeHtml(msg.content) : this._renderMarkdown(msg.content || '');
    const ts = new Date(msg.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    const isStreaming = msg.metadata?.streaming && this.state.isLoading;

    // Model & meta info
    let metaHtml = `<span>${ts}</span>`;
    if (msg.metadata?.model) metaHtml += `<span class="meta-model">${msg.metadata.model}</span>`;
    if (isStreaming) metaHtml += `<span class="meta-stream">streaming...</span>`;
    if (msg.metadata?.usage) {
      const u = msg.metadata.usage;
      metaHtml += `<span class="meta-model">${u.prompt_tokens || '?'}→${u.completion_tokens || '?'} tok</span>`;
    }

    return `
      <div class="msg-row ${msg.role}" data-msg-id="${msg.id}">
        <div class="msg-avatar">${avatar}</div>
        <div class="msg-body">
          <div class="message-bubble${isStreaming ? ' cursor-blink' : ''}">${content || '&nbsp;'}</div>
          <div class="msg-meta">${metaHtml}</div>
        </div>
      </div>`;
  }

  // ── Event handlers ────────────────────────────────────────────

  _onClick = (e) => {
    if (e.target.closest(".launcher")) return this.toggleOpen();
    if (e.target.closest(".close-btn")) return this.toggleOpen();
    if (e.target.closest(".min-btn")) return this.toggleMinimize();
    if (e.target.closest(".clear-btn")) return this.clearChat();
    if (e.target.closest(".stop-btn")) return this.stopStreaming();
    const sug = e.target.closest(".sug-btn");
    if (sug) {
      const ta = this.shadowRoot.querySelector("textarea");
      if (ta) { ta.value = sug.dataset.sug; ta.focus(); }
    }
  };

  _onSubmit = (e) => {
    if (e.target.matches("form.chat-input")) {
      e.preventDefault();
      this.handleSubmit(e);
    }
  };
}

customElements.define("rag-assistant-openai", RagAssistantOpenAI);
