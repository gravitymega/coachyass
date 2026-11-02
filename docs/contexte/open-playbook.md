# Open Playbook / Playbook Ouvert

Bibliothèque libre de tactiques de basket FR/EN, avec schémas animés et vidéos courtes. Licences : MIT pour le code, CC BY 4.0 pour le contenu. Le projet est dans `open-playbook/`, que `_redirects` masque du site Coaching. Publication prévue sur GitHub Pages (gratuit, car le dépôt est public).

## Historique

- 28 oct. 2026 : les fichiers d'origine de l'utilisateur (`tactics.json`, `render.py`, `catalogue_500.json`) étaient perdus. Ils ont été **recréés** d'après son cahier des charges. Toutes les fiches sont en `"review": "pending"`, à faire relire par des coachs.
- 28 oct. 2026 : phase 5 terminée, **500/500 fiches animées** (lots 0 à 24). Doublons fusionnés et entrées impossibles à dessiner remplacées dans le catalogue. Restent les plans de séance par niveau (jeunes, amateurs, pro, pré-saison, veille de match), qui demandent une extension du format avec un script de migration.

## Cahier des charges (résumé)

1. Fondations : schéma JSON et `npm run validate`.
2. Site : bibliothèque, page de fiche `#id`, mode vidéo 9:16, glossaire, plans de séance, polices Barlow.
3. Éditeur de tactiques.
4. Vidéos : 3 formats, miniature, nom de chaîne, script voix.
5. Catalogue à 500 fiches et plus, par lots de 20 (validation, vidéos, 3 contrôles visuels, commit, `PROGRESS.md`).
6. Publication : GitHub Actions et Pages, licences, README et CONTRIBUTING en FR/EN, modèle d'issue.

## Format des fiches

Ne pas casser ce format. S'il doit évoluer, écrire un script de migration.

- `data/tactics.json` contient `{cats, glossary, plan, tactics}`. Les 7 catégories : attaque, zone_att, transition, remises, defense, exercices, principes.
- Champs d'une fiche : `id`, `cat`, `family`, `lvl` (1 à 3), `review`, `name`, `sum`, `why`, `counter`, `used` (objets `{fr, en}`) et `keys` (`{fr: [], en: []}`).
- `start` : positions de départ en pieds, avec le panier en (25, 5.25), la ligne de fond en y = 0 et `"b"` = id du porteur du ballon.
- `steps` : liste d'étapes `{m: {joueur: [x, y, c|d|s|m]}, p, c: {fr, en}}`.
- Champs propres aux exercices : `duration`, `equipment`, `players`, `age[]`, `variants`.
- Timeline, dans `data/timeline.json`, lue par le site et par `render.py` : déplacements 1,5 s, passe 0,85 s, puis lecture = max(2,2 s ; 0,13 s × mots FR+EN).
- Couleurs : attaque #1F5FD1 (ronds), défense #D7263D (X), ballon #F08A24.
- Terrain (demande du 28 octobre 2026, remplace le « tableau blanc » du cahier des charges) : parquet clair #E9C89B, lattes #DDB886, raquette peinte #C98E5A, lignes foncées. Valeurs dans `render.py` (BOARD, PLANK, PAINT) et `COLORS` de `src/engine.ts`.

## Choix techniques

- Vite + TypeScript sans framework. Moteur commun : `src/engine.ts`.
- Polices Barlow et Barlow Condensed via `@fontsource` (npm, licence OFL). Le site les sert lui-même, et `render.py` les lit grâce à un `fonts.conf` temporaire, sans rien installer.
- Validateur :
  - distance minimale entre deux joueurs : 1 pied ;
  - un « système » est une fiche dessinée hors `exercices` et `principes`, et il lui faut au moins 2 étapes.
- `catalogue_500.json` : 500 entrées (attaque 160, exercices 100, défense 90, remises 50, zone_att 40, transition 40, principes 20). Les 34 fiches existantes y sont au statut `done`.

