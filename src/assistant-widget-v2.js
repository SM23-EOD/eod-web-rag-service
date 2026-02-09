class RagAssistantV2 extends HTMLElement {
  static get observedAttributes() {
    return [
      "endpoint",
      "title",
      "tool-name",
      "session-id",
      "include-sources",
      "placeholder",
      "position",
      "theme-color",
    ];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = {
      isOpen: false,
      isMinimized: false,
      isLoading: false,
      messages: [],
      unreadCount: 0,
    };
    this._conversations = [];
  }

  connectedCallback() {
    this.render();
    this._setupKeyboardShortcuts();
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._keyHandler);
  }

  attributeChangedCallback() {
    this.render();
  }

  get endpoint() {
    return this.getAttribute("endpoint") || "/api/v2/mcp/tools/call";
  }

  get title() {
    return this.getAttribute("title") || "Asistente Virtual";
  }

  get toolName() {
    return this.getAttribute("tool-name") || "generate_rag_answer";
  }

  get sessionId() {
    return this.getAttribute("session-id") || "web";
  }

  get includeSources() {
    const raw = this.getAttribute("include-sources");
    if (raw === null) return true;
    return raw !== "false";
  }

  get placeholder() {
    return this.getAttribute("placeholder") || "Escribe tu mensaje...";
  }

  get position() {
    return this.getAttribute("position") || "bottom-right"; // bottom-right, bottom-left
  }

  get themeColor() {
    return this.getAttribute("theme-color") || "#2563eb";
  }

  setState(nextState) {
    this.state = { ...this.state, ...nextState };
    this.render();
  }

  addMessage(role, content, metadata = {}) {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.setState({
      messages: [...this.state.messages, { 
        id: messageId, 
        role, 
        content, 
        metadata, 
        feedbackSent: false,
        timestamp: new Date().toISOString(),
      }],
      unreadCount: !this.state.isOpen ? this.state.unreadCount + 1 : 0,
    });
    setTimeout(() => this.scrollToBottom(), 100);
    return messageId;
  }

  scrollToBottom() {
    const messagesContainer = this.shadowRoot.querySelector(".chat-messages");
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  _setupKeyboardShortcuts() {
    this._keyHandler = (e) => {
      // Esc para cerrar
      if (e.key === 'Escape' && this.state.isOpen) {
        this.toggleOpen();
      }
      // Ctrl/Cmd + K para abrir
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.toggleOpen();
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  async sendFeedback(messageId, rating) {
    const conversation = this._conversations.find(c => c.messageId === messageId);
    if (!conversation) {
      console.error('No se encontró la conversación para feedback');
      return;
    }

    // Feedback stays on /api/v1 (not an MCP route)
    const feedbackEndpoint = this.endpoint
      .replace(/\/api\/v2\/mcp\/tools\/call$/, '/api/v1/feedback')
      .replace(/\/api\/v1\/mcp\/tools\/call$/, '/api/v1/feedback');

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
    if (typeof marked !== 'undefined') {
      try {
        return marked.parse(text);
      } catch (e) {
        console.error('Error al renderizar markdown:', e);
        return this.escapeHtml(text);
      }
    }
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
    this.setState({ 
      isOpen: !this.state.isOpen,
      unreadCount: 0,
    });
    if (this.state.isOpen) {
      setTimeout(() => {
        const textarea = this.shadowRoot.querySelector("textarea");
        if (textarea) textarea.focus();
      }, 100);
    }
  }

  toggleMinimize() {
    this.setState({ isMinimized: !this.state.isMinimized });
  }

  clearChat() {
    if (confirm('¿Estás seguro de que deseas limpiar el chat?')) {
      this.setState({ messages: [], unreadCount: 0 });
      this._conversations = [];
    }
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

      let responseText = data.result || "Sin respuesta.";

      // Extraer fuentes
      let extractedSources = [];
      const sourcesMatch = responseText.match(/###\s*📚?\s*Fuentes[\s\S]*?(?=###|$)/);
      if (sourcesMatch) {
        const sourcesSection = sourcesMatch[0];
        const sourceLines = sourcesSection.match(/[-•*]\s*(.+?)(?:\n|$)/g);
        if (sourceLines) {
          extractedSources = sourceLines.map(line => 
            line.replace(/^[-•*]\s*/, '').trim()
          ).filter(s => s.length > 0);
        }
      }

      if (data.sources && Array.isArray(data.sources)) {
        const namedSources = data.sources.map(s => this.getSourceDisplayName(s));
        extractedSources = [...extractedSources, ...namedSources];
      }

      // Deduplicar fuentes
      extractedSources = [...new Set(extractedSources)];

      // Limpiar metadata y fuentes
      const cleanPatterns = [
        /\n\n###\s*📚\s*Fuentes[\s\S]*$/,
        /\n\n###\s*📊\s*Metadata[\s\S]*$/,
        /\n\n###\s*Fuentes[\s\S]*$/,
        /\n\n###\s*Metadata[\s\S]*$/,
        /^##\s*Respuesta\s*\n+/,
      ];

      cleanPatterns.forEach(pattern => {
        responseText = responseText.replace(pattern, '');
      });

      responseText = responseText.trim();

      const confidence = data.confidence || null;

      const msgId = this.addMessage("assistant", responseText, { 
        confidence, 
        sources: extractedSources 
      });

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
    const { isOpen, isMinimized, messages, isLoading, unreadCount } = this.state;
    const themeColor = this.themeColor;
    const position = this.position;
    
    // Determinar posicionamiento
    const positionStyles = position === 'bottom-left' 
      ? 'left: 20px; right: auto;'
      : 'right: 20px; left: auto;';

    const containerHeight = isMinimized ? '60px' : '600px';

    this.shadowRoot.innerHTML = `
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :host {
          position: fixed;
          bottom: 20px;
          ${positionStyles}
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
          z-index: 2147483647;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Botón flotante de lanzamiento */
        .launcher-button {
          position: relative;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${themeColor} 0%, ${this._adjustColor(themeColor, 20)} 100%);
          border: none;
          cursor: pointer;
          display: ${isOpen ? 'none' : 'flex'};
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
          color: white;
          font-size: 26px;
          animation: pulse 2s infinite;
        }

        .launcher-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.2), 0 3px 10px rgba(0, 0, 0, 0.15);
        }

        .launcher-button:active {
          transform: scale(0.95);
        }

        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
          }
          50% {
            box-shadow: 0 4px 24px ${this._hexToRgba(themeColor, 0.4)}, 0 2px 8px rgba(0, 0, 0, 0.1);
          }
        }

        .unread-badge {
          position: absolute;
          top: -4px;
          right: -4px;
          background: #ef4444;
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: ${unreadCount > 0 ? 'flex' : 'none'};
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          border: 2px solid white;
          animation: bounce 0.5s ease;
        }

        @keyframes bounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }

        /* Contenedor principal del chat */
        .chat-container {
          width: 400px;
          max-width: calc(100vw - 40px);
          height: ${containerHeight};
          max-height: calc(100vh - 120px);
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.18), 0 4px 16px rgba(0, 0, 0, 0.12);
          display: ${isOpen ? 'flex' : 'none'};
          flex-direction: column;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* Header del chat */
        .chat-header {
          background: linear-gradient(135deg, ${themeColor} 0%, ${this._adjustColor(themeColor, 20)} 100%);
          color: white;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .chat-header-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .chat-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }

        .chat-title-section {
          flex: 1;
        }

        .chat-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 2px;
        }

        .chat-status {
          font-size: 12px;
          opacity: 0.9;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          animation: blink 2s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .chat-actions {
          display: flex;
          gap: 8px;
        }

        .header-button {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.15);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          transition: all 0.2s ease;
        }

        .header-button:hover {
          background: rgba(255, 255, 255, 0.25);
          transform: scale(1.05);
        }

        .header-button:active {
          transform: scale(0.95);
        }

        /* Mensajes del chat */
        .chat-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: #f9fafb;
          display: ${isMinimized ? 'none' : 'flex'};
          flex-direction: column;
          gap: 16px;
        }

        .chat-messages::-webkit-scrollbar {
          width: 6px;
        }

        .chat-messages::-webkit-scrollbar-track {
          background: transparent;
        }

        .chat-messages::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }

        .chat-messages::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }

        /* Estado vacío */
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding: 40px 20px;
          text-align: center;
        }

        .empty-state-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.6;
          animation: float 3s ease-in-out infinite;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .empty-state-title {
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 8px;
        }

        .empty-state-text {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.6;
          max-width: 280px;
        }

        .empty-state-suggestions {
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          max-width: 300px;
        }

        .suggestion-button {
          padding: 12px 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          color: #374151;
          text-align: left;
          transition: all 0.2s ease;
        }

        .suggestion-button:hover {
          background: ${themeColor};
          color: white;
          border-color: ${themeColor};
          transform: translateX(4px);
        }

        /* Mensajes */
        .message-container {
          display: flex;
          gap: 12px;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message-container.user {
          flex-direction: row-reverse;
        }

        .message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        .message-container.user .message-avatar {
          background: linear-gradient(135deg, ${themeColor} 0%, ${this._adjustColor(themeColor, 20)} 100%);
          color: white;
        }

        .message-container.assistant .message-avatar {
          background: #e5e7eb;
        }

        .message-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .message-bubble {
          padding: 12px 16px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.6;
          word-wrap: break-word;
        }

        .message-container.user .message-bubble {
          background: linear-gradient(135deg, ${themeColor} 0%, ${this._adjustColor(themeColor, 20)} 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .message-container.assistant .message-bubble {
          background: white;
          color: #1f2937;
          border: 1px solid #e5e7eb;
          border-bottom-left-radius: 4px;
        }

        .message-container.error .message-bubble {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        /* Estilos de contenido markdown */
        .message-bubble p {
          margin: 0 0 8px 0;
        }

        .message-bubble p:last-child {
          margin-bottom: 0;
        }

        .message-bubble ul, .message-bubble ol {
          margin: 8px 0;
          padding-left: 20px;
        }

        .message-bubble li {
          margin: 4px 0;
        }

        .message-bubble code {
          background: rgba(0, 0, 0, 0.05);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 13px;
          font-family: 'Monaco', 'Courier New', monospace;
        }

        .message-container.user .message-bubble code {
          background: rgba(255, 255, 255, 0.2);
        }

        .message-bubble pre {
          background: #1f2937;
          color: #e5e7eb;
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 8px 0;
        }

        .message-bubble pre code {
          background: none;
          padding: 0;
          color: inherit;
        }

        .message-bubble a {
          color: ${themeColor};
          text-decoration: underline;
        }

        .message-container.user .message-bubble a {
          color: white;
        }

        /* Fuentes */
        .message-sources {
          padding: 10px 12px;
          background: #f0f9ff;
          border-left: 3px solid ${themeColor};
          border-radius: 8px;
          font-size: 12px;
        }

        .sources-title {
          font-weight: 600;
          color: ${themeColor};
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .source-item {
          color: #475569;
          padding: 3px 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .source-item::before {
          content: '📄';
          font-size: 11px;
        }

        /* Feedback */
        .message-feedback {
          display: flex;
          gap: 6px;
          margin-top: 4px;
        }

        .feedback-button {
          padding: 6px 12px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.2s ease;
        }

        .feedback-button:hover:not([disabled]) {
          background: #f9fafb;
          border-color: #d1d5db;
        }

        .feedback-button.positive:hover:not([disabled]) {
          background: #ecfdf5;
          border-color: #10b981;
          color: #065f46;
        }

        .feedback-button.negative:hover:not([disabled]) {
          background: #fef2f2;
          border-color: #ef4444;
          color: #991b1b;
        }

        .feedback-button.selected.positive {
          background: #ecfdf5;
          border-color: #10b981;
          color: #065f46;
        }

        .feedback-button.selected.negative {
          background: #fef2f2;
          border-color: #ef4444;
          color: #991b1b;
        }

        .feedback-button[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .feedback-thanks {
          font-size: 12px;
          color: #6b7280;
          padding: 4px 0;
        }

        .message-timestamp {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 4px;
        }

        /* Input del chat */
        .chat-input {
          padding: 16px 20px;
          border-top: 1px solid #e5e7eb;
          background: white;
          display: ${isMinimized ? 'none' : 'flex'};
          flex-direction: column;
          gap: 12px;
        }

        .input-wrapper {
          display: flex;
          gap: 10px;
          align-items: flex-end;
        }

        textarea {
          flex: 1;
          min-height: 44px;
          max-height: 120px;
          padding: 12px 14px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          font-size: 14px;
          font-family: inherit;
          resize: none;
          transition: all 0.2s ease;
        }

        textarea:focus {
          outline: none;
          border-color: ${themeColor};
          box-shadow: 0 0 0 3px ${this._hexToRgba(themeColor, 0.1)};
        }

        textarea::placeholder {
          color: #9ca3af;
        }

        .send-button {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, ${themeColor} 0%, ${this._adjustColor(themeColor, 20)} 100%);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .send-button:hover:not([disabled]) {
          transform: scale(1.05);
          box-shadow: 0 4px 12px ${this._hexToRgba(themeColor, 0.3)};
        }

        .send-button:active:not([disabled]) {
          transform: scale(0.95);
        }

        .send-button[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .input-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #9ca3af;
        }

        .input-hint {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .powered-by {
          opacity: 0.7;
        }

        /* Indicador de escritura */
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          border-bottom-left-radius: 4px;
          width: fit-content;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #9ca3af;
          animation: typing 1.4s infinite;
        }

        .typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.7;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }

        /* Responsive */
        @media (max-width: 480px) {
          :host {
            bottom: 10px;
            ${position === 'bottom-left' ? 'left: 10px;' : 'right: 10px;'}
          }

          .chat-container {
            width: calc(100vw - 20px);
            max-height: calc(100vh - 20px);
          }

          .launcher-button {
            width: 56px;
            height: 56px;
          }
        }
      </style>

      <!-- Botón de lanzamiento -->
      <button class="launcher-button" aria-label="Abrir asistente" title="Abrir chat (Ctrl+K)">
        💬
        <span class="unread-badge">${unreadCount}</span>
      </button>

      <!-- Contenedor del chat -->
      <div class="chat-container" role="dialog" aria-label="${this.title}">
        <!-- Header -->
        <div class="chat-header">
          <div class="chat-header-content">
            <div class="chat-avatar">🤖</div>
            <div class="chat-title-section">
              <div class="chat-title">${this.title}</div>
              <div class="chat-status">
                <span class="status-dot"></span>
                <span>En línea</span>
              </div>
            </div>
          </div>
          <div class="chat-actions">
            <button class="header-button clear-btn" title="Limpiar chat" aria-label="Limpiar chat">
              🗑️
            </button>
            <button class="header-button minimize-btn" title="${isMinimized ? 'Maximizar' : 'Minimizar'}" aria-label="${isMinimized ? 'Maximizar' : 'Minimizar'}">
              ${isMinimized ? '🔼' : '🔽'}
            </button>
            <button class="header-button close-btn" title="Cerrar (Esc)" aria-label="Cerrar chat">
              ✕
            </button>
          </div>
        </div>

        <!-- Mensajes -->
        <div class="chat-messages">
          ${messages.length === 0 ? this._renderEmptyState() : ''}
        </div>

        <!-- Input -->
        <form class="chat-input">
          <div class="input-wrapper">
            <textarea 
              placeholder="${this.placeholder}" 
              rows="1"
              aria-label="Escribe tu mensaje"
            ></textarea>
            <button 
              class="send-button" 
              type="submit" 
              ${isLoading ? 'disabled' : ''}
              aria-label="Enviar mensaje"
            >
              ${isLoading ? '⏳' : '➤'}
            </button>
          </div>
          <div class="input-footer">
            <span class="input-hint">
              <span>Presiona Enter para enviar</span>
            </span>
            <span class="powered-by">Herramienta: ${this.toolName}</span>
          </div>
        </form>
      </div>
    `;

    // Attach event listeners
    if (!this._eventListenersBound) {
      this.shadowRoot.addEventListener("click", this._handleClick);
      this.shadowRoot.addEventListener("submit", this._handleSubmit);
      this._eventListenersBound = true;
    }

    // Auto-resize textarea
    const textarea = this.shadowRoot.querySelector("textarea");
    if (textarea) {
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      });
    }

    // Renderizar mensajes
    if (messages.length > 0) {
      const messagesContainer = this.shadowRoot.querySelector(".chat-messages");
      if (messagesContainer) {
        messagesContainer.innerHTML = messages.map(msg => this._renderMessage(msg)).join('');
        
        // Agregar indicador de escritura si está cargando
        if (isLoading) {
          const typingIndicator = document.createElement('div');
          typingIndicator.className = 'message-container assistant';
          typingIndicator.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="typing-indicator">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>
          `;
          messagesContainer.appendChild(typingIndicator);
        }
      }
      this.scrollToBottom();
    }
  }

  _renderEmptyState() {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <div class="empty-state-title">¡Hola! Soy tu ${this.title}</div>
        <div class="empty-state-text">
          Estoy aquí para ayudarte con tus preguntas. Puedes preguntarme lo que necesites.
        </div>
        <div class="empty-state-suggestions">
          <button class="suggestion-button" data-suggestion="¿Cómo puedo rastrear mi envío?">
            📦 ¿Cómo puedo rastrear mi envío?
          </button>
          <button class="suggestion-button" data-suggestion="¿Qué opciones de envío tienen y cuánto tardan?">
            🚚 ¿Qué opciones de envío tienen y cuánto tardan?
          </button>
          <button class="suggestion-button" data-suggestion="¿Qué hago si mi paquete no llegó?">
            🔍 ¿Qué hago si mi paquete no llegó?
          </button>
        </div>
      </div>
    `;
  }

  _renderMessage(message) {
    const content = message.role === 'user'
      ? this.escapeHtml(message.content)
      : this.renderMarkdown(message.content);

    const timestamp = new Date(message.timestamp).toLocaleTimeString('es', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Renderizar fuentes
    const sources = message.metadata?.sources || [];
    const sourcesHtml = sources.length > 0
      ? `<div class="message-sources">
          <div class="sources-title">📚 Fuentes consultadas</div>
          ${sources.map(s => `<div class="source-item">${this.escapeHtml(s)}</div>`).join('')}
        </div>`
      : '';

    // Renderizar feedback
    const feedbackHtml = message.role === 'assistant'
      ? (message.feedbackSent
        ? `<div class="feedback-thanks">✓ Gracias por tu feedback</div>`
        : `<div class="message-feedback">
            <button class="feedback-button positive" data-msg-id="${message.id}" data-rating="positive">
              👍 Útil
            </button>
            <button class="feedback-button negative" data-msg-id="${message.id}" data-rating="negative">
              👎 No útil
            </button>
          </div>`)
      : '';

    const avatar = message.role === 'user' ? '👤' : 
                   message.role === 'error' ? '⚠️' : '🤖';

    return `
      <div class="message-container ${message.role}">
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
          <div class="message-bubble">${content}</div>
          ${sourcesHtml}
          ${feedbackHtml}
          <div class="message-timestamp">${timestamp}</div>
        </div>
      </div>
    `;
  }

  _handleClick = (event) => {
    const launcher = event.target.closest(".launcher-button");
    if (launcher) {
      this.toggleOpen();
      return;
    }

    const closeBtn = event.target.closest(".close-btn");
    if (closeBtn) {
      this.toggleOpen();
      return;
    }

    const minimizeBtn = event.target.closest(".minimize-btn");
    if (minimizeBtn) {
      this.toggleMinimize();
      return;
    }

    const clearBtn = event.target.closest(".clear-btn");
    if (clearBtn) {
      this.clearChat();
      return;
    }

    // Sugerencias
    const suggestion = event.target.closest(".suggestion-button");
    if (suggestion) {
      const text = suggestion.dataset.suggestion;
      const textarea = this.shadowRoot.querySelector("textarea");
      if (textarea) {
        textarea.value = text;
        textarea.focus();
      }
      return;
    }

    // Feedback
    const feedbackBtn = event.target.closest(".feedback-button");
    if (feedbackBtn && !feedbackBtn.disabled) {
      const messageId = feedbackBtn.dataset.msgId;
      const rating = feedbackBtn.dataset.rating;
      this.sendFeedback(messageId, rating);
    }
  };

  _handleSubmit = (event) => {
    const form = event.target;
    if (form && form.matches("form.chat-input")) {
      event.preventDefault();
      this.handleSubmit(event);
    }
  };

  // Utilidades de color
  _adjustColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  }

  _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

customElements.define("rag-assistant-v2", RagAssistantV2);
