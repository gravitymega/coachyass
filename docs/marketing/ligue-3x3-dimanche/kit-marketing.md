# Kit marketing : Ligue 3x3 du dimanche (14-15 ans), hiver 2027

Tout est prêt à copier-coller. Liens utiles :

- Page de la ligue (cible du code QR) : https://gravity.osmm-mtl.site/ligue-3x3-dimanche.html
- Inscription directe : https://gravity.osmm-mtl.site/?programme=Ligue%203v3&saison=dimanche-hiver-2027#inscription
- Affiche à imprimer : https://gravity.osmm-mtl.site/ligue-3x3-dimanche-affiche.html (PDF aussi dans `affiche-lettre.pdf`)
- Certificat cadeau : https://gravity.osmm-mtl.site/ligue-3x3-dimanche-cadeau.html
- Visuels Instagram 1080 × 1350 : dossier `instagram/`

> Ces liens fonctionnent une fois le PR fusionné sur `main`.

---

## 1. Courriel à Nicolas Ramirez (Collège Sainte-Anne)

> ✅ **Gymnase confirmé** (10 nov. 2026) : dimanches 12h-14h. Ce courriel n'est plus nécessaire. Il reste en modèle, au cas où tu voudrais ajouter les samedis 9 janvier ou 20 mars.

**À :** Ramirezn@sainteanne.ca
**Objet :** Confirmation location gymnase A, hiver 2027 (dimanches), OSMM

> Bonjour Nicolas,
>
> Merci pour la soumission du 4 novembre.
>
> Nous souhaitons confirmer la location du **gymnase A les dimanches de 12h00 à 14h00**, du **10 janvier au 21 mars 2027** (11 dimanches), pour notre ligue de basketball 3x3 des 14-15 ans.
>
> Pour les samedis (18h30 à 20h30), nous ne les réservons pas pour l'instant. Serait-il possible de garder en option :
> - le **samedi 9 janvier 2027** (lancement) ;
> - le **samedi 20 mars 2027** (finale) ?
>
> Pourriez-vous :
> 1. confirmer que la plage de **12h00 à 14h00 le dimanche** est bien disponible (elle était marquée « à vérifier ») ;
> 2. nous envoyer la soumission révisée (dimanches seulement : 11 × 120 $ = 1 320 $ + taxes) ;
> 3. nous indiquer la date limite de paiement et les conditions d'annulation ;
> 4. nous dire si les deux paniers latéraux peuvent être utilisés en même temps (deux demi-terrains), et si des ballons ou un tableau de pointage sont disponibles.
>
> Merci beaucoup !
>
> Yassine Moqtad
> Organisme Sportif Maghrébin de Montréal (OSMM)
> 438-341-2051

---

## 2. Billet Zeffy à créer

**Nom du billet :** Ligue 3x3 du dimanche, hiver 2027 (14-15 ans)

**Description :**
> 11 dimanches de basketball 3x3 pour les 14-15 ans, de 12h à 14h, du 10 janvier au 21 mars 2027, au Collège Sainte-Anne (gymnase A, 100, boul. Bouchard, Dorval). Matchs arbitrés (règles FIBA), classement en ligne, éliminatoires, finale et trophées. Maillot réversible inclus. Une initiative de Gravity Basketball, programme de l'Organisme Sportif Maghrébin de Montréal (OSMM).

**Types de billets :**

| Billet | Prix | Disponibilité |
|---|---|---|
| Joueur, lève-tôt | 214 $ | jusqu'au 6 décembre 2026 |
| Joueur, régulier | 268 $ | à partir du 7 décembre 2026 |
| Équipe complète (4 joueurs) | 792 $ | toute la période |

**Quantité totale :** 32 places (8 équipes de 4). Ajoute une liste d'attente si Zeffy le permet.

**Questions à ajouter au formulaire :**
1. Nom du joueur, date de naissance
2. Nom de l'équipe (ou « agent libre »)
3. Nom du capitaine
4. Nom, téléphone et courriel du parent ou tuteur
5. Contact d'urgence (nom et téléphone)
6. Allergies ou condition médicale à connaître
7. Taille de maillot (YM, YL, S, M, L, XL)
8. Nom de l'ami qui t'a référé (pour les 10 $ de rabais)
9. Comment as-tu connu la ligue ? (Instagram, TikTok, école, ami, parent, affiche, mosquée ou centre communautaire, autre)
10. Case obligatoire : « Je suis le parent ou tuteur et j'autorise mon enfant à participer. Je comprends que le basketball comporte des risques de blessure. »
11. Case facultative : « J'autorise Gravity Basketball à publier des photos et vidéos de mon enfant prises pendant les matchs (Instagram, Facebook, site web). »

**Rabais capitaine (20 $) et ami (10 $) :** crée deux codes promo dans Zeffy (par exemple `CAPITAINE20` et `AMI10`). Tu remets `CAPITAINE20` aux capitaines par message privé. `AMI10` peut être public.

**Ensuite :** envoie-moi l'URL du billet. Je la branche dans `SAISONS['dimanche-hiver-2027'].zeffy` (`gravity-basketball-mtl/script.js`). D'ici là, le paiement par Interac fonctionne déjà, et un choix « Zeffy » affiche « paiement bientôt disponible ».

