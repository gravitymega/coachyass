# Coachyass / Gravity Basketball — contexte projet

Ce repo (`gravitymega/coachyass`) héberge plusieurs sites statiques déployés séparément sur Netlify, tous sous le domaine `osmm-mtl.site` (sauf le Dashboard). Chaque site = un sous-dossier avec son propre `netlify.toml` (`publish = "."`).

## Sites dans ce repo

| Dossier | Site Netlify | URL publique | Rôle |
|---|---|---|---|
| `/` (racine) | `gravity-coaching` | coaching.osmm-mtl.site | Réservation Gravity Coaching (privé) |
| `gravity-pickup-site/` | `gravity-pickup` | pickup.osmm-mtl.site | Réservation Gravity Pickup (places limitées à 15/date) |
| `osmm-montreal/` | `osmm-montreal` | osmm-mtl.site | Site vitrine OSMM (organisme communautaire) |
| `gravity-admin-dashboard/` | `gravity-admin-dashboard` | gravity-admin-dashboard.netlify.app | Dashboard admin (Supabase) — gère équipes, partenaires, galerie, réservations, championnat, etc. |
| `gravity-basketball-mtl/` | `gravity-basketball-mtl` | gravity.osmm-mtl.site | Site public "Gravity Basketball Montréal" — hub avec Mes équipes, Championnat, Vidéos, Partenaires, Programmes |
| `talent-perle-site/` | `talent-perle` | talent-perle.netlify.app | Site vitrine + inscriptions "Talent Perlé" — club communautaire sport & culture (Saint-Léonard) de Karim, un ami de l'utilisateur, **hors écosystème Gravity/OSMM** (pas de domaine `osmm-mtl.site`, pas de backend Notion/Supabase partagé). |

**`talent-perle-site/` a été ajouté le 31 août 2026** à partir de maquettes fournies par l'utilisateur (page d'accueil déjà finalisée avec formulaire d'inscription en modal). Le site est autonome, pas de backend/dashboard. Des maquettes d'exploration (3 concepts de mise en page, 3 variantes de style) ont été fournies mais **pas commitées** — `index.html` est déjà la version retenue/synthétisée.

**4 septembre 2026** : le site Netlify existait déjà (créé automatiquement par Netlify avec un nom générique lors de la connexion du repo, base directory `talent-perle-site` déjà configurée) mais n'était pas documenté — renommé `talent-perle` (talent-perle.netlify.app), dans le même compte/équipe Netlify que les autres sites du repo mais en tant que projet indépendant (aucun partage de code/config/domaine).

**12 septembre 2026 : remplacement d'EmailJS par Netlify Forms (état actuel).** L'inscription passait auparavant par EmailJS (deux templates : confirmation auto au parent + notification à Karim), mais la mise en place (compte, connexion Gmail, deux templates, 4 identifiants) a été jugée trop lourde par l'utilisateur. Remplacé par **Netlify Forms**, natif à l'hébergeur, zéro compte externe : le formulaire (`talent-perle-site/index.html`) soumet en JS (`fetch` vers `/`, avec repli `mailto:` si la requête échoue) vers un formulaire statique caché nommé `inscription-talent-perle` que Netlify détecte à la publication. Les templates `courriel-confirmation.html` et `courriel-notification-admin.html` ont été supprimés (plus utilisés). Fonctionnalité "Forms" activée côté API sur le site `talent-perle`.

Compromis assumé (choisi explicitement par l'utilisateur après lui avoir présenté l'alternative) : **il n'y a plus de confirmation automatique envoyée au parent** — Karim reçoit seulement la notification de Netlify et doit répondre lui-même au parent pour confirmer. C'est le même compromis qu'un essai de simplification EmailJS du 4 septembre qui avait été annulé sur le moment — cette fois-ci le choix est délibéré (fait pour simplifier l'infrastructure, pas juste le flux de courriel), donc ne pas revenir en arrière sans redemander confirmation.

