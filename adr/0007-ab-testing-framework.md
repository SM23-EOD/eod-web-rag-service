# ADR-0007: A/B Testing Framework para Comparación de Interfaces

**Fecha**: 2026-02-10  
**Estado**: ✅ Aceptado  
**Autores**: EOD Dev Team  
**Decisión clave**: Implementar framework A/B testing para comparar dos interfaces del widget

---

## Contexto y Problema

El proyecto cuenta con dos implementaciones diferentes del widget asistente:

1. **Variante A** (`assistant-widget.js`): Interfaz original con diseño clásico
2. **Variante B** (`assistant-widget-v2.js`): Interfaz nueva con mejoras de UX y diseño moderno

### Problema

No existía una forma objetiva y basada en datos para:
- Comparar el rendimiento de ambas interfaces
- Medir engagement y satisfacción del usuario  
- Tomar decisiones informadas sobre cuál interfaz desplegar en producción
- Validar hipótesis de mejora de la nueva versión

### Requisitos Funcionales

- Distribución controlada y consistente del tráfico (50/50)
- Tracking de eventos de usuario para análisis
- Capacidad de forzar variantes para testing manual
- Persistencia de la variante durante la sesión del usuario
- Sin impacto en el rendimiento percibido

### Requisitos No Funcionales

- Zero dependencies (standalone)
- Compatibilidad con navegadores modernos
- Integración con analytics existentes (GA4/GTM)
- Fácil de integrar en páginas existentes
- Debugging amigable para developers

---

## Decisión

Implementamos un **framework A/B testing client-side** con las siguientes características:

### 1. Sistema de Asignación de Variantes

**Algoritmo**: Hash determinístico basado en Session ID

```javascript
sessionId = generateUUID() // Una vez por sesión
hash = hashCode(sessionId)
variant = (hash % 2 === 0) ? 'A' : 'B'
```

**Justificación**:
- ✅ Distribución uniforme (50/50)
- ✅ Consistencia: mismo usuario = misma variante durante toda la sesión
- ✅ No requiere backend
- ✅ Fácil de testear y validar

### 2. Arquitectura del Loader

```
ABTestLoader (clase standalone)
├── Session Management (UUID + sessionStorage)
├── Variant Assignment (hash-based)
├── Script Loading (dynamic script injection)
└── Event Tracking (GA4/GTM integration)
```

### 3. Integración con Analytics

**Eventos trackeados**:

| Evento | Momento | Datos |
|--------|---------|-------|
| `ab_test_variant_assigned` | Al asignar variante | experiment_name, variant, session_id |
| `ab_test_widget_loaded` | Widget cargado exitosamente | variant, widget_src |
| `ab_test_load_error` | Error al cargar widget | variant, error |
| `ab_test_user_interaction` | Interacciones custom | variant, action, metadata |

**Compatibilidad**:
- Google Analytics 4 (gtag.js)
- Google Tag Manager (dataLayer)
- Custom Events (addEventListener)

### 4. Estructura de Archivos

```
/src/ab-test-loader.js           # Clase principal (standalone)
/ab-test.html                     # Demo interactiva
/ab-test-tests.html               # Suite de tests unitarios
/AB-TEST-README.md                # Documentación completa
/gtm-config-ab-test.json          # Configuración GTM exportable
/test-ab.sh                       # Script de testing local
```

---

## Alternativas Consideradas

### Opción 1: A/B Testing Server-Side
**Pros**: Control centralizado, no expone lógica al cliente  
**Contras**: Requiere backend, mayor latencia, más complejo  
**Razón de descarte**: Overhead innecesario para este caso de uso

### Opción 2: Usar Servicio Externo (Optimizely, VWO)
**Pros**: Features avanzadas, reportes visuales  
**Contras**: Costo, vendor lock-in, dependencia externa  
**Razón de descarte**: Overkill para comparar 2 variantes simples

### Opción 3: Feature Flags (LaunchDarkly)
**Pros**: Control fino, targeting avanzado  
**Contras**: Costo, complejidad de setup  
**Razón de descarte**: Solo necesitamos distribución 50/50 simple

