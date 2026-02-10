# Guía de Recolección y Análisis de Datos - A/B Test

## 📊 Flujo Completo de Datos

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│   ABTestLoader (client-side)    │
│   - Asigna variante A/B         │
│   - Carga widget correspondiente│
└──────┬─────────────┬────────────┘
       │             │
       │             │
       ▼             ▼
┌──────────────┐  ┌──────────────────┐
│  GA4 / GTM   │  │  Backend API     │
│  (tracking)  │  │  (opcional)      │
└──────┬───────┘  └────────┬─────────┘
       │                   │
       ▼                   ▼
┌──────────────┐  ┌──────────────────┐
│  BigQuery    │  │  Base de Datos   │
│  (análisis)  │  │  (PostgreSQL)    │
└──────────────┘  └──────────────────┘
```

---

## 1️⃣ Opción A: Solo Google Analytics/GTM (ACTUAL - Sin Backend)

### ✅ Ventajas
- Ya está implementado y funcionando
- No requiere cambios en backend
- Interfaz visual para análisis (GA4 Dashboard)
- Integración con BigQuery para queries avanzadas

### Configuración Requerida

**Paso 1**: Añadir Google Tag Manager a tu sitio

```html
<!-- En <head> de tu página -->
<script>
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXXX'); // TU ID DE GTM
</script>
```

**Paso 2**: Importar configuración GTM

1. Ve a tu cuenta de GTM
2. Importar `gtm-config-ab-test.json`
3. Publicar contenedor

**Paso 3**: Conectar con GA4

En GTM, añadir tu Measurement ID de GA4 en las etiquetas.

### Análisis en Google Analytics 4

**Dashboard básico:**
1. Ve a **Explore** → **Blank**
2. Añade dimensión: `variant` (custom dimension)
3. Añade métrica: `Event count`, `Users`, `Sessions`
4. Filtrar por: `event_name = ab_test_variant_assigned`

**Queries BigQuery** (si tienes GA4 exportando a BigQuery):

```sql
-- 1. Distribución de variantes
SELECT
  (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'variant') AS variant,
  COUNT(DISTINCT user_pseudo_id) AS users,
  COUNT(*) AS assignments
FROM `project.analytics_XXXXXXXX.events_*`
WHERE event_name = 'ab_test_variant_assigned'
  AND _TABLE_SUFFIX BETWEEN '20260201' AND '20260215'
GROUP BY variant;

-- 2. Engagement por variante
SELECT
  variant,
  COUNT(DISTINCT session_id) AS sessions,
  COUNTIF(event_name = 'ab_test_user_interaction') AS interactions,
  ROUND(COUNTIF(event_name = 'ab_test_user_interaction') / COUNT(DISTINCT session_id), 2) AS avg_interactions_per_session
FROM (
  SELECT
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'variant') AS variant,
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'session_id') AS session_id,
    event_name
  FROM `project.analytics_XXXXXXXX.events_*`
  WHERE _TABLE_SUFFIX BETWEEN '20260201' AND '20260215'
)
GROUP BY variant;

-- 3. Tasa de éxito de carga
SELECT
  variant,
  COUNTIF(event_name = 'ab_test_widget_loaded') AS successful_loads,
  COUNTIF(event_name = 'ab_test_load_error') AS errors,
  ROUND(COUNTIF(event_name = 'ab_test_widget_loaded') / (COUNTIF(event_name = 'ab_test_widget_loaded') + COUNTIF(event_name = 'ab_test_load_error')) * 100, 2) AS success_rate_percent
FROM (
  SELECT
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'variant') AS variant,
    event_name
  FROM `project.analytics_XXXXXXXX.events_*`
  WHERE event_name IN ('ab_test_widget_loaded', 'ab_test_load_error')
    AND _TABLE_SUFFIX BETWEEN '20260201' AND '20260215'
)
GROUP BY variant;

-- 4. Tiempo promedio de carga por variante
SELECT
  variant,
  AVG(load_time) AS avg_load_time_ms,
  APPROX_QUANTILES(load_time, 100)[OFFSET(50)] AS median_load_time_ms,
  APPROX_QUANTILES(load_time, 100)[OFFSET(95)] AS p95_load_time_ms
FROM (
  SELECT
    (SELECT value.string_value FROM UNNEST(event_params) WHERE key = 'variant') AS variant,
    (SELECT value.int_value FROM UNNEST(event_params) WHERE key = 'load_time_ms') AS load_time
  FROM `project.analytics_XXXXXXXX.events_*`
  WHERE event_name = 'ab_test_widget_loaded'
    AND _TABLE_SUFFIX BETWEEN '20260201' AND '20260215'
)
WHERE load_time IS NOT NULL
GROUP BY variant;
```

---

## 2️⃣ Opción B: Backend Analytics (REQUIERE IMPLEMENTACIÓN)

### ✅ Ventajas
- Control total de los datos
- No depende de servicios externos
- Puedes añadir lógica de negocio custom
- Datos en tu propia base de datos

### ❌ Requiere

**Backend nuevo endpoint**: `POST /api/v2/analytics/ab-test`

### Ejemplo de Implementación Backend (Python/FastAPI)

```python
# En tu backend eod-api-rag-service

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any

