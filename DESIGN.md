# No More Work — Design System

> **No More Work (NMW)** es un panel de operaciones autónomas. El usuario configura **zonas** en un **mapa 2D** y despliega **agentes de IA** que trabajan de forma continua en las tareas que el usuario les asigna. El producto es la observación y configuración de ese trabajo: el humano deja de trabajar, los agentes lo hacen.

Este documento es la fuente de verdad para cualquier UI. Si un patrón no está aquí, primero se añade aquí, después se construye.

---

## 1. Principios

1. **El mapa es el producto.** Todo lo demás (paneles, modales, formularios) es secundario: aparece sobre, junto o dentro del mapa.
2. **Calma con actividad.** La estética es serena —el usuario "ya no trabaja"— pero la UI debe sugerir que el sistema sí lo hace: pulsos sutiles, telemetría que fluye, contadores que se actualizan.
3. **Densidad útil, no ruido.** Mostrar muchos agentes y métricas a la vez está bien si todo comunica estado. Sin gradientes innecesarios, sin sombras blandas.
4. **Claro por defecto, oscuro disponible.** Modo claro como base (productivo, sereno); modo oscuro como alternativa (operación nocturna, foco). Ambos son ciudadanos de primera clase.
5. **El indigo es señal.** Es el color de marca y de acción primaria. No se usa de decoración. Cualquier otro uso debilita su significado.
6. **Operación, no juego.** Estética de centro de control / herramienta profesional. Nada de neón, RGB ni emojis decorativos en producción.

---

## 2. Marca

- **Nombre completo**: No More Work
- **Marca corta**: NMW
- **Wordmark**: `no more work` en minúsculas, peso 600, tracking normal. En contextos compactos: `NMW` mayúsculas, peso 800.
- **Mark (logotipo)**: cuadrado del color accent, radio `--radius-sm`, con `NMW` en blanco, peso 800, tracking `-0.04em`, tamaño relativo al cuadrado (~30% del lado). Tamaños canónicos: 40px (auth, sidebar), 32px (compacto), 24px (favicon).
- **Tagline operativa**: *"Operaciones autónomas."*
- **Voz**: directa, sobria, en español. Términos del dominio: *zona*, *agente*, *tarea*, *celda*, *ruta*, *misión*, *telemetría*, *despliegue*, *incidencia*. Evitar: *user*, *thing*, lenguaje corporativo.

---

## 3. Sistema de color

Todos los colores se exponen como **tokens CSS** en `frontend/styles.css` y se redefinen bajo `[data-theme="dark"]`. **Nunca usar hex sueltos en componentes** — siempre tokens o utilidades Tailwind generadas desde los tokens.

### 3.1 Surfaces

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--color-canvas` | `#F5F4EE` | `#06090F` | Fondo absoluto. |
| `--color-bg` | `#FAFAF7` | `#0B0F1A` | Fondo de la app. |
| `--color-surface-1` | `#FFFFFF` | `#10141F` | Sidebar, header, panels base. |
| `--color-surface-2` | `#F4F3ED` | `#161B27` | Cards y panels sobre el bg. |
| `--color-surface-3` | `#EDECE5` | `#1F2532` | Inputs, controles, hover de items. |
| `--color-surface-4` | `#E5E4DC` | `#2A3142` | Modales, popovers elevados. |
| `--color-border` | `#E5E4DC` | `#1F2532` | Bordes por defecto. |
| `--color-border-strong` | `#CFCEC4` | `#2E3649` | Separaciones importantes. |

### 3.2 Texto

| Token | Light | Dark |
|---|---|---|
| `--color-text` | `#0F172A` | `#F1F5F9` |
| `--color-text-muted` | `#475569` | `#94A3B8` |
| `--color-text-dim` | `#94A3B8` | `#64748B` |
| `--color-text-faint` | `#CBD5E1` | `#475569` |

### 3.3 Accent (marca)

