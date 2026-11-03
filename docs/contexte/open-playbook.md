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

## Voix naturelle, lecture avec ▶, vidéos à télécharger, équipes NBA (demande du 2 nov. 2026)

- **Audio** : la voix robotique du navigateur est remplacée par des clips MP3 à voix naturelle, générés gratuitement avec Piper (open source, hors ligne). Voix : `fr_FR-siwis-medium` et `en_US-libritts_r-medium`, toutes les deux CC BY 4.0. Les voix sous licence NC (ryan, hfc_female, lessac) sont écartées.
  - Les textes lus sont définis dans `src/narration.ts` : présentation, une légende par étape, puis « Pourquoi ça marche », contre quelle défense et les équipes NBA. `speakable()` rend le texte prononçable (« x2 » → « défenseur 2 », « 2-3 » → « 2 3 »).
  - `npm run audio:jobs` écrit `audio-jobs.json` (environ 4 460 clips, 88 000 mots). `scripts/tts.py` écrit `public/audio/v1/<langue>/<sha1>.mp3`. Les fichiers ne sont pas dans git.
  - Workflow `open-playbook.yml` : le job `audio` (8 parts : fr/en × 4) garde les clips en cache GitHub. Seuls les textes nouveaux ou modifiés sont régénérés : la première fois prend environ 20 min, les suivantes quelques minutes. Les clips sont publiés avec le site.
  - Si les clips manquent (en local, dans l'aperçu Artifact ou si une part échoue), le site prend la meilleure voix du navigateur : voix « améliorées », « naturelles » ou en ligne en priorité, phrases coupées une à une.
  - Changer de voix : modifier `VOICES` dans `scripts/tts.py` et passer `AUDIO_VERSION` à `v2`.
- **Lecture** : ▶ lance l'animation et l'explication audio ensemble, étape par étape. Le bouton « Son activé / Son coupé » est gardé dans `op-sound`. Le mode vidéo démarre seul avec le son ; si le navigateur bloque le son sans toucher (iPhone), l'animation continue et un bouton « Touche pour activer le son » apparaît.
- **Vidéos à télécharger** : page `#videos` (recherche, 3 formats par fiche) et section « Télécharger la vidéo » sur chaque fiche. Les MP4 sont dans des releases GitHub `op-videos-vertical`, `op-videos-square` et `op-videos-horizontal`, produites par `.github/workflows/open-playbook-videos.yml`.
  - Ce workflow se lance à la main, avec 24 parts en parallèle et `render.py --shard i/n`. Il est à relancer après un lot de nouvelles fiches.
  - Voix dans les vidéos : `render.py --audio <dossier ou adresse du site>` prend les clips de chaque fiche grâce à `audio-index.json` (écrit par `npm run audio:jobs`). Il ajoute une piste française (par défaut) et une piste anglaise, et allonge l'introduction, chaque étape et la conclusion pour que la phrase la plus longue des deux langues finisse. Le workflow des vidéos lit les clips sur le site publié : le lancer **après** une publication du site.
- **Équipes NBA** : `data/nba.json` (`teams.<id>` = `[{ team, when: {fr, en} }]`) liste 28 fiches avec des exemples connus (Spurs, Warriors, Jazz, Bulls, Lakers, Heat, Bucks, Raptors, etc.). Les noms d'équipes sont en texte seulement, sans logo.
  - Le site affiche une section « Équipes NBA qui l'utilisent », une étiquette NBA sur les cartes et le filtre « Utilisées en NBA ». La recherche trouve aussi les équipes.
  - La narration se termine par « En NBA, utilisé notamment par … ».
  - Le validateur vérifie ce fichier. Les exemples sont à relire comme les fiches.

## Style « Short » des vidéos verticales (demande du 2 nov. 2026)

- L'utilisateur a donné en exemple un Short YouTube de basket : titres néon, terrain en 3D, anneaux lumineux sous les joueurs, rythme rapide. On s'en inspire sans rien copier (ni logo ni images).
- `render.py`, format `vertical` seulement (`draw_frame_neon`) :
  - en haut, la catégorie et le nom de la tactique en néon ;
  - au milieu, `NeonBoard` : terrain en perspective, la caméra s'approche du panier si les joueurs restent près de lui (`neon_board`) ;
  - sous les joueurs, des anneaux lumineux (vert pour l'attaque, rose pour la défense) et des pions surélevés ; trajets blancs brillants, passes en bleu ;
  - en bas, l'étape et la phrase FR en néon, l'EN en petit (seulement si elle tient), puis la marque de la chaîne ;
  - fond sombre avec des arcs colorés.
- Le son est un rythme synthétisé (`beat_track`, aucun droit), discret sous la voix (FR et EN), ou seul si une fiche n'a pas de voix.
- Le fond, le titre, le terrain et chaque bloc de texte sont dessinés une seule fois (`_NEON_STATIC`, `_NEON_CAPTIONS`), ce qui rend le rendu environ 2,5 fois plus rapide.
- Les formats carré et horizontal gardent le style d'origine. Le workflow des vidéos passe à 12 parts par format, avec un délai maximal de 180 min.

## Presses sur le terrain entier (demande du 2 nov. 2026)

- Demande : « mettre toutes les tactiques de presse tout terrain », avec en exemple un Short d'entraînement à 5 contre 5 sur tout le terrain.
- **Format** : champ facultatif `court: "full"` (schéma `tactic.schema.json`). Le repère ne change pas : la ligne de fond est en haut (y = 0), la ligne médiane en y = 47 et la seconde ligne de fond en y = 94 (second panier en (25, 88.75)). Les bornes vont de y = -5 à 99. Aucune migration n'est nécessaire : sans ce champ, la fiche reste un demi-terrain.
  - Dans les presses, l'attaque remet en jeu en haut et remonte vers le bas, comme dans les fiches d'avant.
- **Moteur** : `FULL_COURT`, `isFull`, `boundsOf` et `viewOf` dans `src/engine.ts`. `checkTactic` prend en compte les bornes du terrain entier. `shotKind` ramène un tir au second panier dans le repère du demi-terrain, par symétrie.
- **Site** : `drawCourt(svg, full)` dessine la seconde moitié en miroir. Le terrain entier a une hauteur limitée (classe `board-full`). La vue 3D a une caméra plus haute, un cadre plus haut et un second panier.
- **Vidéos** :
  - le format vertical néon montre le terrain entier en perspective (cadrage jusqu'à y = 98, second panier) ;
  - les formats carré et horizontal couchent le terrain (`Board(..., full=True, horizontal=True)`, `layouts(full)`).
- **Contenu** :
  - 11 presses passées sur le terrain entier, avec une étape de plus quand il fallait montrer la suite après la ligne médiane : 2-2-1, 1-2-1-1, 1-2-2, 2-1-2, homme à homme, run and jump, 3/4 de terrain, après lancer franc, refus de la remise, retour en défense placée, 1-3-1. Le piège 1-3-1 sur demi-terrain reste en demi-terrain.
  - 9 nouvelles fiches (509 au total) :
    - 3 presses : piège 2-2-1 à la ligne médiane, homme à homme avec changements, presse de ralentissement ;
    - 5 sorties de presse, dans la nouvelle famille `contre-presse` (catégorie transition) : en ligne 1-4, écran pour le meneur, passeur qui court la ligne de fond, passe longue, sortir d'un piège ;
    - l'exercice « 5 contre 5 : attaque puis repli défensif », d'après l'exemple de l'utilisateur.
  - Le catalogue de 500 entrées n'a pas changé : les nouvelles fiches s'y ajoutent.
- **Workflow des vidéos** : nouvelle entrée `ids`, pour ne refaire que certaines fiches.

## Miniatures avec le nom de la tactique (demande du 2 nov. 2026)

- L'utilisateur a donné en exemple un Short « Offense vs 2-3 zone » : terrain en fond, bande noire en diagonale, nom en très gros (première partie en orange, suite en blanc), nom de la chaîne en haut. On le reproduit sans reprendre ni logo ni marque.
- `render.py` :
  - `draw_cover` dessine le parquet et le placement de départ, le bandeau rouge avec le nom de la chaîne, puis la bande noire inclinée avec le nom de la fiche. `split_title` coupe le nom sur « : », « contre » ou au milieu.
  - La couverture sert à trois choses : la miniature PNG de chaque format, les 3 premières secondes de chaque vidéo (`COVER`, 3 s à la demande de l'utilisateur, la voix et le rythme sont décalés d'autant) et l'image de couverture du MP4 (flux PNG `attached_pic`).
- Le workflow des vidéos dépose aussi les PNG dans les releases, et la page `#videos` affiche la miniature verticale de chaque fiche (cachée si elle n'existe pas encore).
- **Limite de requêtes GitHub** (run du 2 nov. 2026 : 9 parts refusées par « API rate limit exceeded », environ 1 000 requêtes par heure pour le jeton du workflow). L'envoi passe par `scripts/upload-release.sh` : paquets de 20 fichiers, et en cas de refus, attente de la remise à zéro de la limite puis nouvel essai. Nouvelle entrée `shards` (exemple : `1,3,4`) pour ne relancer que certaines parts ; délai maximal de 300 min.
- **À surveiller** : une release GitHub accepte au plus 1 000 fichiers. Avec un MP4 et un PNG par fiche, `op-videos-square` en contenait 974 le 2 nov. 2026. Au-delà d'environ 500 fiches animées, il faudra mettre les miniatures dans des releases séparées.

## Montage avec une vraie vidéo (demande du 2 nov. 2026)

- Demande : mettre des Shorts dans les montages avec le schéma du coach, à partir de vidéos que l'utilisateur fournit. L'utilisateur estime avoir le droit de commenter et d'analyser des vidéos publiées sur les réseaux.
  - On n'ajoute **aucun outil qui télécharge** sur Instagram, Facebook ou YouTube : l'utilisateur fournit lui-même le fichier.
  - Le crédit de l'auteur (« 🎥 @compte ») est affiché sur la vidéo et demandé dans le formulaire.
- Route `#montage-<id>` et bouton « 🎬 Monter avec ta vidéo » sur chaque fiche. `src/montage.ts` est chargé à la demande.
- Rendu 1080 × 1920 dans un canvas :
  - d'abord la miniature pendant 3 s (même dessin que `render.py`) ;
  - puis la vidéo de l'utilisateur en haut (recadrée, à partir de « Début de l'extrait »), avec le titre et le crédit par-dessus ;
  - au milieu, l'étape et la légende ;
  - en bas, le schéma animé (`Board.snapshotSvg` est redessiné en image à chaque mouvement) ;
  - le nom de la chaîne tout en bas.
- Son : les clips de voix naturelle de la fiche et le son de la vidéo (option, volume 35 %) sont mélangés avec WebAudio.
- Enregistrement en temps réel avec `canvas.captureStream` et `MediaRecorder`. Le navigateur choisit le format : MP4 (H.264) sur Safari et Chrome récents, sinon WebM. Le chrono part quand l'enregistreur a vraiment démarré (`onstart`).
- Tout se fait sur l'appareil, sans envoi ni frais. Testé dans Chromium à 390 px avec une vidéo de test : fichier 1080 × 1920 de 40 s avec la voix, aucune erreur dans la console.

## Défenseurs dans toutes les situations de jeu (demande du 2 nov. 2026)

- Choix de l'utilisateur : « situations de jeu ». Un défenseur face à chaque attaquant dans les catégories attaque, attaque de zone, remises en jeu, transition, défense et principes. Les exercices (tir, dribble, passes, etc.) et les surnombres voulus (contre-attaques, fiches de transition qui avaient déjà des défenseurs) restent comme avant.
- Migration `scripts/add-defenders.ts` (`--dry` pour un essai) : 245 fiches, 1 116 défenseurs ajoutés. Placement homme à homme entre l'attaquant et le panier, décalé vers le ballon sans ballon ; le défenseur suit son joueur à chaque étape où quelqu'un bouge. Les étapes qui ne sont qu'une passe gardent leur timing, et les défenseurs déjà écrits à la main ne changent pas.
- Les fiches touchées repassent en `review: "pending"` (placement automatique à relire par un entraîneur). Les vidéos de ces fiches sont à refaire avec le workflow des vidéos (entrée `ids`).

## Voix d'homme (demande du 2 nov. 2026)

- Toutes les voix de narration sont des voix d'homme : français `fr_FR-upmc-medium` locuteur « pierre » (`speaker_id` 1, CC BY-SA 4.0), anglais `en_US-joe-medium` (CC0). Les voix de femme siwis et libritts_r ne sont plus utilisées.
- `AUDIO_VERSION` passe à `v2` : tous les clips sont refaits (chemins `audio/v2/...`), caches `piper-voices-v2` et `op-audio-v2-*`.
- Voix du navigateur (secours) : les noms de voix d'homme connus sont préférés (Thomas, Daniel, Paul, Henri, Guy…), ceux des voix de femme écartés.
- Les vidéos prennent les clips du site publié : les refaire **après** la publication du site avec les clips v2.

## Vidéos en anglais, voix réaliste, moins de texte, vraie séquence de match (demande du 2 nov. 2026)

- Choix de l'utilisateur : « realistic » veut dire la **voix** ; format : **moins de texte**. Le lien de vraie séquence de match a d'abord été demandé dans la vidéo, puis retiré le même jour (« je ne veux pas que le lien apparaisse dans la vidéo que je téléchargerai ») : aucun lien dans les vidéos, et aucune liste de liens dans le dépôt public (les liens restent dans le chat, pour l'utilisateur seulement).
- `render.py` (`VL = "en"`) : textes à l'écran en anglais seulement (titre, « STEP i/n », légende, « WHY IT WORKS ») et une seule piste audio anglaise. La traduction sous la légende est retirée.
- Voix anglaise : Kokoro-82M (Apache 2.0), voix d'homme `am_michael`, beaucoup plus naturelle que Piper. `AUDIO_VERSIONS` passe à `{ fr: "v2", en: "v3" }`. Le français du site garde Piper « pierre ». Job `audio` : français en 4 parts, anglais en 16 parts ; modèle `kokoro-v1.0.int8.onnx` et `voices-v1.0.bin` tirés des releases de kokoro-onnx (cache `voices-v3-<langue>`).
- Aucun lien dans les vidéos téléchargeables : la carte de fin et `data/realgame.json` sont retirés, ainsi que l'adresse du site sur la couverture (demande du 2 nov. 2026).

## Accroche et analyse professionnelle (demande du 2 nov. 2026)

- Plus de « Why it works » dans les vidéos. Au début, une accroche nomme le système selon la catégorie (« Film room », « Defensive breakdown », « Set play breakdown », « Drill breakdown », etc.), puis le nom et le résumé de la fiche (écran et voix).
- À la fin, « THE ANALYSIS » : à l'écran, la phrase clé de l'efficacité ; à la voix, une analyse complète qui couvre l'efficacité, trois points clés, contre quoi le système est fait (`coaching.json` › `against`), comment l'adversaire s'adapte (`counter`) et les équipes NBA (`nba.json`). Pour les exercices : efficacité et points clés seulement.
- Construit dans `src/narration.ts` (`englishSegments`, `HOOKS`), qui sert aussi à la lecture en anglais sur le site. Le français ne change pas. Libellés de l'écran dans `render.py` (`HOOKS`, `ANALYSIS`).
- Plus d'ombre ni d'anneau rond sous les pions : anneaux lumineux retirés des vidéos verticales (`render.py`, `NeonBoard.players`), ombre ronde et ombre portée des joueurs retirées de la vue 3D du site (`src/board3d.ts`), demande du 2 nov. 2026.
- **Version courte** (même jour, « les explications sont longues ») : au début, seulement l'accroche et le nom (« Film room: Spain pick-and-roll. ») ; à la fin, l'efficacité, un point clé (« The key: … ») et une équipe NBA s'il y en a une. Contre quoi le système marche et comment l'adversaire s'adapte sont retirés de la voix. Temps de lecture à l'écran : une langue seulement (`read_time` n'est plus doublé). La vidéo Spain passe de 70 s à 36 s.
