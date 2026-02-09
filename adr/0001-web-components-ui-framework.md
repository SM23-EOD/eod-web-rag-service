# ADR-0001: Uso de Web Components como Framework UI

**Estado:** Aceptado ✓

**Fecha:** 2026-02-09

**Tipo:** Arqueología (Decisión Retroactiva)

## Contexto

El proyecto necesitaba una solución para crear un widget de chat embebible que pudiera integrarse fácilmente en cualquier sitio web sin conflictos de dependencias o estilos. Los requisitos principales eran:

- Facilidad de integración en cualquier sitio web
- Sin dependencias externas pesadas (React, Vue, Angular)
- Encapsulación completa de estilos y comportamiento
- Compatibilidad cross-browser
- Mínimo impacto en el bundle size del sitio host

## Decisión

Implementar el widget de asistente RAG usando **Web Components nativos** (Custom Elements API) sin frameworks adicionales.

La implementación se basa en:
- `class RagAssistant extends HTMLElement` para el componente principal
- API nativa de Custom Elements
- Sin transpilación ni build steps complejos
- JavaScript vanilla ES6+

Archivos implementados:
- `src/assistant-widget.js` - Versión 1 del widget
- `src/assistant-widget-v2.js` - Versión 2 mejorada

## Consecuencias

### Positivas

✅ **Cero dependencias externas**: No requiere React, Vue u otros frameworks, reduciendo el tamaño del bundle a ~15-20KB (minificado).

✅ **Integración trivial**: Los usuarios solo necesitan incluir un `<script>` tag y agregar el elemento HTML personalizado.

✅ **Compatibilidad nativa**: Soportado por todos los navegadores modernos sin polyfills.

✅ **Sin conflictos de estilos**: Gracias a Shadow DOM (ver ADR-0002).

✅ **Reutilizable**: Puede instanciarse múltiples veces en la misma página con configuraciones diferentes.

### Negativas

⚠️ **Curva de aprendizaje**: Los desarrolladores familiarizados solo con frameworks modernos pueden encontrar el API de Web Components menos intuitiva.

⚠️ **Debugging limitado**: No hay React DevTools u otras herramientas de debugging especializadas.

⚠️ **Estado reactivo manual**: La gestión de estado requiere implementación manual (`setState` personalizado) en lugar de aprovechar sistemas reactivos de frameworks.

⚠️ **Testing más complejo**: Requiere herramientas específicas para testing de Web Components (jest con jsdom configurado especialmente).

### Deuda Técnica Identificada

🔴 **No hay tests unitarios**: El código actual no tiene suite de testing, lo que dificulta refactorización segura.

🟡 **Gestión de estado básica**: El método `setState` es simple pero no optimiza re-renders ni tiene memoización.

🟡 **No hay type safety**: JavaScript vanilla sin TypeScript dificulta detectar errores en tiempo de desarrollo.

## Alternativas Consideradas

### 1. React + Build Step
- **Pros**: Ecosistema maduro, mejor DX, muchas librerías
- **Contras**: Requiere build step, mayor bundle size (~100KB+), dependencias externas
- **Razón de rechazo**: Overhead excesivo para un widget embebible

### 2. Vue.js
- **Pros**: Más ligero que React (~30KB), buen DX
- **Contras**: Aún requiere dependencias externas, build step
- **Razón de rechazo**: Similar a React pero menos familiar para el equipo

### 3. Svelte
- **Pros**: Compila a vanilla JS, excelente performance
- **Contras**: Requiere build step, menos común en el ecosistema
- **Razón de rechazo**: Build complexity para un widget simple

### 4. Lit (Web Components library)
- **Pros**: Abstracción ligera sobre Web Components, mejor DX
- **Contras**: Agrega ~5KB de dependencia
- **Razón de rechazo**: Decidimos priorizar cero dependencias

## Notas de Implementación

El código usa patrones modernos de JavaScript:
```javascript
class RagAssistant extends HTMLElement {
  static get observedAttributes() {
    return ["endpoint", "title", "tool-name", ...];
  }
  
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.state = { isOpen: false, messages: [] };
  }
  
  connectedCallback() {
    this.render();
  }
}

customElements.define("rag-assistant", RagAssistant);
```

## Referencias

- [MDN Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
- [Custom Elements v1 Spec](https://html.spec.whatwg.org/multipage/custom-elements.html)
- Código fuente: `src/assistant-widget.js`, `src/assistant-widget-v2.js`
