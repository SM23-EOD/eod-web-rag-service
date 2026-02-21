# EVAL-001: Viabilidad de OpenAI Embeddings Online como Alternativa a TEI Self-Hosted

**Fecha:** 2026-02-20  
**Estado:** Completada  
**Autor:** Copilot + Pedro  
**Tipo:** Objective Evaluation  

---

## 1. Contexto y Motivación

El servicio de embeddings self-hosted (TEI — Text Embeddings Inference) que corre el modelo `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` está caído por un problema de DNS Docker (`[Errno -3] Temporary failure in name resolution`). Esto bloquea **toda** funcionalidad de búsqueda — tanto el pipeline RAG de 14 pasos como la búsqueda vectorial directa.

En una arquitectura hexagonal DDD, el servicio de embeddings es un **port de salida** (`EmbeddingPort`) con un adapter concreto (`TEIEmbeddingAdapter`). Debería ser trivial implementar un adapter alternativo (`OpenAIEmbeddingAdapter`) que use un servicio online. Esta evaluación mide si esa alternativa es viable.

## 2. Hipótesis

> Usar `text-embedding-3-small` de OpenAI (via OpenRouter) como servicio de embeddings online es una alternativa viable al TEI self-hosted para el pipeline RAG de DRAGA Platform.

## 3. Setup del Experimento

| Parámetro | Valor |
|---|---|
| Modelo evaluado | `openai/text-embedding-3-small` via OpenRouter |
| Dimensiones | 768 (truncado via parámetro `dimensions` de la API) |
| Modelo baseline (actual) | `sentence-transformers/paraphrase-multilingual-mpnet-base-v2` (TEI) |
| Colección Qdrant | `kb_eod-sm23` (1223 chunks, 768 dims, Cosine) |
| Queries de test | 5 queries representativas del dominio (envíos, regulaciones, aduanas) |
| Fecha de ejecución | 2026-02-20 |

### Queries de Test

1. "regulaciones de envío a Cuba"
2. "¿puedo enviar baterías de litio?"
3. "restricciones aduanales para paquetería"
4. "documentos necesarios para importar medicamentos"
5. "tarifas de envío internacional"

## 4. Resultados

### 4.1 Latencia

| Componente | OpenAI (via OpenRouter) | TEI Self-Hosted (histórico) | Delta |
|---|---|---|---|
| Embedding promedio | **731ms** | ~50ms | **14.6x más lento** |
| Min embedding | 580ms | — | — |
| Max embedding | 1090ms | — | — |
| Qdrant search promedio | 230ms | ~200ms | comparable |
| **Total E2E promedio** | **961ms** | ~250ms | **3.8x más lento** |

### 4.2 Costo

| Métrica | Valor |
|---|---|
| Costo por query | $0.0000002 |
| Costo por 1K queries | $0.0002 |
| Costo por 10K queries | $0.002 |
| Costo por 100K queries | $0.02 |
| **Costo de re-indexación** (1223 chunks, text-embedding-3-small) | **$0.0086** |
| Costo de re-indexación (text-embedding-3-large) | $0.056 |

**Veredicto costo: trivial.** A los volúmenes actuales de DRAGA Platform, el costo es efectivamente cero.

### 4.3 Calidad de Búsqueda — Cross-Model (SIN re-indexación)

**Escenario:** Query embebida con OpenAI, chunks almacenados con mpnet.

| Query | Top-1 Score | Top-1 Relevante? | Observación |
|---|---|---|---|
| regulaciones de envío a Cuba | 0.0793 | ❌ | Devuelve chunk sobre KPIs de costo |
| ¿puedo enviar baterías de litio? | 0.0953 | ❌ | Devuelve chunk sobre principios SOLID |
| restricciones aduanales para paquetería | 0.0948 | ❌ | Devuelve chunk sobre equipos médicos (parcialmente relevante) |
| documentos para importar medicamentos | 0.0947 | ❌ | Devuelve chunk sobre historias de usuario |
| tarifas de envío internacional | 0.1043 | ⚠️ | Devuelve chunk sobre unidades por categoría (marginalmente relevante) |

**Hit rate (top-1 relevante): 0/5 = 0%**

### 4.4 Divergencia de Espacios Vectoriales

Se comparó el vector almacenado (mpnet) vs el vector OpenAI **del mismo contenido exacto**:

| Chunk | Cosine(mpnet, openai) |
|---|---|
| Chunk sobre IA (Wikipedia) | **0.0107** |
| Chunk sobre arquitectura (docs) | **0.0311** |

**Los vectores son prácticamente ortogonales** (cosine ~0 = sin relación). Esto confirma que los espacios vectoriales de ambos modelos son completamente incompatibles. No existe shortcut: cambiar de modelo de embeddings **requiere re-indexar todos los chunks**.

### 4.5 Calidad Estimada — Same-Model (CON re-indexación)

No se pudo ejecutar directamente (requiere re-indexar chunks), pero la calidad esperada se estima por:

- `text-embedding-3-small` tiene MTEB score ~62.3 (multilingüe)
- `paraphrase-multilingual-mpnet-base-v2` tiene MTEB score ~65.8 (multilingüe)
- OpenAI es ~5% inferior en benchmarks multilingües, pero superior en inglés
- Para contenido en español sobre regulaciones de envío, mpnet multilingüe probablemente tiene ventaja marginal

**Calidad estimada tras re-indexación: comparable (±5%).**

## 5. Análisis Arquitectónico

### ¿El sistema está preparado para el swap?

Lo que la arquitectura hexagonal **debería** ofrecer:

```
Port:    EmbeddingPort { embed(text) → vector[768] }
Adapters:
  ├── TEIEmbeddingAdapter      (self-hosted, actual)
  ├── OpenAIEmbeddingAdapter   (online, propuesto)
  └── FallbackEmbeddingAdapter (TEI → OpenAI fallback)
```

**Verificación necesaria en el backend:**
- ¿Existe un `EmbeddingPort` (interfaz/protocolo abstracto)?
- ¿El adapter actual es inyectable via config (env var)?
- ¿El pipeline de ingesta puede re-embeder chunks con un modelo diferente?

La configuración actual en `.env` sugiere que sí hay una capa de abstracción:
```
EMBEDDING_MODE=server
EMBEDDING_SERVICE_URL=http://embeddings:80
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2
```

Un adapter OpenAI solo necesitaría:
```
EMBEDDING_MODE=openai        # ← nuevo valor
EMBEDDING_API_KEY=sk-or-...  # ← reusar OpenRouter key
EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSIONS=768
```

### Impacto de la migración

| Paso | Esfuerzo | Riesgo |
|---|---|---|
| Implementar `OpenAIEmbeddingAdapter` | Bajo (1-2h) | Bajo |
| Agregar `EMBEDDING_MODE=openai` al config | Bajo (30min) | Bajo |
| Re-indexar 1223 chunks | Medio (scripting + ~10min ejecución) | Medio — si falla, KB queda inconsistente |
| Validar calidad post-reindex | Medio (crear golden set) | — |
| Soporte dual (fallback chain) | Medio (2-4h) | Bajo |

## 6. Decisión y Recomendaciones

### Resultado de la Evaluación

| Criterio | Resultado | Aceptable? |
|---|---|---|
| Costo | $0.002 / 10K queries | ✅ Trivial |
| Latencia | 731ms embedding + 230ms search = 961ms | ⚠️ Aceptable para queries interactivas, marginal para pipeline |
| Calidad (cross-model) | 0% hit rate | ❌ Inaceptable (requiere re-indexación) |
| Calidad (same-model estimada) | ~comparable a mpnet | ✅ Estimado aceptable |
| Disponibilidad | 99.9%+ (OpenRouter/OpenAI SLA) | ✅ Superior a self-hosted |
| Dependencia externa | Requiere internet + API key activa | ⚠️ Riesgo para entornos offline |

### Recomendación Final

**CORTO PLAZO (ahora):**
- Arreglar el servicio TEI self-hosted (problema de DNS Docker)
- Es un fix de infra, no de código

**MEDIO PLAZO (Sprint siguiente):**
1. Implementar `OpenAIEmbeddingAdapter` como adapter alternativo
2. Agregar al backend: `EMBEDDING_MODE=openai|server|fallback`
3. Implementar modo `fallback`: TEI primero → OpenAI si TEI falla

**LARGO PLAZO:**
- Crear script de re-indexación que permita migrar colecciones entre modelos de embedding
- Eval formal con golden set (≥30 pares query/expected_chunks) para comparar mpnet vs OpenAI post-reindex
- Considerar `text-embedding-3-large` con truncación a 768 para mejor calidad

### Invariante Crítico

> **Cambiar de modelo de embeddings SIEMPRE requiere re-indexar todos los chunks.** No existe workaround. Esto no es un defecto de la arquitectura — es una propiedad fundamental de los espacios vectoriales. El adapter hexagonal facilita el swap de servicio, pero la migración de datos es ineludible.

## 7. Datos Crudos

### Evidencia de ejecución

```bash
# Vector search con OpenAI embeddings (cross-model)
curl -s -X POST "https://openrouter.ai/api/v1/embeddings" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openai/text-embedding-3-small","input":"regulaciones de envío a Cuba","dimensions":768}'

# Búsqueda directa en Qdrant con vector resultante
curl -s -X POST "http://167.172.225.44:6333/collections/kb_eod-sm23/points/search" \
  -H "Content-Type: application/json" \
  -d '{"vector": [...], "limit": 5, "with_payload": true}'

# Divergencia cross-model (mismo contenido, vectores diferentes)
# Cosine(mpnet, openai) = 0.0107 y 0.0311
```

### Estado de servicios al momento del test

```
qdrant:    ok=True   latency=143ms  (5 collections, 1223+200 chunks)
redis:     ok=True   latency=12ms
embedding: ok=False  latency=37ms   (TEI caído — DNS failure)
llm:       ok=True   latency=126ms  (OpenRouter anthropic/claude-3-haiku)
```
