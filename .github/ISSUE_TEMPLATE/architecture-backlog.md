---
name: Decisión Arquitectónica Existente (Arqueología)
about: Documentar una decisión arquitectónica ya implementada en el proyecto
title: '[ARCH] '
labels: architecture-backlog
assignees: ''
---

## Tecnología/Patrón a Documentar

<!-- Ejemplo: "Uso de ChromaDB como vector store", "Express.js como framework backend", "JWT para autenticación" -->

## Descripción Breve

<!-- 2-3 oraciones sobre qué es esta tecnología/patrón y dónde se usa en el proyecto -->

## Ubicación en el Código

<!-- Archivos, módulos o directorios donde se implementa esta decisión -->
- `path/to/file.js`
- `another/path/`

## Contexto Histórico (si se conoce)

<!-- ¿Por qué se eligió esta tecnología/patrón originalmente? -->
<!-- Si no se recuerda, está bien escribir "No documentado" -->

## Problemas/Deuda Técnica Conocidos

<!-- ¿Qué problemas está causando esta decisión actualmente? -->
<!-- ¿Hay trade-offs negativos que vale la pena documentar? -->

- [ ] Problema 1
- [ ] Problema 2

## Prioridad para Documentación

- [ ] Alta - Decisión crítica que afecta múltiples partes del sistema
- [ ] Media - Decisión importante pero localizada
- [ ] Baja - Nice to have, no urgente

## Siguiente Paso

Una vez creado este issue, se debe crear un ADR (Architecture Decision Record) en `/adr` siguiendo el formato establecido. El ADR debe:

1. Estar marcado como "Aceptado" (refleja la realidad actual)
2. Documentar el contexto histórico lo mejor posible
3. Listar explícitamente los problemas en la sección "Consecuencias"
4. Ser enviado como PR para revisión

Ver `/adr/README.md` para más detalles sobre el formato de ADR.
