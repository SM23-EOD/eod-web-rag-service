# ADR-015: Plan de Acción SaaS — DRAGA Platform

## Status

**Propuesto** — 2026-02-14

## Context

### Situación Actual

DRAGA Platform ha completado las 14 épicas de ADR-012 y la remediación de ADR-013, alcanzando un estado de **madurez funcional notable**: pipeline RAG de 14 pasos, protocolo OpenAI compatible, MCP, multi-tenant, framework anti-alucinación al 98%, A/B testing, widget SDK, y admin dashboard.

Cada DRAGA (Document Grounded RAG Agent) es una instancia compuesta por cuatro partes: **Tenant** (organización operadora), **Knowledge Base** (corpus documental + taxonomías futuras), **Orchestrator** (pipeline de 14 pasos), y **Agent Crew** (6 agentes especializados: Retrieval, Grounding, Language, Ingestion, Feedback, Quality).

Sin embargo, el assessment estratégico realizado el 2026-02-14 (ver `draga-strategic-assessment.docx`) posiciona la plataforma frente al estado del arte del mercado RAG-as-a-Service (Vectara, Ragie, Nuclia, LlamaCloud) e identifica que **los gaps son operacionales, no funcionales**:

| Categoría | Lo que tenemos | Lo que falta para SaaS |
|-----------|---------------|----------------------|
| Autenticación | API Keys SHA-256 con scopes | JWT + roles + self-service |
| Persistencia | 2/11 repos en PG, 9 en JSON | PostgreSQL como store único |
| Retrieval | Solo búsqueda vectorial densa | Búsqueda híbrida (BM25 + dense) |
| Observabilidad | Structured logging (JSON) | Prometheus + Grafana + alertas |
| Calidad | Scripts de eval manuales | Eval automatizada en CI/CD |
| Resiliencia | Sin fallback para LLM | Circuit breaker + retry + fallback |
| Billing | Inexistente | Usage metering + planes + cobro |
| Onboarding | Solo API / config manual | Self-service signup → agent → widget |
| Grounding estructurado | Solo texto documental | Taxonomías SKOS + vocabularios controlados |

### Contexto de Mercado

- El mercado RAG crece al ~38% CAGR (USD 1.94B en 2025 → USD 9.86B en 2030)
- 51% de equipos enterprise de IA usan arquitecturas RAG
- Benchmark GaRAGe (2025): mejores LLMs solo alcanzan 60% factuality score → nuestro 98% anti-hallucination es un diferenciador real
- La demanda de soluciones auditables crece con regulaciones (EU AI Act, GDPR)

### Modelo de Equipo

El desarrollo se realiza con un equipo compacto de **desarrolladores humanos asistidos por agentes copilot de IA**. Esta realidad define cómo se deben estructurar las tareas:

- **Tareas ideales para copilots**: Migraciones de adaptadores (JSON→PG) siguiendo patrones existentes, generación de tests siguiendo suites existentes, boilerplate de infraestructura (Dockerfile, docker-compose, CI/CD), documentación técnica
- **Tareas que requieren criterio humano**: Decisiones de arquitectura de seguridad (JWT claims, scopes), diseño de UX de onboarding, definición de planes de billing, configuración de alertas operacionales, validación de aislamiento de tenant
- **Tareas híbridas**: Implementación de búsqueda híbrida (copilot implementa, humano valida con golden set), circuit breaker (copilot escribe, humano define umbrales)

## Decision

Organizar el trabajo en **3 fases con 8 sprints**, cada uno de 2 semanas, donde cada tarea especifica la distribución humano/copilot y produce entregables verificables con criterios de aceptación binarios (pasa/no pasa).

---

## Fase 1: SaaS Interno (Sprints 1–4, Semanas 1–8)

**Milestone: DRAGA operacional para uso interno de Treew con múltiples agentes**

### Sprint 1 — Consolidación de Persistencia (Sem 1–2)

**Objetivo**: PostgreSQL como única fuente de verdad para toda la data crítica.

