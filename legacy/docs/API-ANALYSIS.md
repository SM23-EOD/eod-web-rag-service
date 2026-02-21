# Análisis Completo de la API RAG - Envios23

> **Branch:** `feature/rag-dashboard-analysis`  
> **Fecha:** Febrero 2026  
> **API Version:** 2.0.0  
> **Base URL:** `http://167.172.225.44/api/v2/`  
> **Stack:** FastAPI + Traefik + ChromaDB + Redis + TEI (HuggingFace)

---

## 📊 Resumen Ejecutivo

La API RAG de Envios23 expone **34 endpoints** organizados en **7 módulos funcionales**. Actualmente el frontend solo utiliza **3 endpoints** (`/mcp/tools/call`, `/feedback`, `/health`), dejando sin explotar el **91% de la API**.

### Cobertura Actual vs Disponible

| Módulo | Endpoints | Usados en Frontend | Cobertura |
|--------|-----------|-------------------|-----------|
| RAG Core | 5 | 0 | 0% |
| Agents | 7 | 0 | 0% |
| Registry | 8 | 0 | 0% |
| Tenants | 5 | 0 | 0% |
| MCP | 10 | 1 (tools/call) | 10% |
| Feedback | 4 | 1 (submit) | 25% |
| OpenAI Compatible | 4 | 0 | 0% |
| **Total** | **34** | **3** | **9%** |

---

## 🔌 Catálogo Completo de Endpoints

### 1. RAG Core (`/api/v2/`)

Funcionalidad principal del RAG con pipeline de 12 pasos.

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/query` | Query KB con pipeline completo (translate → enrich → normalize → decompose → embed → retrieve → dedup → rerank → evaluate → generate → reformulate → validate) | API Key |
| `POST` | `/ingest` | Ingestar documentos de texto en la KB | API Key |
| `GET` | `/stats` | Estadísticas de tenant (vector DB + cache) | API Key |
| `DELETE` | `/cache` | Limpiar caché de un tenant | API Key |
| `GET` | `/health` | Health check del servicio | No |

#### Schemas Clave:
- **QueryRequestV2:** `{query, tenant_id?, top_k?, use_cache?, category_filter?}`
- **RAGQueryResponse:** `{answer, confidence, sources[], retrieved_chunks[], metadata{}, cached}`
- **StatsResponse:** `{tenant_id, vector_database{}, cache{}}`

---

### 2. Agents (`/api/v2/agents/`)

Sistema multi-agente: cada agente es una instancia RAG independiente con su propia KB, caché y configuración.

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/agents` | Crear nuevo agente RAG | API Key |
| `GET` | `/agents` | Listar agentes (filtro por status) | API Key |
| `GET` | `/agents/{tenant_id}` | Obtener agente específico | API Key |
| `DELETE` | `/agents/{tenant_id}` | Eliminar agente y sus recursos | API Key |
| `POST` | `/agents/{tenant_id}/query` | Consultar un agente | API Key |
| `POST` | `/agents/{tenant_id}/ingest` | Ingestar docs en un agente | API Key |
| `GET` | `/agents/{tenant_id}/stats` | Estadísticas del agente | API Key |

#### Schemas Clave:
- **CreateAgentRequest:** `{tenant_id, name, description?, config?}`
- **AgentQueryRequest:** `{query, top_k?, use_cache?, category_filter?}`
- **AgentResponse:** `{tenant_id, name, description, status, created_at, updated_at, config{}, stats{}, metadata{}}`

---

### 3. Document Registry (`/api/v2/registry/`)

