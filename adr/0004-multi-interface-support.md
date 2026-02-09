# ADR-0004: Soporte Multi-Interfaz (Open-WebUI, LibreChat)

**Estado:** Aceptado ✓

**Fecha:** 2026-02-09

**Tipo:** Arqueología (Decisión Retroactiva)

## Contexto

Además del widget embebible, el proyecto necesitaba ofrecer experiencias de chat completas tipo ChatGPT para usuarios que prefieren interfaces dedicadas en lugar de un widget flotante. Los requisitos eran:

- Interfaz full-screen similar a ChatGPT/Claude
- Soporte para múltiples modelos/proveedores
- Historial de conversaciones persistente
- Autenticación y multi-usuario
- Fácil despliegue junto con el widget
- Sin desarrollar una interfaz desde cero

## Decisión

Integrar **Open-WebUI** y **LibreChat** como interfaces de chat pre-construidas, desplegadas vía Docker Compose en perfiles separados.

**Open-WebUI:**
- Puerto: 3001
- Imagen: `ghcr.io/open-webui/open-webui:main`
- Configuración: Variables de entorno
- Perfil: `chat`

**LibreChat:**
- Puerto: 3002
- Imagen: `ghcr.io/danny-avila/librechat:latest`
- Configuración: `librechat-config.yaml`
- Requiere: MongoDB
- Perfil: `chat`

**Activación:**
```bash
docker-compose --profile chat up
```

## Consecuencias

### Positivas

✅ **Tiempo de desarrollo cero**: Interfaces completas sin escribir código UI adicional.

✅ **Características enterprise**: Autenticación, multi-usuario, historial, roles, todo incluido.

✅ **Actualizaciones automáticas**: Usando `latest` tags, se obtienen mejoras upstream gratuitamente.

✅ **Opciones para usuarios**: Diferentes preferencias de UI (Open-WebUI más simple, LibreChat más rico en features).

✅ **Ecosistema maduro**: Comunidades activas, bugs resueltos upstream, plugins disponibles.

### Negativas

⚠️ **Complejidad de despliegue**: Docker Compose con múltiples servicios aumenta la superficie de ataque y requisitos de recursos.

⚠️ **Falta de control**: No podemos modificar fácilmente la UI/UX de estas interfaces sin fork.

⚠️ **Dependencias adicionales**: MongoDB requerido para LibreChat (~500MB imagen), aumenta consumo de memoria.

⚠️ **Configuración fragmentada**: Open-WebUI usa env vars, LibreChat usa YAML, inconsistencia en configuración.

⚠️ **Actualizaciones breaking**: Tags `latest` pueden introducir cambios incompatibles sin aviso.

### Deuda Técnica Identificada

🔴 **Sin versiones fijas**: Usar `latest` es peligroso en producción, puede romper despliegues.

🔴 **No hay health checks robustos**: Solo Open-WebUI tiene healthcheck, LibreChat podría fallar silenciosamente.

🟡 **Configuración no validada**: `librechat-config.yaml` no se valida en startup, errores solo aparecen en runtime.

🟡 **Datos no respaldados**: Los volúmenes Docker (`open-webui-data`, `librechat-data`, `mongodb-data`) no tienen estrategia de backup documentada.

🟡 **Network compartida**: `eod-network` es externa y compartida, potencial conflicto con otros servicios.

🟡 **Sin SSL/TLS**: Los servicios exponen HTTP en lugar de HTTPS, requiere proxy reverso externo.

🟡 **Auth deshabilitada en Open-WebUI**: `ENABLE_SIGNUP=false` limita a un solo usuario, no multi-tenant real.

## Alternativas Consideradas

### 1. Desarrollar interfaz propia con Next.js/React
- **Pros**: Control total, UI/UX customizada, branding propio
- **Contras**: Meses de desarrollo, mantenimiento continuo, duplicar features existentes
- **Razón de rechazo**: Tiempo y costo prohibitivo para MVP

### 2. Solo Open-WebUI (sin LibreChat)
- **Pros**: Simplifica stack, menos recursos
- **Contras**: Menos opciones para usuarios, Open-WebUI es más limitado en features
- **Razón de rechazo**: Queremos dar opciones a diferentes tipos de usuarios

### 3. Solo LibreChat (sin Open-WebUI)
- **Pros**: Interfaz más rica, mejor multi-modelo
- **Contras**: Requiere MongoDB obligatorio, más pesado
- **Razón de rechazo**: Overhead excesivo para usuarios que solo quieren algo simple

### 4. Integrar con plataformas SaaS (Voiceflow, Chatbase)
- **Pros**: Cero mantenimiento de infraestructura
- **Contras**: Vendor lock-in, costos recurrentes, datos en terceros
- **Razón de rechazo**: Queremos solución self-hosted para control de datos

## Notas de Implementación

### Docker Compose Configuration

```yaml
open-webui:
  image: ghcr.io/open-webui/open-webui:main
  ports:
    - "3001:8080"
  environment:
    - WEBUI_NAME=Asistente Envios23
    - ENABLE_SIGNUP=false
    - OPENAI_API_BASE_URL=${RAG_API_URL}
  profiles:
    - chat

librechat:
  image: ghcr.io/danny-avila/librechat:latest
  ports:
    - "3002:3080"
  volumes:
    - ./librechat-config.yaml:/app/librechat.yaml
  depends_on:
    - mongodb
  profiles:
    - chat
```

### Host Gateway para Backend Local

Ambas interfaces usan `extra_hosts` para acceder al backend RAG en el host:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

Esto permite que `RAG_API_URL=http://host.docker.internal:8000` funcione desde dentro del contenedor.

### Mejoras Futuras Sugeridas

1. **Pin versions**: Cambiar `latest` por versiones específicas (ej: `v0.1.123`)
2. **Health checks completos**: Agregar para LibreChat y MongoDB
3. **Backup automático**: Cron job para respaldar volúmenes de datos
4. **Nginx reverse proxy**: SSL/TLS termination y routing unificado
5. **Secrets management**: No hardcodear API keys en docker-compose.yml
6. **Resource limits**: `mem_limit`, `cpus` para evitar consumo descontrolado

## Referencias

- [Open-WebUI GitHub](https://github.com/open-webui/open-webui)
- [LibreChat GitHub](https://github.com/danny-avila/LibreChat)
- [Docker Compose Profiles](https://docs.docker.com/compose/profiles/)
- Código fuente: `docker-compose.yml`
