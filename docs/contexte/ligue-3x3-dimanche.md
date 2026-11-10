# Ligue 3x3 du dimanche, 14-15 ans (hiver 2027)

Demande du 10 novembre 2026 : nouveau programme 3x3 pour les 14-15 ans, **dimanches seulement** (samedis possibles au besoin), au Collège Sainte-Anne (gymnase A, Lachine), du 10 janvier au 21 mars 2027. L'utilisateur voulait un plan marketing « boule de neige ».

**Soumission du collège (4 nov. 2026, contact Nicolas Ramirez, Ramirezn@sainteanne.ca)** : 60 $/h. Samedis 18h30-20h30 et dimanches 12h-14h (horaire du dimanche marqué « à vérifier » sur la soumission, **confirmé par l'utilisateur le 10 nov.**). Total des deux journées : 3 035,34 $. **Dimanches seulement : 11 × 120 $ = 1 320 $ + taxes = 1 517,67 $.** Samedis 9 janvier (lancement) et 20 mars (finale) proposés en option.

**Choix proposés (prix et rabais suggérés par Claude, acceptés par « vas-y ») :**
- 8 équipes de 4 au maximum, 3x3 FIBA sur 2 demi-terrains.
- Prix de départ proposés : 119 $ / 149 $ / 440 $. **L'utilisateur a demandé +80 % (10 nov.)** pour payer t-shirts, arbitres et table de marque : **214 $ lève-tôt jusqu'au 6 déc., 268 $ régulier, 792 $ l'équipe de 4 (198 $ / joueur)**. Capitaine : 20 $ de rabais. Amène un ami : 10 $ chacun (non majorés).
- Budget recalculé (10 nov.) dans `docs/marketing/ligue-3x3-dimanche/budget-ligue-3x3.xlsx` (formules, cases jaunes modifiables). Hypothèses : 2 arbitres à 25 $/h, 2 personnes à la table à 15 $/h, t-shirt à 18 $, 10 % d'imprévus. Coûts fixes : 4 166 $. **Seuil de rentabilité : 22 joueurs (6 équipes).** Profit à 8 équipes : environ 1 400 $ à 2 100 $. Décision le 15 déc.

**Dans le code (`gravity-basketball-mtl/`) :**
- `ligue-3x3-dimanche.html` : page de la ligue (cible du code QR), carte « Nouveau » sur l'accueil, ajoutée au sitemap.
- `ligue-3x3-dimanche-affiche.html` : affiche Lettre imprimable avec code QR (généré avec segno, SVG en ligne).
- `ligue-3x3-dimanche-cadeau.html` : certificat cadeau des Fêtes imprimable (noms saisis à l'écran).
- Inscription : même formulaire que l'accueil, via `?programme=Ligue%203v3&saison=dimanche-hiver-2027`. `SAISONS` dans `script.js` met la catégorie à « 14-15 ans », change le titre, ajoute `details.saison` et préfixe la remarque par `[Ligue 3x3 du dimanche — hiver 2027]`. Ces inscriptions arrivent donc comme « Ligue 3v3 » dans Supabase, Notion et les courriels, reconnaissables à ce préfixe, sans nouvelle valeur « Programme ».
- `SAISONS['dimanche-hiver-2027'].zeffy` est vide tant que le billet Zeffy dédié n'existe pas. Le paiement par Zeffy affiche alors « paiement bientôt disponible », jamais le billet de la ligue du samedi.

**Matériel marketing :** `docs/marketing/ligue-3x3-dimanche/` (pas publié : `/docs/*` renvoie 404). Contient `kit-marketing.md` (courriel à Nicolas, texte et questions du billet Zeffy, calendrier et légendes Instagram, message aux parents, lettre aux écoles, suivi hebdomadaire), `instagram/` (5 visuels 1080 × 1350) et `affiche-lettre.pdf`.

**Remplacement de l'ancienne ligue du samedi (10 nov., choix de l'utilisateur)** : la Ligue 3v3 du samedi (13-14 ans, 10h-13h) est terminée. Sur l'accueil du site, le programme « Ligue 3v3 » est désormais la ligue du dimanche : carte, titre, description Google, JSON-LD, formulaire et pied de page. La valeur interne `Ligue 3v3` est gardée pour Notion et Supabase. `SAISON` s'applique par défaut, avec ou sans `?saison=`. La ligne `programs` slug `ligue-3v3` dans Supabase a été mise à jour (nom, description, détails, tarifs), car elle écrase la carte de l'accueil.
- Le formulaire demande aussi, pour cette ligue seulement : taille de t-shirt, contact d'urgence, santé ou allergies, et autorisation parentale (obligatoire). Ces infos partent dans `details`, FormSubmit et Notion.
- **Bug corrigé** : les champs Gravity Prep cachés étaient `required` et bloquaient en silence l'envoi du formulaire pour tous les autres programmes. Ils ne sont maintenant exigés que pour Gravity Prep.

**Reste à faire (utilisateur) :** créer le billet Zeffy et donner son URL ; publier selon le calendrier du kit.
