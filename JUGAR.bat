@echo off
title Once Upon a Time - Servidor
color 0E

:: Check if installed
if not exist "%~dp0server\node_modules" (
    echo  No se ha instalado todavia. Ejecuta INSTALAR.bat primero.
    pause
    exit /b 1
)
if not exist "%~dp0client\dist" (
    echo  No se ha compilado todavia. Ejecuta INSTALAR.bat primero.
    pause
    exit /b 1
)

echo.
echo  Arrancando servidor...
echo  Abre http://localhost:3000 en tu navegador.
echo  NO cierres esta ventana mientras juegues.
echo.

:: Open browser after 2 seconds
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"

:: Start server
cd /d "%~dp0server"
node index.js

pause
