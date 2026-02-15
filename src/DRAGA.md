# DRAGA Platform

<p align="center">
  <img src="docs/assets/draga-hero.png" alt="DRAGA: Claridad en la Profundidad de tus Datos" width="100%">
</p>

## Identidad

**DRAGA Platform** es una plataforma SaaS para la creación y operación de **DRAGAs** — agentes conversacionales cuyas respuestas están fundamentadas exclusivamente en documentos.

**DRAGA** es el acrónimo de **Document Grounded RAG Agent**.

La plataforma genera instancias. Cada instancia es un **DRAGA**.

> *"Profundizamos en tus datos, elevamos tu negocio."*

---

## La Metáfora: Profundidad para la Claridad

Una draga no es simplemente una máquina que mueve tierra. Es una herramienta de infraestructura vital que limpia canales para que el comercio fluya y recupera materiales valiosos del fondo. Esa es exactamente la función de DRAGA Platform en una organización.

### Los Tres Pilares del Dragado Organizacional

#### 1. Dragado de Datos — Limpieza del Lecho

En las organizaciones, la información suele estar "sedimentada" en silos, documentos obsoletos y carpetas profundas que bloquean el flujo de decisiones. DRAGA limpia ese lecho, eliminando el ruido y dejando solo la **verdad organizacional**.

Cuando un DRAGA ingiere documentos, no los acumula — los procesa, los chunkea semánticamente, los enriquece con metadata, los deduplica por content hash, y los indexa para retrieval preciso. El "sedimento" (información duplicada, obsoleta, contradictoria) se elimina. Lo que queda es un canal limpio de conocimiento.

#### 2. Recuperación de Valor — Extracción de Activos Intelectuales

Al igual que una draga recupera minerales o arena útil del fondo, DRAGA Platform extrae el conocimiento "enterrado" en miles de documentos para ponerlo a trabajar en la superficie.

Cada query es una operación de extracción: el Orchestrator desciende a la profundidad de la Knowledge Base, el Retrieval Agent "pesca" los fragmentos relevantes con búsqueda vectorial y reranking, el Grounding Agent verifica que lo extraído sea auténtico, y la respuesta emerge — limpia, fundamentada, trazable a su fuente.

#### 3. Navegabilidad y Escalamiento — Canales para Crecer

Una zona dragada permite que barcos más grandes — proyectos, socios, departamentos — naveguen sin encallar. DRAGA es el habilitador que permite que la organización escale porque el "canal de conocimiento" es profundo y seguro.

Un DRAGA de soporte al cliente resuelve consultas sin saturar al equipo humano. Un DRAGA de onboarding técnico acelera la incorporación de nuevos miembros. Un DRAGA de compliance mantiene actualizadas las regulaciones que afectan operaciones. Cada DRAGA es un canal dragado que profundiza la capacidad operacional.

### Narrativa de Marca

> *En el fondo de cada organización yace un océano de datos sedimentados. DRAGA no solo busca información; profundiza en el lecho de su conocimiento documental para limpiar las vías de decisión, recuperar los activos intelectuales más valiosos y garantizar que su estructura organizacional pueda navegar hacia el siguiente nivel de escala.*
>
> *No solo respondemos preguntas; despejamos el camino.*

### Identidad Visual

**Paleta de colores**:

| Color | Hex | Rol |
|-------|-----|-----|
| **Azul Profundo** (Deep Sea) | `#0A2540` | La base de datos y la profundidad del conocimiento |
| **Turquesa Eléctrico** (Cian) | `#00D4AA` | La tecnología, la limpieza, el flujo de información |
| **Oro / Ámbar** | `#D4A017` | El insight, la información recuperada, el valor extraído |
| **Blanco Claro** | `#F8FFFE` | La superficie: la respuesta limpia y clara |

**Estética de interfaz**: Diagramas de nodos que fluyen como corrientes marinas. Cuando el Orchestrator hace retrieval, la experiencia visual simula una luz que desciende a la profundidad y "pesca" solo los fragmentos relevantes, subiéndolos a una superficie clara y organizada.

**Eslóganes**:
- *"DRAGA: Profundizamos en tus datos, elevamos tu negocio."* — Principal
- *"Claridad en la profundidad."* — Compacto
- *"Extrayendo el valor que tus documentos ocultan."* — Funcional

### La Metáfora en el Producto

La metáfora de la draga no es solo marketing — se refleja en las capabilities técnicas:

| Metáfora | Capability Técnica |
|----------|-------------------|
| Limpieza del lecho | **Ingestion Agent**: chunking semántico + deduplicación + enriquecimiento LLM eliminan el "sedimento" documental |
| Descenso a la profundidad | **Retrieval Agent**: búsqueda vectorial + adaptive top_k + cross-encoder reranking "desciende" a la KB |
| Extracción precisa | **Grounding Agent**: NLI verification + token overlap garantizan que solo suba a la superficie lo que es auténtico |
| Canal navegable | **Orchestrator**: el pipeline de 14 pasos es el canal — cada step lo ensancha y profundiza |
| Navegación sin encallar | **Quality Agent**: gap logging + coverage audit detectan las "zonas poco profundas" de la KB antes de que el End User encalle |
| Barcos más grandes | **Escalamiento**: cada DRAGA nuevo es un canal adicional que amplía la capacidad organizacional |

---

## Visión: Un Espectro, Una Garantía

DRAGA Platform no es una herramienta para un solo caso de uso. Es una plataforma de amplio espectro que cubre desde el asistente más simple hasta el asesor más complejo — con la misma garantía fundamental: **toda respuesta está grounded en una verdad explicitada**.

### El Espectro DRAGA

