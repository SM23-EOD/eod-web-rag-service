# ADR-0009: Migración de Embeddings Self-Hosted (TEI) a OpenAI via OpenRouter

**Fecha**: 2026-02-21  
**Estado**: ✅ Aceptado  
**Autores**: Copilot + Pedro  
**Decisión clave**: Reemplazar el servicio de embeddings self-hosted (TEI + BAAI/bge-m3) por OpenAI `text-embedding-3-small` via OpenRouter API, y re-indexar toda la base de conocimiento.

---

## Contexto y Problema

El contenedor `hex-embeddings` (Text Embeddings Inference de HuggingFace) corría el modelo `BAAI/bge-m3` en formato ONNX. Este modelo requiere ~4 GB de RAM solo para el buffer de inferencia.

### Diagnóstico del fallo

```
Failed to allocate memory for requested buffer of size 4294967296 (4 GB)
```

El droplet de producción (DigitalOcean) tiene **3.8 GB de RAM total**. El contenedor entraba en un crash loop infinito:

| Recurso | Disponible | Requerido por BGE-M3 |
|---|---|---|
| RAM total droplet | 3.8 GB | ~4 GB solo embedding buffer |
| Memory limit container | 5 GB | N/A (OOM antes de llegar) |
| Memory reservation | 3 GB | Insuficiente |

### Descubrimiento adicional

Las colecciones Qdrant existentes usaban vectores de **768 dimensiones** (del modelo anterior `paraphrase-multilingual-mpnet-base-v2`), no 1024 como BGE-M3 produce. Esto indica que BGE-M3 **nunca fue usado exitosamente en producción** — el switch a BGE-M3 se hizo en configuración pero el modelo nunca logró arrancar.

### Impacto

- `GET /api/v2/health/deep` → `status: "degraded"`, `embedding.ok: false`
- Frontend mostraba banner: "Servicio de búsqueda temporalmente no disponible"
- Pipeline RAG completo bloqueado (embed es paso obligatorio para retrieval)

---

## Alternativas Consideradas

### 1. Escalar el droplet (más RAM) — Rechazada

- Costo: ~$24/mes adicional (upgrade a 8 GB)
- Complejidad: Requiere migración de droplet o resize con downtime
- Riesgo: El modelo BGE-M3 seguiría compitiendo por RAM con el resto del stack (Qdrant, Redis, PostgreSQL, backend)
- Problema subyacente: Self-hosting modelos grandes en droplets limitados no es sostenible

### 2. Modelo más pequeño self-hosted — Rechazada

- Opciones: `all-MiniLM-L6-v2` (80 MB), `paraphrase-multilingual-mpnet-base-v2` (~400 MB)
- Problema: Menor calidad multilingüe. `paraphrase-multilingual` era el que estaba antes y ya se conocían sus limitaciones
- Decisión: Si vamos a cambiar, mejor ir a un modelo state-of-the-art

### 3. ✅ OpenAI embeddings via OpenRouter — Aceptada

- Modelo: `openai/text-embedding-3-small` via OpenRouter (`https://openrouter.ai/api/v1`)
- Dimensiones: 1536 (nativas del modelo, para máxima calidad de retrieval)
- Costo: ~$0.02/1M tokens (~$0.001 por job de re-indexación completo)
- Latencia: ~200-400ms por batch (vs ~50ms local, aceptable para indexación)
- Calidad: State-of-the-art en benchmarks multilingües (MTEB)
- Disponibilidad: 99.9%+ SLA via OpenRouter con failover automático entre providers

---

## Decisión

Usar `openai/text-embedding-3-small` via OpenRouter como servicio de embeddings en producción, con las dimensiones nativas de 1536 para maximizar la calidad de retrieval. Las colecciones Qdrant fueron recreadas con `size: 1536`.

### Evaluación previa

Documentada en [EVAL-001: OpenAI Embeddings Online](./EVAL-001-openai-embeddings-online.md) — confirmó viabilidad de latencia, costo y calidad antes de la migración.

---

## Implementación

### 1. Configuración (`stack-domain-rag.yml` en producción)

```yaml
# Antes:
EMBEDDING_MODE: "server"
EMBEDDING_SERVICE_URL: "http://hex-embeddings:80"
EMBEDDING_MODEL: "BAAI/bge-m3"
EMBEDDING_PROVIDER: "tei"

# Después:
EMBEDDING_MODE: "server"
EMBEDDING_SERVICE_URL: "http://hex-embeddings:80"  # No usado por provider openai
EMBEDDING_MODEL: "openai/text-embedding-3-small"
EMBEDDING_PROVIDER: "openai"
EMBEDDING_API_KEY: "${OPENROUTER_API_KEY}"
OPENAI_EMBEDDING_BASE_URL: "https://openrouter.ai/api/v1"
EMBEDDING_DIMENSIONS: "1536"
```

### 2. Re-indexación completa

Secuencia ejecutada:

