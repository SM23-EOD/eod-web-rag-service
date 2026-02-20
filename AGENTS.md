# AGENTS.md — [Nombre del servicio/repo]

## Qué es este repositorio

[Descripción de una línea: qué hace este servicio/módulo en el ecosistema TreeW]

## Arquitectura

[Patrón arquitectónico: hexagonal, layered, etc.]
[Capas principales y su responsabilidad]

```
src/
├── domain/          # Lógica de negocio pura, sin dependencias externas
│   ├── entities/    # Entidades y agregados
│   ├── ports/       # Interfaces (contratos)
│   └── services/    # Servicios de dominio
├── adapters/        # Implementaciones concretas de los ports
│   ├── api/         # Endpoints REST/GraphQL
│   ├── persistence/ # Repositorios (DB, cache)
│   └── external/    # Integraciones externas (MCP, APIs)
└── config/          # Configuración y bootstrap
```

## Reglas para agentes

### Invariantes de negocio (no negociables)
- [Lista de reglas de negocio que NUNCA deben violarse]
- [Ejemplo: "Un pedido cancelado no puede volver a estado 'activo'"]
- [Ejemplo: "Los precios siempre en centavos, nunca decimales"]

### Convenciones de código
- [Stack: lenguaje, framework, versión]
- [Naming conventions: snake_case, camelCase, etc.]
- [Import order y organización]
- [Manejo de errores: excepciones, result types, etc.]

### Testing
- `make test-unit` — tests unitarios (dominio, sin I/O)
- `make test-integration` — tests de integración (con DB/cache de test)
- `make lint` — linting
- `make typecheck` — verificación de tipos

### Lo que NO debes hacer
- No importar adaptadores desde el dominio (viola hexagonal)
- No commitear secretos, API keys, o credenciales
- No modificar migraciones ya aplicadas en producción
- [Agregar anti-patrones específicos del repo]

## ADRs vigentes

Los ADRs están en `docs/adr/`. Los más relevantes para agentes:

- [ADR-NNN: Título — restricción principal]
- [ADR-NNN: Título — restricción principal]

## Contacto

- **Domain owner:** [nombre]
- **Tech lead:** [nombre]