## Site (phase 2, 2 nov. 2026)

- `src/main.ts` (vues) et `src/board.ts` (terrain SVG animé, même timeline que `render.py`). Routes par ancre simple : `#` bibliothèque, `#<id>` fiche, `#video-<id>` mode vidéo 9:16, `#glossaire`, `#plans`.
- Préférences gardées dans `localStorage` (`op-lang`, `op-theme`, `op-pending`) : langue FR/EN, thème auto/clair/sombre, affichage des fiches « à relire » (coché par défaut, car toutes le sont).
- `data/families.json` : noms FR/EN des familles, hors du format des fiches.
- `npm run build:single` crée `dist-single/index.html`, une page unique qui sert d'aperçu (publiée en Artifact privé : https://claude.ai/artifact/5YdHxgyQHSmdJazLqoMMGv).
- `.github/workflows/open-playbook.yml` : validation et build sur chaque PR, publication sur GitHub Pages après fusion dans `main`. L'utilisateur doit activer une fois Settings → Pages → Source « GitHub Actions ». Adresse prévue : https://gravitymega.github.io/coachyass/

## Phases 3, 4, 6, plans et 3D (2 nov. 2026)

- **Plans de séance** : migration `scripts/migrate-plans.ts` (`plan` → `plans`, avec `id` et `level` : general, jeunes, amateurs, pro, pre-saison, veille-de-match). 6 plans ; routes `#plans` et `#plan-<id>`.
- **Vue 3D** : `src/board3d.ts` (three.js 0.170, chargé à la demande). Le sol est le SVG du terrain et des flèches de l'étape ; elle suit la même animation que le SVG grâce à `Board.subscribe`. Bouton « Vue 3D », préférence `op-view3d`.
- **Éditeur** `#editeur` : `src/editor.ts`, avec un brouillon dans `localStorage` (`op-editor-draft`). Les règles sont communes au validateur et à l'éditeur dans `src/checks.ts`. L'export est bloqué tant qu'il reste des erreurs. Le bouton « Télécharger » ne marche pas dans l'aperçu Artifact (« Copier le JSON » oui).
- **Vidéos** : `render.py` produit, dans `videos/<id>/`, les formats vertical, square et horizontal, avec une miniature PNG par vidéo et `<id>-voix.txt`. Le nom de la chaîne se règle avec `--channel` ou `OP_CHANNEL`. `npm run videos` traite toutes les fiches.
- **Publication** : `LICENSE` (MIT), `LICENSE-CONTENT.md` (CC BY 4.0), `README.md` et `CONTRIBUTING.md` en FR/EN, `.github/ISSUE_TEMPLATE/proposer-une-tactique.yml`.

## Explications, audio et 3D d'accueil (demande du 2 nov. 2026)

- Accueil : une tactique à la une (elle change chaque jour, liste `FEATURED` dans `src/main.ts`) en 3D three.js, qui tourne seule et s'anime en boucle. Les filtres ne mettent à jour que la liste (`renderResults`), donc la 3D continue.
- Pendant la lecture, le bloc « coach » montre le principe au départ, un point clé par étape, puis « Pourquoi ça marche » à la dernière étape.
- Explication audio : `src/voice.ts` (Web Speech API du navigateur, gratuite). Le bouton « Écouter l'explication » lit le titre et le résumé, anime chaque étape en lisant sa légende, puis lit « Pourquoi ça marche » et contre quelle défense. La voix suit la langue choisie.
- `data/coaching.json` : `against` (contre quelle défense, par famille) et `practice` (progression d'entraînement par catégorie, `{n}` = nombre d'étapes). Le validateur vérifie que chaque famille et chaque catégorie y figurent.
- Tir obtenu : `shotKind()` dans `src/engine.ts`, déduit de la position du dernier porteur du ballon (cercle à 8 pieds ou moins, 3 points au-delà de l'arc). Il n'est affiché que pour les fiches d'attaque.
