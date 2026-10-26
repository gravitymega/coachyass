## Art craft : module « Vidéo IA » (24-26 octobre 2026)

Onglet « Vidéo IA » (`art-craft/video-ia.html` + `video-ia.js`) : tu décris une scène en français, et un clip de 1 à 5 s est généré gratuitement, en vertical 9:16 (par défaut) ou en horizontal 16:9.

- **Étape 1, le prompt** : `POST /api/video { action: "prompt" }`. Gemini (plan gratuit, `GEMINI_API_KEY`) écrit un prompt anglais de 60 à 120 mots au style Gravity (noir et orange, éclairage de salle, cinématographique), sans texte ni logo à l'écran, avec un titre court pour le nom du fichier. Sans Gemini, ou s'il refuse, on utilise un prompt simple (la description + le style), et c'est le Space qui l'améliore lui-même (`enhance`). Le prompt reste modifiable avant de lancer.
- **Étape 2, la génération** : `POST /api/video { action: "generate" }` renvoie un flux NDJSON (`{wait}` toutes les 10 s, `{status}`, puis `{done}` ou `{error}`). Le serveur appelle l'API Gradio d'un **Space Hugging Face gratuit (ZeroGPU)** : `Lightricks/LTX-2.5` (avec son), puis en secours `Lightricks/ltx-video-distilled` (0.9.8, sans son, plus léger). Code : `art-craft/netlify/lib/hf-video.ts`. Il gère le réveil du Space, la file d'attente (9 min au plus) et des messages d'erreur clairs (quota, token, veille, surcharge).
- **Étape 3, le résultat** : la vidéo passe par le relais `GET /api/video?file=…` (seulement vers les hôtes des Spaces), avec aperçu, téléchargement MP4 et Partager.
- **Branché** dans le Worker Cloudflare `coachyass` (`worker/index.ts`), Cloudflare Pages (`functions/api/video.ts`) et Netlify (`netlify/functions/video.mts`, via la redirection `/api/*`).
- **Variables, toutes facultatives** : `HF_TOKEN` (token Hugging Face gratuit de type « Read » : environ 5 min de calcul par jour au lieu d'environ 2 min partagées), `GEMINI_API_KEY`, `ART_CRAFT_PASSWORD`. En local : `.dev.vars` (ignoré par Git).
- **Testé le 26 octobre 2026** :
  - fonctions pures avec Node (normalisation, SSE, URL vidéo, erreurs, dimensions multiples de 32) ;
  - paramètres comparés à `/gradio_api/info` des deux Spaces (10 et 13 paramètres, dans l'ordre) ;
  - essai réel par `wrangler dev` : clip 576×1024 de 2 s créé par LTX-2.5 en 5 s, relais MP4 OK (488 Ko) ;
  - `wrangler deploy --dry-run` OK.
  - La clé Gemini du `.dev.vars` local était refusée par Google ce jour-là : c'est le prompt simple qui a servi. À refaire avec une clé valide.