router = APIRouter()

class ABTestEvent(BaseModel):
    event_type: str  # 'ab_test_variant_assigned', 'ab_test_user_interaction', etc.
    experiment_name: str
    variant: str  # 'A' o 'B'
    session_id: str
    timestamp: str
    metadata: Optional[Dict[str, Any]] = None
    user_agent: Optional[str] = None
    action: Optional[str] = None
    load_time_ms: Optional[int] = None
    error: Optional[str] = None

@router.post('/api/v2/analytics/ab-test')
async def track_ab_test_event(event: ABTestEvent):
    """
    Endpoint para recibir eventos del A/B test
    """
    try:
        # Guardar en base de datos
        event_data = {
            'event_type': event.event_type,
            'experiment_name': event.experiment_name,
            'variant': event.variant,
            'session_id': event.session_id,
            'timestamp': datetime.fromisoformat(event.timestamp),
            'metadata': event.metadata,
            'user_agent': event.user_agent,
            'action': event.action,
            'load_time_ms': event.load_time_ms,
            'error': event.error
        }
        
        # Insertar en PostgreSQL
        await db.ab_test_events.insert_one(event_data)
        
        return {'status': 'ok', 'event_type': event.event_type}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get('/api/v2/analytics/ab-test/summary')
async def get_ab_test_summary(experiment_name: str):
    """
    Obtiene resumen del A/B test
    """
    # Query agregada
    summary = await db.ab_test_events.aggregate([
        {'$match': {'experiment_name': experiment_name}},
        {'$group': {
            '_id': '$variant',
            'total_events': {'$sum': 1},
            'unique_sessions': {'$addToSet': '$session_id'},
            'avg_load_time': {'$avg': '$load_time_ms'}
        }}
    ]).to_list(None)
    
    return {
        'experiment': experiment_name,
        'variants': summary
    }
```

### Schema de Base de Datos

```sql
-- PostgreSQL
CREATE TABLE ab_test_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    experiment_name VARCHAR(100) NOT NULL,
    variant CHAR(1) NOT NULL CHECK (variant IN ('A', 'B')),
    session_id UUID NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    action VARCHAR(100),
    metadata JSONB,
    load_time_ms INTEGER,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para queries rápidas
CREATE INDEX idx_ab_test_experiment ON ab_test_events(experiment_name, variant);
CREATE INDEX idx_ab_test_session ON ab_test_events(session_id);
CREATE INDEX idx_ab_test_timestamp ON ab_test_events(timestamp);
```

### Queries de Análisis (PostgreSQL)

```sql
-- 1. Distribución de variantes
SELECT 
    variant,
    COUNT(DISTINCT session_id) AS unique_sessions,
    COUNT(*) AS total_events
FROM ab_test_events
WHERE experiment_name = 'assistant_widget_ab_test_v1'
    AND event_type = 'ab_test_variant_assigned'
    AND timestamp >= NOW() - INTERVAL '14 days'
GROUP BY variant;

-- 2. Engagement por variante
SELECT 
    variant,
    COUNT(DISTINCT session_id) AS sessions,
    COUNT(CASE WHEN event_type = 'ab_test_user_interaction' THEN 1 END) AS interactions,
    ROUND(
        COUNT(CASE WHEN event_type = 'ab_test_user_interaction' THEN 1 END)::numeric / 
        COUNT(DISTINCT session_id)::numeric, 
        2
    ) AS avg_interactions_per_session
FROM ab_test_events
WHERE experiment_name = 'assistant_widget_ab_test_v1'
    AND timestamp >= NOW() - INTERVAL '14 days'
GROUP BY variant;

-- 3. Tasa de éxito de carga
SELECT 
    variant,
    COUNT(CASE WHEN event_type = 'ab_test_widget_loaded' THEN 1 END) AS successful_loads,
    COUNT(CASE WHEN event_type = 'ab_test_load_error' THEN 1 END) AS errors,
    ROUND(
        100.0 * COUNT(CASE WHEN event_type = 'ab_test_widget_loaded' THEN 1 END) / 
        NULLIF(COUNT(*), 0),
        2
    ) AS success_rate_percent
FROM ab_test_events
WHERE experiment_name = 'assistant_widget_ab_test_v1'
    AND event_type IN ('ab_test_widget_loaded', 'ab_test_load_error')
    AND timestamp >= NOW() - INTERVAL '14 days'
GROUP BY variant;

-- 4. Performance (tiempo de carga)
SELECT 
    variant,
    AVG(load_time_ms) AS avg_load_time,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY load_time_ms) AS median_load_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY load_time_ms) AS p95_load_time
FROM ab_test_events
WHERE experiment_name = 'assistant_widget_ab_test_v1'
    AND event_type = 'ab_test_widget_loaded'
    AND load_time_ms IS NOT NULL
    AND timestamp >= NOW() - INTERVAL '14 days'