```
                          El Espectro de Complejidad DRAGA
                 ─────────────────────────────────────────────────

  SIMPLE                                                         COMPLEJO
    │                                                                │
    ▼                                                                ▼

 ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
 │   FAQ    │   │ Soporte  │   │ Asesor   │   │ Analista │   │ Estratega│
 │ Resolver │   │ Técnico  │   │ Especial.│   │ de Cadena│   │ de Negoc.│
 │          │   │          │   │          │   │          │   │          │
 │ "¿Cuánto │   │ "¿Cómo   │   │ "¿Qué    │   │ "¿Dónde  │   │ "¿Cómo   │
 │  cuesta  │   │  configu-│   │  norm.   │   │  están   │   │  optimizo│
 │  un envío│   │  ro el   │   │  aplica  │   │  los     │   │  la ruta │
 │  a Cuba?"│   │  webhook │   │  a este  │   │  cuellos │   │  logísti-│
 │          │   │  de noti-│   │  produc- │   │  de      │   │  ca para │
 │          │   │  ficacio-│   │  to?"    │   │  botella │   │  Q3?"    │
 │          │   │  nes?"   │   │          │   │  en mi   │   │          │
 │          │   │          │   │          │   │  cadena?"│   │          │
 └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘
      │              │              │              │              │
      ▼              ▼              ▼              ▼              ▼
   1-2 docs      10-50 docs    50-200 docs   200-1000 docs  1000+ docs
   1 agente      2-3 agentes   3-4 agentes   4-6 agentes    6+ agentes
   Retrieval     + Language    + Feedback    + Quality       + Graph*
   directo       + Grounding   + Quality     + Analytics*    + Multimodal*

 ─────────────────────────────────────────────────────────────────────────
                   MISMA GARANTÍA DE GROUNDING EN TODO EL ESPECTRO
                   Cada respuesta trazable a su fuente documental
 ─────────────────────────────────────────────────────────────────────────
                                                          * roadmap futuro
```

### Lo que une al espectro

Un DRAGA que responde "el envío marítimo tarda 15-20 días" y un DRAGA que recomienda "optimizar la ruta logística consolidando los embarques de Miami y Houston en un solo contenedor semanal" comparten algo fundamental: **ambas respuestas están grounded en documentos concretos que el tenant proporcionó**. El End User puede verificar la fuente. El DRAGA Owner puede auditar el razonamiento. No hay caja negra.

Esta es la promesa de DRAGA Platform: **la confianza no disminuye con la complejidad**. Un DRAGA simple inspira confianza porque cita el documento exacto del que extrajo la respuesta. Un DRAGA complejo inspira la misma confianza porque cada recomendación, por sofisticada que sea, es trazable a su evidencia documental.

### Los cinco niveles de profundidad

#### Nivel 1 — FAQ Resolver

El DRAGA más simple. Un End User pregunta, el DRAGA busca en la KB y responde. Caso de uso clásico: atención al cliente, preguntas frecuentes, consultas sobre productos o servicios.

**Lo que lo hace valioso**: Resuelve el 70-80% de las consultas repetitivas sin intervención humana, liberando al equipo para los casos que realmente necesitan criterio humano. Cada respuesta incluye la fuente, así que el End User sabe que no es una invención.

**KB típica**: FAQs, catálogos de productos, políticas de servicio, términos y condiciones.

#### Nivel 2 — Soporte Técnico

El DRAGA entiende contexto técnico. Puede guiar al usuario a través de procedimientos multi-paso, distinguir entre versiones de un producto, y adaptar su respuesta al nivel técnico de la pregunta.

**Lo que lo hace valioso**: Escala el conocimiento del equipo técnico. En vez de que un senior repita la misma explicación 50 veces, el DRAGA lo hace con la misma calidad y paciencia, siempre grounded en la documentación oficial.

**KB típica**: Documentación técnica, guías de integración, runbooks, changelogs, ADRs.

#### Nivel 3 — Asesor Especializado

El DRAGA cruza información entre múltiples documentos para dar recomendaciones contextualizadas. Entiende regulaciones, normativas, especificaciones técnicas, y puede aplicarlas a casos específicos que el End User plantea.

**Lo que lo hace valioso**: Democratiza el acceso a expertise especializado. Un DRAGA de regulaciones aduanales no reemplaza al especialista — pero permite que cualquier operador consulte normativas complejas y obtenga respuestas precisas fundamentadas en el texto legal vigente, 24/7.

**KB típica**: Regulaciones, normativas, marcos legales, especificaciones técnicas, manuales de procedimientos, estándares de industria.

#### Nivel 4 — Analista de Cadena

El DRAGA ilumina patrones y relaciones que existen en la documentación pero que ningún humano tiene tiempo de cruzar manualmente. Conecta información dispersa en cientos de documentos para responder preguntas analíticas: dónde están los cuellos de botella, qué proveedores cumplen qué criterios, cómo se comparan las métricas operacionales entre períodos.

**Lo que lo hace valioso**: Convierte el conocimiento acumulado de una operación en inteligencia accionable. La KB no es solo referencia — es un corpus analizable que revela insights cuando se le hacen las preguntas correctas. Y cada insight es trazable.

**KB típica**: Reportes operacionales, SLAs de proveedores, métricas históricas, documentación de procesos, post-mortems, lecciones aprendidas.

#### Nivel 5 — Estratega de Negocio

El DRAGA más profundo. Sintetiza conocimiento de toda una línea de negocio, un producto, o una cadena de valor para informar decisiones estratégicas. No decide — ilumina. Presenta la evidencia documental que sustenta cada perspectiva, permitiendo que el tomador de decisiones actúe con confianza.

**Lo que lo hace valioso**: El conocimiento estratégico de una organización suele estar distribuido en cientos de documentos que nadie lee completos. Un DRAGA de este nivel los lee todos, los cruza, y cuando un director pregunta "¿cómo debería ajustar la estrategia para Q3?", la respuesta viene fundamentada en datos operacionales reales, no en opiniones.

**KB típica**: Planes estratégicos, análisis de mercado, reportes financieros, documentación de producto completa, competitive intelligence, roadmaps, OKRs, retrospectivas.

### La confianza como producto

Lo que hace especial a DRAGA Platform no es la sofisticación del procesamiento — el mercado tiene muchos motores RAG. Lo especial es que **la confianza es una propiedad del sistema, no una promesa de marketing**.

