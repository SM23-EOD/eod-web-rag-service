# ADR-0006: Nginx para Servicio en Producción

**Estado:** Aceptado ✓

**Fecha:** 2026-02-09

**Tipo:** Arqueología (Decisión Retroactiva)

## Contexto

El widget y archivos HTML de demo necesitan servirse en producción de forma eficiente. Los requisitos eran:

- Servir archivos estáticos (HTML, JS) con alta performance
- Bajo consumo de recursos (CPU, memoria)
- Configuración simple para un sitio estático
- Health checks para monitoreo
- Compatible con Docker/contenedores
- Sin necesidad de runtime de Node.js en producción

## Decisión

Usar **Nginx Alpine** como servidor web para producción, configurado mediante multi-stage Docker build.

**Implementación:**
```dockerfile
FROM nginx:alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY *.html /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/
EXPOSE 80
```

**Configuración Nginx:**
- Archivos servidos desde `/usr/share/nginx/html/`
- Puerto 80 expuesto, mapeado a 8081 en host
- Health check endpoint en `/health`

**Service en Docker Compose:**
```yaml
frontend:
  build:
    target: production
  ports:
    - "8081:80"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost/health"]
  profiles: [prod]
```

## Consecuencias

### Positivas

✅ **Performance excepcional**: Nginx es extremadamente rápido para archivos estáticos (~100k+ req/s).

✅ **Bajo footprint**: Imagen `nginx:alpine` es solo ~23MB, consume <10MB RAM idle.

✅ **Sin runtime JS**: No necesita Node.js en producción, reduciendo superficie de ataque.

✅ **Battle-tested**: Nginx es el servidor web más usado del mundo, altamente confiable.

✅ **Health checks nativos**: Fácil integración con orquestadores (Docker, k8s, load balancers).

### Negativas

⚠️ **No SPA routing**: Nginx sirve archivos tal cual, no maneja client-side routing (no aplica a este proyecto que no es SPA).

⚠️ **Configuración manual**: Cambios en rutas requieren editar `nginx.conf` y rebuilding imagen.

⚠️ **Sin HTTP/2 configurado**: Config actual solo HTTP/1.1, perdemos performance de HTTP/2.

⚠️ **Sin compresión**: No hay gzip/brotli configurado, archivos se sirven sin comprimir.

⚠️ **Sin SSL/TLS**: Solo HTTP, requiere proxy reverso externo para HTTPS.

### Deuda Técnica Identificada

✅ **Health check endpoint implementado**: Existe `/health` endpoint que retorna 200 OK.

✅ **Compresión gzip configurada**: JavaScript y otros text assets se comprimen automáticamente.

✅ **Caching headers configurados**: Assets estáticos tienen `expires 1y` y `Cache-Control: public, immutable`.

🟡 **Sin HTTP/2**: Solo HTTP/1.1 configurado, perdemos multiplexing y header compression (requiere SSL/TLS).

🟡 **CORS abierto**: `Access-Control-Allow-Origin *` es muy permisivo, debería restringirse a dominios específicos en producción.

🔴 **No hay minificación en build**: Los archivos JS se copian sin minificar, el script `npm run minify` existe pero no se usa en el Dockerfile.

🟡 **Sin security headers**: Faltan `X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`.

## Alternativas Consideradas

### 1. Node.js + Express (production)
- **Pros**: Familiar para equipo, fácil debugging, permite SSR futuro
- **Contras**: ~200MB imagen, mayor consumo de recursos, overkill para static files
- **Razón de rechazo**: Overhead injustificado para servir archivos estáticos

### 2. Apache HTTP Server
- **Pros**: Feature-rich, `.htaccess` para configuración flexible
- **Contras**: Más pesado que Nginx (~100MB vs 23MB), más lento para static files
- **Razón de rechazo**: Nginx es mejor para este caso de uso

### 3. Caddy
- **Pros**: Auto-SSL con Let's Encrypt, configuración más simple
- **Contras**: Menos maduro que Nginx, imagen más grande, menos familiar
- **Razón de rechazo**: Nginx más establecido en el equipo

### 4. CDN (Cloudflare, AWS CloudFront)
- **Pros**: Performance global, HTTPS incluido, caching automático, DDoS protection
- **Contras**: Vendor lock-in, costos recurrentes, complejidad de deploy
- **Razón de rechazo**: Queremos self-hosted para control total

### 5. GitHub Pages / Netlify / Vercel
- **Pros**: Deploy trivial, gratis, HTTPS automático, CI/CD integrado
- **Contras**: No control de infraestructura, límites de uso, no self-hosted
- **Razón de rechazo**: Necesitamos integrarse con backend propio

## Notas de Implementación

### Nginx Configuration (actual)

El archivo `nginx.conf` contiene configuración optimizada:
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # CORS headers
    location / {
        add_header Access-Control-Allow-Origin *;
        try_files $uri $uri/ /index.html;
    }

    # Health check
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
```

### Mejoras Sugeridas

**1. Mejorar compresión (agregar brotli y más tipos):**
```nginx
gzip_comp_level 6;
gzip_min_length 1000;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript application/x-font-ttf font/opentype;
```

**2. Restringir CORS en producción:**
```nginx
set $cors_origin "";
if ($http_origin ~* (https?://(www\.)?envios23\.com|localhost)) {
    set $cors_origin $http_origin;
}
add_header Access-Control-Allow-Origin $cors_origin;
```

**3. Agregar cache control para HTML:**
```nginx
location = /index.html {
    expires -1;
    add_header Cache-Control "no-cache, must-revalidate";
}
```

**4. Habilitar HTTP/2 (requiere SSL/TLS):**
```nginx
listen 443 ssl http2;
ssl_certificate /etc/nginx/ssl/cert.pem;
ssl_certificate_key /etc/nginx/ssl/key.pem;
```

**5. Security headers:**
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

### Build Optimization

El build actual solo copia archivos:
```dockerfile
COPY src/ /usr/share/nginx/html/src/
```

Debería incluir minificación:
```dockerfile
RUN npm run build    # Genera dist/assistant-widget.min.js
COPY dist/ /usr/share/nginx/html/dist/
```

Y actualizar HTML para usar versión minificada:
```html
<script src="/dist/assistant-widget.min.js"></script>
```

## Referencias

- [Nginx Official Docs](https://nginx.org/en/docs/)
- [Nginx Alpine Image](https://hub.docker.com/_/nginx)
- [HTTP/2 with Nginx](https://nginx.org/en/docs/http/ngx_http_v2_module.html)
- Código fuente: `Dockerfile`, `nginx.conf`
