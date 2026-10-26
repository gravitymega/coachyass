# Rushes du documentaire Gravity

Base de données des vidéos brutes du documentaire : tous les plans partagés avec Claude sont ici, au même endroit, avec leur fiche.

- `catalogue.json` : la fiche de chaque plan (date, durée, format, son, contenu, séquence, tags, empreinte `sha256`). C'est la base de données.
- `vignettes/` : une image par plan, pour parcourir sans ouvrir les vidéos.
- `ajouter.py` : recalcule les infos techniques et ajoute les nouveaux plans.
- Les vidéos : `IMG_xxxx.mov`, avec leur nom d'origine de l'iPhone (le script `../sequence-piscine.md` y fait référence).

## Index

<!-- index:début -->
| Plan | Tourné le | Durée | Format | Séquence | Contenu |
|---|---|---|---|---|---|
| [IMG_6686](IMG_6686.mov) | 2026-10-20 20:10:47 | 4.37 s | 1440x1920 · 24 i/s | La route | Selfie en marchant, de nuit |
| [IMG_6687](IMG_6687.mov) | 2026-10-20 20:10:56 | 2.2 s | 1440x1920 · 30 i/s | La route | Ombre et pieds sur le trottoir |
| [IMG_6688](IMG_6688.mov) | 2026-10-20 20:11:41 | 4.4 s | 1440x1920 · 30 i/s | L'arrivée | Façade du Complexe sportif Claude-Robillard |
| [IMG_6689](IMG_6689.mov) | 2026-10-20 20:11:51 | 3.77 s | 1440x1920 · 30 i/s | L'arrivée | La main pousse la porte vitrée |
| [IMG_6690](IMG_6690.mov) | 2026-10-20 20:12:11 | 2.93 s | 1440x1920 · 30 i/s | L'arrivée | Descente de l'escalier sous la bannière |
| [IMG_6691](IMG_6691.mov) | 2026-10-20 20:12:29 | 1.37 s | 1440x1920 · 30 i/s | L'arrivée | Couloir blanc vers les bassins |
| [IMG_6692](IMG_6692.mov) | 2026-10-20 21:31:54 | 2.43 s | 1440x1920 · 30 i/s | L'arrivée | Panoramique : les bassins |
| [IMG_6796](IMG_6796.mov) | 2026-10-25 12:08:14 | 5.77 s | 1080x1920 · 30 i/s | D'un gymnase à l'autre | Le matériel dans le métro |
| [IMG_6797](IMG_6797.mov) | 2026-10-25 12:45:45 | 4.43 s | 1440x1920 · 30 i/s | D'un gymnase à l'autre | Entrée du Collège Dawson |
| [IMG_6798](IMG_6798.mov) | 2026-10-25 12:46:05 | 1.6 s | 1440x1920 · 30 i/s | D'un gymnase à l'autre | Couloir vers le gymnase |
| [IMG_6799](IMG_6799.mov) | 2026-10-25 12:46:57 | 9.3 s | 1440x1920 · 30 i/s | D'un gymnase à l'autre | Révélation du gymnase par la vitre |
<!-- index:fin -->

## Ajouter de nouveaux plans

1. Dépose les fichiers (`.mov`, `.mp4`, `.m4v`) dans ce dossier, sans les renommer.
2. Lance `python3 ajouter.py` (ffmpeg et ffprobe installés). Il ajoute chaque plan au catalogue et met à jour l'index ci-dessus.
3. Remplis dans `catalogue.json` le titre, la séquence, l'usage, le lieu, les tags, la voix et le son des nouveaux plans (ils sont vides).

## À savoir

- Toutes les vidéos sont **verticales** (tournées à l'iPhone, rotation −90°) : `resolution_affichee` donne la taille réelle à l'écran. Le HEVC ne se lit pas partout ; un aperçu noir dans certains navigateurs est normal.
- Dates : heure de Montréal. Les prises du 20 octobre 2026 sont à 20 h 10 à 20 h 12, sauf IMG_6692 (bassins), tournée à 21 h 31.
- Les vidéos montrent le coach Yassine et des lieux publics. Pas de joueurs mineurs pour l'instant : à faire valider (autorisation des parents) avant toute diffusion de plans avec des joueurs.
- Le dépôt est privé. Gros fichiers : au-delà de ~100 Mo par vidéo, GitHub refuse l'envoi ; il faudra alors un autre stockage (Google Drive) et ne garder ici que la fiche et la vignette.
