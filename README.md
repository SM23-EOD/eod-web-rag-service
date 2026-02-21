# DRAGA Platform — Frontend

Frontend de la **Plataforma DRAGA** (Document Grounded RAG Agents): dashboards de administración, gestión de tenants/agentes, widgets de chat embebibles, y herramientas de evaluación de calidad.

> *"Profundizamos en tus datos, elevamos tu negocio."*

## Stack

- **JavaScript ES6+ vanilla** — sin frameworks, sin build step
- **Web Components** (Custom Elements API + Shadow DOM)
- **Nginx** como servidor estático + proxy reverso a backend
- **Docker Compose** para desarrollo (port 3000) y producción (port 8081)

## Quick Start

```bash
# Desarrollo local
npm install && npm run dev
# → http://localhost:3000

# Deploy a producción
bash deploy.sh
# → rsync + docker rebuild en 167.172.225.44:8081
```

## Páginas principales

| Página | URL | Descripción |
|--------|-----|-------------|
| `index.html` | `/` | Landing + widget de chat público |
| `draga.html` | `/draga.html?tenant=X&agent=Y` | Dashboard de un DRAGA (overview, KB, quality, chat, widgets, config) |
| `admin.html` | `/admin.html` | Dashboard de administración de plataforma |
| `widget-generator.html` | `/widget-generator.html` | Generador de widget embed |
| `demo-draga-chat.html` | `/demo-draga-chat.html` | Demo de chat con DRAGA |

## Arquitectura

```
Browser → Nginx (:8081)
  ├── /*.html, /src/* → archivos estáticos (no-cache para HTML/JS/CSS)
  └── /api/* → proxy_pass → hex-rag-service:9999 (backend FastAPI)
```

**`src/api-client.js`** es el ÚNICO punto de contacto con el backend (~97 endpoints). Jamás hacer `fetch('/api/...')` directamente desde HTML.

**Scope key**: Siempre `(tenant_id, agent_id)`. El `agent_id` se envía aunque sea `'default'`.

### Archivos clave

```
src/
├── api-client.js           # Cliente centralizado — todo pasa por RAGApiClient
├── assistant-widget.js     # Web Component v1 del widget de chat
├── assistant-widget-v2.js  # Web Component v2 (mejorado, A/B testeable)
├── draga-chat.js           # Componente de chat para DRAGAs
├── ab-test-loader.js       # Framework de A/B testing
├── ab-test-analytics.js    # Analytics para A/B tests
└── evaluation-chat.js      # Chat de evaluación de calidad
```

## Infraestructura

| Componente | Ubicación | Puerto |
|---|---|---|
| Frontend (Nginx) | 167.172.225.44 | 8081 |
| Backend (FastAPI) | hex-rag-service container | 9999 |
| Qdrant (vectores) | 167.172.225.44 | 6333 |
| Redis (cache) | red Docker interna | 6379 |

## Estado actual (Febrero 2026)

- **2 tenants**: `eod-sm23`, `sm23-dani`
- **4 DRAGAs**: `draga`, `envio23`, `yeya-plm`, `rfc-edd`
- **1323 chunks** totales, 9 ingestion jobs completados
- **20 feature flags** (11 habilitados)
- **4 servicios healthy**: qdrant, redis, embedding, llm

## Widget embebible

```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<script src="/src/assistant-widget-v2.js"></script>

<rag-assistant-v2
  endpoint="/api/v2/mcp/tools/call"
  title="Asistente Virtual"
  tool-name="generate_rag_answer"
  theme-color="#00D4AA"
  position="bottom-right"
></rag-assistant-v2>
```

Documentación completa del widget: [WIDGET-V2-README.md](WIDGET-V2-README.md)

## A/B Testing

Framework client-side para comparar variantes de widget (v1 vs v2).

```bash
bash test-ab.sh  # Servidor local + URLs de test
```

Documentación: [AB-TEST-README.md](AB-TEST-README.md) | ADR: [ADR-0007](adr/0007-ab-testing-framework.md)

## Testing

```bash
bash test-integration.sh   # Tests de integración contra backend real (curl-based)
bash test-ab.sh             # Test manual del framework A/B
```

No hay test runner JS configurado (deuda técnica). Verificación manual: abrir cada HTML, inspeccionar console.

## ADRs

Decisiones arquitectónicas documentadas en [`adr/`](adr/README.md):

| ADR | Decisión |
|-----|----------|
| [0001](adr/0001-web-components-ui-framework.md) | Web Components como Framework UI |
| [0002](adr/0002-shadow-dom-encapsulation.md) | Shadow DOM para Encapsulación |
| [0003](adr/0003-mcp-protocol-integration.md) | Protocolo MCP para Integración RAG |
| [0004](adr/0004-multi-interface-support.md) | Soporte Multi-Interfaz |
| [0005](adr/0005-docker-compose-orchestration.md) | Docker Compose para Orquestación |
| [0006](adr/0006-nginx-production-serving.md) | Nginx para Producción |
| [0007](adr/0007-ab-testing-framework.md) | A/B Testing Framework |
| [0008](adr/0008-multi-draga-ui-alignment.md) | Multi-DRAGA UI Alignment |

## Documentación adicional

| Doc | Contenido |
|-----|-----------|
| [AGENTS.md](AGENTS.md) | Reglas para agentes de código — invariantes, convenciones, anti-patrones |
| [WIDGET-V2-README.md](WIDGET-V2-README.md) | Docs completos del widget v2 |
| [AB-TEST-README.md](AB-TEST-README.md) | Framework A/B testing |
| [src/DRAGA.md](src/DRAGA.md) | Identidad, metáfora, espectro de complejidad |
| [src/016-draga-platform-definition.md](src/016-draga-platform-definition.md) | Definición formal de la plataforma |

## Contacto

- **Domain owner:** Pedro
- **Plataforma:** DRAGA Platform (TreeW)

## Licencia

MIT