Gestión transaccional de documentos con deduplicación, versionado y reindexado.

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/registry/ingest` | Ingestar documento (multipart/file upload) | No |
| `GET` | `/registry/documents` | Listar documentos registrados (filtros: status, category) | No |
| `GET` | `/registry/documents/{id}` | Estado detallado de un documento | No |
| `DELETE` | `/registry/documents/{id}` | Eliminar documento (source + registry + vector) | No |
| `POST` | `/registry/documents/{id}/reindex` | Re-indexar documento existente | No |
| `GET` | `/registry/stats` | Estadísticas del registro | No |
| `POST` | `/registry/sync/directory` | Sincronizar desde directorio | No |
| `POST` | `/registry/scan-inbox` | Escanear inbox e ingestar pendientes | No |
| `POST` | `/registry/reset-reindex` | ⚠️ Reset nuclear: limpia todo y re-indexa | No |

#### Schemas Clave:
- **DocumentListItem:** `{document_id, filename, status, category, chunk_count, version, file_size_bytes}`
- **IngestionResponse:** `{success, document_id, filename, chunk_count, is_duplicate, error, message}`
- **RegistryStatsResponse:** `{total_documents, total_size_bytes, total_chunks, by_status{}, by_category{}, storage_path}`

---

### 4. Tenants (`/api/v2/tenants/`)

Multi-tenancy completo: cada tenant tiene su colección ChromaDB, configuración y modelo.

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `GET` | `/tenants` | Listar tenants (incluir inactivos?) | No |
| `POST` | `/tenants` | Crear tenant con configuración | No |
| `GET` | `/tenants/{tenant_id}` | Obtener configuración de tenant | No |
| `PUT` | `/tenants/{tenant_id}` | Actualizar tenant | No |
| `DELETE` | `/tenants/{tenant_id}` | Eliminar tenant (opcional: borrar colección) | No |

#### Schemas Clave:
- **TenantCreate:** `{tenant_id, name, description?, collection_name?, system_prompt?, allowed_models?, default_model?, embedding_model?, retrieval_config?, response_language?, metadata?}`
- **TenantResponse:** `{tenant_id, name, description, collection_name, default_model, embedding_model, response_language, is_active, document_count, created_at, updated_at}`
- **RetrievalConfig:** `{top_k, similarity_threshold, chunk_size, chunk_overlap}`

---

### 5. MCP - Model Context Protocol (`/api/v2/mcp/`)

Protocolo completo para integración con clientes MCP (Claude Desktop, etc).

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `GET` | `/mcp/health` | Health check MCP | No |
| `GET` | `/mcp/tools` | Listar herramientas disponibles | No |
| `GET` | `/mcp/prompts` | Listar prompts disponibles | No |
| `GET` | `/mcp/resources` | Listar recursos disponibles | No |
| `POST` | `/mcp/tools/call` | Ejecutar herramienta MCP | No |
| `POST` | `/mcp/prompts/render` | Renderizar prompt con argumentos | No |
| `GET` | `/mcp/resources/{path}` | Obtener recurso por path | No |
| `GET` | `/mcp/sse` | Stream SSE para comunicación real-time | No |
| `GET` | `/mcp/sessions/{id}` | Info de sesión | No |
| `DELETE` | `/mcp/sessions/{id}` | Limpiar sesión | No |

#### MCP Tools Disponibles:
1. **`search_knowledge_base`** - Búsqueda semántica en la KB
2. **`get_document_chunk`** - Lazy loading de fragmentos
3. **`list_documents`** - Listar documentos disponibles
4. **`generate_rag_answer`** - Respuesta completa RAG (búsqueda + LLM)

#### MCP Prompts Disponibles:
1. **`customer_support`** - Agente de soporte Envios23
2. **`faq_expert`** - Experto en FAQs
3. **`shipping_regulations_advisor`** - Asesor de regulaciones
4. **`debug_assistant`** - Asistente de debugging

#### MCP Resources:
1. **`rag://documents/summary`** - Resumen de documentos
2. **`rag://config/current`** - Configuración actual del RAG

---

### 6. Feedback (`/api/v2/feedback/`)

Sistema de feedback para mejora continua del RAG.

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/feedback` | Enviar feedback (👍/👎 + comentario) | No |
| `GET` | `/feedback` | Listar feedback (filtros: rating, reviewed, low_confidence) | No |
| `GET` | `/feedback/stats` | Estadísticas agregadas de feedback | No |
| `POST` | `/feedback/{id}/review` | Marcar feedback como revisado | No |

#### Schemas Clave:
- **FeedbackRequest:** `{query, response, rating, confidence?, comment?, expected_answer?, session_id?, metadata?}`
- **FeedbackStats:** `{total_feedback, positive_count, negative_count, positive_rate, low_confidence_count, unreviewed_count, common_negative_queries[], potential_domain_terms[]}`

---

### 7. OpenAI Compatible (`/api/v1/` y `/api/v2/`)

API compatible con el SDK de OpenAI para integración directa.

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/v2/chat/completions` | Chat completions (streaming SSE) | API Key |
| `GET` | `/v2/models` | Listar modelos disponibles | No |
| `POST` | `/v1/chat/completions` | Chat completions v1 (alias) | API Key |
| `GET` | `/v1/models` | Listar modelos v1 (alias) | No |

