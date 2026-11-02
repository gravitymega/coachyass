#!/usr/bin/env bash
# Envoie des fichiers dans une release GitHub par paquets de 20, en remplaçant ceux qui existent déjà.
# Si GitHub refuse (limite de requêtes par heure du jeton du workflow), on attend la remise à zéro
# de la limite puis on renvoie le paquet (--clobber rend l'envoi sans risque à refaire).
# Usage : scripts/upload-release.sh <tag> <fichier>...
set -uo pipefail
tag=$1; shift
repo=${GITHUB_REPOSITORY:?}
files=("$@")
batch=20

wait_for_limit() {
  local reset now pause
  reset=$(gh api rate_limit --jq '.resources.core.reset' 2>/dev/null || echo 0)
  now=$(date +%s)
  pause=$(( reset > now ? reset - now + 15 : 60 ))
  (( pause > 3700 )) && pause=3700
  echo "Limite GitHub atteinte : pause de ${pause} s avant de reprendre."
  sleep "$pause"
}

for (( i = 0; i < ${#files[@]}; i += batch )); do
  chunk=("${files[@]:i:batch}")
  for try in 1 2 3 4 5 6; do
    if gh release upload "$tag" "${chunk[@]}" --clobber -R "$repo"; then
      echo "✓ $(( i + ${#chunk[@]} ))/${#files[@]}"
      break
    fi
    if (( try == 6 )); then echo "Échec de l'envoi après 6 essais." >&2; exit 1; fi
    wait_for_limit
  done
done
