# Registros de Decisiones Arquitectónicas (ADR)

Este directorio contiene los Registros de Decisiones Arquitectónicas (Architecture Decision Records - ADR) para el proyecto `eod-web-rag-service`.

## ¿Qué es un ADR?

Un ADR documenta una decisión arquitectónica significativa junto con su contexto y consecuencias. Cada decisión está numerada y fechada para mantener un registro histórico.

## Formato

Cada ADR sigue esta estructura:

```markdown
# [Número]. [Título de la Decisión]

**Estado:** [Propuesto | Aceptado | Rechazado | Obsoleto | Reemplazado por ADR-XXX]

**Fecha:** YYYY-MM-DD

**Contexto:** ¿Por qué necesitamos tomar esta decisión? ¿Qué problema estamos resolviendo?

**Decisión:** ¿Qué hemos decidido hacer?

**Consecuencias:** ¿Cuáles son los resultados (positivos y negativos) de esta decisión?

**Alternativas Consideradas:** ¿Qué otras opciones evaluamos?
```

## ADRs Retroactivos (Arqueología)

Los ADRs marcados como **Arqueología** documentan decisiones ya implementadas en el proyecto. Estos ADRs:

- Tienen estado "Aceptado" desde el inicio (reflejan la realidad actual)
- Documentan el "por qué" histórico basado en el mejor conocimiento disponible
- Usan la sección "Consecuencias" para listar explícitamente problemas/deuda técnica actuales
- Ayudan a evitar la pérdida de conocimiento arquitectónico

## Índice de ADRs

| # | Título | Estado | Fecha |
|---|--------|--------|-------|
| [0001](./0001-web-components-ui-framework.md) | Uso de Web Components como Framework UI | Aceptado | 2026-02-09 |
| [0002](./0002-shadow-dom-encapsulation.md) | Shadow DOM para Encapsulación de Estilos | Aceptado | 2026-02-09 |
| [0003](./0003-mcp-protocol-integration.md) | Protocolo MCP para Integración RAG | Aceptado | 2026-02-09 |
| [0004](./0004-multi-interface-support.md) | Soporte Multi-Interfaz (Open-WebUI, LibreChat) | Aceptado | 2026-02-09 |
| [0005](./0005-docker-compose-orchestration.md) | Docker Compose para Orquestación de Servicios | Aceptado | 2026-02-09 |
| [0006](./0006-nginx-production-serving.md) | Nginx para Servicio en Producción | Aceptado | 2026-02-09 |
| [0007](./0007-ab-testing-framework.md) | A/B Testing Framework para Comparación de Interfaces | Aceptado | 2026-02-10 |
| [0008](./0008-multi-draga-ui-alignment.md) | Multi-DRAGA UI Alignment | Aceptado | 2026-02-15 |

## Proceso de Gestión

### Para Nuevas Decisiones

1. Crea un nuevo archivo ADR con el siguiente número disponible
2. Documenta la decisión usando el formato estándar
3. Actualiza este README con la nueva entrada
4. Crea un PR para revisión

### Para Decisiones Retroactivas (Arqueología)

1. Identifica una decisión arquitectónica existente
2. Crea un Issue etiquetado como `architecture-backlog`
3. Crea un ADR directamente marcado como "Aceptado"
4. Documenta el contexto histórico lo mejor posible
5. Lista problemas/deuda técnica en "Consecuencias"

## Referencias

- [ADR GitHub](https://adr.github.io/)
- [Documentando Decisiones Arquitectónicas](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