#### Modelos Disponibles:
1. **`eod-rag`** - Modelo RAG con Claude-3-Haiku vía OpenRouter
2. **`anthropic/claude-3-haiku`** - Passthrough directo a OpenRouter

#### Schemas Clave:
- **ChatCompletionRequest:** `{model?, messages[], temperature?, max_tokens?, stream?, knowledge_base?, top_k?}`
- **ChatMessage:** `{role: system|user|assistant, content, name?}`

---

## 🏗️ Estado Actual del Sistema

### Infraestructura
```
┌─────────────────────────────────────────────────────────────┐
│                    DigitalOcean Droplet                      │
│                    167.172.225.44                            │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Traefik  │  │ RAG API  │  │   TEI    │  │   Redis    │ │
│  │  :80/443 │  │  :9999   │  │  :80     │  │  :6379     │ │
│  │  (:8888) │  │          │  │          │  │            │ │
│  └────┬─────┘  └──────────┘  └──────────┘  └────────────┘ │
│       │                                                     │
│  ┌────┴─────┐  ┌──────────┐                                │
│  │ Frontend │  │ ChromaDB │                                │
│  │  :8080   │  │  :8000   │                                │
│  └──────────┘  └──────────┘                                │
│                                                             │
│  ┌──────────┐                                              │
│  │Portainer │                                              │
│  │  :9000   │                                              │
│  └──────────┘                                              │
└─────────────────────────────────────────────────────────────┘
```

### Datos del Sistema
- **Documentos:** Error de permisos en registry (necesita fix)
- **Feedback:** 0 entries (sistema nuevo)
- **Modelos:** eod-rag (RAG), anthropic/claude-3-haiku (passthrough)
- **Caché:** Redis 128MB con política allkeys-lru

---

## 🎯 Propuesta: Frontend Dashboard Integral

### Arquitectura de Navegación

