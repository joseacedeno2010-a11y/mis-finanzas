# Guía para módulos de "Mi vida"

La app es una PWA en JavaScript vanilla, **sin build ni dependencias**, en español. Los archivos base son:

- `js/format.js`: `CURRENCIES`, `fmtMoney`, `fmtNum`, `parseAmount`, fechas (`todayISO()`, `toISO(d)`, `parseISO(s)`, `fmtDate(iso, 'day'|'short'|'medium')`, `monthKey`, `thisMonthKey`, `shiftMonth`, `fmtMonth`, `MONTHS`, `DAYS_SHORT`), `uid()`, `esc()`, `initials()`, `colorFor(str)`, `round2`.
- `js/store.js`: `Store.data` (objeto persistido en localStorage y sincronizado), `Store.upsert(coll, obj)`, `Store.remove(coll, id)`, `Store.list(coll)`, `Store.save()`. Toda colección es un **array de objetos con `id` string** (usa `uid()`).
- `js/ui.js`: `UI.icon(name)` (SVG inline; nombres en `ICONS`), `UI.sheet({title, html, onClose})` → `{el, body, close}` (hoja modal desde abajo), `UI.confirm(text, {ok, danger})`, `UI.options(title, items)`, `UI.toast(msg, isError)`, `UI.empty(emoji, title, sub)`, `UI.avatar(name)`, `UI.donut(items)`.
- `js/app.js`: `App.state` (estado de UI no persistido), `App.render()`, `App.go(hash)`, `App.registerModule(m)`, `App.actions` (mapa `data-action` → función).
- `css/app.css`: clases reutilizables: `.card`, `.card.tight`, `.card.flat`, `.card-head`, `.hero`, `.hero-tiles/.hero-tile`, `.grid2`, `.stat`, `.list/.item/.ic/.body/.title/.sub/.amt/.chev`, `.badge (g|r|b|a)`, `.btn (secondary|danger|sm)`, `.btnrow`, `.seg`, `.field`, `.two`, `.chips/.chip`, `.progress > div (ok|warn|over)`, `.switch`, `.search`, `.monthnav`, `.empty`, `.section-title`, `.day-head`, `.tl/.ev` (timeline), `.menu-grid`, `.topbar/.iconbtn`. Colores: variables CSS `--accent`, `--green`, `--red`, `--blue`, `--amber`, `--muted`, `--line`, `--card`, `--card-2`, `--bg`, `--text`. **Tema claro y oscuro** se resuelven solos con esas variables: nunca uses colores fijos para fondos o textos.

## Cómo se registra un módulo

Un módulo es **un solo archivo** `js/modules/<id>.js`, script clásico (sin `import/export`), que al final llama a `App.registerModule({...})`. No modifica ningún otro archivo. El integrador lo agrega a `index.html` y `sw.js`.

```js
'use strict';
const Habitos = { /* lógica, vistas y formularios del módulo */ };
App.registerModule({
  id: 'habitos',                 // único, sin espacios
  name: 'Hábitos',
  icon: 'check',                 // nombre de UI.icon o un emoji
  tab: { hash: '#/habitos', label: 'Hábitos', icon: 'check', order: 10 },   // opcional; solo habitos y metas llevan pestaña
  collections: ['habits', 'habitLogs'],   // se crean vacías, se guardan y se sincronizan solas
  routes: [
    [/^#\/habitos$/, m=>Habitos.viewPanel(), 'habitos'],     // fn(match) devuelve HTML; el 3er valor es la clave de pestaña activa
    [/^#\/habitos\/([\w-]+)$/, m=>Habitos.viewOne(m[1]), 'habitos'],
  ],
  menu: [{ hash: '#/habitos', icon: 'check', label: 'Hábitos' }],   // accesos en Menú → "Mi vida"
  homeCards: [{ order: 20, render: ()=>Habitos.homeCard() }],       // tarjetas del Inicio (orden ascendente; 60 = finanzas)
  fab: [{ label: 'Nuevo hábito', sub: 'Algo que quieres repetir', icon: 'plus', cls: 'g', run(){ Habitos.form(); } }],
  actions: { 'habit-toggle'(d, el){ Habitos.toggle(d.id, d.date); App.render(); } },   // se disparan con data-action="habit-toggle" data-id=".."
  css: `.hab-grid{...}`,          // CSS propio, con prefijo del módulo para no chocar
  init(){},                       // después de cargar los datos
  afterRender(hash){},            // opcional, tras cada render (para timers, canvas, etc.)
});
```

