## Sites dans ce repo

| Dossier | Site Netlify | URL publique | Rôle |
|---|---|---|---|
| `/` (racine) | `gravity-coaching` | coaching.osmm-mtl.site | Réservation Gravity Coaching (privé) |
| `gravity-pickup-site/` | `gravity-pickup` | pickup.osmm-mtl.site | **Fermé le 30 septembre 2026** — ancienne réservation Gravity Pickup, remplacée par une page « Programme terminé » |
| `osmm-montreal/` | `osmm-montreal` | osmm-mtl.site | Site vitrine OSMM (organisme communautaire) |
| `gravity-admin-dashboard/` | `gravity-admin-dashboard` | gravity-admin-dashboard.netlify.app | Dashboard admin (Supabase) — gère équipes, partenaires, galerie, réservations, championnat, etc. |
| `gravity-basketball-mtl/` | `gravity-basketball-mtl` | gravity.osmm-mtl.site | Site public "Gravity Basketball Montréal" — hub avec Mes équipes, Championnat, Vidéos, Partenaires, Programmes |
| `talent-perle-site/` | `talent-perle` | talent-perle.netlify.app | Site vitrine + inscriptions "Talent Perlé" — club communautaire sport & culture (Saint-Léonard) de Karim, un ami de l'utilisateur, **hors écosystème Gravity/OSMM** (pas de domaine `osmm-mtl.site`, pas de backend Notion/Supabase partagé). |
| `talent-perle-dashboard/` | `talent-perle-dashboard` (à créer/relier) | talent-perle-dashboard.netlify.app (à confirmer) | Tableau de bord autonome pour Karim (activités, photos, événements, partenaires) — voir section dédiée plus bas. |
| `art-craft/` | `art-craft-gravity` (Netlify, plus mis à jour) + Worker Cloudflare **`coachyass`** (contient seulement Art craft) | art-craft-gravity.netlify.app / **coachyass.moqtad6.workers.dev** (adresse actuelle) | **Art craft** : Highlight Agent, éditeur vidéo, studio son, studio beat, studio voix (voix gratuites Piper) et studio image, avec modèle de marque Gravity (outil interne Gravity) — voir section dédiée plus bas. |

**`talent-perle-site/` a été ajouté le 31 août 2026** à partir de maquettes fournies par l'utilisateur (page d'accueil déjà finalisée avec formulaire d'inscription en modal). Le site est autonome, pas de backend/dashboard. Des maquettes d'exploration (3 concepts de mise en page, 3 variantes de style) ont été fournies mais **pas commitées** — `index.html` est déjà la version retenue/synthétisée.

**4 septembre 2026** : le site Netlify existait déjà (créé automatiquement par Netlify avec un nom générique lors de la connexion du repo, base directory `talent-perle-site` déjà configurée) mais n'était pas documenté — renommé `talent-perle` (talent-perle.netlify.app), dans le même compte/équipe Netlify que les autres sites du repo mais en tant que projet indépendant (aucun partage de code/config/domaine).

**12 septembre 2026 : remplacement d'EmailJS par Netlify Forms (état actuel).** L'inscription passait auparavant par EmailJS (deux templates : confirmation auto au parent + notification à Karim), mais la mise en place (compte, connexion Gmail, deux templates, 4 identifiants) a été jugée trop lourde par l'utilisateur. Remplacé par **Netlify Forms**, natif à l'hébergeur, zéro compte externe : le formulaire (`talent-perle-site/index.html`) soumet en JS (`fetch` vers `/`, avec repli `mailto:` si la requête échoue) vers un formulaire statique caché nommé `inscription-talent-perle` que Netlify détecte à la publication. Les templates `courriel-confirmation.html` et `courriel-notification-admin.html` ont été supprimés (plus utilisés). Fonctionnalité "Forms" activée côté API sur le site `talent-perle`.

