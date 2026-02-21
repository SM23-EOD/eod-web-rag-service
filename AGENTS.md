# AGENTS.md — eod-web-rag-service

## Qué es este repositorio

Frontend de la **Plataforma DRAGA** (Document Grounded RAG Agents): dashboards de administración, gestión de tenants/agentes, widgets de chat embebibles, y herramientas de evaluación de calidad para el ecosistema RAG de TreeW. Se despliega como contenedor Nginx que sirve archivos estáticos y proxea `/api/` al backend hexagonal.

## Arquitectura

**Patrón:** SPA estáticas multi-página (MPA) — sin framework, sin build step, sin bundler.
Cada HTML es una app independiente que importa `api-client.js` como módulo compartido.

```
├── index.html              # Landing / widget de chat público
├── draga.html              # Dashboard de un DRAGA (7 módulos: overview, KB, pipeline, quality, chat, widgets, config)
├── admin.html              # Dashboard de administración de plataforma
├── demo-draga-chat.html    # Demo de chat con DRAGA
├── widget-generator.html   # Generador de widget embed
├── src/
│   ├── api-client.js       # 🔑 Cliente centralizado (~97 endpoints) — ÚNICO punto de contacto con backend
│   ├── assistant-widget.js # Web Component v1 del widget de chat
│   ├── assistant-widget-v2.js # Web Component v2 del widget de chat
│   ├── draga-chat.js       # Componente de chat para DRAGAs
│   ├── ab-test-loader.js   # Framework de A/B testing
│   ├── ab-test-analytics.js # Analytics para A/B tests
│   └── evaluation-chat.js  # Chat de evaluación de calidad
├── adr/                    # Architecture Decision Records (8 ADRs)
├── cli/                    # CLI de chat RAG (Python)
├── legacy/                 # Páginas deprecadas (NO modificar)
├── nginx.conf              # Config de Nginx (proxy + static serving)
├── Dockerfile              # Multi-stage: dev (Node) + prod (Nginx)
├── docker-compose.yml      # Dev (port 3000) y Prod (port 8081)
└── deploy.sh               # Deploy: rsync → docker rebuild en Digital Ocean
```

### Flujo de datos

```
Browser → Nginx (:8081)
  ├── /*.html, /src/* → archivos estáticos (no-cache)
  └── /api/* → proxy_pass → hex-rag-service:9999 (backend, red Docker interna)
```

### Infraestructura

| Componente | Ubicación | Puerto |
|---|---|---|
| Frontend (Nginx) | 167.172.225.44 | 8081 |
| Backend (FastAPI) | hex-rag-service container | 9999 |
| Qdrant (vectores) | 167.172.225.44 | 6333 |
| Redis (cache) | red Docker interna | 6379 |

## Reglas para agentes

### Invariantes de negocio (no negociables)

- **NUNCA modificar el backend desde este workspace.** El backend vive en otro repo (`hex-domain-rag`), desplegado como contenedor. Su estado de referencia es commit `a3f6519`. Cualquier cambio al backend se coordina con el agente responsable de ese repo.
- **`api-client.js` es el ÚNICO punto de contacto con el backend.** Jamás hacer `fetch('/api/...')` directamente desde HTML. Todo pasa por `RAGApiClient`.
- **Scope key siempre es `(tenant_id, agent_id)`.** El `agent_id` SIEMPRE se envía, aunque sea `'default'`. El backend requiere ambos para scoping correcto.
- **Colecciones Qdrant siguen el patrón `kb_{tenant_id}_{agent_id}`.** Hay fallback para legacy donde `agent_id == 'default'`.
- **Los datos de "documentos" vs "chunks" son cosas distintas.** El backend `getStats()` solo retorna `vector_database.total_chunks` — NO hay campo `total_documents`. Para conteo real de documentos usar el endpoint `documentStats(tenantId, agentId)`.
- **El backend NO tiene endpoint PUT para agentes.** `updateAgent()` actualmente hace POST (que falla con 400 si el agente ya existe). No intentar "arreglar" esto en frontend — requiere coordinación con backend.

### Convenciones de código

- **Stack:** JavaScript ES6+ vanilla, Web Components (Custom Elements API), HTML5, CSS3 con variables CSS
- **Sin framework:** No React, no Vue, no Angular, no Svelte. Vanilla JS puro.
- **Sin build step:** No webpack, no Vite, no esbuild. Los archivos se sirven tal cual.
- **Modules:** `<script type="module">`, imports via `<script src="src/api-client.js">`
- **Naming:**
  - Archivos: `kebab-case.js`, `kebab-case.html`
  - Variables/funciones JS: `camelCase`
  - Clases JS: `PascalCase`
  - CSS custom properties: `--kebab-case` (ej: `--bg-card`, `--text-primary`, `--draga-accent`)
  - IDs HTML: `camelCase` (ej: `statChunks`, `kbDocs`)