---

## 3. Publications Instagram (et TikTok)

Les visuels sont dans `instagram/`. Mets le lien de la page de la ligue dans la bio.

| Date | Visuel | Légende |
|---|---|---|
| **Mar. 17 nov.** | `1-annonce.png` | A |
| **Ven. 20 nov.** | `3-format.png` | B |
| **Mar. 24 nov.** | `4-agent-libre.png` | C |
| **Lun. 30 nov.** | `2-prix-leve-tot.png` | D |
| **Jeu. 3 déc.** | `2-prix-leve-tot.png` (story) | « Dernière chance : 214 $ jusqu'à dimanche » |
| **Mar. 8 déc., puis 15 et 22 déc.** | `5-cadeau-noel.png` | E |
| **Dim. 3 janv.** | `1-annonce.png` (story) | « Inscriptions : dernière journée. Il reste X places. » |
| **Mer. 6 janv.** | Annonce des équipes (noms, logos) | F |

**Entre les publications :** fais des Reels de 15 à 30 secondes. Idées :
- les meilleurs moments de tes anciennes ligues 3v3 ;
- un défi « 3 points en 30 secondes » ;
- « Tag les 3 amis avec qui tu montes ton équipe ».

Republie chaque inscription d'équipe en story (« Bienvenue aux [nom d'équipe] ! 5 places restantes »). Plus le compteur baisse, plus ça presse.

**Légende A (annonce) :**
> 🏀 NOUVEAU : la Ligue 3x3 du dimanche arrive à Dorval.
>
> 14-15 ans · 11 dimanches · 12h-14h · du 10 janvier au 21 mars
> Matchs arbitrés FIBA, classement en ligne, Top 5 vidéo chaque semaine, finale et trophées.
>
> 8 équipes. Pas une de plus.
> Monte ton équipe de 4 ou inscris-toi en agent libre.
>
> 👉 Lien dans la bio
> #basketballmontreal #3x3 #lachine #dorval #lasalle #basketqc #gravitybasketball

**Légende B (format) :**
> Pas de banc. Pas d'attente. Environ 5 matchs chaque dimanche.
> Le 3x3, c'est rapide, c'est intense, et chaque possession compte.
> Tes meilleurs jeux finissent dans le Top 5 de la semaine 🎥
>
> 👉 Lien dans la bio pour réserver ta place.

**Légende C (agent libre) :**
> T'as pas d'équipe ? Aucun problème.
> Inscris-toi en agent libre, on te place dans une équipe à ton niveau.
>
> Ou mieux : tag les 3 amis avec qui tu montes ton équipe 👇

**Légende D (lève-tôt) :**
> 214 $ pour 11 dimanches de basket, jusqu'au 6 décembre seulement.
> Équipe complète de 4 : 792 $. Capitaine : 20 $ de rabais en plus. Amène un ami : 10 $ chacun.
>
> Après le 6 décembre : 268 $. 👉 Lien dans la bio

**Légende E (cadeau, pour les parents) :**
> Vous cherchez un cadeau qui le fait bouger ? 🎄
> Une saison complète de basketball 3x3 : 11 dimanches encadrés, un maillot, une finale à gagner.
> Inscrivez votre jeune, puis imprimez le certificat cadeau sur notre site et glissez-le sous le sapin.
>
> 👉 Lien dans la bio

**Légende F (équipes) :**
> Les équipes sont formées 🔥 Voici les [8] équipes de la première saison de la Ligue 3x3 du dimanche.
> Rendez-vous dimanche 10 janvier, 12h, Collège Sainte-Anne.
> Qui prend le trophée ? 👇

