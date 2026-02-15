# ADR-016: DRAGA Platform — Definición Fundacional

## Status

**Propuesto** — 2026-02-14

Supersede parcial: Este ADR consolida y formaliza la visión de plataforma que evolucionó orgánicamente a través de ADR-001 (Multi-Tenant), ADR-002 (Hexagonal Architecture), ADR-010 (Frontend Ecosystem), y ADR-012 (Production Readiness). Aquellos ADRs siguen vigentes para sus decisiones técnicas específicas; este ADR los unifica bajo una definición de producto coherente.

Documento de referencia: `DRAGA.md` (raíz del repo) contiene la versión narrativa completa de la identidad, metáfora, espectro de complejidad, y evolución hacia grounding estructurado.

---

## Context

### Evolución del Proyecto

El sistema que hoy llamamos DRAGA nació como un MVP monolítico de RAG service para un único caso de uso: soporte al cliente de Envíos23 para regulaciones aduanales de Cuba. En 6 semanas evolucionó a través de 14 ADRs y 230+ PRs hasta convertirse en algo sustancialmente más ambicioso:

```
Ene 2026 — MVP monolítico (1 tenant, 1 query engine, ChromaDB hardcoded)
     └──→ ADR-001: Multi-Tenant Architecture
     └──→ ADR-002: Hexagonal Architecture + RAG Agent Constructor
     └──→ ADR-004: 14-step composable pipeline
     └──→ ADR-010: Frontend Ecosystem (4 repos)
     └──→ ADR-011: OpenAI Protocol compatibility
     └──→ ADR-012: Production Readiness Roadmap (14 épicas completadas)
     └──→ ADR-013: Security & Domain Purity Hardening
     └──→ ADR-014: PostgreSQL Durable Persistence
Feb 2026 — DRAGA Platform: plataforma multi-tenant con 98% anti-hallucination,
            triple protocolo, widget SDK, admin dashboard, y 1.3MB de tests
```

### Problema

A pesar de la madurez técnica alcanzada, **no existía un documento único que defina qué es DRAGA**, su modelo de dominio, sus principios arquitectónicos, su posición competitiva, y su modelo operacional. Los 14 ADRs existentes documentan decisiones individuales pero no articulan la visión unificada.

### Contexto de Mercado

El assessment estratégico (`draga-strategic-assessment.docx`, 2026-02-14) posiciona a DRAGA en un mercado de USD 1.94B (2025) creciendo a 38% CAGR. DRAGA se diferencia por:

- **Framework anti-alucinación auditado (98%)** — vs. marketing claims sin métricas públicas
- **Self-hosted capability** — vs. cloud-only de la mayoría de competidores
- **Arquitectura hexagonal pura** — swap de cualquier componente sin tocar dominio
- **Triple protocolo** — REST + OpenAI-compatible + MCP en un solo backend
- **Espectro completo** — del FAQ Resolver al Estratega de Negocio, misma garantía de grounding
- **Evolución hacia grounding estructurado** — taxonomías SKOS + vocabularios controlados como fuentes de verdad adicionales

---

## Decision

### 1. Nomenclatura

| Término | Definición | Reemplaza a |
|---------|-----------|-------------|
| **DRAGA Platform** | La plataforma completa. Nombre del producto. | DGRAGP, EOD RAG Service |
| **DRAGA** | Document Grounded RAG Agent. Cada instancia. | RAG Agent, bot, chatbot |

La plataforma se llama **DRAGA Platform**. Cada instancia es un **DRAGA**. El acrónimo DGRAGP queda deprecado.

### 2. Anatomía de un DRAGA

Cada DRAGA es una instancia independiente compuesta por **cuatro partes**:

```
┌─────────────────────────────────────────────────────────────────┐
│                           DRAGA                                  │
│                  (Document Grounded RAG Agent)                   │
│                                                                  │
│  ┌───────────────┐  ┌──────────────────────────────────────┐    │
│  │   Tenant       │  │     Knowledge Base                    │    │
│  │               │  │     + Taxonomías SKOS (evolución)     │    │
│  └───────────────┘  └──────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Orchestrator Agent                            │   │
│  │  Pipeline de 14 pasos (translate → validate)              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Agent Crew                                    │   │
│  │  Retrieval · Grounding · Language · Ingestion ·            │   │
│  │  Feedback · Quality · Taxonomy* (*roadmap)                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

- **Tenant**: La organización que opera el DRAGA. Define usuarios, plan, API keys, configuración.
- **Knowledge Base**: El corpus documental que fundamenta las respuestas. Colección vectorial aislada. En evolución: complementada con taxonomías SKOS como fuentes adicionales de grounding.
- **Orchestrator Agent**: El agente central que ejecuta el pipeline de 14 pasos.
- **Agent Crew**: Equipo de agentes especializados al servicio del Orchestrator (6 actuales + 1 en roadmap).

### 3. Espectro de Complejidad

DRAGA Platform cubre un espectro completo de casos de uso con la **misma garantía de grounding**:

| Nivel | Rol | KB Típica | Ejemplo |
|-------|-----|----------|---------|
| 1 | FAQ Resolver | 1-50 docs | "¿Cuánto cuesta un envío a Cuba?" |
| 2 | Soporte Técnico | 10-200 docs | "¿Cómo configuro el webhook de notificaciones?" |
| 3 | Asesor Especializado | 50-500 docs | "¿Qué normativa aplica a este producto en MX y BR?" |
| 4 | Analista de Cadena | 200-1000 docs | "¿Dónde están los cuellos de botella en mi logística?" |
| 5 | Estratega de Negocio | 1000+ docs | "¿Cómo debería ajustar la estrategia para Q3?" |

La confianza no disminuye con la complejidad. Un DRAGA de Nivel 1 y uno de Nivel 5 ofrecen el mismo nivel de verificabilidad: fuentes citadas, grounding rate medible, confidence score, y deflection cuando no hay información suficiente.

### 4. Agent Crew

| Agente | Responsabilidad |
|--------|----------------|
| **Retrieval Agent** | Búsqueda vectorial + adaptive top_k + deduplicación + cross-encoder reranking |
| **Grounding Agent** | NLI verification + token overlap + evaluación de suficiencia (Self-RAG) |
| **Language Agent** | Detección de idioma + traducción + normalización de queries |
| **Ingestion Agent** | Procesamiento de documentos + chunking + enriquecimiento + NER |
| **Feedback Agent** | Aprendizaje del feedback de usuarios + enriquecimiento de queries |
| **Quality Agent** | Gap logging + coverage audit + métricas de grounding |
| **Taxonomy Agent** *(roadmap)* | Resolución de sinónimos, navegación jerárquica, validación de clasificaciones |

### 5. Evolución: Grounding Estructurado con Taxonomías

La Knowledge Base evoluciona de texto puro hacia conocimiento estructurado. Las taxonomías SKOS se integran como fuentes adicionales de grounding:

**Fase actual — Grounding Textual**: KB documental (chunks de texto). Suficiente para Niveles 1-3.

**Fase siguiente — Grounding Taxonómico**: KB + taxonomías SKOS (vocabularios controlados, jerarquías, sinónimos). Esquemas como GPC (clasificación de productos), HS (códigos aduanales), UN/LOCODE (locaciones de comercio), Incoterms, UNSPSC, y taxonomías propias del tenant. El Taxonomy Agent opera en pre-retrieval (enriquece query con términos canónicos), post-retrieval (filtra por clasificación), y verification (valida consistencia). Habilita Niveles 1-4.

**Fase futura — Grounding Ontológico**: KB + taxonomías + ontologías OWL (relaciones complejas, axiomas, inferencia lógica). Habilita razonamiento multi-hop para Niveles 4-5.

SKOS es la lingua franca: todos los esquemas externos se representan internamente como `skos:ConceptScheme` con `prefLabel`, `altLabel`, `broader`, `narrower`, `related`. Las taxonomías se integran dinámicamente (importación SKOS/CSV, actualización periódica, composición múltiple).

### 6. Invariantes de Dominio

Estas reglas no se negocian. Si un feature o cambio las viola, no se implementa.

1. **Grounding Absoluto**: Un DRAGA nunca genera información que no esté en su Knowledge Base (ni en sus taxonomías registradas). Si el contexto es insuficiente, deflecta. No hay excepciones.

2. **Aislamiento de Tenant**: Un tenant nunca accede a datos de otro tenant. Esto se aplica a nivel de vector DB, cache, taxonomías, API, y persistencia. Los tests de aislamiento bloquean releases.

3. **Independencia de Infraestructura**: El domain layer tiene cero dependencias externas. La pureza se verifica con tests AST automatizados (ADR-013).

4. **Verificabilidad**: Toda respuesta incluye metadata de confianza (confidence score, grounding rate, sources, latency). El framework anti-alucinación tiene cobertura medible (actualmente 98%).

5. **Composabilidad del Pipeline**: Cada paso es `(PipelineContext) → PipelineContext`. Sustituible, desactivable (feature flags), testeable en aislamiento. Nuevos pasos (como el futuro Taxonomy Agent) no rompen los existentes.

6. **Protocol Agnosticism**: Un DRAGA es accesible por REST, OpenAI-compatible, y MCP con el mismo comportamiento.

### 7. Principios de Diseño (en orden de prioridad)

1. **Grounding sobre Fluency** — respuesta correcta > respuesta elocuente
2. **Seguridad sobre Conveniencia** — defaults seguros, relajación es opt-in
3. **Aislamiento sobre Performance** — optimizaciones no comprometen aislamiento
4. **Composabilidad sobre Completitud** — N pasos simples > 1 paso monolítico
5. **Verificabilidad sobre Velocidad** — cada feature tiene tests + golden set
6. **Self-hosted First** — funciona en VPS + Docker antes que en cloud managed
7. **Convention over Configuration** — defaults producen un DRAGA funcional y seguro

---

### 8. Arquitectura (resumen)

```
                    ┌───────────────────────────────────────────────────────┐
                    │                  Inbound Adapters                      │
                    │                                                       │
                    │  REST API v2     OpenAI Chat API     MCP Server       │
                    │  (FastAPI)       (/v1/chat/comp.)    (stdio/SSE)      │
                    │                                                       │
                    │  Admin Dashboard   Widget SDK        KB Management    │
                    │  (HTML/JS)         (JS embebible)    (HTML/JS)        │
                    └──────────────────────┬────────────────────────────────┘
                                           │
                    ┌──────────────────────▼────────────────────────────────┐
                    │                   Use Cases                            │
                    │                                                       │
                    │  QueryRAGAgent     IngestDocuments    CreateRAGAgent   │
                    │  DeleteRAGAgent    ChatCompletion     CreateABExper.   │
                    │  ManageAPIKeys     ConfigureWidget    RecordFeedback   │
                    └──────────────────────┬────────────────────────────────┘
                                           │
          ┌────────────────────────────────▼────────────────────────────────┐
          │                        Domain Layer                              │
          │                    (zero external deps)                          │
          │                                                                  │
          │  Entities:        RAGAgent, RAGAgentConfig, DocumentIngestResult │
          │  Value Objects:   GroundingResult, WidgetConfig, Conversation,   │
          │                   ABExperiment, GapLogEntry, MetricsSnapshot,    │
          │                   ChatCompletion, TenantId, AgentDefaults        │
          │  Domain Services: MarkdownChunker, QueryNormalizer, SourceTypes, │
          │                   AdaptiveRetrieval, ChunkDeduplication,          │
          │                   CoverageAuditor, DataNormalizer, FeedbackLoop, │
          │                   HyDEGenerator, IntentRetrievalRouter,          │
          │                   MetadataExtractor, NLIHallucinationDetector,   │
          │                   QueryDecomposition, TableQualityValidator      │
          │  RAG Pipeline:    14 composable steps (translate → validate)     │
          │  RAGDomainService: Orchestrator principal                        │
          └────────────────────────────────┬────────────────────────────────┘
                                           │
              ┌────────────────────────────▼────────────────────────────────┐
              │                     Outbound Ports (30+)                     │
              │                                                             │
              │  VectorRepositoryPort      EmbeddingServicePort             │
              │  LLMServicePort            CacheRepositoryPort              │
              │  AuthenticationPort         AgentRepositoryPort              │
              │  AgentResolverPort          TenantRepositoryPort             │
              │  APIKeyRepositoryPort       WidgetConfigRepositoryPort       │
              │  DocumentManagementPort     ConversationRepositoryPort       │
              │  FeedbackRepositoryPort     FeedbackInsightsPort             │
              │  AuditLogPort              FeatureFlagPort                   │
              │  GapLogPort                TaskStorePort                     │
              │  ABExperimentRepository     QueryMetricsPort                 │
              │  SemanticCachePort          CostTrackerPort                  │
              │  MetricsAggregationPort     LanguageDetectorPort             │
              │  CrossEncoderPort           ContextEvaluatorPort             │
              │  QueryDecomposerPort        SemanticChunkerPort              │
              │  NERPort                    HyDEEnrichmentPort               │
              │  ChunkEnrichmentPort                                        │
              └────────────────────────────┬────────────────────────────────┘
                                           │
              ┌────────────────────────────▼────────────────────────────────┐
              │                    Outbound Adapters                         │
              │                                                             │
              │  Persistence:  ChromaDB, Qdrant, Redis, PostgreSQL, JSON    │
              │  Processing:   TEI Embeddings, Document Processor, Loaders  │
              │  External:     OpenRouter (LLM), Model Router, HyDE, NER    │
              │  Detection:    Language Detector                            │
              └─────────────────────────────────────────────────────────────┘
