@echo off
cd /d "%~dp0"
echo Iniciando Mis Finanzas...
start "" /b node servidor.js
timeout /t 1 >nul
start "" http://localhost:8765
echo.
echo La app esta abierta en tu navegador. Cierra esta ventana para detener el servidor.
pause >nul
