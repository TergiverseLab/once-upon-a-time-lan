#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$DIR/server/node_modules" ] || [ ! -d "$DIR/client/dist" ]; then
    echo "  ❌ No se ha instalado todavía. Ejecuta: ./instalar.sh"
    exit 1
fi

echo ""
echo "  🏰 Arrancando servidor..."
echo "  Abre http://localhost:3000 en tu navegador."
echo "  Pulsa Ctrl+C para parar."
echo ""

# Open browser after 2 seconds
(sleep 2 && open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null) &

cd "$DIR/server" && node index.js
