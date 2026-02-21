# [BACKEND] Implementar Analytics para A/B Testing - POST /api/v2/analytics/ab-test

## 📋 Descripción

Implementar endpoint backend para almacenar eventos del A/B testing del widget asistente. El frontend ya tiene el cliente listo para enviar eventos (`ab-test-analytics.js`). Este endpoint es opcional para GA4/GTM, pero requerido para análisis interno.

**Refs**:
- Frontend repo: https://github.com/SM23-EOD/eod-web-rag-service/tree/feature/ab-test-interfaces
- Docs: [AB-TEST-DATA-COLLECTION.md](https://github.com/SM23-EOD/eod-web-rag-service/blob/feature/ab-test-interfaces/AB-TEST-DATA-COLLECTION.md)

---

## 🎯 Task List

### 1. Nuevo Endpoint: `POST /api/v2/analytics/ab-test`

**Payload Request**:
```json
{
  "event_type": "ab_test_widget_loaded",
  "experiment_name": "assistant_widget_ab_test_v1",
  "variant": "A",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-02-10T12:34:56.000Z",
  "load_time_ms": 1234,
  "user_agent": "Mozilla/5.0...",
  "screen_resolution": "1920x1080"
}
```

**Validaciones**:
- ✅ `variant` ∈ {A, B}
- ✅ `event_type` ∈ {ab_test_variant_assigned, ab_test_widget_loaded, ab_test_user_interaction, ab_test_load_error}
- ✅ `session_id` es UUID válido
- ✅ `timestamp` es ISO-8601 válido
- ✅ Payload max 10KB
- ✅ Rate limit: 1000 req/min por IP
- ✅ CORS: allow origin del frontend

**Response 200**:
```json
{ "status": "ok", "event_type": "ab_test_widget_loaded", "id": 12345 }
```

**Response 400** (ej: invalid variant):
```json
{ "status": "error", "error": "Invalid variant. Must be 'A' or 'B'", "field": "variant" }
```

---

### 2. Schema de BD (PostgreSQL)

```sql
CREATE TABLE ab_test_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  experiment_name VARCHAR(100) NOT NULL,
  variant CHAR(1) NOT NULL CHECK (variant IN ('A', 'B')),
  session_id UUID NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  action VARCHAR(100),
  metadata JSONB,
  load_time_ms INTEGER,
  error TEXT,
  user_agent TEXT,
  screen_resolution VARCHAR(20),
  viewport_size VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ab_test_exp_variant ON ab_test_events (experiment_name, variant);
CREATE INDEX idx_ab_test_event_type ON ab_test_events (event_type);
CREATE INDEX idx_ab_test_session ON ab_test_events (session_id);
CREATE INDEX idx_ab_test_timestamp ON ab_test_events (timestamp DESC);
```

---

### 3. Queries de Análisis (para reportes/dashboard)

**Distribución de variantes**:
```sql
SELECT variant, COUNT(DISTINCT session_id) AS sessions
FROM ab_test_events
WHERE experiment_name = $1 AND event_type = 'ab_test_variant_assigned'
  AND timestamp >= NOW() - INTERVAL '14 days'
GROUP BY variant;
```

**Tasa de éxito de carga**:
```sql
SELECT variant,
  COUNT(CASE WHEN event_type='ab_test_widget_loaded' THEN 1 END)::float /
  NULLIF(COUNT(CASE WHEN event_type IN ('ab_test_widget_loaded','ab_test_load_error') THEN 1 END), 0) * 100
  AS success_rate_percent
FROM ab_test_events
WHERE experiment_name = $1 AND event_type IN ('ab_test_widget_loaded', 'ab_test_load_error')
GROUP BY variant;
```

---

### 4. Test Mínimos

```bash
# ✅ Test exitoso
curl -X POST http://localhost:8000/api/v2/analytics/ab-test \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "ab_test_variant_assigned",
    "experiment_name": "assistant_widget_ab_test_v1",
    "variant": "A",
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-02-10T12:34:56.000Z"
  }'
# Expected: 200 OK

# ❌ Test fallido (invalid variant)
curl -X POST http://localhost:8000/api/v2/analytics/ab-test \
  -H "Content-Type: application/json" \
  -d '{"variant": "C", ...}'
# Expected: 400 Bad Request
```

---

## ✅ Acceptance Criteria

- [ ] Endpoint implementado en `/api/v2/analytics/ab-test`
- [ ] Tabla `ab_test_events` con índices creados
- [ ] Validaciones (variant, event_type, UUID, ISO-8601)
- [ ] Rate limiting funcional
- [ ] CORS configurado
- [ ] 3 queries de análisis probadas
- [ ] Docs API actualizada (Swagger/OpenAPI)
- [ ] Tests unitarios > 80% coverage

---

## 📌 Notas

- Frontend ya está listo para enviar eventos (https://github.com/SM23-EOD/eod-web-rag-service/blob/feature/ab-test-interfaces/src/ab-test-analytics.js)
- Este endpoint es **opcional** - test puede correr solo con GA4/GTM
- Duración test: 14 días
- Tamaño muestra: ~1000 usuarios/variante mínimo

---

**Labels**: backend, analytics, a-b-testing, feature  
**Size**: M (5-8 story points)
