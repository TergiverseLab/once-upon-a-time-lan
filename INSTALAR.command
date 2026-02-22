#!/bin/bash
# ═══════════════════════════════════════
#   ONCE UPON A TIME — Instalador (Mac)
# ═══════════════════════════════════════

cd "$(dirname "$0")"
clear

echo ""
echo "  ╔════════════════════════════════════╗"
echo "  ║  📖 ONCE UPON A TIME — Instalador  ║"
echo "  ╚════════════════════════════════════╝"
echo ""

# ── Check Node.js ──
if ! command -v node &> /dev/null; then
    echo "  ❌ Node.js no está instalado."
    echo ""
    echo "  Opciones para instalarlo:"
    echo "    1. Descárgalo de https://nodejs.org (versión LTS)"
    echo "    2. O con Homebrew: brew install node"
    echo ""
    echo "  Después, vuelve a hacer doble clic en INSTALAR.command"
    echo ""
    read -p "  Pulsa ENTER para salir..." 
    exit 1
fi

NODE_VER=$(node --version)
echo "  ✓ Node.js detectado: $NODE_VER"
echo ""

# ── Install server ──
echo "  [1/3] Instalando servidor..."
cd server
npm install --silent 2>&1
if [ $? -ne 0 ]; then
    echo "  ❌ Error instalando servidor"
    read -p "  Pulsa ENTER para salir..."
    exit 1
fi
echo "  ✓ Servidor OK"
echo ""

# ── Install client ──
echo "  [2/3] Instalando cliente..."
cd ../client
npm install --silent 2>&1
if [ $? -ne 0 ]; then
    echo "  ❌ Error instalando cliente"
    read -p "  Pulsa ENTER para salir..."
    exit 1
fi
echo "  ✓ Cliente OK"
echo ""

# ── Build client ──
echo "  [3/3] Compilando interfaz..."
npx vite build 2>&1
if [ $? -ne 0 ]; then
    echo "  ❌ Error compilando"
    read -p "  Pulsa ENTER para salir..."
    exit 1
fi
echo "  ✓ Compilación OK"
echo ""

echo "  ╔════════════════════════════════════╗"
echo "  ║    ✅ INSTALACIÓN COMPLETADA       ║"
echo "  ╚════════════════════════════════════╝"
echo ""
echo "  Para jugar, haz doble clic en JUGAR.command"
echo ""
read -p "  Pulsa ENTER para cerrar..."
