// Données des activités (pures). À faire relire par les parents.

// ---------- Les petites sourates ----------
// Chaque ligne : texte arabe avec voyelles, lecture en lettres latines, sens en français.
// La basmala est récitée au début de chaque sourate. Pour Al-Fatiha, elle est la première ligne.
// La voix de synthèse ne sait pas réciter le Coran : la récitation vient des parents (enregistrée dans le jeu).
const V = (ar, lat, fr) => ({ ar, lat, fr });
export const BASMALA = V('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', 'Bismi Llahi r-rahmani r-rahim', 'Au nom d’Allah, le Tout Miséricordieux, le Très Miséricordieux.');
export const SOURATES = [
  { id: 'fatiha', name: 'Al-Fatiha', fr: 'L’ouverture', n: 1, verses: [
    BASMALA,
    V('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', 'Al-hamdu li Llahi rabbi l-‘alamin', 'Louange à Allah, Seigneur des mondes.'),
    V('الرَّحْمَٰنِ الرَّحِيمِ', 'Ar-rahmani r-rahim', 'Le Tout Miséricordieux, le Très Miséricordieux.'),
    V('مَالِكِ يَوْمِ الدِّينِ', 'Maliki yawmi d-din', 'Maître du Jour du jugement.'),
    V('إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ', 'Iyyaka na‘budu wa iyyaka nasta‘in', 'C’est Toi que nous adorons, et c’est Toi dont nous demandons l’aide.'),
    V('اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ', 'Ihdina s-sirata l-mustaqim', 'Guide-nous sur le droit chemin,'),
    V('صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ', 'Sirata l-ladhina an‘amta ‘alayhim, ghayri l-maghdubi ‘alayhim wa la d-dallin', 'le chemin de ceux que Tu as comblés de bienfaits, pas de ceux qui ont mérité Ta colère, ni des égarés.'),
  ] },
  { id: 'ikhlas', name: 'Al-Ikhlas', fr: 'Le culte pur', n: 112, verses: [
    V('قُلْ هُوَ اللَّهُ أَحَدٌ', 'Qul huwa Llahu ahad', 'Dis : Il est Allah, Unique.'),
    V('اللَّهُ الصَّمَدُ', 'Allahu s-samad', 'Allah, Celui vers qui tout le monde se tourne.'),
    V('لَمْ يَلِدْ وَلَمْ يُولَدْ', 'Lam yalid wa lam yulad', 'Il n’a pas d’enfant, et Il n’est l’enfant de personne.'),
    V('وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ', 'Wa lam yakun lahu kufuwan ahad', 'Et personne n’est égal à Lui.'),
  ] },
  { id: 'kawthar', name: 'Al-Kawthar', fr: 'L’abondance', n: 108, verses: [
    V('إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ', 'Inna a‘taynaka l-kawthar', 'Nous t’avons donné l’Abondance (Al-Kawthar).'),
    V('فَصَلِّ لِرَبِّكَ وَانْحَرْ', 'Fa salli li rabbika wa nhar', 'Prie donc ton Seigneur et offre un sacrifice.'),
    V('إِنَّ شَانِئَكَ هُوَ الْأَبْتَرُ', 'Inna shani’aka huwa l-abtar', 'C’est celui qui te déteste qui sera sans descendance.'),
  ] },
  { id: 'falaq', name: 'Al-Falaq', fr: 'L’aube naissante', n: 113, verses: [
    V('قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ', 'Qul a‘udhu bi rabbi l-falaq', 'Dis : Je cherche la protection du Seigneur de l’aube,'),
    V('مِن شَرِّ مَا خَلَقَ', 'Min sharri ma khalaq', 'contre le mal de ce qu’Il a créé,'),
    V('وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ', 'Wa min sharri ghasiqin idha waqab', 'contre le mal de la nuit quand elle devient noire,'),
    V('وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ', 'Wa min sharri n-naffathati fi l-‘uqad', 'contre le mal de celles qui soufflent sur les nœuds,'),
    V('وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ', 'Wa min sharri hasidin idha hasad', 'et contre le mal du jaloux quand il est jaloux.'),
  ] },
  { id: 'nas', name: 'An-Nas', fr: 'Les hommes', n: 114, verses: [
    V('قُلْ أَعُوذُ بِرَبِّ النَّاسِ', 'Qul a‘udhu bi rabbi n-nas', 'Dis : Je cherche la protection du Seigneur des hommes,'),
    V('مَلِكِ النَّاسِ', 'Maliki n-nas', 'le Roi des hommes,'),
    V('إِلَٰهِ النَّاسِ', 'Ilahi n-nas', 'le Dieu des hommes,'),
    V('مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ', 'Min sharri l-waswasi l-khannas', 'contre le mal du mauvais souffleur qui se cache,'),
    V('الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ', 'Alladhi yuwaswisu fi suduri n-nas', 'qui souffle de mauvaises idées dans le cœur des hommes,'),
    V('مِنَ الْجِنَّةِ وَالنَّاسِ', 'Mina l-jinnati wa n-nas', 'qu’il soit djinn ou humain.'),
  ] },
];
export const verseKey = (s, i) => `q:${s}:${i}`; // clé de l'enregistrement des parents

