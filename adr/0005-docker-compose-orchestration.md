# ADR-0005: Docker Compose para Orquestación de Servicios

**Estado:** Aceptado ✓

**Fecha:** 2026-02-09

**Tipo:** Arqueología (Decisión Retroactiva)

## Contexto

El proyecto consiste en múltiples componentes que deben trabajar juntos:

- Widget frontend (development y production)
- Open-WebUI (interfaz de chat)
- LibreChat (interfaz alternativa)
- MongoDB (para LibreChat)
- Nginx (para producción)

Se necesitaba una solución para:
- Orquestar múltiples servicios con dependencias
- Diferenciar entre desarrollo y producción
- Permitir activar/desactivar servicios opcionalmente
- Compartir configuración y variables de entorno
- Networking entre contenedores

## Decisión

Usar **Docker Compose** con arquitectura multi-stage y perfiles para orquestar todos los servicios del proyecto.

**Estructura:**
- 4 servicios principales definidos
- 3 perfiles: `dev`, `prod`, `chat`
- Multi-stage Dockerfile para frontend
- Red compartida externa `eod-network`
- Volúmenes nombrados para persistencia

**Comandos principales:**
```bash
# Desarrollo
docker-compose --profile dev up

# Producción
docker-compose --profile prod up

# Interfaces de chat
docker-compose --profile chat up
```

## Consecuencias

### Positivas

✅ **Orquestación declarativa**: Toda la configuración en un solo archivo YAML versionado.

✅ **Reproducibilidad**: Cualquier desarrollador puede levantar el stack completo con un comando.

✅ **Perfiles flexibles**: Activar solo los servicios necesarios sin comentar/descomentar código.

✅ **Aislamiento de red**: Servicios se comunican por nombres de servicio, no IPs hardcodeadas.

✅ **Gestión de volúmenes**: Persistencia automática de datos entre reinicios.

✅ **Variables de entorno centralizadas**: `.env` file compartido por todos los servicios.

### Negativas

⚠️ **No production-ready**: Docker Compose no es apropiado para producción real (usar Kubernetes/ECS).

⚠️ **Single host limitation**: Todos los servicios deben correr en la misma máquina.

⚠️ **No auto-scaling**: No puede escalar horizontalmente servicios automáticamente.

⚠️ **Health checks básicos**: Solo validación simple, sin auto-healing sofisticado.

⚠️ **Secrets en plaintext**: Variables de entorno en `.env` no están encriptadas.

### Deuda Técnica Identificada

🔴 **Red externa no creada automáticamente**: `external: true` requiere crear `eod-network` manualmente antes de `docker-compose up`, causando errores confusos para nuevos usuarios.

🔴 **Sin gestión de secretos**: API keys y passwords en `.env` sin encriptación, violación de security best practices.

🟡 **Logs no centralizados**: Cada servicio loguea a stdout sin agregación ni rotación.

🟡 **Resource limits ausentes**: No hay `mem_limit`, `cpus`, servicios pueden consumir todos los recursos del host.

🟡 **Sin backups automatizados**: Volúmenes pueden perderse si se borran sin estrategia de respaldo.

🟡 **Health checks inconsistentes**: Solo `frontend` tiene health check, otros servicios podrían estar "up" pero no funcionales.

🔴 **Dependencias implícitas**: LibreChat depende de MongoDB pero `depends_on` solo espera que el contenedor esté "started", no "ready".

## Alternativas Consideradas

### 1. Kubernetes (k8s)
- **Pros**: Production-grade, auto-scaling, self-healing, multi-host
- **Contras**: Complejidad extrema para proyecto pequeño, overhead operacional
- **Razón de rechazo**: Over-engineering para un MVP/desarrollo local

### 2. Docker Swarm
- **Pros**: Más simple que k8s, multi-host, built-in load balancing
- **Contras**: Menos adopción que k8s, ecosistema más pequeño
- **Razón de rechazo**: Docker Compose suficiente para desarrollo, Swarm dying technology

### 3. Scripts de shell (docker run)
- **Pros**: Control total, sin dependencias de herramientas
- **Contras**: Verboso, error-prone, no declarativo, difícil de mantener
- **Razón de rechazo**: Docker Compose mucho más mantenible

### 4. Separate repos con Docker Compose cada uno
- **Pros**: Separación de concerns, versionado independiente
- **Contras**: Difícil coordinar versiones, networking complejo
- **Razón de rechazo**: Queremos monorepo para simplificar desarrollo

## Notas de Implementación

### Profiles Usage

```yaml
frontend-dev:
  profiles: [dev]    # Solo con --profile dev

frontend:
  profiles: [prod]   # Solo con --profile prod

open-webui:
  profiles: [chat]   # Solo con --profile chat
```

Permite activar múltiples:
```bash
docker-compose --profile dev --profile chat up
```

### Network External

```yaml
networks:
  default:
    name: eod-network
    external: true
```

Requiere crear la red manualmente:
```bash
docker network create eod-network
```

**Problema:** Si olvidas este paso, falla con error críptico:
```
network eod-network declared as external, but could not be found
```

**Solución sugerida:** Usar script de inicialización o cambiar a `external: false` con creación automática.

### Multi-Stage Dockerfile

```dockerfile
FROM node:20-alpine AS base
# ... install dependencies

FROM base AS development
CMD ["npm", "run", "dev"]

FROM nginx:alpine AS production
COPY src/ /usr/share/nginx/html/src/
```

Permite reutilizar capas base y optimizar tamaño de imagen production.

### Mejoras Futuras Sugeridas

1. **Inicialización automática de red:**
```yaml
networks:
  default:
    name: eod-network
    driver: bridge  # external: false
```

2. **Health checks para todos los servicios:**
```yaml
mongodb:
  healthcheck:
    test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
    interval: 10s
    timeout: 5s
    retries: 3
```

3. **Resource limits:**
```yaml
services:
  open-webui:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
```

4. **Secrets con Docker Secrets o .env.encrypted:**
```yaml
secrets:
  rag_api_key:
    file: ./secrets/rag_api_key.txt
```

5. **Script de setup:**
```bash
#!/bin/bash
# setup.sh
docker network create eod-network 2>/dev/null || true
docker-compose --profile dev up
```

## Referencias

- [Docker Compose File Reference](https://docs.docker.com/compose/compose-file/)
- [Docker Compose Profiles](https://docs.docker.com/compose/profiles/)
- [Multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- Código fuente: `docker-compose.yml`, `Dockerfile`
