# [BACKEND] 🟡 ISSUE-003: Implementar OpenAI Embedding Adapter como Fallback

**Fecha:** 2026-02-20  
**Severidad:** P1 — Mejora de resiliencia  
**Afecta:** Disponibilidad del servicio de embeddings  
**Componente:** `EmbeddingPort` → nuevo `OpenAIEmbeddingAdapter`  
**Prerequisito:** ISSUE-002 resuelto (TEI funcionando como baseline)  

---

## Contexto

La plataforma DRAGA depende de un único servicio de embeddings (TEI self-hosted) que tiene un historial de caídas por problemas de infraestructura Docker (DNS, red interna, OOM). Cuando TEI cae, el **100% de las funcionalidades de búsqueda** quedan bloqueadas.

La arquitectura hexagonal del backend define un `EmbeddingPort` con un adapter concreto `TEIEmbeddingAdapter`. Esta decisión fue evaluada en [EVAL-001](adr/EVAL-001-openai-embeddings-online.md) y la conclusión es que un adapter alternativo basado en OpenAI es viable como fallback.

---

## Propuesta

Implementar `OpenAIEmbeddingAdapter` y un `FallbackEmbeddingAdapter` que encadene TEI → OpenAI, de modo que si TEI falla, se use OpenAI automáticamente.

### Arquitectura

```
EmbeddingPort { embed(text) → vector[768] }
  ├── TEIEmbeddingAdapter       (self-hosted, primario)
  ├── OpenAIEmbeddingAdapter    (online, fallback)
  └── FallbackEmbeddingAdapter  (TEI → OpenAI chain)
```

### Configuración propuesta (`.env`)

```env
# Modo: 'server' (TEI only), 'openai' (OpenAI only), 'fallback' (TEI → OpenAI)
EMBEDDING_MODE=fallback

# TEI (existente)
EMBEDDING_SERVICE_URL=http://embeddings:80
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-mpnet-base-v2

# OpenAI (nuevo)
EMBEDDING_OPENAI_API_KEY=sk-or-v1-...  # Reusar OpenRouter key
EMBEDDING_OPENAI_MODEL=openai/text-embedding-3-small
EMBEDDING_OPENAI_BASE_URL=https://openrouter.ai/api/v1
EMBEDDING_OPENAI_DIMENSIONS=768
```

---

## Restricción Crítica: Cross-Model Incompatibility

**EVAL-001 demostró que los vectores generados por modelos diferentes son incompatibles:**

| Comparación | Cosine Similarity |
|---|---|
| mpnet ↔ OpenAI (mismo texto) | **0.01 – 0.03** |
| mpnet ↔ mpnet (textos similares) | 0.70 – 0.85 |

Esto significa que:

1. **Query con OpenAI + chunks con mpnet = búsqueda inútil** (0% hit rate)
2. El fallback a OpenAI **SOLO funciona si los chunks fueron indexados con OpenAI también**
3. ó implementar un `query_model` flag en la colección para saber qué modelo usar

### Opciones de implementación

| Opción | Pros | Contras |
|---|---|---|
| A: Fallback puro (acepta cross-model) | Simple, "algo retorna" | Resultados irrelevantes |
| B: Fallback + re-indexación automática | Correcto funcionalmente | Requiere re-indexar 1223 chunks (~10min) |
| C: Dual indexing | Siempre ready para ambos modelos | Duplica almacenamiento y costo ingesta |
| D: Model-aware collections | Cada colección sabe su modelo | Más limpio, upgrade path claro |

**Recomendación: Opción D** — Agregar metadata `embedding_model` a la colección Qdrant y verificar en query-time que el modelo de la query coincida con el de la colección.

---

## Objective Eval Spec (Mandatorio)

### EVAL-003: Viabilidad del Fallback de Embeddings

**Objetivo:** Implementar y validar que el `FallbackEmbeddingAdapter` funciona correctamente en modo `fallback` (TEI → OpenAI) sin degradación significativa de calidad.

#### Pre-requisitos para la evaluación

1. TEI restaurado y funcional (ISSUE-002)
2. `OpenAIEmbeddingAdapter` implementado
3. Script de re-indexación de colección disponible

#### Diseño del Experimento

**Fase 1: Funcionalidad (sin re-indexación)**

