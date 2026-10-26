# Documentaire Gravity (octobre 2026)

Projet de l'utilisateur : un documentaire sur Gravity. Première séquence écrite : **« La piscine »** (le coach Yassine part de chez lui le soir, marche jusqu'au Complexe sportif Claude-Robillard et explique l'importance de la piscine pour la force et la vitesse des basketteurs, puis entraînement dans l'eau).

- `documentaire/sequence-piscine.md` : script plan par plan, répliques, liste des prises à tourner, notes de tournage.
- `documentaire/rushes/` : **base de données des vidéos brutes** (demande du 26 octobre 2026 : tout ce que l'utilisateur partage avec Claude va dans ce même dossier). `catalogue.json` = une fiche par plan ; `vignettes/` ; `ajouter.py` recalcule les infos techniques, ajoute les nouveaux plans et met à jour l'index de `README.md` (les notes écrites à la main sont conservées). Les vidéos gardent leur nom d'origine (`IMG_xxxx.mov`). Au-delà de ~100 Mo par fichier, GitHub refuse : prévoir Google Drive et ne garder ici que la fiche.
- Plans tournés le 20 octobre 2026 : IMG_6686 à IMG_6691 (20 h 10 à 20 h 12, rue puis entrée), IMG_6692 (bassins, 21 h 31). Tous verticaux, HEVC, à l'iPhone.
- `voix-locale/` : outil gratuit en local (Chatterbox, licence MIT) pour cloner la voix de l'utilisateur et générer la voix off. Pas testé avec le vrai modèle (téléchargement impossible depuis l'environnement de développement). Le Studio voix d'Art craft utilise des voix Piper toutes faites (pas de clonage).
- Le montage démo (33 s, musique générée, textes) n'est pas dans le dépôt : il se refait avec les rushes.
- Avant toute diffusion de plans avec des joueurs mineurs : autorisation des parents.
