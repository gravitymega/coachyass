// Les missions du labo du Dr Harley : DES DONNÉES SEULEMENT. Dr Harley en ajoute une par jour (tôt le matin),
// toujours au moins 3 d'avance. Format vérifié par `node --test jeu-darija/labo.test.mjs` (valideur de labo-core.js).
//
// Une mission :
//   { id: 'c1-m1', domaine: 'maths'|'code'|'ordi'|'sciences'|'enigme'|'maison'|'defi', titre, piece: { e, nom },
//     histoire: [1 à 3 phrases courtes dites par le docteur, nombres en lettres], notions: ['compter-15', …],
//     etapes: [ { moteur, consigne, indice?, ... } ] }
// Les moteurs (act-labo.js) :
//   compter : { min, max, objet: '🫧' }                         → compter des objets, 3 nombres au choix
//   robot   : { largeur, hauteur, depart: [x,y], but: [x,y], murs: [[x,y]…], maxFleches, objet: '🪙' }
//   ranger  : { boites: [{ id, e, nom }], objets: [{ e, nom, boite }] } → glisser (ou toucher puis toucher) dans la bonne boîte
//   secret  : { code: { P: '⭐', … }, mot: 'PINGO' }                → retrouver le mot caché dessin par dessin
//   maison  : { aFaire: 'texte', questions: [{ q, choix: [{ t, bon? }] }] } → en vrai avec Papa ou Maman, puis questions
//   quiz    : { questions: [{ q, dit?, choix: [{ t, bon? }] }] }
//   sons    : { longueur: 3 }                                       → répéter les sons dans l'ordre
//   clavier : { mot: 'BIP' | '{prenom}' }                           → taper le mot lettre par lettre (clavier dessiné ou vrai clavier)
// Un chapitre : { id: 'c2', titre, histoire, badge: { e, nom }, fin: 'phrase montrée quand le défi est réussi', missions: [7 missions] }.
// Le chapitre suivant s'ouvre le lendemain du défi du précédent (une seule nouvelle mission par jour dans tout le labo).
// Indice après 2 essais ratés, solution montrée après 3, puis une nouvelle chance (act-labo.js).

