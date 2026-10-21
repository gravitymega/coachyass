#!/bin/bash
# Double-clique ce fichier (Mac) pour générer la voix off avec ta voix.
cd "$(dirname "$0")" || exit 1
[ -d .venv ] || { echo "Lance d'abord « installer-mac.command »."; read -n 1 -s -r -p "Touche pour fermer."; exit 1; }
source .venv/bin/activate
ECH="$(ls ma-voix.* 2>/dev/null | head -n 1)"
[ -n "$ECH" ] || { echo "Mets ton enregistrement dans ce dossier sous le nom « ma-voix » (ex. ma-voix.m4a)."; read -n 1 -s -r -p "Touche pour fermer."; exit 1; }
python clone.py --echantillon "$ECH" --texte texte-voix-off.txt --sortie sortie/voix-off.wav
echo
echo "Le résultat est dans le dossier « sortie » (voix-off.wav et voix-off.mp3)."
open sortie 2>/dev/null
read -n 1 -s -r -p "Appuie sur une touche pour fermer."
