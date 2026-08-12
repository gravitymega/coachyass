---
workflow: general-video
flow: automation
storyboard: yes
message: "Rejoins une communauté de joueurs qui progressent, sur le terrain à Montréal."
destination: instagram-reels
aspect: 1080x1920
language: fr
length: 25s
angle: sizzle-reel
---

## Intent

Vidéo promotionnelle dynamique pour Instagram Reels/Stories, à partir de vrais
clips filmés sur le terrain (pickup / ligue 3x3) fournis par le client, Gravity
Basketball à Montréal. Ton énergique, urbain, authentique — pas corporate.
Structure en 4 beats : accroche, preuve/action (montage rythmé), communauté,
CTA + logo. Coupes rapides calées sur une musique instrumentale street/hip-hop,
texte animé en accent orange sur les mots-clés, voix off IA en français,
wordmark "GRAVITY BASKETBALL — MONTRÉAL" en filigrane permanent + plein écran
à la fin.

## Assets

- assets/clip-league.mov — clip réel #1, gymnase, action de jeu (pickup/ligue), vertical 1080x1920, 13.67s.
- assets/clip-pickup.mov — clip réel #2, gymnase, action de jeu (pickup/ligue), vertical 1080x1920, 35.85s.
- Typographie de marque : Archivo (même police que gravity-pickup-site/index.html et index.html du dépôt coachyass), variable font, graisses larges/bold pour les titres.
- Palette de marque confirmée : fond #050505, accent #FF5C00, texte blanc #FFFFFF.

## Customizations

- Voix off IA en français synchronisée sur les coupes (pas seulement du texte à l'écran).
- Pas de musique de fond intégrée (décision du client le 2026-08-12) : la génération locale (MusicGen) échoue faute d'accès réseau à Hugging Face dans ce sandbox, et le client a choisi de ne pas fournir de piste ni de clé API Gemini. Le client ajoutera une piste tendance directement dans Instagram à la publication. Compensé par des SFX ponctuels (whoosh sur les transitions, impact sur le CTA, sparkle sur le logo) pour garder de l'énergie.
- Logo filigrane discret en permanence à l'écran, wordmark plein écran au générique de fin.
- Texte animé en accent orange (#FF5C00) pour les mots-clés du script.
- Transitions dynamiques type whip pan / zoom / cut sur le rythme — pas de plan statique de plus de 2-3s.

## Notes

- Seulement 2 clips sources, même gymnase/mêmes angles généraux — la variété visuelle vient de recadrages/zooms/vitesse plutôt que de véritables changements de caméra ; à valider au storyboard.
- Pas de segment "coaching" distinct : les deux clips sont traités comme pickup/ligue.
- Pas de @handle Instagram précisé — CTA reste "lien en bio" générique.
- Script fourni par le client (4 beats, timing indicatif) :
  1. Accroche (0-3s) : "Tu veux progresser sur le terrain ?"
  2. Preuve/action (3-15s) : montage rythmé des clips réels, mini-textes identifiant chaque programme
  3. Communauté (15-20s) : "Une communauté de joueurs, à Montréal."
  4. CTA (20-25s) : "Réserve ta place — lien en bio." + logo final
