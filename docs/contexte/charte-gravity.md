# Charte visuelle Gravity Basketball (« brand Gravity »)

Demande du 13 novembre 2026 : « Oublie pas brand Gravity », avec une capture du fil Instagram @gravitybasketball_mtl comme référence. **Tout visuel Gravity (collage, affiche, carte joueur, montage) suit ce style par défaut.**

## Style éditorial du fil Instagram
- **Fond** : noir / charbon (#0e0d0d), grain de pellicule, fumée ou taches orange brûlé dans les coins. Variante claire « papier » crème (#f0e8de) pour les fiches (Scouting Report, Gravity Profiles).
- **Accent** : orange (#f06e28, proche du #e8672e du site), en traits fins sous les photos, en bandeaux coup de pinceau et sur le point final des titres.
- **Titres** : capitales condensées très grasses (Anton ; Bebas Neue en variante), avec un **point orange** à la fin (« IN FOCUS. », « VICTOIRE. », « LE GRIND. »). Mot géant en filigrane possible derrière.
- **Petits textes** : capitales espacées (Inter Bold, interlettrage large). Le haut à gauche indique « GRAVITY BASKETBALL / MONTRÉAL », le haut à droite « PREP · 2026-27 ». En bas : « GRAVITY PREP · SAISON 2026-27 » et « @GRAVITYBASKETBALL_MTL ».
- **Photos** : souvent en **noir et blanc contrasté** avec du grain, sinon couleurs chaudes. Numérotées (01, 02…) avec une légende en capitales.
- **Logo** : petit, en en-tête. Jamais de grand dégradé orange-bordeaux en fond : la carte « ENTRAÎNEMENT » de ce style n'a servi qu'une fois, pour l'intro d'un montage.
- **Formats** : publication 4:5 (1080×1350), story / Reel 9:16 (1080×1920).

## Affiche de match et miniature YouTube : toujours le même style (13 nov. 2026)
« Pour l'affiche de la game et la miniature YouTube, garde en mémoire le même style toujours. »
- **Affiche du match** (publication 4:5 et story 9:16) : style **noir et orange de la charte**. Photo d'un joueur en duotone, « GAME DAY. », Gravity VS adversaire, date dans un coup de pinceau orange.
- **Miniature YouTube** (16:9) : style **minimaliste**, choisi le 13 nov. 2026 d'après la miniature Gravity vs Legacy 3R du 17 oct. Fond noir avec fumée orange floue, badge rouge LIVE, « GAME DAY » espacé en orange, 2 gros logos (l'adversaire dans un cercle à bord orange), « VS » blanc contouré d'orange, noms en Anton blanc, bandeau orange avec la date en noir, bande noire « GRAVITY BASKETBALL MONTRÉAL · EN DIRECT SUR YOUTUBE ». Ce style remplace le style « projecteurs » (façon NDG), qui reste disponible dans `miniature_projecteurs.py` sur demande. La **story assortie** (`story_minimaliste.py`, 9:16) a été demandée le même jour.
- Les gabarits prêts à l'emploi sont dans `docs/outils/affiche-match/` (modifier `match.json`, puis lancer les deux scripts). Le premier usage est le match contre les Sentinels du Nord, samedi 14 nov. 2026 à 18 h 45, au Gymnase A de Dorval.

## Réalisations
- 13 nov. 2026 : collage « THE GRIND. » en couleur (d'abord « LE GRIND. » en noir et blanc) (8 photos d'entraînement), en 4:5 et en story. Il a été fait avec PIL (Anton et Inter, grain par numpy). Fichiers livrés dans l'app, pas dans le dépôt.
- La galerie du site (`gravity-basketball-mtl/assets/galerie/`, PR #153) utilise une version plus ancienne (photos couleur, slogan Oswald) : elle est à refaire dans ce style si l'utilisateur le demande.