```

#### 3.2 RAG Pipeline (14 Steps)

El pipeline es el corazón funcional de cada DRAGA. Cada query pasa por estos 14 pasos:

```
 Query del End User
       │
       ▼
 ┌─ PRE-RETRIEVAL ──────────────────────────────────────────────────────┐
 │  1. translate_query      — Detecta idioma, traduce si es cross-lingual│
 │  2. enrich_from_feedback — Enriquece con feedback histórico           │
 │  3. normalize_query      — Normaliza, corrige ortografía, stopwords   │
 │  4. decompose_query      — Descompone queries complejas en sub-queries│
 └───────────────────────────────────────────────────────────────────────┘
       │
       ▼
 ┌─ RETRIEVAL ──────────────────────────────────────────────────────────┐
 │  5. embed_query          — Genera embedding vectorial                 │
 │  6. cache_lookup         — Semantic cache (similarity threshold)      │
 │  7. retrieve_chunks      — Búsqueda vectorial + adaptive top_k        │
 └───────────────────────────────────────────────────────────────────────┘
       │
       ▼
 ┌─ POST-RETRIEVAL ─────────────────────────────────────────────────────┐
 │  8. deduplicate_chunks   — Deduplicación por Jaccard + diversidad     │
 │  9. rerank_chunks        — Cross-encoder reranking                    │
 │ 10. evaluate_context     — Self-RAG: evaluación de suficiencia        │
 │ 11. record_gap           — Logging de gaps en Knowledge Base          │
 └───────────────────────────────────────────────────────────────────────┘
       │
       ▼
 ┌─ GENERATION + VERIFICATION ──────────────────────────────────────────┐
 │ 12. generate_response    — Generación con LLM (multi-provider)        │
 │ 13. verify_grounding     — NLI hallucination detection + overlap      │
 │ 14. validate_response    — Validación final + métricas + cache store  │
 └───────────────────────────────────────────────────────────────────────┘
       │
       ▼
 Respuesta verificada con confidence score, sources, y grounding rate