Cuando un DRAGA responde, incluye:

- **Las fuentes documentales** que sustentan la respuesta
- **El grounding rate** — qué porcentaje de los claims están verificados
- **El confidence score** — la evaluación de suficiencia del contexto
- **La deflection** cuando no tiene información suficiente — que es más valiosa que una respuesta inventada

Esto significa que un DRAGA de Nivel 1 respondiendo "el envío cuesta $45" y un DRAGA de Nivel 5 recomendando "consolidar las rutas de Miami y Houston" ofrecen el mismo nivel de verificabilidad. El End User y el DRAGA Owner pueden auditar ambas respuestas de la misma manera. La complejidad del razonamiento aumenta; la transparencia se mantiene constante.

> *Desde la pregunta más simple hasta la recomendación más compleja, toda respuesta DRAGA está anclada a una verdad explicitada. Eso es lo que genera confianza.*

---

## Definiciones Canónicas

Estas definiciones son la fuente de verdad para todo el código, documentación, APIs, comunicación del equipo, y prompts de agentes copilot.

### DRAGA (la clase)

Un **DRAGA** es un Document Grounded RAG Agent: un sistema conversacional autónomo cuyas respuestas provienen exclusivamente de una base de conocimiento documental. No inventa, no improvisa, no extrapola más allá de sus documentos. Si no tiene información suficiente, lo dice.

Cada DRAGA es una instancia independiente compuesta por cuatro partes:

