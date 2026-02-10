#!/bin/bash
# 📋 BACKEND IMPLEMENTATION CHECKLIST - A/B Test Analytics
# Script de referencia para el equipo de backend

echo "=== A/B Test Backend Implementation Checklist ==="
echo ""

cat << 'EOF'

## [CHECKLIST] Implementación Backend - A/B Test Analytics

### FASE 1: Diseño y Planeación
- [ ] Revisar BACKEND-ISSUE-SHORT.md
- [ ] Revisar AB-TEST-DATA-COLLECTION.md (en frontend repo)
- [ ] Decidir: MongoD vs PostgreSQL (recomendado: PostgreSQL)
- [ ] Setup: crear rama feature/analytics-ab-test
- [ ] Revisar con tech lead

### FASE 2: Base de Datos
- [ ] Crear tabla `ab_test_events` (PostgreSQL)
- [ ] Crear índices (5 índices como especificado)
- [ ] Crear migrations (si usan Alembic/Flyway)
- [ ] Popstar pruebas: insertar 100 rows de test
- [ ] Verificar performance índices con EXPLAIN

### FASE 3: Endpoint /api/v2/analytics/ab-test
- [ ] Crear ruta POST /api/v2/analytics/ab-test
- [ ] Implementar Pydantic model de validación (FastAPI) o schema (otro framework)
- [ ] Validaciones:
  - [ ] variant in {A, B}
  - [ ] event_type en whitelist
  - [ ] session_id es UUID válido
  - [ ] timestamp es ISO-8601
  - [ ] load_time_ms > 0 (si existe)
  - [ ] metadata es JSON válido (si existe)
  - [ ] payload < 10KB
- [ ] Insertar en tabla ab_test_events
- [ ] Return 200 con {"status": "ok", "event_type": ..., "id": ...}
- [ ] Return 400/422 con mensaje descriptivo si validación falla

### FASE 4: Seguridad
- [ ] CORS: configurar allowed origins
- [ ] Rate limiting: 1000 req/min por IP
- [ ] IP address: guardar para analytics, no para PII
- [ ] Validación tamaño payload: rechazar > 10KB con 413
- [ ] Test: intentar inyectar JSON en metadata
- [ ] Test: intentar bypass rate limit

### FASE 5: Lógica de Negocio
- [ ] Si event_type = variant_assigned → validar solo session_id es único
- [ ] Si event_type = widget_loaded → require load_time_ms > 0
- [ ] Si event_type = load_error → require error field
- [ ] Timestamp: si no se envía, usar NOW()

### FASE 6: Integración Feedback
- [ ] (OPCIONAL) Extender POST /api/v2/feedback para incluir:
  - ab_test_variant (char 1)
  - ab_test_experiment (varchar)
  - session_id (UUID)
- [ ] Crear foreign key a ab_test_events (opcional)

### FASE 7: Queries de Análisis
- [ ] Test Query 1: Distribución de variantes
- [ ] Test Query 2: Tasa de éxito de carga
- [ ] Test Query 3: Performance (load_time_ms stats)
- [ ] Test Query 4: Engagement (interactions per session)
- [ ] Verificar queries son <500ms en 100k+ rows

### FASE 8: Testing
- [ ] Unit tests: validaciones (variant, event_type, UUID, timestamps)
- [ ] Unit tests: edge cases (null fields, empty strings, etc)
- [ ] Integration tests: POST exitoso inserta en tabla
- [ ] Integration tests: POST fallido no inserta & retorna 400
- [ ] Integration tests: rate limiting funciona
- [ ] Load test: 1000 requests concurrentes
- [ ] Coverage: >80%

### FASE 9: Documentación
- [ ] Actualizar Swagger/OpenAPI
- [ ] README en repo backend con instrucciones setup
- [ ] Inline code comments en funciones críticas
- [ ] Documento de deployment (vars env, DB migration steps)

### FASE 10: Deployment
- [ ] Migrations ejecutadas en DB dev/staging
- [ ] Variables de entorno configuradas
- [ ] Testing en staging con datos reales
- [ ] Code review aprobado
- [ ] Deploy a producción (con PR)
- [ ] Verificar endpoint responde en prod
- [ ] Monitor primeras horas: error rates, latencia

### FASE 11: Testing E2E con Frontend
- [ ] Clonar web-rag-service rama feature/ab-test-interfaces
- [ ] Configurar ab-test-analytics.js con URL de backend
- [ ] Abrir ab-test-full.html en navegador
- [ ] Verificar "Backend: ✅" en demo page
- [ ] Simular 5-10 interacciones
- [ ] Verificar eventos aparecen en tabla ab_test_events
- [ ] Correr las 4 queries y verificar datos correctos

### FASE 12: Vigilancia (Ongoing)
- [ ] Monitorear error rates del endpoint
- [ ] Alertas si latencia > 1s
- [ ] Alertas si queue de eventos > 10k
- [ ] Weekly review: # eventos vs # usuarios esperados
- [ ] Backup de datos antes de test terminar (2026-02-24)

---

## Ejemplos Rápidos (Copy-Paste Ready)

### Status Check
curl http://backend:8000/api/v2/analytics/ab-test -X POST \
  -H "Content-Type: application/json" \
  -d '{"event_type":"ab_test_variant_assigned","experiment_name":"test_v1","variant":"A","session_id":"550e8400-e29b-41d4-a716-446655440000","timestamp":"2026-02-10T12:00:00Z"}'

### Check Table
SELECT COUNT(*), variant, event_type 
FROM ab_test_events 
GROUP BY variant, event_type;

---

## Contacts & Escalation
- Frontend lead: (link a GitHub issues eod-web-rag-service)
- Backend tech lead: (your name)
- On-call: (your rotation)

---

Estimated total time: 5-8 story points (2-3 days sprint)

EOF

echo ""
echo "=== To use this checklist ==="
echo "1. Copy content above"
echo "2. Create GitHub Issue: https://github.com/SM23-EOD/eod-api-rag-service/issues/new"
echo "3. Paste as issue body"
echo "4. Assign to backend team"
echo "5. Link to frontend PR: https://github.com/SM23-EOD/eod-web-rag-service/pull/new/feature/ab-test-interfaces"
echo ""
