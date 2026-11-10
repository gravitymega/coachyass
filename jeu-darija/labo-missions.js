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
// Indice après 2 essais ratés, solution montrée après 3, puis une nouvelle chance (act-labo.js).

export const CHAPITRES = [
  {
    id: 'c1',
    titre: 'La super-machine',
    histoire: 'Pingo a voulu aider… et il a caché les sept pièces de la super-machine du docteur dans le labo. Chaque mission rend une pièce. Le septième jour, la machine s’allume !',
    badge: { e: '🧪', nom: 'Apprenti du labo' },
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
];
