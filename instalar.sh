#!/bin/bash
echo ""
echo "  ========================================"
echo "    🏰 ONCE UPON A TIME — Instalador"
echo "  ========================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "  ❌ Node.js no está instalado."
    echo ""
    echo "  Instálalo desde: https://nodejs.org"
    echo "  O con brew: brew install node"
    echo ""
    exit 1
fi

echo "  ✓ Node.js $(node --version) detectado"
echo ""

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "  [1/3] Instalando servidor..."
cd "$DIR/server" && npm install --silent
echo "  ✓ OK"
echo ""

echo "  [2/3] Instalando cliente..."
cd "$DIR/client" && npm install --silent
echo "  ✓ OK"
echo ""

echo "  [3/3] Compilando interfaz..."
cd "$DIR/client" && npx vite build
echo "  ✓ OK"
echo ""

echo "  ========================================"
echo "    ✅ INSTALACIÓN COMPLETADA"
echo "  ========================================"
echo ""
echo "  Para jugar, ejecuta: ./jugar.sh"
echo ""
