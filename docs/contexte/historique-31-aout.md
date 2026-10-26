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
