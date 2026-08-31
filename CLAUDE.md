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
| `talent-perle-site/` | à créer/relier | à définir | Site vitrine + inscriptions "Talent Perlé" — club communautaire sport & culture (Saint-Léonard) de Karim, un ami de l'utilisateur, **hors écosystème Gravity/OSMM** (pas de domaine `osmm-mtl.site`, pas de backend Notion/Supabase partagé). |

**`talent-perle-site/` a été ajouté le 31 août 2026** à partir de maquettes fournies par l'utilisateur (page d'accueil déjà finalisée avec formulaire d'inscription en modal). Le site est autonome : pas de fonction Netlify, l'inscription passe par **EmailJS** (client-side) avec repli `mailto:` si EmailJS n'est pas configuré, et le paiement se fait par virement Interac manuel vers `contact.talent.perle@gmail.com`. **Reste à faire côté utilisateur/Karim** : (1) créer le site sur Netlify et le relier à ce repo (base directory = `talent-perle-site`, publish = `.`) ; (2) créer un compte EmailJS gratuit, ajouter un service + un template (coller `talent-perle-site/courriel-confirmation.html`) et reporter les 3 identifiants dans le bloc `TP_EMAIL` en bas de `talent-perle-site/index.html` ; (3) choisir/acheter un nom de domaine. Des maquettes d'exploration (3 concepts de mise en page, 3 variantes de style) ont été fournies mais **pas commitées** — `index.html` est déjà la version retenue/synthétisée.

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
5. ⚠️ **Reste à faire** — Description d'équipe : colonne `description` déjà ajoutée à `public.teams` (migration Supabase), mais pas encore éditable ni affichée. Bloqué tant que `gravity-admin-dashboard/` et `gravity-basketball-mtl/` ne sont pas reliés à Git dans Netlify (voir ci-dessus). Une fois relié : ajouter un champ dans `gravity-admin-dashboard/app.js` (formulaire équipe) + afficher dans `teamCardHtml()` de `gravity-basketball-mtl/script.js`.
6. ✅ Mercredi retiré des créneaux Gravity Pickup
7. ✅ Système d'affiliation revu (Coaching/Pickup n'avaient aucune section partenaires ; OSMM avait un lien texte non cliquable) — harmonisé sur les 3
8. ✅ Logos partenaires cliquables — fait pour Gravity Basketball (seul partenaire réel), branché sur Supabase pour les futurs ajouts
9. ⚠️ **Reste à faire** — Dashboard entièrement automatisé : fonctionne déjà pour Coaching/Pickup (partenaires). Pour OSMM, il faut ajouter `osmm` à la variable `SITES` (et aux `<select>` HTML correspondants) dans `gravity-admin-dashboard/app.js` — bloqué par le même relink Netlify que le point 5.

**PR mergées le 31 août 2026** : #15 (points 1, 3, 4, 6, 7, 8) et #16 (import des 2 sites, point 5/9 préparatoire).

**Prochaine étape (côté utilisateur)** : relier `gravity-admin-dashboard` et `gravity-basketball-mtl` à Git dans Netlify. Ensuite, reprendre les points 5 et 9.
