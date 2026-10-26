## Intégration API Meta / Instagram (23 septembre 2026)

Compte branché : **@gravitybasketball_mtl** (compte Instagram professionnel déjà relié à une Page Facebook, confirmé par l'utilisateur). Les 4 usages demandés ont été construits :

- **Fil automatique sur le site** : la section "Vidéos" de `gravity-basketball-mtl` affiche d'abord les 12 derniers reels/vidéos du compte (lus via l'API), avec repli sur la liste manuelle `instagram_carousel` si l'API est indisponible ou pas encore configurée. Le repli affiche maintenant aussi les vidéos téléversées (`video_url`), pas seulement les liens (`post_url`).
- **Dashboard → nouveau groupe de menu "Instagram"** (visible seulement pour les admins qui gèrent `gravity-basketball`, chargé seulement à l'ouverture) : statistiques (abonnés, portée/interactions/visites du profil sur 28 jours, stats par publication), publication de photo/reel, commentaires (répondre, masquer), messages privés (lire, répondre).
- **Bouton "Publier sur Instagram"** sur chaque joueur de "Mes équipes — Joueurs" : génère la fiche joueur en JPEG et pré-remplit le formulaire de publication (rien n'est publié sans clic de confirmation).

**Architecture** : une seule fonction Netlify `gravity-admin-dashboard/netlify/functions/instagram.js` (`?action=...`). Le jeton Meta ne quitte jamais le serveur. `action=feed` est public (mis en cache 15 min sur le CDN Netlify) ; toutes les autres actions exigent le jeton Supabase d'un admin qui gère `gravity-basketball` (même vérification que `create-player-account.js`). La publication se fait en 3 appels (conteneur → attente du traitement → publication) parce qu'un reel peut dépasser la durée max d'une fonction Netlify. Les fichiers à publier transitent par le bucket public `gravity-media/instagram/` (Meta doit pouvoir les télécharger par URL publique ; photos converties en JPEG côté navigateur, seul format accepté).

**Limites Meta à connaître** : réponse aux DM seulement dans les 24 h suivant le dernier message de la personne ; 50 publications max par 24 h via l'API ; certaines statistiques par publication ne sont pas disponibles pour tous les types (affichées "—").

**Reste à faire côté utilisateur (sinon le Dashboard affiche "META_PAGE_ACCESS_TOKEN manquant" et le site reste sur la liste manuelle)** :
1. Créer une app sur developers.facebook.com (type "Business"), y ajouter le produit "Instagram" (configuration avec connexion Facebook).
2. Dans Graph API Explorer, choisir l'app, générer un jeton utilisateur avec les permissions `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`, `instagram_manage_messages`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_posts` (publication de vidéos sur la Page depuis Art craft, ajoutée le 20 octobre 2026), `business_management`.
3. Le prolonger dans l'Access Token Debugger ("Extend Access Token") → jeton utilisateur longue durée.
4. Dans Graph API Explorer avec ce jeton longue durée : `GET me/accounts` → copier l'`access_token` de la Page Gravity (jeton de Page qui n'expire pas).
5. Netlify, site `gravity-admin-dashboard` → variables d'environnement : **`META_PAGE_ACCESS_TOKEN`** = ce jeton de Page. (Optionnel : `META_IG_USER_ID`, sinon déduit automatiquement.)
6. Pour les messages privés : dans l'app Instagram → Paramètres → Messages et appels → Outils connectés → activer "Autoriser l'accès aux messages".
L'app peut rester en mode développement tant que seuls des comptes ayant un rôle sur l'app (l'utilisateur) s'en servent — pas besoin de revue d'app Meta.