### Opción 4: Split basado en Cookie
**Pros**: Persistencia cross-session  
**Contras**: Requiere consentimiento GDPR, más complejo  
**Razón de descarte**: sessionStorage es suficiente para esta prueba

---

## Consecuencias

### ✅ Positivas

1. **Data-Driven Decisions**: Podemos medir objetivamente qué interfaz funciona mejor
2. **Zero Dependencies**: No añade peso al bundle, no requiere npm packages
3. **Portable**: Fácil de integrar en cualquier página HTML
4. **Debuggable**: Logs detallados en consola, página de demo interactiva
5. **Testeable**: Suite de tests unitarios incluida
6. **Flexible**: Control manual para QA y desarrollo

### ⚠️ Trade-offs

1. **Client-Side Only**: Los usuarios pueden ver el código y forzar variantes (aceptable para este caso)
2. **Requiere Analytics**: Sin GA4/GTM, solo hay console.log (mitigado con custom events)
3. **Sin Targeting Avanzado**: No hay segmentación por geo, device, etc. (no requerido ahora)

### ⏳ Acciones de Seguimiento

1. **Configurar GTM en producción** con el config provisto
2. **Definir métricas de éxito** (ej: engagement rate, time-to-first-message, completion rate)
3. **Ejecutar test durante 2 semanas** mínimo para recolectar datos significativos
4. **Análisis estadístico** de resultados (chi-cuadrado test)
5. **Decisión final** sobre cuál interfaz desplegar

---

## Ejemplos de Uso

### Integración Básica

```html
<script src="./src/ab-test-loader.js"></script>
<script>
  const abTest = new ABTestLoader({
    variantA: './src/assistant-widget.js',
    variantB: './src/assistant-widget-v2.js',
    experimentName: 'assistant_widget_ab_test_v1'
  });
  
  abTest.init();
</script>
```

### Tracking Custom

```javascript
// Track cuando el usuario envía un mensaje
abTest.trackInteraction('message_sent', {
  message_length: messageText.length,
  has_attachments: false
});

// Track cuando el usuario da feedback
abTest.trackInteraction('feedback_submitted', {
  rating: 5,
  feedback_type: 'positive'
});
```

### Testing Manual

```javascript
// Forzar variante A
const abTest = new ABTestLoader({ forceVariant: 'A' });

// Limpiar sesión
sessionStorage.clear();
location.reload();
```

---

## Métricas de Éxito del Experimento

Una vez ejecutado el test, evaluaremos:

| Métrica | Variante A | Variante B | Ganador |
|---------|-----------|-----------|---------|
| **CTR inicial** (% que abre widget) | TBD | TBD | TBD |
| **Engagement** (mensajes enviados por usuario) | TBD | TBD | TBD |
| **Tiempo promedio de sesión** | TBD | TBD | TBD |
| **Tasa de completación** (interacciones completas) | TBD | TBD | TBD |
| **Error rate** (fallos al cargar/usar) | TBD | TBD | TBD |

**Tamaño de muestra objetivo**: >1000 usuarios únicos por variante  
**Duración mínima**: 14 días  
**Significancia estadística**: p < 0.05

---

## Referencias

- [AB-TEST-README.md](../AB-TEST-README.md) - Documentación completa del framework
- [Best Practices for A/B Testing](https://www.optimizely.com/optimization-glossary/ab-testing/)
- [Statistical Significance Calculator](https://www.optimizely.com/sample-size-calculator/)
- [Google Analytics 4 Events](https://developers.google.com/analytics/devguides/collection/ga4/events)

---

## Historial de Cambios

| Fecha | Cambio | Autor |
|-------|--------|-------|
| 2026-02-10 | Creación del ADR | EOD Dev Team |

---

## Notas Adicionales

Este ADR documenta la implementación inicial del framework. Una vez finalizado el experimento y tomada la decisión sobre qué variante desplegar, se creará un nuevo ADR documentando:

- Resultados del test A/B
- Análisis estadístico
- Decisión final (A, B, o híbrido)
- Plan de migración y deprecación
