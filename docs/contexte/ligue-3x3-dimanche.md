# Ligue 3x3 du dimanche, 14-15 ans (hiver 2027)

Demande du 10 novembre 2026 : nouveau programme 3x3 pour les 14-15 ans, **dimanches seulement** (samedis possibles au besoin), au Collège Sainte-Anne (gymnase A, Lachine), du 10 janvier au 21 mars 2027. L'utilisateur voulait un plan marketing « boule de neige ».

**Soumission du collège (4 nov. 2026, contact Nicolas Ramirez, Ramirezn@sainteanne.ca)** : 60 $/h. Samedis 18h30-20h30 et dimanches 12h-14h (horaire du dimanche marqué « à vérifier »). Total des deux journées : 3 035,34 $. **Dimanches seulement : 11 × 120 $ = 1 320 $ + taxes = 1 517,67 $.** Samedis 9 janvier (lancement) et 20 mars (finale) proposés en option.

**Choix proposés (prix et rabais suggérés par Claude, acceptés par « vas-y ») :**
- 8 équipes de 4 au maximum, 3x3 FIBA sur 2 demi-terrains.
- 119 $ lève-tôt jusqu'au 6 déc., ensuite 149 $. Équipe de 4 : 440 $. Capitaine : 20 $ de rabais. Amène un ami : 10 $ chacun.
- Seuil de rentabilité : environ 20 joueurs. Décision le 15 déc.

**Dans le code (`gravity-basketball-mtl/`) :**
- `ligue-3x3-dimanche.html` : page de la ligue (cible du code QR), carte « Nouveau » sur l'accueil, ajoutée au sitemap.
- `ligue-3x3-dimanche-affiche.html` : affiche Lettre imprimable avec code QR (généré avec segno, SVG en ligne).
- `ligue-3x3-dimanche-cadeau.html` : certificat cadeau des Fêtes imprimable (noms saisis à l'écran).
- Inscription : même formulaire que l'accueil, via `?programme=Ligue%203v3&saison=dimanche-hiver-2027`. `SAISONS` dans `script.js` met la catégorie à « 14-15 ans », change le titre, ajoute `details.saison` et préfixe la remarque par `[Ligue 3x3 du dimanche — hiver 2027]`. Ces inscriptions arrivent donc comme « Ligue 3v3 » dans Supabase, Notion et les courriels, reconnaissables à ce préfixe, sans nouvelle valeur « Programme ».
- `SAISONS['dimanche-hiver-2027'].zeffy` est vide tant que le billet Zeffy dédié n'existe pas. Le paiement par Zeffy affiche alors « paiement bientôt disponible », jamais le billet de la ligue du samedi.

**Matériel marketing :** `docs/marketing/ligue-3x3-dimanche/` (pas publié : `/docs/*` renvoie 404). Contient `kit-marketing.md` (courriel à Nicolas, texte et questions du billet Zeffy, calendrier et légendes Instagram, message aux parents, lettre aux écoles, suivi hebdomadaire), `instagram/` (5 visuels 1080 × 1350) et `affiche-lettre.pdf`.

**Reste à faire (utilisateur) :** confirmer l'horaire du dimanche avec Nicolas ; créer le billet Zeffy et donner son URL ; publier selon le calendrier du kit.
