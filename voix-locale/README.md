# Cloner ma voix — gratuit et 100 % local

Un outil en ligne de commande qui clone **ta voix** à partir d'un enregistrement, puis lui fait lire n'importe quel texte en français. Tout tourne sur ton ordinateur : pas de compte, pas d'abonnement, rien n'est envoyé sur Internet (seul le modèle est téléchargé une fois, environ 3 Go).

- Moteur : **Chatterbox Multilingue** (Resemble AI), licence **MIT**, français inclus.
- Réservé à **ta propre voix**, ou à celle d'une personne qui a donné son accord. L'outil demande confirmation.
- Les voix générées contiennent un filigrane inaudible qui indique qu'elles sont synthétiques (c'est ajouté par le modèle).

## 1. Enregistrer ton échantillon

- 20 secondes à 1 minute de toi qui parles **naturellement**, dans une pièce calme, micro proche, sans musique ni écho (pas à la piscine).
- Un mémo vocal d'iPhone suffit (`.m4a`). Les formats `.wav`, `.mp3`, `.mov`, `.mp4` marchent aussi (le son est extrait).
- Le modèle utilise surtout les **10 premières secondes** de l'échantillon nettoyé : mets au début la meilleure partie (voix claire, ton que tu veux pour la voix off).

## 2. Installer (une seule fois)

**Le plus simple — double-clic :**
- **Mac** : double-clique `installer-mac.command` (si le Mac refuse : clic droit → Ouvrir). Il faut d'abord [Homebrew](https://brew.sh).
- **Windows** : double-clique `installer-windows.bat`.

Ensuite, mets ton enregistrement dans ce dossier sous le nom `ma-voix` (`ma-voix.m4a`, `.wav` ou `.mp3`) et double-clique `cloner-mac.command` ou `cloner-windows.bat` : la voix off arrive dans le dossier `sortie`.

**Ou à la main** (si tu préfères) :

Il faut **Python 3.10 à 3.12** et `ffmpeg`.

**Mac** (Apple Silicon : le modèle utilise la puce graphique) :
```bash
brew install ffmpeg python@3.11
cd voix-locale
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

**Windows** (PowerShell ; installe d'abord Python 3.11 et ffmpeg, par exemple avec `winget install Python.Python.3.11 Gyan.FFmpeg`) :
```powershell
cd voix-locale
py -3.11 -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

**Linux** : comme sur Mac, avec `apt install ffmpeg python3-venv`.

Avec une carte graphique NVIDIA, c'est beaucoup plus rapide ; sans, ça marche quand même sur le processeur (compte quelques secondes de calcul par seconde de voix).

## 3. Cloner et générer la voix off

```bash
python clone.py --echantillon ma-voix.m4a --texte texte-voix-off.txt --sortie sortie/voix-off.wav
```

Tu obtiens `sortie/voix-off.wav` et `sortie/voix-off.mp3`. Le premier lancement télécharge le modèle ; les suivants sont plus rapides.

Pour d'autres textes : remplace `--texte` par un autre fichier `.txt` (une ligne vide = une vraie pause), ou par le texte entre guillemets.

### Régler le rendu

| Option | Effet |
|---|---|
| `--expressivite 0.3` | voix plus posée, documentaire |
| `--expressivite 0.7` | voix plus vivante, plus d'émotion |
| `--fidelite 0.3` | rythme plus libre, parfois plus naturel |
| `--graine 12` | une autre « prise » (même réglage, autre interprétation) |
| `--appareil cpu` | force le processeur si la carte graphique pose problème |

Astuce : génère 2 ou 3 prises avec des graines différentes et garde la meilleure.

### Écouter l'échantillon sans lancer le modèle

```bash
python clone.py --echantillon ma-voix.m4a --texte x --preparer-seulement
```
Ça crée `sortie/echantillon-prepare.wav` (nettoyé, 20 s max) : c'est exactement ce que le modèle entendra.

## Si le résultat n'est pas bon

- **Voix pas assez ressemblante** : refais l'échantillon dans un endroit plus calme, plus proche du micro, sans bruit de fond.
- **Accent anglais** : vérifie `--langue fr` (valeur par défaut) et que l'échantillon est bien en français.
- **Mots mangés ou répétés** : écris la phrase plus simplement, ou change `--graine`.
- **Trop lent** : sans carte graphique, génère une phrase à la fois pour vérifier le rendu avant le texte complet.

## Ensuite : la voix dans le montage

Envoie `voix-off.wav` : elle se place sous les images de la séquence piscine, avec la musique qui baisse quand tu parles.