```
┌─────────────────────────────────────────────────────────────────┐
│                           DRAGA                                  │
│                  (Document Grounded RAG Agent)                   │
│                                                                  │
│  ┌────────────────┐  ┌──────────────────────────────────────┐   │
│  │    Tenant       │  │     Knowledge Base                    │   │
│  │                 │  │                                       │   │
│  │  La organiza-   │  │  El corpus documental que funda-      │   │
│  │  ción que opera │  │  menta las respuestas del DRAGA.      │   │
│  │  este DRAGA.    │  │  Materializado como una colección     │   │
│  │  Responsable de │  │  vectorial aislada con documentos     │   │
│  │  su contenido,  │  │  procesados, chunkeados, enriquecidos │   │
│  │  configuración  │  │  y embedidos.                         │   │
│  │  y operación.   │  │                                       │   │
│  └────────────────┘  └──────────────────────────────────────┘   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Orchestrator Agent                              │  │
│  │                                                              │  │
│  │  El agente central que orquesta el pipeline de 14 pasos.     │  │
│  │  Recibe la query del usuario, coordina retrieval, evalúa     │  │
│  │  contexto, genera respuesta, verifica grounding, y entrega   │  │
│  │  una respuesta fundamentada con metadata de confianza.       │  │
│  │                                                              │  │
│  │  El Orchestrator ejecuta el pipeline:                        │  │
│  │  translate → enrich → normalize → decompose → embed →        │  │
│  │  cache → retrieve → deduplicate → rerank → evaluate →        │  │
│  │  gap → generate → verify → validate                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              Agent Crew                                      │  │
│  │                                                              │  │
│  │  El equipo de agentes especializados al servicio del         │  │
│  │  Orchestrator. Cada uno es un experto en una capacidad:      │  │
│  │                                                              │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │
│  │  │  Retrieval    │ │  Grounding   │ │  Language             │ │  │
│  │  │  Agent        │ │  Agent       │ │  Agent                │ │  │
│  │  │              │ │              │ │                       │ │  │
│  │  │ Busca en la  │ │ Verifica que │ │ Detecta idioma,      │ │  │
│  │  │ KB, rerank,  │ │ cada claim   │ │ traduce queries,     │ │  │
│  │  │ deduplica,   │ │ esté fundado │ │ adapta respuestas    │ │  │
│  │  │ evalúa       │ │ en los docs  │ │ al idioma del user   │ │  │
│  │  │ contexto     │ │ fuente. NLI  │ │                       │ │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │  │
│  │                                                              │  │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │  │
│  │  │  Ingestion   │ │  Feedback    │ │  Quality              │ │  │
│  │  │  Agent       │ │  Agent       │ │  Agent                │ │  │
│  │  │              │ │              │ │                       │ │  │
│  │  │ Procesa      │ │ Aprende del  │ │ Monitorea métricas,  │ │  │
│  │  │ documentos,  │ │ feedback de  │ │ detecta gaps en KB,  │ │  │
│  │  │ chunkea,     │ │ usuarios,    │ │ registra preguntas   │ │  │
│  │  │ enriquece,   │ │ enriquece    │ │ sin respuesta,       │ │  │
│  │  │ embede       │ │ queries      │ │ audita grounding     │ │  │
│  │  └──────────────┘ └──────────────┘ └──────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### DRAGA Platform (la plataforma)

**DRAGA Platform** es el sistema completo que permite crear, configurar, desplegar y operar múltiples DRAGAs. Es la fábrica de DRAGAs.

DRAGA Platform provee:

- La infraestructura compartida (vector DB, embeddings, cache, base de datos)
- El backend API que expone las capacidades de cada DRAGA
- El admin dashboard para gestión de la plataforma
- El SDK y widgets para que cada DRAGA sea accesible por usuarios finales
- Los protocolos de acceso (REST, OpenAI-compatible, MCP)

**Relación**: DRAGA Platform es la plataforma. Cada DRAGA es una instancia creada y operada dentro de la plataforma. La plataforma puede hospedar N DRAGAs simultáneamente, cada uno completamente aislado.

---

## Vocabulario Obligatorio

Este vocabulario es de uso obligatorio en código, documentación, ADRs, PRs, issues, y comunicación del equipo.

| Término | Definición | NO usar |
|---------|-----------|---------|
| **DRAGA** | Document Grounded RAG Agent. Una instancia operacional de agente documental. | ~~RAG agent~~, ~~bot~~, ~~chatbot~~, ~~assistant~~ |
| **DRAGA Platform** | La plataforma completa que hospeda DRAGAs. Nombre del producto. | ~~DGRAGP~~, ~~EOD RAG Service~~, ~~Envios23 RAG~~ |
| **Tenant** | La organización que opera uno o más DRAGAs. Cada DRAGA tiene exactamente un tenant. | ~~cliente~~, ~~customer~~ (en contexto de plataforma) |
| **Knowledge Base (KB)** | El corpus documental de un DRAGA. Colección vectorial aislada. | ~~base de datos~~, ~~documentos~~ (ambiguo) |
| **Orchestrator** | El agente central que ejecuta el pipeline de 14 pasos. El cerebro de cada DRAGA. | ~~query engine~~, ~~pipeline runner~~ |
| **Agent Crew** | El equipo de agentes especializados al servicio del Orchestrator. | ~~services~~, ~~components~~ |
| **Grounding** | La propiedad de que una respuesta está sustentada por la KB. Métrica central. | ~~accuracy~~ (impreciso), ~~correctness~~ |
| **Deflection** | El comportamiento correcto cuando no hay información suficiente: decirlo. | ~~fallback~~, ~~error~~ |
| **End User** | La persona que interactúa con un DRAGA (via widget, chat, API). | ~~usuario~~ (ambiguo: ¿de la plataforma o del DRAGA?) |
| **DRAGA Owner** | Usuario con rol admin de un tenant. Gestiona sus DRAGAs. | ~~tenant admin~~ |
| **Platform Admin** | Administrador de DRAGA Platform. Gestiona tenants e infraestructura. | ~~superadmin~~ |
| **Widget** | Componente frontend embebible que expone un DRAGA a End Users. | ~~chat widget~~ (redundante), ~~embed~~ |

---

## Anatomía de un DRAGA

### 1. Tenant

El tenant es la organización responsable del DRAGA. Define:

- Quién puede operar el DRAGA (usuarios y roles)
- Qué plan de uso aplica (queries/mes, documentos, agentes)
- Las API keys de acceso
- La configuración global compartida entre sus DRAGAs

Un tenant puede operar múltiples DRAGAs. Cada DRAGA pertenece a exactamente un tenant.

**Mapeo al código actual**: `TenantConfig` en `src/models/tenant.py`, `TenantRegistry` en `src/adapters/persistence/tenant_registry.py`.

### 2. Knowledge Base

La Knowledge Base es el fundamento de verdad de un DRAGA. Contiene:

- **Documentos fuente**: PDFs, Markdown, DOCX, HTML, XLSX — los originales
- **Chunks procesados**: Segmentos semánticos con metadata enriquecida (keywords, audience, topic, summary, intent)
- **Embeddings vectoriales**: Representaciones densas para búsqueda por similitud
- **Metadata de trazabilidad**: Fuente, sección, fecha de ingestión, content hash

La KB está materializada como una colección vectorial aislada (`kb_{tenant_id}`) en la base de datos vectorial (ChromaDB o Qdrant).

**Invariante**: La KB es la única fuente de verdad para las respuestas del DRAGA. Nada fuera de la KB se usa para generar respuestas.

**Mapeo al código actual**: Colecciones en `VectorRepositoryPort`, documentos en `DocumentRegistry`, procesamiento en `src/adapters/processing/`.

### 3. Orchestrator Agent

El Orchestrator es el agente central que procesa cada query. Ejecuta el pipeline de 14 pasos:

| Fase | Steps | Responsabilidad |
|------|-------|----------------|
| **Pre-Retrieval** | translate, enrich, normalize, decompose | Preparar la query para retrieval óptimo |
| **Retrieval** | embed, cache, retrieve | Encontrar los chunks más relevantes en la KB |
| **Post-Retrieval** | deduplicate, rerank, evaluate, gap | Refinar y validar el contexto recuperado |
| **Generation** | generate, verify, validate | Generar respuesta, verificar grounding, entregar |

El Orchestrator toma decisiones adaptativas: ajusta `top_k` según complejidad de la query, elige estrategia de retrieval según intent detectado, evalúa si el contexto es suficiente antes de generar, y verifica post-generación que cada claim esté fundamentado.

**Mapeo al código actual**: `RAGPipeline` en `src/pipeline/rag_pipeline.py`, steps en `src/pipeline/steps/`, `RAGDomainService` en `src/domain/rag_service.py`.

### 4. Agent Crew

El Agent Crew es el equipo de agentes especializados que el Orchestrator invoca. Cada agente del crew es experto en una capacidad:

| Agente | Responsabilidad | Mapeo al código actual |
|--------|----------------|----------------------|
| **Retrieval Agent** | Desciende a la profundidad de la KB para "pescar" los fragmentos relevantes. Búsqueda vectorial, adaptive top_k, deduplicación, cross-encoder reranking. | `retrieve_chunks`, `deduplicate_chunks`, `rerank_chunks` steps + `AdaptiveRetrieval`, `ChunkDeduplication` services |
| **Grounding Agent** | Verifica que lo extraído sea auténtico antes de que suba a la superficie. NLI + token overlap post-generación, evaluación de suficiencia de contexto (Self-RAG). | `verify_grounding`, `evaluate_context` steps + `NLIHallucinationDetector`, `ContextEvaluator` |
| **Language Agent** | Traduce las coordenadas de la query al idioma de la KB y adapta la respuesta al idioma del End User. Detección, traducción, normalización. | `translate_query`, `normalize_query` steps + `LanguageDetector`, `QueryNormalizer` |
| **Ingestion Agent** | Limpia el lecho: procesa documentos, chunkea semánticamente, enriquece con metadata, deduplica, y elimina el "sedimento" documental. | `IngestionService`, `DocumentProcessor`, `MarkdownChunker`, `MetadataExtractor`, `ChunkEnrichmentPort` |
| **Feedback Agent** | Aprende del feedback de End Users para enriquecer futuras queries. El canal se mejora con cada uso. | `enrich_from_feedback` step + `FeedbackLoop`, `FeedbackRepository` |
| **Quality Agent** | Detecta las "zonas poco profundas" de la KB: gaps de cobertura, preguntas sin respuesta, métricas de grounding. | `record_gap` step + `CoverageAuditor`, `GapLog`, `QueryMetrics` |

El Agent Crew es extensible. Futuros agentes pueden incluir: **Graph Agent** (navegación de knowledge graphs), **Multimodal Agent** (procesamiento de imágenes/tablas), **Sync Agent** (sincronización con fuentes de datos externas).

---

## Principios

### Grounding es no negociable

Un DRAGA nunca genera información que no esté en su Knowledge Base. Si el Grounding Agent detecta un claim no fundamentado, la respuesta se corrige o se deflecta. No hay modo de desactivar esta protección.

### Cada DRAGA es una isla

El aislamiento entre DRAGAs es absoluto. La KB, el cache, las conversaciones, el feedback, y las métricas de un DRAGA son invisibles para cualquier otro DRAGA. Esto se aplica incluso entre DRAGAs del mismo tenant.

### El Orchestrator decide, el Crew ejecuta

El Orchestrator es el único punto de entrada para queries. Los agentes del Crew no se invocan directamente desde fuera del DRAGA. El Orchestrator decide qué agentes del Crew necesita para cada query.

### Self-hosted es un requisito, no un feature

DRAGA Platform debe funcionar desplegada en un VPS con Docker Compose. La capacidad de correr on-premises no es opcional — es parte de la identidad del producto y un diferenciador de mercado.

---

## Mapping: Semántica DRAGA → Código Actual

Esta tabla conecta el nuevo vocabulario con las estructuras existentes en el codebase. Sirve como guía para el rename incremental.

| Concepto DRAGA | Código actual | Ubicación | Acción |
|---------------|--------------|-----------|--------|
| DRAGA (instancia) | `RAGAgent` | `src/domain/entities.py` | Alias semántico. `RAGAgent` → `DRAGA` en evolución futura |
| DRAGA Config | `RAGAgentConfig` | `src/domain/entities.py` | Alias semántico |
| Tenant | `TenantConfig` | `src/models/tenant.py` | Se mantiene |
| Knowledge Base | Vector collection `kb_{id}` | `VectorRepositoryPort` | Se mantiene |
| Orchestrator | `RAGPipeline` + `RAGDomainService` | `src/pipeline/`, `src/domain/rag_service.py` | Renombrar docs/comments |
| Agent Crew | Domain services + pipeline steps | `src/domain/services/`, `src/pipeline/steps/` | Agrupar conceptualmente en docs |
| Retrieval Agent | Steps 5-9 + `AdaptiveRetrieval` + `ChunkDeduplication` | `src/pipeline/steps/`, `src/domain/services/` | Documentar agrupación |
| Grounding Agent | Steps 10, 13 + `NLIHallucinationDetector` | `src/pipeline/steps/`, `src/domain/services/` | Documentar agrupación |
| Language Agent | Steps 1, 3 + `LanguageDetector` + `QueryNormalizer` | `src/pipeline/steps/`, `src/domain/services/` | Documentar agrupación |
| Ingestion Agent | `IngestionService` + processors | `src/adapters/processing/` | Documentar agrupación |
| Feedback Agent | Step 2 + `FeedbackLoop` | `src/pipeline/steps/`, `src/domain/services/` | Documentar agrupación |
| Quality Agent | Step 11 + `CoverageAuditor` + `GapLog` | `src/pipeline/steps/`, `src/domain/services/` | Documentar agrupación |
| Widget | `WidgetConfig` + `draga-widget.js` | `src/domain/value_objects/`, `src/widget/` | Se mantiene |
| End User | (implícito en widget) | — | Formalizar en docs |
| DRAGA Owner | (no existe como entidad) | — | Crear con JWT/RBAC (ADR-015 Sprint 3) |
| Platform Admin | (no existe como entidad) | — | Crear con JWT/RBAC (ADR-015 Sprint 3) |

---

## Evolución: Hacia el Grounding Estructurado

### La Tesis

Hoy un DRAGA fundamenta sus respuestas en texto documental — chunks de prosa extraídos de PDFs, Markdown, y DOCX. Esto funciona bien para los Niveles 1-3 del espectro. Pero a medida que un DRAGA asciende hacia los Niveles 4 y 5 — análisis de cadenas de valor, recomendaciones estratégicas — el texto plano no es suficiente. El DRAGA necesita **conocimiento estructurado** que le permita razonar sobre categorías, relaciones, y jerarquías, no solo sobre fragmentos de texto.

La evolución natural es incorporar **taxonomías y vocabularios controlados** como fuentes adicionales de grounding. No reemplazan la KB documental — la complementan con una capa de conocimiento formal que hace explícitas las relaciones que en los documentos están implícitas.

### Qué son las Taxonomías como Fuentes de Grounding

Una taxonomía es un esquema conceptual que organiza un dominio en categorías jerárquicas con relaciones definidas. Cuando un DRAGA tiene acceso a una taxonomía, su grounding se fortalece en tres dimensiones:

**Precisión terminológica**: La taxonomía define los términos canónicos del dominio. Cuando un End User pregunta por "batería portable", la taxonomía sabe que el término correcto en regulación aduanal es "Acumulador eléctrico portátil" (GPC Brick 10005060) y el DRAGA puede buscar con el término exacto, eliminando ambigüedad.

**Relaciones jerárquicas**: La taxonomía explicita que "Acumulador de litio" es un tipo de "Acumulador eléctrico", que a su vez pertenece a "Equipamiento eléctrico". Esto permite al DRAGA responder preguntas que cruzan niveles: "¿Qué regulaciones aplican a todos los equipos eléctricos?" — algo imposible con solo chunks de texto.

**Validación semántica**: La taxonomía funciona como un esquema de validación. Si un DRAGA genera una respuesta que clasifica un producto en una categoría inexistente o contradice las relaciones de la taxonomía, el Grounding Agent puede detectarlo y corregirlo. La taxonomía se convierte en una segunda fuente de verdad contra la cual verificar.

### Esquemas Conceptuales Relevantes

DRAGA Platform integrará taxonomías y vocabularios controlados como fuentes dinámicas de grounding. Estos son los esquemas prioritarios por dominio:

#### Comercio y Productos

| Esquema | Organismo | Qué Aporta al DRAGA | Ejemplo de Grounding |
|---------|-----------|---------------------|---------------------|
| **GPC** (Global Product Classification) | GS1 | Clasificación jerárquica universal de productos: Segment → Family → Class → Brick. 4 niveles de granularidad con atributos por Brick. | Un DRAGA de e-commerce clasifica "leche de soja" correctamente como Brick dentro de Food/Beverages, no como producto lácteo. La taxonomía lo impide. |
| **HS** (Harmonized System) | OMA / WCO | Códigos armonizados de 6 dígitos para clasificación aduanal, usados por +200 países. | Un DRAGA de comercio exterior clasifica un producto con su código HS correcto y puede cruzar regulaciones por capítulo arancelario. |
| **UNSPSC** | UN/CEFACT | Clasificación de productos y servicios para procurement: Segment → Family → Class → Commodity. | Un DRAGA de procurement puede verificar que un servicio solicitado corresponde a la categoría correcta de gasto. |

#### Logística y Transporte

| Esquema | Organismo | Qué Aporta al DRAGA | Ejemplo de Grounding |
|---------|-----------|---------------------|---------------------|
| **UN/LOCODE** | UNECE | Códigos de locaciones de comercio y transporte: 103,000+ ubicaciones en 249 países. Puertos, aeropuertos, terminales. | Un DRAGA de logística valida que "USMIA" es Miami y que las rutas mencionadas en la KB conectan locaciones reales con funciones verificadas (puerto, aeropuerto, terminal). |
| **Rec. 21** (Tipos de Carga) | UNECE | Códigos para tipos de carga, embalajes, y materiales de empaque. | Un DRAGA de operaciones valida que el tipo de contenedor mencionado existe y es compatible con la carga descrita. |
| **Incoterms** | ICC | Términos estándar de comercio internacional que definen obligaciones buyer/seller. | Un DRAGA de trade compliance puede verificar que las obligaciones descritas corresponden al Incoterm correcto (FOB, CIF, DDP). |

#### Conocimiento Organizacional

| Esquema | Estándar | Qué Aporta al DRAGA | Ejemplo de Grounding |
|---------|---------|---------------------|---------------------|
| **SKOS** (Simple Knowledge Organization System) | W3C | Modelo de datos para taxonomías, tesauros, y vocabularios controlados. Conceptos con prefLabel, altLabel, broader, narrower, related. | El formato nativo para representar todas las taxonomías dentro de DRAGA. Cualquier esquema se importa como SKOS y se integra al pipeline. |
| **Taxonomías de industria propias** | Tenant | Vocabularios específicos del dominio del tenant: jerarquías de productos, categorías de servicio, glosarios internos. | Un DRAGA de Treew usa la taxonomía interna de categorías de marketplace para validar que las recomendaciones usan las categorías correctas. |
| **Schema.org** | W3C / Google | Vocabulario compartido para datos estructurados en la web: Product, Organization, Place, Event, etc. | Un DRAGA puede verificar que los tipos de entidad en sus respuestas corresponden a tipos válidos de Schema.org. |

### SKOS como Lingua Franca

Todos los esquemas conceptuales — GPC, HS, UN/LOCODE, taxonomías propias — se representan internamente como **SKOS ConceptSchemes**. SKOS es el estándar W3C para vocabularios controlados y provee exactamente las primitivas que DRAGA necesita:

```
skos:Concept          → Un concepto en la taxonomía (ej: "Acumulador de litio")
skos:prefLabel        → El nombre canónico (ej: "Acumulador eléctrico de litio")
skos:altLabel         → Sinónimos y variantes (ej: "Batería de litio", "Li-ion battery")
skos:hiddenLabel      → Términos obsoletos o erróneos que redirigen al concepto correcto
skos:broader          → Relación jerárquica ascendente (ej: → "Acumulador eléctrico")
skos:narrower         → Relación jerárquica descendente
skos:related          → Relación asociativa no jerárquica
skos:definition       → Definición textual del concepto
skos:scopeNote        → Notas de alcance (cuándo usar/no usar este concepto)
skos:inScheme         → A qué esquema pertenece (GPC, HS, internal)
```

La elección de SKOS es deliberada: es lo suficientemente simple para que un DRAGA Owner pueda crear su propia taxonomía sin ser ontólogo, y lo suficientemente formal para que el Grounding Agent pueda razonar sobre relaciones jerárquicas.

### Cómo Funcionan las Taxonomías en el Pipeline

Las taxonomías se integran al pipeline DRAGA como una capa de grounding paralela a la KB documental:

```
Query del End User: "¿Puedo enviar baterías de litio a Cuba?"
       │
       ▼
 ┌─ NORMALIZE (Step 3) ──────────────────────────────────────────┐
 │  El Language Agent detecta "baterías de litio"                 │
 │  La taxonomía SKOS resuelve:                                   │
 │    altLabel "baterías de litio"                                │
 │      → prefLabel "Acumulador eléctrico de litio"               │
 │      → broader "Equipamiento eléctrico portátil"               │
 │      → HS code 8507.60 (Acumuladores de litio)                 │
 │  La query se enriquece con los términos canónicos              │
 └────────────────────────────────────────────────────────────────┘
       │
       ▼
 ┌─ RETRIEVE (Step 7) ───────────────────────────────────────────┐
 │  El Retrieval Agent busca con:                                 │
 │    - El embedding de la query original (semántico)             │
 │    - Los términos canónicos de la taxonomía (léxico exacto)    │
 │    - Los términos broader para capturar regulaciones generales │
 │  Resultado: chunks más precisos + regulaciones de categoría    │
 └────────────────────────────────────────────────────────────────┘
       │
       ▼
 ┌─ VERIFY (Step 13) ────────────────────────────────────────────┐
 │  El Grounding Agent verifica doblemente:                       │
 │    1. Cada claim contra la KB documental (como siempre)        │
 │    2. Cada clasificación contra la taxonomía SKOS              │
 │       - ¿El producto está en la categoría correcta?            │
 │       - ¿El código HS citado existe y corresponde?             │
 │       - ¿La relación jerárquica mencionada es válida?          │
 │  Si hay inconsistencia, el claim se marca o se corrige         │
 └────────────────────────────────────────────────────────────────┘
