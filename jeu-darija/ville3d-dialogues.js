// Ce que disent les habitants de la ville en 3D quand on discute avec eux (réponses toutes prêtes, hors ligne).
// La discussion libre (question posée au micro ou au clavier) passe par l'IA gratuite de Cloudflare (worker/index.js).
// Logique pure, testable avec Node. À faire relire par les parents.

export const QUESTIONS = [
  { id: 'salut', q: 'Salam ! Comment ça va ?' },
  { id: 'nom', q: 'Comment tu t’appelles ?' },
  { id: 'fais', q: 'Qu’est-ce que tu fais ici ?' },
  { id: 'aime', q: 'Qu’est-ce que tu aimes ?' },
  { id: 'raconte', q: 'Raconte-moi quelque chose !' },
  { id: 'mot', q: 'Apprends-moi un mot !' },
];

const P = (salut, nom, fais, aime, raconte) => ({ salut, nom, fais, aime, raconte });
export const DIALOGUES = {
  maman: P('Labas, hamdoullah ! Je suis contente de te voir, ya galbi.', 'Je suis Maman ! En Algérie, on dit Yemma, et au Maroc, Mama.',
    'Je fais les courses pour préparer un bon couscous.', 'J’aime quand tu m’aides, et quand tu me fais de gros câlins !',
    'Quand j’étais petite, en Algérie, je jouais à la marelle avec mes cousines.'),
  papa: P('Labas, hamdoullah ! Ça va bien, et toi, mon champion ?', 'Je suis Papa ! Au Maroc, on dit Baba.',
    'Je me promène dans la médina et je dis bonjour aux voisins.', 'J’adore le foot, le basket, et jouer avec toi !',
    'Au Maroc, le vendredi, toute la famille mange le couscous ensemble.'),
  hbibiti: P('Labas, ya hbibi ! Viens, je t’ai préparé du thé à la menthe.', 'Je suis Hbibiti, ta grand-mère de l’usine magique !',
    'Je vends des épices au souk : du cumin, de la cannelle et du safran.', 'J’aime raconter des histoires et réveiller les jouets avec toi.',
    'Le safran est l’épice la plus chère du monde. Il vient d’une petite fleur violette.'),
  boulanger: P('Sbah el khir ! Ça sent bon le pain chaud ici !', 'Je suis le boulanger de la médina.',
    'Je fais cuire le khobz, le msemen et les baghrir dans mon four.', 'J’aime me lever très tôt pour que tout le monde ait du pain frais.',
    'Autrefois, les familles apportaient leur pâte au four du quartier pour la faire cuire.'),
  imam: P('Wa alaykoum salam ! Que Dieu te protège, mon enfant.', 'Je suis l’imam de la mosquée.',
    'Je guide la prière et j’apprends le Coran aux enfants.', 'J’aime voir les enfants apprendre les sourates avec le sourire.',
    'Le muezzin appelle à la prière cinq fois par jour, du haut du minaret.'),
  fifi: P('Yip yip ! Ça va super bien !', 'Je suis Fifi la fennec, avec mes grandes oreilles !',
    'Je cours partout dans la médina. Je suis très rapide !', 'J’adore le sport, et surtout le foot avec Assad.',
    'Le fennec vit dans le désert du Sahara. Ses grandes oreilles l’aident à avoir moins chaud.'),
  assad: P('Grrr… je rigole ! Labas, mon ami !', 'Je suis Assad, le lion de l’Atlas !',
    'Je m’entraîne au foot sur le terrain.', 'J’aime marquer des buts et encourager mon équipe.',
    'Autrefois, le lion de l’Atlas vivait dans les montagnes du Maroc et de l’Algérie.'),
  maitresse: P('Bonjour ! Tu as bien travaillé aujourd’hui ?', 'Je suis la maîtresse de l’école.',
    'Je prépare les leçons de lecture et de maths.', 'J’aime les enfants curieux qui posent plein de questions !',
    'L’alphabet arabe a 28 lettres, et on l’écrit de droite à gauche.'),
  // Les habitants qu'on rencontre à l'intérieur des bâtiments
  tante: P('Ahlan ! Entre, entre, assieds-toi sur le sedari.', 'Je suis ta tante, ta khalti.',
    'Je prépare le thé à la menthe et les gâteaux pour les invités.', 'J’aime recevoir toute la famille dans mon salon.',
    'Dans un salon marocain, les banquettes tout autour s’appellent des sedari.'),
  muezzin: P('Assalamou alaykoum ! Bienvenue dans la mosquée.', 'Je suis le muezzin.',
    'Je monte en haut du minaret pour appeler à la prière.', 'J’aime le calme de la mosquée et les beaux tapis.',
    'On enlève ses chaussures avant d’entrer dans la mosquée, pour la garder propre.'),
  boulangere: P('Sbah el khir ! Tu veux un pain tout chaud ?', 'Je suis la boulangère.',
    'Je range les pains et je les vends aux voisins.', 'J’aime l’odeur du pain le matin.',
    'Le khobz est un pain rond qu’on mange à tous les repas.'),
  maitre: P('Bonjour ! Prêt pour la leçon ?', 'Je suis le maître d’école.',
    'J’écris au tableau et j’aide les élèves.', 'J’aime quand tout le monde lève la main pour répondre.',
    'Les chiffres que l’on utilise sont arrivés en Europe grâce aux savants arabes, comme Al-Khwarizmi.'),
};

// Qui est l'habitant, pour l'IA (discussion libre).
export const persona = (npc) => {
  const d = DIALOGUES[npc.id] || {};
  return `${npc.name}. ${d.nom || ''} ${d.fais || ''} ${d.aime || ''}`.trim();
};