| Token | Light | Dark | Uso |
|---|---|---|---|
| `--color-accent` | `#4F46E5` | `#6366F1` | Acción primaria, foco, agente activo. |
| `--color-accent-hover` | `#4338CA` | `#818CF8` | Hover sobre accent. |
| `--color-accent-soft` | `rgba(79,70,229,.08)` | `rgba(99,102,241,.10)` | Fondos suaves de hover/selección. |
| `--color-accent-glow` | `rgba(79,70,229,.20)` | `rgba(99,102,241,.25)` | Halos y rings de pulso. |
| `--color-accent-grid` | `rgba(79,70,229,.06)` | `rgba(99,102,241,.05)` | Líneas de cuadrícula del mapa. |

> **Regla del accent**: solo **un** elemento accent sólido visible por contexto. Para múltiples, usar variantes outlined o `accent-soft`.

### 3.4 Estado de agente (semántico)

Iguales en ambos modos.

| Token | Color | Significado |
|---|---|---|
| `--color-status-idle` | `#94A3B8` | Inactivo / en espera. |
| `--color-status-working` | `var(--color-accent)` | Trabajando. **Único caso donde se reutiliza el accent.** |
| `--color-status-success` | `#10B981` | Tarea completada / saludable. |
| `--color-status-warning` | `#F59E0B` | Atención, ralentizado, throttled. |
| `--color-status-error` | `#EF4444` | Fallo, agente caído, incidencia. |
| `--color-status-info` | `#0EA5E9` | Notificación, mensaje. |

Solo aparecen como puntos de estado, badges o iconos. Nunca como fondos amplios.

### 3.5 Zonas (categorías de dominio)

Cada zona del mapa tiene un color secundario. Se usa como tinte sutil (8-12% opacidad) del tile y como acento del label.

| Zona | Color | Hex |
|---|---|---|
| `research` | violet | `#8B5CF6` |
| `build` | cyan | `#06B6D4` |
| `trade` | emerald | `#10B981` |
| `monitor` | amber | `#F59E0B` |
| `security` | rose | `#F43F5E` |
| `comms` | sky | `#0EA5E9` |

Al añadir una zona nueva, registrar `--color-zone-<name>` en `styles.css` y aquí.

---

## 4. Tema claro / oscuro

- **Default**: claro. Sin atributo `data-theme`.
- **Oscuro**: `<html data-theme="dark">`.
- **Persistencia**: `localStorage["nmw-theme"]` = `"light"` | `"dark"`.
- **Sin flash**: un script inline en `<head>` aplica el atributo antes de que React monte. Ver [frontend/index.html](frontend/index.html).
- **Toggle**: vive en el header del panel. Icono sol/luna. Hook [useTheme](frontend/src/hooks/useTheme.jsx).
- **No auto-detect** del sistema por defecto: el usuario elige y persiste. Se respeta la elección sobre la preferencia del SO.

---

## 5. Tipografía

- **Sans (UI)**: `Inter`, fallback `system-ui, -apple-system, sans-serif`.
- **Mono (datos, IDs, coordenadas, logs)**: `JetBrains Mono`, fallback `ui-monospace, SFMono-Regular, monospace`.

### Escala

| Token | Tamaño / line-height | Uso |
|---|---|---|
| `text-display` | 32 / 40 | Titulares de página. |
| `text-h1` | 24 / 32 | Títulos de panel. |
| `text-h2` | 20 / 28 | Secciones dentro de panel. |
| `text-h3` | 16 / 24 | Subtítulos. |
| `text-body` | 14 / 20 | Texto general. |
| `text-sm` | 13 / 18 | Texto auxiliar. |
| `text-xs` | 11 / 16 | Labels, tags, badges. |
| `text-mono` | 12 / 18 | Datos tabulares y telemetría. |

Pesos: **400** body, **500** énfasis, **600** títulos, **800** marca.

---

## 6. Espaciado, radios, elevación