```
┌─────────────────────────────────────────────────────────┐
│  📦 Envios23 RAG Dashboard                    [≡] Menu  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │
│  │ 💬  │ │ 📄  │ │ 🏢  │ │ 🤖  │ │ 📊  │ │ ⚙️  │    │
│  │Chat │ │Docs │ │Tenant│ │Agent│ │Stats│ │Admin│    │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              [Contenido del módulo]               │   │
│  │                                                   │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Módulos Propuestos

#### 1. 💬 Chat & Evaluación (Existente → Mejorar)
**Endpoints:** `/mcp/tools/call`, `/query`, `/chat/completions`, `/feedback`

**Funcionalidades:**
- Chat con RAG (ya existe)
- Modo evaluación side-by-side: MCP vs Query directo vs OpenAI compatible
- Toggle de streaming (SSE) con `/chat/completions?stream=true`
- Selección de prompt template (`customer_support`, `faq_expert`, etc.)
- Feedback integrado con trazabilidad
- Vista de chunks recuperados con scores de similaridad
- Indicador de caché hit/miss

**Mejoras sobre evaluación actual:**
- Usar `/api/v2/query` directo (pipeline de 12 pasos con metadata completa)
- Mostrar `confidence`, `retrieved_chunks`, `metadata` de RAGQueryResponse
- Selector de MCP prompt para diferentes contextos

---

#### 2. 📄 Knowledge Base Manager
**Endpoints:** `/registry/*`, `/ingest`

**Funcionalidades:**
- **Lista de Documentos:** Tabla con filename, status, category, chunks, versión, tamaño
- **Upload de Documentos:** Drag & drop file upload vía `/registry/ingest`
- **Detalle de Documento:** Vista individual con estado, chunks, historial
- **Re-indexar:** Botón para regenerar embeddings de un documento
- **Eliminar:** Con confirmación (elimina source + registry + vector)
- **Sync Directorio:** Trigger para sincronizar desde directorio del servidor
- **Scan Inbox:** Escanear inbox para documentos pendientes
- **Reset & Reindex:** Botón nuclear con doble confirmación
- **Estadísticas:** Gráficos de documentos por status, categoría, tamaño total

**UI:**
```
┌─────────────────────────────────────────────────────┐
│  📄 Knowledge Base                    [📤 Upload]    │
├─────────────────────────────────────────────────────┤
│  Documentos: 12 │ Chunks: 847 │ Tamaño: 2.3 MB     │
├─────────────────────────────────────────────────────┤
│  🔍 Buscar...              [Status ▼] [Categoría ▼] │
├─────────────────────────────────────────────────────┤
│  📑 regulaciones-cuba.pdf    active   regulaciones  │
│     chunks: 45  │  v2  │  128 KB  │  [🔄] [🗑️]    │
│  📑 faq-envios.md            active   faq           │
│     chunks: 23  │  v1  │  45 KB   │  [🔄] [🗑️]    │
│  📑 terminos-servicio.pdf    active   terminos      │
│     chunks: 67  │  v1  │  234 KB  │  [🔄] [🗑️]    │
└─────────────────────────────────────────────────────┘
```

---

#### 3. 🏢 Tenant Manager
**Endpoints:** `/tenants/*`

**Funcionalidades:**
- **Lista de Tenants:** Cards con nombre, modelo, idioma, documentos, estado
- **Crear Tenant:** Formulario con configuración completa
  - ID, nombre, descripción
  - System prompt personalizado
  - Modelo LLM y embedding
  - Configuración de retrieval (top_k, similarity_threshold, chunk_size, overlap)
  - Idioma de respuesta
  - Modelos permitidos
- **Editar Tenant:** Modificar configuración
- **Eliminar Tenant:** Con opción de borrar colección
- **Estadísticas por Tenant:** Gráficos de uso

**UI:**
```
┌─────────────────────────────────────────────────────┐
│  🏢 Tenants                          [+ Nuevo]      │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  default     │  │  acme-corp  │  │  test-env  │ │
│  │  ✅ Activo   │  │  ✅ Activo  │  │  ⏸ Inactivo│ │
│  │  Docs: 12   │  │  Docs: 5    │  │  Docs: 0   │ │
│  │  claude-3   │  │  claude-3   │  │  claude-3  │ │
│  │  [✏️] [🗑️] │  │  [✏️] [🗑️]│  │  [✏️] [🗑️]│ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

#### 4. 🤖 Agent Manager
**Endpoints:** `/agents/*`

**Funcionalidades:**
- **Lista de Agentes:** Vista similar a Tenants pero con contexto de agente
- **Crear Agente:** Wizard de creación (tenant_id, nombre, configuración)
- **Console de Agente:** Chat directo con un agente específico
- **Ingestión por Agente:** Upload de documentos targetizado
- **Estadísticas:** Métricas de uso, queries, documentos por agente
- **Eliminar:** Con warning de destrucción de datos

---

#### 5. 📊 Analytics Dashboard
**Endpoints:** `/stats`, `/feedback/stats`, `/registry/stats`, `/agents/*/stats`

**Funcionalidades:**
- **Health Overview:** Estado de todos los servicios (RAG, MCP, ChromaDB, Redis, TEI)
- **Feedback Analytics:**
  - Gráfico de satisfacción (positive vs negative rate)
  - Queries con feedback negativo (para mejorar KB)
  - Términos de dominio potenciales detectados
  - Cola de feedback sin revisar
- **KB Analytics:**
  - Documentos por categoría (pie chart)
  - Documentos por status (bar chart)
  - Evolución de chunks total
- **Cache Analytics:**
  - Hit rate
  - Keys activas
  - Memoria utilizada
- **Query Analytics (si hay metadata):**
  - Promedio de confianza
  - Tiempo de respuesta
  - Top queries

**UI:**
```
┌─────────────────────────────────────────────────────┐
│  📊 Analytics Dashboard                             │
├──────────────┬──────────────┬───────────────────────┤
│  ✅ RAG API  │  ✅ ChromaDB │  ✅ Redis  │  ✅ TEI  │
├──────────────┴──────────────┴───────────────────────┤
│                                                      │
│  ┌────────────────┐  ┌─────────────────────────┐    │
│  │  Satisfaction   │  │  Documents by Category  │    │
│  │  ████████ 85%  │  │  ■ regulaciones: 3      │    │
│  │  ░░░░░░░░ 15%  │  │  ■ faq: 4               │    │
│  └────────────────┘  │  ■ terminos: 2           │    │
│                       │  ■ guias: 3              │    │
│  ┌────────────────┐  └─────────────────────────┘    │
│  │  Cache Hit Rate │                                 │
│  │  ████████ 72%   │  ┌─────────────────────────┐   │
│  └────────────────┘  │  Feedback Queue: 5 ⚠️    │   │
│                       └─────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