| ID | Tarea | Actor | Prioridad | Criterio de Aceptación |
|----|-------|-------|-----------|----------------------|
| S1-1 | Cablear `pg_tenant_repository.py` en `dependencies.py` con fallback JSON | Copilot | P0 | `dependencies.py` usa `PgTenantRepository` cuando `DATABASE_URL` existe; test unitario verifica ambas ramas |
| S1-2 | Cablear `pg_agent_repository.py` en `dependencies.py` con fallback JSON | Copilot | P0 | Ídem; 250 líneas de código muerto pasan a ser alcanzables |
| S1-3 | Crear tabla `conversations` con PG adapter | Copilot | P0 | Alembic migration, `PgConversationRepository` implementa `ConversationRepositoryPort`, tests pasan |
| S1-4 | Crear tabla `feedback` con PG adapter + índices para agregaciones | Copilot | P0 | `PgFeedbackRepository`, índice en `(tenant_id, created_at)`, query de agregación funcional |
| S1-5 | Crear tabla `audit_log` con PG adapter + particionamiento por mes | Copilot | P1 | `PgAuditLogRepository`, partition pruning verificado, append performance < 5ms |
| S1-6 | Script de migración `migrate_json_to_pg.py` para datos existentes | Copilot + Humano | P0 | Script idempotente que migra tenants, agents, API keys, conversations. Rollback documentado. Ejecutado contra datos reales de envios23 y edo |
| S1-7 | Migrar `ABExperimentRepository`, `FeatureFlagPort` a PG | Copilot | P1 | Adapters PG + cableado en DI + tests |
| S1-8 | Eliminar fallback JSON en producción: env `REQUIRE_DATABASE=true` | Humano | P0 | Startup falla con error claro si `DATABASE_URL` vacío y `REQUIRE_DATABASE=true` |

**Definición de Done Sprint 1:**
- `docker compose up` levanta con PG como único store
- Smoke test completo pasa: crear tenant → crear agente → ingestar docs → query → feedback → verificar en PG
- 0 archivos JSON escritos en modo producción
- Tests: `pytest tests/ -k "pg or postgres"` ≥ 40 tests pasando

### Sprint 2 — Búsqueda Híbrida + Quality Gate (Sem 3–4)

**Objetivo**: Retrieval de clase enterprise y protección de calidad automatizada.

| ID | Tarea | Actor | Prioridad | Criterio de Aceptación |
|----|-------|-------|-----------|----------------------|
| S2-1 | Implementar sparse vectors (BM25) en Qdrant via `FastEmbed` | Copilot + Humano | P0 | Qdrant collection con named vectors `dense` + `sparse`; query usa `prefetch` con RRF |
| S2-2 | Crear `HybridSearchStep` en pipeline entre `embed_query` y `retrieve_chunks` | Copilot | P0 | Nuevo step que orquesta dense + sparse + RRF; configurable via feature flag `HYBRID_SEARCH_ENABLED` |
| S2-3 | A/B test: hybrid vs dense-only con golden set de envios23 | Humano | P0 | Script reproducible que compara Recall@5, MRR, y faithfulness entre ambos modos |
| S2-4 | Crear golden question set formal: 50 preguntas por tenant con expected answers | Humano + Copilot | P0 | `tests/data_for_tests/golden_sets/{tenant_id}.json` con formato `{question, expected_answer, expected_sources}` |
| S2-5 | CI job: ejecutar eval contra golden set en cada PR | Copilot | P0 | GitHub Action que corre eval; PR bloqueado si faithfulness < 0.85 o Recall@5 < 0.70 |
| S2-6 | RAGAS integration para métricas estándar (faithfulness, answer_relevancy, context_precision) | Copilot + Humano | P1 | Script `scripts/evaluate_ragas.py` que produce reporte JSON parseable por CI |
| S2-7 | Documentar resultados de A/B hybrid en `docs/evaluations/` | Copilot | P1 | Markdown con tablas comparativas, decisión documentada |