Compromis assumé (choisi explicitement par l'utilisateur après lui avoir présenté l'alternative) : **il n'y a plus de confirmation automatique envoyée au parent** — Karim reçoit seulement la notification de Netlify et doit répondre lui-même au parent pour confirmer. C'est le même compromis qu'un essai de simplification EmailJS du 4 septembre qui avait été annulé sur le moment — cette fois-ci le choix est délibéré (fait pour simplifier l'infrastructure, pas juste le flux de courriel), donc ne pas revenir en arrière sans redemander confirmation.

**Notification courriel configurée le 13 septembre 2026** (fait par l'utilisateur dans Netlify : Site settings → Forms → Form notifications → Add notification → Email → `contact.talent.perle@gmail.com`, formulaire "Any form"). Le site a aussi eu un blocage temporaire de déploiement le même jour (compte Netlify "coach yass" à court de crédits opérationnels, déploiements de production en pause) — résolu depuis, le site sert bien la version Netlify Forms.

**14 septembre 2026 : copie optionnelle des inscriptions dans un Google Sheet du Drive de Karim.** En plus de Netlify Forms (qui reste la source de vérité + la notification courriel), le formulaire peut aussi envoyer chaque inscription dans un Google Sheet, via un petit script Google Apps Script (`talent-perle-site/google-apps-script-inscriptions.gs`, à coller une fois par Karim dans un Sheet de son Drive puis déployer comme application web). L'URL du déploiement va dans `TP_SHEET_URL` en haut du deuxième `<script>` de `talent-perle-site/index.html` (vide par défaut = fonctionnalité désactivée, aucun impact si non configurée). Choisi plutôt que Zapier pour rester sans compte tiers, cohérent avec le choix Netlify Forms du 12 septembre.

**Les inscriptions elles-mêmes restent sans dashboard** : contrairement aux autres sites, il n'y a pas de backend (Notion/Supabase) derrière les *inscriptions*. Elles sont stockées dans Netlify Forms (onglet Forms du site `talent-perle`) et, si `TP_SHEET_URL` est configuré, dupliquées dans un Google Sheet du Drive de Karim. Ce choix (pas un manque) reste inchangé — voir la section "Dashboard Talent Perlé" ci-dessous pour ce qui, en revanche, est maintenant géré par un vrai backend (activités, photos, événements, partenaires — pas les inscriptions).

## Refonte du site Gravity Basketball (25 novembre 2026)

Demande : « fais le tour de mes sites Gravity Basketball, modernise le design, rajoute des vidéos et des photos, bien pro et clair, avec une bonne taille de police ». Le travail porte sur `gravity-basketball-mtl/` (gravity.osmm-mtl.site).
- **Style** : une couche « REFONTE NOVEMBRE 2026 » est ajoutée à la fin de `styles.css`. Elle reprend les mêmes classes et les mêmes ids, donc `script.js`, les formulaires, l'Espace Joueurs et la boutique ne changent pas. Le texte passe à 17 px sur téléphone et 18 px sur ordinateur (tout ce qui est en rem suit). Les titres sont plus grands (`clamp`), la colonne fait 1160 px et les lignes de texte au plus 68 caractères. Boutons en pilule, cartes arrondies. Les sections apparaissent en douceur, sauf si l'appareil demande moins d'animations.
- **Accueil** (`index.html`) :
  - Grande bannière plein écran avec une photo ou une vidéo derrière le titre. Sans média, elle montre un terrain dessiné en SVG.
  - Une bande de 4 chiffres clés.
  - « Qui sommes-nous » en deux colonnes, avec une photo.
  - Les programmes en grille de cartes, avec le titre dans la carte. Le logo répété 5 fois est retiré.
  - Nouvelle section « La ligue en photos » (grille, grande photo en tête, agrandissement au clic avec flèches et Échap).
  - Pied de page en 4 colonnes.
  - Menu raccourci (7 liens + bouton « S'inscrire »). Sous 1360 px de large, il passe dans un panneau avec un bouton ☰.
- **Médias** (`site-ui.js`, lecture publique Supabase, site `gravity-basketball-mtl`) :
  - Photos : Dashboard → **Galerie photos**. La 1re photo va dans la bannière, la 2e dans « Qui sommes-nous », et la galerie en montre 1, 5, 9 ou 13 (rangées pleines).
  - Vidéo de la bannière : la 1re vidéo **téléversée** (champ `video_url`) de Dashboard → Galerie vidéo. Elle joue en boucle, sans le son. Pas de vidéo si l'appareil demande moins d'animations ou économise les données. Si la vidéo ne démarre pas, la bannière montre la photo à la place.
  - Les vidéos Instagram restent dans la section « Les matchs en vidéo ».
- `boutique.html` et `ligue-3x3-dimanche.html` profitent du nouveau style (taille du texte, boutons, couleurs), sans changement de contenu.
- **Testé** dans Chromium à 390, 1180, 1280, 1360, 1366 et 1440 px : pas de défilement horizontal, menu mobile qui s'ouvre et se ferme, 6 photos et une vidéo simulées (bannière, galerie, agrandissement, photo de « Qui sommes-nous »), vidéo remplacée par la photo quand l'appareil demande moins d'animations. **Le site n'a pas encore de vraies photos** : il faut en ajouter dans le Dashboard pour que la bannière et la galerie se remplissent.

### Suite du 25 novembre 2026 : chaîne YouTube et Zeffy retiré
- **Chaîne YouTube** : nouvelle fonction `gravity-admin-dashboard/netlify/functions/youtube.js`. Elle lit le flux RSS public de la chaîne, gratuitement et sans clé. Pour choisir la chaîne : variable Netlify `YOUTUBE_CHANNEL` (`UC…` ou `@pseudo`) ou constante `DEFAULT_CHANNEL`. Le @pseudo est converti en identifiant à partir de la page de la chaîne, et la réponse est gardée en cache 30 min. Sur le site, le bloc en haut de « Les matchs en vidéo » montre un grand lecteur et 8 vignettes, avec un bouton « S'abonner » (`?sub_confirmation=1`). La vidéo ne se charge qu'au clic (youtube-nocookie). Si la chaîne n'est pas configurée, la section reste cachée. **La chaîne de l'utilisateur n'est pas encore configurée : lien à demander.**
- **Zeffy retiré de partout** : sur le site Gravity, plus de choix Zeffy dans le formulaire (Interac seulement, champ caché `mode_paiement = Interac`) ; les boutons d'équipe mènent au formulaire ; même chose dans la boutique et sur la page de la Ligue 3x3. Le site Coaching (racine) n'a plus le bouton Zeffy du Vendredi Coaching (il mène au formulaire, paiement Interac). Les courriels de `gravity-mailer` donnent seulement l'Interac. Dans le Dashboard, les champs « lien Zeffy » sont cachés (colonnes `zeffy_url` gardées dans Supabase) et la colonne Zeffy des équipes est retirée. Les deux fonctions webhook Zeffy sont supprimées (voir `zeffy-gravity-prep.md`).

### Photos du site (25 novembre 2026)
- Recherche de photos sur le serveur (demande « choisis une panoplie cohérente et nette ») : **Supabase n'a aucune photo de match**. `photo_gallery` est vide, les affiches d'équipes aussi. Le bucket `gravity-media` ne contient que `boutique/` (4 visuels de merch, 1080 px). Les autres buckets ne se listent pas. Les rushes de `documentaire/` sont interdits sur les sites (règle du 26 oct.).
- Le flux Instagram du Dashboard (`instagram?action=feed`) ne marche pas : `META_PAGE_ACCESS_TOKEN` manque dans les variables Netlify de `gravity-admin-dashboard`.
- Ajout : section « Porte les couleurs Gravity » sur l'accueil (`#merch`), avec les 4 visuels de la boutique, liens vers `boutique.html`.
- Environnement cloud `coachyass` créé pour ce dépôt (Supabase + gravity-admin-dashboard.netlify.app autorisés).
