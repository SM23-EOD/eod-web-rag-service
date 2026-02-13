#!/usr/bin/env python3
"""
Script CLI en Python para interactuar con el API RAG de Envios23
Uso: python rag-chat.py "tu pregunta aquí"
"""

import os
import sys
import json
import argparse
from typing import Optional, Dict, Any
try:
    import requests
except ImportError:
    print("Error: Se requiere el paquete 'requests'")
    print("Instalar con: pip install requests")
    sys.exit(1)

# Configuración desde variables de entorno
RAG_API_URL = os.getenv("RAG_API_URL", "http://localhost:8000")
ENDPOINT = f"{RAG_API_URL}/api/v2/mcp/tools/call"
TOOL_NAME = os.getenv("TOOL_NAME", "generate_rag_answer")
SESSION_ID = os.getenv("SESSION_ID", f"cli-{os.getenv('USER', 'user')}")
INCLUDE_SOURCES = os.getenv("INCLUDE_SOURCES", "true").lower() == "true"

# Colores ANSI
class Colors:
    GREEN = '\033[0;32m'
    BLUE = '\033[0;34m'
    YELLOW = '\033[1;33m'
    RED = '\033[0;31m'
    BOLD = '\033[1m'
    NC = '\033[0m'  # No Color


def ask_question(query: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Envía una pregunta al API RAG y retorna la respuesta
    """
    payload = {
        "tool_name": TOOL_NAME,
        "arguments": {
            "query": query,
            "include_sources": INCLUDE_SOURCES
        },
        "session_id": session_id or SESSION_ID
    }
    
    try:
        response = requests.post(
            ENDPOINT,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}


def print_response(response: Dict[str, Any]) -> None:
    """
    Imprime la respuesta de manera formateada
    """
    if "error" in response:
        print(f"{Colors.RED}Error: {response['error']}{Colors.NC}")
        return
    
    # Extraer respuesta
    try:
        content = response.get("content", [])
        if content and isinstance(content, list):
            text = content[0].get("text", "")
            print(f"{Colors.GREEN}Respuesta:{Colors.NC}")
            print(text)
            print()
            
            # Mostrar fuentes si están disponibles
            sources = content[0].get("sources", [])
            if sources and INCLUDE_SOURCES:
                print(f"{Colors.YELLOW}Fuentes:{Colors.NC}")
                for source in sources:
                    print(f"  - {source}")
                print()
        else:
            print(f"{Colors.YELLOW}Respuesta (JSON):{Colors.NC}")
            print(json.dumps(response, indent=2, ensure_ascii=False))
    except (KeyError, IndexError, TypeError) as e:
        print(f"{Colors.YELLOW}Respuesta (JSON):{Colors.NC}")
        print(json.dumps(response, indent=2, ensure_ascii=False))


def interactive_mode() -> None:
    """
    Modo interactivo para múltiples preguntas
    """
    print(f"{Colors.GREEN}{Colors.BOLD}=== RAG Chat CLI - Modo Interactivo ==={Colors.NC}")
    print(f"Endpoint: {Colors.BLUE}{ENDPOINT}{Colors.NC}")
    print(f"Session ID: {Colors.BLUE}{SESSION_ID}{Colors.NC}")
    print("Escribe 'exit' o 'quit' para salir\n")
    
    while True:
        try:
            query = input(f"{Colors.BLUE}Tu pregunta:{Colors.NC} ").strip()
            
            if query.lower() in ['exit', 'quit']:
                print("¡Hasta luego!")
                break
            
            if not query:
                continue
            
            print(f"{Colors.BLUE}Pregunta:{Colors.NC} {query}\n")
            response = ask_question(query)
            print_response(response)
            
        except KeyboardInterrupt:
            print("\n¡Hasta luego!")
            break
        except EOFError:
            break


def main():
    parser = argparse.ArgumentParser(
        description="CLI para interactuar con el API RAG de Envios23",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  %(prog)s "¿Cómo hago un envío?"
  %(prog)s --interactive
  RAG_API_URL=https://api.envios23.com %(prog)s "¿Qué es el tracking?"

Variables de entorno:
  RAG_API_URL       URL del API RAG (default: http://localhost:8000)
  TOOL_NAME         Nombre del tool MCP (default: generate_rag_answer)
  SESSION_ID        ID de sesión (default: cli-$USER)
  INCLUDE_SOURCES   Incluir fuentes (default: true)
        """
    )
    
    parser.add_argument(
        "query",
        nargs="?",
        help="Pregunta para el asistente RAG"
    )
    parser.add_argument(
        "-i", "--interactive",
        action="store_true",
        help="Modo interactivo"
    )
    parser.add_argument(
        "-s", "--session-id",
        help="ID de sesión personalizado"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Mostrar respuesta como JSON"
    )
    
    args = parser.parse_args()
    
    if args.interactive:
        interactive_mode()
    elif args.query:
        print(f"{Colors.BLUE}Pregunta:{Colors.NC} {args.query}\n")
        response = ask_question(args.query, args.session_id)
        
        if args.json:
            print(json.dumps(response, indent=2, ensure_ascii=False))
        else:
            print_response(response)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
