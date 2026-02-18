#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# DRAGA — Self-contained HTML bundle generator
# Genera un HTML autocontenido y portable del dashboard DRAGA
# que funciona sin nginx/docker, solo necesita acceso al backend
#
# Uso:
#   ./bundle.sh                          # genera draga-standalone.html con prompt de URL
#   ./bundle.sh https://mi-server.com    # pre-configura la URL del backend
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT_HTML="$SCRIPT_DIR/draga.html"
API_CLIENT="$SCRIPT_DIR/src/api-client.js"
OUTPUT="$SCRIPT_DIR/draga-standalone.html"
BACKEND_URL="${1:-}"

if [[ ! -f "$INPUT_HTML" ]]; then echo "❌ No se encuentra $INPUT_HTML"; exit 1; fi
if [[ ! -f "$API_CLIENT" ]]; then echo "❌ No se encuentra $API_CLIENT"; exit 1; fi

echo "📦 Generando bundle autocontenido..."

# 1. Read api-client.js content (without the last singleton line)
API_JS=$(sed '$d' "$API_CLIENT")  # remove "window.api = new RAGApiClient();"

# 2. Build the inline script block with config UI
# If BACKEND_URL is provided, skip the config dialog
if [[ -n "$BACKEND_URL" ]]; then
    # Strip trailing slash
    BACKEND_URL="${BACKEND_URL%/}"
    # Ensure it ends with /api/v2
    if [[ ! "$BACKEND_URL" =~ /api/v2$ ]]; then
        BACKEND_URL="${BACKEND_URL}/api/v2"
    fi
    INIT_SCRIPT="window.api = new RAGApiClient('${BACKEND_URL}');"
