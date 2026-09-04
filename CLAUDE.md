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

**`talent-perle-site/` a été ajouté le 31 août 2026** à partir de maquettes fournies par l'utilisateur (page d'accueil déjà finalisée avec formulaire d'inscription en modal). Le site est autonome : pas de fonction Netlify, l'inscription passe par **EmailJS** (client-side) avec repli `mailto:` si EmailJS n'est pas configuré, et le paiement se fait par virement Interac manuel vers `contact.talent.perle@gmail.com`. Des maquettes d'exploration (3 concepts de mise en page, 3 variantes de style) ont été fournies mais **pas commitées** — `index.html` est déjà la version retenue/synthétisée.

**4 septembre 2026** : le site Netlify existait déjà (créé automatiquement par Netlify avec un nom générique lors de la connexion du repo, base directory `talent-perle-site` déjà configurée) mais n'était pas documenté — renommé `talent-perle` (talent-perle.netlify.app), dans le même compte/équipe Netlify que les autres sites du repo mais en tant que projet indépendant (aucun partage de code/config/domaine). **Reste à faire côté utilisateur/Karim** : (1) créer un compte EmailJS gratuit, ajouter un service (Gmail `contact.talent.perle@gmail.com`) + **deux** templates — `templateId` (coller `talent-perle-site/courriel-confirmation.html`, envoyé au parent) et `adminTemplateId` (coller `talent-perle-site/courriel-notification-admin.html`, envoyé à Karim, "To email" fixé à `contact.talent.perle@gmail.com` et "Reply To" = `{{reply_to}}`) — et reporter les identifiants dans le bloc `TP_EMAIL` en bas de `talent-perle-site/index.html` ; (2) choisir/acheter un nom de domaine personnalisé si désiré (Netlify → talent-perle → Domain settings).

**1er septembre 2026** : ajout du template `courriel-notification-admin.html` et de `TP_EMAIL.adminTemplateId`. Avant ce correctif, une fois EmailJS configuré, seul le parent recevait une confirmation — Karim ne recevait plus jamais l'inscription (le repli `mailto:` qui le notifiait était court-circuité dès que `TP_EMAIL` était rempli). Maintenant les deux courriels sont envoyés à chaque inscription.

**4 septembre 2026** : essai de simplifier le flux à un seul courriel (Karim seulement, répondant lui-même au parent) — revenu en arrière le jour même à la demande de l'utilisateur. Le flux à deux courriels automatiques (confirmation au parent + notification à Karim) est donc l'état définitif actuel ; ne pas re-simplifier sans redemander confirmation.

**Pas de dashboard pour Talent Perlé (décision assumée)** : contrairement aux autres sites, il n'y a pas de backend (Notion/Supabase) derrière les inscriptions — EmailJS envoie juste un courriel à Karim, rien n'est stocké de façon interrogeable. C'est un choix confirmé par l'utilisateur (pas un manque) : Karim gère les inscriptions depuis sa boîte courriel. Si un dashboard devient nécessaire un jour, il faudra d'abord choisir un backend (Supabase dédié, Google Sheets ou Airtable ont été proposés).

**`gravity-admin-dashboard/` et `gravity-basketball-mtl/` ont été importés le 31 août 2026** (PR #16) : ils étaient déployés en drag & drop sur Netlify, sans dépôt Git, donc impossibles à modifier par PR. Le contenu a été rapatrié tel quel depuis les sites en ligne. **Ils ne se déploient pas encore automatiquement** — il faut que l'utilisateur relie chaque site Netlify au repo (Site settings → Build & deploy → Link site to Git → repo `gravitymega/coachyass`, base directory = nom du dossier, publish directory = `.`). Une fois relié, ça fonctionne comme les 3 autres sites.

## Backends

- **Notion** : les réservations Gravity Coaching et Gravity Pickup passent par des fonctions Netlify (`netlify/functions/reservation.js` et `gravity-pickup-site/netlify/functions/reservation-gravity-pickup.js`) qui écrivent dans des bases Notion. Gravity Pickup limite à 15 places/date (`CAPACITE_MAX`) et expose aussi un `GET` sur la même fonction pour lire les compteurs de places (`?dates=iso1,iso2`).
- **Supabase** (projet `aevoulzotvmnrnclfuek`, région ca-central-1, compte `ballerz1514@gmail.com`) : backend du Dashboard admin ET de `gravity-basketball-mtl`. Clé publique "anon" utilisée côté client (protégée par RLS — lecture publique OK, écriture réservée aux admins connectés) : `sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z`.
  - Tables clés : `sites` (config par site : booking_suspended, message), `partners` (site nullable = "tous les sites"), `photo_gallery`, `instagram_carousel` (site historique `gravity-basketball-mtl`), `teams` + `players` (équipes/joueurs, site `gravity-basketball` uniquement pour l'instant), `programs`, `bookings`, `reviews`, `available_slots`, `championship_*`, `finance_entries`.
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
