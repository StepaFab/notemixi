#!/bin/bash

set -e

echo "Zastavuji staré kontejnery..."
docker compose down

echo "Stavím a spouštím NoteMixi..."
docker compose up -d --build

echo "Čekám na frontend..."
sleep 2

echo "Kontroluji frontend..."
curl -fsS http://127.0.0.1:80/ > /dev/null

echo "Nastavuji Tailscale HTTPS..."
sudo tailscale serve --bg http://127.0.0.1:80

echo
echo "================================="
echo "       NoteMixi je spuštěné"
echo "================================="
echo

sudo tailscale serve status

echo
docker compose ps