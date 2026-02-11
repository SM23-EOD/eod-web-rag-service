#!/bin/bash

# Script CLI para interactuar con el API RAG de Envios23
# Uso: ./rag-chat.sh "tu pregunta aquí"

set -e

# Configuración
RAG_API_URL="${RAG_API_URL:-http://localhost:8000}"
ENDPOINT="${RAG_API_URL}/api/v2/mcp/tools/call"
TOOL_NAME="${TOOL_NAME:-generate_rag_answer}"
SESSION_ID="${SESSION_ID:-cli-$(whoami)}"
INCLUDE_SOURCES="${INCLUDE_SOURCES:-true}"

# Colores para el output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para mostrar ayuda
show_help() {
    cat << EOF
${GREEN}RAG Chat CLI - Envios23${NC}

Uso:
    $0 "tu pregunta"
    $0 --interactive

Opciones:
    --interactive, -i    Modo interactivo
    --help, -h          Mostrar esta ayuda

Variables de entorno:
    RAG_API_URL         URL del API RAG (default: http://localhost:8000)
    TOOL_NAME           Nombre del tool MCP (default: generate_rag_answer)
    SESSION_ID          ID de sesión (default: cli-\$(whoami))
    INCLUDE_SOURCES     Incluir fuentes (default: true)

Ejemplos:
    $0 "¿Cómo hago un envío?"
    $0 --interactive
    RAG_API_URL=https://api.envios23.com $0 "¿Qué es el tracking?"
EOF
}

# Función para hacer una pregunta al API
ask_question() {
    local query="$1"
    
    echo -e "${BLUE}Pregunta:${NC} $query"
    echo ""
    
    # Hacer la petición con timeout y capturar código de estado
    http_code=$(curl -s -w "%{http_code}" -o /tmp/rag_response_$$.json -X POST "$ENDPOINT" \
        -H "Content-Type: application/json" \
        -m 30 \
        -d "{
            \"name\": \"$TOOL_NAME\",
            \"arguments\": {
                \"query\": \"$query\",
                \"session_id\": \"$SESSION_ID\",
                \"include_sources\": $INCLUDE_SOURCES
            }
        }" 2>&1)
    
    curl_exit=$?
    
    # Verificar si curl falló
    if [ $curl_exit -ne 0 ]; then
        echo -e "${RED}❌ Error de conexión${NC}"
        echo "No se pudo conectar al servidor en: $RAG_API_URL"
        echo ""
        echo "Asegúrate de que:"
        echo "  1. El servidor RAG está corriendo"
        echo "  2. La URL es correcta: $RAG_API_URL"
        echo "  3. No hay firewall bloqueando la conexión"
        echo ""
        rm -f /tmp/rag_response_$$.json
        return 1
    fi
    
    # Leer la respuesta
    response=$(cat /tmp/rag_response_$$.json 2>/dev/null)
    rm -f /tmp/rag_response_$$.json
    
    # Verificar código HTTP
    if [[ "$http_code" != "200" ]]; then
        echo -e "${RED}❌ Error del servidor (HTTP $http_code)${NC}"
        echo "Respuesta: $response"
        echo ""
        return 1
    fi
    
    # Verificar si la respuesta está vacía
    if [ -z "$response" ]; then
        echo -e "${RED}❌ Error: Respuesta vacía del servidor${NC}"
        echo ""
        return 1
    fi
    
    # Extraer la respuesta
    if command -v jq &> /dev/null; then
        # Verificar si es JSON válido
        if ! echo "$response" | jq empty 2>/dev/null; then
            echo -e "${RED}❌ Error: Respuesta no es JSON válido${NC}"
            echo "Respuesta del servidor:"
            echo "$response"
            echo ""
            return 1
        fi
        
        # Si jq está disponible, formatear la respuesta
        answer=$(echo "$response" | jq -r '.content[0].text // .error // "Error al procesar la respuesta"')
        echo -e "${GREEN}Respuesta:${NC}"
        echo "$answer"
        echo ""
        
        # Mostrar fuentes si están incluidas
        if [ "$INCLUDE_SOURCES" == "true" ]; then
            sources=$(echo "$response" | jq -r '.content[0].sources // [] | .[] | "  - \(.)"' 2>/dev/null)
            if [ ! -z "$sources" ]; then
                echo -e "${YELLOW}Fuentes:${NC}"
                echo "$sources"
            fi
        fi
    else
        # Sin jq, mostrar el JSON completo
        echo -e "${GREEN}Respuesta:${NC}"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
    fi
    echo ""
}

# Modo interactivo
interactive_mode() {
    echo -e "${GREEN}=== RAG Chat CLI - Modo Interactivo ===${NC}"
    echo -e "Endpoint: ${BLUE}$ENDPOINT${NC}"
    echo -e "Session ID: ${BLUE}$SESSION_ID${NC}"
    echo -e "Escribe 'exit' o 'quit' para salir"
    echo ""
    
    while true; do
        echo -n -e "${BLUE}Tu pregunta:${NC} "
        read -r query
        
        # Verificar si el usuario quiere salir
        if [[ "$query" == "exit" || "$query" == "quit" ]]; then
            echo "¡Hasta luego!"
            break
        fi
        
        # Ignorar líneas vacías
        if [ -z "$query" ]; then
            continue
        fi
        
        ask_question "$query"
    done
}

# Procesar argumentos
if [ $# -eq 0 ]; then
    show_help
    exit 0
fi

case "$1" in
    --help|-h)
        show_help
        exit 0
        ;;
    --interactive|-i)
        interactive_mode
        exit 0
        ;;
    *)
        ask_question "$1"
        exit 0
        ;;
esac
