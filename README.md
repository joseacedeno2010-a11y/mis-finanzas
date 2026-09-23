# Mis Finanzas

App personal de finanzas (web instalable, sin servidor ni cuenta). Los datos viven en el navegador del dispositivo.

## Abrir en la PC

Doble clic en `abrir.cmd` (necesita Node instalado). Se abre en `http://localhost:8765`.

## Usar en el teléfono

- **Misma wifi, sin instalar:** con el servidor corriendo, abre en el teléfono la dirección que muestra la consola (`http://192.168.x.x:8765`).
- **Instalar como app (recomendado):** la app necesita estar en una dirección `https`. Sube la carpeta completa (sin `capturas/`) a un hosting estático gratuito, por ejemplo Netlify Drop o GitHub Pages, y luego en Safari usa *Compartir → Añadir a pantalla de inicio*.

Los datos de la PC y del teléfono son independientes. Para pasarlos de uno a otro usa *Menú → Exportar respaldo* e *Importar respaldo*.

## Estructura

- `index.html`, `css/app.css`: interfaz.
- `js/format.js`: monedas, formato de números y fechas.
- `js/store.js`: almacenamiento local y reglas de integridad préstamo ↔ movimiento.
- `js/rates.js`: tasas (Binance P2P vía criptoya, TRM de respaldo, BCE para euros).
- `js/calc.js`: saldos, conversiones, préstamos, patrimonio neto.
- `js/ui.js`, `js/forms.js`, `js/views.js`, `js/app.js`: interfaz, formularios, pantallas y enrutador.
- `sw.js`, `manifest.webmanifest`: funcionamiento sin conexión e instalación.
- `herramientas/crear-iconos.js`: regenera los íconos PNG.
