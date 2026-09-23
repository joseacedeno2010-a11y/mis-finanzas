# Mis Finanzas

App personal de finanzas (web instalable, sin servidor ni cuenta). Los datos viven en el navegador del dispositivo.

## Abrir en la PC

Doble clic en `abrir.cmd` (necesita Node instalado). Se abre en `http://localhost:8765`.

## Usar en el teléfono

La app está publicada en **https://joseacedeno2010-a11y.github.io/mis-finanzas/** (GitHub Pages, desde la rama `main`).

- **iPhone:** abre esa dirección en Safari, toca *Compartir → Añadir a pantalla de inicio*.
- **Android:** en Chrome, menú ⋮ → *Instalar aplicación*.

## Actualizar

Cada `git push` a `main` publica la versión nueva en uno o dos minutos. Al cambiar archivos de la app, subir la versión de `CACHE` en `sw.js` para que los teléfonos descarguen los archivos nuevos. Los datos del usuario no se ven afectados por las actualizaciones.

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
