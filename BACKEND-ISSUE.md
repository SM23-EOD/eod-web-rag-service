# [BACKEND] Implementar Analytics para A/B Testing del Widget Asistente

**Prioridad**: Media  
**Epic**: A/B Testing del Widget  
**Componente**: API Analytics  
**Estimación**: 5-8 story points

---

## 📋 Descripción

El equipo de frontend ha implementado un framework A/B/testing completo para comparar dos interfaces del widget asistente. Este issue documenta los cambios necesarios en el backend para almacenar y permitir análisis de eventos del A/B test.

**Contexto**: 
- Frontend repo: https://github.com/SM23-EOD/eod-web-rag-service
- Rama feature: `feature/ab-test-interfaces`
- Documentación frontend: [AB-TEST-DATA-COLLECTION.md](https://github.com/SM23-EOD/eod-web-rag-service/blob/feature/ab-test-interfaces/AB-TEST-DATA-COLLECTION.md)

---

## 🎯 Objetivos

1. ✅ Crear endpoint `POST /api/v2/analytics/ab-test` para recibir eventos A/B test
2. ✅ Implementar esquema de BD para almacenar eventos
3. ✅ Validar y sanitizar datos entrantes
4. ✅ Proporcionar queries de análisis estándar
5. ✅ Documentar payload y respuestas

---

## 🔧 Especificaciones Técnicas

### 1. Nuevo Endpoint

**Ruta**: `POST /api/v2/analytics/ab-test`

**Descripción**: Recibe eventos de tracking del A/B test del widget

**Headers requeridos**:
```
Content-Type: application/json
```

**Body - Campos y Tipos**:

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `event_type` | string | ✅ | Tipo de evento. Ver enum abajo |
| `experiment_name` | string | ✅ | Nombre del experimento (ej: `assistant_widget_ab_test_v1`) |
| `variant` | char(1) | ✅ | Variante asignada: `A` o `B` |
| `session_id` | UUID | ✅ | Session ID único por usuario/sesión |
| `timestamp` | ISO-8601 | ✅ | Timestamp del evento (ej: `2026-02-10T12:34:56.000Z`) |
| `action` | string | opcional | Acción realizada (ej: `message_sent`, `feedback_submitted`) |
| `metadata` | JSON | opcional | Datos adicionales contextuales |
| `load_time_ms` | integer | opcional | Tiempo de carga en ms (para `widget_loaded`) |
| `error` | string | opcional | Mensaje de error (para eventos de error) |
| `user_agent` | string | opcional | User-Agent del navegador |
| `screen_resolution` | string | opcional | Resolución de pantalla (ej: `1920x1080`) |
| `viewport_size` | string | opcional | Tamaño del viewport (ej: `1280x720`) |

**Event Types Válidos**:
```
- ab_test_variant_assigned
- ab_test_widget_loaded
- ab_test_user_interaction
- ab_test_load_error
- ab_test_session_summary (opcional)
```

**Ejemplo Request**:

```json
{
  "event_type": "ab_test_widget_loaded",
  "experiment_name": "assistant_widget_ab_test_v1",
  "variant": "B",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-02-10T12:34:56.000Z",
  "load_time_ms": 1234,
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "screen_resolution": "1920x1080",
  "viewport_size": "1280x720"
}
```

**Respuesta - 200 OK**:

```json
{
  "status": "ok",
  "event_type": "ab_test_widget_loaded",
  "id": 12345
}
```

**Respuesta - 400 Bad Request**:

```json
{
  "status": "error",
  "error": "Invalid variant. Must be 'A' or 'B'",
  "field": "variant"
}
```

---

### 2. Validaciones Requeridas

- ✅ `variant` debe ser exactamente `A` o `B`
- ✅ `event_type` debe estar en whitelist (ver arriba)
- ✅ `session_id` debe ser UUID válido (v4)
- ✅ `timestamp` debe ser ISO-8601 válido
- ✅ `load_time_ms` debe ser integer > 0 (si se envía)
- ✅ `metadata` debe ser JSON válido (si se envía)
- ✅ Retornar 400 con mensaje descriptivo si validación falla
- ✅ Rate limiting: máximo 1000 eventos/minuto por IP

---

### 3. Esquema de Base de Datos (PostgreSQL)

```sql
-- Crear tabla
CREATE TABLE ab_test_events (
  id SERIAL PRIMARY KEY,
  
  -- Campos requeridos
  event_type VARCHAR(100) NOT NULL,
  experiment_name VARCHAR(100) NOT NULL,
  variant CHAR(1) NOT NULL CHECK (variant IN ('A', 'B')),
  session_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  
  -- Campos opcionales
  action VARCHAR(100),
  metadata JSONB DEFAULT NULL,
  load_time_ms INTEGER,
  error TEXT,
  user_agent TEXT,
  screen_resolution VARCHAR(20),
  viewport_size VARCHAR(20),
  
  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET
);

-- Índices para queries rápidas
CREATE INDEX idx_ab_test_exp_variant 
  ON ab_test_events (experiment_name, variant);

CREATE INDEX idx_ab_test_event_type 
  ON ab_test_events (event_type);

CREATE INDEX idx_ab_test_session 
  ON ab_test_events (session_id);

CREATE INDEX idx_ab_test_timestamp 
  ON ab_test_events (timestamp DESC);

CREATE INDEX idx_ab_test_experiment 
  ON ab_test_events (experiment_name);

-- Índice compuesto para queries comunes
CREATE INDEX idx_ab_test_analysis 
  ON ab_test_events (experiment_name, variant, timestamp DESC);
```

---

### 4. Seguridad y CORS

- ✅ CORS: permitir origen `https://envios23.com` y `http://localhost:*` (dev)
- ✅ No almacenar valores de `ip_address` directos; usar hash si es necesario
- ✅ NO extraer o almacenar PII (emails, teléfonos) de `metadata`
- ✅ Validar tamaño máximo de payload: 10KB
- ✅ Timeout: máximo 5 segundos de respuesta

---

### 5. Consultas de Análisis Estándar

El backend debe poder ejecutar ces estas queries (para reportes):

**Query 1: Distribución de Variantes**
```sql
SELECT
  variant,
  COUNT(DISTINCT session_id) AS unique_sessions,
  COUNT(*) AS total_events,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM ab_test_events
WHERE experiment_name = $1
  AND event_type = 'ab_test_variant_assigned'
  AND timestamp >= NOW() - INTERVAL '14 days'
GROUP BY variant
ORDER BY variant;
```

**Query 2: Tasa de Éxito de Carga**
```sql
SELECT
  variant,
  COUNT(CASE WHEN event_type = 'ab_test_widget_loaded' THEN 1 END) AS successful_loads,
  COUNT(CASE WHEN event_type = 'ab_test_load_error' THEN 1 END) AS errors,
  ROUND(
    100.0 * COUNT(CASE WHEN event_type = 'ab_test_widget_loaded' THEN 1 END) /
    NULLIF(
      COUNT(CASE WHEN event_type IN ('ab_test_widget_loaded', 'ab_test_load_error') THEN 1 END),
      0
    ),
    2
  ) AS success_rate_percent
FROM ab_test_events
WHERE experiment_name = $1
  AND event_type IN ('ab_test_widget_loaded', 'ab_test_load_error')
  AND timestamp >= NOW() - INTERVAL '14 days'
GROUP BY variant;
```

**Query 3: Performance (Tiempo de Carga)**
```sql
SELECT
  variant,
  AVG(load_time_ms) AS avg_load_time_ms,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY load_time_ms) AS median_load_time_ms,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY load_time_ms) AS p95_load_time_ms,
  MIN(load_time_ms) AS min_load_time_ms,
  MAX(load_time_ms) AS max_load_time_ms
FROM ab_test_events
WHERE experiment_name = $1
  AND event_type = 'ab_test_widget_loaded'
  AND load_time_ms IS NOT NULL
  AND timestamp >= NOW() - INTERVAL '14 days'
GROUP BY variant;
```

**Query 4: Engagement (Interacciones por sesión)**
```sql
SELECT
  variant,
  COUNT(DISTINCT session_id) AS total_sessions,
  COUNT(CASE WHEN event_type = 'ab_test_user_interaction' THEN 1 END)::float /
    NULLIF(COUNT(DISTINCT session_id), 0) AS avg_interactions_per_session
FROM ab_test_events
WHERE experiment_name = $1
  AND timestamp >= NOW() - INTERVAL '14 days'
GROUP BY variant;
```

---

## 📝 Acerca de Extender Endpoint de Feedback Existente (Opcional)

Endpoint actual: `POST /api/v2/feedback`

Resultado de extender para incluir campos A/B test:

```json
{
  "query": "¿Cómo funciona el tracking?",
  "response": "El tracking funciona mediante...",
  "rating": 1,
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  
  // Nuevos campos opcionales
  "ab_test_variant": "B",
  "ab_test_experiment": "assistant_widget_ab_test_v1"
}
```

Esto permite correlacionar feedback con variante A/B.

---

## 🧪 Pruebas Mínimas Requeridas

- [ ] POST válido con todos los campos requeridos retorna 200 y guarda en BD
- [ ] POST con `variant` inválido (ej: "C") retorna 400
- [ ] POST con `session_id` no UUID retorna 400
- [ ] POST con `timestamp` inválido retorna 400
- [ ] POST con payload > 10KB retorna 413
- [ ] Verificar que los índices se crean correctamente
- [ ] Query de distribución retorna 2 filas (A y B) con totales correctos
- [ ] Rate limiting funciona: rechaza después de 1000 req/min
- [ ] CORS permite origen correcto; rechaza origen inválido

**Ejemplo de test (curl)**:

```bash
# Test exitoso
curl -X POST http://localhost:8000/api/v2/analytics/ab-test \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "ab_test_variant_assigned",
    "experiment_name": "assistant_widget_ab_test_v1",
    "variant": "A",
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-02-10T12:34:56.000Z"
  }'

# Esperado: 200 OK
# { "status": "ok", "event_type": "ab_test_variant_assigned", "id": 1 }

# Test fallido (variant inválido)
curl -X POST http://localhost:8000/api/v2/analytics/ab-test \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "ab_test_variant_assigned",
    "experiment_name": "assistant_widget_ab_test_v1",
    "variant": "C",
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-02-10T12:34:56.000Z"
  }'

# Esperado: 400 Bad Request
# { "status": "error", "error": "Invalid variant. Must be 'A' or 'B'", "field": "variant" }
```

---

## 📚 Referencias

- **Frontend A/B test loader**: [`src/ab-test-loader.js`](https://github.com/SM23-EOD/eod-web-rag-service/blob/feature/ab-test-interfaces/src/ab-test-loader.js)
- **Frontend analytics module**: [`src/ab-test-analytics.js`](https://github.com/SM23-EOD/eod-web-rag-service/blob/feature/ab-test-interfaces/src/ab-test-analytics.js)
- **Data collection guide**: [`AB-TEST-DATA-COLLECTION.md`](https://github.com/SM23-EOD/eod-web-rag-service/blob/feature/ab-test-interfaces/AB-TEST-DATA-COLLECTION.md)
- **Architecture Decision**: [`adr/0007-ab-testing-framework.md`](https://github.com/SM23-EOD/eod-web-rag-service/blob/feature/ab-test-interfaces/adr/0007-ab-testing-framework.md)

---

## ✅ Acceptance Criteria

- [ ] Endpoint `POST /api/v2/analytics/ab-test` implementado y funcional
- [ ] Tabla `ab_test_events` creada con todos los índices
- [ ] Validaciones completas en todos los campos
- [ ] Rate limiting implementado
- [ ] CORS configurado correctamente
- [ ] Todas las pruebas mínimas pasan
- [ ] Documentación API actualizada en Swagger/OpenAPI
- [ ] 4 queries de análisis estándar probadas
- [ ] CR aprobado por al menos 1 reviewer

---

## 📌 Notas

- **Start date**: 2026-02-10
- **Equipo frontend**: ya tiene el cliente listo para enviar eventos
- **Fechas tentativas**: test durará ~14 días, resultados ~2026-02-24
- **Prioridad**: esta implementación no bloquea el test (pueden usar solo GA4), pero tiene más valor con backend

---

## 🔗 Links Relacionados

- PR Frontend: https://github.com/SM23-EOD/eod-web-rag-service/pull/new/feature/ab-test-interfaces
- Epic Jira: [EOD-XXX] (si existe)
- Slack thread: #engineering-backend (si existe)

---

**Asignado a**: @backend-team  
**Labels**: `backend`, `analytics`, `a-b-testing`, `feature`  
**Milestone**: (si está en uso)
