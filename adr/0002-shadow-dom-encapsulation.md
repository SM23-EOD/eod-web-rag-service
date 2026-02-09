# ADR-0002: Shadow DOM para Encapsulación de Estilos

**Estado:** Aceptado ✓

**Fecha:** 2026-02-09

**Tipo:** Arqueología (Decisión Retroactiva)

## Contexto

Al crear un widget embebible que se integra en sitios web de terceros, existe un problema crítico: **conflictos de estilos CSS**. Los estilos del sitio host pueden afectar al widget, y viceversa. Necesitábamos:

- Garantizar que los estilos del widget no afecten al sitio host
- Proteger los estilos del widget de la hoja de estilos global del sitio
- Permitir temas personalizables sin exponer detalles de implementación
- Evitar prefijos CSS complejos o metodologías como BEM

## Decisión

Utilizar **Shadow DOM** en modo `open` para encapsular completamente los estilos del widget.

Implementación:
```javascript
constructor() {
  super();
  this.attachShadow({ mode: "open" }); // ← Shadow DOM activado
}
```

Todos los estilos CSS se inyectan dentro del Shadow Root:
```javascript
shadowRoot.innerHTML = `
  <style>
    /* Estilos completamente encapsulados */
    .widget-container { ... }
  </style>
  <div class="widget-container">...</div>
`;
```

## Consecuencias

### Positivas

✅ **Aislamiento total de estilos**: Los estilos del widget no afectan al sitio host y viceversa.

✅ **Simplificación de CSS**: No se necesitan prefijos como `.rag-assistant-container`, solo nombres simples como `.container`.

✅ **Sin colisiones de clases**: Mismo nombre de clase puede existir dentro y fuera del Shadow DOM sin conflicto.

✅ **Encapsulación de JavaScript**: Los `querySelector` dentro del Shadow Root solo ven elementos internos.

✅ **Estándar web nativo**: No requiere herramientas externas ni post-procesamiento CSS.

### Negativas

⚠️ **Estilos globales no heredados**: Fuentes y algunos estilos globales del sitio host no se aplican automáticamente (puede ser positivo o negativo según el caso).

⚠️ **Debugging CSS más difícil**: Las herramientas de desarrollo de navegador requieren expandir el Shadow Root para inspeccionar estilos.

⚠️ **No personalizable desde fuera**: El sitio host no puede aplicar estilos CSS directamente al widget (se mitiga con atributos HTML como `theme-color`).

⚠️ **Limitaciones de accesibilidad**: Algunos screen readers antiguos pueden tener problemas con Shadow DOM (mitigado con atributos ARIA).

### Deuda Técnica Identificada

🟡 **Personalización limitada**: Los usuarios solo pueden cambiar el color principal vía atributo `theme-color`, no pueden ajustar tipografía, espaciados u otros detalles visuales sin modificar el código fuente.

🟡 **Tamaño del código**: Los estilos CSS están inline en JavaScript, incrementando el tamaño del archivo (~5-8KB de CSS en strings).

🟡 **No hay CSS variables expuestas**: Podríamos exponer CSS Custom Properties para personalización más granular sin romper la encapsulación.

🔴 **Repetición de estilos**: La V1 y V2 del widget tienen estilos duplicados en lugar de compartir un base común.

## Alternativas Consideradas

### 1. CSS con prefijos (BEM o similar)
- **Pros**: Compatible con cualquier navegador, más flexible
- **Contras**: Conflictos aún posibles, requiere disciplina estricta de nomenclatura
- **Razón de rechazo**: No garantiza encapsulación real

### 2. CSS-in-JS (styled-components, emotion)
- **Pros**: Estilos dinámicos, buen DX
- **Contras**: Requiere dependencias externas (~10KB+), runtime overhead
- **Razón de rechazo**: Agrega dependencias innecesarias

### 3. CSS Modules
- **Pros**: Encapsulación via build step, nombres únicos generados
- **Contras**: Requiere webpack/rollup, no funciona en runtime
- **Razón de rechazo**: Queremos evitar build steps complejos

### 4. Inline styles solo
- **Pros**: Máxima portabilidad, sin CSS separado
- **Contras**: Sin pseudo-elementos, sin media queries inline, verbose
- **Razón de rechazo**: Limitaciones técnicas inaceptables

## Notas de Implementación

### Modo Open vs Closed

Elegimos `mode: "open"` en lugar de `mode: "closed"` para:
- Permitir debugging durante desarrollo
- Facilitar testing automatizado
- Posibilitar extensiones/customizaciones avanzadas si es necesario

### Estilos en Template Literal

Los estilos se definen en template literals de JavaScript:
```javascript
const styles = `
  <style>
    :host {
      display: block;
      position: fixed;
      /* ... */
    }
    .message-user {
      background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor});
    }
  </style>
`;
```

Esto permite:
- Interpolación de variables (ej: `theme-color`)
- Estilos dinámicos basados en atributos
- Todo en un solo archivo JavaScript

### Mejora Futura Sugerida

Exponer CSS Custom Properties para personalización:
```css
:host {
  --widget-primary-color: var(--rag-theme-color, #2563eb);
  --widget-font-family: var(--rag-font, sans-serif);
  --widget-border-radius: var(--rag-radius, 8px);
}
```

Permitiría a usuarios del widget ajustar estilos sin romper la encapsulación:
```css
rag-assistant {
  --rag-theme-color: #16a34a;
  --rag-font: 'Inter', sans-serif;
}
```

## Referencias

- [MDN Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM)
- [Shadow DOM v1 Spec](https://dom.spec.whatwg.org/#shadow-trees)
- Código fuente: `src/assistant-widget.js` (líneas 1-500 aprox.)
