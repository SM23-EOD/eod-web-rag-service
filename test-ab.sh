#!/bin/bash

# Script para testing local del framework A/B
# Ejecutar desde la raíz del proyecto

set -e

echo "🧪 A/B Test - Local Testing Script"
echo "===================================="
echo ""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar si Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 no está instalado. Por favor instálalo primero."
    exit 1
fi

# Puerto por defecto
PORT=${1:-8000}

echo -e "${BLUE}📦 Iniciando servidor HTTP en puerto $PORT...${NC}"
echo ""
echo -e "${GREEN}✅ Servidor iniciado correctamente!${NC}"
echo ""
echo "🌐 URLs disponibles:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "  ${YELLOW}A/B Test Demo:${NC}"
echo "  http://localhost:$PORT/ab-test.html"
echo ""
echo -e "  ${YELLOW}Unit Tests:${NC}"
echo "  http://localhost:$PORT/ab-test-tests.html"
echo ""
echo -e "  ${YELLOW}Widget Original (Variante A):${NC}"
echo "  http://localhost:$PORT/index.html"
echo ""
echo -e "  ${YELLOW}Widget V2 (Variante B):${NC}"
echo "  http://localhost:$PORT/demo-widget-v2.html"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}💡 Tips:${NC}"
echo "  • Abre las DevTools para ver los logs del A/B test"
echo "  • Usa sessionStorage.clear() + reload para resetear variante"
echo "  • Fuerza una variante con: ?forceVariant=A o ?forceVariant=B"
echo ""
echo "Presiona Ctrl+C para detener el servidor"
echo ""

# Iniciar servidor Python
python3 -m http.server $PORT
