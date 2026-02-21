# [BACKEND] 🔴 Pipeline RAG Roto — `metadata_filters` no soportado en QdrantDBService

**Fecha:** 2026-02-20  
**Severidad:** CRÍTICA — El pipeline completo de 14 pasos está inoperativo  
**Afecta:** Todos los protocolos que usan el pipeline RAG (REST `/query`, OpenAI `/chat/completions`, MCP `generate_rag_answer`)

---

## Síntoma

Cualquier query que pase por el pipeline RAG falla en el step `retrieve_chunks` con:

```
"error_step": "retrieve_chunks"
"error_detail": "QdrantDBService.query() got an unexpected keyword argument 'metadata_filters'"
```

La búsqueda vectorial directa (`search_knowledge_base`) **SÍ funciona** — el problema es exclusivamente en el pipeline.

---

## Evidencia (curl commands ejecutados 2026-02-20)

### 1. REST `/query` — FALLA

```bash
curl -s -X POST "http://167.172.225.44:9999/api/v2/query" \
  -H "Content-Type: application/json" \
  -d '{"query":"regulaciones de envío","tenant_id":"eod-sm23","agent_id":"envio23","top_k":5}'
```

**Respuesta (extracto):**
```json
{
  "answer": "Lo siento, no puedo procesar la consulta en este momento...",
  "confidence": 0.0,
  "metadata": {
    "total_chunks_searched": 0,
    "chunks_retrieved": 0,
    "error_step": "retrieve_chunks",
    "error_detail": "QdrantDBService.query() got an unexpected keyword argument 'metadata_filters'"
  }
}
```

### 2. OpenAI `/chat/completions` — FALLA (LLM no disponible)

```bash
curl -s -X POST "http://167.172.225.44:9999/api/v2/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"envio23","messages":[{"role":"user","content":"regulaciones de envío"}],"tenant_id":"eod-sm23","agent_id":"envio23"}'
```

**Respuesta:**
```json
{
  "error": "llm_unavailable",
  "message": "El servicio de generación de respuestas no está disponible en este momento."
}
```

### 3. MCP `generate_rag_answer` — FALLA (mismo bug de pipeline)

```bash
curl -s -X POST "http://167.172.225.44:9999/api/v2/mcp/tools/call" \
  -H "Content-Type: application/json" \
  -d '{"tool_name":"generate_rag_answer","arguments":{"query":"regulaciones de envío","tenant_id":"eod-sm23","agent_id":"envio23"}}'
```

**Respuesta:**
```json
{
  "success": true,
  "result": "## Respuesta\n\nLo siento, no puedo procesar la consulta...\n\n### 📊 Metadata\n- Confianza: 0.00%\n- Fragmentos usados: 0"
}
```

### 4. MCP `search_knowledge_base` — FUNCIONA ✅

```bash
curl -s -X POST "http://167.172.225.44:9999/api/v2/mcp/tools/call" \
  -H "Content-Type: application/json" \
  -d '{"tool_name":"search_knowledge_base","arguments":{"query":"regulaciones de envío","tenant_id":"eod-sm23","agent_id":"envio23","top_k":3}}'
```

**Respuesta:** Retorna 3 chunks con similitudes 80%, 70%, etc. La búsqueda vectorial funciona correctamente.

---

## Diagnóstico

El step `retrieve_chunks` del pipeline está pasando un argumento `metadata_filters` al método `QdrantDBService.query()`, pero ese método no lo acepta en su firma.

### Causa probable

Alguien agregó soporte para `metadata_filters` (probablemente para `document_ids` filtering o `category_filter`) en el step del pipeline pero **no actualizó** la firma del método `QdrantDBService.query()` en el adapter de Qdrant.

### Dónde buscar

1. **Step `retrieve_chunks`** — buscar dónde se llama `QdrantDBService.query()` y se le pasa `metadata_filters`
2. **`QdrantDBService.query()`** — actualizar la firma para aceptar `metadata_filters` y aplicar los filtros como `qdrant_client.models.Filter` conditions

### Fix sugerido

```python
# En QdrantDBService.query() — agregar parámetro metadata_filters
async def query(self, query_vector, top_k=5, metadata_filters=None, ...):
    filter_conditions = []
    if metadata_filters:
        for key, value in metadata_filters.items():
            if isinstance(value, list):
                filter_conditions.append(
                    models.FieldCondition(key=key, match=models.MatchAny(any=value))
                )
            else:
                filter_conditions.append(
                    models.FieldCondition(key=key, match=models.MatchValue(value=value))
                )
    
    search_filter = models.Filter(must=filter_conditions) if filter_conditions else None
    
    results = await self.client.search(
        collection_name=collection_name,
        query_vector=query_vector,
        limit=top_k,
        query_filter=search_filter,  # ← agregar esto
        ...
    )
```

---

## Segundo issue: LLM no disponible

El endpoint OpenAI `/chat/completions` retorna `llm_unavailable`. Verificar:
- ¿El servicio LLM (OpenAI API key o modelo local) está configurado y activo?
- ¿La variable de entorno de la API key está presente en el container?

---

## Nota sobre tool MCP

La tool MCP `rag_query` **no existe** en el backend. Las tools registradas son:
- `search_knowledge_base`
- `generate_rag_answer`
- `get_document_chunk`
- `list_documents`
- `get_ab_assignment`

El frontend ya fue corregido para usar `generate_rag_answer` en lugar de `rag_query`.

---

## Resumen de acciones requeridas

| # | Acción | Prioridad | Dónde |
|---|--------|-----------|-------|
| 1 | Agregar `metadata_filters` a firma de `QdrantDBService.query()` | **P0** | `src/adapters/outbound/qdrant_db_service.py` (o equivalente) |
| 2 | Verificar disponibilidad del servicio LLM | **P0** | Variables de entorno / config del container |
| 3 | (Opcional) Agregar test de integración para `/query` con filtros | P1 | Tests backend |
