# midi-studio

Générateur de sketches MIDI (accords + mélodie + batterie) en ligne de commande, à importer directement dans FL Studio (ou tout autre DAW).

Ce n'est **pas** un clone de FL Studio ni un outil qui pilote FL Studio à distance — FL Studio est une application desktop que rien ne permet de contrôler par API. `midi-studio` génère un fichier `.mid` multi-pistes que tu glisses ensuite dans le Playlist de FL Studio pour composer avec de vrais instruments/samples.

## Installation

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Utilisation

```bash
# Progression par défaut (I-V-vi-IV en do majeur), 8 mesures, batterie boombap
midi-studio -o mon_beat.mid

# Choisir la tonalité, la gamme, la progression et le tempo
midi-studio --key A --scale natural_minor --progression "i-VI-III-VII" --tempo 90 -o triste.mid

# Trap, plus rapide, sans mélodie (juste accords + batterie)
midi-studio --drum-genre trap --tempo 140 --no-melody -o trap_loop.mid

# Reproduire exactement la même mélodie (seed fixe)
midi-studio --seed 42 -o take1.mid
```

Le fichier généré a jusqu'à 4 pistes :

- **tempo** — méta-info (BPM)
- **chords** — canal MIDI 1
- **melody** — canal MIDI 2
- **drums** — canal MIDI 10 (mapping General MIDI standard : kick=36, snare=38, clap=39, hi-hat fermé=42, hi-hat ouvert=46)

### Importer dans FL Studio

1. Ouvre FL Studio, crée un projet vide.
2. `File > Import > MIDI file...` (ou glisse-dépose le `.mid` dans le Playlist).
3. FL Studio te propose de mapper chaque piste MIDI sur un instrument — choisis un plugin (FLEX, Sytrus, un sampler de batterie, etc.) par piste.
4. Les notes apparaissent dans le Piano Roll de chaque piste, éditables normalement.

### Options principales

| Option | Défaut | Description |
|---|---|---|
| `--key` | `C` | Note fondamentale (`C`, `F#`, `Bb`, ...) |
| `--scale` | `major` | `major`, `natural_minor`, `harmonic_minor`, `dorian`, `mixolydian`, `pentatonic_major`, `pentatonic_minor`, `blues` |
| `--progression` | `I-V-vi-IV` | Chiffres romains séparés par `-`. Suffixes `7`/`dim`/`aug`/`sus2`/`sus4` pour forcer la qualité (ex: `V7`) |
| `--bars` | `8` | Nombre de mesures total |
| `--beats-per-chord` | `4` | Durée d'un accord en temps |
| `--notes-per-bar` | `4` | Densité de la mélodie |
| `--tempo` | `120` | BPM |
| `--chord-octave` / `--melody-octave` | `3` / `5` | Octaves des accords / de la mélodie |
| `--drum-genre` | `boombap` | `boombap`, `trap`, `house`, `rock`, `none` |
| `--no-chords` / `--no-melody` | — | Désactive la piste correspondante |
| `--seed` | aléatoire | Graine pour figer la mélodie générée |
| `-o, --output` | `output.mid` | Chemin du fichier de sortie |

## Tests

```bash
pip install -e .
python -m pytest
```

## Structure du code

- `src/midi_studio/theory.py` — notes, gammes, accords diatoniques
- `src/midi_studio/chords.py` — construction de progressions d'accords
- `src/midi_studio/melody.py` — mélodie par marche aléatoire contrainte à la gamme
- `src/midi_studio/drums.py` — patterns de batterie par genre (grille 16 pas)
- `src/midi_studio/cli.py` — assemble tout en un fichier `.mid` multi-pistes (via [`mido`](https://mido.readthedocs.io/))

## Pistes d'évolution

- Plus de patterns de batterie / genres
- Variations de vélocité (swing, humanisation)
- Génération de basslines suivant la progression d'accords
- Export direct en plusieurs fichiers `.mid` (un par piste) si tu préfères les importer séparément