**Definición de Done Sprint 2:**
- Búsqueda híbrida activable por feature flag, probada con A/B
- CI bloquea PRs que degraden calidad de retrieval
- Decisión documentada: activar/desactivar hybrid por defecto

### Sprint 3 — Autenticación y Autorización (Sem 5–6)

**Objetivo**: Sistema de identidad que permite múltiples usuarios por tenant.

| ID | Tarea | Actor | Prioridad | Criterio de Aceptación |
|----|-------|-------|-----------|----------------------|
| S3-1 | Evaluar e integrar identity provider lightweight (Logto, Hanko, o JWT custom) | Humano | P0 | ADR de decisión con justificación. Prototipo de login→token→API call funcionando |
| S3-2 | Tabla `users` en PG con relación a tenants | Copilot | P0 | Alembic migration; modelo `User(id, email, tenant_id, role, created_at)` |
| S3-3 | Middleware JWT: validar token, extraer tenant_id y role | Copilot + Humano | P0 | Middleware FastAPI que rechaza requests sin token válido; extrae claims a `request.state` |
| S3-4 | Definir roles y scopes: `admin`, `operator`, `viewer` | Humano | P0 | Documento de permisos por endpoint. Admin: todo. Operator: query + ingest + feedback. Viewer: query + read |
| S3-5 | Aplicar authorization checks en todas las rutas | Copilot | P0 | Decorador `@require_role(Role.ADMIN)` o similar; tests para cada combinación role×endpoint |
| S3-6 | Compatibilidad backward: API keys siguen funcionando como método alternativo | Copilot | P1 | `CompositeAuthAdapter` acepta JWT o API Key; prioridad JWT si ambos presentes |
| S3-7 | Refresh token flow + token rotation | Copilot + Humano | P1 | `/auth/refresh` endpoint; refresh tokens en PG con rotación (single-use) |
| S3-8 | Tests de aislamiento cross-tenant con JWT | Humano | P0 | Suite de 15+ tests: user de tenant A no puede leer/escribir datos de tenant B en ningún endpoint |

**Definición de Done Sprint 3:**
- Login → JWT → API call funciona end-to-end
- API keys backward-compatible
- 0 endpoints accesibles sin autenticación (excepto health, widget embed)
- Tests de aislamiento documentan que cross-tenant access es imposible

### Sprint 4 — Observabilidad + Resiliencia (Sem 7–8)

**Objetivo**: Operación con visibilidad y degradación elegante.

| ID | Tarea | Actor | Prioridad | Criterio de Aceptación |
|----|-------|-------|-----------|----------------------|
| S4-1 | Instrumentar con `prometheus_fastapi_instrumentator` + métricas custom | Copilot | P0 | `/metrics` endpoint expone: request count/latency por route, queries por tenant, cache hit rate |
| S4-2 | Métricas por pipeline step: latencia de cada uno de los 14 steps | Copilot | P0 | Histogram `draga_pipeline_step_duration_seconds{step="retrieve_chunks"}` |
| S4-3 | Métricas de LLM: tokens in/out, cost estimado, latencia por provider | Copilot | P1 | Counter `draga_llm_tokens_total{direction="input",provider="openrouter"}` |
| S4-4 | Grafana dashboard con paneles: latencia P50/P95/P99, queries/min, error rate, top tenants | Copilot + Humano | P0 | Dashboard JSON exportable, provisioned via docker-compose |
| S4-5 | Alertas: error rate > 5%, P95 > 5s, PG connection pool exhausted | Humano | P0 | AlertManager rules o Grafana alerts; notificación a Slack/email |
| S4-6 | Circuit breaker para OpenRouter: `pybreaker` con fallback a modelo secundario | Copilot + Humano | P0 | Después de 5 errores en 60s, circuit abre; queries usan modelo fallback; circuit se resetea tras 30s |
| S4-7 | Retry con exponential backoff para llamadas LLM | Copilot | P1 | `tenacity` con max 3 retries, backoff 1s→2s→4s, jitter |
| S4-8 | Graceful shutdown: drenar connections, completar queries en vuelo | Copilot | P1 | Signal handler SIGTERM; health endpoint retorna 503 durante drain; max 30s drain |

