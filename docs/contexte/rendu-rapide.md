## Art craft : rendu rapide du short (Mediabunny, 26 octobre 2026)

Le bouton « Exporter » du Highlight Agent essaie d'abord un **rendu rapide avec WebCodecs** (`art-craft/fast-render.js`). Le navigateur encode en H.264 et en AAC avec la carte graphique, grâce à la librairie **Mediabunny** (MPL-2.0, copiée telle quelle dans `art-craft/vendor/mediabunny/`, version 1.62.1). La librairie n'est chargée qu'au moment de l'export.

- **Même résultat que ffmpeg** (`buildRenderArgs` dans `highlights.js`) :
  - recadrage vertical (`cropX`) ou plein cadre avec fond flou assombri ;
  - zoom progressif (même courbe que `zoomFilter`) ;
  - fondu d'entrée de 0,15 s ;
  - texte et logo par-dessus ;
  - carte de fin de 3 s ;
  - son en stéréo 44,1 kHz avec fondus de 0,1 s et 0,2 s ;
  - débit plafonné par `uploadKbps`.
- **Secours automatique** : si WebCodecs manque, si la vidéo ou le son ne peut pas être décodé, si H.264 ou AAC ne peut pas être encodé, ou en cas d'erreur, `renderFast()` (dans `app.js`) renvoie `null`. On repasse alors au montage ffmpeg.wasm habituel. La console affiche « Rendu rapide impossible ».
- **Testé le 26 octobre 2026** dans Chrome sans fenêtre, avec une source de test 1280×720 H.264/AAC et 2 extraits (dont un avec zoom), plus la carte de fin. En plein cadre comme en recadrage, on obtient 720×1280, 360 images, 12,0 s, et un son AAC de 12,0 s. Les images ont été vérifiées. `wrangler deploy --dry-run` OK.
- Pour plus tard : appliquer le même rendu aux autres modules qui encodent avec ffmpeg.
