# ADR-0003: Protocolo MCP para Integración RAG

**Estado:** Aceptado ✓

**Fecha:** 2026-02-09

**Tipo:** Arqueología (Decisión Retroactiva)

## Contexto

El proyecto necesitaba comunicarse con un backend que provee capacidades de Retrieval-Augmented Generation (RAG). Los requisitos eran:

- Protocolo estandarizado para llamadas de herramientas (tool calling)
- Capacidad de pasar queries y recibir respuestas con fuentes
- Soporte para streaming opcional
- Feedback loop (thumbs up/down en respuestas)
- Identificación de sesiones para contexto conversacional

## Decisión

Adoptar el **protocolo MCP (Model Context Protocol)** como interfaz estándar para comunicación con el backend RAG.

**Endpoint principal:**
- `POST /api/v1/mcp/tools/call` - Ejecuta herramientas MCP

**Endpoint de feedback:**
- `POST /api/v1/feedback` - Envía feedback sobre respuestas

**Estructura de request:**
```json
{
  "tool_name": "generate_rag_answer",
  "arguments": {
    "query": "user question here",
    "session_id": "web",
    "include_sources": true
  }
}
```

**Estructura de response:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Respuesta del asistente..."
    }
  ],
  "sources": [
    {
      "title": "Document title",
      "url": "https://...",
      "relevance": 0.95
    }
  ]
}
```

## Consecuencias

### Positivas

✅ **Protocolo estandarizado**: MCP es un estándar emergente de Anthropic para tool calling, lo que facilita integración con otros sistemas compatibles.

✅ **Extensibilidad**: Fácil agregar nuevas herramientas sin cambiar la interfaz del widget (solo cambiar el `tool-name`).

✅ **Separación de responsabilidades**: El widget solo hace HTTP calls, el backend maneja toda la lógica RAG.

✅ **Soporte multi-sesión**: El `session_id` permite mantener contexto conversacional en el backend.

✅ **Metadata rica**: Las respuestas incluyen fuentes con relevancia, permitiendo transparencia en la generación.

### Negativas

⚠️ **Acoplamiento a backend específico**: El widget asume que existe un backend compatible con MCP en el endpoint configurado.

⚠️ **Sin versionado de API**: No hay versionado explícito en el protocolo, cambios breaking podrían romper compatibilidad.

⚠️ **Error handling genérico**: Los errores del backend se manejan de forma básica sin códigos específicos.

⚠️ **Sin retry logic**: No hay reintentos automáticos en caso de fallo de red.

### Deuda Técnica Identificada

🔴 **Falta validación de respuesta**: No se valida el schema de la respuesta MCP, errores malformados causan crashes.

🔴 **Sin timeout configurado**: Las requests pueden colgarse indefinidamente si el backend no responde.

🟡 **Feedback hardcoded**: La URL de feedback se deriva del endpoint MCP (`endpoint.replace(/\/mcp\/tools\/call$/, '/feedback')`), lo cual es frágil.

🟡 **Sin caché**: Queries repetidas hacen llamadas idénticas al backend sin caché local.

🟡 **Sin soporte para streaming**: MCP soporta streaming de respuestas pero el widget no lo implementa, causando latencia percibida alta en respuestas largas.

## Alternativas Consideradas

### 1. REST API Personalizada
- **Pros**: Control total del contrato, optimizable para este caso de uso
- **Contras**: No estándar, requiere documentación custom, menos extensible
- **Razón de rechazo**: Preferimos estándar emergente sobre API propietaria

### 2. GraphQL
- **Pros**: Query exacto de datos necesarios, typed schema
- **Contras**: Overhead de cliente GraphQL, complejidad para caso de uso simple
- **Razón de rechazo**: Over-engineering para llamadas de herramientas simples

### 3. OpenAI Chat Completions API
- **Pros**: Estándar de facto en la industria, ampliamente conocido
- **Contras**: Diseñado para chat, no para tool calling con RAG sources
- **Razón de rechazo**: MCP es más apropiado para tool calling

### 4. gRPC
- **Pros**: Altamente eficiente, typed contracts con Protocol Buffers
- **Contras**: Requiere compilación de protobuf, no soportado nativamente en browsers
- **Razón de rechazo**: Complejidad excesiva, problemas de compatibilidad web

## Notas de Implementación

### Código de Llamada MCP

```javascript
async sendMessage(message) {
  const payload = {
    tool_name: this.toolName,
    arguments: {
      query: message,
      session_id: this.sessionId,
      include_sources: this.includeSources,
    },
  };

  const response = await fetch(this.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return this.parseResponse(data);
}
```

### Mejoras Futuras Sugeridas

1. **Validación de schema con Zod/TypeBox**
2. **Retry con exponential backoff**
3. **Timeout configurable** (default 30s)
4. **Streaming con Server-Sent Events**
5. **Versionado de API** (`/api/v2/mcp/tools/call`)
6. **Cache con LRU** para queries recientes

## Referencias

- [Model Context Protocol (MCP) - Anthropic](https://www.anthropic.com/news/model-context-protocol)
- Backend requerido: [eod-api-rag-service](https://github.com/envios23/eod-api-rag-service)
- Código fuente: `src/assistant-widget.js` (método `sendMessage`)