**Definición de Done Sprint 4:**
- Dashboard Grafana live con datos reales
- Al menos 1 alerta disparada y recibida en test
- Circuit breaker probado: desconectar OpenRouter → queries siguen respondiendo con fallback
- `docker compose down` no pierde queries en vuelo

---

## Fase 2: SaaS Beta Cerrada (Sprints 5–6, Semanas 9–14)

**Milestone: Primeros clientes externos seleccionados usando la plataforma**

### Sprint 5 — Self-Service & Onboarding (Sem 9–11)

| ID | Tarea | Actor | Prioridad | Criterio de Aceptación |
|----|-------|-------|-----------|----------------------|
| S5-1 | Signup flow: registro de organización → primer usuario admin | Humano + Copilot | P0 | Formulario → crear tenant en PG → crear user admin → JWT → redirect a dashboard |
| S5-2 | Agent creation wizard: nombre, descripción, system prompt, upload docs | Humano + Copilot | P0 | UI multi-step; al completar, agente activo con docs indexados |
| S5-3 | Widget embed code generator: copiar snippet `<script src="...">` | Copilot | P0 | Dashboard muestra código embebible personalizado con API key del tenant |
| S5-4 | Implementar metering: contar queries, docs, tokens por tenant por mes | Copilot | P0 | Tabla `usage_metrics(tenant_id, metric, value, period)` + queries de agregación |
| S5-5 | Definir planes: Free (500 queries, 50 docs, 1 agent), Pro, Enterprise | Humano | P0 | Configuración en PG tabla `plans`; enforcement en middleware |
| S5-6 | Integrar Stripe o Lemon Squeezy para cobro | Humano + Copilot | P0 | Webhook recibe payment → activa plan; billing portal accesible desde dashboard |
| S5-7 | Landing page con value proposition y signup CTA | Humano | P1 | Página estática desplegada; SEO básico |

### Sprint 6 — Frontend SDK & Developer Experience (Sem 12–14)

| ID | Tarea | Actor | Prioridad | Criterio de Aceptación |
|----|-------|-------|-----------|----------------------|
| S6-1 | React SDK: `@draga/react-widget` publicable en npm | Copilot + Humano | P0 | `<DragaChat agentId="..." apiKey="..." />` funciona; bundle < 50KB gzip |
| S6-2 | Web Components wrapper para framework-agnostic | Copilot | P1 | `<draga-chat>` custom element funciona en vanilla HTML |
| S6-3 | Storybook con todos los componentes del SDK | Copilot | P1 | Storybook desplegado con ejemplos interactivos |
| S6-4 | Documentación API con Redoc/Swagger + ejemplos copy-paste | Copilot | P0 | Auto-generada desde OpenAPI spec; ejemplos en curl, Python, JS |
| S6-5 | 3 templates de agente: Customer Support, Internal KB, Legal Q&A | Copilot + Humano | P1 | Cada template incluye system prompt, docs de ejemplo, widget config |
| S6-6 | Quickstart guide: "De 0 a agente en 10 minutos" | Humano | P0 | Tutorial paso a paso validado con usuario externo al equipo |

---

## Fase 3: SaaS General Availability (Sprints 7–8, Semanas 15–20)

**Milestone: Plataforma estable con SLAs para clientes de pago**

### Sprint 7 — Escala y Resiliencia (Sem 15–17)

| ID | Tarea | Actor | Prioridad |
|----|-------|-------|-----------|
| S7-1 | Docker Swarm o K8s: despliegue multi-replica del RAG service | Humano + Copilot | P0 |
| S7-2 | Load balancing con sticky sessions para conversations | Copilot + Humano | P1 |
| S7-3 | Backup automatizado PG: pg_dump diario + WAL archiving | Copilot | P0 |
| S7-4 | Disaster recovery: restore documentado y probado | Humano | P0 |
| S7-5 | SLA definition: 99.5% uptime, P95 < 3s, recovery < 1h | Humano | P0 |