Reglas de la interfaz:
- Los botones de la vista usan `data-action="nombre"` más `data-*` con parámetros, o `data-go="#/ruta"` para navegar. No agregues `addEventListener` sobre elementos de la vista (se destruyen en cada render); solo dentro de hojas (`UI.sheet`) donde tienes `s.body`.
- Después de cambiar datos: `Store.upsert/remove` (guardan y sincronizan) y luego `App.render()`.
- Estado de UI temporal (filtros, mes elegido, pestaña interna) va en `App.state.<modulo>_<algo>`.
- Todo texto en español, tono cercano, sin tecnicismos. Formato de fecha con `fmtDate`.
- Diseño al nivel de la app actual: tarjetas limpias, iconos, barras de progreso, estados vacíos con explicación y botón. Mira `js/views.js` para copiar patrones (por ejemplo `budget()` y `people()`).
- Móvil primero (375 px de ancho), también debe verse bien en PC (máx. 640 px de ancho).
- Rendimiento: `App.render()` reconstruye la pantalla; evita trabajos pesados en cada render (calcula sobre los arrays; son pequeños).
- No uses librerías externas ni `fetch` a servicios de terceros. Gráficos: SVG inline (ver `Views.chartSVG` y `UI.donut`).
- No toques `Store.data.settings` salvo tu propia clave `Store.data.settings.<id>` (objeto pequeño de configuración del módulo); guárdalo con `Store.save()`.

## Datos compartidos entre módulos (nombres fijos)

Para que los módulos puedan leerse entre sí (por ejemplo, Logros lee hábitos y rituales), estos son los nombres y formas de las colecciones. Cada módulo es dueño de las suyas; los demás solo leen.

- `habits`: `{ id, name, icon (emoji), color, goalPerMonth (n), days: [0-6] (días de la semana activos; vacío = todos), order, archived, createdAt }`
- `habitLogs`: `{ id, habitId, date: 'YYYY-MM-DD', done: true }` (un registro por hábito y día cumplido; al desmarcar se elimina)
- `tasks`: `{ id, title, date: 'YYYY-MM-DD' | null, done, doneAt, minutes (opcional), goalId (opcional), order, createdAt }`
- `dayRewards`: `{ id: 'YYYY-MM-DD', text, claimed }` (premio del día del planificador)
- `rituals`: `{ id, name, icon, steps: [{ id, text }], time: 'HH:MM' (opcional), order }`
- `ritualLogs`: `{ id, ritualId, date, stepsDone: [stepId], completed: true|false, completedAt }`
- `focusSessions`: `{ id, date, minutes, label, startedAt, endedAt, completed }`
- `journal`: `{ id: 'YYYY-MM-DD', guideWords: [..], dayQuestionAnswer, mood (1-5), highlights, gratitude, notes }` (una entrada por día)
- `notes`: `{ id, title, body, tags: [], pinned, createdAt, updatedAt }`
- `goals`: `{ id, title, area: 'personal'|'profesional', horizon: 'dream'|'year'|'q1'|'q2'|'q3'|'q4', year, done, doneAt, progress (0-100), milestones: [{ id, text, done }], amountTarget, amountSaved (opcionales, para metas de dinero), order, createdAt }`
- `wheelAreas`: `{ id, name, description, order }` (áreas de la rueda de la vida)
- `wheelScores`: `{ id: 'YYYY-MM', scores: { [areaId]: 1-10 }, note }` (una foto por mes)
- `achievements`: `{ id, key, unlockedAt }` (logros desbloqueados)

Fechas siempre en ISO local `YYYY-MM-DD` con `todayISO()`.

## Cómo probar

- `node --check js/modules/<id>.js` debe pasar.
- El servidor local ya corre en `http://localhost:8765` (si no, `node servidor.js`). Puedes abrir la app y navegar a tu ruta. Datos de prueba: créalos con tu propio formulario o con `Store.upsert` desde la consola. Al terminar, deja el almacenamiento limpio (`Store.reset()` en la consola del navegador) si sembraste datos.
- La app está en `index.html`; para que tu módulo cargue, agrega temporalmente `<script src="js/modules/<id>.js"></script>` **después** de `js/app.js` mientras pruebas, y quítalo antes de terminar (el integrador lo añade de forma definitiva).
