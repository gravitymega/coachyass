## Billet Zeffy Gravity Prep + création automatique de l'accès Espace Joueurs (13 septembre 2026)

Contexte tiré des documents fournis par l'utilisateur (contrat joueur Post-Grad, description de saison, présentation du Circuit Prep U) : Gravity Prep = le programme "Post-Grad" (saison du 1er octobre 2026 au 28 mars 2027, 850 $, payable en un seul versement sur Zeffy — le contrat prévoit un échéancier en 3 versements mais l'utilisateur a choisi un billet Zeffy unique plein tarif plutôt que 3 billets par versement).

**Ce qui a été fait dans ce repo :**
- `gravity-basketball-mtl/documents/contrat-joueur-postgrad-2026-2027.pdf` : le contrat joueur, hébergé publiquement pour pouvoir être lié depuis le billet Zeffy (case à cocher "j'ai lu et j'accepte" au moment du paiement — pas de vraie signature électronique, même logique que la case décharge déjà existante sur le formulaire d'inscription).
- `gravity-admin-dashboard/netlify/functions/zeffy-webhook-prep.js` : nouvelle fonction Netlify qui reçoit les paiements complétés Zeffy (webhook), et **crée directement l'accès Espace Joueurs du joueur dès son premier paiement**, sans attendre que l'admin clique "Créer un accès" dans le Dashboard :
  - Cherche une fiche joueur existante (`players`, `site = 'gravity-basketball'`, `age_category = 'Prep'`) dont le courriel correspond à celui du paiement.
  - Si aucune fiche n'existe encore, en crée une minimale (nom + courriel seulement, tirés du paiement Zeffy — `program: 'equipe'`, `age_category: 'Prep'`) ; l'admin complète ensuite équipe/numéro/photo dans "Mes équipes — Joueurs" comme d'habitude, ça ne bloque pas l'accès du joueur.
  - Crée le compte Supabase Auth + envoie le courriel d'accès (même gabarit `espace-joueurs-access` que la création manuelle) + alerte Gavitybasketball@gmail.com (filet FormSubmit) pour signaler qu'une fiche a été créée automatiquement et reste à compléter.
  - Idempotent : si la fiche a déjà un `auth_user_id`, ne fait rien (évite les doublons sur un retry du webhook ou un paiement répété).
  - **Le format exact du payload envoyé par Zeffy n'a pas pu être vérifié** (accès à `support.zeffy.com` bloqué depuis cet environnement) — l'extraction du courriel/nom fouille le JSON reçu plutôt que de viser des chemins fixes, et un filtre sur le mot "prep" dans le payload ignore les paiements des autres programmes si jamais le webhook Zeffy est réglé au niveau du compte plutôt que par événement. Si un vrai paiement de test ne déclenche pas l'invitation, les logs Netlify de cette fonction affichent le payload brut reçu — à consulter en premier pour ajuster l'extraction.

**Billet créé le 14 septembre 2026** : `https://www.zeffy.com/en-CA/ticketing/gravity-prep-saison-2026--2027`, branché dans `ZEFFY_LINKS['Gravity Prep']` (`gravity-basketball-mtl/script.js`) — un joueur qui choisit "Zeffy" comme mode de paiement pour Gravity Prep est maintenant redirigé vers ce billet au lieu du message "paiement bientôt disponible".

**Reste à faire côté utilisateur :**
1. Vérifier que la case à cocher obligatoire du contrat a bien été ajoutée sur le billet ci-dessus, avec le lien `https://gravity.osmm-mtl.site/documents/contrat-joueur-postgrad-2026-2027.pdf` (disponible une fois le PR #48 mergé/déployé).
2. Dans Zeffy → Settings → Notifications (sur ce billet) : activer une notification par courriel vers `Gavitybasketball@gmail.com`, comme pour Talent Perlé.
3. Dans Zeffy → Settings → Integrations → Webhooks : ajouter un webhook pointant vers `https://gravity-admin-dashboard.netlify.app/.netlify/functions/zeffy-webhook-prep?key=<secret>`.
4. Sur Netlify, site `gravity-admin-dashboard` → variables d'environnement : ajouter **`ZEFFY_PREP_WEBHOOK_SECRET`** (choisir une valeur, la mettre aussi dans l'URL du webhook Zeffy ci-dessus) — `SUPABASE_SERVICE_ROLE_KEY` est déjà requise pour `create-player-account.js`, réutilisée ici.
5. Une fois le billet créé, donner l'URL Zeffy (`zeffy.com/en-CA/ticketing/...`) pour qu'elle soit ajoutée à `ZEFFY_LINKS['Gravity Prep']` dans `gravity-basketball-mtl/script.js` (actuellement absent — un joueur qui choisit "Zeffy" comme mode de paiement pour Gravity Prep voit un message "paiement bientôt disponible").
6. Faire un vrai paiement de test une fois tout branché, et transmettre le contenu des logs Netlify de `zeffy-webhook-prep` si l'invitation ne part pas automatiquement.