else
    INIT_SCRIPT=$(cat <<'EOJS'
// ═══ DRAGA Standalone — Backend URL Configuration ═══
(function() {
    const saved = localStorage.getItem('draga-backend-url');
    if (saved) {
        window.api = new RAGApiClient(saved);
        return;
    }

    // Block app init until configured
    window._dragaOrigInit = App?.init;

    // Show config overlay
    document.addEventListener('DOMContentLoaded', () => {
        const overlay = document.createElement('div');
        overlay.id = 'backendConfigOverlay';
        overlay.innerHTML = `
            <div style="position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;font-family:'Lato',sans-serif">
                <div style="background:#1a2236;border:1px solid #334155;border-radius:16px;padding:40px;max-width:520px;width:90%;box-shadow:0 25px 50px rgba(0,0,0,0.5)">
                    <div style="text-align:center;margin-bottom:24px">
                        <div style="font-size:48px;margin-bottom:12px">🐉</div>
                        <h2 style="color:#f0f2f5;font-size:22px;font-weight:700;margin:0 0 8px">DRAGA — Configuración</h2>
                        <p style="color:#94a3b8;font-size:14px;margin:0">Este dashboard necesita conectarse a tu backend RAG</p>
                    </div>

                    <label style="display:block;color:#94a3b8;font-size:13px;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">URL del Backend</label>
                    <input id="cfgBackendUrl" type="url" placeholder="https://tu-servidor.com" 
                        style="width:100%;padding:12px 16px;background:#242e44;border:1px solid #334155;border-radius:8px;color:#f0f2f5;font-size:15px;outline:none;margin-bottom:6px"
                        value="">
                    <p style="color:#64748b;font-size:12px;margin:0 0 20px">
                        Ejemplo: <code style="background:#242e44;padding:2px 6px;border-radius:4px;color:#a78bfa">https://mi-servidor.com</code>
                        <br>Se añadirá <code style="background:#242e44;padding:2px 6px;border-radius:4px;color:#a78bfa">/api/v2</code> automáticamente
                    </p>

                    <label style="display:block;color:#94a3b8;font-size:13px;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">API Key <span style="font-weight:400;text-transform:none">(opcional)</span></label>
                    <input id="cfgApiKey" type="password" placeholder="sk-..."
                        style="width:100%;padding:12px 16px;background:#242e44;border:1px solid #334155;border-radius:8px;color:#f0f2f5;font-size:15px;outline:none;margin-bottom:24px">

                    <button id="cfgConnect"
                        style="width:100%;padding:14px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;transition:opacity .2s"
                        onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                        Conectar
                    </button>
                    <p id="cfgError" style="color:#ef4444;font-size:13px;text-align:center;margin:12px 0 0;display:none"></p>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const urlInput = document.getElementById('cfgBackendUrl');
        const keyInput = document.getElementById('cfgApiKey');
        const errEl = document.getElementById('cfgError');

        document.getElementById('cfgConnect').addEventListener('click', async () => {
            let url = urlInput.value.trim().replace(/\/+$/, '');
            if (!url) { errEl.textContent = 'Introduce la URL del backend'; errEl.style.display = 'block'; return; }

            // Normalise: add /api/v2 if not present
            if (!url.endsWith('/api/v2')) {
                url = url.replace(/\/api\/v2\/?$/, '') + '/api/v2';
            }

            errEl.textContent = 'Conectando...';
            errEl.style.color = '#94a3b8';
            errEl.style.display = 'block';

            try {
                const testRes = await fetch(url + '/health', { signal: AbortSignal.timeout(8000) });
                if (!testRes.ok) throw new Error('HTTP ' + testRes.status);
            } catch (e) {
                errEl.textContent = 'No se pudo conectar: ' + (e.message || 'Error de red') + '. Verifica la URL y que el backend esté corriendo.';
                errEl.style.color = '#ef4444';
                return;
            }

            // Save and init
            localStorage.setItem('draga-backend-url', url);
            window.api = new RAGApiClient(url);
            if (keyInput.value.trim()) {
                window.api.apiKey = keyInput.value.trim();
                localStorage.setItem('rag-api-key', keyInput.value.trim());
            }
            overlay.remove();
            App.init();
        });

        // Prevent default App.init
        // (handled below by deferring DOMContentLoaded)
    });
})();
EOJS
)
fi

# 3. Build the output HTML
# Replace the external script tag with inline content
# Also modify the DOMContentLoaded to check for standalone config
{
    # Process line by line  
    while IFS= read -r line; do
        # Replace external api-client.js with inline version
        if [[ "$line" == *'<script src="src/api-client.js"></script>'* ]]; then
            echo '<script>'
            echo "/* ═══ INLINED: api-client.js ═══ */"
            echo "$API_JS"
            echo ""
            echo "/* ═══ STANDALONE INIT ═══ */"
            echo "$INIT_SCRIPT"
            echo '</script>'
        else
            echo "$line"
        fi
    done < "$INPUT_HTML"
} > "$OUTPUT"

# 4. If no pre-configured URL, patch DOMContentLoaded to defer when overlay is active
if [[ -z "$BACKEND_URL" ]]; then
    # Replace the DOMContentLoaded line to check if backend is configured
    sed -i "s|document.addEventListener('DOMContentLoaded', () => App.init());|document.addEventListener('DOMContentLoaded', () => { if (window.api) App.init(); /* else: config overlay handles init */ });|" "$OUTPUT"
fi

# Get file size
SIZE=$(du -h "$OUTPUT" | cut -f1)
LINES=$(wc -l < "$OUTPUT")

echo ""
echo "✅ Bundle generado: $OUTPUT"
echo "   📊 $SIZE ($LINES líneas)"
echo ""
echo "Instrucciones:"
echo "  1. Abre el archivo en cualquier navegador"
if [[ -n "$BACKEND_URL" ]]; then
    echo "  2. Backend pre-configurado: $BACKEND_URL"
else
    echo "  2. Ingresa la URL de tu backend cuando se muestre el diálogo"
fi
echo "  3. ¡Listo! Comparte el archivo con quien quieras"
echo ""
echo "⚠️  Requisitos:"
echo "  - El backend debe tener CORS habilitado para el origen 'null' (file://)"
echo "    o servir este HTML desde un servidor web"
echo "  - Conexión a internet para Google Fonts y marked.js (CDN)"
