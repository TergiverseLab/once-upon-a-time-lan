@echo off
title Once Upon a Time - Instalador
color 0E
echo.
echo  ========================================
echo    ONCE UPON A TIME - Instalador
echo  ========================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js no esta instalado.
    echo.
    echo  Descargalo de: https://nodejs.org
    echo  Instala la version LTS y vuelve a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  Node.js detectado: %NODE_VER%
echo.

:: Install server dependencies
echo  [1/3] Instalando servidor...
cd /d "%~dp0server"
call npm install --silent
if %errorlevel% neq 0 (
    echo  [ERROR] Fallo al instalar dependencias del servidor
    pause
    exit /b 1
)
echo  OK
echo.

:: Install client dependencies
echo  [2/3] Instalando cliente...
cd /d "%~dp0client"
call npm install --silent
if %errorlevel% neq 0 (
    echo  [ERROR] Fallo al instalar dependencias del cliente
    pause
    exit /b 1
)
echo  OK
echo.

:: Build client
echo  [3/3] Compilando interfaz...
call npx vite build
if %errorlevel% neq 0 (
    echo  [ERROR] Fallo al compilar
    pause
    exit /b 1
)
echo  OK
echo.

echo  ========================================
echo    INSTALACION COMPLETADA
echo  ========================================
echo.
echo  Para jugar, ejecuta: JUGAR.bat
echo.
pause
