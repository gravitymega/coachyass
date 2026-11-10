# Dr Ali : le labo du Dr Harley (dans le jeu de Hbibiti)

Plan écrit par Mythos le 8 novembre 2026 pour Dr Harley (harley-lab). Le 10 novembre 2026, l'utilisateur a demandé de l'**intégrer au jeu de Hbibiti** (`jeu-darija/`) : c'est maintenant l'activité **🔬 Le labo du Dr Harley** (profil qui lit seulement, donc Ali). Le plan d'origine prévoyait un jeu à part sur harley-lab (`~/Dr-Ali`, `labo/`, `jeu/`) ; ce dossier n'est pas dans le dépôt.

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
- `jeu-darija/act-labo.js` : l'écran et les **7 moteurs** : `compter`, `robot` (Bip et les flèches), `ranger` (glisser dans des boîtes), `secret` (message codé), `maison` (en vrai, confirmé par un parent), `quiz`, `sons` (mémoire). Prochains moteurs prévus par le plan : clavier, console simulée de Pingo, balance des nombres, horloge, monnaie, labyrinthe (au plus un nouveau moteur par semaine, testé à part).
- Progrès dans `progress.labo` de chaque enfant (localStorage, compris dans la sauvegarde JSON des parents) : `faits`, `essais` (réussite, essais, indices, solution montrée, temps), `revues`.
- Espace parents du labo (🔒 calcul) : bulletin de la semaine, réglage « une par jour », **📤 Télécharger les progrès pour Dr Harley** (`dr-ali-progres-AAAA-MM-JJ.json`). Le jeu tourne sur la tablette : harley-lab ne peut pas lire ses progrès tout seul, il faut lui donner ce fichier.
- Tests : `node --test jeu-darija/labo.test.mjs` (c'est aussi **le valideur** : une mission mal écrite fait échouer le test). Playwright : le chapitre 1 joué en entier (erreurs volontaires, indice, glisser à la souris, porte parents, mémoire des sons), téléphone 390×844 sans débordement.
- Voix : les phrases des missions sont dans `outils/voix/phrases.mjs` mais **pas encore enregistrées avec Kokoro** (le plan parlait de Piper sur harley-lab) ; en attendant, voix de la tablette.

## Comment Dr Harley ajoute une mission (chaque matin)
1. Lire le fichier de progrès d'Ali (s'il a été donné) : 3 essais ou plus ou solution montrée → la notion revient en plus facile ; réussie du premier coup → une marche au-dessus.
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

## Sécurité, toujours
Pas de lien, pas de compte, pas de pub, pas d'achat, rien d'effrayant. Le labo ne demande rien à Internet. Les vraies commandes Linux se tapent seulement avec papa, jamais `sudo`, jamais `rm` en vrai.
