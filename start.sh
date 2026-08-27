#!/bin/bash

echo "🚀 Spouštím NoteMixi..."

echo "⚙️ Spouštím backend..."
# Přejde do složky backend
cd backend || exit

# Automatická aktivace Python virtuálního prostředí, pokud existuje
if [ -d "venv" ]; then 
    source venv/bin/activate
elif [ -d ".venv" ]; then 
    source .venv/bin/activate
fi

# Spuštění Uvicornu na pozadí
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

echo "🌍 Spouštím Tauri desktopovou aplikaci..."
# Přejde do složky frontend, kde je Tauri
cd ../frontend || exit
npx tauri dev &
TAURI_PID=$!

sleep 3

echo "🔒 Zapínám Tailscale HTTPS tunely..."
sudo tailscale serve --bg --https=443 localhost:5173
sudo tailscale serve --bg --https=8443 localhost:8000

echo "====================================================="
echo "✅ NoteMixi desktopová aplikace a backend běží!"
echo "❌ Pro vypnutí obou serverů a okna stiskni CTRL+C"
echo "====================================================="

# Bezpečné vypnutí obou procesů (backendu i Tauri) při zmáčknutí CTRL+C
trap "echo -e '\n🛑 Vypínám backend a Tauri...'; kill $BACKEND_PID $TAURI_PID; exit" SIGINT

wait