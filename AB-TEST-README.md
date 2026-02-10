# A/B Testing Framework

## 📋 Resumen

Sistema de test A/B para comparar las dos interfaces del widget asistente:
- **Variante A**: `assistant-widget.js` (interfaz original)
- **Variante B**: `assistant-widget-v2.js` (interfaz nueva)

## 🎯 Características

- ✅ Distribución automática 50/50 basada en Session ID
- ✅ Persistencia de variante durante la sesión
- ✅ Tracking completo con Google Analytics / GTM
- ✅ Control manual para testing (forzar variantes)
- ✅ Event logging en consola y UI
- ✅ Sin dependencias externas

## 🚀 Uso Rápido

### Página de Demo

Abre `ab-test.html` en tu navegador:

```bash
# Con servidor local
python3 -m http.server 8000
# Visita: http://localhost:8000/ab-test.html
```

### Integración en tu sitio

```html
<!-- 1. Incluir el loader -->
<script src="./src/ab-test-loader.js"></script>

<!-- 2. Inicializar -->
<script>
  const abTest = new ABTestLoader({
    variantA: './src/assistant-widget.js',
    variantB: './src/assistant-widget-v2.js',
    experimentName: 'assistant_widget_ab_test_v1'
  });

  abTest.init().then(variant => {
    console.log('Widget cargado - Variante:', variant);
  });
</script>
```

## 📊 Configuración de Analytics

### Google Analytics 4 (gtag.js)

Añade antes del A/B test loader:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Google Tag Manager

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
```

## 📈 Eventos Trackeados

### 1. `ab_test_variant_assigned`
Se dispara cuando se asigna una variante al usuario.

**Parámetros:**
```javascript
{
  experiment_name: 'assistant_widget_ab_test_v1',
  variant: 'A' | 'B',
  session_id: 'uuid-v4',
  timestamp: '2026-02-10T...'
}
```

### 2. `ab_test_widget_loaded`
Se dispara cuando el widget se carga exitosamente.

**Parámetros:**
```javascript
{
  experiment_name: 'assistant_widget_ab_test_v1',
  variant: 'A' | 'B',
  session_id: 'uuid-v4',
  widget_src: './src/assistant-widget.js',
  timestamp: '2026-02-10T...'
}
```

### 3. `ab_test_load_error`
Se dispara si hay error al cargar el widget.

**Parámetros:**
```javascript
{
  experiment_name: 'assistant_widget_ab_test_v1',
  variant: 'A' | 'B',
  session_id: 'uuid-v4',
  error: 'error message',
  timestamp: '2026-02-10T...'
}
```

### 4. `ab_test_user_interaction`
Tracking customizado de interacciones del usuario.

**Uso:**
```javascript
abTest.trackInteraction('message_sent', {
  message_length: 42,
  has_attachments: false
});
```

## 🔧 Opciones de Configuración

```javascript
const abTest = new ABTestLoader({
  // Rutas de los scripts
  variantA: './src/assistant-widget.js',
  variantB: './src/assistant-widget-v2.js',
  
  // Nombre del experimento (para analytics)
  experimentName: 'assistant_widget_ab_test_v1',
  
  // Key de sessionStorage
  storageKey: 'ab_test_variant',
  
  // Forzar variante (para testing manual)
  // null = automático, 'A' o 'B' = forzado
  forceVariant: null
});
```

## 🧪 Testing Manual

### Forzar Variante A
```javascript
const abTest = new ABTestLoader({ forceVariant: 'A' });
abTest.init();
```

### Forzar Variante B
```javascript
const abTest = new ABTestLoader({ forceVariant: 'B' });
abTest.init();
```

### Limpiar sesión
```javascript
sessionStorage.clear();
location.reload();
```

## 📊 Análisis en Google Analytics

### Crear Dimensión Personalizada

1. Ve a **Admin** → **Custom Definitions** → **Custom Dimensions**
2. Crear dimensión:
   - **Dimension name**: `AB Test Variant`
   - **Scope**: Event
   - **Event parameter**: `variant`

### Crear Reporte de Exploración

1. Ve a **Explore** → **Blank**
2. Añadir métrica: `Event count`
3. Añadir dimensión: `event_name`, `AB Test Variant`
4. Filtrar por: `experiment_name = assistant_widget_ab_test_v1`

### Queries útiles en BigQuery

```sql
-- Distribución de variantes
SELECT
  event_params.value.string_value AS variant,
  COUNT(*) AS assignments
