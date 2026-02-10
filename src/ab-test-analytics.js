/**
 * AB Test Analytics - Extensión para enviar datos al backend
 * Complementa el tracking de GA4/GTM con almacenamiento en backend
 */

class ABTestAnalytics {
  constructor(abTestLoader, config = {}) {
    this.abTest = abTestLoader;
    this.config = {
      feedbackEndpoint: config.feedbackEndpoint || '/api/v2/feedback',
      analyticsEndpoint: config.analyticsEndpoint || '/api/v2/analytics/ab-test',
      enabled: config.enabled !== false,
      ...config
    };
  }

  /**
   * Envía evento de asignación de variante al backend
   */
  async trackVariantAssignment() {
    if (!this.config.enabled) return;

    const data = {
      event_type: 'ab_test_variant_assigned',
      experiment_name: this.abTest.config.experimentName,
      variant: this.abTest.variant,
      session_id: this.abTest.sessionId,
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`
    };

    return this._sendToBackend(data);
  }

  /**
   * Envía evento de interacción del usuario
   */
  async trackInteraction(action, metadata = {}) {
    if (!this.config.enabled) return;

    const data = {
      event_type: 'ab_test_user_interaction',
      experiment_name: this.abTest.config.experimentName,
      variant: this.abTest.variant,
      session_id: this.abTest.sessionId,
      action,
      metadata,
      timestamp: new Date().toISOString()
    };

    return this._sendToBackend(data);
  }

  /**
   * Envía feedback extendido con info de A/B test
   */
  async sendFeedback(messageId, rating, query, response) {
    if (!this.config.enabled) return;

    const feedbackData = {
      query,
      response,
      rating,
      session_id: this.abTest.sessionId,
      // Metadata de A/B test
      ab_test_variant: this.abTest.variant,
      ab_test_experiment: this.abTest.config.experimentName,
      timestamp: new Date().toISOString()
    };

    try {
      const res = await fetch(this.config.feedbackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData)
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      console.log(`[A/B Analytics] Feedback enviado - Variante ${this.abTest.variant}, Rating: ${rating}`);
      return await res.json();

    } catch (error) {
      console.error('[A/B Analytics] Error al enviar feedback:', error);
      throw error;
    }
  }

  /**
   * Track carga exitosa del widget
   */
  async trackWidgetLoaded(loadTime) {
    if (!this.config.enabled) return;

    const data = {
      event_type: 'ab_test_widget_loaded',
      experiment_name: this.abTest.config.experimentName,
      variant: this.abTest.variant,
      session_id: this.abTest.sessionId,
      load_time_ms: loadTime,
      widget_src: this.abTest.variant === 'A' 
        ? this.abTest.config.variantA 
        : this.abTest.config.variantB,
      timestamp: new Date().toISOString()
    };

    return this._sendToBackend(data);
  }

  /**
   * Track error de carga
   */
  async trackLoadError(error) {
    if (!this.config.enabled) return;

    const data = {
      event_type: 'ab_test_load_error',
      experiment_name: this.abTest.config.experimentName,
      variant: this.abTest.variant,
      session_id: this.abTest.sessionId,
      error: error.message,
      timestamp: new Date().toISOString()
    };

    return this._sendToBackend(data);
  }

  /**
   * Envía datos al endpoint de analytics del backend
   */
  async _sendToBackend(data) {
    try {
      const response = await fetch(this.config.analyticsEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log('[A/B Analytics] Evento enviado al backend:', data.event_type);
      return await response.json();

    } catch (error) {
      console.warn('[A/B Analytics] No se pudo enviar al backend (continuando con GA/GTM):', error.message);
      // No lanzamos error - fallback a solo GA/GTM
      return null;
    }
  }

  /**
   * Envía batch de eventos al finalizar sesión
   */
  async flushEvents(events) {
    if (!this.config.enabled || !events.length) return;

    const data = {
      event_type: 'ab_test_session_summary',
      experiment_name: this.abTest.config.experimentName,
      variant: this.abTest.variant,
      session_id: this.abTest.sessionId,
      events,
      timestamp: new Date().toISOString()
    };

    return this._sendToBackend(data);
  }
}

// Exportar para uso global
window.ABTestAnalytics = ABTestAnalytics;
