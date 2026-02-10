#!/bin/bash
# ====================================
# Script de despliegue para Digital Ocean
# ====================================

set -e

DROPLET_IP="167.172.225.44"
DROPLET_USER="root"
REMOTE_PATH="/opt/eod-web-rag-service"

echo "🚀 Desplegando widget en Digital Ocean..."
echo "📍 Droplet: $DROPLET_IP"
echo "📁 Ruta remota: $REMOTE_PATH"
echo ""

# 1. Crear directorio remoto si no existe
echo "📂 Creando directorio remoto..."
ssh $DROPLET_USER@$DROPLET_IP "mkdir -p $REMOTE_PATH"

# 2. Sincronizar archivos
echo "📤 Subiendo archivos al droplet..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'cli' \
  --exclude '.env' \
  ./ $DROPLET_USER@$DROPLET_IP:$REMOTE_PATH/

# 3. Desplegar con Docker Compose
echo ""
echo "🐳 Construyendo y desplegando contenedor..."
ssh $DROPLET_USER@$DROPLET_IP << 'EOF'
cd /opt/eod-web-rag-service

# Detener contenedor anterior si existe
docker compose --profile prod down 2>/dev/null || true

# Construir y levantar
docker compose --profile prod up -d --build

# Verificar estado
echo ""
echo "✅ Despliegue completado"
echo ""
docker compose --profile prod ps

echo ""
echo "🌐 Widget disponible en: http://167.172.225.44:8080"
echo ""
EOF

echo ""
echo "🎉 ¡Despliegue exitoso!"
echo ""
echo "🔗 URLs disponibles:"
echo "   Widget Demo: http://167.172.225.44:8080"
echo "   Health Check: http://167.172.225.44:8080/health"
echo ""
echo "📝 Para ver logs:"
echo "   ssh $DROPLET_USER@$DROPLET_IP 'docker logs eod-web-rag'"
echo ""
