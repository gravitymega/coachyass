# Contribuer · Contributing

[Français](#français) · [English](#english)

## Français

### Proposer une tactique sans coder
Ouvrez une issue avec le modèle **« Proposer une tactique / Suggest a play »** : nom, catégorie, placement, étapes, et pourquoi ça marche. Un schéma photographié suffit.

### Ajouter ou corriger une fiche
1. Dessinez la fiche dans l'**éditeur** du site (`#editeur`) puis exportez le JSON, ou modifiez `data/tactics.json` à la main.
2. Lancez `npm run validate`. Il vérifie les coordonnées (x de -3 à 53, y de -5 à 47), que deux joueurs ne soient pas au même endroit, que le receveur d'une passe existe, qu'un système ait au moins 2 étapes, que les textes FR et EN soient présents et que les ids soient uniques.
3. Ouvrez une pull request.

### Règles
- Tout texte visible existe en **français et en anglais**.
- Pas de logo, de marque, de maillot ni d'image protégée.
- Ne citez une équipe ou un entraîneur que si l'association est bien documentée ; sinon, décrivez le niveau de jeu.
- En cas de doute, laissez `"review": "pending"` plutôt que d'inventer.
- Ne cassez jamais le format des fiches : s'il doit changer, ajoutez un script de migration dans `scripts/`.

### Relire une fiche
Un entraîneur qui a vérifié une fiche peut passer `"review"` à `"approved"` dans une pull request, en expliquant ce qu'il a vérifié.

## English

### Suggest a play without coding
Open an issue with the **"Proposer une tactique / Suggest a play"** template: name, category, setup, steps and why it works. A photo of a hand-drawn diagram is enough.

### Add or fix a card
1. Draw the card in the site's **editor** (`#editeur`) and export the JSON, or edit `data/tactics.json` by hand.
2. Run `npm run validate`. It checks coordinates (x from -3 to 53, y from -5 to 47), that no two players share a spot, that a pass receiver exists, that a set has at least 2 steps, that FR and EN texts are present and that ids are unique.
3. Open a pull request.

### Rules
- Every visible text exists in **French and English**.
- No logos, brands, jerseys or protected images.
- Only name a team or coach when the association is well documented; otherwise describe the level of play.
- When unsure, keep `"review": "pending"` instead of guessing.
- Never break the card format: if it must change, add a migration script in `scripts/`.

### Reviewing a card
A coach who has checked a card can set `"review"` to `"approved"` in a pull request, explaining what was checked.