```

### Integración Dinámica: Taxonomías como Plugins

Las taxonomías no son estáticas ni hardcodeadas. Se integran a DRAGA Platform de forma dinámica:

**Importación**: Un DRAGA Owner sube un archivo SKOS (Turtle, JSON-LD, o RDF/XML) o un CSV estructurado, y DRAGA Platform lo parsea, valida, indexa, y lo hace disponible para el pipeline del DRAGA.

**Actualización**: Las taxonomías estándar (GPC, HS) se actualizan periódicamente (GPC: semestral, HS: cada 5 años con enmiendas). DRAGA Platform sincroniza estas actualizaciones y re-indexa automáticamente.

**Composición**: Un DRAGA puede usar múltiples taxonomías simultáneamente. Un DRAGA de comercio exterior puede combinar GPC (clasificación de producto) + HS (clasificación aduanal) + UN/LOCODE (locaciones) + Incoterms (condiciones comerciales) + una taxonomía interna del tenant. Cada una aporta una dimensión de grounding.

**Generación asistida**: DRAGA Platform puede asistir al DRAGA Owner en la creación de taxonomías propias: a partir de los documentos de la KB, el Ingestion Agent extrae entidades y relaciones candidatas, y las propone como borrador de taxonomía SKOS que el humano refina.

### Nuevo Agente: Taxonomy Agent (roadmap)

La integración de taxonomías introduce un séptimo agente en el Crew:

| Agente | Responsabilidad |
|--------|----------------|
| **Taxonomy Agent** | Gestiona los vocabularios controlados del DRAGA. Resuelve sinónimos a términos canónicos, navega relaciones jerárquicas para ampliar o restringir búsquedas, valida clasificaciones en respuestas, y sugiere enriquecimiento taxonómico para la KB. |

El Taxonomy Agent opera en tres momentos del pipeline:

- **Pre-retrieval**: Enriquece la query con términos canónicos y broader/narrower concepts
- **Post-retrieval**: Filtra y prioriza chunks que coinciden con la clasificación taxonómica
- **Verification**: Valida que las clasificaciones y categorías en la respuesta sean consistentes con las taxonomías registradas

### Evolución del Grounding: De Texto a Conocimiento

La incorporación de taxonomías marca la transición de DRAGA desde **grounding textual** hacia **grounding semántico**:

```
                    Evolución del Grounding DRAGA

  HOY                          PRÓXIMO                     FUTURO
   │                              │                           │
   ▼                              ▼                           ▼

 Grounding                  Grounding                   Grounding
 Textual                    Taxonómico                  Ontológico
                                                     
 KB documental          KB documental              KB documental
 (chunks de texto)      + Taxonomías SKOS          + Taxonomías SKOS
                        (vocabularios              + Ontologías OWL
                         controlados,              (relaciones complejas,
                         jerarquías,               axiomas, inferencia,
                         sinónimos)                razonamiento lógico)
                                                     
 Verifica:              Verifica:                  Verifica:
 "¿Está en un doc?"     "¿Está en un doc          "¿Está en un doc
                         Y es consistente           Y es consistente
                         con la taxonomía?"          Y es lógicamente
                                                    válido según
                                                    la ontología?"

 Niveles 1-3            Niveles 1-4                Niveles 1-5
 del espectro           del espectro               del espectro
