#!/bin/bash
# ═══════════════════════════════════════
#   ONCE UPON A TIME — Servidor (Mac)
# ═══════════════════════════════════════

cd "$(dirname "$0")"
clear

# ── Check installation ──
if [ ! -d "server/node_modules" ] || [ ! -d "client/dist" ]; then
    echo ""
    echo "  ❌ No se ha instalado todavía."
    echo "  Haz doble clic en INSTALAR.command primero."
    echo ""
    read -p "  Pulsa ENTER para salir..."
    exit 1
fi

# ── Detect LAN IP ──
# Try multiple methods for compatibility
LAN_IP=""
for iface in en0 en1 en2 en3 en4 en5; do
    IP=$(ipconfig getifaddr $iface 2>/dev/null)
    if [ -n "$IP" ]; then
        LAN_IP=$IP
        break
    fi
done
# Fallback
if [ -z "$LAN_IP" ]; then
    LAN_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
fi
if [ -z "$LAN_IP" ]; then
    LAN_IP="(no detectada — comprueba tu WiFi)"
fi

echo ""
echo "  ╔════════════════════════════════════════════╗"
echo "  ║     📖 ONCE UPON A TIME — Servidor         ║"
echo "  ╚════════════════════════════════════════════╝"
echo ""
echo "  ┌─────────────────────────────────────────┐"
echo "  │  TÚ:      http://localhost:3000         │"
echo "  │  ALUMNOS:  http://${LAN_IP}:3000        │"
echo "  └─────────────────────────────────────────┘"
echo ""
echo "  Los alumnos deben abrir la dirección de arriba"
echo "  en el navegador de su móvil o portátil."
echo "  (Todos en la misma red WiFi)"
echo ""
echo "  ⚠  NO cierres esta ventana mientras juegues."
echo "  ───────────────────────────────────────────"
echo ""

# ── Open browser ──
sleep 1
open "http://localhost:3000" 2>/dev/null || true

# ── Start server ──
cd server
node index.js

echo ""
echo "  Servidor detenido."
read -p "  Pulsa ENTER para cerrar..."
