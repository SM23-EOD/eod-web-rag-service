class RagAssistant extends HTMLElement {
  static get observedAttributes() {
    return [
      "endpoint",
      "title",
      "tool-name",
      "session-id",
      "include-sources",
      "placeholder",
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = {
      isOpen: false,
      isExpanded: false,
      isLoading: false,
      messages: [],
    };
    // Almacenar conversaciones para feedback (query -> response)
    this._conversations = [];
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  get endpoint() {
    return this.getAttribute("endpoint") || "/api/v2/mcp/tools/call";
  }

  get title() {
    return this.getAttribute("title") || "Asistente";
  }

  get toolName() {
    return this.getAttribute("tool-name") || "generate_rag_answer";
  }

  get sessionId() {
    return this.getAttribute("session-id") || "web";
  }

  get includeSources() {
    const raw = this.getAttribute("include-sources");
    if (raw === null) {
      return true;
    }
    return raw !== "false";
  }

  get placeholder() {
    return this.getAttribute("placeholder") || "Escribe tu pregunta...";
  }

  setState(nextState) {
    this.state = { ...this.state, ...nextState };
    this.render();
  }

  addMessage(role, content, metadata = {}) {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.setState({
      messages: [...this.state.messages, { id: messageId, role, content, metadata, feedbackSent: false }],
    });
    // Hacer scroll después de que se renderice
    setTimeout(() => this.scrollToBottom(), 100);
    return messageId;
  }

  scrollToBottom() {
    const messagesContainer = this.shadowRoot.querySelector(".messages");
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  async sendFeedback(messageId, rating) {
    // Buscar la conversación asociada al mensaje
    const conversation = this._conversations.find(c => c.messageId === messageId);
    if (!conversation) {
      console.error('No se encontró la conversación para feedback');
      return;
    }

    // Construir URL base del endpoint de feedback
    const feedbackEndpoint = this.endpoint.replace(/\/mcp\/tools\/call$/, '/feedback');

    try {
      const response = await fetch(feedbackEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: conversation.query,
          response: conversation.response,
          rating: rating,
          confidence: conversation.confidence,
          session_id: this.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      // Marcar mensaje como feedback enviado
      this.setState({
        messages: this.state.messages.map(m =>
          m.id === messageId ? { ...m, feedbackSent: true, feedbackRating: rating } : m
        ),
      });

      console.log(`Feedback ${rating} enviado para mensaje ${messageId}`);
    } catch (error) {
      console.error('Error al enviar feedback:', error);
    }
  }

  renderMarkdown(text) {
    // Si marked está disponible, renderizar markdown
    if (typeof marked !== 'undefined') {
      try {
        return marked.parse(text);
      } catch (e) {
        console.error('Error al renderizar markdown:', e);
        return this.escapeHtml(text);
      }
    }
    // Fallback: escapar HTML
    return this.escapeHtml(text);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Extrae el nombre legible de una fuente, independientemente del formato.
   * Soporta strings, objetos con campos como source_name, name, title, etc.
   */
  getSourceDisplayName(source) {
    if (typeof source === 'string') return source;
    if (source && typeof source === 'object') {
      // Prioridad: source_name > name > title > document_name > source > filename > file
      const nameFields = ['source_name', 'name', 'title', 'document_name'];
      for (const field of nameFields) {
        if (source[field] && typeof source[field] === 'string') {
          return source[field];
        }
      }
      // Buscar en metadata anidada
      if (source.metadata && typeof source.metadata === 'object') {
        for (const field of nameFields) {
          if (source.metadata[field] && typeof source.metadata[field] === 'string') {
            return source.metadata[field];
          }
        }
      }
      // Fallback a campos de fichero
      const fileFields = ['source', 'filename', 'file', 'path'];
      for (const field of fileFields) {
        if (source[field] && typeof source[field] === 'string') {
          return source[field];
        }
      }
      if (source.metadata && typeof source.metadata === 'object') {
        for (const field of fileFields) {
          if (source.metadata[field] && typeof source.metadata[field] === 'string') {
            return source.metadata[field];
          }
        }
      }
      return JSON.stringify(source);
    }
    return String(source);
  }

  toggleOpen() {
    this.setState({ isOpen: !this.state.isOpen });
  }

  toggleExpanded() {
    this.setState({ isExpanded: !this.state.isExpanded });
  }

  async handleSubmit(event) {
    event.preventDefault();
    if (this.state.isLoading) return;

    const input = this.shadowRoot.querySelector("textarea");
    const text = input.value.trim();
    if (!text) return;

    this.addMessage("user", text);
    input.value = "";

    this.setState({ isLoading: true });

    // Guardar la query para feedback
    const currentQuery = text;

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tool_name: this.toolName,
          arguments: {
            query: text,
            include_sources: this.includeSources,
          },
          session_id: this.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Error desconocido");
      }

      // Extraer solo el texto de la respuesta, sin metadata ni fuentes
      let responseText = data.result || "Sin respuesta.";

      // Extraer fuentes antes de limpiarlas
      let extractedSources = [];
      const sourcesMatch = responseText.match(/###\s*📚?\s*Fuentes[\s\S]*?(?=###|$)/);
      if (sourcesMatch) {
        const sourcesSection = sourcesMatch[0];
        // Extraer nombres de fuentes (buscar patrones como "- nombre.pdf" o "• documento.txt")
        const sourceLines = sourcesSection.match(/[-•*]\s*(.+?)(?:\n|$)/g);
        if (sourceLines) {
          extractedSources = sourceLines.map(line => 
            line.replace(/^[-•*]\s*/, '').trim()
          ).filter(s => s.length > 0);
        }
      }

      // También extraer de data.sources si viene del backend
      if (data.sources && Array.isArray(data.sources)) {
        const namedSources = data.sources.map(s => this.getSourceDisplayName(s));
        extractedSources = [...extractedSources, ...namedSources];
      }

      // Deduplicar fuentes
      extractedSources = [...new Set(extractedSources)];

      // Limpiar metadata y fuentes - eliminar todo después de ### 📚 Fuentes o ### 📊 Metadata
      const cleanPatterns = [
        /\n\n###\s*📚\s*Fuentes[\s\S]*$/,     // ### 📚 Fuentes y todo lo que sigue
        /\n\n###\s*📊\s*Metadata[\s\S]*$/,   // ### 📊 Metadata y todo lo que sigue
        /\n\n###\s*Fuentes[\s\S]*$/,         // ### Fuentes sin emoji
        /\n\n###\s*Metadata[\s\S]*$/,        // ### Metadata sin emoji
        /^##\s*Respuesta\s*\n+/,             // Encabezado "## Respuesta" al inicio
      ];

      cleanPatterns.forEach(pattern => {
        responseText = responseText.replace(pattern, '');
      });

      responseText = responseText.trim();

      // Extraer confidence si está disponible
      const confidence = data.confidence || null;

      // Agregar mensaje con metadata para feedback y fuentes
      const msgId = this.addMessage("assistant", responseText, { confidence, sources: extractedSources });

      // Guardar conversación para feedback
      this._conversations.push({
        messageId: msgId,
        query: currentQuery,
        response: responseText,
        confidence: confidence,
      });
    } catch (error) {
      this.addMessage(
        "error",
        `No se pudo procesar la consulta: ${error.message}`,
      );
    } finally {
      this.setState({ isLoading: false });
    }
  }

  render() {
    const { isOpen, isExpanded, messages, isLoading } = this.state;

    // Dimensiones según estado expandido
    const panelWidth = isExpanded ? "600px" : "360px";
    const panelHeight = isExpanded ? "80vh" : "520px";
    const panelBottom = isExpanded ? "20px" : "72px";
    const panelRight = isExpanded ? "20px" : "0";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 24px;
          right: 24px;
          font-family: "Inter", system-ui, -apple-system, sans-serif;
          z-index: 9999;
        }

        .launcher {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%);
          color: white;
          border: none;
          cursor: pointer;
          box-shadow: 0 12px 24px rgba(255, 107, 53, 0.4);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .launcher:hover {
          transform: scale(1.1);
          box-shadow: 0 16px 32px rgba(255, 107, 53, 0.5);
        }

        .panel {
          position: absolute;
          bottom: ${panelBottom};
          right: ${panelRight};
          width: ${panelWidth};
          max-width: calc(100vw - 48px);
          height: ${panelHeight};
          max-height: calc(100vh - 100px);
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.2);
          display: ${isOpen ? "flex" : "none"};
          flex-direction: column;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .header {
          padding: 14px 16px;
          background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
          color: white;
          font-weight: 600;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .header-title {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .header-actions {
          display: flex;
          gap: 4px;
        }

        .header-btn {
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: background 0.2s ease;
        }

        .header-btn:hover {
          background: rgba(255, 255, 255, 0.25);
        }

        .close {
          background: transparent;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
        }

        .messages {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
          flex: 1;
          scroll-behavior: smooth;
        }

        .bubble {
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.6;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }

        /* Estilos para contenido HTML renderizado */
        .bubble p {
          margin: 0 0 8px 0;
        }

        .bubble p:last-child {
          margin-bottom: 0;
        }

        .bubble ul, .bubble ol {
          margin: 8px 0;
          padding-left: 24px;
        }

        .bubble li {
          margin: 4px 0;
        }

        .bubble code {
          background: rgba(0, 0, 0, 0.08);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
          font-family: 'Courier New', monospace;
        }

        .bubble.user code {
          background: rgba(255, 255, 255, 0.2);
        }

        .bubble pre {
          background: rgba(0, 0, 0, 0.05);
          padding: 10px;
          border-radius: 6px;
          overflow-x: auto;
          margin: 8px 0;
        }

        .bubble pre code {
          background: none;
          padding: 0;
        }

        .bubble a {
          color: inherit;
          text-decoration: underline;
          opacity: 0.9;
        }

        .bubble strong {
          font-weight: 600;
        }

        .sources-section {
          margin-top: 12px;
          padding: 10px 12px;
          background: rgba(37, 99, 235, 0.08);
          border-radius: 8px;
          border-left: 3px solid #2563eb;
        }

        .sources-title {
          font-size: 12px;
          font-weight: 600;
          color: #2563eb;
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .source-item {
          font-size: 12px;
          color: #475569;
          padding: 3px 0;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .source-item::before {
          content: '📄';
          font-size: 10px;
        }

        .bubble h1, .bubble h2, .bubble h3,
        .bubble h4, .bubble h5, .bubble h6 {
          margin: 12px 0 8px 0;
          font-weight: 600;
        }

        .bubble h1 { font-size: 18px; }
        .bubble h2 { font-size: 16px; }
        .bubble h3 { font-size: 15px; }
        .bubble h4, .bubble h5, .bubble h6 { font-size: 14px; }

        .message-container {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .message-container.user {
          align-items: flex-end;
        }

        .message-container.assistant {
          align-items: flex-start;
        }

        .feedback-buttons {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }

        .feedback-btn {
          background: #f0f4f8;
          border: 1px solid #d9dfea;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .feedback-btn:hover:not([disabled]) {
          background: #e2e8f0;
          border-color: #94a3b8;
        }

        .feedback-btn.positive:hover:not([disabled]) {
          background: #dcfce7;
          border-color: #86efac;
        }

        .feedback-btn.negative:hover:not([disabled]) {
          background: #fee2e2;
          border-color: #fca5a5;
        }

        .feedback-btn.selected {
          opacity: 1;
        }

        .feedback-btn.selected.positive {
          background: #dcfce7;
          border-color: #22c55e;
          color: #166534;
        }

        .feedback-btn.selected.negative {
          background: #fee2e2;
          border-color: #ef4444;
          color: #991b1b;
        }

        .feedback-btn[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .feedback-thanks {
          font-size: 12px;
          color: #64748b;
          margin-top: 4px;
        }

        .bubble.user {
          align-self: flex-end;
          background: linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%);
          color: white;
          box-shadow: 0 2px 8px rgba(255, 107, 53, 0.2);
        }

        .bubble.assistant {
          align-self: flex-start;
          background: #f0f4f8;
          color: #1e293b;
          border-left: 3px solid #2563eb;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .bubble.error {
          align-self: flex-start;
          background: #ffe5e5;
          color: #7a1c1c;
        }

        .composer {
          padding: 12px 16px 16px;
          border-top: 1px solid #e3e7f0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        textarea {
          width: 100%;
          min-height: ${isExpanded ? "80px" : "56px"};
          resize: none;
          border: 1px solid #d9dfea;
          border-radius: 10px;
          padding: 10px;
          font-size: 14px;
          font-family: inherit;
          box-sizing: border-box;
        }

        textarea:focus {
          outline: none;
          border-color: #ff6b35;
          box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.15);
        }

        button.send {
          background: linear-gradient(135deg, #ff6b35 0%, #ff8c5a 100%);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 10px 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(255, 107, 53, 0.2);
        }

        button.send:hover:not([disabled]) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(255, 107, 53, 0.3);
        }

        button.send[disabled] {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .status {
          font-size: 12px;
          color: #5c6b8a;
        }

        .composer-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding: 40px 24px;
          text-align: center;
          color: #64748b;
        }

        .empty-state-icon {
          font-size: 56px;
          margin-bottom: 16px;
          filter: grayscale(20%);
        }

        .empty-state-title {
          font-size: 18px;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 8px;
        }

        .empty-state-text {
          font-size: 14px;
          line-height: 1.6;
          color: #64748b;
        }
      </style>

      <button class="launcher" aria-label="Abrir asistente">💬</button>

      <div class="panel" role="dialog" aria-live="polite">
        <div class="header">
          <span class="header-title">${this.title}</span>
          <div class="header-actions">
            <button class="header-btn expand-btn" aria-label="${isExpanded ? "Contraer" : "Expandir"}" title="${isExpanded ? "Contraer" : "Expandir"}">
              ${isExpanded ? "⊖" : "⊕"}
            </button>
            <button class="header-btn close-btn" aria-label="Cerrar" title="Cerrar">✕</button>
          </div>
        </div>
        ${
          messages.length === 0
            ? `
          <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <div class="empty-state-title">¡Hola! Soy tu asistente</div>
            <div class="empty-state-text">
              Estoy aquí para ayudarte con cualquier pregunta.<br>
              Escribe tu consulta abajo para comenzar.
            </div>
          </div>
        `
            : `
          <div class="messages">
          </div>
        `
        }
        <form class="composer">
          <textarea placeholder="${this.placeholder}"></textarea>
          <div class="composer-actions">
            <span class="status">Herramienta: ${this.toolName}</span>
            <button class="send" type="submit" ${isLoading ? "disabled" : ""}>
              ${isLoading ? "Enviando..." : "Enviar"}
            </button>
          </div>
        </form>
      </div>
    `;

    // Attach delegated event listeners once per component instance
    if (!this._eventListenersBound) {
      this.shadowRoot.addEventListener("click", this._handleShadowClick);
      this.shadowRoot.addEventListener("submit", this._handleShadowSubmit);
      this._eventListenersBound = true;
    }

    // Renderizar mensajes con markdown procesado
    if (messages.length > 0) {
      const messagesContainer = this.shadowRoot.querySelector(".messages");
      if (messagesContainer) {
        messagesContainer.innerHTML = messages
          .map((message) => {
            const content = message.role === 'user'
              ? this.escapeHtml(message.content)
              : this.renderMarkdown(message.content);

            // Para mensajes del asistente, agregar fuentes y botones de feedback
            if (message.role === 'assistant') {
              // Renderizar fuentes si existen
              const sources = message.metadata?.sources || [];
              const sourcesHtml = sources.length > 0
                ? `<div class="sources-section">
                    <div class="sources-title">📚 Fuentes consultadas</div>
                    ${sources.map(s => `<div class="source-item">${this.escapeHtml(s)}</div>`).join('')}
                  </div>`
                : '';

              const feedbackHtml = message.feedbackSent
                ? `<div class="feedback-thanks">✓ Gracias por tu feedback</div>`
                : `
                  <div class="feedback-buttons">
                    <button class="feedback-btn positive" data-msg-id="${message.id}" data-rating="positive" title="Respuesta útil">
                      👍 Útil
                    </button>
                    <button class="feedback-btn negative" data-msg-id="${message.id}" data-rating="negative" title="Respuesta no útil">
                      👎 No útil
                    </button>
                  </div>
                `;

              return `
                <div class="message-container assistant">
                  <div class="bubble assistant">${content}${sourcesHtml}</div>
                  ${feedbackHtml}
                </div>
              `;
            }

            return `
              <div class="message-container ${message.role}">
                <div class="bubble ${message.role}">${content}</div>
              </div>
            `;
          })
          .join("");
      }
      this.scrollToBottom();
    }
  }

  _handleShadowClick = (event) => {
    const launcher = event.target.closest(".launcher");
    if (launcher) {
      this.toggleOpen();
      return;
    }

    const expandBtn = event.target.closest(".expand-btn");
    if (expandBtn) {
      this.toggleExpanded();
      return;
    }

    const closeBtn = event.target.closest(".close-btn");
    if (closeBtn) {
      this.toggleOpen();
      return;
    }

    // Manejar clicks en botones de feedback
    const feedbackBtn = event.target.closest(".feedback-btn");
    if (feedbackBtn && !feedbackBtn.disabled) {
      const messageId = feedbackBtn.dataset.msgId;
      const rating = feedbackBtn.dataset.rating;
      this.sendFeedback(messageId, rating);
    }
  };

  _handleShadowSubmit = (event) => {
    const form = event.target;
    if (form && form.matches("form.composer")) {
      event.preventDefault();
      this.handleSubmit(event);
    }
  };
}

customElements.define("rag-assistant", RagAssistant);