FROM `project.dataset.events_*`,
  UNNEST(event_params) AS event_params
WHERE event_name = 'ab_test_variant_assigned'
  AND event_params.key = 'variant'
GROUP BY variant;

-- Tasa de carga exitosa por variante
SELECT
  variant,
  COUNTIF(event_name = 'ab_test_widget_loaded') AS loaded,
  COUNTIF(event_name = 'ab_test_load_error') AS errors,
  ROUND(COUNTIF(event_name = 'ab_test_widget_loaded') / COUNT(*) * 100, 2) AS success_rate
FROM (
  SELECT
    event_name,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'variant') AS variant
  FROM `project.dataset.events_*`
  WHERE event_name IN ('ab_test_widget_loaded', 'ab_test_load_error')
)
GROUP BY variant;
```

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│         Usuario visita página          │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      ABTestLoader.init()                │
│  1. Genera/recupera Session ID          │
│  2. Hash del Session ID → Variante      │
│  3. Guarda en sessionStorage            │
└──────────────┬──────────────────────────┘
               │
               ▼
         ┌─────────┐
         │ Hash %2 │
         └────┬────┘
              │
      ┌───────┴───────┐
      ▼               ▼
  ┌──────┐        ┌──────┐
  │ A=0  │        │ B=1  │
  └──┬───┘        └───┬──┘
     │                │
     ▼                ▼
 widget.js      widget-v2.js
     │                │
     └────────┬───────┘
              │
              ▼
     ┌─────────────────┐
     │ Track eventos   │
     │ GA4 / GTM       │
     └─────────────────┘
```

## 🔒 Persistencia

- **Session Storage**: La variante asignada persiste durante la sesión del navegador
- **Session ID**: Se genera una vez por sesión y se reutiliza
- **Consistencia**: El mismo Session ID siempre resulta en la misma variante

## 🌐 Compatibilidad

- ✅ Navegadores modernos (Chrome, Firefox, Safari, Edge)
- ✅ Mobile responsive
- ✅ Sin dependencias externas
- ⚠️ Requiere sessionStorage (fallback graceful si no disponible)

## 🔍 Debugging

Activa logs detallados en la consola del navegador:

```javascript
// Los logs del A/B test están prefijados con [A/B Test]
// Ejemplo:
// [A/B Test] Nueva asignación - Session: 1a2b3c4d..., Variante: B
// [A/B Test] Cargando variante B: ./src/assistant-widget-v2.js
// [A/B Test] Widget cargado exitosamente - Variante B
```

## 📦 Archivos del Sistema

```
/src/
  ab-test-loader.js          # Clase principal del A/B test
  assistant-widget.js        # Variante A (original)
  assistant-widget-v2.js     # Variante B (nueva)

ab-test.html                 # Página de demo interactiva
AB-TEST-README.md           # Esta documentación
```

## 🎓 Mejores Prácticas

1. **Tamaño de muestra**: Espera suficiente tráfico antes de concluir (>1000 usuarios por variante)
2. **Duración**: Ejecuta el test durante al menos 1-2 semanas para capturar variaciones diarias
3. **Significancia estadística**: Usa test chi-cuadrado o z-test para validar resultados
4. **Segmentación**: Analiza por dispositivo, hora del día, fuente de tráfico
5. **Métricas clave**: Define KPIs antes de empezar (ej: engagement, conversión, tiempo de sesión)

## 🚦 Próximos Pasos

1. ✅ Implementar framework A/B básico
2. ✅ Integrar analytics tracking
3. ⏳ Configurar GTM en producción
4. ⏳ Definir métricas de éxito
5. ⏳ Ejecutar test durante 2 semanas
6. ⏳ Analizar resultados
7. ⏳ Declarar ganador y desplegar

## 📞 Soporte

Para preguntas o issues, consulta la documentación principal del proyecto: `README.md`

---

**Última actualización**: 2026-02-10