#### 6. ⚙️ Admin & Configuration
**Endpoints:** `/health`, `/cache`, `/mcp/*`, `/models`, `/registry/reset-reindex`

**Funcionalidades:**
- **System Health:** Dashboard de servicios con ping en tiempo real
- **MCP Explorer:**
  - Listar/probar tools (playground)
  - Listar/renderizar prompts
  - Explorar resources
  - Monitor de sesiones activas
- **Cache Management:**
  - Ver estadísticas de caché
  - Limpiar caché por tenant
- **Models:** Listar modelos disponibles
- **Operaciones Peligrosas:**
  - Reset & Reindex (con múltiples confirmaciones)
  - Clear All Cache

---

## 📐 Arquitectura Técnica Propuesta

### Stack Frontend
```
src/
├── dashboard.html          # SPA principal con navegación
├── modules/
│   ├── chat.js             # Módulo de chat/evaluación
│   ├── knowledge-base.js   # Gestión de documentos
│   ├── tenants.js          # Multi-tenancy
│   ├── agents.js           # Multi-agent
│   ├── analytics.js        # Dashboards analíticos
│   └── admin.js            # Administración
├── components/
│   ├── api-client.js       # Cliente HTTP centralizado
│   ├── navigation.js       # Router/navegación SPA
│   ├── charts.js           # Componentes de gráficos
│   ├── data-table.js       # Tabla de datos reutilizable
│   ├── modal.js            # Modals genéricos
│   ├── toast.js            # Notificaciones
│   └── file-upload.js      # Upload con drag & drop
├── styles/
│   ├── envios23.css        # Variables de marca
│   ├── dashboard.css       # Layouts del dashboard
│   └── components.css      # Estilos de componentes
└── assets/
    └── envios23-logo.svg
```

### API Client Centralizado
```javascript
class RAGApiClient {
  constructor(baseUrl = '/api/v2') {
    this.baseUrl = baseUrl;
    this.apiKey = null; // Para endpoints con auth
  }
  
  // RAG Core
  async query(params) { return this.post('/query', params); }
  async ingest(docs) { return this.post('/ingest', docs); }
  async getStats(tenantId) { return this.get(`/stats?tenant_id=${tenantId}`); }
  async clearCache(tenantId) { return this.delete(`/cache?tenant_id=${tenantId}`); }
  async health() { return this.get('/health'); }
  
  // Agents
  async createAgent(data) { return this.post('/agents', data); }
  async listAgents(status) { return this.get(`/agents?status_filter=${status}`); }
  async getAgent(id) { return this.get(`/agents/${id}`); }
  async deleteAgent(id) { return this.delete(`/agents/${id}?confirm=true`); }
  async queryAgent(id, data) { return this.post(`/agents/${id}/query`, data); }
  async ingestAgent(id, docs) { return this.post(`/agents/${id}/ingest`, docs); }
  async agentStats(id) { return this.get(`/agents/${id}/stats`); }
  
  // Registry
  async registryIngest(file) { /* multipart upload */ }
  async listDocuments(filters) { return this.get('/registry/documents', filters); }
  async getDocument(id) { return this.get(`/registry/documents/${id}`); }
  async deleteDocument(id) { return this.delete(`/registry/documents/${id}`); }
  async reindexDocument(id) { return this.post(`/registry/documents/${id}/reindex`); }
  async registryStats() { return this.get('/registry/stats'); }
  async syncDirectory(dir) { return this.post(`/registry/sync/directory?directory=${dir}`); }
  async scanInbox(tenantId) { return this.post(`/registry/scan-inbox?tenant_id=${tenantId}`); }
  async resetReindex() { return this.post('/registry/reset-reindex'); }
  
  // Tenants
  async listTenants(includeInactive) { return this.get(`/tenants?include_inactive=${includeInactive}`); }
  async createTenant(data) { return this.post('/tenants', data); }
  async getTenant(id) { return this.get(`/tenants/${id}`); }
  async updateTenant(id, data) { return this.put(`/tenants/${id}`, data); }
  async deleteTenant(id, deleteCollection) { return this.delete(`/tenants/${id}?delete_collection=${deleteCollection}`); }
  
  // MCP
  async mcpHealth() { return this.get('/mcp/health'); }
  async mcpTools() { return this.get('/mcp/tools'); }
  async mcpCallTool(toolName, args, sessionId) { return this.post('/mcp/tools/call', { tool_name: toolName, arguments: args, session_id: sessionId }); }
  async mcpPrompts() { return this.get('/mcp/prompts'); }
  async mcpRenderPrompt(name, args) { return this.post('/mcp/prompts/render', { prompt_name: name, arguments: args }); }
  async mcpResources() { return this.get('/mcp/resources'); }
  async mcpGetResource(path) { return this.get(`/mcp/resources/${path}`); }
  async mcpSession(id) { return this.get(`/mcp/sessions/${id}`); }
  async mcpClearSession(id) { return this.delete(`/mcp/sessions/${id}`); }
  
  // Feedback
  async submitFeedback(data) { return this.post('/feedback', data); }
  async listFeedback(filters) { return this.get('/feedback', filters); }
  async feedbackStats() { return this.get('/feedback/stats'); }
  async markReviewed(id, action) { return this.post(`/feedback/${id}/review?action_taken=${action}`); }
  
  // OpenAI Compatible
  async chatCompletions(data) { return this.post('/chat/completions', data); }
  async listModels() { return this.get('/models'); }
  
  // Streaming
  async chatCompletionsStream(data, onChunk) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, stream: true })
    });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(decoder.decode(value));
    }
  }
}
```

