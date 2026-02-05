# ====================================
# EOD Web RAG Service - Frontend
# Dockerfile para servir el widget
# ====================================

FROM node:20-alpine AS base

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# ====================================
# Stage: Development
# ====================================
FROM base AS development

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ====================================
# Stage: Production con Nginx
# ====================================
FROM nginx:alpine AS production

# Copiar configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar archivos estáticos
COPY *.html /usr/share/nginx/html/
COPY src/ /usr/share/nginx/html/src/

# Exponer puerto 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
