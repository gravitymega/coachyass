// Les histoires de Hbibiti : petites histoires vraies, lues à voix haute.
// Islam, savants, sciences, géographie et maths. Pour les histoires du Prophète ﷺ et des Compagnons,
// on ne dessine aucune personne : seulement des lieux et des objets.
// Chaque histoire : quelques pages (emoji + texte) puis deux petites questions (la bonne réponse en premier).
// Logique pure, testable avec Node.

export const TALE_CATS = {
  islam: { n: 'Islam', e: '🌙' },
  savants: { n: 'Savants', e: '📜' },
  sciences: { n: 'Sciences', e: '🔭' },
  geo: { n: 'Géographie', e: '🌍' },
  maths: { n: 'Maths', e: '🔢' },
};

const T = (id, cat, title, e, pages, quiz) => ({ id, cat, title, e, pages: pages.map(([pe, t]) => ({ e: pe, t })), quiz });

export const TALES = [
  // ---------- Islam ----------
  T('zamzam', 'islam', 'Hajar et la source de Zamzam', '💧', [
    ['🏜️⛰️', 'Il y a très, très longtemps, le prophète Ibrahim, que la paix soit sur lui, laissa sa femme Hajar et leur bébé Ismaïl dans une vallée de sable, entre les montagnes. Allah le lui avait demandé.'],
    ['☀️🫗', 'Bientôt, il ne resta plus une goutte d’eau. Le bébé avait soif et pleurait. Hajar avait confiance en Allah, mais elle voulait trouver de l’eau.'],
    ['⛰️🏃⛰️', 'Elle monta sur une petite colline appelée Safa pour regarder au loin. Rien. Elle courut jusqu’à une autre colline, Marwa. Rien. Elle fit l’aller-retour sept fois !'],
    ['💧✨', 'Alors l’ange Jibril frappa le sol, et de l’eau jaillit près du bébé : c’était la source de Zamzam. Hajar et Ismaïl étaient sauvés.'],
    ['🕋🤲', 'Aujourd’hui encore, les pèlerins à La Mecque marchent sept fois entre Safa et Marwa, comme Hajar, et boivent l’eau de Zamzam. Elle coule depuis des milliers d’années !'],
  ], [
    { q: 'Combien de fois Hajar a-t-elle couru entre Safa et Marwa ?', a: [['7️⃣', 'Sept fois'], ['3️⃣', 'Trois fois'], ['🔟', 'Dix fois']] },
    { q: 'Comment s’appelle la source qui a jailli ?', a: [['💧', 'Zamzam'], ['🌊', 'La mer'], ['🌧️', 'La pluie']] },
  ]),
  T('pierre-noire', 'islam', 'La Pierre noire et le cœur sage', '🕋', [
    ['🕋', 'Avant de devenir prophète, Mohammed ﷺ vivait à La Mecque. Tout le monde l’appelait « Al-Amine », ce qui veut dire « celui à qui on peut faire confiance ».'],
    ['🌧️🧱', 'Un jour, après une grande inondation, les habitants reconstruisirent la Kaaba. Il fallait remettre à sa place une pierre très précieuse : la Pierre noire.'],
    ['😠🗣️', 'Mais chaque tribu voulait avoir l’honneur de la poser ! On commença à se disputer. On décida alors : la première personne qui entrera par la porte choisira.'],
    ['🚪✨', 'La première personne à entrer fut Mohammed ﷺ. Tout le monde se réjouit : « C’est Al-Amine ! Nous acceptons ce qu’il décidera ! »'],
    ['🧣🤝', 'Il posa un grand tissu par terre, mit la Pierre au milieu, et demanda à un chef de chaque tribu de tenir un coin. Ensemble, ils la soulevèrent, puis il la posa lui-même à sa place. Plus de dispute : tout le monde avait participé !'],
  ], [
    { q: 'Que veut dire « Al-Amine » ?', a: [['🤝', 'Celui à qui on peut faire confiance'], ['💪', 'Le plus fort'], ['🏃', 'Le plus rapide']] },
    { q: 'Comment la Pierre noire a-t-elle été soulevée ?', a: [['🧣', 'Sur un tissu, tous ensemble'], ['🐪', 'Par un chameau'], ['🏗️', 'Avec une grue']] },
  ]),
  T('asma-ceintures', 'islam', 'Asma, celle aux deux ceintures', '🎒', [
    ['🌙🐪', 'Quand les gens de La Mecque voulurent faire du mal aux musulmans, le Prophète ﷺ et son ami Abou Bakr partirent en secret vers la ville de Médine. C’est ce qu’on appelle l’Hégire.'],
    ['⛰️🕳️', 'Pour ne pas être trouvés, ils se cachèrent trois nuits dans une grotte, sur la montagne de Thawr.'],
    ['🍞💧', 'Une jeune fille très courageuse leur apportait à manger en cachette : Asma, la fille d’Abou Bakr. Oui, Asma, comme toi !'],
    ['🎀✂️', 'Un jour, elle n’avait rien pour attacher le sac de nourriture. Alors elle déchira sa ceinture en deux : une moitié pour le sac, l’autre pour la gourde.'],
    ['⭐', 'Le Prophète ﷺ lui donna un joli surnom : « Dhat an-Nitaqayn », « celle aux deux ceintures ». On se souvient encore aujourd’hui de son courage et de son idée !'],
  ], [
    { q: 'Où se cachaient le Prophète ﷺ et Abou Bakr ?', a: [['⛰️', 'Dans une grotte'], ['🌳', 'Dans un arbre'], ['⛵', 'Dans un bateau']] },
    { q: 'Qu’a fait Asma avec sa ceinture ?', a: [['✂️', 'Elle l’a coupée en deux'], ['🎁', 'Elle l’a offerte'], ['🔥', 'Elle l’a perdue']] },
  ]),
  T('bilal', 'islam', 'Bilal, la plus belle voix', '📢', [
    ['🌍', 'Bilal venait d’Abyssinie, l’Éthiopie d’aujourd’hui. À La Mecque, il n’était pas libre : il appartenait à un homme dur et méchant.'],
    ['☝️', 'Quand Bilal crut en Allah, son maître voulut le forcer à abandonner. Mais Bilal répétait sans peur : « Ahad, Ahad ! », « Allah est Unique ! »'],
    ['🔓', 'Abou Bakr, le grand ami du Prophète ﷺ, acheta Bilal pour le libérer. Bilal était enfin libre !'],
    ['🕌🎶', 'À Médine, les musulmans construisirent une mosquée. Il fallait quelqu’un pour appeler à la prière. Le Prophète ﷺ choisit Bilal, car il avait une voix forte et magnifique.'],
    ['📢✨', 'Bilal fut le tout premier muezzin. Aujourd’hui, partout dans le monde, l’adhan résonne cinq fois par jour, comme Bilal le faisait.'],
  ], [
    { q: 'Que faisait Bilal à la mosquée ?', a: [['📢', 'Il appelait à la prière'], ['🍲', 'Il faisait la cuisine'], ['🧹', 'Il balayait']] },
    { q: 'D’où venait Bilal ?', a: [['🌍', 'D’Abyssinie (Éthiopie)'], ['❄️', 'Du Canada'], ['🗼', 'De France']] },
  ]),
  T('abou-hourayra', 'islam', 'Le papa du petit chat', '🐱', [
    ['🐱', 'Il y avait un Compagnon du Prophète ﷺ qui aimait beaucoup les animaux. Il avait un petit chat qu’il gardait toujours près de lui, et il jouait avec lui.'],
    ['😄', 'Les gens l’appelèrent alors « Abou Hourayra », ce qui veut dire « le papa du petit chat ». Ce surnom lui plaisait beaucoup !'],
    ['👂📖', 'Abou Hourayra restait le plus souvent possible près du Prophète ﷺ pour écouter et apprendre ses paroles par cœur.'],
    ['📚', 'Grâce à lui, nous connaissons des milliers de paroles du Prophète ﷺ : les hadiths. Il est l’un de ceux qui en ont rapporté le plus.'],
    ['💕', 'Être gentil avec les animaux et aimer apprendre : voilà deux belles choses qu’on retient d’Abou Hourayra !'],
  ], [
    { q: 'Que veut dire « Abou Hourayra » ?', a: [['🐱', 'Le papa du petit chat'], ['🦁', 'Le roi lion'], ['🐦', 'L’ami des oiseaux']] },
    { q: 'Qu’apprenait-il par cœur ?', a: [['📖', 'Les paroles du Prophète ﷺ'], ['🎵', 'Des chansons'], ['🗺️', 'Des cartes']] },
  ]),
  T('puits-othmane', 'islam', 'Le puits d’Othmane', '🪣', [
    ['🏜️', 'À Médine, il faisait très chaud et l’eau était rare. Il y avait un puits à l’eau délicieuse, le puits de Rouma.'],
    ['💰🪣', 'Mais son propriétaire faisait payer chaque seau d’eau, et les gens pauvres ne pouvaient pas en acheter.'],
    ['🗣️', 'Le Prophète ﷺ dit que celui qui achèterait ce puits pour le donner à tout le monde aurait une grande récompense auprès d’Allah.'],
    ['🤲💧', 'Othmane ibn Affane acheta le puits, puis il le laissa ouvert à tous, gratuitement. Riches ou pauvres, tout le monde pouvait boire !'],
    ['🌴', 'Ce puits existe encore aujourd’hui à Médine, entouré de palmiers. C’est ce qu’on appelle une « sadaqa jariya » : un bienfait qui continue longtemps.'],
  ], [
    { q: 'Qu’a fait Othmane avec le puits ?', a: [['🤲', 'Il l’a donné à tout le monde'], ['🔒', 'Il l’a fermé'], ['💰', 'Il a vendu l’eau plus cher']] },
    { q: 'Le puits existe-t-il encore ?', a: [['🌴', 'Oui, à Médine'], ['❌', 'Non, il a disparu'], ['🌙', 'Il est sur la Lune']] },
  ]),

  // ---------- Savants ----------
  T('fatima-fihri', 'savants', 'Fatima et la plus vieille université', '🏛️', [
    ['🐪', 'Il y a plus de 1 100 ans, une jeune femme nommée Fatima al-Fihri arriva avec sa famille à Fès, au Maroc. Elle venait de Kairouan, en Tunisie.'],
    ['💰', 'Quand son père mourut, il lui laissa beaucoup d’argent. Fatima réfléchit : « Comment l’utiliser pour faire du bien à beaucoup de gens ? »'],
    ['🕌', 'En l’an 859, elle fit construire une grande mosquée : la mosquée Al-Qaraouiyine. On dit qu’elle jeûna tous les jours pendant les travaux.'],
    ['📚🎓', 'On venait y apprendre le Coran, les maths, la médecine, l’astronomie… La mosquée devint une université, où des élèves venaient de très loin.'],
    ['🇲🇦⭐', 'Aujourd’hui, Al-Qaraouiyine existe toujours à Fès : c’est la plus vieille université du monde encore ouverte. Et c’est une femme qui l’a fondée !'],
  ], [
    { q: 'Dans quelle ville se trouve l’université de Fatima ?', a: [['🇲🇦', 'Fès, au Maroc'], ['🇫🇷', 'Paris'], ['🇨🇦', 'Montréal']] },
    { q: 'Qu’a construit Fatima ?', a: [['🕌', 'Une mosquée-université'], ['🏰', 'Un château'], ['🚢', 'Un bateau']] },
  ]),
  T('ibn-sina', 'savants', 'Ibn Sina, le petit docteur', '🩺', [
    ['📖', 'Il y a environ mille ans, à Boukhara, en Asie centrale, vivait un garçon très curieux : Ibn Sina. À 10 ans, il connaissait déjà tout le Coran par cœur !'],
    ['🔬', 'Il aimait apprendre : les maths, la logique, les sciences… et surtout la médecine. Très jeune, il soignait déjà des malades.'],
    ['👑🤒', 'Un jour, le sultan de Boukhara tomba gravement malade. Aucun médecin n’arrivait à le guérir. On appela le jeune Ibn Sina… et il le guérit !'],
    ['📚', 'Pour le remercier, le sultan lui ouvrit son immense bibliothèque. Ibn Sina y lut des livres pendant des jours et des jours.'],
    ['🩺🌍', 'Plus tard, il écrivit un énorme livre de médecine, « Le Canon ». Pendant des centaines d’années, les médecins d’Europe l’ont étudié. En France, on l’appelle Avicenne.'],
  ], [
    { q: 'Quel métier faisait Ibn Sina ?', a: [['🩺', 'Médecin'], ['⚽', 'Footballeur'], ['🍞', 'Boulanger']] },
    { q: 'Quel cadeau le sultan lui a-t-il fait ?', a: [['📚', 'Sa bibliothèque'], ['🐎', 'Un cheval'], ['🍬', 'Des bonbons']] },
  ]),
  T('emir-abdelkader', 'savants', 'L’émir Abdelkader, le protecteur', '🛡️', [
    ['🇩🇿🐎', 'Abdelkader est né en Algérie en 1808, près de Mascara. C’était un savant, un poète et un excellent cavalier.'],
    ['🛡️', 'Quand l’armée française arriva en Algérie, il défendit son pays pendant de longues années. Même ses adversaires admiraient son honnêteté.'],
    ['🕌🏙️', 'Plus tard, il alla vivre à Damas, en Syrie. En 1860, une grande violence éclata contre les chrétiens de la ville.'],
    ['🚪🤝', 'L’émir Abdelkader et ses hommes ouvrirent leurs portes et protégèrent des milliers de chrétiens. Il expliqua que l’islam demande de protéger les innocents.'],
    ['🌍⭐', 'Le monde entier l’a félicité. Il y a même une petite ville aux États-Unis qui porte son nom : Elkader !'],
  ], [
    { q: 'Dans quel pays est né l’émir Abdelkader ?', a: [['🇩🇿', 'En Algérie'], ['🇯🇵', 'Au Japon'], ['🇧🇷', 'Au Brésil']] },
    { q: 'Qu’a-t-il fait à Damas ?', a: [['🛡️', 'Il a protégé des milliers de personnes'], ['🏰', 'Il a construit un château'], ['⚽', 'Il a gagné un match']] },
  ]),
  T('jazari', 'savants', 'Al-Jazari, l’inventeur de robots', '🤖', [
    ['⚙️', 'Il y a plus de 800 ans, un ingénieur nommé Al-Jazari travaillait dans un palais, dans le sud de la Turquie d’aujourd’hui. Il adorait inventer des machines.'],
    ['🐘⏰', 'Sa machine la plus célèbre : l’horloge-éléphant ! Grâce à l’eau qui coule, des petits personnages bougent et font du bruit pour annoncer chaque demi-heure.'],
    ['🤖🧼', 'Il fabriqua aussi des automates, de vrais petits robots : un serviteur mécanique qui tendait de l’eau, du savon et une serviette pour se laver les mains.'],
    ['📘✏️', 'Al-Jazari écrivit un livre avec les plans de 50 machines, très bien dessinés, pour que d’autres puissent les construire.'],
    ['🧤😄', 'Grappo dit : « C’est un peu mon arrière-arrière-grand-père ! » Les ingénieurs d’aujourd’hui admirent encore ses inventions.'],
  ], [
    { q: 'Quel animal se trouve sur sa célèbre horloge ?', a: [['🐘', 'Un éléphant'], ['🐟', 'Un poisson'], ['🐔', 'Une poule']] },
    { q: 'Qu’est-ce qu’un automate ?', a: [['🤖', 'Un petit robot qui bouge tout seul'], ['🍰', 'Un gâteau'], ['🚲', 'Un vélo']] },
  ]),

  // ---------- Sciences ----------
  T('ibn-haytham', 'sciences', 'Ibn al-Haytham et la lumière', '💡', [
    ['👀', 'Il y a mille ans, beaucoup de gens pensaient que nos yeux envoyaient des rayons pour voir les choses, comme des lampes de poche !'],
    ['💡', 'Un savant né à Bassora, en Irak, n’était pas d’accord : Ibn al-Haytham. Il expliqua que c’est la lumière qui part des objets et qui entre dans nos yeux.'],
    ['📦🕳️', 'Il étudia la « chambre noire » : une pièce toute sombre avec un petit trou. La lumière qui passe par le trou dessine sur le mur l’image de dehors… à l’envers !'],
    ['📷', 'C’est l’ancêtre de l’appareil photo. Le mot « caméra » vient même de « camera obscura », la chambre noire !'],
    ['🧪', 'Sa grande idée : ne pas croire une chose juste parce qu’on l’a dite, mais faire des expériences pour vérifier. C’est comme ça que travaillent les scientifiques aujourd’hui.'],
  ], [
    { q: 'Selon Ibn al-Haytham, comment voit-on ?', a: [['💡', 'La lumière entre dans nos yeux'], ['🔦', 'Nos yeux sont des lampes'], ['👂', 'Avec nos oreilles']] },
    { q: 'La chambre noire est l’ancêtre de quoi ?', a: [['📷', 'De l’appareil photo'], ['🚗', 'De la voiture'], ['☎️', 'Du téléphone']] },
  ]),
  T('ibn-firnas', 'sciences', 'Abbas ibn Firnas veut voler', '🪶', [
    ['🏰', 'Il y a plus de 1 100 ans, à Cordoue, en Andalousie, vivait un inventeur nommé Abbas ibn Firnas. Il fabriquait des horloges et travaillait le verre.'],
    ['🐦', 'Il regardait souvent les oiseaux et rêvait : « Et si l’homme pouvait voler, lui aussi ? »'],
    ['🪶', 'Il se fabriqua des ailes avec des plumes et du tissu. Devant une foule étonnée, il s’élança d’une colline… et plana dans les airs !'],
    ['🤕', 'Mais l’atterrissage fut difficile : il se fit mal au dos. Il comprit : « J’ai oublié la queue ! Les oiseaux s’en servent pour se poser doucement. »'],
    ['🌙✈️', 'Il fut l’un des premiers à essayer de voler. Aujourd’hui, un cratère sur la Lune porte son nom ! Attention : on n’essaie jamais de voler à la maison !'],
  ], [
    { q: 'Avec quoi Abbas a-t-il fait ses ailes ?', a: [['🪶', 'Des plumes et du tissu'], ['🥕', 'Des carottes'], ['🧊', 'De la glace']] },
    { q: 'Qu’avait-il oublié pour bien atterrir ?', a: [['🐦', 'Une queue, comme les oiseaux'], ['🧢', 'Une casquette'], ['🥾', 'Ses chaussures']] },
  ]),

  // ---------- Géographie ----------
  T('ibn-battouta', 'geo', 'Ibn Battouta, le grand voyageur', '🧭', [
    ['🇲🇦⚓', 'Ibn Battouta est né à Tanger, au Maroc, il y a plus de 700 ans. À 21 ans, il partit tout seul pour faire le pèlerinage à La Mecque.'],
    ['🐪🏜️', 'Il traversa l’Afrique du Nord et l’Égypte, puis arriva à La Mecque. Mais il avait tellement envie de découvrir le monde qu’il continua son voyage !'],
    ['🐘🏝️', 'Il visita la Perse, l’Inde, les îles Maldives où il devint juge, et même la Chine ! Il voyagea à dos de chameau, en bateau et à pied.'],
    ['🌍', 'Son voyage dura 29 ans ! Il parcourut environ 120 000 kilomètres : c’est comme faire trois fois le tour de la Terre.'],
    ['📜', 'De retour au Maroc, le sultan lui demanda de raconter tout ce qu’il avait vu. Son livre s’appelle « La Rihla », « Le Voyage ». L’aéroport de Tanger porte son nom !'],
  ], [
    { q: 'Dans quelle ville est né Ibn Battouta ?', a: [['🇲🇦', 'Tanger'], ['🇨🇦', 'Montréal'], ['🇮🇹', 'Rome']] },
    { q: 'Combien de temps a duré son voyage ?', a: [['🧭', '29 ans'], ['📅', '1 semaine'], ['⏰', '1 heure']] },
  ]),
  T('idrisi', 'geo', 'Al-Idrissi et la carte du monde', '🗺️', [
    ['🌊', 'Al-Idrissi est né à Ceuta, Sebta, tout au nord du Maroc, il y a plus de 900 ans. Il étudia à Cordoue et voyagea beaucoup.'],
    ['👑', 'Le roi de Sicile, Roger, voulait la carte du monde la plus juste possible. Il fit appel au savant Al-Idrissi.'],
    ['🧳🗣️', 'Pendant 15 ans, Al-Idrissi interrogea des marins, des marchands et des voyageurs, et vérifia chaque information avant de la dessiner.'],
    ['🥈🗺️', 'En 1154, il termina un grand livre de cartes, et même une immense carte du monde gravée sur de l’argent !'],
    ['🙃', 'Petit secret : sur ses cartes, le sud est en haut ! Les marins et les savants ont utilisé ses cartes pendant des siècles.'],
  ], [
    { q: 'Qu’a dessiné Al-Idrissi ?', a: [['🗺️', 'Une carte du monde'], ['🦁', 'Un lion'], ['🏠', 'Une maison']] },
    { q: 'Sur ses cartes, qu’est-ce qui est en haut ?', a: [['⬇️', 'Le sud'], ['⬆️', 'Le nord'], ['🌙', 'La Lune']] },
  ]),
  T('sahara-atlas', 'geo', 'Du Sahara aux montagnes de l’Atlas', '🏜️', [
    ['🇩🇿', 'L’Algérie est le plus grand pays d’Afrique ! Et la plus grande partie de l’Algérie, c’est le désert du Sahara.'],
    ['🏜️', 'Le Sahara est le plus grand désert chaud du monde. Il y a des dunes de sable immenses, des oasis avec des palmiers et des dattes délicieuses.'],
    ['🦒🎨', 'Dans le Tassili n’Ajjer, en Algérie, il y a de très vieux dessins sur les rochers : des girafes, des éléphants… Il y a très longtemps, le Sahara était vert, avec des lacs !'],
    ['🇲🇦🏔️', 'Au Maroc, il y a les montagnes de l’Atlas. Le plus haut sommet, le Toubkal, mesure 4 167 mètres : c’est le plus haut de toute l’Afrique du Nord.'],
    ['❄️⛷️', 'En hiver, il neige sur l’Atlas, et on peut même faire du ski à Oukaïmeden ! Du sable chaud à la neige… comme l’hiver à Montréal !'],
  ], [
    { q: 'Quel est le plus grand pays d’Afrique ?', a: [['🇩🇿', 'L’Algérie'], ['🇲🇦', 'Le Maroc'], ['🇫🇷', 'La France']] },
    { q: 'Que trouve-t-on en hiver sur l’Atlas ?', a: [['❄️', 'De la neige'], ['🌴', 'Des cocotiers'], ['🐧', 'Des pingouins']] },
  ]),

  // ---------- Maths ----------
  T('khwarizmi', 'maths', 'Al-Khwarizmi et les algorithmes', '🧮', [
    ['🏛️', 'Il y a environ 1 200 ans, à Bagdad, il y avait un endroit magique : la Maison de la Sagesse. Des savants y traduisaient et écrivaient des livres sur tous les sujets.'],
    ['🧮', 'L’un d’eux s’appelait Al-Khwarizmi. Il adorait les nombres et cherchait des façons simples de résoudre les problèmes de calcul.'],
    ['0️⃣', 'Il expliqua comment calculer avec les chiffres venus d’Inde, et avec un chiffre tout nouveau : le zéro ! C’est bien plus facile qu’avec les chiffres romains.'],
    ['📘', 'Il écrivit un livre appelé « Al-Jabr ». C’est de là que vient le mot « algèbre », une partie des maths que tu apprendras plus tard.'],
    ['📱', 'Et de son nom vient le mot « algorithme » : une suite d’étapes pour résoudre un problème. Cette tablette fonctionne grâce à des algorithmes. Merci Al-Khwarizmi !'],
  ], [
    { q: 'Quel mot vient du nom d’Al-Khwarizmi ?', a: [['📱', 'Algorithme'], ['🍫', 'Chocolat'], ['⚽', 'Football']] },
    { q: 'Quel nouveau chiffre a-t-il fait connaître ?', a: [['0️⃣', 'Le zéro'], ['9️⃣', 'Le neuf'], ['🔟', 'Le dix']] },
  ]),
  T('fibonacci-bejaia', 'maths', 'Les chiffres de Béjaïa', '🔢', [
    ['🇮🇹⛵', 'Il y a plus de 800 ans, un garçon italien nommé Fibonacci partit avec son père, un marchand, vivre à Béjaïa, en Algérie.'],
    ['🏛️', 'À cette époque, en Europe, on écrivait les nombres avec des lettres : les chiffres romains. Par exemple, 2026 s’écrivait MMXXVI. Pas facile pour calculer !'],
    ['🇩🇿🔢', 'À Béjaïa, Fibonacci découvrit avec des maîtres musulmans les chiffres de 0 à 9 et les calculs qu’on fait avec. Il trouva ça génial !'],
    ['📖', 'De retour en Italie, il écrivit en 1202 un livre pour apprendre ces chiffres aux Européens. Petit à petit, tout le monde les adopta.'],
    ['✏️', 'C’est pour ça qu’en France, on les appelle les « chiffres arabes ». Chaque fois que tu écris un nombre, pense au voyage de Fibonacci à Béjaïa !'],
  ], [
    { q: 'Dans quelle ville d’Algérie Fibonacci a-t-il appris les chiffres ?', a: [['🇩🇿', 'Béjaïa'], ['🇨🇦', 'Québec'], ['🇪🇸', 'Madrid']] },
    { q: 'Comment appelle-t-on les chiffres 0 à 9 en français ?', a: [['🔢', 'Les chiffres arabes'], ['🏛️', 'Les chiffres romains'], ['🎨', 'Les chiffres de couleur']] },
  ]),
  T('biruni', 'maths', 'Al-Birouni mesure la Terre', '🌍', [
    ['🌍', 'Il y a mille ans, les savants savaient que la Terre est ronde. Mais quelle est sa taille ? C’était une grande question !'],
    ['⛰️', 'Le savant Al-Birouni eut une idée. Il monta au sommet d’une montagne, près d’une grande plaine, en Inde, dans le Pakistan d’aujourd’hui.'],
    ['📐👀', 'De là-haut, il mesura très précisément l’angle pour voir l’horizon, là où la Terre semble toucher le ciel. Il connaissait aussi la hauteur de la montagne.'],
    ['🧮', 'Avec ces deux mesures et de la géométrie, il calcula la taille de la Terre, sans jamais en faire le tour !'],
    ['🎯', 'Son résultat était presque parfait : moins d’un pour cent d’erreur par rapport à ce que mesurent aujourd’hui les satellites. Les maths, c’est puissant !'],
  ], [
    { q: 'Qu’a mesuré Al-Birouni ?', a: [['🌍', 'La taille de la Terre'], ['🐘', 'Un éléphant'], ['🍉', 'Une pastèque']] },
    { q: 'Où est-il monté pour faire sa mesure ?', a: [['⛰️', 'Sur une montagne'], ['🌳', 'Dans un arbre'], ['🚀', 'Dans une fusée']] },
  ]),
];

// Texte à lire à voix haute : la formule de salutation ﷺ est dite en entier.
export const speakTale = (t) => t.replace(/\s*ﷺ/g, ', salla Allahou alayhi wa sallam,').replace(/,\s*,/g, ',');

// Histoire proposée : la première pas encore écoutée (dans la catégorie choisie, ou la suivante dans l'ordre).
export function nextTale(heard = {}, cat = null) {
  const list = TALES.filter((t) => !cat || t.cat === cat);
  return list.find((t) => !heard[t.id]) || list[0];
}