1. Borrar 3 colecciones Qdrant (`kb_default_default`, `kb_eod-sm23`, `kb_sm23-dani`)
2. Limpiar archivos de chunk hashes (dedup) — `chunk_hashes/*.json`
3. Reiniciar `hex-rag-service` (para que cargue dedup vacío)
4. Recrear colecciones con esquema `{"vectors":{"dense":{"size":1536,"distance":"Cosine"}}}`
5. Re-indexar documento por documento via `POST /api/v2/documents/{id}/reindex`

### 3. Resultados de re-indexación

| Collection | Puntos | Agentes |
|---|---|---|
| `kb_eod-sm23` | 626 | draga, envio23, rfc-edd |
| `kb_default_default` | 15 | default |
| `kb_sm23-dani` | 15 | yeya-plm |
| **Total** | **656** | **5 agentes** |

- 40/41 documentos re-indexados exitosamente
- 1 fallo: `1d45a2f39b76df41.pdf` (Ley de Aduana 2022, 149 páginas) — error de parsing PDF
- 8 documentos del agente `draga` sin source file en disco (ingesta por URL sin copia local)

### 4. Limpieza de infraestructura

- **Contenedor `hex-embeddings` detenido** (`docker stop hex-embeddings`) — estaba en crash loop, ya no es necesario
- Backup de config previo en `stack-domain-rag.yml.bak`

---

## Verificación

### Health check post-migración

```json
{
    "status": "healthy",
    "checks": {
        "qdrant":    { "ok": true, "latency_ms": 106.9, "collections": 3 },
        "redis":     { "ok": true, "latency_ms": 14.7 },
        "embedding": { "ok": true, "latency_ms": 0.0 },
        "llm":       { "ok": true, "latency_ms": 134.2 }
    }
}
```

### Pipeline E2E verificado

```bash
# Query: "regulaciones aduanales para envío de paquetería a Cuba"
# → Confidence: 0.45, Sources: 1, Answer correcta con detalles específicos
#   (límite 30 USD / 3 kg, impuesto 30% sobre excedente)

# Query: "inteligencia artificial"
# → Confidence: 0.45, Sources: 1, Answer correcta basada en IA Wikipedia
```

---

## Consecuencias

### Positivas

- **Estabilidad**: Eliminada dependencia de RAM local para embedding. El servicio ya no se degrada por OOM
- **Calidad**: `text-embedding-3-small` es superior en benchmarks multilingües vs `paraphrase-multilingual-mpnet-base-v2`
- **Costo operativo**: $0 de RAM/CPU para embeddings (vs container compitiendo por 3+ GB)
- **Mantenimiento**: No requiere actualizar modelos locales, descargar pesos, ni gestionar container GPU/CPU

### Negativas

- **Dependencia externa**: OpenRouter como intermediario. Si OpenRouter o OpenAI caen, embeddings dejan de funcionar
- **Latencia**: ~200-400ms por request (vs ~50ms local). Aceptable para indexación, perceptible en queries en tiempo real
- **Costo por uso**: ~$0.02/1M tokens. En el volumen actual (~1000 chunks) es insignificante, pero escala con uso
- **Privacidad**: El contenido de los documentos viaja a servidores externos para generar embeddings

### Nota: Upgrade de 768 a 1536 dimensiones

Inicialmente se configuró con 768 dimensiones (Matryoshka truncation) por compatibilidad con las colecciones existentes. Tras evaluar que la calidad de retrieval es crítica para el sistema RAG, se decidió usar las dimensiones nativas de 1536 y recrear todas las colecciones desde cero. El incremento en almacenamiento (~2x vectores) es insignificante para el volumen actual (~656 puntos).

### Deuda técnica

- `hex-embeddings` container sigue definido en `stack-adapters-processing.yml` — debería removerse o marcarse como optional
- 8 documentos sin source file → necesitan re-ingesta manual (subir archivos o re-ingestar URLs)
- 1 PDF con error de parsing → investigar loader de PDFs grandes
- `EMBEDDING_SERVICE_URL` sigue apuntando a `hex-embeddings:80` (no se usa pero confunde)
- El endpoint `reset-reindex` tiene un bug: `'PostgresDocumentRegistry' object has no attribute '_manifest'`

---

## Archivos modificados

| Archivo | Ubicación | Cambio |
|---|---|---|
| `stack-domain-rag.yml` | `/opt/rag-service/` (producción) | Config embedding provider |
| `stack-domain-rag.yml.bak` | `/opt/rag-service/` (producción) | Backup pre-cambio |
| Colecciones Qdrant (x3) | Producción `:6333` | Borradas y recreadas con vectores de 1536 dimensiones |
| `chunk_hashes/*.json` | Container `hex-rag-service` | Limpiados para permitir re-indexación |

> **Nota**: Ningún archivo del repositorio frontend (`eod-web-rag-service`) fue modificado. Todos los cambios son en infraestructura de producción.