GROUP BY variant;
```

---

## 3️⃣ Opción C: Híbrido (RECOMENDADO)

Combinar GA4/GTM (para análisis rápido) + Backend (para datos propios y cruce con otras métricas).

### Uso del módulo `ab-test-analytics.js`

```html
<!-- 1. Cargar módulos -->
<script src="./src/ab-test-loader.js"></script>
<script src="./src/ab-test-analytics.js"></script>

<script>
  // 2. Inicializar A/B test
  const abTest = new ABTestLoader({
    variantA: './src/assistant-widget.js',
    variantB: './src/assistant-widget-v2.js',
    experimentName: 'assistant_widget_ab_test_v1'
  });

  // 3. Inicializar analytics (backend tracking)
  const analytics = new ABTestAnalytics(abTest, {
    analyticsEndpoint: 'https://api.envios23.com/api/v2/analytics/ab-test',
    feedbackEndpoint: 'https://api.envios23.com/api/v2/feedback',
    enabled: true // false para deshabilitar backend tracking
  });

  // 4. Cargar widget y trackear
  const startTime = Date.now();
  
  abTest.init()
    .then(variant => {
      const loadTime = Date.now() - startTime;
      
      // Trackear asignación (va a GA4 + Backend)
      analytics.trackVariantAssignment();
      
      // Trackear carga exitosa
      analytics.trackWidgetLoaded(loadTime);
      
      console.log('Widget cargado - Variante:', variant);
    })
    .catch(error => {
      // Trackear error
      analytics.trackLoadError(error);
    });

  // 5. Trackear interacciones del usuario
  document.addEventListener('widget-message-sent', (e) => {
    analytics.trackInteraction('message_sent', {
      message_length: e.detail.message.length
    });
  });

  // 6. Trackear feedback con metadata A/B
  document.addEventListener('widget-feedback', (e) => {
    analytics.sendFeedback(
      e.detail.messageId,
      e.detail.rating,
      e.detail.query,
      e.detail.response
    );
  });
</script>
```

---

## 📈 Análisis Estadístico

### Test de Significancia Estadística

Para determinar si hay diferencia significativa entre variantes:

```python
from scipy.stats import chi2_contingency
import pandas as pd

# Datos de ejemplo
data = pd.DataFrame({
    'variant': ['A', 'A', 'B', 'B'],
    'outcome': ['success', 'failure', 'success', 'failure'],
    'count': [520, 480, 580, 420]  # Ejemplo: A tiene 52% success, B tiene 58%
})

# Crear tabla de contingencia
contingency_table = data.pivot(index='variant', columns='outcome', values='count')

# Chi-cuadrado test
chi2, p_value, dof, expected = chi2_contingency(contingency_table)

print(f"Chi-cuadrado: {chi2}")
print(f"P-value: {p_value}")
print(f"Significativo?: {'Sí' if p_value < 0.05 else 'No'}")
```

### Tamaño de Muestra Requerido

```python
from statsmodels.stats.power import zt_ind_solve_power

# Calcular tamaño de muestra necesario
n = zt_ind_solve_power(
    effect_size=0.2,    # Diferencia mínima esperada (20%)
    alpha=0.05,         # Nivel de significancia
    power=0.8,          # Poder estadístico (80%)
    alternative='two-sided'
)

print(f"Usuarios necesarios por variante: {int(n)}")
```

---

## 📊 Dashboard Recomendado

### Métricas Clave a Monitorear

| Métrica | Variante A | Variante B | Diferencia | Significativo |
|---------|-----------|-----------|------------|---------------|
| **Usuarios** | N | N | - | - |
| **CTR inicial** (% que abre widget) | X% | Y% | +Z% | ✓/✗ |
| **Mensajes por sesión** | X | Y | +Z | ✓/✗ |
| **Tasa de completación** | X% | Y% | +Z% | ✓/✗ |
| **Tiempo promedio de sesión** | Xs | Ys | +Zs | ✓/✗ |
| **Error rate** | X% | Y% | +Z% | ✓/✗ |
| **Feedback positivo** | X% | Y% | +Z% | ✓/✗ |

---

## 🎯 Recomendación

**Para empezar ahora (sin backend)**:
1. ✅ Usa GA4/GTM (ya está implementado)
2. ✅ Importa `gtm-config-ab-test.json` a tu cuenta GTM
3. ✅ Define tu Measurement ID de GA4
4. ✅ Despliega y empieza a recolectar datos

**Para análisis avanzado (futuro)**:
1. ⏳ Implementa endpoint `/api/v2/analytics/ab-test` en backend
2. ⏳ Usa `ab-test-analytics.js` para doble tracking
3. ⏳ Consulta datos desde tu propia DB

**Duración mínima del test**: 14 días  
**Muestra mínima**: 1000 usuarios por variante  
**Significancia**: p < 0.05

---

¿Necesitas ayuda implementando el endpoint en el backend?
