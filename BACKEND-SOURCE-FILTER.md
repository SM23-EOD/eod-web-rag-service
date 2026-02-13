# 🎯 Historia de Usuario: Filtro de Fuentes en Búsqueda Vectorial

## Contexto

El frontend de administración ya permite **seleccionar/deseleccionar fuentes (documentos)** del Knowledge Base por tenant. La selección se almacena en el navegador (localStorage). El paso siguiente es que el **backend filtre la búsqueda vectorial** para que solo devuelva resultados de las fuentes activas.

## Historia de Usuario

> **Como** administrador del tenant,  
> **quiero** que el RAG busque únicamente en las fuentes (documentos) que tengo activas,  
> **para** poder excluir documentos obsoletos, incorrectos o en revisión sin tener que eliminarlos.

## Criterios de Aceptación

1. **`POST /api/v2/query`** acepta un nuevo campo opcional `source_filter: string[]` (lista de `document_id`s).
   - Si se envía, el retriever filtra chunks para que solo devuelva los que pertenecen a esos `document_id`s.
   - Si no se envía o es `null`, se busca en todos los documentos (comportamiento actual).

2. **`POST /api/v2/chat/completions`** acepta el mismo campo `source_filter: string[]`.
   - Se propaga al retriever con la misma lógica.

3. **Filtrado en ChromaDB**: El filtro se aplica a nivel de metadatos del chunk (`where: {"document_id": {"$in": [...]}}`) en la query a ChromaDB.
   - Si la lista está vacía, no se devuelven chunks (búsqueda vacía).
   - Si contiene IDs que no existen, simplemente no matchean.

4. **category_filter** sigue funcionando — ambos filtros se pueden combinar (AND lógico).

5. **Sin side-effects**: El filtro NO modifica datos, solo la búsqueda. Los documentos desactivados siguen existiendo y se pueden reactivar.

6. **Performance**: No debe degradar significativamente el rendimiento. El filtro `$in` en ChromaDB metadata es eficiente.

## Propuesta de Implementación

### Esquema de Request (QueryRequestV2)

```python
class QueryRequestV2(BaseModel):
    query: str
    tenant_id: str = "default"
    top_k: int = 5
    use_cache: bool = True
    category_filter: Optional[str] = None
    source_filter: Optional[List[str]] = None  # ← NUEVO
    experiment_id: Optional[str] = None
    user_id: Optional[str] = None
```

### Esquema de Request (ChatCompletionRequest)

```python
class ChatCompletionRequest(BaseModel):
    model: str = "eod-rag"
    messages: List[ChatMessage]
    # ... campos existentes ...
    source_filter: Optional[List[str]] = None  # ← NUEVO
```

### Retriever (ChromaDB Query)

```python
# En el retriever, construir filtro where:
where_filter = {}

if category_filter:
    where_filter["category"] = category_filter

if source_filter is not None:
    where_filter["document_id"] = {"$in": source_filter}

# Si hay múltiples condiciones, usar $and:
if len(where_filter) > 1:
    where_clause = {"$and": [{k: v} for k, v in where_filter.items()]}
else:
    where_clause = where_filter or None

results = collection.query(
    query_texts=[query],
    n_results=top_k,
    where=where_clause
)
```

### Respuesta

No cambia la estructura de respuesta. Los chunks devueltos ya contienen `document_id` en metadata, permitiendo al frontend verificar coherencia.

## Frontend (ya implementado)

El frontend almacena la selección en `localStorage` por tenant:
- Key: `srcmgr_{tenant_id}_enabled`
- Value: `{"doc_id_1": true, "doc_id_2": false, ...}`
- `null` (ausente) = todas habilitadas

Cuando el backend implemente `source_filter`, el frontend solo necesita:

```javascript
// En api-client.js, al hacer query/chat:
const activeIds = SrcMgr.getActiveIds();
const sourceFilter = (activeIds.length < DocMgr.docs.length) ? activeIds : null;
// Pasar sourceFilter al request body
```

## Endpoints Afectados

| Endpoint | Campo nuevo | Tipo |
|---|---|---|
| `POST /api/v2/query` | `source_filter` | `Optional[List[str]]` |
| `POST /api/v2/chat/completions` | `source_filter` | `Optional[List[str]]` |

## Estimación

- **Esfuerzo**: Bajo-Medio (2-4 horas)
- **Archivos a modificar**:
  - `src/adapters/inbound/api/query_routes.py` — Agregar campo al schema
  - `src/adapters/inbound/api/chat_routes.py` — Agregar campo al schema
  - `src/core/retriever.py` (o equivalente) — Agregar filtro `$in` a ChromaDB query
  - Tests unitarios para el filtrado

## Notas

- El filtro es **por sesión del usuario**, no persistente en backend. Cada request envía explícitamente los IDs activos.
- Si un documento se elimina, su ID simplemente no matchea y no causa error.
- El campo `source_filter: null` (o ausente) debe ser 100% backward-compatible.
- La misma mecánica podría usarse para el widget de chat público, permitiendo al tenant configurar qué fuentes incluir en su agente.