```

#### 3.3 Framework Anti-Alucinación (3 Capas, 98% Cobertura)

Este es el diferenciador técnico central de DRAGA. Opera en tres capas:

**Capa 1 — Ingestión (98% cobertura)**

La calidad de las respuestas empieza en cómo se procesan los documentos:

- Chunking semántico por headers Markdown con merge de chunks pequeños
- Estrategias por tipo de fuente (`ChunkingStrategy`: legislation → 1000 chars, FAQ → 600 chars, etc.)
- Enriquecimiento LLM de chunks: keywords, audience, topic, summary, intent
- NER (Named Entity Recognition) para extracción de entidades
- Deduplicación por content hash para eliminar redundancia
- Validación de calidad de tablas extraídas
- Auto-sizing de chunks por capacidad del modelo de embeddings

**Capa 2 — Prompt Engineering (95% cobertura)**

Los prompts son versionados (actualmente v1.3.0) e incluyen:

- Políticas de objetividad, consistencia, y precisión
- 5 patrones defensivos documentados con ejemplos negativos (❌) y positivos (✅)
- Instrucción explícita de deflection: "Si no tienes información suficiente, dilo"
- Response policy configurable por tenant (idioma, estilo, nivel de detalle)
- System prompt personalizable por DRAGA

**Capa 3 — Comportamiento del Agente (98% cobertura)**

Post-generación, el sistema verifica activamente:

- Grounding verification: token overlap + NLI (Natural Language Inference) entre claims y chunks
- Evaluación de suficiencia de contexto (Self-RAG pattern)
- Gap logging con resolución: preguntas sin respuesta se loguean para mejora continua
- Feedback loop: feedback de End Users alimenta el pipeline
- Respuestas parciales cuando el contexto es limitado pero no vacío
- Per-tenant threshold calibration para ajustar sensibilidad

#### 3.4 Multi-Tenancy

Cada tenant opera en aislamiento completo:

| Recurso | Mecanismo de Aislamiento |
|---------|------------------------|
| Knowledge Base | Colección vectorial separada: `kb_{tenant_id}` |
| Cache | Namespace Redis por tenant |
| Configuración | Registro en PostgreSQL filtrado por `tenant_id` |
| API Keys | Scoped por tenant, SHA-256 hashed |
| Conversations | Tabla PG filtrada por tenant |
| Feedback | Directorio/tabla separada por tenant |
| Widget | Configuración independiente por tenant |
| LLM Models | Lista de modelos permitidos por tenant |
| System Prompt | Personalizable por tenant/agente |

#### 3.5 Protocolos de Acceso

Un DRAGA es accesible por tres protocolos simultáneamente:

| Protocolo | Endpoint | Caso de Uso |
|-----------|----------|-------------|
| **REST API v2** | `/api/v2/*` | API nativa para integración custom, admin operations, ingestion |
| **OpenAI-Compatible** | `/v2/chat/completions` | Drop-in con cualquier frontend que soporte OpenAI (Chatbot UI, Open WebUI, custom) |
| **MCP** | stdio/SSE | Integración con Claude Desktop, agentes MCP, ecosistemas AI-native |

#### 3.6 Infraestructura (Hexagonal Stacks)

El despliegue sigue la arquitectura hexagonal en 4 Docker Compose stacks independientes:

```
stack-infrastructure.yml        → Traefik (reverse proxy + SSL) + Portainer
stack-adapters-persistence.yml  → ChromaDB + Qdrant + Redis + PostgreSQL
stack-adapters-processing.yml   → TEI Embeddings (HuggingFace)
stack-domain-rag.yml            → RAG Service (FastAPI) — el core
```

Cada stack se despliega, escala, y actualiza independientemente.

---

### 4. Estado Actual del Sistema

#### 4.1 Inventario de Capabilities (2026-02-14)

| Capability | Estado | Producción | ADR |
|-----------|--------|------------|-----|
| RAG Query Pipeline (14 steps) | ✅ Completo | ✅ Ready | ADR-004 |
| Anti-Alucinación (98% cobertura) | ✅ Completo | ✅ Ready | — |
| Multi-Tenant Isolation | ✅ Completo | ⚠️ Sin verified tests | ADR-001 |
| Hexagonal Architecture (30+ ports) | ✅ Completo | ✅ Ready | ADR-002 |
| OpenAI-Compatible API | ✅ Completo | ✅ Ready | ADR-011 |
| MCP Protocol | ✅ Completo | ✅ Ready | — |
| Document Ingestion (PDF, DOCX, HTML, MD, XLSX) | ✅ Completo | ✅ Ready | ADR-009 |
| A/B Testing | ✅ Completo | ✅ Ready | ADR-007 |
| Widget SDK (JS embebible) | ✅ Completo | ✅ Ready | ADR-010 |
| Admin Dashboard (HTML) | ✅ Completo | ⚠️ Estático | — |
| KB Management UI | ✅ Completo | ⚠️ Estático | — |
| Auth (API Keys SHA-256 + scopes + rate limit) | ✅ Completo | ✅ Ready | ADR-013 |
| PostgreSQL (2/11 repos migrados) | ⚠️ Parcial | ⚠️ Incompleto | ADR-014 |
| Structured Logging (JSON) | ✅ Completo | ✅ Ready | — |
| Docker + Traefik + GHCR | ✅ Completo | ⚠️ Single node | ADR-002 |
| Conversation History | ✅ Completo | ✅ Ready | — |
| Feedback System | ✅ Completo | ✅ Ready | — |
| Feature Flags | ✅ Completo | ✅ Ready | — |
| Cost Tracking | ✅ Completo | ✅ Ready | — |
| Test Suite (1.3MB+) | ✅ Extenso | ⚠️ Sin coverage report | ADR-013 |

#### 4.2 GAPs Conocidos hacia SaaS

Documentados en detalle en ADR-015 (Plan de Acción SaaS). Resumen ejecutivo:

| GAP | Criticidad | Sprint Target (ADR-015) |
|-----|-----------|------------------------|
| PostgreSQL como único store (9 repos en JSON) | Bloqueante | Sprint 1 |
| Búsqueda híbrida (BM25 + dense) | Alto | Sprint 2 |
| Golden set eval en CI | Alto | Sprint 2 |
| JWT + RBAC (Identity & Access Management) | Bloqueante | Sprint 3 |
| Observabilidad (Prometheus + Grafana) | Alto | Sprint 4 |
| Circuit breaker + fallback LLM | Alto | Sprint 4 |
| Self-service onboarding | Bloqueante para SaaS | Sprint 5 |
| Billing & metering | Bloqueante para SaaS | Sprint 5 |
| React SDK | Alto | Sprint 6 |

---

### 5. Principios de Diseño

Estos principios guían toda decisión técnica y de producto en DRAGA. Cuando hay conflicto, se resuelven en el orden listado (1 tiene prioridad sobre 2, etc.):

1. **Grounding sobre Fluency**: Una respuesta correcta pero torpe es preferible a una respuesta elocuente pero inventada. La calidad se mide por grounding rate, no por estilo.

2. **Seguridad sobre Conveniencia**: El default es seguro (CORS cerrado, auth obligatorio, aislamiento verificado). Cada relajación requiere justificación explícita y es opt-in.

3. **Aislamiento sobre Performance**: Si una optimización compromete el aislamiento de tenant, no se implementa. Caches compartidos, embeddings compartidos, o cualquier recurso cross-tenant requieren proof de aislamiento.

4. **Composabilidad sobre Completitud**: Es preferible tener N pasos simples y sustituibles que un paso monolítico que lo hace todo. El pipeline de 14 steps es el ejemplo canónico.

5. **Verificabilidad sobre Velocidad de Features**: Cada feature nuevo tiene tests. Cada cambio al pipeline se valida contra golden sets. La velocidad de desarrollo no justifica saltar la verificación.

6. **Self-hosted First**: DRAGA debe funcionar desplegada en un VPS con Docker Compose antes de funcionar en cloud managed. Esto es un diferenciador de mercado (no todos los clientes pueden/quieren SaaS cloud).

7. **Convention over Configuration**: Los defaults deben producir un DRAGA funcional y seguro. Un DRAGA Owner debería poder crear un agente útil cambiando solo el system prompt y subiendo documentos.

---

### 6. Modelo de Negocio

#### 6.1 Audiencias y Propuestas de Valor

| Audiencia | Propuesta de Valor | Canal |
|-----------|-------------------|-------|
| **Treew (interno)** | DRAGAs para soporte al cliente, docs técnicos, onboarding | Uso directo, sin billing |
| **PYMES Latam** | Agente de soporte documental en español, setup < 15 min | SaaS self-service, planes escalables |
| **Empresas con data sensitivity** | Self-hosted on-premises, sin datos en cloud de terceros | Enterprise plan, soporte dedicado |
| **Agencias / Consultoras** | White-label: crear DRAGAs para sus clientes | Reseller/partner program |

#### 6.2 Planes de Uso Sugeridos

| Plan | Queries/mes | Documentos | Agentes | Precio |
|------|------------|-----------|---------|--------|
| Free | 500 | 50 | 1 | Gratis |
| Starter | 5,000 | 500 | 3 | $49/mes |
| Pro | 25,000 | 2,500 | 10 | $199/mes |
| Enterprise | Ilimitado | Ilimitado | Ilimitado | Custom |

---

## Consequences

### Positivas

- **Vocabulario unificado**: DRAGA Platform y DRAGA reemplazan toda nomenclatura anterior (DGRAGP, EOD RAG Service)
- **Anatomía de cuatro partes** (Tenant, KB, Orchestrator, Agent Crew) da estructura clara a toda conversación sobre el sistema
- **Espectro de complejidad** (Niveles 1-5) permite posicionar cada caso de uso con expectativas claras
- **Visión evolutiva explícita**: Grounding Textual → Taxonómico → Ontológico da dirección al roadmap técnico
- **Principios priorizados** arbitran conflictos de diseño sin ambigüedad
- **Onboarding acelerado**: Nuevos miembros y copilots leen `DRAGA.md` + este ADR para entender todo

### Negativas

- **Rename pendiente**: El repositorio aún se llama `eod-api-rag-service`. Migración incremental planificada en ADR-015
- **Taxonomías son roadmap**: El Taxonomy Agent y la integración SKOS aún no están implementados
- **Tensión DRAGA vs RAGAgent en código**: La entidad de dominio sigue siendo `RAGAgent`; el rename de clases es deliberadamente último

### Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El rename del repo rompe CI/CD | Hacerlo como tarea atómica con checklist; mantener redirect del nombre antiguo |
| Los principios se vuelven dogmáticos | Revisar principios cada 6 meses; los principios guían, no reemplazan el juicio |
| El modelo de dominio diverge del código | Tests de pureza AST (ADR-013) + review de PRs contra este ADR |

---

## Alternatives Considered

### 1. No crear un ADR fundacional — seguir con ADRs incrementales

- **Pro**: Menos trabajo ahora
- **Contra**: La fragmentación de visión empeora con cada nuevo ADR; los copilots no tienen un documento de referencia unificado
- **Rechazada**: El costo de la indefinición ya es real (README desactualizado, terminología inconsistente)

### 2. Crear un Product Requirements Document (PRD) separado en vez de ADR

- **Pro**: Separación clásica de arquitectura vs. producto
- **Contra**: El equipo ya consume ADRs como fuente de verdad; un PRD adicional compite por atención y puede divergir
- **Rechazada**: Un ADR que incluye contexto de producto es más útil que dos documentos que nadie sincroniza

### 3. Renombrar el repositorio antes de este ADR

- **Pro**: Coherencia inmediata entre nombre y contenido
- **Contra**: Rename tiene dependencias operacionales (CI, deploy, imports); hacerlo primero bloquea el ADR
- **Rechazada**: El ADR establece el vocabulario; el rename se ejecuta como tarea de Sprint 1 (ADR-015)

---

## References

### Documentos del Proyecto

- `DRAGA.md` — Identidad, metáfora, espectro, anatomía, taxonomías (raíz del repo)
- ADR-015: Plan de Acción SaaS (2026-02-14)
- ADR-001: Multi-Tenant Architecture (2026-02-03)
- ADR-002: Hexagonal Architecture for RAG Agent Constructor (2026-02-06)
- ADR-004: RAG Patterns Evaluation & Restructure (2026-02-08)
- ADR-009: Ingestion Bounded Context (2026-02-12)
- ADR-010: Frontend Ecosystem Strategy (2026-02-12)
- ADR-011: OpenAI-Compatible Chat Completion Protocol (2026-02-12)
- ADR-012: Production Readiness Roadmap (2026-02-13)
- ADR-013: Audit Remediation Hardening (2026-02-14)
- ADR-014: PostgreSQL Durable Persistence (2026-02-14)
- `draga-strategic-assessment.docx` — Assessment estratégico completo (2026-02-14)

### Estándares de Taxonomías y Vocabularios Controlados

- SKOS (W3C): https://www.w3.org/TR/skos-reference/
- GPC (GS1 Global Product Classification): https://www.gs1.org/standards/gpc
- HS (Harmonized System / OMA): https://www.wcoomd.org/en/topics/nomenclature.aspx
- UN/LOCODE (UNECE): https://unece.org/trade/uncefact/unlocode
- UNSPSC: https://www.unspsc.org/
- Schema.org: https://schema.org/

### Competidores Referenciados

- Vectara: https://vectara.com
- Ragie: https://ragie.ai
- Nuclia: https://nuclia.com
- LlamaCloud: https://cloud.llamaindex.ai
- Graphlit: https://graphlit.com