- **Grid base**: 4px. Todos los espacios son múltiplos.
- **Espacios canónicos**: 4, 8, 12, 16, 24, 32, 48, 64.
- **Radios**:
  - `--radius-sm` 4px — badges, chips, mark del logo
  - `--radius` 6px — botones, inputs
  - `--radius-md` 8px — cards, panels
  - `--radius-lg` 12px — modales
  - `--radius-full` 9999px — avatares, status dots, agentes
- **Elevación**: sin sombras blandas. Para flotantes (modal, popover, panel sobre mapa) usar borde + `0 24px 48px -16px rgba(15,23,42,.18)` (light) o `rgba(0,0,0,.6)` (dark).

---

## 7. El mapa

Reglas no negociables.

- **Tile (celda)**: 48×48px a zoom 100%. La cuadrícula de fondo (`--color-accent-grid`) coincide con la medida del tile.
- **Zoom**: 50%, 75%, 100% (default), 150%, 200%. `+` / `−` o cmd/ctrl + rueda.
- **Pan**: drag con click izquierdo sobre vacío o spacebar+drag. Cursor `grab` / `grabbing`.
- **Zonas**:
  - Forma rectangular con snap al tile.
  - Borde 1px del color de la zona al 60% opacidad; fondo del color al 8% opacidad.
  - Label superior izquierdo: mono, uppercase, 11px, color de la zona al 80%.
- **Agente**:
  - Marker circular 12px a zoom 100%, borde 2px del color del fondo (para "recortarlo" del mapa).
  - Color del marker según estado.
  - Halo pulsante (ring 2px) solo cuando `status="working"`. Animación `pulse-ring` 2.4s ease-out-expo infinite.
  - Hover: tooltip con nombre, tarea actual, telemetría (CPU/req/última acción) en mono.
  - Selección: ring 2px en `--color-accent` con `--color-accent-glow`.
- **Rutas / conexiones**: línea 1px con `stroke-dasharray: 4 4` animada (`stroke-dashoffset` decreciente) para sugerir flujo.
- **Vacío**: el mapa nunca está vacío del todo. Sin zonas → CTA central "Crea tu primera zona", grid de fondo visible.

---

## 8. Componentes

### 8.1 Panel / Card

```
bg: var(--color-surface-2)
border: 1px solid var(--color-border)
radius: var(--radius-md)
padding: 24px
```

Clase: `.panel`. Flotante sobre mapa: `.panel-floating` (con blur + sombra).

### 8.2 Botón

| Variante | Fondo | Texto | Hover |
|---|---|---|---|
| `primary` | `--color-accent` | blanco | `--color-accent-hover` |
| `secondary` | `--color-surface-3` | `--color-text` | `--color-surface-4` |
| `ghost` | transparente | `--color-text-muted` | `--color-surface-3` + texto |
| `danger` | `--color-status-error` | blanco | `#dc2626` |

Alturas: 32 (sm), 40 (md), 48 (lg). Radio `--radius`. Peso 600. Foco: outline 2px accent offset 2px.

### 8.3 Input / Select / Textarea

```
bg: var(--color-surface-3)
border: 1px solid var(--color-border)
radius: var(--radius)
focus: border var(--color-accent) + ring 0 0 0 3px var(--color-accent-soft)
```

### 8.4 Badge / Tag

11px mono uppercase, padding 2px 8px, radio `--radius-sm`. Variantes por estado con `data-status="…"`.

### 8.5 Status dot

8px circular, color por estado. `working` añade pulso.

### 8.6 Tooltip

`bg: var(--color-surface-4)`, borde `--color-border-strong`, padding 8px 12px, radio `--radius`, texto 12px, max-width 280px. Aparece tras 300ms.

### 8.7 Modal / Sheet

Overlay `rgba(0,0,0,.5)` con `backdrop-filter: blur(4px)`. Anchos: 480 (sm), 640 (md), 800 (lg). Cierre con `Esc` y click en overlay.

---

## 9. Iconografía

