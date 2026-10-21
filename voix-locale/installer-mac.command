#!/bin/bash
# Double-clique ce fichier (Mac) : il installe tout ce qu'il faut, une seule fois.
cd "$(dirname "$0")" || exit 1
echo "=== Installation du clonage de voix (Mac) ==="

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew n'est pas installé. Installe-le d'abord depuis https://brew.sh (une commande à copier-coller), puis relance ce fichier."
  read -n 1 -s -r -p "Appuie sur une touche pour fermer."; exit 1
fi

brew list ffmpeg >/dev/null 2>&1 || brew install ffmpeg
brew list python@3.11 >/dev/null 2>&1 || brew install python@3.11

PY="$(brew --prefix python@3.11)/bin/python3.11"
[ -d .venv ] || "$PY" -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt || { echo "L'installation a échoué."; read -n 1 -s -r -p "Appuie sur une touche pour fermer."; exit 1; }

echo
echo "Installation terminée."
echo "Étape suivante : mets ton enregistrement dans ce dossier sous le nom « ma-voix » (ma-voix.m4a, ma-voix.wav ou ma-voix.mp3),"
echo "puis double-clique sur « cloner-mac.command »."
read -n 1 -s -r -p "Appuie sur une touche pour fermer."