**Notification courriel configurée le 13 septembre 2026** (fait par l'utilisateur dans Netlify : Site settings → Forms → Form notifications → Add notification → Email → `contact.talent.perle@gmail.com`, formulaire "Any form"). Le site a aussi eu un blocage temporaire de déploiement le même jour (compte Netlify "coach yass" à court de crédits opérationnels, déploiements de production en pause) — résolu depuis, le site sert bien la version Netlify Forms.

**14 septembre 2026 : copie optionnelle des inscriptions dans un Google Sheet du Drive de Karim.** En plus de Netlify Forms (qui reste la source de vérité + la notification courriel), le formulaire peut aussi envoyer chaque inscription dans un Google Sheet, via un petit script Google Apps Script (`talent-perle-site/google-apps-script-inscriptions.gs`, à coller une fois par Karim dans un Sheet de son Drive puis déployer comme application web). L'URL du déploiement va dans `TP_SHEET_URL` en haut du deuxième `<script>` de `talent-perle-site/index.html` (vide par défaut = fonctionnalité désactivée, aucun impact si non configurée). Choisi plutôt que Zapier pour rester sans compte tiers, cohérent avec le choix Netlify Forms du 12 septembre.

**Pas de dashboard pour Talent Perlé (décision assumée)** : contrairement aux autres sites, il n'y a pas de backend (Notion/Supabase) derrière les inscriptions. Les soumissions sont stockées dans Netlify Forms (onglet Forms du site `talent-perle`, consultable/exportable depuis le tableau de bord Netlify) et, si `TP_SHEET_URL` est configuré, dupliquées dans un Google Sheet du Drive de Karim — mais rien n'est branché à une interface interrogeable côté produit. C'est un choix confirmé par l'utilisateur (pas un manque). Si un dashboard devient nécessaire un jour, il faudra d'abord choisir un backend (Supabase dédié ou Airtable ont aussi été proposés).

**`gravity-admin-dashboard/` et `gravity-basketball-mtl/` ont été importés le 31 août 2026** (PR #16) : ils étaient déployés en drag & drop sur Netlify, sans dépôt Git, donc impossibles à modifier par PR. Le contenu a été rapatrié tel quel depuis les sites en ligne. **Ils ne se déploient pas encore automatiquement** — il faut que l'utilisateur relie chaque site Netlify au repo (Site settings → Build & deploy → Link site to Git → repo `gravitymega/coachyass`, base directory = nom du dossier, publish directory = `.`). Une fois relié, ça fonctionne comme les 3 autres sites.

## Backends

- **Notion** : les réservations Gravity Coaching et Gravity Pickup passent par des fonctions Netlify (`netlify/functions/reservation.js` et `gravity-pickup-site/netlify/functions/reservation-gravity-pickup.js`) qui écrivent dans des bases Notion dédiées (« Réservations — Coach Yass », « Réservations — Gravity Pickup »). Gravity Pickup limite à 15 places/date (`CAPACITE_MAX`) et expose aussi un `GET` sur la même fonction pour lire les compteurs de places (`?dates=iso1,iso2`). Voir aussi « Inscription GRAV » ci-dessous.
- **`gravity-mailer/`** : site Netlify séparé sans page publique, service central partagé par Coaching/Pickup/Gravity Basketball/OSMM. Expose deux fonctions Netlify, toutes deux protégées par la même clé partagée `MAILER_SHARED_KEY` (en-tête `x-mailer-key`, valeur codée en dur côté client dans chaque site — ce n'est pas un vrai secret, juste un filtre anti-abus) : `send-confirmation.js` (courriels via **Resend**, `RESEND_API_KEY`) et `save-inscription.js` (écrit dans Notion, voir « Inscription GRAV »).
- **FormSubmit** : en plus de Notion/Supabase, chaque formulaire (Coaching, Pickup, OSMM membre/contact) envoie **aussi** un courriel direct à `moqtad6@gmail.com` via `https://formsubmit.co/ajax/...` (appelé en parallèle, indépendant de Notion/gravity-mailer). C'est le seul canal qui notifie l'admin par courriel pour ces sites-là. Les soumissions y sont aussi archivées automatiquement en sous-pages Notion sous « 📩 Formsubmit — Notifications » (vérification horaire, tâche externe à ce repo).
- **Supabase** (projet `aevoulzotvmnrnclfuek`, région ca-central-1, compte `ballerz1514@gmail.com`) : backend du Dashboard admin ET de `gravity-basketball-mtl`. Clé publique "anon" utilisée côté client (protégée par RLS — lecture publique OK, écriture réservée aux admins connectés) : `sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z`.
  - Tables clés : `sites` (config par site : booking_suspended, message), `partners` (site nullable = "tous les sites"), `photo_gallery`, `instagram_carousel` (site historique `gravity-basketball-mtl`), `teams` + `players` (équipes/joueurs, site `gravity-basketball` uniquement pour l'instant), `programs`, `bookings`, `reviews`, `available_slots`, `championship_*`, `finance_entries`, `team_games`, `team_trainings`, `announcements`, `player_documents` (voir "Espace Joueurs" ci-dessous).
  - Slugs de site utilisés dans Supabase : `coachyass`, `basketlibre` (= Gravity Pickup), `gravity-basketball` (équipes/programmes/partenaires), `gravity-basketball-mtl` (galerie photo/vidéos Instagram — incohérence historique de nommage à noter). **`osmm` n'est pas encore un slug supporté dans le Dashboard** (menus déroulants codés en dur dans `gravity-admin-dashboard/app.js`, variable `SITES`) — un partenaire avec `site = null` s'affiche quand même partout, y compris sur OSMM.
  - OSMM, Coaching et Pickup lisent en direct (lecture seule, `supabase-js` via `esm.sh`) la table `partners` (+ `photo_gallery` pour OSMM) — voir les `<script type="module">` en fin de fichier de chaque `index.html`.

## Historique des demandes (liste initiale du 31 août 2026)

1. ✅ Compteur de places pickup (X/15) avant réservation — fait
2. ✅ Regrouper les équipes sous un onglet — déjà existant sur `gravity-basketball-mtl`, rien à construire
3. ✅ Galerie photo panoramique OSMM — structure créée + branchée sur `photo_gallery` (vide, en attente de photos)
4. ✅ Vidéos Instagram enlevées — 6 lignes supprimées de `instagram_carousel` (site `gravity-basketball-mtl`)
5. ✅ Description d'équipe : champ éditable ajouté au formulaire équipe (`gravity-admin-dashboard/app.js` + `index.html`, textarea `#team-description`), affiché via `teamCardHtml()` dans `gravity-basketball-mtl/script.js` (classe CSS `.team-description`). La colonne `description` existait déjà côté Supabase.
6. ✅ Mercredi retiré des créneaux Gravity Pickup
7. ✅ Système d'affiliation revu (Coaching/Pickup n'avaient aucune section partenaires ; OSMM avait un lien texte non cliquable) — harmonisé sur les 3
8. ✅ Logos partenaires cliquables — fait pour Gravity Basketball (seul partenaire réel), branché sur Supabase pour les futurs ajouts
9. ✅ `osmm` ajouté à `SITE_LABELS` dans `gravity-admin-dashboard/app.js` et au sélecteur de site de la galerie photo (`#photo-gallery-site`). Le sélecteur de partenaires (`#partner-site`) est peuplé dynamiquement depuis `currentAdmin.sites` (colonne `admin_users.sites` — c'est un `text[]`, pas du `jsonb`) : `"osmm"` a été ajouté à ce tableau pour le compte admin Yassine (`id = 871b01c9-92ac-4ec7-b4f4-a17293b64add`) via `array_append`. Le Dashboard gère maintenant OSMM comme les autres sites.

**PR mergées le 31 août 2026** : #15 (points 1, 3, 4, 6, 7, 8) et #16 (import des 2 sites, point 5/9 préparatoire).

**Points 5 et 9 traités le 31 août 2026** (PR #17, une fois `gravity-admin-dashboard` et `gravity-basketball-mtl` reliés à Git dans Netlify par l'utilisateur). Il ne reste que la requête SQL ci-dessus à exécuter manuellement pour finaliser le point 9.

## Espace Joueurs (ajouté le 12 septembre 2026)

Nouvelle section "Espace Joueurs" sur `gravity-basketball-mtl` (`#espace-joueurs` dans le menu) : chaque joueur (pas seulement Gravity Prep — tous les joueurs de la table `players`) peut se connecter à un compte perso pour voir ses documents, ses statistiques, le calendrier des matchs (saison + playoffs) et des entraînements (date/heure/adresse avec carte Google Maps intégrée, sans clé API), et les communiqués de son équipe. C'est **moi (l'admin)** qui crée l'accès après avoir traité l'inscription/ajout du joueur — pas d'auto-inscription.

- **Auth joueur** : Supabase Auth (courriel + mot de passe), sans le SDK `supabase-js` (le site public n'en importe pas ailleurs) — `gravity-basketball-mtl/script.js` appelle directement les endpoints REST `auth/v1/token`, `auth/v1/user`, `rest/v1/*` et `storage/v1/object/sign/*` avec la clé anon + le jeton du joueur, et gère lui-même le refresh du token (stocké dans `localStorage`).
- **Création du compte** : bouton "Créer un accès" dans `gravity-admin-dashboard` (groupe "Espace Joueurs" → "Comptes joueurs"), qui appelle la nouvelle fonction Netlify `gravity-admin-dashboard/netlify/functions/create-player-account.js`. Cette fonction a besoin de la variable d'environnement Netlify **`SUPABASE_SERVICE_ROLE_KEY`** (clé service_role du projet Supabase, jamais exposée côté client) — **à ajouter par l'utilisateur** dans Site settings → Environment variables du site `gravity-admin-dashboard` sur Netlify, sans quoi le bouton renverra une erreur. Le mot de passe temporaire généré n'est affiché qu'une fois à l'admin (à communiquer au joueur).
- **Nouvelles tables Supabase** : `team_games` (matchs, par équipe), `team_trainings` (entraînements, par équipe), `announcements` (communiqués, par équipe ou globaux au site), `player_documents` (métadonnées des documents, fichiers dans le bucket privé `player-documents`). Colonnes ajoutées à `players` : `auth_user_id` (lien vers `auth.users`) et `email`. Toutes protégées par RLS : l'admin gère tout (via `admin_users.sites`), le joueur ne voit que ses propres données (`auth_user_id = auth.uid()` ou via son `team_id`).
- **Documents** : bucket Storage privé `player-documents` (pas public), organisé en `<player_id>/<fichier>` — le joueur obtient une URL signée (1h) à la demande, l'admin téléverse depuis le Dashboard.
- Gestion complète (matchs, entraînements, communiqués, documents, création de comptes) dans `gravity-admin-dashboard` (nouveau groupe de menu "Espace Joueurs", visible comme "Mes équipes" uniquement si l'admin a accès à `gravity-basketball`).

**"Système Player" (12 septembre 2026, suite)** — nom de code interne pour cette fonctionnalité (Espace Joueurs + fiche joueur), à utiliser entre l'utilisateur et Claude pour s'y référer sans tout réexpliquer. Deux ajouts pour éviter que les joueurs/parents remplissent plusieurs formulaires et que l'admin retape l'information :
- Le formulaire "Mes équipes — Joueurs" (`gravity-admin-dashboard`) est désormais **le seul formulaire admin** pour la fiche d'un joueur : il regroupe photo, âge/catégorie d'âge (`players.age_category`), poste, numéro, stats de saison, Instagram et courriel (`players.email`, utilisé directement par "Créer un accès" dans Comptes joueurs — le prompt() manuel ne sert plus que de repli si le courriel n'a pas été saisi ici).
- Bouton **"Créer la fiche joueur"** sur chaque réservation Gravity Basketball dans l'onglet Réservations : pré-remplit ce même formulaire (nom, âge/catégorie, poste, courriel) à partir des données déjà saisies par le joueur/parent dans le formulaire d'inscription public — l'admin n'a plus qu'à choisir l'équipe, le numéro et la photo, jamais à retaper le reste.
- Bouton **"Partager la fiche"** sur chaque joueur de "Mes équipes — Joueurs" : génère une image (canvas, même style que le partage Instagram déjà existant sur `gravity-basketball-mtl`) avec photo, nom, âge, poste, numéro et stats de saison, prête à partager (Web Share API) ou télécharger — logo tiré de `gravity.osmm-mtl.site/assets/logo.png`.

## Inscription GRAV — base Notion unifiée (12 septembre 2026)

Avant cet ajout, les inscriptions étaient éparpillées : Coaching et Pickup dans deux bases Notion séparées, Gravity Basketball (Ligue 3v3, Ligue Maison, U15 Masculin, Gravity Prep) uniquement dans Supabase (table `bookings`, visible dans le Dashboard), OSMM nulle part. L'utilisateur a demandé un seul endroit Notion pour tout regrouper (sauf Talent Perlé, hors écosystème), filtrable par programme/équipe.

- **Nouvelle base Notion « 🏀 Inscription GRAV »** (propriétés clés : `Programme` — select à 7 valeurs : Coach Yass, Gravity Pickup, Ligue 3v3, Ligue Maison, Gravity U15 Masculin, Gravity Prep, OSMM — `Équipe`, `Email`, `Téléphone`, `Date séance`, `Forfait / Type`, `Montant`, `Payé`, `Statut`, `Remarque`, `Détails` en texte libre pour les champs spécifiques à un programme comme les mensurations Gravity Prep). Deux vues supplémentaires : « Par programme » (groupée) et « Par équipe » (groupée). Page de navigation rapide : « 📋 Inscriptions — Vue d'ensemble ».
- **Nouvelle fonction Netlify partagée `gravity-mailer/netlify/functions/save-inscription.js`** : reçoit un POST (même auth `x-mailer-key` que `send-confirmation.js`) et crée une page dans « Inscription GRAV ». A besoin de **`NOTION_TOKEN`** et **`NOTION_DB_INSCRIPTION_GRAV`** dans les variables d'environnement Netlify du site `gravity-mailer` — **à ajouter par l'utilisateur** (copier le même `NOTION_TOKEN` que sur les sites `gravity-coaching`/`gravity-pickup` ; `NOTION_DB_INSCRIPTION_GRAV` = `792ca7f50be34f6fbe1f6d3d2b989d69`), sinon les écritures échouent silencieusement (appel `fetch(...).catch(() => {})`, jamais bloquant pour le visiteur).
- **Chaque site continue d'écrire dans son système existant** (Notion dédié pour Coaching/Pickup, Supabase pour Gravity Basketball) — l'appel à `save-inscription` est **additif**, en parallèle, jamais remplaçant : aucun risque de régression sur les flux de réservation/paiement existants.
- **Sites branchés** : `index.html` (Coaching), `gravity-pickup-site/index.html` (Pickup), `gravity-basketball-mtl/script.js` (tous les programmes), `osmm-montreal/index.html` (uniquement le formulaire « Devenir membre », pas le formulaire Contact — ce n'est pas une inscription). Talent Perlé n'est délibérément pas branché.

## Bug découvert : gravity-mailer (Resend) ne livre qu'à un seul destinataire (13 septembre 2026)

**Symptôme** : l'utilisateur ne recevait jamais la notification admin Gravity Prep (`type: 'basketball-mtl-prep-admin'`, envoyée à `Gravitybasketball@gmail.com`), alors que le code existait déjà (PR #32).

**Cause confirmée par test direct** (`curl` sur la fonction en production) : `gravity-mailer` n'a pas de variable `MAILER_FROM_EMAIL` configurée, donc `send-confirmation.js` envoie depuis le domaine de test Resend `onboarding@resend.dev`. **Resend restreint ce domaine à un seul destinataire : l'adresse du compte Resend lui-même** (`moqtad6@gmail.com`) — tout envoi vers une autre adresse échoue silencieusement (502, jamais vu par le visiteur grâce au `.catch(() => {})`). Confirmé par test comparatif : envoi vers `moqtad6@gmail.com` → succès ; envoi vers `Gravitybasketball@gmail.com` → échec.

**Portée réelle du bug** : ça ne touche pas que la notification Prep — **toutes les confirmations clients envoyées par `gravity-mailer`** (Coaching, Pickup, Basketball, OSMM), qui vont vers l'adresse du visiteur, échouent probablement aussi silencieusement pour n'importe quel vrai client. Personne ne l'avait remarqué puisque rien ne bloque le visiteur.

**Correctif définitif (en cours, nécessite l'utilisateur)** : vérifier un sous-domaine d'envoi dans Resend (ex. `mail.osmm-mtl.site`), ajouter les enregistrements DNS générés par Resend chez le registrar du domaine (pas accessible par Claude), puis configurer `MAILER_FROM_EMAIL` sur `gravity-mailer` une fois le domaine vérifié.

**Correctif immédiat déployé (13 septembre 2026)** : ajout d'un canal FormSubmit (même pattern que Coaching/Pickup/OSMM) dans `gravity-basketball-mtl/script.js`, vers `Gravitybasketball@gmail.com`, pour Ligue 3v3 / Ligue Maison / U15 Masculin uniquement — **pas pour Gravity Prep**, qui garde sa notification dédiée existante (`basketball-mtl-prep-admin`) pour éviter un doublon une fois Resend réparé.

## Suspension de sécurité Resend (13 septembre 2026, état actuel)

En poursuivant la vérification du domaine `mail.osmm-mtl.site` sur Resend (PR #41), une anomalie a été détectée : les enregistrements SPF affichés par Resend pour ce domaine — **et pour un domaine de test flambant neuf, sans lien avec ce projet** — pointaient vers `forge.rmta.net`, l'infrastructure d'un service tiers appelé **« SendBeam »** (`sendbeam.io`), au lieu de l'infrastructure Resend habituelle (`amazonses.com`, confirmé par la documentation officielle Resend). SendBeam est un service réel, pas un logiciel malveillant connu, mais il n'a **aucun lien légitime avec Resend** — sa présence dans les enregistrements DNS suggérés par Resend est inexpliquée (hypothèses non tranchées : extension de navigateur altérant l'affichage de la page Resend, compte Resend compromis, ou autre anomalie côté compte).

**Mesure de précaution appliquée (PR #42, mergée)** : `RESEND_SUSPENDED = true` en tête de `gravity-mailer/netlify/functions/send-confirmation.js` — court-circuite toute requête avant l'appel à `api.resend.com`, retourne un 503 explicite. **Aucun appel à l'API Resend n'est effectué tant que ce flag est actif.** Ne repasser à `false` qu'une fois l'anomalie éclaircie et confirmée réglée par l'utilisateur.

**Conséquence couverte (PR #43, mergée)** : Gravity Prep a maintenant lui aussi un filet FormSubmit (`Gravitybasketball@gmail.com`), en plus de sa notification Resend existante (actuellement muette à cause de la suspension) — il n'y a donc plus de programme sans notification admin pendant la suspension. Doublon assumé une fois Resend réactivé.

**Reste à faire côté utilisateur si on veut un jour élucider l'anomalie Resend** (non bloquant, Resend est abandonné — voir section suivante) :
1. Vérifier la sécurité du compte Resend (mot de passe, connexions récentes, clés API) — envisager de régénérer `RESEND_API_KEY`.
2. Revérifier la page de vérification de domaine Resend depuis un appareil/navigateur de confiance (sans extensions), idéalement en navigation privée, pour confirmer si les valeurs `forge.rmta.net` réapparaissent.
3. Vérifier dans la zone DNS Netlify (`osmm-mtl.site`) qu'aucun enregistrement pointant vers `rmta.net` n'a été ajouté par erreur — supprimer si c'est le cas.
4. Contacter le support Resend si l'anomalie persiste.

## Migration Resend → Brevo (13 septembre 2026)

Plutôt que d'attendre l'élucidation de l'anomalie Resend ci-dessus, l'utilisateur a choisi d'**abandonner Resend et de passer à Brevo** (ex-Sendinblue) pour l'envoi de tous les courriels transactionnels. `RESEND_SUSPENDED` est retiré (devenu inutile, Resend n'est plus appelé nulle part).

**Trois fonctions Netlify migrées** (toutes appelaient directement `api.resend.com`, remplacé par `api.brevo.com/v3/smtp/email`) :
- `gravity-mailer/netlify/functions/send-confirmation.js` — confirmations clients + notification admin Gravity Prep.
- `gravity-admin-dashboard/netlify/functions/notify-espace-joueurs.js` — alertes courriel Espace Joueurs.
- `gravity-admin-dashboard/netlify/functions/send-campaign.js` — envoi de campagnes depuis le Dashboard.

**Différences d'API à retenir** (si une nouvelle fonction envoie un courriel un jour) :
- Header d'authentification : `api-key: <clé>` (pas `Authorization: Bearer`).
- Champ expéditeur : objet `sender: { name, email }` (pas une chaîne `"Nom <adresse>"`).
- Destinataires : `to` / `bcc` sont des tableaux d'objets `{ email }` (pas des chaînes).
- Corps HTML : champ `htmlContent` (pas `html`).
- **Pas de domaine de test** : contrairement à Resend (`onboarding@resend.dev`), Brevo n'autorise aucun envoi sans expéditeur vérifié au préalable (soit une adresse simple confirmée par courriel, soit un domaine complet vérifié par DNS) — sans ça, l'API rejette la requête (pas d'envoi silencieusement dégradé comme avec le domaine de test Resend).

**Variables d'environnement Netlify à configurer par l'utilisateur** (sur les sites `gravity-mailer` ET `gravity-admin-dashboard`, chacun a ses propres variables d'environnement) :
- **`BREVO_API_KEY`** — Brevo → icône profil → SMTP & API → onglet Clés API → générer une nouvelle clé.
- **`MAILER_FROM_EMAIL`** (déjà existante pour `gravity-mailer` depuis l'époque Resend, réutilisée telle quelle) — doit être un expéditeur **vérifié dans Brevo**. Deux options : (1) expéditeur simple (rapide : ajouter l'adresse dans Brevo → Expéditeurs, Domaines & IP dédiées → cliquer le lien de confirmation reçu par courriel → envoi possible vers n'importe quel destinataire, aucun DNS à toucher) ou (2) domaine complet vérifié par DNS (`mail.osmm-mtl.site`, meilleure délivrabilité à terme, même démarche que Resend en son temps).

Tant que `BREVO_API_KEY` ou `MAILER_FROM_EMAIL` (adresse vérifiée) manque, les trois fonctions renvoient une erreur 500 explicite plutôt que d'échouer silencieusement.

## Billet Zeffy Gravity Prep + création automatique de l'accès Espace Joueurs (13 septembre 2026)

Contexte tiré des documents fournis par l'utilisateur (contrat joueur Post-Grad, description de saison, présentation du Circuit Prep U) : Gravity Prep = le programme "Post-Grad" (saison du 1er octobre 2026 au 28 mars 2027, 850 $, payable en un seul versement sur Zeffy — le contrat prévoit un échéancier en 3 versements mais l'utilisateur a choisi un billet Zeffy unique plein tarif plutôt que 3 billets par versement).

**Ce qui a été fait dans ce repo :**
- `gravity-basketball-mtl/documents/contrat-joueur-postgrad-2026-2027.pdf` : le contrat joueur, hébergé publiquement pour pouvoir être lié depuis le billet Zeffy (case à cocher "j'ai lu et j'accepte" au moment du paiement — pas de vraie signature électronique, même logique que la case décharge déjà existante sur le formulaire d'inscription).
- `gravity-admin-dashboard/netlify/functions/zeffy-webhook-prep.js` : nouvelle fonction Netlify qui reçoit les paiements complétés Zeffy (webhook), et **crée directement l'accès Espace Joueurs du joueur dès son premier paiement**, sans attendre que l'admin clique "Créer un accès" dans le Dashboard :
  - Cherche une fiche joueur existante (`players`, `site = 'gravity-basketball'`, `age_category = 'Prep'`) dont le courriel correspond à celui du paiement.
  - Si aucune fiche n'existe encore, en crée une minimale (nom + courriel seulement, tirés du paiement Zeffy — `program: 'equipe'`, `age_category: 'Prep'`) ; l'admin complète ensuite équipe/numéro/photo dans "Mes équipes — Joueurs" comme d'habitude, ça ne bloque pas l'accès du joueur.
  - Crée le compte Supabase Auth + envoie le courriel d'accès (même gabarit `espace-joueurs-access` que la création manuelle) + alerte Gravitybasketball@gmail.com (filet FormSubmit) pour signaler qu'une fiche a été créée automatiquement et reste à compléter.
  - Idempotent : si la fiche a déjà un `auth_user_id`, ne fait rien (évite les doublons sur un retry du webhook ou un paiement répété).
  - **Le format exact du payload envoyé par Zeffy n'a pas pu être vérifié** (accès à `support.zeffy.com` bloqué depuis cet environnement) — l'extraction du courriel/nom fouille le JSON reçu plutôt que de viser des chemins fixes, et un filtre sur le mot "prep" dans le payload ignore les paiements des autres programmes si jamais le webhook Zeffy est réglé au niveau du compte plutôt que par événement. Si un vrai paiement de test ne déclenche pas l'invitation, les logs Netlify de cette fonction affichent le payload brut reçu — à consulter en premier pour ajuster l'extraction.

**Billet créé le 14 septembre 2026** : `https://www.zeffy.com/en-CA/ticketing/gravity-prep-saison-2026--2027`, branché dans `ZEFFY_LINKS['Gravity Prep']` (`gravity-basketball-mtl/script.js`) — un joueur qui choisit "Zeffy" comme mode de paiement pour Gravity Prep est maintenant redirigé vers ce billet au lieu du message "paiement bientôt disponible".

**Reste à faire côté utilisateur :**
1. Vérifier que la case à cocher obligatoire du contrat a bien été ajoutée sur le billet ci-dessus, avec le lien `https://gravity.osmm-mtl.site/documents/contrat-joueur-postgrad-2026-2027.pdf` (disponible une fois le PR #48 mergé/déployé).
2. Dans Zeffy → Settings → Notifications (sur ce billet) : activer une notification par courriel vers `Gravitybasketball@gmail.com`, comme pour Talent Perlé.
3. Dans Zeffy → Settings → Integrations → Webhooks : ajouter un webhook pointant vers `https://gravity-admin-dashboard.netlify.app/.netlify/functions/zeffy-webhook-prep?key=<secret>`.
4. Sur Netlify, site `gravity-admin-dashboard` → variables d'environnement : ajouter **`ZEFFY_PREP_WEBHOOK_SECRET`** (choisir une valeur, la mettre aussi dans l'URL du webhook Zeffy ci-dessus) — `SUPABASE_SERVICE_ROLE_KEY` est déjà requise pour `create-player-account.js`, réutilisée ici.
5. Une fois le billet créé, donner l'URL Zeffy (`zeffy.com/en-CA/ticketing/...`) pour qu'elle soit ajoutée à `ZEFFY_LINKS['Gravity Prep']` dans `gravity-basketball-mtl/script.js` (actuellement absent — un joueur qui choisit "Zeffy" comme mode de paiement pour Gravity Prep voit un message "paiement bientôt disponible").
6. Faire un vrai paiement de test une fois tout branché, et transmettre le contenu des logs Netlify de `zeffy-webhook-prep` si l'invitation ne part pas automatiquement.