- **Librería**: [Lucide](https://lucide.dev). Una sola familia. Stroke 1.5px, tamaño 16 / 20 / 24.
- Mientras `lucide-react` no esté instalado, se usan SVGs inline siguiendo el mismo estilo (stroke 1.5, `round`, `viewBox="0 0 24 24"`).
- **Sin emojis** en producción.
- Iconos de zona: silueta simple en mono color, nunca rellenos pesados.

---

## 10. Motion

- **Duración**: 120ms (micro), 200ms (default), 320ms (paneles), 1200ms+ solo para actividad continua (pulsos, rutas).
- **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out expo) por defecto; `linear` para loaders y pulsos.
- **Reduce-motion**: respetar `prefers-reduced-motion`. Pulsos y rutas se vuelven estáticos (opacidad fija).

---

## 11. Estados

- **Loading inicial**: pantalla con grid de fondo y mark NMW centrado pulsando.
- **Loading dentro de panel**: skeleton de la misma altura que el contenido, con shimmer sutil (`.skeleton`).
- **Empty**: icono outline 48px en `--color-text-faint`, texto explicativo en muted, CTA primario opcional.
- **Error**: badge rojo + mensaje breve. Detalles tras "Ver detalles".
- **Toasts**: esquina inferior derecha, max 3, auto-dismiss 5s (10s en error).

---

## 12. Layout

- **Sidebar**: 256px fija, colapsable a 64px (solo iconos). `--color-surface-1`.
- **Header**: altura 64px, borde inferior `--color-border`, sticky.
- **Content**: padding 32px desktop, 16px mobile.
- **Map view**: 100% del content, sin padding propio. Controles flotantes (zoom, capas, mini-mapa) anclados con offset 16px.

### Breakpoints

| Nombre | Min-width | Notas |
|---|---|---|
| `sm` | 640px | Mobile landscape. |
| `md` | 768px | Tablet. |
| `lg` | 1024px | Laptop pequeño (mínimo para mapa). |
| `xl` | 1280px | Default de diseño. |
| `2xl` | 1536px | Pantallas grandes. |

> El mapa **no se diseña para mobile**. En `< lg` se muestra una vista lista de zonas y agentes.

---

## 13. Accesibilidad

- Contraste mínimo AA (4.5:1 body, 3:1 18px+ o bold). Las variantes light y dark deben cumplirlo independientemente.
- Foco visible siempre: outline 2px `--color-accent` offset 2px. **Nunca** quitar `outline` sin reemplazo.
- Targets táctiles mínimo 40×40px.
- Animaciones continuas respetan `prefers-reduced-motion`.
- Iconos siempre acompañados de label o `aria-label`.
- Color **nunca** es el único canal de información: estados y zonas van con icono, label o forma.

---

## 14. Convenciones de código

- **CSS**: usar los tokens de `frontend/styles.css`. No introducir hex sueltos en componentes. Si necesitas un color que no existe, primero añadelo como token con su variante dark.
- **Tailwind v4**: los tokens están expuestos como utilidades (`bg-surface-2`, `text-muted`, `border-border`, `text-accent`…). Para patrones repetidos (panel, map-grid, map-agent, glow) usar las clases base definidas en `styles.css`.
- **Naming**:
  - Vistas: `<Area><Name>View` (`PanelDashboardView`).
  - Layouts: `<Area>Layout` (`AuthLayout`).
  - Componentes de mapa: prefijo `Map` (`MapTile`, `MapAgent`, `MapZone`, `MapHUD`).
- **Estructura de archivos**: ver [README.md](README.md). No crear subcarpetas nuevas sin justificar el agrupamiento.

---

## 15. Checklist antes de mergear UI

- [ ] Usa solo tokens de color, no hex sueltos.
- [ ] Funciona en modo claro **y** oscuro.
- [ ] Un único elemento accent sólido por pantalla.
- [ ] Estados (loading, empty, error) implementados.
- [ ] Foco de teclado visible en todos los interactivos.
- [ ] Sin emojis en producción.
- [ ] Animaciones continuas degradan con `reduced-motion`.
- [ ] Probado en `lg` (1024px) como mínimo para vistas de mapa.