```

Cada etapa amplía la profundidad del grounding sin relajar la garantía fundamental: toda respuesta es trazable y verificable. La taxonomía no reemplaza al documento — lo enriquece con estructura. La ontología no reemplaza a la taxonomía — la enriquece con lógica.

> *Las taxonomías no son decoración. Son la estructura que convierte documentos dispersos en conocimiento navegable. Un DRAGA con taxonomías no solo busca — entiende la topografía de su dominio.*

---

## Ejemplos Concretos

### Nivel 1 — FAQ Resolver: Envíos23

```
DRAGA Platform
  └── Tenant: "envios23" (Envíos23 S.A.)
       └── DRAGA: "Soporte al Cliente"
            ├── Knowledge Base: 42 documentos sobre regulaciones aduanales de Cuba
            ├── Orchestrator: Pipeline 14 pasos, model anthropic/claude-3-haiku
            ├── Agent Crew:
            │   ├── Retrieval Agent (top_k=5, threshold=0.7)
            │   ├── Grounding Agent (NLI + overlap, 98% coverage)
            │   ├── Language Agent (KB=es, auto-detect=true)
            │   ├── Ingestion Agent (markdown chunker, 500 chars)
            │   ├── Feedback Agent (feedback loop activo)
            │   └── Quality Agent (gap log + coverage auditor)
            └── Widget: Chat embebido en envios23.com
                 └── End Users: Clientes preguntando sobre envíos