- **Error handling:** `try/catch` con notificación visual al usuario (toast/banner). NUNCA catch vacío `catch {}` que traga errores silenciosamente.
- **API Client:** Todos los métodos retornan Promises. Usan `_scopeParams(tenantId, agentId)` para scoping.
- **Idioma UI:** Español (títulos, labels, mensajes de error, tooltips).
- **Idioma código:** Inglés (nombres de variables, funciones, clases, comentarios técnicos).

### Testing

- `bash test-integration.sh` — tests de integración contra backend real (curl-based, verifica HTTP status codes)
- `bash test-ab.sh` — arranca servidor local para testear A/B framework manualmente
- `bash deploy.sh` — deploy a producción (rsync + docker rebuild, ~30s)
- **Sin tests unitarios JS** (no hay test runner configurado — deuda técnica)
- **Verificación manual:** Abrir cada HTML en browser, inspeccionar console para errores, verificar que datos carguen

### Despliegue

```bash
# Deploy completo
bash deploy.sh

# Lo que hace internamente:
# 1. rsync al droplet (excluye node_modules, .git, cli, .env)
# 2. SSH al droplet → docker compose --profile prod down/build --no-cache/up -d
# 3. Verificación automática del estado del contenedor
```

### Lo que NO debes hacer

- **No tocar el backend.** No SSH al servidor para modificar código backend. No editar archivos en `/opt/rag-service/`. Solo lectura de logs/estado es aceptable.
- **No agregar dependencias npm para runtime.** El frontend se sirve estático via Nginx. `package.json` solo tiene devDependencies para `serve` (dev local) y `terser` (minificación).
- **No crear archivos en `legacy/`.** Ese directorio contiene páginas deprecadas que se mantienen solo como referencia.
- **No hacer fetch directo al backend.** Siempre usar `RAGApiClient` de `src/api-client.js`.
- **No guardar secretos o API keys en código.** Las API keys se manejan via `localStorage` en el browser.
- **No usar `catch {}` vacío.** Todo error debe loggearse (`console.error`) y mostrarse al usuario.
- **No asumir que `total_documents` existe en `getStats()`.** Solo existe `total_chunks`. Usar `documentStats()` para documentos reales.
- **No modificar ADRs ya aceptados** sin crear uno nuevo que lo reemplace (patrón supersede).
- **No usar frameworks CSS** (Tailwind, Bootstrap). El proyecto usa CSS custom properties y estilos inline/embedded.

## Estado actual conocido (Febrero 2026)

### Datos del backend
- 2 tenants: `eod-sm23`, `sm23-dani`
- 4 DRAGAs: `draga`, `envio23`, `yeya-plm`, `rfc-edd`
- 1323 chunks totales, 9 ingestion jobs completados
- 20 feature flags (11 habilitados)
- 4 servicios healthy: qdrant, redis, embedding, llm

### Issues conocidos en frontend
- `draga.html`: Pipeline module es `() => {}` (dead code), Labels deshabilitados, `updateAgent` roto (backend no tiene PUT)
- `admin.html`: "DOCUMENTOS" muestra chunks en vez de documentos, quality stats muestran "—"
- `tenant.html` (no desplegado como página principal): per-DRAGA stats usan single `getStats()` (todos muestran mismo número)
- `api-client.js`: ~15 métodos definidos que ninguna UI usa aún

## ADRs vigentes

Los ADRs están en `adr/`. Los más relevantes para agentes:

- [ADR-0001: Web Components como Framework UI](adr/0001-web-components-ui-framework.md) — Custom Elements nativos, sin frameworks. Todo nuevo componente de UI debe seguir este patrón.
- [ADR-0002: Shadow DOM para Encapsulación](adr/0002-shadow-dom-encapsulation.md) — Los widgets embebibles usan Shadow DOM para aislamiento de estilos.
- [ADR-0003: Protocolo MCP para Integración RAG](adr/0003-mcp-protocol-integration.md) — MCP como protocolo principal para tools/prompts del RAG. Backend expone `/mcp/` endpoints.
- [ADR-0004: Soporte Multi-Interfaz](adr/0004-multi-interface-support.md) — Compatible con Open-WebUI, LibreChat, widgets propios.
- [ADR-0005: Docker Compose para Orquestación](adr/0005-docker-compose-orchestration.md) — Perfiles `dev` y `prod`. Backend es servicio externo en `rag-network`.
- [ADR-0006: Nginx para Producción](adr/0006-nginx-production-serving.md) — Proxy reverso, no-cache para HTML/JS/CSS, CORS permisivo.
- [ADR-0007: A/B Testing Framework](adr/0007-ab-testing-framework.md) — Framework client-side para comparar variantes de widget.
- [ADR-0008: Multi-DRAGA UI Alignment](adr/0008-multi-draga-ui-alignment.md) — Cada DRAGA tiene su propio dashboard, mismo layout.

## Contacto

- **Domain owner:** Pedro
- **Plataforma:** DRAGA Platform (TreeW)
