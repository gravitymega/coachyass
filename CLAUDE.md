# Coachyass / Gravity Basketball — contexte projet

Repo `gravitymega/coachyass` : plusieurs sites statiques déployés séparément sur Netlify (un sous-dossier = un site, chacun avec son `netlify.toml`, `publish = "."`), sous `osmm-mtl.site` sauf indication. Travail par branche + PR, merge sur `main` = mise en ligne.

## Sites

| Dossier | Hébergement | URL | Rôle |
|---|---|---|---|
| `/` (racine) | Netlify `gravity-coaching` | coaching.osmm-mtl.site | Réservation Gravity Coaching (1 séance 30 $, 3 = 80 $, 6 = 150 $ ; Vendredi Coaching sur Zeffy) |
| `gravity-pickup-site/` | Netlify `gravity-pickup` | pickup.osmm-mtl.site | **Fermé le 30 sept. 2026** (page « Programme terminé ») |
| `osmm-montreal/` | Netlify `osmm-montreal` | osmm-mtl.site | Vitrine OSMM (organisme communautaire) |
| `gravity-admin-dashboard/` | Netlify | gravity-admin-dashboard.netlify.app | Dashboard admin (Supabase) : équipes, partenaires, galerie, réservations, championnat, Espace Joueurs, Instagram |
| `gravity-basketball-mtl/` | Netlify | gravity.osmm-mtl.site | Site public Gravity Basketball : équipes, championnat, vidéos, Espace Joueurs, boutique |
| `gravity-mailer/` | Netlify (sans page) | — | Courriels (Brevo) + inscriptions Notion, clé publique `x-mailer-key` + secret `MAILER_SERVER_KEY` (voir backends.md) |
| `talent-perle-site/` | Netlify `talent-perle` | talent-perle.netlify.app | Club de Karim (ami), **hors écosystème Gravity/OSMM**, inscriptions par Netlify Forms |
| `talent-perle-dashboard/` | Netlify (à créer) | — | Dashboard de Karim, Supabase séparé (à configurer par Karim) |
| `art-craft/` | **Worker Cloudflare `coachyass`** (contient seulement Art craft) | coachyass.moqtad6.workers.dev | Outil vidéo/son/image Gravity, 100 % navigateur (ffmpeg.wasm) + IA gratuites |

## Règles permanentes

- **Aucun frais** en dehors de l'abonnement Claude : plans gratuits seulement (Netlify, Cloudflare, Supabase, Brevo, Zeffy, Google). L'API Anthropic est facturée à part : pas de `ANTHROPIC_API_KEY` sans accord explicite. IA d'Art craft = Gemini (gratuit) puis Workers AI en secours. Détails : `docs/contexte/aucun-frais-ia-gratuites.md`.
- Talent Perlé reste séparé de Gravity/OSMM (pas de domaine, de Supabase ni de Notion partagés).
- Ne jamais mettre de secret dans le code ni dans le chat : variables d'environnement Netlify / secrets Cloudflare.
- **Le documentaire (`documentaire/`, `voix-locale/`) ne doit être sur aucun site** (demande du 26 octobre 2026). Le site Coaching publie la racine du dépôt : tout nouveau dossier privé à la racine doit être ajouté à `_redirects` (`/dossier/*  /404  404!`).
- Les choix déjà tranchés avec l'utilisateur (notés dans `docs/contexte/`) ne se remettent pas en question sans lui redemander.

## Backends (résumé)

- **Supabase** `aevoulzotvmnrnclfuek` (ca-central-1, compte `ballerz1514@gmail.com`) : Dashboard + gravity-basketball-mtl ; RLS = lecture publique, écriture admins. Slugs : `coachyass`, `basketlibre` (= Pickup), `gravity-basketball`, `gravity-basketball-mtl`, `osmm`.
- **Notion** : réservations et base unifiée « Inscription GRAV ».
- **Courriels** : Brevo (Resend abandonné) + FormSubmit vers `moqtad6@gmail.com`.
- **Meta / Instagram** `@gravitybasketball_mtl` via `gravity-admin-dashboard/netlify/functions/instagram.js`.

## Contexte détaillé : lire seulement le fichier utile

| Sujet | Fichier |
|---|---|
| Historique des sites, Talent Perlé (formulaire, Sheet), fin du Pickup | `docs/contexte/sites.md` |
| Dashboard Talent Perlé (Supabase de Karim, étapes restantes) | `docs/contexte/talent-perle.md` |
| Règle aucun frais, Gemini / Workers AI, YouTube, sans mot de passe | `docs/contexte/aucun-frais-ia-gratuites.md` |
| **Art craft** (Highlight Agent, analyse tactique, stats auto, mode direct, radar terrain, hébergement Cloudflare) | `docs/contexte/art-craft.md` (gros fichier : chercher la section avec Grep) |
| Art craft : module Vidéo IA (Hugging Face gratuit, Gemini) | `docs/contexte/video-ia.md` |
| Art craft : rendu rapide du short (WebCodecs, Mediabunny, ffmpeg en secours) | `docs/contexte/rendu-rapide.md` |
| Art craft : Gardien de chaîne YouTube (corrections tous les 2 jours, page « Ma chaîne », KV `art-craft-chaine`) | `docs/contexte/gardien-chaine.md` |
| Documentaire Gravity (script, rushes vidéo, voix off locale) | `docs/contexte/documentaire.md` |
| Supabase (tables), Notion, gravity-mailer, FormSubmit | `docs/contexte/backends.md` |
| Liste des demandes du 31 août 2026 | `docs/contexte/historique-31-aout.md` |
| Espace Joueurs | `docs/contexte/espace-joueurs.md` |
| Inscription GRAV (base Notion unifiée) | `docs/contexte/inscription-grav-notion.md` |
| Courriels : bug Resend, suspension, migration Brevo | `docs/contexte/courriels-resend-brevo.md` |
| Billet Zeffy Gravity Prep + accès Espace Joueurs auto | `docs/contexte/zeffy-gravity-prep.md` |
| API Meta / Instagram | `docs/contexte/meta-instagram.md` |
| Boutique Gravity Basketball | `docs/contexte/boutique.md` |

**Après un changement important** : mettre à jour le fichier `docs/contexte/` concerné (ou en créer un et l'ajouter au tableau ci-dessus). Garder ce `CLAUDE.md` court.
