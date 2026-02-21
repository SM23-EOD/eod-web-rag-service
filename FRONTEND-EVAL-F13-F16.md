# FRONTEND — Objective & Evaluation Specs: F13-F16

**Fecha:** 2026-02-20  
**Scope:** Frontend — cambios que NO dependen del backend  
**Archivos modificados:** `draga.html`, `admin.html`  
**Prerequisitos:** Ninguno (estos cambios son independientes del estado del backend)

---

## F13: Degradation UI para Embedding Down

### Objetivo

Cuando el servicio de embeddings está caído (`health/deep → embedding.ok=false`), el usuario debe ver un banner informativo prominente que explique que la búsqueda y el chat no funcionarán, en vez de descubrirlo al intentar usar esas funciones y recibir errores crípticos.

### Cambios Implementados

| Archivo | Cambio |
|---------|--------|
| `draga.html` CSS | Nuevas clases `.degradation-banner`, `.degradation-banner.warn`, `.degradation-banner.error` |
| `draga.html` HTML | Nuevo `<div id="degradationBanner">` entre header y sidebar, con mensaje y botón de cerrar |
| `draga.html` JS | `checkHealth()` ahora detecta servicios caídos y activa el banner con mensaje específico |

### Eval Spec: EVAL-F13

**Tipo:** Visual + funcional (browser manual)  

#### Escenario 1: Embedding Down (estado actual)

**Precondición:** Backend reporta `health/deep.embedding.ok = false`

| # | Paso | Expected |
|---|------|----------|
| 1 | Abrir `draga.html` | Banner amarillo visible: "⚠️ Servicio de búsqueda temporalmente no disponible — El servicio de embeddings está caído…" |
| 2 | Esperar 30s | Banner persiste (health check se repite) |
| 3 | Click en ✕ del banner | Banner se oculta |
| 4 | Esperar 30s | Si embedding sigue caído, banner reaparece |

#### Escenario 2: Todo Healthy 

**Precondición:** Backend reporta `health/deep.status = "healthy"`, todos los checks `ok=true`

| # | Paso | Expected |
|---|------|----------|
| 1 | Abrir `draga.html` | NO hay banner de degradación |
| 2 | Header pill muestra "online" en verde | ✅ |

#### Escenario 3: API Completamente Offline

**Precondición:** Backend no responde (timeout / network error)

| # | Paso | Expected |
|---|------|----------|
| 1 | Abrir `draga.html` | Banner rojo: "❌ API no disponible" |
| 2 | Header pill muestra "offline" en rojo | ✅ |

#### Escenario 4: Otro Servicio Degradado (e.g., Redis)

**Precondición:** `health/deep.redis.ok = false`, pero embedding y LLM ok

| # | Paso | Expected |
|---|------|----------|
| 1 | Abrir `draga.html` | Banner amarillo: "⚠️ Servicios degradados: redis" |
| 2 | Chat y búsqueda siguen funcionales | ✅ (solo cache afectado) |

#### Métrica de Aceptación

| Métrica | Criterio |
|---------|----------|
| Banner aparece en < 3s tras cargar página | ✅ (primer health check es síncrono con init) |
| Banner identifica el servicio caído | ✅ (texto específico para embedding vs genérico) |
| Banner se puede cerrar manualmente | ✅ |
| Banner no aparece cuando todo está healthy | ✅ |
| No rompe layout en mobile (< 768px) | ✅ (flex con wrap) |

#### Script de Verificación (curl + browser)

```bash
# 1. Verificar que el backend reporta estado degradado
curl -s "http://167.172.225.44:9999/api/v2/health/deep" | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(f'status: {d[\"status\"]}')
for k,v in d.get('checks',{}).items():
    print(f'  {k}: ok={v[\"ok\"]} latency={v.get(\"latency_ms\",\"?\")}ms')
"
# 2. Abrir draga.html en browser → verificar banner visualmente
# 3. Inspeccionar elemento #degradationBanner → verificar clase "active"
```

---

## F14: Health Indicator en Header

### Objetivo

Reemplazar el dot verde estático en draga.html por un health pill informativo (como ya tiene admin.html) que muestre el estado real usando `healthDeep()`, y que admin.html use `healthDeep()` en vez de solo `health()` para poder detectar el estado "degraded".

### Cambios Implementados

| Archivo | Cambio |
|---------|--------|
| `draga.html` CSS | Nuevas clases `.health-pill.online`, `.degraded`, `.offline` |
| `draga.html` HTML | Header dot → pill con texto (`<span id="healthText">`) |
| `draga.html` JS | `checkHealth()` usa `healthDeep()`, parsea `status` + `checks`, guarda en `App._serviceHealth` |
| `admin.html` JS | `checkHealth()` mejorado: usa `healthDeep()`, soporta estado `degraded` |

### Eval Spec: EVAL-F14

**Tipo:** Visual + funcional  

#### Test Matrix

| Estado Backend | draga.html Pill | admin.html Pill | Color |
|----------------|-----------------|-----------------|-------|
| `healthy` (all ok) | "online" | "online" | 🟢 verde |
| `degraded` (embedding down) | "degradado" | "degradado (embedding)" | 🟡 amber |
| API offline | "offline" | "offline" | 🔴 rojo |

