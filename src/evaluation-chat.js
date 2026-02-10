/**
 * EvaluationChat - Motor del chat de evaluación para entrenamiento del asistente IA.
 * Inspirado en chat.virtualurbe.info, adaptado al proyecto eod-web-rag-service.
 * 
 * Se comunica con el mismo endpoint MCP que el widget principal.
 */
class EvaluationChat {
  constructor(options = {}) {
    this.config = {
      endpoint: options.endpoint || 'http://167.172.225.44/api/v2/mcp/tools/call',
      feedbackEndpoint: options.feedbackEndpoint || 'http://167.172.225.44/api/v2/feedback',
      toolName: options.toolName || 'generate_rag_answer',
      sessionId: options.sessionId || 'eval-' + Date.now() + Math.random().toString(36).substr(2, 5),
      includeSources: options.includeSources !== undefined ? options.includeSources : true,
      trainingMode: options.trainingMode !== undefined ? options.trainingMode : true,
    };

    this.messages = [];
    this.messageCount = 0;
    this.isLoading = false;
    this.conversationLog = []; // For training/evaluation tracking
    this.stats = this._loadStats();

    // Callbacks
    this.onMessage = options.onMessage || null;
    this.onLoading = options.onLoading || null;
    this.onError = options.onError || null;
    this.onStatsUpdate = options.onStatsUpdate || null;
  }

  _loadStats() {
    try {
      const saved = localStorage.getItem('evalChatStats');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return {
      totalConversations: 0,
      totalMessages: 0,
      correctResponses: 0,
      incorrectResponses: 0,
      ratings: [],
      sessions: [],
    };
  }

  _saveStats() {
    try {
      localStorage.setItem('evalChatStats', JSON.stringify(this.stats));
    } catch (e) { /* ignore */ }
  }

  _saveSession() {
    try {
      const sessions = JSON.parse(localStorage.getItem('evalChatSessions') || '[]');
      const session = {
        id: this.config.sessionId,
        messages: this.messages,
        log: this.conversationLog,
        timestamp: new Date().toISOString(),
        trainingMode: this.config.trainingMode,
      };
      sessions.unshift(session);
      // Keep only last 100 sessions
      if (sessions.length > 100) sessions.length = 100;
      localStorage.setItem('evalChatSessions', JSON.stringify(sessions));
    } catch (e) { /* ignore */ }
  }

  getSessionId() {
    return this.config.sessionId;
  }

  getMessageCount() {
    return this.messageCount;
  }

  getStats() {
    return { ...this.stats };
  }

  setTrainingMode(enabled) {
    this.config.trainingMode = enabled;
  }

  async sendMessage(text) {
    if (!text.trim() || this.isLoading) return null;

    this.isLoading = true;
    if (this.onLoading) this.onLoading(true);

    const userMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    this.messages.push(userMessage);
    this.messageCount++;

    if (this.onMessage) this.onMessage(userMessage);

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool_name: this.config.toolName,
          arguments: {
            query: text.trim(),
            include_sources: this.config.includeSources,
          },
          session_id: this.config.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Error desconocido del servidor');
      }

      let responseText = data.result || 'Sin respuesta.';
      let extractedSources = [];
      const confidence = data.confidence || null;

      // Extract sources from text
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

      // Extract sources from data
      if (data.sources && Array.isArray(data.sources)) {
        const namedSources = data.sources.map(s => {
          if (typeof s === 'string') return s;
          if (s && typeof s === 'object') {
            const fields = ['source_name', 'name', 'title', 'document_name', 'source', 'filename'];
            for (const f of fields) {
              if (s[f] && typeof s[f] === 'string') return s[f];
            }
          }
          return String(s);
        });
        extractedSources = [...extractedSources, ...namedSources];
      }

      // Deduplicate
      extractedSources = [...new Set(extractedSources)];

      // Clean response text
      responseText = responseText
        .replace(/\n\n###\s*📚?\s*Fuentes[\s\S]*$/i, '')
        .replace(/\n\n###\s*📊?\s*Metadata[\s\S]*$/i, '')
        .replace(/^##\s*Respuesta\s*\n+/, '')
        .trim();

      const assistantMessage = {
        id: `msg-${Date.now()}-resp`,
        role: 'assistant',
        content: responseText,
        sources: extractedSources,
        confidence: confidence,
        timestamp: new Date().toISOString(),
        feedback: null, // null = no feedback, 'correct' | 'incorrect'
        rating: null,   // 1-5
      };

      this.messages.push(assistantMessage);
      this.messageCount++;

      // Track conversation for evaluation
      this.conversationLog.push({
        query: text.trim(),
        response: responseText,
        sources: extractedSources,
        confidence: confidence,
        messageId: assistantMessage.id,
        timestamp: assistantMessage.timestamp,
      });

      // Update stats
      this.stats.totalMessages += 2;
      this._saveStats();

      if (this.onMessage) this.onMessage(assistantMessage);

      return assistantMessage;
    } catch (error) {
      const errorMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'error',
        content: `Error: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
      this.messages.push(errorMessage);

      if (this.onError) this.onError(error);
      if (this.onMessage) this.onMessage(errorMessage);

      return errorMessage;
    } finally {
      this.isLoading = false;
      if (this.onLoading) this.onLoading(false);
    }
  }

  async sendFeedback(messageId, feedbackType, rating = null) {
    const message = this.messages.find(m => m.id === messageId);
    if (!message || message.role !== 'assistant') return false;

    const logEntry = this.conversationLog.find(l => l.messageId === messageId);
    if (!logEntry) return false;

    // Update local state
    message.feedback = feedbackType;
    if (rating !== null) message.rating = rating;

    // Update stats
    if (feedbackType === 'correct') {
      this.stats.correctResponses++;
    } else if (feedbackType === 'incorrect') {
      this.stats.incorrectResponses++;
    }
    if (rating !== null) {
      this.stats.ratings.push(rating);
    }
    this._saveStats();

    if (this.onStatsUpdate) this.onStatsUpdate(this.stats);

    // Send to backend
    try {
      const response = await fetch(this.config.feedbackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: logEntry.query,
          response: logEntry.response,
          rating: feedbackType === 'correct' ? 'positive' : 'negative',
          confidence: logEntry.confidence,
          session_id: this.config.sessionId,
          training_mode: this.config.trainingMode,
        }),
      });

      if (!response.ok) {
        console.warn('Feedback API returned', response.status);
      }
    } catch (error) {
      console.error('Error enviando feedback:', error);
    }

    return true;
  }

  clearMessages() {
    this.messages = [];
    this.messageCount = 0;
    this.conversationLog = [];
  }

  saveCurrentSession() {
    this.stats.totalConversations++;
    this._saveStats();
    this._saveSession();
    if (this.onStatsUpdate) this.onStatsUpdate(this.stats);
  }

  getSavedSessions() {
    try {
      return JSON.parse(localStorage.getItem('evalChatSessions') || '[]');
    } catch (e) {
      return [];
    }
  }

  exportData() {
    return {
      config: { ...this.config },
      messages: [...this.messages],
      conversationLog: [...this.conversationLog],
      stats: { ...this.stats },
      exportedAt: new Date().toISOString(),
    };
  }

  resetStats() {
    this.stats = {
      totalConversations: 0,
      totalMessages: 0,
      correctResponses: 0,
      incorrectResponses: 0,
      ratings: [],
      sessions: [],
    };
    this._saveStats();
    if (this.onStatsUpdate) this.onStatsUpdate(this.stats);
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EvaluationChat;
}
