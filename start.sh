#!/bin/bash

echo "🚀 Spouštím NoteMixi..."

echo "⚙️ Spouštím backend..."
cd /home/fabis/Notemixi/backend

# Automatická aktivace Python virtuálního prostředí, pokud existuje
if [ -d "venv" ]; then 
    source venv/bin/activate
elif [ -d ".venv" ]; then 
    source .venv/bin/activate
fi

# Spuštění Uvicornu (zkusíme to bezpečnější cestou přes python3 modul)
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

echo "🌍 Spouštím frontend..."
cd /home/fabis/Notemixi/frontend
npm run dev &
FRONTEND_PID=$!

sleep 3

echo "🔒 Zapínám Tailscale HTTPS tunely (může to vyžadovat tvé heslo do Linuxu)..."
sudo tailscale serve --bg --https=443 localhost:5173
sudo tailscale serve --bg --https=8443 localhost:8000

echo "====================================================="
echo "✅ NoteMixi je nahoře a bezpečně běží přes Tailscale!"
echo "🌐 Frontend: https://notemixi.tail1a26d2.ts.net"
echo "🔌 Backend:  https://notemixi.tail1a26d2.ts.net:8443"
echo "❌ Pro vypnutí obou lokálních serverů stiskni CTRL+C"
echo "====================================================="

trap "echo -e '\n🛑 Vypínám backend a frontend...'; kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT

wait