#### Escenarios Detallados

**E1: Pill muestra "degradado" cuando embedding está caído**

```
Precondición: curl health/deep → status=degraded, embedding.ok=false
Paso: Abrir draga.html
Expected: Header pill muestra "degradado" en amber, pulsing dot amber
```

**E2: Pill muestra "online" cuando todo funciona**

```
Precondición: curl health/deep → status=healthy
Paso: Abrir draga.html
Expected: Header pill muestra "online" en verde
```

**E3: Pill se actualiza automáticamente cada 30s**

```
Precondición: Página abierta, observar pill
Paso: Esperar 30s
Expected: Pill se refresca sin reload manual
```

**E4: Click en pill navega a Overview**

```
Paso: Click en el health pill en draga.html header
Expected: Navega a módulo overview (hash #overview)
```

**E5: admin.html muestra nombre del servicio caído**

```
Precondición: embedding.ok=false
Paso: Abrir admin.html
Expected: Pill muestra "degradado (embedding)"
```

#### Métrica de Aceptación

| Métrica | Criterio |
|---------|----------|
| `healthDeep()` se usa en vez de `health()` | ✅ |
| Intervalo de refresh | 30s ± 1s |
| Estado "degraded" se refleja visualmente | ✅ (amber pill) |
| `App._serviceHealth` disponible para otros módulos | ✅ |
| No flicker en transición de estados | ✅ (CSS transitions) |

---

## F15: Pipeline Module — De Dead Code a Inicialización Funcional

### Objetivo

El loader del módulo Pipeline era `() => {}` (dead code). Ahora inicializa con:
1. Indicadores de salud de servicios en los 14 pasos del pipeline
2. Resumen de estado de servicios arriba del Live Test
3. Los controles de Live Test y Búsqueda Vectorial ya funcionaban pero el usuario no sabía si los servicios estaban disponibles antes de intentar

### Cambios Implementados

| Archivo | Cambio |
|---------|--------|
| `draga.html` JS | `pipeline: () => {}` → `pipeline: () => PipelineModule.load()` |
| `draga.html` JS | Nuevo objeto `PipelineModule` con `load()` y `_updateStepHealth()` |
| `draga.html` HTML | Nuevo `<div id="pipelineServiceStatus">` arriba del Live Test |

### Eval Spec: EVAL-F15

**Tipo:** Visual + funcional  

#### Escenario 1: Embedding Down → Steps Dimmed

**Precondición:** `embedding.ok = false`

| # | Paso | Expected |
|---|------|----------|
| 1 | Nav al módulo Pipeline | Steps "Embedding" y "Vector Search" se muestran atenuados (opacity 0.4) con borde rojo |
| 2 | Hover sobre step atenuado | Tooltip: "⚠️ Servicio de embeddings no disponible" |
| 3 | Barra de servicios muestra "❌ embedding" | ✅ con latencia |
| 4 | Click "▶ Ejecutar" con REST | Ejecuta query → resultado muestra error del pipeline en `error_step` |

#### Escenario 2: Todo Healthy

| # | Paso | Expected |
|---|------|----------|
| 1 | Nav al módulo Pipeline | Todos los 14 steps con opacity normal |
| 2 | Barra de servicios muestra "✅ qdrant, ✅ redis, ✅ embedding, ✅ llm" | Con latencias |
| 3 | Click "▶ Ejecutar" | Pipeline completo funciona |

#### Escenario 3: LLM Down

| # | Paso | Expected |
|---|------|----------|
| 1 | Nav al módulo Pipeline | Steps "LLM Generation" atenuado con borde rojo |
| 2 | Tooltip en step: "⚠️ Servicio LLM no disponible" | ✅ |
| 3 | Búsqueda vectorial sigue funcional | ✅ (no depende de LLM) |

#### Métricas de Aceptación

| Métrica | Criterio |
|---------|----------|
| Loader ya no es dead code | `PipelineModule.load()` se ejecuta al navegar a Pipeline |
| Service health bar populated | Muestra todos los servicios con ✅/❌ y latencia |
| Steps dimmed match failed services | Mapping correcto: embedding → steps 5-6, LLM → steps 12-14 |
| No regression en Live Test | `Pipeline.run()` y `Pipeline.vectorSearch()` siguen funcionales |
| Carga en < 1s | `_updateStepHealth()` usa `App._serviceHealth` (cache) si disponible |

---

## F16: Quality Stats — Verificación de Renderizado

### Objetivo

Verificar que el módulo Quality renderiza métricas correctamente ahora que los endpoints de metrics retornan 200 (antes retornaban 500 por bug de SQLAlchemy `.isnull()`). No requiere cambios de código — es verificación.

### Estado del Código

El Quality module ya está correctamente implementado:
- Usa `Promise.allSettled` (4 endpoints en paralelo)
- Cada métrica fallida muestra "—" (degradación elegante)
- No tiene catch vacíos (cada fallback es explícito)

