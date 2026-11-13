# Gabarits « Game Day » Gravity (affiche du match + miniature YouTube)

Choix de l'utilisateur (13 nov. 2026) : **toujours ces deux styles**, sans le redemander.

| Fichier | Style | Sortie |
|---|---|---|
| `affiche.py` | **Affiche du match** : charte Gravity noir et orange. Photo d'un joueur en duotone noir/orange, titre « GAME DAY. » (Anton, point orange), logos Gravity VS adversaire, date dans un coup de pinceau orange, en-tête et pied éditoriaux. | `sortie/affiche-match-4x5.jpg` (1080×1350), `sortie/affiche-match-story.jpg` (1080×1920) |
| `miniature_youtube.py` | **Miniature YouTube du direct**, style **minimaliste** (référence : Gravity vs Legacy 3R du 17 oct.). Fond noir avec fumée orange floue, LIVE, « GAME DAY », 2 gros logos, VS, noms, bandeau orange avec la date, bande noire. | `sortie/miniature-youtube.jpg` (1920×1080) |
| `story_minimaliste.py` | **Story Instagram** dans le même style minimaliste que la miniature : logos empilés, VS, bandeau date, bande noire avec la salle, l'adresse et le direct YouTube. | `sortie/story-minimaliste.jpg` (1080×1920) |
| `miniature_projecteurs.py` | Ancien style « projecteurs » (façon NDG), seulement sur demande. Il écrit dans le même fichier de sortie. | `sortie/miniature-youtube.jpg` |

## Pour un nouveau match
1. Modifier `match.json` : adversaire (nom complet, et le même nom en 2 lignes), date courte et longue, lieu (domicile / extérieur), salle, rue.
2. (Facultatif) `adversaire_court` : nom plus court pour la miniature.
3. Mettre le logo rond de l'adversaire en PNG à côté, et indiquer son nom dans `logo_adversaire`. Pour un logo pris dans une capture d'écran, il faut le découper en rond, comme `sentinels_logo.png`.
4. Changer de photo si on veut : `photo` et `photo_cadrage` (centre x, y entre 0 et 1).
5. Lancer `python3 affiche.py && python3 miniature_youtube.py && python3 story_minimaliste.py` (il faut Pillow et numpy). Les images arrivent dans `sortie/`, qui n'est pas versionné.

Polices : Anton (incluse, licence OFL) et Inter (installée dans le conteneur, sinon à télécharger depuis Google Fonts). Le dossier `docs/` est bloqué sur le site Coaching par `_redirects`.