| Test | Input | Expected |
|---|---|---|
| TEI healthy → usa TEI | query con TEI up | Embedding via TEI, latencia ~50ms |
| TEI down → usa OpenAI | query con TEI parado | Embedding via OpenAI, latencia ~700ms |
| TEI recovery → vuelve a TEI | reiniciar TEI | Siguiente query usa TEI |

**Fase 2: Calidad (con re-indexación)**

| Métrica | TEI-indexed + TEI-query | OpenAI-indexed + OpenAI-query | Criterio |
|---|---|---|---|
| Top-1 hit rate (30 queries golden set) | baseline | debe ser ≥ 90% del baseline | ≥ 90% |
| MRR@5 | baseline | ≥ 90% del baseline | Calidad comparable |
| Latencia E2E p95 | ~250ms | ~1000ms | < 2s aceptable para fallback |

**Golden Set de Queries (mínimo 30)**

Crear manualmente 30 pares `(query, expected_chunk_ids[])` del dominio real (envíos, regulaciones, aduanas) para medir hit rate y MRR de forma objetiva. Ejemplo:

```json
[
  {"query": "regulaciones de envío a Cuba", "expected_chunks": ["chunk_abc", "chunk_def"]},
  {"query": "¿puedo enviar baterías de litio?", "expected_chunks": ["chunk_ghi"]},
  ...
]
```

#### Métricas de Aceptación

| Métrica | Criterio |
|---|---|
| Fallback automático funciona | TEI down → OpenAI toma queries sin intervención manual |
| Tiempo de switchover | < 5 segundos (1 request fallido antes de switch) |
| Latencia OpenAI embedding | < 1000ms p95 |
| Calidad post-reindex | MRR@5 ≥ 90% del baseline mpnet |
| Costo mensual estimado | < $1/mes a volúmenes actuales |
| Health check refleja modo | `/health/deep` muestra `embedding_mode: fallback, active_adapter: tei|openai` |

#### Script de Validación

```bash
#!/bin/bash
# EVAL-003: Fallback embedding test

echo "=== Test 1: TEI healthy → uses TEI ==="
curl -s "http://167.172.225.44:9999/api/v2/health/deep" | python3 -c "
import json,sys; d=json.load(sys.stdin)
e = d['checks']['embedding']
print(f'adapter: {e.get(\"adapter\",\"unknown\")}')
print(f'ok: {e[\"ok\"]}, latency: {e[\"latency_ms\"]}ms')
assert e['ok'], 'FAIL: embedding not ok'
assert e.get('adapter','') in ['tei','fallback_tei'], 'WARN: not using TEI'
print('PASS')"

echo "=== Test 2: TEI down → fallback to OpenAI ==="
echo "(Requiere parar TEI: docker stop embeddings)"
echo "Ejecutar query y verificar que responde via OpenAI"

echo "=== Test 3: Quality check ==="
echo "Ejecutar golden set de 30 queries y medir MRR@5"
```

---

## Datos de EVAL-001 (Referencia)

| Criterio | Resultado | 
|---|---|
| Costo por query OpenAI | $0.0000002 |
| Costo re-indexación 1223 chunks | $0.0086 |
| Latencia embedding OpenAI | 731ms (p50) |
| Cross-model cosine similarity | 0.01-0.03 (incompatible) |
| Same-model calidad estimada | ±5% vs mpnet |
| Disponibilidad OpenAI | 99.9%+ SLA |

---

## Esfuerzo Estimado

| Componente | Horas |
|---|---|
| `OpenAIEmbeddingAdapter` | 1-2h |
| `FallbackEmbeddingAdapter` | 1-2h |
| Config `.env` + factory pattern | 1h |
| Script de re-indexación | 2h |
| Tests unitarios | 2h |
| Golden set + EVAL-003 ejecución | 3h |
| **Total** | **~10-12h** |

---

## Referencias

- [EVAL-001: OpenAI Embeddings Online](adr/EVAL-001-openai-embeddings-online.md) — Benchmark completo
- [ISSUE-002: Embedding Service Down](BACKEND-ISSUE-002-EMBEDDING-SERVICE-DOWN.md) — Prerrequisito
- ADR hexagonal: `EmbeddingPort` como port de salida
