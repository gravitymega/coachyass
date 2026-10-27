#!/bin/sh
# Lance le jeu sur cet ordinateur (gratuit, sans Internet). Double-clic sur Mac, ou : sh lancer-mac-linux.command
cd "$(dirname "$0")"
PORT=8000
IP=$( (ipconfig getifaddr en0 || hostname -I | cut -d' ' -f1) 2>/dev/null )
echo "Jeu de Hbibiti : http://localhost:$PORT  (sur la tablette, même Wi-Fi : http://$IP:$PORT)"
echo "Fermer cette fenêtre arrête le jeu."
(sleep 1; open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null) &
exec python3 -m http.server $PORT --bind 0.0.0.0
