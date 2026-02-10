/**
 * AB Test Loader
 * Distribuye tráfico 50/50 entre las dos interfaces del widget
 * Tracking con Google Analytics / GTM
 */

class ABTestLoader {
  constructor(config = {}) {
    this.config = {
      variantA: config.variantA || './src/assistant-widget.js',
      variantB: config.variantB || './src/assistant-widget-v2.js',
      experimentName: config.experimentName || 'assistant_widget_ab_test',
      storageKey: config.storageKey || 'ab_test_variant',
      forceVariant: config.forceVariant || null, // Para testing manual: 'A' o 'B'
      ...config
    };

    this.variant = null;
    this.sessionId = null;
  }

  /**
   * Genera o recupera sessionID del sessionStorage
   */
  getSessionId() {
    if (!window.sessionStorage) {
      return this.generateUUID();
    }

    let sessionId = sessionStorage.getItem('ab_test_session_id');
    if (!sessionId) {
      sessionId = this.generateUUID();
      sessionStorage.setItem('ab_test_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Genera UUID v4 simple
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Hash simple para consistencia basada en sessionID
   */
  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Asigna variante basado en sessionID (50/50 split)
   */
  assignVariant() {
    // Si hay forzado manual (para testing)
    if (this.config.forceVariant) {
      this.variant = this.config.forceVariant;
      console.log(`[A/B Test] Variante forzada: ${this.variant}`);
      return this.variant;
    }

    // Chequear si ya tiene asignación en sessionStorage
    if (window.sessionStorage) {
      const stored = sessionStorage.getItem(this.config.storageKey);
      if (stored === 'A' || stored === 'B') {
        this.variant = stored;
        console.log(`[A/B Test] Variante desde sessionStorage: ${this.variant}`);
        return this.variant;
      }
    }

    // Asignar basado en hash del sessionID
    this.sessionId = this.getSessionId();
    const hash = this.hashCode(this.sessionId);
    this.variant = (hash % 2 === 0) ? 'A' : 'B';

    // Guardar en sessionStorage
    if (window.sessionStorage) {
      sessionStorage.setItem(this.config.storageKey, this.variant);
    }

    console.log(`[A/B Test] Nueva asignación - Session: ${this.sessionId.substring(0, 8)}..., Variante: ${this.variant}`);
    return this.variant;
  }

  /**
   * Carga el script correspondiente
   */
  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
    });
  }

  /**
   * Envía evento a Google Analytics / GTM
   */
  trackEvent(eventName, params = {}) {
    const eventData = {
      experiment_name: this.config.experimentName,
      variant: this.variant,
      session_id: this.sessionId,
      ...params
    };

    // Google Analytics 4 (gtag.js)
    if (window.gtag) {
      window.gtag('event', eventName, eventData);
      console.log(`[A/B Test] GA4 Event: ${eventName}`, eventData);
    }
    
    // Google Tag Manager (dataLayer)
    if (window.dataLayer) {
      window.dataLayer.push({
        event: eventName,
        ...eventData
      });
      console.log(`[A/B Test] GTM Event: ${eventName}`, eventData);
    }

    // Custom event para listeners externos
    window.dispatchEvent(new CustomEvent('ab_test_event', { 
      detail: { eventName, ...eventData }
    }));

    // Fallback: console log si no hay analytics
    if (!window.gtag && !window.dataLayer) {
      console.warn('[A/B Test] No analytics detected. Event:', eventName, eventData);
    }
  }

  /**
   * Inicializa el test A/B y carga la variante
   */
  async init() {
    try {
      // Asignar variante
      this.assignVariant();

      // Track asignación
      this.trackEvent('ab_test_variant_assigned', {
        timestamp: new Date().toISOString()
      });

      // Cargar script correspondiente
      const scriptSrc = this.variant === 'A' 
        ? this.config.variantA 
        : this.config.variantB;

      console.log(`[A/B Test] Cargando variante ${this.variant}: ${scriptSrc}`);
      await this.loadScript(scriptSrc);

      // Track carga exitosa
      this.trackEvent('ab_test_widget_loaded', {
        timestamp: new Date().toISOString(),
        widget_src: scriptSrc
      });

      console.log(`[A/B Test] Widget cargado exitosamente - Variante ${this.variant}`);
      return this.variant;

    } catch (error) {
      console.error('[A/B Test] Error al cargar widget:', error);
      
      // Track error
      this.trackEvent('ab_test_load_error', {
        error: error.message,
        variant: this.variant,
        timestamp: new Date().toISOString()
      });

      throw error;
    }
  }

  /**
   * Método para tracking de interacciones del usuario
   */
  trackInteraction(action, metadata = {}) {
    this.trackEvent('ab_test_user_interaction', {
      action,
      ...metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Obtener info de la variante actual
   */
  getVariantInfo() {
    return {
      variant: this.variant,
      sessionId: this.sessionId,
      experimentName: this.config.experimentName
    };
  }
}

// Exportar para uso global
window.ABTestLoader = ABTestLoader;