### Sprint 8 — Diferenciadores Avanzados + Grounding Estructurado (Sem 18–20)

| ID | Tarea | Actor | Prioridad |
|----|-------|-------|-----------|
| S8-1 | Conectores de datos: Google Drive sync (MVP) | Copilot + Humano | P1 |
| S8-2 | SKOS taxonomy engine: importar, indexar, y resolver taxonomías en SKOS Turtle/JSON-LD | Humano + Copilot | P0 |
| S8-3 | Taxonomy Agent: enriquecimiento de queries con prefLabel/altLabel, validación de clasificaciones en respuestas | Humano + Copilot | P0 |
| S8-4 | Importar GPC (Global Product Classification) como primer esquema estándar para tenants de e-commerce | Copilot | P1 |
| S8-5 | Importar HS codes y UN/LOCODE como esquemas para tenants de logística/comercio exterior | Copilot | P1 |
| S8-6 | Herramienta de generación asistida de taxonomías: proponer SKOS draft a partir de documentos de la KB | Humano + Copilot | P2 |
| S8-7 | Multimodal: extracción de texto de imágenes en PDFs (OCR) | Copilot | P2 |
| S8-8 | Analytics dashboard para clientes: usage, top queries, gap analysis | Copilot + Humano | P1 |

---

## Protocolo de Trabajo Humano-Copilot

### Reglas para Agentes Copilot

1. **Siempre leer ADRs relevantes antes de implementar** — Los ADRs son la fuente de verdad de decisiones arquitectónicas
2. **Seguir el patrón hexagonal existente** — Nuevos adapters implementan ports existentes; nunca importar infraestructura en `domain/`
3. **Cada PR tiene tests** — Mínimo: tests unitarios para lógica nueva; idealmente: test de integración con adapter real
4. **Respetar el fallback JSON→PG** — Usar patrón `if settings.database_url:` para nuevos repos hasta que `REQUIRE_DATABASE` sea default
5. **No romper el pipeline de 14 steps** — Nuevos steps se añaden como opcionales (feature flag) hasta validación A/B
6. **Documentar decisiones no triviales** — Si un copilot toma una decisión de diseño, documentar en PR description con "Decisión:" prefix

### Reglas para Desarrolladores Humanos

1. **Review de seguridad obligatorio** — Todo PR que toque auth, tenant isolation, o API keys requiere review humano
2. **Validar con golden set** — Antes de mergear cambios al pipeline, verificar que el golden set no regresiona
3. **Definir umbrales, no implementar** — En tareas híbridas, el humano define el "qué" y "cuánto", el copilot implementa el "cómo"
4. **Priorizar la tarea de mayor riesgo** — Si hay conflicto de prioridades, elegir la que protege datos de usuario

### Flujo de PR

```
1. Copilot crea branch: feature/S{sprint}-{id}-{descripcion-corta}
2. Copilot implementa + tests
3. CI ejecuta: lint + type-check + tests + golden-set-eval (post Sprint 2)
4. Humano revisa: correctitud, seguridad, alineación con ADRs
5. Merge a main → deploy a staging automático
6. Humano valida en staging → promote a producción
```

---

## Milestones Resumidos

```
Sprint 1 (Sem 1-2)   → PG único                     → DATA FOUNDATION
Sprint 2 (Sem 3-4)   → Hybrid search + CI eval       → QUALITY GATE
Sprint 3 (Sem 5-6)   → JWT + RBAC                    → SECURITY FOUNDATION
Sprint 4 (Sem 7-8)   → Observabilidad + Resiliencia  → PRODUCCIÓN INTERNA ✓
Sprint 5 (Sem 9-11)  → Self-service + Billing         → BETA CERRADA ✓
Sprint 6 (Sem 12-14) → SDK + DX                       → DEVELOPER READY ✓
Sprint 7 (Sem 15-17) → Escala + DR                    → SLA READY ✓
Sprint 8 (Sem 18-20) → Taxonomías + Diferenciadores   → GA + GROUNDING ESTRUCTURADO ✓
```

