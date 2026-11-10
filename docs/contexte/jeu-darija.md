# Jeu « L'Usine magique de Hbibiti » (`jeu-darija/`, 26 octobre 2026)

Projet **familial et personnel** de l'utilisateur, **hors écosystème Gravity/OSMM** (aucun lien avec Supabase, Notion ou les sites Netlify du dépôt) : un jeu pour tablette pour que ses enfants **Ali (7 ans)** et **Asma (5 ans)** apprennent la **darija marocaine (côté papa) et algérienne (côté maman)** et les bases de la religion musulmane. Ali aime Poppy Playtime, le soccer, le basket et la musique. Nom de la grand-mère du jeu choisi par l'utilisateur : **« Hbibiti »** (modifiable dans l'espace parents). V1 = PR #98 ; le même jour, l'utilisateur a demandé « un jeu pro et de qualité » → V2, puis des chapitres d'école (maths, lecture, formes, Défi éclair) → V3, puis des personnages vivants → V4, puis le coin Poppy Playtime et les histoires vraies → V5, puis voix douce, musique douce, Papa et Maman et missions du jour → V6, puis 70 mots de plus dans 6 nouvelles salles → V7, puis l’alphabet arabe et 61 mots de plus → V8, puis le mode bilingue anglais–arabe → V9 (même PR).

- **Concept** : l'usine de jouets de Hbibiti est envahie par le « brouillard de l'oubli » ; chaque bonne réponse réveille un jouet et fait reculer le brouillard. Inspiré de Poppy Playtime (usine, gant-grappin) **sans rien d'effrayant ni de personnage protégé**. Personnages originaux **dessinés en SVG dans `art.js`** : Hbibiti (foulard, lunettes), Grappo (gant robot), Assad (lion de l'Atlas, gardien 🇲🇦), Fifi (fennec, basket, maillot 🇩🇿 n° 10), Darbouka Dada, plus lanterne, tajine, panier, mosquée. Mots identiques dans les deux pays = « mot cousin 🤝 ». Jamais de punition (2 essais puis la réponse est montrée), pas de pub, pas d'achat, pas de compte.
- **6 salles** (`ROOMS` de `core.js`, mini-jeux dans `games.js`) : Hall d'entrée (salutations, portes + Grappo), Stade d'Assad (famille, tirs au but), Jardin de la mosquée (phrases du musulman + suites à remettre dans l'ordre : woudou, 5 piliers, 5 prières ; lanternes qui s'allument), Gymnase de Fifi (chiffres 1–10 et couleurs, paniers 2/3 points selon la série), Cuisine de Hbibiti (nourriture, ingrédient dans le tajine), Salle de la musique (verbes d'action, darboukas). Gymnase, cuisine et musique s'ouvrent après 2, 4 et 6 niveaux (réglage parent « tout ouvrir »). **75 mots** + 3 suites. **Aucun visage de prophète** (histoires de prophètes pas encore faites). Contenu religieux à faire relire par les parents.
- **Fichiers** : `core.js` (pur, `node --test jeu-darija/core.test.mjs` : `WORDS` avec `ma`/`dz` en lettres latines + arabe, `older` = réservé au profil qui lit, `phrase` = phrase religieuse identique partout ; `buildLevel`, `buildCoop`, Leitner `grade`, `mastery`, `SEQUENCES`/`sequenceChoices`, `MISSIONS`/`missionOfWeek`, `roomUnlocked`), `art.js`, `games.js`, `audio.js` (voix, petits sons Web Audio, musique de fond darbouka générée, option mélodie pentatonique), `store.js` (localStorage `hbibiti-*`, IndexedDB des voix, sauvegarde JSON), `app.js`, `index.html`, `styles.css`, `sw.js` (hors ligne, réseau d'abord ; **monter `CACHE` à chaque nouveau fichier**), `manifest.webmanifest`, `icons/`.
- **Profils** : « sait lire » (Ali) = écoute→image, français→darija écrite, cousin Maroc↔Algérie, 3 mots nouveaux par niveau ; sinon (Asma) = seulement écoute→image, tout est dit à voix haute. **Mode « Ensemble »** (frère-sœur) : les questions alternent, chacun à son niveau, progrès séparés. Histoire d'introduction (3 écrans) à la première partie, coffre du jour (+3 ⭐), album d'autocollants, **mission de la semaine** à faire en vrai (validée par un parent → autocollant doré + 5 ⭐).
- **Voix** : aucune voix de synthèse ne parle la darija. Les parents enregistrent les mots (« **enregistrement rapide** » : maintenir le bouton, mot après mot, par dialecte ; ou mot par mot ; ou import d'un fichier audio). Clé IndexedDB `<idMot>:<ma|dz>` (phrases du jardin : un seul enregistrement sert aux deux). Sinon voix temporaire `speechSynthesis`. La musique baisse quand une voix parle.
- **Espace parents** (multiplication) : voix, missions, progrès par salle, réglages (nom de la grand-mère, enfants, dialectes, écriture arabe — désactivée par défaut —, musique percussions/mélodie/aucune, sons, salles, limite de temps), **sauvegarde/restauration** (un fichier JSON avec voix + progrès, pour une autre tablette).
- **Testé** : tests Node ; Playwright/Chromium (voix simulée) : les 6 salles jouées en 1024×768, mode Ensemble en 1180×820, téléphone 390×844, enregistrement rapide avec micro simulé, sauvegarde téléchargée, aucune erreur ni débordement. Vraies voix de tablette et vrai micro iPad pas encore essayés.
- **Mise en ligne** : pas encore de site. Gratuit : Cloudflare Pages (projet séparé, root directory `jeu-darija`, sans commande de build) ou Netlify (base directory `jeu-darija`, `netlify.toml` présent). Le micro exige https. `noindex` + `robots.txt` en `Disallow`.

## Chapitres d'école : maths, lecture, formes et heure (26 octobre 2026, demande « rajoute des chapitres avec des défis d'apprentissage et des exercices de langue et de mathématiques pour enfants de 7 ans »)

- **3 nouvelles salles** (`ROOMS` avec `school: true`, questions fabriquées par `exercises.js`, pur, testé par `exercises.test.mjs`) :
  - **Atelier des nombres** (fusées qui décollent, scène `rocket`, ouverte dès le début). Profil qui ne lit pas : compter jusqu'à 6, reconnaître un nombre dit, le plus grand groupe, additions en images (points sous les chiffres). Profil qui lit : compter jusqu'à 20 par 5, additions/soustractions jusqu'à 10 puis 20, <, >, =, avant/après jusqu'à 100, doubles, suites (+1, +2, +5, +10), dizaines et unités, petits problèmes (Ali, Asma, Hbibiti, Fifi), **calcul en darija** (« Tlata + Jouj = ? », réponses en darija, voix des parents si enregistrées).
  - **Bibliothèque de Hbibiti** (livres qui s'ouvrent, scène `books`, ouverte dès le début). Ne lit pas : reconnaître une lettre dite, le premier son (image), compter les syllabes en tapant des mains. Lit : première lettre, lire un mot → image, image → bon mot, la lettre qui manque, rimes, compléter une phrase. Banque `MOTS` (50 mots illustrés ; nombre de syllabes orales seulement quand il n'y a pas d'ambiguïté de « e » muet).
  - **Tour de l'horloge** (ballons qui éclatent, scène `balloons`, ouverte après 3 niveaux) : formes (SVG `shapeSVG`), suites de couleurs, grand/petit ; pour qui lit : nombre de côtés, lire l'heure (heures et demies, horloge SVG `clockSVG`), jours de la semaine.
- Chaque **compétence** a sa boîte de révision (clé `x:<compétence>` dans `progress.words`) : une nouvelle compétence est essayée en premier, les plus fragiles reviennent plus souvent ; les plus difficiles n'apparaissent qu'après quelques niveaux dans la salle (`SKILLS[...].min`, compteur `progress.rooms`).
- **Défi éclair** (bouton sous la mission, après le 1er niveau) : 10 questions mêlées de toutes les salles ouvertes (mots déjà vus + exercices), chaque question dans la scène de sa salle, score sur 10 et **record** (`progress.best`). En mode Ensemble : 5 questions chacun, un record par enfant.
- Testé : 25 tests Node (400 tirages par compétence et par dialecte : 3 choix différents, une seule bonne réponse, calculs justes, darija dans le bon dialecte) ; Chromium : les 3 salles pour Ali et Asma en 1024×768, téléphone 390×844, Défi éclair seul et en mode Ensemble, aucune erreur.

## Personnages vivants (27 octobre 2026, demande « je veux que les personnages soient attachants dans leur conception, qui bougent et qui interagissent »)

- **Redessinés** dans `art.js` (Hbibiti, Assad, Fifi, Grappo, Dada) : chaque personnage est un `<div class="char" data-mood>` avec des parties animables (bras, tête, queue, oreilles, doigts…), de grands yeux avec pupilles et reflets, joues roses et **5 expressions** (`happy`, `talk`, `cheer`, `sad`, `wow`).
- **Vie au repos** (`characters.js`, `initCharacters()`) : respiration, clignement des yeux, regard qui **suit le doigt** de l'enfant, petits gestes propres à chacun toutes les quelques secondes (Hbibiti fait coucou, Assad remue la queue et rugit, Fifi bouge les oreilles et dribble, Grappo pianote des doigts, Dada tape sur la darbouka).
- **Interactions** : toucher un personnage le fait rire (son à lui : `giggle`, `roar`, `boing`, `beep`, `drum` dans `audio.js`), sauter et dire une phrase gentille (`PHRASES`). La bouche bouge pendant que la voix parle (événement `hbibiti-speaking`).
- **Un compagnon par salle** (`BUDDY` dans `app.js`) : il se présente sur l'écran Bismillah, reste à côté de la question pendant le jeu, saute de joie (étincelles) à chaque bonne réponse ou fait une petite moue encourageante, puis célèbre sur l'écran de récompense. Hbibiti accompagne l'écran « J'écoute ». Dans les scènes, les personnages réagissent aussi (le gardien est surpris quand on marque).
- Cache du service worker passé à `hbibiti-v4` (nouveau fichier `characters.js`).

## Coin Poppy Playtime et histoires vraies (27 octobre 2026, V5)

Demandes : « que la partie Poppy Playtime intègre des questions sur les personnages du jeu (traits, costumes, particularités) pour stimuler la participation d'Ali » et « diffuser en audio de petites histoires vraies tirées de l'histoire de l'islam, de la vie des savants, de la science, de la géographie, des maths ». À la demande explicite de l'utilisateur, le jeu nomme maintenant des personnages de Poppy Playtime (avant : seulement « inspiré de », sans personnage protégé).

- **Coin Poppy Playtime** (salle `poppy`, `fan: true`, ouverte après 1 niveau, scène `claw` = machine à pinces où Grappo attrape la bonne boîte ; icône `clawMachine()` dans `art.js`). Données `POPPY` dans `exercises.js` : Huggy Wuggy, Kissy Missy, Poppy, Mommy Long Legs, PJ Pug-a-Pillar, Bunzo Bunny, Boxy Boo, CatNap, DogDay, Bobby BearHug, Miss Delight, le GrabPack. **Aucune image officielle** : chaque personnage est un jeton de couleur avec un emoji. **Rien d'effrayant** : seulement l'apparence, le costume, le symbole, le rôle. Compétences : `p-who` (qui est-ce ?), `p-color` (couleur **en darija** : fourrure de Huggy, cheveux de Poppy, mains du GrabPack), `p-true` (vrai pour qui ?), `p-symbol` (symbole sur le ventre des Smiling Critters), `p-math` (calculs avec les personnages). Les indices partagés par deux personnages ont été retirés (test : un indice ne désigne qu'un seul personnage). Les parents peuvent masquer la salle (réglage `poppy`).
- **Les histoires de Hbibiti** (`tales.js`, bouton sous la mission sur la carte, écrans `s-tales` et `s-tale`) : **18 histoires vraies**, 5 pages chacune, lues à voix haute par la voix de la tablette (lecture automatique, pause, page suivante ou précédente), Hbibiti qui « parle » à côté, puis **2 questions** (+1 ⭐ chacune au premier essai, chacun son tour en mode Ensemble). Catégories : Islam (Zamzam, la Pierre noire, Asma aux deux ceintures, Bilal, Abou Hourayra, le puits d'Othmane), Savants (Fatima al-Fihri, Ibn Sina, l'émir Abdelkader, Al-Jazari), Sciences (Ibn al-Haytham, Abbas ibn Firnas), Géographie (Ibn Battouta, Al-Idrissi, Sahara et Atlas), Maths (Al-Khwarizmi, Fibonacci à Béjaïa, Al-Birouni). Pour le Prophète ﷺ et les Compagnons : **aucune personne dessinée**, seulement des lieux et des objets ; « ﷺ » est dit en entier (`speakTale`). Histoires écoutées : `progress.tales`, visibles dans l'onglet Progrès. Seulement des faits bien établis (sources : Sahih al-Bukhari pour Zamzam et Asma, sira pour la Pierre noire) ; **à faire relire par les parents** comme le jardin.
- Cache du service worker `hbibiti-v5`. Tests : `tales.test.mjs` (29 tests au total).

## Voix douce, musique douce, Papa et Maman, missions du jour (27 octobre 2026, V6)

Demandes : « une belle voix douce, presque réelle, et une musique de fond très douce », « rajoute papa et maman », « des missions que Ali et Asma doivent faire ».

- **Voix de Hbibiti** (`voix.js`, dossier `voix/`, outils dans `outils/voix/`) : les ~6 000 phrases françaises fixes du jeu (histoires, consignes, encouragements, questions d'exercices, missions) sont **enregistrées à l'avance** avec **Kokoro-82M** (licence Apache 2.0, voix française `ff_siwis`), calculée dans le conteneur, **sans aucun service payant**. Poids du modèle et voix récupérés sur npm (`kokoro-fp16-shards`, `kokoro-js`), car Hugging Face est bloqué par le proxy. Chaque phrase = `voix/<clé>.mp3` (clé = hachage cyrb53 du texte normalisé, `voiceKey`), liste dans `voix/index.json`. Le jeu joue le fichier par Web Audio (fiable sur iPad), sinon la voix de la tablette (choisie automatiquement parmi les plus naturelles, ou par le parent). `fixFr` réécrit la prononciation (Bismillah, Inchallah, ﷺ dit en entier, « 3 » de la darija lu « a »…). Le service worker garde les voix dans un cache à part (`hbibiti-voix`) ; bouton parents « Garder toutes les voix sur la tablette ». **Après un changement de texte** : `node jeu-darija/outils/voix/phrases.mjs > phrases.json` puis `generer.py` (voir l'en-tête du script ; seules les nouvelles phrases sont fabriquées, `--clean` retire les anciennes). Les phrases avec prénoms ne sont enregistrées que pour Ali, Asma et « Ali et Asma ». Le navigateur ne peut pas faire tourner Kokoro en français (kokoro-js ne gère que l'anglais), d'où l'enregistrement à l'avance.
- **Musique douce** (`audio.js`, réglage `music: 'doux'` par défaut) : berceuse générée dans le navigateur (boîte à musique en fa pentatonique, nappe d'accords filtrée, 66 BPM), aussi pendant les histoires et les missions ; elle baisse quand une voix parle.
- **Papa et Maman** (`art.js`) : Papa côté marocain (chemise rouge, étoile verte, barbe), Maman côté algérien (tunique verte et blanche, broche étoile et croissant), **foulard de Maman au choix** (réglage `mamaScarf`, activé par défaut). Ils vivent comme les autres personnages (phrases, gestes), accompagnent le stade (Papa) et la cuisine (Maman), et apparaissent sur la carte « J'écoute » : 🇲🇦 Maroc · Papa, 🇩🇿 Algérie · Maman.
- **Missions de Papa et Maman** (`missions.js`, écran `s-daily`, carte sous la mission de la semaine) : **3 missions par jour et par enfant**, les mêmes toute la journée : une en vrai en darija ou en religion, une pour aider, être gentil ou bouger, une dans le jeu. Adaptées à l'âge (ex. Al-Fatiha pour Ali, le petit tapis de prière pour Asma), avec le prénom du frère ou de la sœur. Les missions en vrai sont **confirmées par un parent** (question de calcul) : +3 ⭐, et les 3 missions = 1 médaille d'or ; les missions de jeu se valident toutes seules (niveau, histoire, coin Poppy, école, Défi éclair). État dans `progress.daily`. Tests : `missions.test.mjs` (33 tests au total).
- Correctif : l'histoire du début était coupée dès son lancement (la voix était lancée avant l'affichage de l'écran, qui l'arrêtait).

## Plus de mots : 6 nouvelles salles (27 octobre 2026, V7)

Demande « je veux plus de mots » : **70 mots en plus** (145 pour Ali, 119 pour Asma), chacun en 🇲🇦 et 🇩🇿 avec l'écriture arabe, dans 6 nouvelles salles qui s'ouvrent au fil des niveaux (icônes emoji, `HOSTS` `e-*` dans `app.js`) :

| Salle (`ROOMS`) | Thème | Mots | Jeu | Copain | Ouverte après |
|---|---|---|---|---|---|
| L'infirmerie de Fifi (`corps`) | le corps | 11 | panier de basket | Fifi | 2 niveaux |
| La ferme d'Assad (`animaux`) | les animaux | 12 | machine à pinces | Assad | 3 |
| La maison de Maman (`maison`) | la maison | 11 | portes | Maman | 5 |
| Le vestiaire de Papa (`vetements`) | les vêtements | 10 | fusées | Papa | 7 |
| Le balcon de Hbibiti (`ciel`) | ciel, météo, nature, hier/demain | 14 | ballons | Hbibiti | 8 |
| Le téléphone de Jedda (`appel`) | phrases pour parler à la famille (Je vais bien, Tu me manques, J'ai faim…) | 12 | darboukas | Maman | 9 |

Exemples de mots différents entre les deux pays : chat Mech / Qett, mouton Houli / Kebch, clé Sarout / Mefta7, fenêtre Chrjem / Taqa, lunettes Ndader / Mrayat, fleur Warda / Nouwwara, demain Ghedda / Ghodwa, « Je vais bien » Ana bikhir / Rani mlih, « Je ne sais pas » Ma3reftch / Ma3labalich, « Vite ! » Dghya / Fissa3. **À faire relire par les parents** (le vocabulaire varie selon les villes). Nouveau test : dans chaque salle, images, mots français et mots darija sont tous différents. Voix douce : 354 phrases ajoutées (6 314 au total).

## Encore plus de mots et l'alphabet arabe (27 octobre 2026, V8)

Demande « je veux que Ali ait accès à une plus grande base de mots arabes » → choix de l'utilisateur : **les deux** (plus de darija et l'arabe écrit).

- **L'école de l'alif** (salle `alif`, `school: true`, ouverte après 1 niveau, jeu des lanternes, compétences dans `exercises.js`, données `ALIF`) : les **28 lettres arabes**, chacune avec son nom et un mot illustré en arabe avec voyelles (أَرْنَب le lapin, بَيْت la maison…). Les lettres arrivent petit à petit (6 au début, puis 4 de plus par niveau joué dans la salle, paramètre `level` de `makeExercise`). Compétences : `a-same` (trouver la même lettre, aussi pour Asma), `a-hear` (la lettre dite à voix haute), `a-name` (le nom de la lettre), `a-first` (la première lettre d'un mot arabe), `a-read` (lire un mot arabe → image), `a-darija` (lire en écriture arabe les ~200 mots de darija du jeu → image, puis le mot est dit en darija). Deux lettres qui sonnent pareil pour une oreille française (ت/ط, ح/ه) ne sont jamais proposées ensemble.
- **6 nouvelles salles de darija** (61 mots) : Le marché de Hbibiti (fruits et légumes, jeu du tajine), La classe de Grappo (l'école), Le terrain de Fifi (le sport), La chambre des émotions (sentiments ; adjectifs au masculin), La rue des métiers, La fête de Hbibiti (Ramadan et l'Aïd : 3id mbarek / Saha 3idkoum, Ghriba / Makrout…). Elles s'ouvrent après 4, 6, 10, 11, 12 et 13 niveaux.
- Total : **206 mots** de darija pour Ali (174 pour Asma), 23 salles. Voix douce : 6 816 phrases. **À faire relire par les parents.**

## Mode bilingue anglais–arabe (27 octobre 2026, V9)

Demande « alterner anglais et arabe » → choix de l'utilisateur : **mode bilingue** (les parties alternent).

- Réglage parents `bilingual` (défaut `partie`) : `partie` = une partie en arabe (darija), la suivante en anglais, par enfant (`progress.nextLang`) ; `jour` = un jour sur deux ; `off` = arabe seulement. L'écran Bismillah annonce « Cette partie est en anglais / en arabe ».
- Concerne les **salles de mots** (pas le jardin, l'école, l'alif ni le Défi). `EN` dans `core.js` : la traduction anglaise de 192 mots (les oncles et tantes, identiques en anglais, et les phrases du jardin restent en arabe). `toEnglish(w)` donne un mot « vu en anglais » avec son propre suivi de révision (`id` = `en:<id>`) et la langue `en` à la place des dialectes ; `buildLevel(..., { lang: 'en' })`. Carte des nouveaux mots : un seul bouton « 🇬🇧 English ». Questions : écouter le mot anglais → image, ou « Comment on dit… en anglais ? ».
- Voix anglaise : **Kokoro `af_heart`** (voix américaine naturelle, mêmes poids, voix récupérée dans le paquet npm `kokoro-js`), clé `voiceKey('EN|' + mot)` ; sinon un enregistrement des parents (clé `<id>:en`), sinon la voix anglaise de la tablette. `generer.py` lit `voice` et `lang` par phrase (voices.npz avec `ff_siwis` et `af_heart`). Total : 7 204 phrases. Onglet Progrès : « Mots en anglais bien sus ».

## La ville de Hbibiti, jeu de plateforme en blocs (27 octobre 2026, V10)

Demande « une partie avec un jeu comme Minecraft : Ali et Asma doivent courir, sauter, se balader en ville pour chercher des missions ».

- Bouton **🏙️ La ville** sur la carte, écran `#s-ville` (canvas). Monde en blocs façon Minecraft (textures pixel dessinées en code, rien à télécharger) : `ville-core.js` (pur : plan, habitants, missions, testé par `ville.test.mjs`) et `ville.js` (dessin, physique, commandes).
- Commandes tablette : ◀ ▶ pour courir, ⤴ pour sauter (2 blocs max), 💬 pour parler quand on est près d'un habitant ; clavier aussi (flèches, espace). En mode Ensemble, le frère ou la sœur suit le joueur et les questions alternent.
- 8 quartiers de gauche à droite : maison, parc, souk, école, mosquée, ferme, dispensaire, stade. On peut monter sur les toits et les plateformes (marches prévues partout, traversée testée dans les deux sens).
- **10 habitants** (Maman, Papa, Fifi, Hbibiti, le boulanger, la maîtresse, l'imam, le fermier, la docteure, Assad) avec un « ! » quand ils ont une mission : d'abord **une question** de darija sur les mots de leur salle (2 essais, compte pour la révision), puis **« trouve-moi 3 … »** : l'objet est caché 3 fois loin de l'habitant, dont une fois en hauteur. Le bandeau du haut montre l'objectif et une flèche. En le rapportant, l'habitant dit le mot en darija marocaine et algérienne (+2 étoiles).
- **Pièces** à ramasser (10 pièces = 1 étoile). Mission du jour automatique « Aide un habitant de la ville » (`j-ville`, Maman). `progress.ville` compte les missions réussies.
- Voix : phrases de la ville ajoutées au collecteur (7 427 phrases au total).

## Jouer en local, gratuitement (27 octobre 2026)

Aucune dépendance en ligne : tout est dans `jeu-darija/`, voix comprises. Il faut seulement un petit serveur local, car les modules JS ne marchent pas en `file://`.
- **Mac / Linux** : double-clic sur `lancer-mac-linux.command`, qui utilise `python3 -m http.server 8000`. La tablette peut ouvrir l'adresse affichée si elle est sur le même Wi-Fi.
- **Windows** : `lancer-windows.bat`, qui lance `outils/serveur.ps1`, un serveur PowerShell sans installation ; il écoute seulement sur `localhost`.
- Le mode hors ligne et l'installation sur l'écran d'accueil (service worker) demandent `localhost` ou `https`. Sur la tablette, il faut donc mettre le jeu en ligne gratuitement (Cloudflare Pages ou Netlify) pour l'installer.

## Prononciation des prénoms (27 octobre 2026)

- La voix française lisait « Hbibiti » comme « bibiti ». `fixFr` (voix.js) le réécrit en « Hebibti » (حبيبتي).
- `generer.py` (`NAMES`, `darija_names`) remplace les phonèmes français de Hbibiti, Ali, Asma et Assad par une prononciation darija avant la synthèse : accent sur la 1re syllabe, coup de glotte (`ʔˈali`, `ʔˈasma`, `ʔˈasad`, `hbˈibti`).
- 635 phrases ont été réenregistrées.

## Carnet de fierté (27 octobre 2026)

- Nouvel onglet **🏆 Carnet** dans l'espace parents : ce que chaque enfant a appris ces 7 derniers jours. On y voit les nouveaux mots de darija (avec 🇲🇦 et 🇩🇿), les mots d'anglais, les histoires, les missions, les habitants aidés en ville, les étoiles et le nombre de jours joués.
- Le bouton **📤 Envoyer aux grands-parents** ouvre le partage de la tablette (WhatsApp, SMS…), ou copie le texte si le partage n'est pas disponible.
- `carnet.js` est pur et testé par `carnet.test.mjs`. `recordDay` garde chaque jour une photo des compteurs dans `progress.days` (60 jours au plus) ; il est appelé par `saveAll`. `weekReport` calcule la différence avec la dernière photo d'avant la semaine, et `reportText` écrit le message.

## Les activités (27 octobre 2026, V11)

Demande : ajouter, en option, toutes les idées proposées. Sur la carte, une section **🎈 Les activités** (17 tuiles). Chaque activité peut être coupée dans Réglages, « Activités proposées aux enfants » (`settings.acts[id] = false`). Fichiers : `activites.js` (liste `ACTS`), `act-kit.js` (écran `#s-act`, questions à 2 essais `choose`, `askWord`, micro `holdToRecord`), `act-data.js` (données pures, testées par `act.test.mjs`), `act-ecole.js`, `act-monde.js`, `act-jeux.js`, `act-famille.js`, `calendrier.js` (testé par `calendrier.test.mjs`).

- **🏗️ Construire** (ville, bouton 🧱) : on achète des blocs avec ses pièces (`SHOP` dans `ville-core.js` : bois, pierre, brique, mur blanc, verre, toit, tapis, coupole, lanterne, or ; de 1 à 5 pièces). On pose un bloc collé à un autre (`canPlace`), et on touche son propre bloc pour l'enlever (pièces rendues). Les constructions sont communes à la famille (`localStorage hbibiti-build`). Les pièces de l'enfant sont dans `progress.coins` : les pièces ramassées en ville, plus 5 par niveau réussi.
- **✍️ Tracer les lettres** : la lettre est en pointillés, avec un point vert et une flèche de départ en haut à droite. C'est réussi si le tracé couvre au moins 72 % de la lettre sans trop en sortir. Asma a les 10 premières lettres, Ali les 28. Suivi dans `progress.trace`.
- **📖 Petites sourates** (Al-Fatiha, Al-Ikhlas, Al-Kawthar, Al-Falaq, An-Nas) : texte arabe avec voyelles, lecture en lettres latines et sens en français. Les parents enregistrent la récitation dans l'activité (bouton « 🎙 Parents », clé IndexedDB `q:<sourate>:<ligne>`), car la voix de synthèse ne récite pas le Coran. L'enfant écoute, répète au micro, puis remet les lignes dans l'ordre. Pour Al-Fatiha, la basmala est la 1re ligne (numérotation Hafs). **À faire relire par les parents.**
- **🎤 Miroir des mots** : on écoute le modèle (enregistrement des parents ou voix), l'enfant dit le mot en maintenant le micro, puis le jeu fait entendre le modèle et la voix de l'enfant l'un après l'autre. Rien n'est gardé.
- **🌙 Ramadan** : la ville de nuit, avec étoiles, croissant de lune et guirlandes de lanternes ; les lanternes posées par les enfants brillent. Les missions « trouve 3 objets » viennent alors de la salle de la fête. Ce mode s'allume tout seul pendant le Ramadan et l'Aïd (`ramadanInfo`, calendrier Umm al-Qura du navigateur), et le bouton 🌙 de la ville le change à la main. La carte affiche « Le Ramadan arrive dans N jours ».
- **👨‍👧 Duel en famille** : 10 questions à tour de rôle. Papa répond en darija marocaine, Maman en darija algérienne.
- **🗺️ Voyage** : Casablanca, Fès, Marrakech, Alger, Oran, Constantine. Pour chaque ville : un monument avec une anecdote, un plat et un mot, puis un quiz de 3 questions. Le tampon gagné va dans `progress.passport`.
- **🍲 Cuisine** (msemen, harira, couscous) : on apporte les ingrédients en comptant (« Jib 3… »), avec le mot de darija quand il existe, puis on remet les étapes dans l'ordre.
- **🕌 99 noms d'Allah** : un nouveau nom par jour (`progress.noms`), avec l'arabe, la lecture et le sens. **À faire relire.**
- **🧮 Marché au souk** : payer le bon prix avec des pièces de 1, 2 et 5 (dirhams chez le marchand de Fès, dinars chez celui d'Alger). Ali doit aussi rendre la monnaie. Les nombres sont dits en darija.
- **⏰ Heures de prière** : calculées sur la tablette pour Montréal (`prayerTimes`). Méthodes au choix : ISNA 15° (par défaut), Ligue islamique mondiale, Maroc 19°/17°, Algérie 18°/17° (`settings.prayerMethod`). La tuile de la carte affiche la prochaine prière, et la lanterne s'allume pendant les 20 minutes qui suivent l'adhan.
- **⚽ Championnat d'Assad** : les Lions d'Assad contre le Raja, le MCA, le Wydad et la JSK. Chaque bonne réponse de darija est un but. 9 points ou plus donnent la coupe (`progress.league`).
- **🏀 Basket de Fifi** : 6 lancers francs (tirer en arrière puis lâcher, comme un lance-pierre), avec une question de maths avant chaque tir.
- **🎵 Studio** : une grille de 8 temps pour darbouka doum, darbouka tek, bendir et qraqeb, avec des sons fabriqués en Web Audio. On garde 3 rythmes (`progress.rhythms`).
- **🧸 Mon animal** : un chat (Mech/Qett) ou un chameau (Jmel), à nourrir (1 ⭐) et à habiller (accessoires achetés avec des étoiles). Il grandit tous les 5 repas, jusqu'au niveau 5 (`progress.pet`).
- **📸 Qui c'est ?** : les parents ajoutent des photos de la famille (réduites à 900 px, clé IndexedDB `photo:*`, liste dans `settings.photos`). Le quiz demande « Qui c'est ? » avec les mots de la famille en darija.
- **📞 Messages** : les parents importent les messages vocaux des grands-parents (fichier WhatsApp, clé `gp:*`, liste dans `settings.gpMsgs`). Un message pas encore écouté apparaît comme surprise sur l'écran de récompense.
- Les boutons « parents » de ces activités demandent une confirmation (`confirm`), pas la multiplication.
- La voix douce couvre les phrases fixes des activités (8 463 phrases au total). Les autres passent par la voix de la tablette.

## Mise en ligne sur Cloudflare (27 octobre 2026)

- Netlify a refusé le déploiement : « Skipped due to account credit usage exceeded », les crédits gratuits du compte sont épuisés. Le site Netlify `jeu-hbibiti` existe mais reste vide.
- L'utilisateur a choisi **Cloudflare, séparé d'Art craft**. On utilise le Worker `jeu-hbibiti`, qui ne sert que les fichiers statiques : `jeu-darija/wrangler.toml` avec `[assets] directory = "."`, et `.assetsignore` pour exclure `outils/`, les tests, les lanceurs, `netlify.toml` et `wrangler.toml`. `npx wrangler deploy --dry-run` lit 8 527 fichiers, sous la limite gratuite de 20 000. `_headers` (noindex, `sw.js` sans cache) est respecté.
- À relier par l'utilisateur dans le tableau de bord Cloudflare : Workers & Pages › Create › Import a repository › `gravitymega/coachyass`, Project name `jeu-hbibiti`, Root directory `jeu-darija`, Deploy command `npx wrangler deploy`, sans build. Adresse : `https://jeu-hbibiti.moqtad6.workers.dev`.

## Poppy Playtime : chapitres 3 à 5 (27 octobre 2026)

Demande : « beaucoup d'éléments de Poppy Playtime, chapitre 5 ». Le chapitre 5, *Broken Things*, est sorti le 18 février 2026 ; les faits ont été vérifiés par une recherche web. Comme avant, on garde **seulement des questions et des emojis, sans images du jeu et sans rien qui fasse peur**.
- **13 nouveaux personnages** dans `POPPY` (`exercises.js`), avec le chapitre où on les rencontre (`ch`) :
  - chapitre 3 : les autres Smiling Critters (Bubba Bubbaphant, Hoppy Hopscotch, KickinChicken, PickyPiggy, CraftyCorn) ;
  - chapitre 4 : Doey the Doughman, Yarnaby, Pianosaurus ;
  - chapitre 5 : Lily Lovebraids, Giblet, Chum Chompkins, Glowby, Ms. Gracie.
- Nouvelle compétence **`p-chap`** (Ali, à partir de 2 niveaux) : « Dans quel chapitre rencontre-t-on… ? ». Deux nouveaux calculs : les rubans de Lily et les écritures de Glowby.
- Nouvelle activité **🔦 La lampe de Glowby** (`glowby` dans `act-jeux.js`, visible seulement si le coin Poppy est activé). Le mur est dans le noir ; on promène la lumière avec le doigt pour trouver 5 mots de darija cachés (en écriture latine pour Ali, en emoji pour Asma). Cela donne 3 étoiles.
- **Le héros, c'est l'enfant** (demande « le player incarné Ali ») : dans le coin Poppy, « the Player » porte le prénom de l'enfant qui joue. Le marqueur `{joueur}` dans les indices est remplacé par le prénom, avec l'élision du français (« le sac à dos d’Ali », « de Sami ») ; on passe `player` à `makeExercise`, `buildExerciseLevel`, `buildChallenge` et `buildCoop`. Nouveau personnage `player` (🦸) : « C’est le héros qui explore l’usine Playtime Co. avec le GrabPack. C’est toi ! ». Sa réponse affiche le prénom de l'enfant.

## Décors du bled dans la ville (27 octobre 2026)

Demande : « va sur le web trouver des paysages et décorations ». Les banques d'images libres (Kenney, OpenGameArt, Poly Haven) sont bloquées par le réseau de la session. La seule trouvée sur GitHub (Kenney Pixel Platformer, CC0) est générique. Les décors sont donc **dessinés en code** dans le style en blocs, sans aucun droit à payer :
- **Arrière-plan qui défile en 3 plans** (`scenery` dans `ville.js`) : les montagnes de l'Atlas avec de la neige, les dunes avec des palmiers d'oasis, et une médina blanche et ocre avec fenêtres, minarets à lanterneau vert et tours de kasbah crénelées. La nuit de Ramadan, les fenêtres s'allument.
- **Nouveaux blocs de décor** (`ville-core.js`) : zellige (bandeau de la mosquée et de l'école), palmier (tronc et palmes), eau, porte en arc outrepassé avec porte en bois clouté (maison, école, mosquée, dispensaire), et fontaine du souk en zellige avec son bassin.

## La ville en 3D avec Three.js (3 novembre 2026)

Question de l'utilisateur sur des listes de bibliothèques (Three.js, R3F, GSAP, React Bits…), puis : « utilise ce qui peut apporter de plus ». Seul **Three.js** apporte vraiment quelque chose. Les autres bibliothèques servent aux sites vitrines React, alors que le jeu est en JS pur et a déjà ses animations.
- **Three.js r170** (licence MIT) est copié dans `jeu-darija/lib/three.module.min.js` (690 Ko, licence dans `lib/three-LICENSE.txt`). Il est chargé à la demande (`import()`) seulement quand on ouvre l'activité, et mis en cache par le service worker : ça marche hors ligne.
- Activité **🧊 La ville en 3D** (`ville3d.js`, avec le plan pur dans `ville3d-core.js`, testé par `ville3d.test.mjs`) :
  - une ville de 36 × 36 blocs : remparts crénelés, mosquée avec coupole verte et minaret, maisons blanches et ocre à porte bleue et toits plats accessibles par des caisses, souk avec toiles rayées et tapis, fontaine en zellige, palmiers, petit terrain de foot, et montagnes de l'Atlas enneigées au loin ;
  - Ali (ou Asma) en blocs, vu de dos, avec une caméra qui ne traverse pas les murs et qui se tourne vers l'habitant pendant une discussion ;
  - commandes : joystick à gauche, glisser le doigt pour tourner la caméra, bouton saut (un bloc), et clavier ZQSD, WASD ou flèches ;
  - 8 habitants avec des missions comme dans la ville en 2D : une question de darija (`askQuestion`), puis « trouve 3 … », avec des objets en emoji cachés loin et au moins un sur un toit. `walkable()` garantit que tout est atteignable à pied. Les pièces ramassées vont dans `progress.coins`.
  - Rendu : un `InstancedMesh` par sorte de bloc (seulement les faces visibles), des textures pixel 16 × 16 dessinées en code, pas d'anticrénelage et une résolution limitée à 1,5 pour économiser la batterie.
- **Médina en labyrinthe** (demande « la ville en labyrinthe avec des rues et des ruelles ») : `makeWorld3d` creuse un labyrinthe dans un bloc de maisons blanches et ocre (3 ou 4 étages). Il y a 8 × 8 carrefours reliés par un parcours en profondeur, avec une graine fixe pour garder toujours le même plan, plus 12 % de passages en plus pour faire des boucles.
  - **Rues** de 2 blocs et **ruelles** d'un seul bloc (40 % des passages) ; une **grande rue** est-ouest et une nord-sud de 4 blocs.
  - Une **place centrale** carrelée de zellige, avec fontaine et palmiers ; le **souk** (tapis au sol, toiles au-dessus) dans la grande rue côté est ; la **mosquée** en haut à droite, avec sa porte sur une rue ; le **terrain de foot** en bas à gauche.
  - Des portes bleues et en bois sur les murs, des caisses pour grimper sur les toits (des raccourcis), et les remparts tout autour.
  - **Pour ne pas se perdre** : des **traces de pas dorées** au sol (`pathTo`, le chemin le plus court à pied, recalculé toutes les 0,35 s) ; la flèche suit ce chemin et non la ligne droite. Une **petite carte vue du ciel** en haut à droite montre Ali, les habitants qui ont une mission, les objets et le chemin.
  - Tests (`ville3d.test.mjs`) : tous les carrefours sont reliés, il y a au moins 5 ruelles, il existe un chemin vers chaque habitant, et le chemin vers Maman fait des détours.
- **Le GrabPack de Poppy Playtime partout** (demande « la [main] de Poppy Playtime doit être utilisée partout ») : Ali porte le sac gris avec une main bleue et une main rouge dans la **ville en 2D** et dans la **ville en 3D**. Le bouton ✋ (touche G ou F au clavier) lance la main, bleue puis rouge, à tour de rôle, vers l'objet de mission le plus proche, sinon vers la pièce la plus proche visible (portée de 7 blocs en 2D, 10 en 3D, sans mur entre Ali et l'objet). La main ramène l'objet au bout de son câble ; s'il n'y a rien à attraper, elle part tout droit et revient.

## Très grande ville 2D (3 novembre 2026)

Demande : « la ville 2D très grande ». La largeur passe de 168 à **468 blocs** (`W` dans `ville-core.js`), avec 18 quartiers. À la suite du stade, on trouve :
- **la gare** : bâtiment blanc, horloge dorée, toit accessible ;
- **le port** : mer, barques à voile, phare, caisses (sol en pierre) ;
- **la kasbah** : remparts ocre, tours crénelées, grande porte et **chemin de ronde** où l'on marche ;
- **le hammam** à coupoles ;
- **la forêt de l'Atlas** : collines jusqu'à 3 blocs et cèdres ;
- **le désert** : sol en sable `T.DUNE`, dunes, palmiers ;
- **l'oasis** : bassin et tente rayée ;
- **la plage** : mer, parasols, château de sable ;
- **le village berbère** : maisons ocre à toit plat et grande porte ;
- **la colline aux étoiles**, avec un observatoire.

**10 nouveaux habitants** avec leurs missions : le chef de gare (appel), le pêcheur (animaux), le gardien de la kasbah (salutations), la dame du hammam (corps), le berger (ciel), le chamelier (nombres), le musicien gnaoua (musique), le maître-nageur (sport), le grand-père du village (fête) et l'astronome (émotions). Leurs tenues sont dans `LOOKS` (`ville.js`).

Autres changements :
- 110 pièces au lieu de 40 ;
- nouvelles textures `T.OCRE` et `T.DUNE`.

Vérifications :
- Traversée complète testée à pied, en courant et en sautant, dans les deux sens (de 1 à 466).
- Les tests de `ville.test.mjs` passent : marches de 2 blocs au plus, habitants au sol, missions valides.
- 9 131 phrases de voix.

## Ville en 3D : bâtiments, mouvements, discussions (3 novembre 2026)

Demande : « 3D : les joueurs peuvent entrer dans les bâtiments, sauter, se pencher, courir, se baisser, ramper à plat ventre, discuter avec les habitants et avoir des réponses comme dans la vraie vie ».

**Entrer dans les bâtiments**
- Chaque porte bleue ou en bois de la médina (plus de 10 portes, `world.doors`) affiche le bouton « 🚪 Entrer » quand on est devant. Il mène à un intérieur (`makeInterior` dans `ville3d-core.js`) :
  - **maison** : salon marocain avec sedari, table basse et théière, tapis, télé, lanternes ;
  - **mosquée** : rangées de tapis, mihrab vert et doré, minbar, lustres, Corans, fontaine d'ablutions ;
  - **boulangerie** : four, comptoir avec les pains, sacs de farine ;
  - **école** : tableau, pupitres, bureau du maître, livres.
- La porte de la mosquée mène à la mosquée, celles du souk à la boulangerie, les autres à une maison ou à l'école.
- Chaque intérieur a son habitant : la tante, le muezzin, la boulangère, le maître.
- La vue de l'intérieur se fait de haut, comme une maison de poupée (le mur de devant est bas). « 🚪 Sortir » ramène devant la porte.

**Mouvements** (colonne de boutons à gauche, et touches du clavier)
- 🏃 courir (×1,7 ; touche R ou Maj) ;
- 🧎 s'accroupir (C) ;
- 🐛 ramper à plat ventre (X) : le personnage mesure alors 0,55 bloc ;
- ⤺ ⤻ se pencher (maintenir le bouton ; touches N et M) : la caméra glisse sur le côté pour regarder au coin d'une ruelle ;
- ⤴ sauter (en rampant, ce bouton relève le personnage).
- **Passages secrets** : de 3 à 7 trous d'un seul bloc de haut dans les murs (`world.tunnels`), où l'on ne passe qu'à plat ventre, avec une pièce au milieu. On ne peut pas se relever s'il n'y a pas la place.

**Discuter avec les habitants**
- Le bouton 💬 propose « 🎯 La mission » ou « 💬 Discuter ».
- **Questions toutes prêtes**, qui marchent hors ligne et ont la voix douce : « Comment ça va ? », « Comment tu t'appelles ? », « Qu'est-ce que tu fais ici ? », « Qu'est-ce que tu aimes ? », « Raconte-moi quelque chose ! », et « Apprends-moi un mot ! » (un mot de darija de la salle de l'habitant). Les réponses et la personnalité de chacun sont dans `ville3d-dialogues.js`. **À faire relire.**
- **Discussion libre** : l'enfant pose sa question au micro (reconnaissance vocale de la tablette, en français) ou au clavier.
  - Le Worker `jeu-hbibiti` (`jeu-darija/worker/index.js`, `main` dans `wrangler.toml`, liaisons `ASSETS` et `AI`) répond à `POST /api/parler` avec **Workers AI**, gratuit : `@cf/meta/llama-4-scout-17b-16e-instruct`, puis `llama-3.1-8b-instruct` en secours.
  - Consignes pour enfants : 1 ou 2 phrases simples, jamais de violence, de peur ou de contenu adulte, pas d'informations personnelles demandées ; si la question n'est pas adaptée, « demande à Papa ou à Maman ». Le personnage reste dans son rôle.
  - Les liens et la mise en forme sont retirés, et la réponse est coupée à 320 caractères.
  - Sans Internet ou si l'IA ne répond pas, l'habitant dit gentiment de demander à Papa ou à Maman.
- Réglage parents : « Discussion libre avec les habitants » (`settings.chatIA`, activé par défaut). Sans cette option, il ne reste que les questions toutes prêtes.

**Tests et voix**
- Correction : le nom `fetch` (la mission en cours) cachait la fonction réseau ; on appelle maintenant `window.fetch`.
- `ville3d.test.mjs` vérifie les portes, les intérieurs et les passages ; `worker.test.mjs` vérifie le serveur avec une fausse IA ; Playwright couvre les poses, le passage secret, les 4 intérieurs et les discussions.
- 9 198 phrases de voix.

## Usine : révision, série de jours, navigation (3 nov. 2026)
- **Révision de Hbibiti** (`#map-review`, apparaît dès 3 mots fragiles) : `weakWords`/`buildReview` (exercises.js) reprennent les mots vus en boîtes 0-1 des salles ouvertes, chacun dans le jeu de sa salle ; ne compte pas comme partie d'une salle.
- **Série de jours 🔥** : `streak(progress)` (carnet.js, à partir de `progress.days`), affichée en haut de l'usine (dès 2 jours) et sur l'écran de récompense avec les +5 🪙.
- En-tête : ⭐ + 🪙 + 🔥. Barre de navigation collante (Salles / Activités / Ville et histoires) ; les salles passent avant les activités.
- Vibration courte (bonne réponse) / double (erreur) sur Android, réglage parents `set-buzz` (`settings.buzz`).
- Cache SW `hbibiti-v15`. Tests : carnet (série) et exercises (révision).

## Historique des parties par profil (3 nov. 2026)
- `logGame(progress, entry)` (carnet.js) ajoute chaque partie terminée dans `progress.history` (300 max, gardé dans le profil `hbibiti-p-<id>`) : salles, défi éclair, révision (score/total, étoiles, « avec » le frère ou la sœur en coop), activités qui donnent des étoiles (`actCtx.stars`, via `curAct`), missions en ville (`villeDone`).
- Affichage : album 📒 (« Mes parties », 40 dernières, groupées par jour) et espace parents → Carnet (« Historique des parties », 100 dernières). `gameLine(e)` fait la ligne lisible.
- Cache SW `hbibiti-v16`.

## Les sports d'Ali : les habitants l'encouragent (10 nov. 2026)

Demande : « Ali va au soccer les mardis et le dimanche au basket, puis il fait de la course avec sa maman ; on veut que tu l'encourages à chaque fois que tu lui parles ».

- `SPORTS`, `encouragement(kid, date, n)` et `aboutKid(kid, date)` dans `ville3d-dialogues.js` (seulement pour le profil Ali : id `ali` ou prénom « Ali »). Test : `ville3d-sports.test.mjs`.
- **Ville en 3D, discussion** : après le bonjour, chaque habitant ajoute un encouragement selon le jour : dimanche = basket, samedi = « demain c'est le basket », mardi = soccer, lundi = « demain c'est le soccer », les autres jours = la course avec Maman (Maman dit « avec moi »). La phrase varie d'un habitant à l'autre (`ENCOURAGEMENTS`).
- **Discussion libre (IA)** : le jeu envoie `about` (les sports d'Ali + le jour) au Worker ; la consigne demande d'encourager Ali pour son sport **à chaque réponse** (2 ou 3 phrases, 35 mots au plus). Sans `about` (Asma), rien ne change. Test dans `worker.test.mjs`.
- Les 11 nouvelles phrases sont dans `outils/voix/phrases.mjs` (9 209 phrases) mais **pas encore enregistrées avec Kokoro** : en attendant, c'est la voix de la tablette qui les dit. Cache `hbibiti-v17`.
- Pour la session harley-lab : quand on parle à Ali (ou de lui), l'encourager pour son soccer (mardi), son basket (dimanche) et sa course avec Maman.

## Le labo du Dr Harley, « Dr Ali » (10 nov. 2026)

Demande : intégrer au jeu le plan « Dr Ali » (école secrète où Dr Harley forme Ali, une mission par jour). Nouvelle activité **🔬 Le labo du Dr Harley** (profil qui lit), chapitre 1 « La super-machine » complet, 7 moteurs. Tout est décrit dans **`docs/contexte/dr-ali.md`** (plan, règles, format des missions, comment Dr Harley en ajoute une). Fichiers : `labo-core.js`, `labo-missions.js`, `act-labo.js`, `labo.test.mjs`. `openGate` ajouté au contexte des activités. Cache `hbibiti-v18`.