**Pendant la saison (chaque dimanche soir) :** publie le Top 5 de la semaine (Highlight Agent d'Art craft), le joueur de la semaine et le classement. Seulement pour les jeunes dont le parent a coché le consentement photo et vidéo.

---

## 4. Message aux parents (WhatsApp, Facebook, groupes communautaires)

> Salam / Bonjour à tous 👋
>
> L'OSMM lance une **ligue de basketball 3x3 pour les 14-15 ans**, tous les **dimanches de 12h à 14h**, du **10 janvier au 21 mars**, au Collège Sainte-Anne (Dorval).
>
> ✅ Encadrée par les coachs Gravity Basketball
> ✅ Matchs arbitrés, classement, finale et trophées
> ✅ Maillot inclus
> ✅ Seul ou en équipe de 4
>
> 💰 214 $ jusqu'au 6 décembre (ensuite 268 $). Équipe de 4 : 792 $.
> 🎄 Idée cadeau des Fêtes : un certificat cadeau est disponible sur le site.
>
> Seulement 8 équipes. Inscription : https://gravity.osmm-mtl.site/ligue-3x3-dimanche.html
>
> Questions : Yassine, 438-341-2051. Merci de partager 🙏

**Version courte (pour une annonce à la mosquée ou au centre communautaire) :**
> Nouvelle ligue de basketball 3x3 pour les jeunes de 14-15 ans, les dimanches de 12h à 14h à Dorval, dès le 10 janvier. Places limitées. Infos et inscription : gravity.osmm-mtl.site, ou Yassine au 438-341-2051.

---

## 5. Lettre aux écoles et aux profs d'éducation physique

**Objet :** Ligue de basketball 3x3 pour vos élèves de 14-15 ans (dimanches, Dorval)

> Bonjour [Madame / Monsieur],
>
> Je suis Yassine Moqtad, coach chez Gravity Basketball, un programme de l'Organisme Sportif Maghrébin de Montréal (OSMM), un organisme communautaire.
>
> Nous lançons cet hiver une **ligue de basketball 3x3 pour les 14-15 ans** :
> - tous les dimanches de 12h à 14h, du 10 janvier au 21 mars 2027 ;
> - au Collège Sainte-Anne (gymnase A), à Dorval ;
> - matchs arbitrés selon les règles FIBA, encadrement par nos coachs ;
> - inscription seul ou en équipe de 4, tous les niveaux sont bienvenus.
>
> C'est une belle occasion pour vos élèves qui aiment le basket de jouer chaque semaine, hors de la saison scolaire ou en complément.
>
> Est-ce que vous accepteriez :
> 1. d'**afficher l'affiche ci-jointe** (avec code QR) au gymnase ou à la cafétéria ;
> 2. de **transmettre l'information** aux élèves ou aux parents de 3e et 4e secondaire ?
>
> Si vous avez une équipe scolaire, vos joueurs peuvent aussi s'inscrire ensemble. C'est une bonne façon de rester en forme entre deux saisons.
>
> Infos et inscription : https://gravity.osmm-mtl.site/ligue-3x3-dimanche.html
>
> Merci beaucoup, et au plaisir d'échanger !
>
> Yassine Moqtad
> Gravity Basketball / OSMM
> 438-341-2051 · @GravityBasketballMTL

**Pièce jointe :** `affiche-lettre.pdf`.

**Où l'envoyer :**
- le Collège Sainte-Anne lui-même (passe par Nicolas pour joindre le département d'éducation physique) ;
- les écoles secondaires de Lachine, Dorval et LaSalle ;
- les maisons des jeunes et les centres de loisirs du secteur.

---

## 6. Suivi hebdomadaire

| Date | Objectif | Si l'objectif n'est pas atteint |
|---|---|---|
| 22 nov. | 2 équipes inscrites | Relancer les capitaines et faire 2 Reels de plus |
| 6 déc. (fin du lève-tôt) | 4 équipes (16 joueurs) | Prolonger le lève-tôt d'une semaine (« dernière chance ») |
| **15 déc. (décision)** | **6 équipes (22-24 joueurs), le seuil de rentabilité** | Relancer écoles et parents, faire une soirée d'essai gratuite, réduire les coûts (bénévoles à la table, moins de publicité) |
| 3 janv. (fin des inscriptions) | 8 équipes | Former les équipes avec les agents libres |

Chaque semaine, note les réponses à « Comment as-tu connu la ligue ? » et mets plus d'efforts dans le canal qui marche le mieux.

**Budget (recalculé le 10 nov. avec les prix +80 %)**

Tous les calculs sont dans `budget-ligue-3x3.xlsx`. Change les cases jaunes (taux des arbitres, de la table, prix des t-shirts…) et tout se recalcule.

Hypothèses de départ, à remplacer par tes vrais chiffres :
- 2 arbitres à 25 $/h et 2 personnes à la table à 15 $/h, pendant 2 h, 11 dimanches.
- T-shirt à 18 $ par joueur, 10 % d'imprévus.

| Coûts fixes | Montant |
|---|---|
| Gymnase (11 × 120 $ + taxes) | 1 517,67 $ |
| Arbitres (2 × 2 h × 11 × 25 $) | 1 100,00 $ |
| Table de marque (2 × 2 h × 11 × 15 $) | 660,00 $ |
| Trophées et médailles | 200,00 $ |
| Ballons | 160,00 $ |
| Publicité | 150,00 $ |
| Imprévus (10 %) | 378,77 $ |
| **Total** | **4 166,44 $** |

Coût par joueur : t-shirt de 18 $.

Revenu moyen par joueur, après rabais :
- en équipe de 4, avec le rabais capitaine : 193 $ ;
- lève-tôt : 214 $ ;
- régulier : 268 $ ;
- **mélange réaliste : 214,50 $**.

| Scénario | Joueurs | Revenus | Coûts | **Profit** |
|---|---|---|---|---|
| 5 équipes | 20 | 4 290 $ | 4 526 $ | **−236 $** |
| 6 équipes | 24 | 5 148 $ | 4 598 $ | **+550 $** |
| 7 équipes | 28 | 6 006 $ | 4 670 $ | **+1 336 $** |
| 8 équipes (complet) | 32 | 6 864 $ | 4 742 $ | **+2 122 $** |
| 8 équipes, toutes en équipe de 4 | 32 | 6 176 $ | 4 742 $ | **+1 434 $** |

**Seuil de rentabilité : 22 joueurs, donc 6 équipes.** Si toutes les inscriptions se font en équipe de 4, il en faut 24.