```

**Query típica**: "¿Puedo enviar una batería de litio a Cuba?"
**Respuesta**: Respuesta directa citando la regulación aduanal específica, con fuente trazable.

### Nivel 3 — Asesor Especializado: Compliance Legal

```
DRAGA Platform
  └── Tenant: "bufete-latam" (Bufete Legal Asociados)
       └── DRAGA: "Asesor de Compliance LATAM"
            ├── Knowledge Base: 380 documentos
            │   ├── Regulaciones fiscales de 5 países
            │   ├── Tratados de libre comercio vigentes
            │   ├── Normativas de protección de datos (LGPD, Ley Federal MX)
            │   └── Precedentes relevantes categorizados
            ├── Orchestrator: Pipeline completo con decompose para multi-jurisdicción
            ├── Agent Crew:
            │   ├── Retrieval Agent (top_k=10, cross-encoder reranking)
            │   ├── Grounding Agent (NLI estricto — legal requiere 100% trazabilidad)
            │   ├── Language Agent (KB=es, soporte pt-BR para documentos brasileños)
            │   ├── Feedback Agent (enriquece con consultas previas de abogados)
            │   └── Quality Agent (detecta gaps normativos por jurisdicción)
            └── Widget: Chat en portal interno del bufete
                 └── End Users: Abogados consultando normativas cross-border