### Patrón de Navegación SPA

```javascript
// Hash-based routing (sin dependencias)
const routes = {
  '#/chat':       () => loadModule('chat'),
  '#/documents':  () => loadModule('knowledge-base'),
  '#/tenants':    () => loadModule('tenants'),
  '#/agents':     () => loadModule('agents'),
  '#/analytics':  () => loadModule('analytics'),
  '#/admin':      () => loadModule('admin'),
};
```

### Responsive Design
- **Desktop (>1200px):** Sidebar + contenido principal
- **Tablet (768-1200px):** Sidebar colapsable + contenido
- **Mobile (<768px):** Bottom navigation + contenido full-width

---

## 🚀 Plan de Implementación

### Fase 1: Foundation (Sprint 1)
1. Dashboard SPA con navegación
2. API Client centralizado
3. Componentes base (tabla, modal, toast, charts)
4. Health overview básico
5. Migrar chat existente al nuevo framework

### Fase 2: Knowledge Base (Sprint 2)
1. Knowledge Base Manager completo
2. Upload de documentos
3. Registry stats dashboard
4. Inbox scanner UI

### Fase 3: Multi-tenancy (Sprint 3)
1. Tenant Manager CRUD
2. Agent Manager CRUD
3. Configuración por tenant
4. Console de agente

### Fase 4: Analytics & Admin (Sprint 4)
1. Analytics Dashboard completo
2. Feedback review workflow
3. MCP Explorer/Playground
4. Cache management
5. Operaciones administrativas

---

## ⚠️ Issues Detectados

1. **Registry permisos:** `/app/storage/sources` tiene error de permisos en el contenedor
2. **Traefik bloquea /docs:** FastAPI docs no accesibles via Traefik (solo interno en :9999)
3. **API Keys:** Muchos endpoints usan `APIKeyHeader` - necesitamos gestión de keys en el frontend
4. **CORS:** Configurado como `*` pero algunos endpoints podrían necesitar configuración específica
5. **Feedback vacío:** 0 feedback entries - el sistema de feedback actual no está conectado correctamente al endpoint

---

## 📋 Decisiones Pendientes

1. **¿Usar Web Components o vanilla JS?** (ADR-0001 dice Web Components)
2. **¿Librería de gráficos?** Chart.js vs Lightweight alternatives
3. **¿Autenticación?** API Keys vs OAuth vs ninguna (red interna)
4. **¿Persistencia frontend?** LocalStorage vs nada
5. **¿SSE streaming?** Implementar chat con streaming real vía `/chat/completions?stream=true`