## Consequences

### Positivas

- **Ruta clara con 57 tareas priorizadas** — cada tarea tiene actor asignado y criterio de aceptación binario
- **Copilots maximizados** — las tareas de boilerplate y migración (que son mayoría) están asignadas a copilots, liberando tiempo humano para decisiones de arquitectura y seguridad
- **Quality gate desde Sprint 2** — golden set en CI protege el 98% anti-hallucination a perpetuidad
- **Incremental** — cada sprint produce un entregable verificable; no hay "big bang"
- **PG primero** — resolver persistencia antes de auth simplifica todo lo demás (users, metering, audit viven en PG)
- **Backward compatible** — API keys siguen funcionando; JSON fallback para dev local

### Negativas

- **Sprint 1 no agrega funcionalidad visible** — es pura infraestructura de persistencia
- **Sprints 1-4 no generan revenue** — inversión de 8 semanas antes de tener billing
- **Carga de testing alta** — cada sprint requiere validación de golden set + isolation + integration
- **Dependencia de OpenRouter** — el circuit breaker mitiga pero no elimina el SPOF

### Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| R1: Migración PG corrompe datos existentes | Media | Alto | Script idempotente + backup previo + rollback documentado |
| R2: JWT agrega latencia al pipeline | Baja | Medio | Token validation en middleware, no en cada step; cache de 5min para token decode |
| R3: Búsqueda híbrida degrada en vez de mejorar | Media | Alto | A/B test obligatorio antes de activar; golden set como safety net |
| R4: Stripe integration se complica | Media | Medio | Lemon Squeezy como alternativa; metering independiente de billing |
| R5: Copilot introduce bug de seguridad | Media | Alto | Review humano obligatorio para auth/tenant; tests de isolation automatizados |
| R6: Equipo no alcanza Sprint 4 en 8 semanas | Media | Medio | Sprints 1-2 son los críticos; 3-4 pueden extenderse sin bloquear uso interno |

## Alternatives Considered

### 1. Usar Keycloak como identity provider

- **Pro**: Feature-complete (SSO, federation, admin UI)
- **Contra**: Overhead operacional alto para equipo pequeño, consumo de RAM ~512MB, curva de aprendizaje
- **Decisión**: Evaluado en Sprint 3, pero se recomienda empezar con solución lightweight (Logto/JWT custom) y migrar a Keycloak si se necesita SSO/federation

### 2. ~~Migrar a Qdrant como único vector DB (eliminar ChromaDB)~~ ✅ COMPLETADO

- **Estado (Feb 2026)**: Migración completada. Qdrant es el único vector DB en producción.
- 5 colecciones activas en Qdrant (167.172.225.44:6333)
- ChromaDB eliminado del stack

### 3. Implementar billing antes de auth

- **Pro**: Revenue más temprano
- **Contra**: Billing sin usuarios identificados es imposible; metering requiere saber quién consume
- **Decisión**: Auth primero (Sprint 3), billing después (Sprint 5)

## References

- `DRAGA.md` — Identidad, metáfora, espectro, anatomía, evolución taxonómica (raíz del repo)
- ADR-016: DRAGA Platform Definition (definición fundacional)
- ADR-012: Production Readiness Roadmap (roadmap original, superseded parcialmente)
- ADR-013: Audit Remediation Hardening (deuda técnica resuelta)
- ADR-014: PostgreSQL Durable Persistence (estado actual de migración PG)
- ADR-001: Multi-Tenant Architecture
- ADR-011: OpenAI-Compatible Chat Completion Protocol
- `draga-strategic-assessment.docx` — Assessment estratégico completo (2026-02-14)
- SKOS Reference (W3C): https://www.w3.org/TR/skos-reference/
- GPC (GS1): https://www.gs1.org/standards/gpc
- UN/LOCODE (UNECE): https://unece.org/trade/uncefact/unlocode