```

**Query típica**: "¿Qué requisitos de protección de datos aplican si mi cliente mexicano almacena datos de ciudadanos brasileños?"
**Respuesta**: Cruce entre la Ley Federal de Protección de Datos MX y la LGPD brasileña, citando artículos específicos de ambas normativas.

### Nivel 4-5 — Analista + Estratega: Treew Operations

```
DRAGA Platform
  └── Tenant: "treew" (Treew Inc.)
       │
       ├── DRAGA: "Soporte Logistics" (Nivel 2)
       │    ├── KB: Documentación de operaciones logísticas
       │    ├── Orchestrator: Pipeline completo
       │    └── Widget: Chat en portal de operadores
       │
       ├── DRAGA: "Onboarding Técnico" (Nivel 2)
       │    ├── KB: Guías de desarrollo, ADRs, runbooks
       │    ├── Orchestrator: Pipeline completo
       │    └── Widget: Chat en wiki interna
       │
       ├── DRAGA: "FAQ Marketplace" (Nivel 1)
       │    ├── KB: Preguntas frecuentes de sellers y buyers
       │    ├── Orchestrator: Pipeline completo
       │    └── Widget: Chat en marketplace público
       │
       └── DRAGA: "Intelligence Hub" (Nivel 5)
            ├── Knowledge Base: 1200+ documentos
            │   ├── Reportes operacionales mensuales (36 meses)
            │   ├── SLAs y performance de 15 proveedores logísticos
            │   ├── Análisis de mercado trimestrales
            │   ├── Post-mortems de incidencias operacionales
            │   ├── Roadmaps de producto y retrospectivas
            │   └── Documentación completa de la cadena de valor
            ├── Orchestrator: Pipeline con decompose + multi-query
            ├── Agent Crew completo:
            │   ├── Retrieval Agent (hybrid search, top_k=15)
            │   ├── Grounding Agent (NLI + overlap, umbral estricto)
            │   ├── Language Agent (es/en bilingual)
            │   ├── Ingestion Agent (enriquecimiento LLM activo)
            │   ├── Feedback Agent (loop con equipo directivo)
            │   └── Quality Agent (cobertura por área de negocio)
            └── Acceso: API directa para equipo directivo
                 └── End Users: CEO, VP Operations, VP Product
```

**Query típica**: "¿Dónde están los cuellos de botella en la cadena logística que más impactan el SLA de entrega en las últimas dos temporadas altas?"
**Respuesta**: Síntesis cruzando reportes operacionales, SLAs de proveedores, y post-mortems — cada dato trazable a su documento fuente, con confidence score y gaps identificados.

---

## Para Agentes Copilot

Si eres un agente copilot trabajando en este repositorio, estas son las reglas semánticas:

1. **Usa "DRAGA" cuando te refieras a una instancia de agente documental**. No "bot", no "chatbot", no "RAG agent". Es un DRAGA.

2. **Usa "DRAGA Platform" cuando te refieras a la plataforma completa**. No "EOD RAG Service", no "el backend", no "la aplicación". Es DRAGA Platform.

3. **Cada DRAGA tiene cuatro partes: Tenant, Knowledge Base, Orchestrator, y Agent Crew**. Si estás documentando o explicando el sistema, usa esta estructura.

4. **El Orchestrator ejecuta el pipeline de 14 pasos**. No digas "el pipeline procesa" — di "el Orchestrator procesa" o "el Orchestrator ejecuta el pipeline".

5. **Los agentes del Crew se nombran por su función**: Retrieval Agent, Grounding Agent, Language Agent, Ingestion Agent, Feedback Agent, Quality Agent. No inventes nombres alternativos.

6. **Grounding es la métrica central**. No es "accuracy", no es "correctness". Es "grounding" — la propiedad de que cada claim está fundamentado en la Knowledge Base.

7. **Deflection es un éxito, no un error**. Cuando un DRAGA dice "no tengo información suficiente sobre ese tema", está funcionando correctamente. Documentar y celebrar la deflection rate junto con el grounding rate.

8. **La metáfora guía la comunicación externa**. En documentación orientada a usuarios, landing pages, y material de marketing, usa el lenguaje de la draga: "profundizar", "extraer valor", "limpiar el lecho de datos", "canal de conocimiento", "navegar sin encallar". En código y documentación técnica interna, usa el vocabulario técnico preciso.

---

## Evolución Semántica del Código

El rename del código es incremental. No se hace en un solo PR. La prioridad es:

| Prioridad | Qué renombrar | Cuándo |
|-----------|--------------|--------|
| **Inmediata** | Este documento + README del repo | Ahora |
| **Sprint 1** | Documentación (ADRs, docs/, README principal) | Con Sprint 1 de ADR-015 |
| **Sprint 2** | Comments y docstrings en código | Con PRs de Sprint 2 |
| **Sprint 3** | Nombre del repositorio: `eod-api-rag-service` → `draga-platform` | Con ADR-015 Sprint 3 (post-JWT) |
| **Futuro** | Nombres de clases: `RAGAgent` → `DRAGA`, `RAGPipeline` → `Orchestrator` | Cuando la API esté estabilizada |

El rename de clases es deliberadamente último porque afecta APIs públicas, imports en todo el codebase, y tests. El vocabulario se adopta primero en documentación y comunicación, y el código converge gradualmente.
