# Widget Asistente RAG - Versión 2

Nueva variante moderna del widget de asistente con diseño mejorado y funcionalidades adicionales.

## 🎨 Características

### Diseño Moderno
- Interfaz limpia y elegante inspirada en widgets profesionales
- Animaciones suaves y transiciones fluidas
- Sistema de diseño consistente con gradientes modernos
- Sombras y efectos visuales mejorados

### Funcionalidades Mejoradas
- ✨ **Notificaciones**: Contador de mensajes no leídos
- ⌨️ **Atajos de teclado**: Ctrl+K para abrir/cerrar, Esc para cerrar
- 📍 **Posicionamiento flexible**: Esquina inferior derecha o izquierda
- 🎨 **Temas personalizables**: Cambia colores dinámicamente
- 🔽 **Minimizable**: Minimiza el chat manteniendo el header visible
- 🗑️ **Limpieza de chat**: Botón para reiniciar la conversación
- 📱 **Totalmente responsive**: Adaptado para móvil, tablet y desktop
- 💬 **Sugerencias rápidas**: Botones de inicio rápido en estado vacío
- ⏰ **Timestamps**: Marca de tiempo en cada mensaje
- 🤖 **Indicador de escritura**: Animación mientras el asistente procesa

### Accesibilidad
- Atributos ARIA correctos
- Navegación por teclado completa
- Etiquetas descriptivas
- Alto contraste y legibilidad

## 📦 Instalación

### 1. Incluir el Script

```html
<!-- Marked.js para renderizado de Markdown (opcional pero recomendado) -->
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>

<!-- Widget V2 -->
<script src="/src/assistant-widget-v2.js"></script>
```

### 2. Agregar el Widget

```html
<rag-assistant-v2
  endpoint="http://localhost:8000/api/v2/mcp/tools/call"
  title="Asistente Virtual"
  tool-name="generate_rag_answer"
  session-id="web-v2"
  include-sources="true"
  placeholder="Escribe tu mensaje..."
  position="bottom-right"
  theme-color="#2563eb"
></rag-assistant-v2>
```

## ⚙️ Configuración

### Atributos Disponibles

| Atributo | Tipo | Valor por Defecto | Descripción |
|----------|------|-------------------|-------------|
| `endpoint` | string | `/api/v2/mcp/tools/call` | URL del API endpoint |
| `title` | string | `"Asistente Virtual"` | Título del chat |
| `tool-name` | string | `"generate_rag_answer"` | Nombre de la herramienta RAG |
| `session-id` | string | `"web"` | Identificador de sesión |
| `include-sources` | boolean | `true` | Mostrar fuentes consultadas |
| `placeholder` | string | `"Escribe tu mensaje..."` | Placeholder del input |
| `position` | string | `"bottom-right"` | Posición: `bottom-right` o `bottom-left` |
| `theme-color` | string | `"#2563eb"` | Color principal (hex) |

### Ejemplos de Configuración

#### Widget Azul en Esquina Derecha
```html
<rag-assistant-v2
  theme-color="#2563eb"
  position="bottom-right"
  title="Soporte Técnico"
></rag-assistant-v2>
```

#### Widget Verde en Esquina Izquierda
```html
<rag-assistant-v2
  theme-color="#16a34a"
  position="bottom-left"
  title="Asistente de Ventas"
></rag-assistant-v2>
```

#### Widget Personalizado
```html
<rag-assistant-v2
  endpoint="https://api.ejemplo.com/chat"
  title="Mi Asistente"
  tool-name="custom_tool"
  session-id="user-123"
  include-sources="false"
  placeholder="¿En qué puedo ayudarte?"
  position="bottom-right"
  theme-color="#9333ea"
></rag-assistant-v2>
```

## ⌨️ Atajos de Teclado

| Atajo | Acción |
|-------|--------|
| `Ctrl + K` (o `Cmd + K` en Mac) | Abrir/Cerrar el chat |
| `Esc` | Cerrar el chat |
| `Enter` | Enviar mensaje |

## 🎨 Personalización de Colores

El widget acepta cualquier color en formato hexadecimal. El sistema genera automáticamente:
- Gradientes basados en el color principal
- Variantes más claras/oscuras para hover states
- Colores rgba para sombras y overlays

### Colores Sugeridos

```javascript
// Azul profesional
theme-color="#2563eb"

// Verde éxito
theme-color="#16a34a"

// Rojo energético
theme-color="#dc2626"

// Morado creativo
theme-color="#9333ea"

// Naranja cálido
theme-color="#f97316"

// Rosa moderno
theme-color="#ec4899"
```

## 🔧 Cambio Dinámico de Configuración

Puedes cambiar la configuración del widget dinámicamente usando JavaScript:

