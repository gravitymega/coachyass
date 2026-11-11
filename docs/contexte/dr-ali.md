# Dr Ali : le labo du Dr Harley (dans le jeu de Hbibiti)

Plan écrit par Mythos le 8 novembre 2026 pour Dr Harley (harley-lab). Le 10 novembre 2026, l'utilisateur a demandé de l'**intégrer au jeu de Hbibiti** (`jeu-darija/`) : c'est maintenant l'activité **🔬 Le labo du Dr Harley** (profil qui lit seulement, donc Ali). **Un seul jeu Dr Ali, des progrès partagés (choix de l'utilisateur, 10 nov. 2026 : « pas séparer »)** :
- Le jeu Dr Ali, c'est **le labo du jeu de Hbibiti**, sur la tablette **et** sur harley-lab (qui ouvre simplement https://jeu-hbibiti.moqtad6.workers.dev, profil Ali, activité 🔬). La version que Mythos avait mise sur le serveur (`~/Dr-Ali`, `labo/`, `jeu/`) n'est plus le jeu de référence : **Sur harley-lab, la page HTML de Mythos reste le point d'entrée** (choix de l'utilisateur, 11 nov. 2026) : le raccourci « Dr Ali » ouvre toujours la page de Mythos (intro du labo, « Ali, veux-tu devenir mon assistant ? »), et un bouton de cette page ouvre **https://jeu-hbibiti.moqtad6.workers.dev/?labo=ali** : le jeu s'ouvre directement dans le labo d'Ali (sans l'accueil ni l'histoire de l'usine), avec les progrès partagés ; la flèche ⬅ ramène à la carte du jeu. Fonction `openDirectLabo` à la fin de `jeu-darija/app.js`. **À faire par Dr Harley sur harley-lab** : ajouter ce bouton dans la page de Mythos (sans rien effacer de `~/Dr-Ali` sans l'accord de l'utilisateur).
- Les progrès d'Ali sont gardés par le Worker `jeu-hbibiti` dans **Cloudflare KV `jeu-hbibiti-labo`** (gratuit, id `93c297fb4a004fc4886f188bdee32f49`), clé `labo:ali`, et fusionnés à chaque synchronisation (`mergeLabo` : rien ne se perd, la règle « une par jour » vaut sur tous les appareils).
- Protection : **code famille**, secret Cloudflare `LABO_CODE` (au moins 6 caractères, jamais dans le code ni dans le chat), à saisir aussi une fois dans chaque appareil (labo › 🔒 Parents › Code famille). Sans code, le jeu marche quand même, sans partage.
- Ce qui sort de l'appareil : seulement le prénom (`ali`) et les résultats des missions (réussite, essais, indices, temps). C'est une exception voulue à la règle « aucune donnée ne sort » du plan d'origine.
- **Dr Harley lit les progrès** depuis harley-lab : `curl -s -H "x-famille: $LABO_CODE" "https://jeu-hbibiti.moqtad6.workers.dev/api/labo?enfant=ali"` (le code dans une variable d'environnement de harley-lab, pas dans un fichier du dépôt).

## Le but
Ali a 7 ans et il croit que Dr Harley vit dans l'ordinateur pour aider sa famille. On garde cette magie et on en fait une école secrète : **Dr Harley forme Ali pour qu'il devienne « Dr Ali »**, un savant du labo. En six mois : se servir d'un ordinateur sous Linux et taper ses premières commandes ; penser comme un programmeur (suites, boucles, conditions, variables) ; être solide en maths pour son âge ; comprendre des idées de science en les testant ; et surtout aimer chercher, se tromper et recommencer.

## Les 8 règles (toutes appliquées dans le jeu)
1. **Dix minutes par jour**, une seule nouvelle mission par jour (`missionsState` : la suivante s'ouvre le lendemain ; on peut rejouer les anciennes). Réglage parents « Ouvrir toutes les missions » (`settings.laboLibre`).
2. **La voix d'abord** : le docteur dit l'histoire, la consigne, les indices ; nombres en lettres (`enLettres`).
3. **Faire, pas écouter** : toucher, glisser, programmer, taper.
4. **Se tromper sans danger** : indice après 2 essais ratés, solution montrée après 3, puis une nouvelle chance (`tries` dans `act-labo.js`).
5. **Féliciter l'effort** : « Tu as essayé une autre façon, bravo ! », « Tu n'as pas abandonné… ».
6. **Tout revient** : 1, 3, 7, 14, 30 jours (`ESPACEMENT`, `recordMission`) ; la mission à revoir affiche « 🔁 À revoir aujourd'hui ».
7. **À sa mesure** : difficile (3 essais, solution montrée) → revient demain en plus doux (`doux`) ; réussi du premier coup → on saute une marche (`monter`) ; 3 réussites espacées = acquise.
8. **Le vrai monde aussi** : une mission par semaine avec Papa **ou Maman**, confirmée par un parent (calcul).

## Ajouts demandés par l'utilisateur (10 nov.)
- **Les sports d'Ali** : soccer le mardi, basket le dimanche, course avec Maman. Dr Harley l'encourage à chaque fois qu'il lui parle (accueil du labo et fin de chaque mission, `encouragement` de `ville3d-dialogues.js`). Idées pour les prochains chapitres : des missions qui parlent de soccer le mardi (« programme Bip pour qu'il dribble jusqu'au but »), de basket le dimanche, et des missions en vrai avec Maman pendant la course (compter ses pas, chronométrer).
- Le bulletin du dimanche a une 4e ligne : **une fierté**.
- Conseils (non tranchés, à redemander à l'utilisateur) : le programme des mois 4 à 6 est ambitieux (la règle 7 passe avant le calendrier) ; au grade « Inventeur », expliquer à Ali comment Dr Harley marche vraiment ; éviter les doublons avec les salles de maths de l'usine (le labo fait les maths « de savant » : mesurer, monnaie, diagrammes).

## L'histoire et les grades
Chaque semaine est un chapitre ; le 7e jour, un défi termine le chapitre et donne un badge. Grades (`GRADES` de `labo-core.js`, selon le nombre de chapitres finis) : Apprenti du labo (1), Assistant de labo (4), Technicien (8), Ingénieur (12), Inventeur (16), **Dr Ali, génie du labo** (le grand défi + son projet présenté à la famille). Personnages : **Dr Harley** (savant dessiné en SVG dans `act-labo.js` : blouse, lunettes rondes, nœud papillon ; personnage original), **Pingo** 🐧 (le pingouin farceur, mascotte de Linux), **Bip** 🤖 (le robot qu'Ali programme). Diplôme à imprimer : pas encore fait (avec l'accord de Yassine).

## La semaine type
| Jour | Domaine | Exemple |
|---|---|---|
| Lundi | 🔢 Maths | compter, additionner, la monnaie, l'heure |
| Mardi | 🤖 Code | programmer Bip avec des flèches, puis des blocs, puis du texte |
| Mercredi | 🐧 L'ordinateur et Linux | souris, clavier, dossiers, puis la console de Pingo |
| Jeudi | 🔬 Sciences | aimants, plantes, eau, planètes, électricité |
| Vendredi | 🧩 Énigme | logique, message secret, lecture |
| Samedi | 🏠 Mission avec Papa ou Maman | une expérience hors de l'écran, puis 2 questions dans le jeu |
| Dimanche | 🏆 Défi du chapitre | révision de la semaine sous forme de jeu, badge |

Si Ali commence un autre jour, on garde l'ordre des domaines, pas le jour de la semaine.

## Le programme, mois par mois (repère, à adapter)
| Mois | 🔢 Maths | 🤖 Code | 🐧 Ordinateur et Linux | 🔬 Sciences |
|---|---|---|---|---|
| 1 | compter jusqu'à 100, comparer, + et − jusqu'à 20, formes | suites d'étapes, motifs, Bip avec 1 à 4 flèches | souris (cliquer, glisser), lettres du clavier, taper son prénom, ranger des images dans des boîtes (= dossiers) | vivant ou non, ce dont une plante a besoin, aimants |
| 2 | + et − jusqu'à 100, dizaines et unités, pièces canadiennes, l'heure pile et la demie | chemins plus longs, **boucles**, trouver l'erreur | console de Pingo simulée : `ls`, `cd`, `pwd` dans « la grotte des dossiers » | l'eau, jour et nuit, saisons, les 5 sens |
| 3 | multiplier = des groupes, moitié et quart, mesurer en cm, suites | **conditions**, blocs à glisser | `mkdir`, `touch`, `echo`, `cat` (simulés) ; première vraie console avec papa | système solaire, circuit pile + ampoule (simulé), habitats |
| 4 | tables de 2, 3, 4, 5 et 10, petits problèmes, diagrammes, symétrie | **variables** ; premier code en texte ; la tortue qui dessine | arborescence, `cp`, `mv`, `rm` (simulateur seulement) | forces, lumière et ombres, recyclage |
| 5 | tables jusqu'à 10, division, fractions simples, rendre la monnaie, les minutes | **fonctions**, déboguer, un petit jeu ; le binaire avec des ampoules | avec papa : `nano`, un script `bonjour.sh` | comment marche un ordinateur (regarder dans harley-lab éteint) |
| 6 | révision en défis, calcul mental (doux, contre lui-même) | **son projet** | avec papa : `python3`, `print("Bonjour")` | une expérience choisie par Ali, présentée à la famille |

Saison 2 : les mots anglais de l'ordinateur, du vrai Python, trier et chercher, la sécurité sur Internet, taper plus vite.

## Comment c'est construit dans le jeu
- `jeu-darija/labo-missions.js` : **les données** (`CHAPITRES`, chacun 7 missions dont un défi en dernier). Le format et les moteurs sont décrits en tête du fichier.
- `jeu-darija/labo-core.js` : logique pure (une par jour, révisions, grades, bulletin, valideur, Bip sur la grille, nombres en lettres).
- `jeu-darija/act-labo.js` : l'écran et les **8 moteurs** : `compter`, `robot` (Bip et les flèches), `ranger` (glisser dans des boîtes), `secret` (message codé), `maison` (en vrai, confirmé par un parent), `quiz`, `sons` (mémoire), `clavier` (ajouté le 11 nov.). Prochains moteurs prévus par le plan : console simulée de Pingo, balance des nombres, horloge, monnaie, labyrinthe (au plus un nouveau moteur par semaine, testé à part).
- Progrès dans `progress.labo` de chaque enfant (localStorage, compris dans la sauvegarde JSON des parents) : `faits`, `essais` (réussite, essais, indices, solution montrée, temps), `revues`.
- Espace parents du labo (🔒 calcul) : bulletin de la semaine, **code famille et « Synchroniser maintenant »**, réglage « une par jour », copie de secours **📤 Télécharger les progrès** (`dr-ali-progres-AAAA-MM-JJ.json`).
- Synchronisation (`syncLabo` dans `act-labo.js`) : à l'ouverture du labo et après chaque mission, un seul `PUT /api/labo?enfant=ali` envoie le labo local et reçoit la fusion. Testé : `worker.test.mjs` (code obligatoire, fusion, KV) et Playwright avec deux appareils (mission faite sur la tablette → vue sur harley-lab, la suivante « demain » sur les deux).
- Tests : `node --test jeu-darija/labo.test.mjs` (c'est aussi **le valideur** : une mission mal écrite fait échouer le test). Playwright : le chapitre 1 joué en entier (erreurs volontaires, indice, glisser à la souris, porte parents, mémoire des sons), téléphone 390×844 sans débordement.
- Voix : les phrases des missions sont dans `outils/voix/phrases.mjs` mais **pas encore enregistrées avec Kokoro** (le plan parlait de Piper sur harley-lab) ; en attendant, voix de la tablette.

## Comment Dr Harley ajoute une mission (chaque matin)
1. Lire les progrès d'Ali avec la commande `curl` ci-dessus : 3 essais ou plus ou solution montrée → la notion revient en plus facile ; réussie du premier coup → une marche au-dessus.
2. Ajouter la mission (données seulement) dans `jeu-darija/labo-missions.js`, dans le chapitre en cours ; **toujours au moins 3 missions d'avance**. Un chapitre = 7 missions, la 7e est le défi.
3. `node --test jeu-darija/*.test.mjs` (valideur) ; si ça échoue, on ne publie pas.
4. Ajouter les phrases à la voix douce si possible (`node jeu-darija/outils/voix/phrases.mjs`, puis `generer.py`).
5. Branche + PR ; la fusion sur `main` met en ligne (Worker Cloudflare `jeu-hbibiti`).
6. Le dimanche : le bulletin (espace parents du labo) et une ligne dans `~/echange-mythos/journal.md` sur harley-lab.

## Chapitre 1 : La super-machine (fait le 10 nov. 2026)
Pingo a caché les sept pièces de la super-machine ; chaque mission rend une pièce ; le 7e jour, la machine s'allume.
| N° | Domaine | Mission | Pièce |
|---|---|---|---|
| 1 | 🔢 | Les bulles de la fiole : compter de 10 à 15 bulles (2 fioles) | le ressort |
| 2 | 🤖 | Bip et la pièce cachée : 3 flèches, puis un chemin autour d'un mur | la petite roue |
| 3 | 🐧 | La souris magique : glisser fruits et ballons dans la bonne boîte (dossiers) | l'ampoule |
| 4 | 🔬 | Vivant ou pas vivant ? : trier 8 images | l'aimant |
| 5 | 🧩 | Le message secret de Pingo : PINGO | le fil de cuivre |
| 6 | 🏠 | La chasse aux aimants, avec Papa ou Maman, puis 2 questions | la manivelle |
| 7 | 🏆 | La machine s'allume : répéter les sons, compter les boulons, Bip jusqu'au bouton | badge « Apprenti du labo » |

## Chapitre 2 : Le grand match de Bip (écrit le 11 nov. 2026)
Thème soccer (Ali joue le mardi). Pingo a rangé le matériel du terrain n'importe où ; chaque mission rend un objet du match ; le 7e jour, c'est le grand match. Toujours le programme du mois 1, une marche au-dessus du chapitre 1 (compter jusqu'à 20, 3 dossiers, 2 murs pour Bip). Aucun nouveau moteur.
| N° | Domaine | Mission | Pièce |
|---|---|---|---|
| 1 | 🔢 | Les ballons du vestiaire : compter de 14 à 20, puis comparer (quelle équipe a le plus de joueurs, 12 ou 17) | le ballon du match |
| 2 | 🤖 | Bip dribble jusqu'au but : 4 flèches autour d'un mur, puis 6 flèches entre deux murs | le filet du but |
| 3 | 🐧 | Les dossiers du club : ranger des photos dans 3 dossiers (Soccer, Basket, Course), puis le double-clic | le sifflet |
| 4 | 🔬 | Le gazon du terrain : ce dont une plante a besoin (eau, soleil, air, terre), une plante dans le noir | le maillot |
| 5 | 🧩 | Les motifs de l'équipe : 2 suites à compléter, puis le mot secret BALLON | les crampons |
| 6 | 🏠 | La course avec Maman (ou Papa) : compter 20 pas à voix haute, sentir son cœur battre plus vite | la gourde |
| 7 | 🏆 | Le grand match ! : 4 sons, compter les supporters, un motif, Bip marque le but (6 flèches) | badge « Capitaine du labo » ⚽ |

**Correctif du 11 nov.** : l'écran du labo calculait « une par jour » chapitre par chapitre, donc la 1re mission du chapitre 2 aurait été ouverte tout de suite. Maintenant tout le labo est un seul fil de missions (`missionsState(MISSIONS…)` dans `act-labo.js`) : le chapitre suivant s'ouvre le lendemain du défi du précédent (test dans `labo.test.mjs`). Chaque chapitre a aussi une phrase `fin`, montrée quand le défi est réussi (avant, « La super-machine s'allume » était écrit en dur). Cache `hbibiti-v19`.

## Chapitre 3 : Le panier magique (écrit le 11 nov. 2026)
Thème basket (Ali joue le dimanche). Le docteur a inventé un panier qui compte les points ; Pingo a mélangé ses sept réglages. Fin du mois 1. **Nouveau moteur `clavier`** (le seul de la semaine) : taper un mot lettre par lettre, sur un clavier dessiné (QWERTY, comme au Canada) ou sur le vrai clavier de harley-lab ; `mot: '{prenom}'` = le prénom de l'enfant sans accents ; la petite main 👉 montre la lettre à trouver, la touche brille à l'indice. Testé dans `labo.test.mjs` (`motClavier`, valideur).
| N° | Domaine | Mission | Pièce |
|---|---|---|---|
| 1 | 🔢 | Les points du panier : 5 + 3, 10 + 4, 9 + 6 | le compteur de points |
| 2 | 🤖 | Bip monte l'escalier : → ↑ répété 3 fois (seul chemin possible), puis « quelle flèche vient après ? » | la petite échelle |
| 3 | 🐧 | Le clavier du labo : écrire son prénom, puis BIP | le bouton du panier |
| 4 | 🔬 | Ça flotte ou ça coule ? : trier 8 objets, pourquoi le ballon flotte | la bouée du labo |
| 5 | 🧩 | Les devinettes des formes : rond, carré, triangle (3 boîtes), 2 devinettes | le triangle du réglage |
| 6 | 🏠 | Les paniers du dimanche : 10 tirs avec Papa ou Maman, 10 − 3, « quand on rate, on réessaie » | le carnet des tirs |
| 7 | 🏆 | Le panier magique s'allume ! : 7 + 5, l'escalier, écrire PANIER, 4 sons | badge « Meneur du labo » 🏀 |

Correctif du même jour : l'indice écrit au niveau de l'étape d'un `quiz` est maintenant dit (avant, seul l'indice de chaque question l'était, sinon « Écoute encore la question »). Cache `hbibiti-v20`.

Avec les chapitres 1 à 3, le mois 1 est écrit (21 missions, jusqu'au 1er déc. environ si Ali joue chaque jour). **Prochain : chapitre 4** (début du mois 2 : + et − jusqu'à 100, les **boucles** avec Bip, la console de Pingo simulée `ls`/`cd`/`pwd` = prochain nouveau moteur, l'eau et ses états). À écrire avant le 1er décembre.

**Pas encore fait** (il faut être sur harley-lab) : comparer avec `~/Dr-Ali/jeu/` de Mythos, convertir les résultats qu'Ali y aurait déjà, et le bouton « ?labo=ali » dans la page de Mythos. 

## Sécurité, toujours
Pas de lien, pas de compte, pas de pub, pas d'achat, rien d'effrayant. Seule exception : les résultats du labo sont partagés entre les appareils de la famille par le Worker (code famille). Les vraies commandes Linux se tapent seulement avec papa, jamais `sudo`, jamais `rm` en vrai.