export const CHAPITRES = [
  {
    id: 'c1',
    titre: 'La super-machine',
    histoire: 'Pingo a voulu aider… et il a caché les sept pièces de la super-machine du docteur dans le labo. Chaque mission rend une pièce. Le septième jour, la machine s’allume !',
    badge: { e: '🧪', nom: 'Apprenti du labo' },
    fin: '⚡ La super-machine s’allume ! ⚡',
    missions: [
      {
        id: 'c1-m1', domaine: 'maths', titre: 'Les bulles de la fiole', piece: { e: '🌀', nom: 'le ressort' },
        histoire: ['Oh ! La fiole fait des bulles.', 'Pingo a caché le ressort dedans.', 'Compte les bulles pour le retrouver !'],
        notions: ['compter-15'],
        etapes: [
          { moteur: 'compter', consigne: 'Combien de bulles dans la fiole ?', indice: 'Touche chaque bulle en comptant : elle devient jaune.', min: 10, max: 15, objet: '🫧' },
          { moteur: 'compter', consigne: 'Encore une fiole ! Combien de bulles ?', indice: 'Compte par rangées.', min: 10, max: 15, objet: '🫧' },
        ],
      },
      {
        id: 'c1-m2', domaine: 'code', titre: 'Bip et la pièce cachée', piece: { e: '⚙️', nom: 'la petite roue' },
        histoire: ['Voici Bip, mon petit robot.', 'Bip ne bouge que si tu lui donnes des flèches.', 'Amène Bip jusqu’à la pièce !'],
        notions: ['suite-fleches'],
        etapes: [
          { moteur: 'robot', consigne: 'Mets trois flèches pour amener Bip jusqu’à la pièce, puis appuie sur Go.', indice: 'Regarde : la pièce est à droite de Bip. Commence par la flèche droite.', largeur: 4, hauteur: 3, depart: [0, 1], but: [3, 1], murs: [], maxFleches: 3, objet: '⚙️' },
          { moteur: 'robot', consigne: 'Attention, un mur ! Trouve un autre chemin.', indice: 'Bip peut monter avant d’aller à droite.', largeur: 4, hauteur: 3, depart: [0, 1], but: [2, 1], murs: [[1, 1]], maxFleches: 4, objet: '⚙️' },
        ],
      },
      {
        id: 'c1-m3', domaine: 'ordi', titre: 'La souris magique', piece: { e: '💡', nom: 'l’ampoule' },
        histoire: ['Dans un ordinateur, on range les choses dans des dossiers.', 'Un dossier, c’est comme une boîte.', 'Range chaque objet dans la bonne boîte !'],
        notions: ['glisser', 'dossiers'],
        etapes: [
          { moteur: 'ranger', consigne: 'Glisse chaque objet dans la bonne boîte.', indice: 'Les fruits vont dans la boîte des fruits, les ballons dans la boîte du sport.',
            boites: [{ id: 'fruits', e: '🧺', nom: 'Fruits' }, { id: 'sport', e: '📦', nom: 'Sport' }],
            objets: [{ e: '🍎', nom: 'pomme', boite: 'fruits' }, { e: '⚽', nom: 'ballon de soccer', boite: 'sport' }, { e: '🍌', nom: 'banane', boite: 'fruits' }, { e: '🏀', nom: 'ballon de basket', boite: 'sport' }, { e: '🍇', nom: 'raisin', boite: 'fruits' }, { e: '👟', nom: 'chaussure de course', boite: 'sport' }] },
        ],
      },
      {
        id: 'c1-m4', domaine: 'sciences', titre: 'Vivant ou pas vivant ?', piece: { e: '🧲', nom: 'l’aimant' },
        histoire: ['Ce qui est vivant grandit, mange et respire.', 'Une pierre ne grandit pas : elle n’est pas vivante.', 'Trie ces huit images !'],
        notions: ['vivant'],
        etapes: [
          { moteur: 'ranger', consigne: 'Vivant ou pas vivant ? Glisse chaque image dans la bonne boîte.', indice: 'Demande-toi : est-ce que ça grandit ?',
            boites: [{ id: 'vivant', e: '🌱', nom: 'Vivant' }, { id: 'pas', e: '🪨', nom: 'Pas vivant' }],
            objets: [{ e: '🐱', nom: 'chat', boite: 'vivant' }, { e: '🌳', nom: 'arbre', boite: 'vivant' }, { e: '🐟', nom: 'poisson', boite: 'vivant' }, { e: '🌻', nom: 'fleur', boite: 'vivant' },
              { e: '🪨', nom: 'pierre', boite: 'pas' }, { e: '⚽', nom: 'ballon', boite: 'pas' }, { e: '🚗', nom: 'voiture', boite: 'pas' }, { e: '🤖', nom: 'robot', boite: 'pas' }] },
        ],
      },
      {
        id: 'c1-m5', domaine: 'enigme', titre: 'Le message secret de Pingo', piece: { e: '🧵', nom: 'le fil de cuivre' },
        histoire: ['Pingo m’a laissé un message secret.', 'Chaque dessin est une lettre.', 'Trouve le mot caché !'],
        notions: ['code-secret', 'lettres'],
        etapes: [
          { moteur: 'secret', consigne: 'Pour chaque dessin, touche la bonne lettre.', indice: 'Regarde le tableau des dessins en haut.', code: { P: '⭐', I: '🌙', N: '❄️', G: '🍀', O: '☀️' }, mot: 'PINGO' },
        ],
      },
      {
        id: 'c1-m6', domaine: 'maison', titre: 'La chasse aux aimants', piece: { e: '🔩', nom: 'la manivelle' },
        histoire: ['Aujourd’hui, la mission se fait en vrai !', 'Avec Papa ou Maman, prends un aimant du frigo.', 'Trouve cinq objets de la maison qui collent à l’aimant.'],
        notions: ['aimants'],
        etapes: [
          { moteur: 'maison', consigne: 'Avec Papa ou Maman : trouve cinq objets qui collent à un aimant. Quand c’est fait, un parent appuie sur « C’est fait ».', aFaire: 'Trouver 5 objets qui collent à un aimant (porte du frigo, cuillère en métal, clés… mais pas le bois, ni le plastique).',
            questions: [
              { q: 'Qu’est-ce qui colle à un aimant ?', choix: [{ t: '🥄 Une cuillère en métal', bon: true }, { t: '🧸 Un nounours' }, { t: '🍌 Une banane' }] },
              { q: 'Et ça, est-ce que ça colle ?  🪵 Un morceau de bois', choix: [{ t: '👍 Oui' }, { t: '👎 Non', bon: true }] },
            ] },
        ],
      },
      {
        id: 'c1-m7', domaine: 'defi', titre: 'La machine s’allume !', piece: { e: '🧪', nom: 'le badge Apprenti du labo' },
        histoire: ['Tu as retrouvé toutes les pièces !', 'Pour allumer la machine, répète ses sons dans le bon ordre.', 'Puis une petite révision, et la machine s’allume !'],
        notions: ['memoire-sons', 'compter-15', 'suite-fleches'],
        etapes: [
          { moteur: 'sons', consigne: 'Écoute la machine, puis touche les couleurs dans le même ordre.', indice: 'Écoute encore : la machine rejoue les sons.', longueur: 3 },
          { moteur: 'compter', consigne: 'Combien de boulons ?', indice: 'Touche chaque boulon en comptant.', min: 8, max: 14, objet: '🔩' },
          { moteur: 'robot', consigne: 'Amène Bip jusqu’au bouton de la machine.', indice: 'Bip doit descendre puis aller à droite.', largeur: 4, hauteur: 3, depart: [0, 0], but: [2, 2], murs: [[1, 0]], maxFleches: 4, objet: '🔴' },
        ],
      },
    ],
  },

  {
    id: 'c2',
    titre: 'Le grand match de Bip',
    histoire: 'Bip veut jouer au soccer avec Ali ! Mais Pingo a rangé tout le matériel du terrain n’importe où. Chaque mission rend un objet du match. Le septième jour, c’est le grand match !',
    badge: { e: '⚽', nom: 'Capitaine du labo' },
    fin: '⚽ Le grand match peut commencer ! ⚽',
    missions: [
      {
        id: 'c2-m1', domaine: 'maths', titre: 'Les ballons du vestiaire', piece: { e: '⚽', nom: 'le ballon du match' },
        histoire: ['Pingo a mélangé les ballons du vestiaire.', 'Compte-les avec moi, jusqu’à vingt !', 'Puis dis-moi quelle équipe a le plus de joueurs.'],
        notions: ['compter-20', 'comparer'],
        etapes: [
          { moteur: 'compter', consigne: 'Combien de ballons dans le vestiaire ?', indice: 'Touche chaque ballon en comptant : il devient jaune. Après dix, on dit onze, douze, treize…', min: 14, max: 20, objet: '⚽' },
          { moteur: 'quiz', consigne: 'Maintenant, on compare !', indice: 'Compte les joueurs de chaque équipe, puis cherche le plus grand nombre.', questions: [
            { q: 'Quelle équipe a le plus de joueurs ?', choix: [{ t: '🔵🔵🔵🔵🔵 Les bleus' }, { t: '🔴🔴🔴🔴🔴🔴🔴 Les rouges', bon: true }, { t: '🟢🟢🟢 Les verts' }] },
            { q: 'Qu’est-ce qui est plus grand : douze ou dix-sept ?', dit: 'Qu’est-ce qui est plus grand : douze, ou dix-sept ?', choix: [{ t: '12' }, { t: '17', bon: true }] },
          ] },
        ],
      },
      {
        id: 'c2-m2', domaine: 'code', titre: 'Bip dribble jusqu’au but', piece: { e: '🥅', nom: 'le filet du but' },
        histoire: ['Mardi, c’est le jour du soccer !', 'Bip doit dribbler jusqu’au but sans toucher les murs.', 'Donne-lui les bonnes flèches !'],
        notions: ['suite-fleches', 'contourner'],
        etapes: [
          { moteur: 'robot', consigne: 'Amène Bip jusqu’au but avec quatre flèches, puis appuie sur Go.', indice: 'Un mur bloque la droite : Bip descend d’abord, puis va à droite.', largeur: 4, hauteur: 3, depart: [0, 0], but: [3, 1], murs: [[1, 0]], maxFleches: 4, objet: '🥅' },
          { moteur: 'robot', consigne: 'Deux murs maintenant ! Trouve le chemin jusqu’au but.', indice: 'Les murs bloquent le milieu : passe par le haut ou par le bas du terrain.', largeur: 5, hauteur: 3, depart: [0, 1], but: [4, 1], murs: [[1, 1], [3, 1]], maxFleches: 6, objet: '🥅' },
        ],
      },
      {
        id: 'c2-m3', domaine: 'ordi', titre: 'Les dossiers du club', piece: { e: '📣', nom: 'le sifflet' },
        histoire: ['Le club a plein de photos, toutes mélangées.', 'On va les ranger dans trois dossiers : soccer, basket et course.', 'Un dossier, c’est une boîte dans l’ordinateur.'],
        notions: ['dossiers', 'double-clic'],
        etapes: [
          { moteur: 'ranger', consigne: 'Glisse chaque photo dans le bon dossier.', indice: 'Le ballon rond noir et blanc, c’est le soccer. Le ballon orange, c’est le basket. Les chaussures et le chrono, c’est la course.',
            boites: [{ id: 'soccer', e: '📁', nom: 'Soccer' }, { id: 'basket', e: '📁', nom: 'Basket' }, { id: 'course', e: '📁', nom: 'Course' }],
            objets: [{ e: '⚽', nom: 'ballon de soccer', boite: 'soccer' }, { e: '🥅', nom: 'but', boite: 'soccer' }, { e: '🏀', nom: 'ballon de basket', boite: 'basket' }, { e: '⛹️', nom: 'joueur de basket', boite: 'basket' }, { e: '👟', nom: 'chaussure de course', boite: 'course' }, { e: '⏱️', nom: 'chronomètre', boite: 'course' }] },
          { moteur: 'quiz', consigne: 'Une petite question sur l’ordinateur.', indice: 'Sur l’ordinateur, on fait clic-clic, très vite.', questions: [
            { q: 'Pour ouvrir un dossier sur l’ordinateur, je clique…', choix: [{ t: '🖱️ Deux fois, très vite', bon: true }, { t: '🦶 Avec le pied' }, { t: '🗣️ Je crie « ouvre-toi »' }] },
          ] },
        ],
      },
      {
        id: 'c2-m4', domaine: 'sciences', titre: 'Le gazon du terrain', piece: { e: '👕', nom: 'le maillot' },
        histoire: ['Le gazon du terrain est une plante.', 'Une plante a besoin d’eau, de lumière et d’air pour grandir.', 'Aide-moi à faire pousser le gazon !'],
        notions: ['plante-besoins'],
        etapes: [
          { moteur: 'ranger', consigne: 'Qu’est-ce qui aide le gazon à pousser ? Glisse chaque image dans la bonne boîte.', indice: 'Demande-toi : est-ce qu’une plante en a besoin dans la nature ?',
            boites: [{ id: 'oui', e: '🌱', nom: 'Aide la plante' }, { id: 'non', e: '🚫', nom: 'Pas besoin' }],
            objets: [{ e: '💧', nom: 'eau', boite: 'oui' }, { e: '☀️', nom: 'soleil', boite: 'oui' }, { e: '🌬️', nom: 'air', boite: 'oui' }, { e: '🟫', nom: 'terre', boite: 'oui' },
              { e: '🍫', nom: 'chocolat', boite: 'non' }, { e: '📺', nom: 'télévision', boite: 'non' }, { e: '🧦', nom: 'chaussette', boite: 'non' }, { e: '🍬', nom: 'bonbon', boite: 'non' }] },
          { moteur: 'quiz', consigne: 'Une question de savant.', indice: 'Pense à une plante dans une armoire fermée.', questions: [
            { q: 'Une plante dans le noir pendant longtemps…', choix: [{ t: '🥀 pousse mal : il lui manque la lumière', bon: true }, { t: '🌳 devient géante' }, { t: '🎤 se met à chanter' }] },
          ] },
        ],
      },
      {
        id: 'c2-m5', domaine: 'enigme', titre: 'Les motifs de l’équipe', piece: { e: '👟', nom: 'les crampons' },
        histoire: ['Les drapeaux de l’équipe suivent un motif.', 'Un motif, c’est quelque chose qui se répète.', 'Trouve ce qui vient après, puis le mot secret de Pingo !'],
        notions: ['motifs', 'code-secret'],
        etapes: [
          { moteur: 'quiz', consigne: 'Regarde bien le motif.', indice: 'Dis les dessins à voix haute : ballon, panier, ballon, panier… qu’est-ce qui vient ?', questions: [
            { q: '⚽ 🏀 ⚽ 🏀 ⚽ … et après ?', dit: 'Ballon de soccer, ballon de basket, ballon de soccer, ballon de basket, ballon de soccer… et après ?', choix: [{ t: '🏀', bon: true }, { t: '⚽' }, { t: '🎾' }] },
            { q: '🔴 🔴 🔵 🔴 🔴 🔵 🔴 🔴 … et après ?', dit: 'Rouge, rouge, bleu. Rouge, rouge, bleu. Rouge, rouge… et après ?', choix: [{ t: '🔴' }, { t: '🔵', bon: true }, { t: '🟢' }] },
          ] },
          { moteur: 'secret', consigne: 'Pour chaque dessin, touche la bonne lettre.', indice: 'Regarde le tableau des dessins en haut.', code: { B: '⚽', A: '🌟', L: '🌈', O: '🍊', N: '🎈' }, mot: 'BALLON' },
        ],
      },
      {
        id: 'c2-m6', domaine: 'maison', titre: 'La course avec Maman', piece: { e: '🧴', nom: 'la gourde' },
        histoire: ['Aujourd’hui, la mission se fait en vrai, pendant la course !', 'Avec Maman ou Papa, comptez vingt pas à voix haute.', 'Puis pose ta main sur ton cœur : écoute-le !'],
        notions: ['compter-20', 'coeur'],
        etapes: [
          { moteur: 'maison', consigne: 'Avec Maman ou Papa : comptez vingt pas à voix haute en courant, puis touche ton cœur. Quand c’est fait, un parent appuie sur « C’est fait ».', aFaire: 'Pendant la course : compter 20 pas à voix haute ensemble, puis poser la main sur le cœur (ou le cou) pour sentir qu’il bat plus vite qu’au repos.',
            questions: [
              { q: 'Après la course, ton cœur bat…', choix: [{ t: '🏃 Plus vite', bon: true }, { t: '🐢 Plus doucement' }] },
              { q: 'Dix-neuf pas, et encore un pas, ça fait…', choix: [{ t: '20', bon: true }, { t: '18' }, { t: '30' }] },
            ] },
        ],
      },
      {
        id: 'c2-m7', domaine: 'defi', titre: 'Le grand match !', piece: { e: '🏆', nom: 'le badge Capitaine du labo' },
        histoire: ['Tout le matériel est revenu. Merci !', 'Pour lancer le grand match, répète l’hymne de l’équipe.', 'Puis une petite révision, et Bip marque le but !'],
        notions: ['memoire-sons', 'compter-20', 'contourner', 'motifs'],
        etapes: [
          { moteur: 'sons', consigne: 'Écoute l’hymne de l’équipe, puis touche les couleurs dans le même ordre.', indice: 'Écoute encore : l’hymne recommence.', longueur: 4 },
          { moteur: 'compter', consigne: 'Combien de supporters dans les gradins ?', indice: 'Touche chaque supporter en comptant.', min: 15, max: 20, objet: '🙋' },
          { moteur: 'quiz', consigne: 'Le motif des drapeaux du stade.', indice: 'Dis le motif à voix haute.', questions: [
            { q: '🥅 ⚽ ⚽ 🥅 ⚽ ⚽ 🥅 … et après ?', dit: 'But, ballon, ballon. But, ballon, ballon. But… et après ?', choix: [{ t: '⚽', bon: true }, { t: '🥅' }, { t: '🏀' }] },
          ] },
          { moteur: 'robot', consigne: 'Dernière action : Bip dribble jusqu’au but et marque !', indice: 'Monte d’abord, puis va à droite, puis redescends.', largeur: 5, hauteur: 3, depart: [0, 2], but: [4, 2], murs: [[2, 2]], maxFleches: 6, objet: '🥅' },
        ],
      },
    ],
  },

  {
    id: 'c3',
    titre: 'Le panier magique',
    histoire: 'Dimanche, c’est basket ! Le docteur a inventé un panier magique qui compte les points tout seul. Mais Pingo a mélangé ses sept réglages. Chaque mission en répare un. Le septième jour, le panier magique s’allume !',
    badge: { e: '🏀', nom: 'Meneur du labo' },
    fin: '🏀 Le panier magique s’allume ! 🏀',
    missions: [
      {
        id: 'c3-m1', domaine: 'maths', titre: 'Les points du panier', piece: { e: '🔢', nom: 'le compteur de points' },
        histoire: ['Le panier magique compte les ballons qui rentrent.', 'Pour l’aider, on va faire des additions.', 'Additionner, c’est mettre ensemble !'],
        notions: ['addition-20'],
        etapes: [
          { moteur: 'quiz', consigne: 'Combien de ballons en tout ?', indice: 'Compte les premiers ballons, puis continue avec les autres sans recommencer.', questions: [
            { q: '🏀🏀🏀🏀🏀 + 🏀🏀🏀 = ?', dit: 'Cinq ballons, plus trois ballons. Ça fait combien ?', choix: [{ t: '7' }, { t: '8', bon: true }, { t: '9' }] },
            { q: '🏀🏀🏀🏀🏀🏀🏀🏀🏀🏀 + 🏀🏀🏀🏀 = ?', dit: 'Dix ballons, plus quatre ballons. Ça fait combien ?', choix: [{ t: '14', bon: true }, { t: '13' }, { t: '40' }] },
            { q: '9 + 6 = ?', dit: 'Neuf, plus six. Ça fait combien ?', indice: 'Neuf, plus un, ça fait dix. Il reste encore cinq.', choix: [{ t: '15', bon: true }, { t: '16' }, { t: '96' }] },
          ] },
        ],
      },
      {
        id: 'c3-m2', domaine: 'code', titre: 'Bip monte l’escalier', piece: { e: '🪜', nom: 'la petite échelle' },
        histoire: ['Bip veut accrocher le filet en haut du panier.', 'Pour monter, il prend l’escalier : à droite, en haut, à droite, en haut…', 'Quand quelque chose se répète, c’est un motif !'],
        notions: ['suite-fleches', 'repeter'],
        etapes: [
          { moteur: 'robot', consigne: 'Fais monter Bip jusqu’au filet. Regarde : les marches se répètent !', indice: 'À droite, en haut. À droite, en haut. Encore une fois !', largeur: 4, hauteur: 4, depart: [0, 3], but: [3, 0], murs: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [2, 0], [2, 3], [3, 3], [3, 2]], maxFleches: 6, objet: '🥅' },
          { moteur: 'quiz', consigne: 'Une question de programmeur.', indice: 'Regarde ce qui revient toujours.', questions: [
            { q: '→ ↑ → ↑ → … quelle flèche vient après ?', dit: 'Droite, en haut. Droite, en haut. Droite… quelle flèche vient après ?', choix: [{ t: '↑', bon: true }, { t: '↓' }, { t: '←' }] },
          ] },
        ],
      },
      {
        id: 'c3-m3', domaine: 'ordi', titre: 'Le clavier du labo', piece: { e: '⌨️', nom: 'le bouton du panier' },
        histoire: ['Voici le clavier : c’est là qu’on écrit des lettres.', 'Chaque touche a une lettre.', 'Pour régler le panier, écris ton prénom, puis le nom de Bip !'],
        notions: ['clavier', 'prenom'],
        etapes: [
          { moteur: 'clavier', consigne: 'Écris ton prénom : trouve chaque lettre sur le clavier.', indice: 'Cherche la lettre que montre la petite main. La touche va briller.', mot: '{prenom}' },
          { moteur: 'clavier', consigne: 'Maintenant, écris : BIP.', indice: 'B est sur la rangée du bas. I et P sont sur la rangée du haut.', mot: 'BIP' },
        ],
      },
      {
        id: 'c3-m4', domaine: 'sciences', titre: 'Ça flotte ou ça coule ?', piece: { e: '🛟', nom: 'la bouée du labo' },
        histoire: ['Le ballon de basket est tombé dans la piscine du labo !', 'Est-ce qu’il flotte, ou est-ce qu’il coule ?', 'Faisons une expérience avec d’autres objets.'],
        notions: ['flotte-coule'],
        etapes: [
          { moteur: 'ranger', consigne: 'Ça flotte ou ça coule ? Glisse chaque objet dans la bonne boîte.', indice: 'Les choses pleines d’air, ou très légères, flottent souvent. Les petites choses lourdes coulent.',
            boites: [{ id: 'flotte', e: '🛟', nom: 'Ça flotte' }, { id: 'coule', e: '⚓', nom: 'Ça coule' }],
            objets: [{ e: '🏀', nom: 'ballon', boite: 'flotte' }, { e: '🦆', nom: 'canard en plastique', boite: 'flotte' }, { e: '🍃', nom: 'feuille', boite: 'flotte' }, { e: '🪵', nom: 'morceau de bois', boite: 'flotte' },
              { e: '🪨', nom: 'pierre', boite: 'coule' }, { e: '🔑', nom: 'clé', boite: 'coule' }, { e: '🪙', nom: 'pièce de monnaie', boite: 'coule' }, { e: '🔩', nom: 'boulon', boite: 'coule' }] },
          { moteur: 'quiz', consigne: 'Une question de savant.', indice: 'Qu’est-ce qu’il y a à l’intérieur d’un ballon ?', questions: [
            { q: 'Pourquoi le ballon de basket flotte ?', choix: [{ t: '💨 Il est plein d’air', bon: true }, { t: '🧱 Il est plein de pierres' }, { t: '🐟 Il sait nager' }] },
          ] },
        ],
      },
      {
        id: 'c3-m5', domaine: 'enigme', titre: 'Les devinettes des formes', piece: { e: '🔺', nom: 'le triangle du réglage' },
        histoire: ['Pingo a caché le réglage derrière des devinettes.', 'Elles parlent de formes : le rond, le carré, le triangle.', 'Écoute bien, puis trouve la réponse !'],
        notions: ['formes', 'devinettes'],
        etapes: [
          { moteur: 'ranger', consigne: 'Range chaque objet avec sa forme.', indice: 'Un rond n’a pas de coins. Un carré a quatre côtés pareils. Un triangle a trois côtés.',
            boites: [{ id: 'rond', e: '⚪', nom: 'Rond' }, { id: 'carre', e: '🟥', nom: 'Carré' }, { id: 'tri', e: '🔺', nom: 'Triangle' }],
            objets: [{ e: '🏀', nom: 'ballon', boite: 'rond' }, { e: '🍪', nom: 'biscuit', boite: 'rond' }, { e: '🖼️', nom: 'cadre', boite: 'carre' }, { e: '🎁', nom: 'cadeau', boite: 'carre' }, { e: '🍕', nom: 'part de pizza', boite: 'tri' }, { e: '⛺', nom: 'tente', boite: 'tri' }] },
          { moteur: 'quiz', consigne: 'Une devinette !', indice: 'Compte les côtés.', questions: [
            { q: 'J’ai trois côtés et trois coins. Qui suis-je ?', choix: [{ t: '🔺 Le triangle', bon: true }, { t: '⚪ Le rond' }, { t: '🟥 Le carré' }] },
            { q: 'Je n’ai aucun coin et je roule. Qui suis-je ?', choix: [{ t: '🟥 Le carré' }, { t: '⚪ Le rond', bon: true }, { t: '🔺 Le triangle' }] },
          ] },
        ],
      },
      {
        id: 'c3-m6', domaine: 'maison', titre: 'Les paniers du dimanche', piece: { e: '📋', nom: 'le carnet des tirs' },
        histoire: ['Aujourd’hui, la mission se fait en vrai, au basket !', 'Avec Papa ou Maman, fais dix tirs au panier.', 'Comptez ensemble les paniers réussis et les paniers ratés.'],
        notions: ['soustraction-20'],
        etapes: [
          { moteur: 'maison', consigne: 'Avec Papa ou Maman : fais dix tirs et comptez les paniers réussis. Quand c’est fait, un parent appuie sur « C’est fait ».', aFaire: 'Faire 10 tirs (au basket, ou une balle dans un panier à linge à la maison). Compter ensemble les réussis et les ratés. Rater, c’est normal : on s’entraîne !',
            questions: [
              { q: 'Ali fait dix tirs. Il en rate trois. Combien de paniers réussis ?', dit: 'Ali fait dix tirs. Il en rate trois. Combien de paniers réussis ?', indice: 'Montre dix doigts, puis baisse-en trois.', choix: [{ t: '7', bon: true }, { t: '13' }, { t: '3' }] },
              { q: 'Quand on rate un panier, on…', choix: [{ t: '💪 Réessaie, c’est comme ça qu’on progresse', bon: true }, { t: '😠 Arrête de jouer' }] },
            ] },
        ],
      },
      {
        id: 'c3-m7', domaine: 'defi', titre: 'Le panier magique s’allume !', piece: { e: '🏆', nom: 'le badge Meneur du labo' },
        histoire: ['Tous les réglages sont réparés. Merci !', 'Pour allumer le panier magique, il faut réussir quatre épreuves.', 'Une addition, un escalier, un mot à écrire, et la musique du panier !'],
        notions: ['addition-20', 'repeter', 'clavier', 'memoire-sons'],
        etapes: [
          { moteur: 'quiz', consigne: 'Le panier compte les points.', indice: 'Sept, plus trois, ça fait dix. Il reste encore deux.', questions: [
            { q: '7 + 5 = ?', dit: 'Sept, plus cinq. Ça fait combien ?', choix: [{ t: '12', bon: true }, { t: '11' }, { t: '75' }] },
          ] },
          { moteur: 'robot', consigne: 'Bip remonte l’escalier jusqu’au panier.', indice: 'À droite, en haut, encore et encore.', largeur: 4, hauteur: 4, depart: [0, 3], but: [3, 0], murs: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [2, 0], [2, 3], [3, 3], [3, 2]], maxFleches: 6, objet: '🏀' },
          { moteur: 'clavier', consigne: 'Écris le mot secret du panier : PANIER.', indice: 'Cherche la lettre que montre la petite main.', mot: 'PANIER' },
          { moteur: 'sons', consigne: 'Écoute la musique du panier, puis touche les couleurs dans le même ordre.', indice: 'Écoute encore : la musique recommence.', longueur: 4 },
        ],
      },
    ],
  },
];
