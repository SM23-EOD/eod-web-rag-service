#!/usr/bin/env node
/**
 * build-standalone.js
 * 
 * Genera un archivo HTML 100% autocontenido a partir de draga.html
 * que puede funcionar como unidad autónoma de frontend sin dependencias
 * externas ni servidor co-ubicado.
 *
 * Transformaciones:
 *  1. Inlinea src/api-client.js dentro de <script>
 *  2. Inlinea marked.min.js (descarga de CDN o usa cache local)
 *  3. Añade overlay de configuración de backend URL al inicio
 *  4. Elimina el tab de Widgets (sidebar + módulo HTML + JS)
 *  5. Modifica App.init() para deferirse hasta que se configure el backend
 *
 * Uso:
 *   node scripts/build-standalone.js                     → dist/draga-standalone.html
 *   node scripts/build-standalone.js --out my-draga.html → my-draga.html
 *   node scripts/build-standalone.js --base-url https://api.example.com/api/v2
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');

// ── CLI args ──────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const OUTPUT = getArg('--out') || resolve(ROOT, 'dist', 'draga-standalone.html');
const PRESET_URL = getArg('--base-url') || null;

// ── Helpers ───────────────────────────────────────────────────
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return fetchUrl(res.headers.location).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
            res.on('error', reject);
        }).on('error', reject);
    });
}

// ── Backend config overlay IIFE ───────────────────────────────
// This gets injected right before </body> and runs before App.init()
const CONFIG_OVERLAY_CODE = `
/* ═══ STANDALONE: Backend Configuration Overlay ═══ */
(function() {
    const STORAGE_KEY = 'draga-backend-url';
    const APIKEY_KEY  = 'draga-api-key';

    // If URL already configured (localStorage), restore and boot
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        window.api = new RAGApiClient(saved);
        const savedKey = localStorage.getItem(APIKEY_KEY);
        if (savedKey) window.api.apiKey = savedKey;
        document.addEventListener('DOMContentLoaded', () => App.init());
        return;
    }

    // Show config overlay on DOMContentLoaded
    document.addEventListener('DOMContentLoaded', () => {
        const overlay = document.createElement('div');
        overlay.id = 'configOverlay';
        overlay.innerHTML = \`
            <div style="position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:Lato,system-ui,sans-serif;">
                <div style="background:#1a1a2e;border:1px solid #334;border-radius:16px;padding:40px;max-width:440px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,.5);">
                    <div style="text-align:center;margin-bottom:24px;">
                        <div style="font-size:42px;margin-bottom:8px;">🐉</div>
                        <h2 style="color:#c4b5fd;margin:0;font-size:22px;font-weight:700;">DRAGA Standalone</h2>
                        <p style="color:#888;font-size:13px;margin-top:6px;">Configura la conexión al backend</p>
                    </div>
                    <label style="display:block;margin-bottom:16px;">
                        <span style="color:#aaa;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">Backend URL</span>
                        <input id="cfgUrl" type="url" placeholder="https://tu-servidor.com" 
                               style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px 14px;background:#0d0d1a;border:1px solid #334;border-radius:8px;color:#e0e0e0;font-size:14px;outline:none;"
                               autofocus>
                        <span style="color:#666;font-size:11px;margin-top:4px;display:block;">Se añadirá /api/v2 automáticamente si no termina en ello</span>
                    </label>
                    <label style="display:block;margin-bottom:20px;">
                        <span style="color:#aaa;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;">API Key <span style="color:#555">(opcional)</span></span>
                        <input id="cfgKey" type="password" placeholder="sk-..." 
                               style="display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:10px 14px;background:#0d0d1a;border:1px solid #334;border-radius:8px;color:#e0e0e0;font-size:14px;outline:none;">
                    </label>
                    <button id="cfgConnect" 
                            style="width:100%;padding:12px;background:linear-gradient(135deg,#7c3aed,#6d28d9);border:none;border-radius:8px;color:#fff;font-size:14px;font-weight:700;cursor:pointer;transition:opacity .2s;"
                            onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
                        🔌 Conectar
                    </button>
                    <div id="cfgError" style="color:#f87171;font-size:12px;margin-top:12px;text-align:center;display:none;"></div>
                    <div style="text-align:center;margin-top:16px;">
                        <span style="color:#555;font-size:11px;">Standalone export · DRAGA Platform</span>
                    </div>
                </div>
            </div>
        \`;
        document.body.appendChild(overlay);

        const urlInput = document.getElementById('cfgUrl');
        const keyInput = document.getElementById('cfgKey');
        const connectBtn = document.getElementById('cfgConnect');
        const errorEl = document.getElementById('cfgError');

        function normalizeUrl(raw) {
            let url = raw.trim().replace(/\\/+$/, '');
            if (!url.startsWith('http')) url = 'https://' + url;
            if (!url.endsWith('/api/v2')) {
                url = url.replace(/\\/api\\/v2\\/?$/, '');
                url += '/api/v2';
            }
            return url;
        }

        async function connect() {
            errorEl.style.display = 'none';
            const raw = urlInput.value.trim();
            if (!raw) { showError('Ingresa la URL del backend'); return; }
            
            const url = normalizeUrl(raw);
            connectBtn.textContent = '⏳ Verificando...';
            connectBtn.disabled = true;

            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 8000);
                const healthUrl = url.replace(/\\/api\\/v2$/, '') + '/health';
                const res = await fetch(healthUrl, { signal: controller.signal });
                clearTimeout(timer);
                if (!res.ok) throw new Error('HTTP ' + res.status);
                
                // Success — save and boot
                localStorage.setItem(STORAGE_KEY, url);
                if (keyInput.value.trim()) localStorage.setItem(APIKEY_KEY, keyInput.value.trim());
                
                window.api = new RAGApiClient(url);
                if (keyInput.value.trim()) window.api.apiKey = keyInput.value.trim();
                
                overlay.remove();
                App.init();
            } catch (e) {
                showError(e.name === 'AbortError' ? 'Timeout — el servidor no responde' : 'No se pudo conectar: ' + e.message);
                connectBtn.textContent = '🔌 Conectar';
                connectBtn.disabled = false;
            }
        }

        function showError(msg) {
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        }

        connectBtn.addEventListener('click', connect);
        urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') connect(); });
    });
})();
`;

// ── Main build ────────────────────────────────────────────────
async function build() {
    console.log('🐉 Building DRAGA standalone HTML...');

    // 1. Read source
    const srcPath = resolve(ROOT, 'draga.html');
    let html = readFileSync(srcPath, 'utf-8');
    console.log(`   📄 Source: draga.html (${html.split('\n').length} lines)`);

    // 2. Read api-client.js
    const apiClientPath = resolve(ROOT, 'src', 'api-client.js');
    const apiClientCode = readFileSync(apiClientPath, 'utf-8');
    console.log(`   📦 Inlining: api-client.js (${apiClientCode.split('\n').length} lines)`);

    // 3. Fetch marked.min.js (with local cache)
    const markedCachePath = resolve(ROOT, 'scripts', '.cache', 'marked.min.js');
    let markedCode;
    if (existsSync(markedCachePath)) {
        markedCode = readFileSync(markedCachePath, 'utf-8');
        console.log(`   📦 Inlining: marked.min.js (cached, ${(markedCode.length / 1024).toFixed(0)}KB)`);
    } else {
        console.log('   ⬇️  Downloading marked.min.js from CDN...');
        markedCode = await fetchUrl('https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js');
        mkdirSync(dirname(markedCachePath), { recursive: true });
        writeFileSync(markedCachePath, markedCode);
        console.log(`   📦 Inlining: marked.min.js (${(markedCode.length / 1024).toFixed(0)}KB)`);
    }

    // 4. Replace CDN <script src="marked"> with inline
    html = html.replace(
        /^\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/marked@[^"]*"><\/script>\s*$/m,
        `    <script>/* ═══ INLINED: marked.min.js ═══ */\n${markedCode}\n    </script>`
    );

    // 5. Replace external api-client.js with inline
    html = html.replace(
        /^\s*<script src="src\/api-client\.js"><\/script>\s*$/m,
        `    <script>\n/* ═══ INLINED: api-client.js ═══ */\n${apiClientCode}\n    </script>`
    );

    // 6. Remove Widgets sidebar nav item
    html = html.replace(
        /^\s*<a class="nav-item"[^>]*data-mod="widgets"[^>]*>.*?<\/a>\s*$/m,
        ''
    );

    // 7. Remove Widgets module HTML block (from <div class="module" id="mod-widgets"> to next <div class="module")
    const widgetModStart = html.indexOf('<div class="module" id="mod-widgets">');
    if (widgetModStart !== -1) {
        // Find the next module div
        const afterWidget = html.indexOf('<div class="module"', widgetModStart + 1);
        if (afterWidget !== -1) {
            // Find the preceding comment line (<!-- ── CONFIG ── --> or similar)
            const beforeNextModule = html.lastIndexOf('<!--', afterWidget);
            const cutEnd = beforeNextModule > widgetModStart ? beforeNextModule : afterWidget;
            html = html.substring(0, widgetModStart) + html.substring(cutEnd);
        }
    }

    // Also remove the <!-- ── WIDGETS ── --> comment if leftover
    html = html.replace(/^\s*<!-- ── WIDGETS ── -->\s*$/m, '');

    // 8. Remove 'widgets' from MODULES array
    html = html.replace(
        /const MODULES\s*=\s*\[([^\]]+)\]/,
        (match, list) => {
            const cleaned = list.replace(/['"]widgets['"],?\s*/g, '').replace(/,\s*,/g, ',').replace(/,\s*\]/, ']');
            return `const MODULES = [${cleaned}]`;
        }
    );

    // 9. Remove the original DOMContentLoaded → App.init() line
    //    (the config overlay handles init instead)
    html = html.replace(
        /^\s*document\.addEventListener\(['"]DOMContentLoaded['"],\s*\(\)\s*=>\s*App\.init\(\)\);?\s*$/m,
        '// App.init() is called by the standalone config overlay after backend is configured'
    );

    // 10. Inject config overlay code before the closing </script> of the main script block
    const lastScriptClose = html.lastIndexOf('</script>');
    if (lastScriptClose !== -1) {
        html = html.substring(0, lastScriptClose) +
            '\n' + CONFIG_OVERLAY_CODE + '\n' +
            html.substring(lastScriptClose);
    }

    // 11. Update title
    html = html.replace(
        /<title>DRAGA — Instance Dashboard<\/title>/,
        '<title>DRAGA — Standalone Dashboard</title>'
    );

    // 12. Add a reset-connection utility in the Config module header area
    // Find the topbar and add a "disconnect" button  
    html = html.replace(
        /(<div class="topbar">)/,
        `$1\n        <button onclick="localStorage.removeItem('draga-backend-url');localStorage.removeItem('draga-api-key');location.reload();" style="background:none;border:1px solid #444;border-radius:6px;color:#888;padding:4px 10px;font-size:11px;cursor:pointer;margin-right:8px;" title="Desconectar y reconfigurar backend">🔌 Reconectar</button>`
    );

    // 13. Neutralize admin.html link (dead in standalone)
    html = html.replace(
        /href="admin\.html"/g,
        'href="#" onclick="toast(\'Panel admin no disponible en modo standalone\',\'info\');return false;"'
    );

    // 14. Write output
    mkdirSync(dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, html, 'utf-8');

    const lines = html.split('\n').length;
    const sizeKB = (Buffer.byteLength(html) / 1024).toFixed(0);
    console.log(`\n   ✅ Output: ${OUTPUT}`);
    console.log(`   📊 ${lines} lines, ${sizeKB}KB`);
    console.log(`   🔧 Widgets tab removed, admin link neutralized`);
    console.log(`   🔌 Backend config overlay injected`);
    if (PRESET_URL) console.log(`   🌐 Preset URL: ${PRESET_URL}`);
    console.log('\n   🐉 Done! Open the file in any browser to use.\n');
}

build().catch(err => {
    console.error('❌ Build failed:', err);
    process.exit(1);
});