// ---------- 🗺️ Le voyage au Maroc et en Algérie ----------
export const VILLES = [
  { id: 'casa', pays: 'ma', name: 'Casablanca', e: '🌊', monument: { name: 'La mosquée Hassan II', e: '🕌', fact: 'Elle est construite au bord de l’océan, et son minaret est l’un des plus hauts du monde.' }, plat: { name: 'Le couscous du vendredi', e: '🍲' }, mot: { lat: 'Bezzaf', fr: 'beaucoup' } },
  { id: 'fes', pays: 'ma', name: 'Fès', e: '📚', monument: { name: 'L’université Al Quaraouiyine', e: '🏛️', fact: 'Fatima al-Fihriya l’a fondée il y a plus de 1 100 ans : c’est la plus vieille université du monde encore ouverte.' }, plat: { name: 'La pastilla', e: '🥧' }, mot: { lat: 'Mrehba', fr: 'bienvenue' } },
  { id: 'marrakech', pays: 'ma', name: 'Marrakech', e: '🌴', monument: { name: 'La Koutoubia', e: '🗼', fact: 'Son grand minaret domine la place Jemaa el-Fna, pleine de conteurs et de musiciens.' }, plat: { name: 'La tanjia', e: '🏺' }, mot: { lat: 'Zwin', fr: 'beau' } },
  { id: 'alger', pays: 'dz', name: 'Alger', e: '⚓', monument: { name: 'Le Maqam Echahid', e: '🌿', fact: 'Le monument des martyrs : trois grandes palmes de béton qui veillent sur la baie d’Alger.' }, plat: { name: 'La chorba frik', e: '🥣' }, mot: { lat: 'Wech rak ?', fr: 'comment ça va ?' } },
  { id: 'oran', pays: 'dz', name: 'Oran', e: '🎶', monument: { name: 'Le fort de Santa Cruz', e: '🏰', fact: 'Il est perché sur la montagne, au-dessus de la mer et de la ville.' }, plat: { name: 'La karantika', e: '🥮' }, mot: { lat: 'Saha', fr: 'merci, bravo' } },
  { id: 'constantine', pays: 'dz', name: 'Constantine', e: '🌉', monument: { name: 'Le pont Sidi M’Cid', e: '🌉', fact: 'Constantine est la ville des ponts : ils sont suspendus au-dessus de gorges très profondes.' }, plat: { name: 'La chakhchoukha', e: '🍛' }, mot: { lat: 'Bnin', fr: 'délicieux' } },
];

// ---------- 🍲 La cuisine de Hbibiti ----------
// word : l'identifiant du mot de darija du jeu, quand il existe.
const I = (e, fr, n, unit = '', word = '') => ({ e, fr, n, unit, word });
export const RECETTES = [
  { id: 'msemen', name: 'Le msemen', e: '🫓', ing: [I('🌾', 'farine', 3, 'verres'), I('🥣', 'semoule', 1, 'verre'), I('💧', 'eau', 2, 'verres', 'eau'), I('🫒', 'huile', 2, 'cuillères')],
    steps: ['Mélange la farine, la semoule et une pincée de sel.', 'Ajoute l’eau petit à petit et pétris la pâte.', 'Fais des petites boules.', 'Étale chaque boule avec de l’huile et plie-la en carré.', 'Fais cuire à la poêle des deux côtés.'] },
  { id: 'harira', name: 'La harira', e: '🥣', ing: [I('🍅', 'tomates', 4, '', 'tomate'), I('🧅', 'oignon', 1, '', 'oignon'), I('🫘', 'lentilles', 1, 'verre'), I('🥩', 'viande', 1, 'morceau', 'viande'), I('🌿', 'coriandre', 1, 'bouquet')],
    steps: ['Coupe l’oignon, la viande et la coriandre.', 'Mets-les dans la marmite avec les lentilles et de l’eau.', 'Ajoute les tomates écrasées.', 'Laisse cuire doucement.', 'Ajoute un peu de farine mélangée à l’eau pour épaissir.', 'Sers avec des dattes pour le ftour.'] },
  { id: 'couscous', name: 'Le couscous', e: '🍲', ing: [I('🥣', 'semoule', 3, 'verres'), I('🥕', 'carottes', 3, '', 'carotte'), I('🥒', 'courgettes', 2), I('🥩', 'viande', 2, 'morceaux', 'viande'), I('🧅', 'oignons', 2, '', 'oignon')],
    steps: ['Prépare la sauce avec la viande, les oignons et les légumes.', 'Mouille la semoule et roule-la entre tes mains.', 'Fais cuire la semoule à la vapeur dans le couscoussier.', 'Ajoute un peu de beurre et égraine la semoule.', 'Sers la semoule avec les légumes et la sauce dessus.'] },
];

