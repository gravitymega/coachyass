# Playbook Ouvert · Open Playbook

[Français](#français) · [English](#english)

---

## Français

Bibliothèque libre de **500 tactiques de basket**, en français et en anglais : systèmes d'attaque, attaque de zone, transition, remises en jeu, défenses, exercices et principes. Chaque fiche est un schéma animé étape par étape et peut devenir une courte vidéo pour les réseaux sociaux.

Les fiches sont marquées `"review": "pending"` tant qu'un entraîneur ne les a pas relues. Le site permet de les afficher ou de les masquer.

### Démarrer

```bash
npm install
npm run dev        # site en local sur http://localhost:5173
npm run validate   # vérifie toutes les fiches
npm run build      # site prêt à publier dans dist/
```

Les vidéos demandent Python 3, pycairo et ffmpeg :

```bash
npm run videos                    # toutes les fiches, 3 formats + miniatures + scripts voix
python3 render.py horns-flare     # une seule fiche
```

Les vidéos vont dans `videos/` (ignoré par git).

### Contenu du dossier

| Chemin | Rôle |
|---|---|
| `data/tactics.json` | Les fiches, le glossaire et les plans de séance |
| `data/catalogue_500.json` | La liste des 500 fiches prévues |
| `schema/` | Schémas JSON du format |
| `src/` | Site : moteur commun, terrain SVG, vue 3D, éditeur |
| `render.py` | Génération des vidéos |
| `scripts/` | Validation, avancement, migrations |

### Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md). Pour proposer une tactique sans coder, ouvrez une issue « Proposer une tactique ».

### Licences

Code sous licence **MIT** ([LICENSE](LICENSE)). Contenu sous licence **CC BY 4.0** ([LICENSE-CONTENT.md](LICENSE-CONTENT.md)). Aucun logo, aucune marque et aucune image protégée.

---

## English

A free library of **500 basketball plays** in French and English: half-court sets, zone offense, transition, inbounds, defenses, drills and principles. Every card is a step-by-step animated diagram and can become a short social-media video.

Cards stay marked `"review": "pending"` until a coach has checked them. The site can show or hide them.

### Getting started

```bash
npm install
npm run dev        # local site at http://localhost:5173
npm run validate   # checks every card
npm run build      # site ready to publish in dist/
```

Videos need Python 3, pycairo and ffmpeg:

```bash
npm run videos                    # every card, 3 formats + thumbnails + voice scripts
python3 render.py horns-flare     # a single card
```

Videos go to `videos/` (ignored by git).

### Folder layout

| Path | Purpose |
|---|---|
| `data/tactics.json` | Cards, glossary and session plans |
| `data/catalogue_500.json` | The list of the 500 planned cards |
| `schema/` | JSON schemas of the format |
| `src/` | Site: shared engine, SVG court, 3D view, editor |
| `render.py` | Video generation |
| `scripts/` | Validation, progress, migrations |

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). To suggest a play without coding, open a "Suggest a play" issue.

### Licences

Code under the **MIT** licence ([LICENSE](LICENSE)). Content under **CC BY 4.0** ([LICENSE-CONTENT.md](LICENSE-CONTENT.md)). No logos, brands or protected images.
