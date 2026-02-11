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
  endpoint="https://api.envios23.com/api/v2/mcp/tools/call"
  title="Asistente Envios23"
></rag-assistant>
```

## ⚙️ Atributos

| Atributo | Descripción | Default |
|----------|-------------|---------|
| `endpoint` | URL del endpoint MCP | `/api/v2/mcp/tools/call` |
| `title` | Título del widget | `Asistente` |
| `tool-name` | Herramienta MCP | `generate_rag_answer` |
| `session-id` | ID de sesión | `web` |
| `include-sources` | Incluir fuentes | `true` |
| `placeholder` | Placeholder del input | `Escribe tu pregunta...` |

## 🔗 Requisitos

Requiere el backend [eod-api-rag-service](https://github.com/envios23/eod-api-rag-service) con el endpoint MCP habilitado.

## 🧪 A/B Testing

Este proyecto incluye un framework completo de test A/B para comparar las dos interfaces del widget:

- **Variante A**: `assistant-widget.js` (interfaz original)
- **Variante B**: `assistant-widget-v2.js` (interfaz nueva v2)

### Quick Start A/B Test

```bash
# Iniciar servidor
npm run dev

# Abrir página de demo del A/B test
# http://localhost:3000/ab-test.html
```

**Características:**
- ✅ Distribución automática 50/50 basada en Session ID
- ✅ Tracking con Google Analytics / GTM
- ✅ Persistencia durante la sesión
- ✅ Control manual para testing

**Documentación completa**: [AB-TEST-README.md](AB-TEST-README.md)

## 📐 Arquitectura

Este proyecto documenta sus decisiones arquitectónicas usando ADRs (Architecture Decision Records). Para entender el "por qué" detrás de las tecnologías y patrones utilizados, consulta:

- **[/adr](/adr/README.md)** - Índice completo de decisiones arquitectónicas
- **[ADR-0001](/adr/0001-web-components-ui-framework.md)** - Web Components como Framework UI
- **[ADR-0003](/adr/0003-mcp-protocol-integration.md)** - Protocolo MCP para Integración RAG
- **[ADR-0005](/adr/0005-docker-compose-orchestration.md)** - Docker Compose para Orquestación

### Contribuir con Documentación de Arquitectura

¿Identificaste una decisión arquitectónica no documentada? Crea un [Issue con la etiqueta `architecture-backlog`](.github/ISSUE_TEMPLATE/architecture-backlog.md) y luego un ADR correspondiente.

## 📄 Licencia

MIT
