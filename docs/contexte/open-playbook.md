# Open Playbook / Playbook Ouvert

Bibliothèque libre de tactiques de basket FR/EN, avec schémas animés et vidéos courtes. Licences : MIT pour le code, CC BY 4.0 pour le contenu. Le projet est dans `open-playbook/`, que `_redirects` masque du site Coaching. Publication prévue sur GitHub Pages (gratuit, car le dépôt est public).

## Historique

- 28 oct. 2026 : les fichiers d'origine de l'utilisateur (`tactics.json`, `render.py`, `catalogue_500.json`) étaient perdus. Ils ont été **recréés** d'après son cahier des charges. Toutes les fiches sont en `"review": "pending"`, à faire relire par des coachs.

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
