# eod-web-rag-service

Widget Web Component embebible para el asistente RAG de Envios23.

## 🚀 Quick Start

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

Abre http://localhost:3000 para ver la demo.

## 📦 Uso

```html
<!-- Opcional: Marked.js para renderizar markdown -->
<script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>

<!-- Widget -->
<script src="path/to/assistant-widget.js"></script>

<!-- Componente -->
<rag-assistant
  endpoint="https://api.envios23.com/api/v1/mcp/tools/call"
  title="Asistente Envios23"
></rag-assistant>
```

## ⚙️ Atributos

| Atributo | Descripción | Default |
|----------|-------------|---------|
| `endpoint` | URL del endpoint MCP | `/api/v1/mcp/tools/call` |
| `title` | Título del widget | `Asistente` |
| `tool-name` | Herramienta MCP | `generate_rag_answer` |
| `session-id` | ID de sesión | `web` |
| `include-sources` | Incluir fuentes | `true` |
| `placeholder` | Placeholder del input | `Escribe tu pregunta...` |

## 🔗 Requisitos

Requiere el backend [eod-api-rag-service](https://github.com/envios23/eod-api-rag-service) con el endpoint MCP habilitado.

## 📄 Licencia

MIT