// ---------- 🕌 Les 99 noms d'Allah ----------
const N = (ar, lat, fr) => ({ ar, lat, fr });
export const NOMS = [
  N('الرَّحْمَٰن', 'Ar-Rahman', 'Le Tout Miséricordieux'), N('الرَّحِيم', 'Ar-Rahim', 'Le Très Miséricordieux'), N('المَلِك', 'Al-Malik', 'Le Roi'),
  N('القُدُّوس', 'Al-Quddus', 'Le Pur'), N('السَّلَام', 'As-Salam', 'La Paix'), N('المُؤْمِن', 'Al-Mu’min', 'Celui qui rassure'),
  N('المُهَيْمِن', 'Al-Muhaymin', 'Celui qui veille sur tout'), N('العَزِيز', 'Al-‘Aziz', 'Le Tout-Puissant'), N('الجَبَّار', 'Al-Jabbar', 'Celui qui répare et domine'),
  N('المُتَكَبِّر', 'Al-Mutakabbir', 'Le Plus Grand'), N('الخَالِق', 'Al-Khaliq', 'Le Créateur'), N('البَارِئ', 'Al-Bari’', 'Celui qui fait exister'),
  N('المُصَوِّر', 'Al-Musawwir', 'Celui qui donne une forme'), N('الغَفَّار', 'Al-Ghaffar', 'Celui qui pardonne toujours'), N('القَهَّار', 'Al-Qahhar', 'Le Dominateur'),
  N('الوَهَّاب', 'Al-Wahhab', 'Celui qui donne sans compter'), N('الرَّزَّاق', 'Ar-Razzaq', 'Celui qui nourrit tout le monde'), N('الفَتَّاح', 'Al-Fattah', 'Celui qui ouvre les portes'),
  N('العَلِيم', 'Al-‘Alim', 'Celui qui sait tout'), N('القَابِض', 'Al-Qabid', 'Celui qui retient'), N('البَاسِط', 'Al-Basit', 'Celui qui donne largement'),
  N('الخَافِض', 'Al-Khafid', 'Celui qui abaisse'), N('الرَّافِع', 'Ar-Rafi’', 'Celui qui élève'), N('المُعِزّ', 'Al-Mu‘izz', 'Celui qui honore'),
  N('المُذِلّ', 'Al-Mudhill', 'Celui qui abaisse les orgueilleux'), N('السَّمِيع', 'As-Sami’', 'Celui qui entend tout'), N('البَصِير', 'Al-Basir', 'Celui qui voit tout'),
  N('الحَكَم', 'Al-Hakam', 'Le Juge'), N('العَدْل', 'Al-‘Adl', 'Le Juste'), N('اللَّطِيف', 'Al-Latif', 'Le Doux'),
  N('الخَبِير', 'Al-Khabir', 'Celui qui connaît tout'), N('الحَلِيم', 'Al-Halim', 'Le Patient'), N('العَظِيم', 'Al-‘Azim', 'L’Immense'),
  N('الغَفُور', 'Al-Ghafur', 'Celui qui pardonne'), N('الشَّكُور', 'Ash-Shakur', 'Celui qui récompense le bien'), N('العَلِيّ', 'Al-‘Aliyy', 'Le Très-Haut'),
  N('الكَبِير', 'Al-Kabir', 'Le Très-Grand'), N('الحَفِيظ', 'Al-Hafiz', 'Celui qui protège'), N('المُقِيت', 'Al-Muqit', 'Celui qui donne la force'),
  N('الحَسِيب', 'Al-Hasib', 'Celui qui suffit'), N('الجَلِيل', 'Al-Jalil', 'Le Majestueux'), N('الكَرِيم', 'Al-Karim', 'Le Généreux'),
  N('الرَّقِيب', 'Ar-Raqib', 'Celui qui observe'), N('المُجِيب', 'Al-Mujib', 'Celui qui répond aux prières'), N('الوَاسِع', 'Al-Wasi’', 'Le Vaste'),
  N('الحَكِيم', 'Al-Hakim', 'Le Sage'), N('الوَدُود', 'Al-Wadud', 'Celui qui aime'), N('المَجِيد', 'Al-Majid', 'Le Glorieux'),
  N('البَاعِث', 'Al-Ba‘ith', 'Celui qui ressuscite'), N('الشَّهِيد', 'Ash-Shahid', 'Le Témoin'), N('الحَقّ', 'Al-Haqq', 'La Vérité'),
  N('الوَكِيل', 'Al-Wakil', 'Celui à qui on fait confiance'), N('القَوِيّ', 'Al-Qawiyy', 'Le Fort'), N('المَتِين', 'Al-Matin', 'L’Inébranlable'),
  N('الوَلِيّ', 'Al-Waliyy', 'L’Ami qui protège'), N('الحَمِيد', 'Al-Hamid', 'Celui qui mérite la louange'), N('المُحْصِي', 'Al-Muhsi', 'Celui qui compte tout'),
  N('المُبْدِئ', 'Al-Mubdi’', 'Celui qui commence la création'), N('المُعِيد', 'Al-Mu‘id', 'Celui qui fait revenir'), N('المُحْيِي', 'Al-Muhyi', 'Celui qui donne la vie'),
  N('المُمِيت', 'Al-Mumit', 'Celui qui reprend la vie'), N('الحَيّ', 'Al-Hayy', 'Le Vivant'), N('القَيُّوم', 'Al-Qayyum', 'Celui qui fait tenir toute chose'),
  N('الوَاجِد', 'Al-Wajid', 'Celui qui trouve tout'), N('المَاجِد', 'Al-Mâjid', 'Le Noble'), N('الوَاحِد', 'Al-Wahid', 'L’Unique'),
  N('الأَحَد', 'Al-Ahad', 'L’Un'), N('الصَّمَد', 'As-Samad', 'Celui vers qui tout se tourne'), N('القَادِر', 'Al-Qadir', 'Celui qui peut tout'),
  N('المُقْتَدِر', 'Al-Muqtadir', 'Le Tout-Capable'), N('المُقَدِّم', 'Al-Muqaddim', 'Celui qui fait avancer'), N('المُؤَخِّر', 'Al-Mu’akhkhir', 'Celui qui fait attendre'),
  N('الأَوَّل', 'Al-Awwal', 'Le Premier'), N('الآخِر', 'Al-Akhir', 'Le Dernier'), N('الظَّاهِر', 'Az-Zahir', 'L’Apparent'),
  N('البَاطِن', 'Al-Batin', 'Le Caché'), N('الوَالِي', 'Al-Wali', 'Le Maître de tout'), N('المُتَعَالِي', 'Al-Muta‘ali', 'Le Très-Élevé'),
  N('البَرّ', 'Al-Barr', 'Le Bienfaisant'), N('التَّوَّاب', 'At-Tawwab', 'Celui qui accepte le repentir'), N('المُنْتَقِم', 'Al-Muntaqim', 'Celui qui punit l’injustice'),
  N('العَفُوّ', 'Al-‘Afuww', 'Celui qui efface les fautes'), N('الرَّؤُوف', 'Ar-Ra’uf', 'Le Très Bon'), N('مَالِكُ المُلْك', 'Malik al-Mulk', 'Le Maître du royaume'),
  N('ذُو الجَلَالِ وَالإِكْرَام', 'Dhu l-Jalali wa l-Ikram', 'Le Majestueux et Généreux'), N('المُقْسِط', 'Al-Muqsit', 'L’Équitable'), N('الجَامِع', 'Al-Jami’', 'Celui qui rassemble'),
  N('الغَنِيّ', 'Al-Ghaniyy', 'Celui qui n’a besoin de rien'), N('المُغْنِي', 'Al-Mughni', 'Celui qui enrichit'), N('المَانِع', 'Al-Mani’', 'Celui qui protège du mal'),
  N('الضَّارّ', 'Ad-Darr', 'Celui qui éprouve'), N('النَّافِع', 'An-Nafi’', 'Celui qui fait du bien'), N('النُّور', 'An-Nur', 'La Lumière'),
  N('الهَادِي', 'Al-Hadi', 'Celui qui guide'), N('البَدِيع', 'Al-Badi’', 'Celui qui invente la création'), N('البَاقِي', 'Al-Baqi', 'Celui qui reste pour toujours'),
  N('الوَارِث', 'Al-Warith', 'L’Héritier de tout'), N('الرَّشِيد', 'Ar-Rashid', 'Celui qui montre le bon chemin'), N('الصَّبُور', 'As-Sabur', 'Le Très Patient'),
];

// ---------- 🧮 Le marché au souk ----------
export const PRODUITS = [
  { e: '🍞', fr: 'le pain', word: 'pain' }, { e: '🥛', fr: 'le lait', word: 'lait' }, { e: '🍅', fr: 'les tomates', word: 'tomate' },
  { e: '🌴', fr: 'les dattes', word: 'dattes' }, { e: '🥕', fr: 'les carottes', word: 'carotte' }, { e: '🧅', fr: 'les oignons', word: 'oignon' },
  { e: '🍊', fr: 'les oranges' }, { e: '🍉', fr: 'la pastèque' }, { e: '🫒', fr: 'les olives' }, { e: '🍯', fr: 'le miel' },
];