### Fix Aplicado (F16-minor)

Único cambio: `catch {}` vacío en KB.loadStats() → `catch (e2) { console.warn(...) }` para cumplir con la regla de AGENTS.md de nunca tener catch vacíos.

### Eval Spec: EVAL-F16

**Tipo:** Funcional (browser + curl)  

#### Pre-verificación: Endpoints Responden

```bash
# Verificar que metrics endpoints retornan 200
for EP in "metrics/coverage?tenant_id=eod-sm23" "metrics/grounding?tenant_id=eod-sm23" "metrics/gaps?tenant_id=eod-sm23" "feedback/stats?tenant_id=eod-sm23"; do
  HTTP=$(curl -sS -o /dev/null -w "%{http_code}" "http://167.172.225.44:9999/api/v2/$EP")
  echo "$EP → $HTTP"
done
```

**Criterio:** Los 4 endpoints deben retornar 200.

#### Escenario 1: Métricas Se Renderizan

| # | Paso | Expected |
|---|------|----------|
| 1 | Abrir `draga.html?tenant=eod-sm23` | Dashboard carga |
| 2 | Nav a módulo Quality | Stats grid se actualiza |
| 3 | "Documentos" muestra número real (no "—") | ✅ (via `listDocuments`) |
| 4 | "Chunks" muestra número real | ✅ |
| 5 | "Cobertura" muestra % o "—" si no hay datos | ✅ |
| 6 | "Grounding" muestra % o "—" | ✅ |
| 7 | "Confianza Avg" muestra % o "—" | ✅ |
| 8 | "Cache Hit" muestra % o "—" | ✅ |
| 9 | "Feedback" muestra count o "—" | ✅ |

#### Escenario 2: Gaps Se Cargan

| # | Paso | Expected |
|---|------|----------|
| 1 | En Quality, sección "Gaps Detectados" | Lista de gaps con fecha, confianza, estado |
| 2 | Click en query de un gap | Ejecuta `testGapQuery` → abre DocViewer con chunks |
| 3 | Si no hay gaps | "✅ No hay gaps detectados" |

#### Escenario 3: Feedback Lista

| # | Paso | Expected |
|---|------|----------|
| 1 | En Quality, tabla de Feedback | Últimos 10 feedback con query, rating, comment, reviewed |
| 2 | Si no hay feedback | "Sin feedback" en fila vacía |

#### Escenario 4: Endpoint Falla (regresión)

Si algún endpoint retorna 500:

| Componente | Comportamiento |
|------------|----------------|
| Stats grid | Métricas individuales muestran "—" |
| Gaps | "Gaps service no disponible" |
| Feedback | "Feedback no disponible" |
| NO hay crash de página | ✅ (`Promise.allSettled`) |

#### Métricas de Aceptación

| Métrica | Criterio |
|---------|----------|
| Quality módulo carga sin errores en console | ✅ |
| Al menos docs y chunks muestran valores reales | ✅ (via `listDocuments`) |
| Métricas que dependen de data (coverage, grounding) muestran "—" si no hay queries históricas | ✅ (acceptable) |
| No hay `catch {}` vacíos en el módulo | ✅ (arreglado) |

---

## Resumen de Cambios por Archivo

| Archivo | F13 | F14 | F15 | F16 |
|---------|-----|-----|-----|-----|
| `draga.html` CSS | ✅ banner classes | ✅ pill classes | — | — |
| `draga.html` HTML header | — | ✅ pill element | — | — |
| `draga.html` HTML banner | ✅ degradation div | — | — | — |
| `draga.html` HTML pipeline | — | — | ✅ service status bar | — |
| `draga.html` JS `checkHealth()` | ✅ banner logic | ✅ deep health | — | — |
| `draga.html` JS `PipelineModule` | — | — | ✅ new object | — |
| `draga.html` JS `nav()` loaders | — | — | ✅ pipeline → PipelineModule.load() | — |
| `draga.html` JS KB.loadStats | — | — | — | ✅ catch fix |
| `admin.html` JS `checkHealth()` | — | ✅ deep health + degraded | — | — |

## Orden de Verificación Recomendado

```
1. curl health/deep → confirmar estado actual del backend
2. Abrir draga.html → F14 (pill), F13 (banner)
3. Nav a Pipeline → F15 (step health + service bar)
4. Nav a Quality → F16 (métricas renderizan o "—")
5. Abrir admin.html → F14 (pill degraded state)
6. Console: verificar 0 errores JS
```

## Dependencias del Backend (para evaluación completa)

| Eval | Depende de Backend | Sin Backend |
|------|-------------------|-------------|
| F13 | `healthDeep()` responde | Banner de "offline" aparece |
| F14 | `healthDeep()` responde | Pill muestra "offline" |
| F15 | `healthDeep()` + pipeline endpoints | Service bar vacía, tests manuales no ejecutan |
| F16 | Metrics endpoints retornan 200 | Stats muestran "—" (degradación elegante) |

**Nota:** Todos los cambios son resilientes — funcionan tanto con backend healthy como con backend caído. La diferencia es la granularidad de la información que muestran.