```javascript
const widget = document.querySelector('rag-assistant-v2');

// Cambiar color
widget.setAttribute('theme-color', '#16a34a');

// Cambiar posición
widget.setAttribute('position', 'bottom-left');

// Cambiar título
widget.setAttribute('title', 'Nuevo Título');
```

## 📱 Responsive Design

El widget se adapta automáticamente a diferentes tamaños de pantalla:

- **Desktop** (> 768px): Ancho de 400px, altura de 600px
- **Tablet/Mobile** (≤ 768px): Ancho casi completo, ajustado con márgenes
- El botón flotante se reduce en pantallas pequeñas
- El contenido se reorganiza para mejor legibilidad en móvil

## 🎯 Características Técnicas

### Arquitectura
- Web Component nativo (Custom Element)
- Shadow DOM para encapsulación de estilos
- Sin dependencias externas (excepto Marked.js opcional)
- Event delegation para mejor performance
- Estado reactivo interno

### Performance
- Renderizado eficiente
- Delegación de eventos
- Scroll suave optimizado
- Auto-resize del textarea
- Debouncing automático en inputs

### Accesibilidad
- Atributos ARIA completos
- Roles semánticos correctos
- Navegación por teclado
- Labels descriptivos
- Alto contraste

## 🔄 Diferencias con la V1

| Característica | V1 | V2 |
|----------------|----|----|
| Diseño | Básico | Moderno con gradientes |
| Posicionamiento | Solo derecha | Derecha o izquierda |
| Colores | Fijo | Personalizable |
| Atajos de teclado | No | Sí (Ctrl+K, Esc) |
| Notificaciones | No | Contador de no leídos |
| Minimizable | Solo cerrar | Minimizar y cerrar |
| Sugerencias | No | Botones de inicio rápido |
| Timestamps | No | Sí |
| Indicador de escritura | Loading simple | Animación de typing |
| Responsive | Básico | Optimizado completo |
| Accesibilidad | Básica | ARIA completo |

## 🚀 Despliegue

### Opción 1: Servir localmente

```bash
# Iniciar servidor local
python3 -m http.server 8080

# Acceder a
http://localhost:8080/demo-widget-v2.html
```

### Opción 2: Integración en proyecto existente

1. Copia `src/assistant-widget-v2.js` a tu proyecto
2. Importa el script en tu HTML
3. Agrega el elemento `<rag-assistant-v2>` donde lo necesites

### Opción 3: Build para producción

```bash
# Minificar el JavaScript (opcional)
npx terser src/assistant-widget-v2.js -o dist/assistant-widget-v2.min.js -c -m

# Incluir la versión minificada
<script src="/dist/assistant-widget-v2.min.js"></script>
```

## 🧪 Testing

Para probar el widget:

```bash
# Desarrollo local
npm run dev
# → http://localhost:3000/demo-widget-v2.html

# Deploy a producción
bash deploy.sh
# → http://167.172.225.44:8081/demo-widget-v2.html
```

## 📝 Ejemplos de Uso

### Página Simple
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Mi Sitio</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
</head>
<body>
  <h1>Bienvenido</h1>
  <p>Contenido de mi sitio...</p>

  <script src="/src/assistant-widget-v2.js"></script>
  <rag-assistant-v2
    title="Asistente de Ayuda"
    theme-color="#2563eb"
  ></rag-assistant-v2>
</body>
</html>
```

### Múltiples Instancias
```html
<!-- Asistente de ventas en la derecha -->
<rag-assistant-v2
  title="Ventas"
  theme-color="#16a34a"
  position="bottom-right"
  tool-name="sales_assistant"
></rag-assistant-v2>

<!-- Soporte técnico en la izquierda -->
<rag-assistant-v2
  title="Soporte"
  theme-color="#dc2626"
  position="bottom-left"
  tool-name="support_assistant"
></rag-assistant-v2>
```

## 🐛 Troubleshooting

### El widget no aparece
- Verifica que el script esté cargado correctamente
- Revisa la consola del navegador por errores
- Asegúrate de que el elemento está correctamente formado

### Los estilos no se aplican correctamente
- El widget usa Shadow DOM, los estilos están encapsulados
- No intentes aplicar estilos externos directamente
- Usa los atributos de configuración para personalizar

### El endpoint no responde
- Verifica que el servidor backend esté ejecutándose
- Revisa la URL del endpoint
- Comprueba la consola de red del navegador

### El markdown no se renderiza
- Asegúrate de incluir Marked.js antes del widget
- Verifica que la URL del CDN sea correcta

## 📄 Licencia

Este widget es parte de la **DRAGA Platform** (Document Grounded RAG Agents).

## 🤝 Contribuciones

Para contribuir mejoras al widget:

1. Crea una rama feature
2. Realiza tus cambios
3. Prueba exhaustivamente
4. Envía un pull request

## 📞 Soporte

Para reportar bugs o solicitar features, por favor crea un issue en el repositorio del proyecto.
