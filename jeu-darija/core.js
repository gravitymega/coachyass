// L'Usine magique de Hbibiti — logique pure (données, révision, questions).
// Aucun accès au DOM : testable avec Node (node --test jeu-darija/core.test.mjs).

// Darija en lettres latines, comme on l'écrit en message ; « 3 » = ع (3ammi, l3eb).
// `older` : mot réservé au profil qui sait lire (trop abstrait pour 5 ans).
const W = (id, room, fr, emoji, ma, maAr, dz, dzAr, extra = {}) => ({ id, room, fr, emoji, ma: { lat: ma, ar: maAr }, dz: { lat: dz, ar: dzAr }, ...extra });

export const WORDS = [
  // Hall d'entrée : salutations et petits mots
  W('bonjour', 'hall', 'Bonjour', '☀️', 'Sbah el khir', 'صباح الخير', 'Sbah el khir', 'صباح الخير'),
  W('bonsoir', 'hall', 'Bonsoir', '🌙', 'Msa el khir', 'مسا الخير', 'Msa el khir', 'مسا الخير'),
  W('cava', 'hall', 'Ça va ?', '😊', 'Labas ?', 'لاباس؟', 'Wach rak ?', 'واش راك؟'),
  W('merci', 'hall', 'Merci', '🙏', 'Choukran', 'شكرا', 'Saha', 'صحّة'),
  W('oui', 'hall', 'Oui', '👍', 'Iyeh', 'إيه', 'Ih', 'إيه'),
  W('non', 'hall', 'Non', '👎', 'La', 'لا', 'La', 'لا'),
  W('aurevoir', 'hall', 'Au revoir', '👋', 'Bslama', 'بسلامة', 'Bslama', 'بسلامة'),
  W('bienvenue', 'hall', 'Bienvenue', '🏠', 'Marhba', 'مرحبا', 'Marhba', 'مرحبا'),
  W('jetaime', 'hall', "Je t'aime", '❤️', 'Kanbghik', 'كنبغيك', 'Nhabek', 'نحبّك'),
  W('pardon', 'hall', 'Pardon', '🥺', 'Smeh liya', 'سمح ليا', 'Smahli', 'سمحلي'),
  W('beau', 'hall', 'Joli', '🌸', 'Zwin', 'زوين', 'Chbab', 'شباب'),
  W('maintenant', 'hall', 'Maintenant', '⏰', 'Daba', 'دابا', 'Dorka', 'درك', { older: true }),
  W('ou', 'hall', 'Où ?', '🔍', 'Fin ?', 'فين؟', 'Win ?', 'وين؟', { older: true }),
  W('quoi', 'hall', 'Quoi ?', '🤔', 'Ach ?', 'آش؟', 'Wach ?', 'واش؟', { older: true }),

  // Stade d'Assad : la famille
  W('maman', 'stade', 'Maman', '👩', 'Mama', 'ماما', 'Yemma', 'يمّا'),
  W('papa', 'stade', 'Papa', '👨', 'Baba', 'بابا', 'Baba', 'بابا'),
  W('frere', 'stade', 'Mon frère', '👦', 'Khouya', 'خويا', 'Khouya', 'خويا'),
  W('soeur', 'stade', 'Ma sœur', '👧', 'Khti', 'ختي', 'Khti', 'ختي'),
  W('grandmere', 'stade', 'Grand-mère', '👵', 'Jedda', 'جدّة', 'Jedda', 'جدّة'),
  W('grandpere', 'stade', 'Grand-père', '👴', 'Jeddi', 'جدّي', 'Jeddi', 'جدّي'),
  W('bebe', 'stade', 'Le bébé', '👶', 'Tfel sghir', 'طفل صغير', 'Bébé', 'بيبي'),
  W('oncle_p', 'stade', 'Mon oncle (frère de papa)', '🧔', '3ammi', 'عمّي', '3ammi', 'عمّي', { older: true }),
  W('oncle_m', 'stade', 'Mon oncle (frère de maman)', '🧔‍♂️', 'Khali', 'خالي', 'Khali', 'خالي', { older: true }),
  W('tante_p', 'stade', 'Ma tante (sœur de papa)', '👩‍🦱', '3emti', 'عمّتي', '3emti', 'عمّتي', { older: true }),
  W('tante_m', 'stade', 'Ma tante (sœur de maman)', '👩‍🦰', 'Khalti', 'خالتي', 'Khalti', 'خالتي', { older: true }),

  // Gymnase de Fifi : chiffres et couleurs
  W('n1', 'gym', '1', '1️⃣', 'Wahed', 'واحد', 'Wahed', 'واحد'),
  W('n2', 'gym', '2', '2️⃣', 'Jouj', 'جوج', 'Zouj', 'زوج'),
  W('n3', 'gym', '3', '3️⃣', 'Tlata', 'تلاتة', 'Tlata', 'تلاتة'),
  W('n4', 'gym', '4', '4️⃣', 'Rb3a', 'ربعة', 'Arb3a', 'أربعة'),
  W('n5', 'gym', '5', '5️⃣', 'Khamsa', 'خمسة', 'Khamsa', 'خمسة'),
  W('n6', 'gym', '6', '6️⃣', 'Stta', 'ستّة', 'Setta', 'ستّة', { older: true }),
  W('n7', 'gym', '7', '7️⃣', 'Sb3a', 'سبعة', 'Seb3a', 'سبعة', { older: true }),
  W('n8', 'gym', '8', '8️⃣', 'Tmenya', 'تمنية', 'Tmanya', 'تمنية', { older: true }),
  W('n9', 'gym', '9', '9️⃣', 'Ts3oud', 'تسعود', 'Tes3a', 'تسعة', { older: true }),
  W('n10', 'gym', '10', '🔟', '3achra', 'عشرة', '3achra', 'عشرة', { older: true }),
  W('rouge', 'gym', 'Rouge', '🟥', 'Hmer', 'حمر', 'Hmer', 'حمر'),
  W('vert', 'gym', 'Vert', '🟩', 'Khder', 'خضر', 'Khder', 'خضر'),
  W('jaune', 'gym', 'Jaune', '🟨', 'Sfer', 'صفر', 'Sfer', 'صفر'),
  W('bleu', 'gym', 'Bleu', '🟦', 'Zreq', 'زرق', 'Zreg', 'زرق'),
  W('blanc', 'gym', 'Blanc', '⬜', 'Byed', 'بيض', 'Byed', 'بيض'),
  W('noir', 'gym', 'Noir', '⬛', 'Kehel', 'كحل', 'Kehel', 'كحل'),

  // Cuisine de Hbibiti : nourriture
  W('pain', 'cuisine', 'Le pain', '🥖', 'Khobz', 'خبز', 'Khobz', 'خبز'),
  W('eau', 'cuisine', "L'eau", '💧', 'Lma', 'الما', 'Lma', 'الما'),
  W('lait', 'cuisine', 'Le lait', '🥛', 'Hlib', 'حليب', 'Hlib', 'حليب'),
  W('the', 'cuisine', 'Le thé', '🍵', 'Atay', 'أتاي', 'Tay', 'تاي'),
  W('orange', 'cuisine', "L'orange", '🍊', 'Limoun', 'ليمون', 'Tchina', 'تشينة'),
  W('tomate', 'cuisine', 'La tomate', '🍅', 'Maticha', 'ماطيشة', 'Tomatich', 'طوماطيش'),
  W('patate', 'cuisine', 'La pomme de terre', '🥔', 'Btata', 'بطاطا', 'Batata', 'بطاطا'),
  W('viande', 'cuisine', 'La viande', '🥩', 'Lham', 'لحم', 'Lham', 'لحم'),
  W('poulet', 'cuisine', 'Le poulet', '🍗', 'Djaj', 'دجاج', 'Djaj', 'دجاج'),
  W('couscous', 'cuisine', 'Le couscous', '🍲', 'Seksou', 'سكسو', 'Kesksou', 'كسكسو'),
  W('pomme', 'cuisine', 'La pomme', '🍎', 'Teffah', 'تفاح', 'Teffah', 'تفاح'),
  W('banane', 'cuisine', 'La banane', '🍌', 'Banane', 'بنان', 'Banane', 'بنان'),

  // Salle de la musique : les actions
  W('va', 'musique', 'Va !', '🚶', 'Sir !', 'سير!', 'Roh !', 'روح!'),
  W('viens', 'musique', 'Viens !', '🫴', 'Aji !', 'أجي!', 'Arwah !', 'أرواح!'),
  W('regarde', 'musique', 'Regarde !', '👀', 'Chouf !', 'شوف!', 'Chouf !', 'شوف!'),
  W('mange', 'musique', 'Mange !', '🍽️', 'Kol !', 'كول!', 'Kol !', 'كول!'),
  W('bois', 'musique', 'Bois !', '🥤', 'Chrob !', 'شرب!', 'Echrob !', 'اشرب!'),
  W('dors', 'musique', 'Dors !', '😴', 'N3es !', 'نعس!', 'Rgod !', 'ارقد!'),
  W('cours', 'musique', 'Cours !', '🏃', 'Jri !', 'جري!', 'Jri !', 'جري!'),
  W('joue', 'musique', 'Joue !', '🧸', 'L3eb !', 'لعب!', 'L3eb !', 'لعب!'),
  W('chante', 'musique', 'Chante !', '🎤', 'Ghenni !', 'غنّي!', 'Ghenni !', 'غنّي!'),
  W('ecoute', 'musique', 'Écoute !', '👂', 'Sme3 !', 'سمع!', 'Esma3 !', 'اسمع!'),
  W('assis', 'musique', 'Assieds-toi !', '🪑', 'Gles !', 'گلس!', 'Ag3od !', 'اقعد!'),
  W('donne', 'musique', 'Donne-moi !', '🤲', '3tini !', 'عطيني!', 'A3tini !', 'اعطيني!', { older: true }),

  // L'infirmerie de Fifi : le corps
  W('tete', 'corps', 'La tête', '🙂', 'Ras', 'راس', 'Ras', 'راس'),
  W('yeux', 'corps', 'Les yeux', '👀', '3inin', 'عينين', '3inin', 'عينين'),
  W('oreille', 'corps', "L'oreille", '👂', 'Wden', 'ودن', 'Wden', 'ودن'),
  W('nez', 'corps', 'Le nez', '👃', 'Nif', 'نيف', 'Nif', 'نيف'),
  W('bouche', 'corps', 'La bouche', '👄', 'Fomm', 'فم', 'Foum', 'فم'),
  W('main', 'corps', 'La main', '✋', 'Yedd', 'يدّ', 'Yedd', 'يدّ'),
  W('pied', 'corps', 'Le pied', '🦶', 'Rjel', 'رجل', 'Rjel', 'رجل'),
  W('dents', 'corps', 'Les dents', '🦷', 'Snan', 'سنان', 'Snan', 'سنان'),
  W('cheveux', 'corps', 'Les cheveux', '💇', 'Cha3r', 'شعر', 'Cha3r', 'شعر'),
  W('bras', 'corps', 'Le bras', '💪', 'Dra3', 'دراع', 'Dra3', 'دراع', { older: true }),
  W('coeur', 'corps', 'Le cœur', '❤️', 'Qalb', 'قلب', 'Qalb', 'قلب', { older: true }),

  // La ferme d'Assad : les animaux
  W('chat', 'animaux', 'Le chat', '🐱', 'Mech', 'مشّ', 'Qett', 'قطّ'),
  W('chien', 'animaux', 'Le chien', '🐶', 'Kelb', 'كلب', 'Kelb', 'كلب'),
  W('cheval', 'animaux', 'Le cheval', '🐴', '3oud', 'عود', '3aoud', 'عود'),
  W('vache', 'animaux', 'La vache', '🐄', 'Begra', 'بڭرة', 'Bagra', 'بقرة'),
  W('mouton', 'animaux', 'Le mouton', '🐑', 'Houli', 'حولي', 'Kebch', 'كبش'),
  W('poule', 'animaux', 'La poule', '🐔', 'Djaja', 'دجاجة', 'Djaja', 'دجاجة'),
  W('oiseau', 'animaux', "L'oiseau", '🐦', 'Tir', 'طير', 'Tir', 'طير'),
  W('poisson', 'animaux', 'Le poisson', '🐟', 'Hout', 'حوت', 'Hout', 'حوت'),
  W('chameau', 'animaux', 'Le chameau', '🐪', 'Jmel', 'جمل', 'Jmel', 'جمل'),
  W('lion', 'animaux', 'Le lion', '🦁', 'Sba3', 'سبع', 'Sbe3', 'سبع'),
  W('souris', 'animaux', 'La souris', '🐭', 'Far', 'فار', 'Far', 'فار'),
  W('tortue', 'animaux', 'La tortue', '🐢', 'Fakroun', 'فكرون', 'Fakroun', 'فكرون', { older: true }),

  // La maison de Maman
  W('dar', 'maison', 'La maison', '🏠', 'Dar', 'دار', 'Dar', 'دار'),
  W('porte', 'maison', 'La porte', '🚪', 'Bab', 'باب', 'Bab', 'باب'),
  W('fenetre', 'maison', 'La fenêtre', '🪟', 'Chrjem', 'شرجم', 'Taqa', 'طاقة'),
  W('lit', 'maison', 'Le lit', '🛏️', 'Namousiya', 'ناموسية', 'Frach', 'فراش'),
  W('table', 'maison', 'La table', '🍽️', 'Tabla', 'طبلة', 'Tabla', 'طابلة'),
  W('chaise', 'maison', 'La chaise', '🪑', 'Korsi', 'كرسي', 'Korsi', 'كرسي'),
  W('cle', 'maison', 'La clé', '🔑', 'Sarout', 'ساروت', 'Mefta7', 'مفتاح'),
  W('lumiere', 'maison', 'La lumière', '💡', 'Dou', 'ضو', 'Dhou', 'ضو'),
  W('tel', 'maison', 'Le téléphone', '📱', 'Tilifoun', 'تيليفون', 'Tilifoun', 'تيليفون'),
  W('tele', 'maison', 'La télé', '📺', 'Tlfaza', 'تلفازة', 'Tilivizioun', 'تيليفيزيون'),
  W('balai', 'maison', 'Le balai', '🧹', 'Chettaba', 'شطّابة', 'Mkensa', 'مكنسة', { older: true }),

  // Le vestiaire de Papa : les vêtements
  W('chaussures', 'vetements', 'Les chaussures', '👟', 'Sebbat', 'صبّاط', 'Sbabet', 'صبابط'),
  W('pantalon', 'vetements', 'Le pantalon', '👖', 'Serwal', 'سروال', 'Serwal', 'سروال'),
  W('chemise', 'vetements', 'La chemise', '👔', 'Qamija', 'قاميجة', 'Qmija', 'قميجة'),
  W('chaussettes', 'vetements', 'Les chaussettes', '🧦', 'Tqacher', 'تقاشر', 'Tqacher', 'تقاشر'),
  W('manteau', 'vetements', 'Le manteau', '🧥', 'Kebbout', 'كبّوط', 'Kebbout', 'كبّوط'),
  W('casquette', 'vetements', 'La casquette', '🧢', 'Kaskita', 'كاسكيطة', 'Kaskita', 'كاسكيطة'),
  W('lunettes', 'vetements', 'Les lunettes', '👓', 'Ndader', 'نضاضر', 'Mrayat', 'مرايات'),
  W('robe', 'vetements', 'La robe', '👗', 'Keswa', 'كسوة', 'Roba', 'روبة'),
  W('sac', 'vetements', 'Le sac', '🎒', 'Sak', 'صاك', 'Sak', 'صاك'),
  W('echarpe', 'vetements', "L'écharpe", '🧣', 'Chal', 'شال', 'Chal', 'شال', { older: true }),

  // Le balcon de Hbibiti : le ciel, la météo et la nature
  W('soleil', 'ciel', 'Le soleil', '☀️', 'Chems', 'شمس', 'Chems', 'شمس'),
  W('lune', 'ciel', 'La lune', '🌙', 'Qamar', 'قمر', 'Qmar', 'قمر'),
  W('etoile', 'ciel', "L'étoile", '⭐', 'Nejma', 'نجمة', 'Nejma', 'نجمة'),
  W('pluie', 'ciel', 'La pluie', '🌧️', 'Chta', 'شتا', 'Chta', 'شتا'),
  W('neige', 'ciel', 'La neige', '❄️', 'Telj', 'تلج', 'Telj', 'تلج'),
  W('vent', 'ciel', 'Le vent', '🌬️', 'Rih', 'ريح', 'Rih', 'ريح'),
  W('froid', 'ciel', 'Il fait froid', '🥶', 'Kayn lberd', 'كاين البرد', 'Kayen lberd', 'كاين البرد'),
  W('chaud', 'ciel', 'Il fait chaud', '🥵', 'Skhana', 'سخانة', 'Skhana', 'سخانة'),
  W('arbre', 'ciel', "L'arbre", '🌳', 'Chejra', 'شجرة', 'Chejra', 'شجرة'),
  W('fleur', 'ciel', 'La fleur', '🌹', 'Warda', 'وردة', 'Nouwwara', 'نوّارة'),
  W('mer', 'ciel', 'La mer', '🌊', 'Lbhar', 'البحر', 'Lbhar', 'البحر'),
  W('aujourdhui', 'ciel', "Aujourd'hui", '📅', 'Lyoum', 'اليوم', 'Lyoum', 'اليوم', { older: true }),
  W('demain', 'ciel', 'Demain', '🌅', 'Ghedda', 'غدّا', 'Ghodwa', 'غدوة', { older: true }),
  W('hier', 'ciel', 'Hier', '⏪', 'Lbare7', 'البارح', 'Lbare7', 'البارح', { older: true }),

  // Le téléphone de Jedda : parler avec la famille
  W('bien', 'appel', 'Je vais bien', '😊', 'Ana bikhir', 'أنا بخير', 'Rani mlih', 'راني مليح'),
  W('manque', 'appel', 'Tu me manques', '🥺', 'Twe7chtek', 'توحشتك', 'Twe7chtek', 'توحشتك'),
  W('faim', 'appel', "J'ai faim", '😋', 'Fiya jjou3', 'فيا الجوع', 'Rani ji3an', 'راني جيعان'),
  W('soif', 'appel', "J'ai soif", '🥤', 'Ana 3tchan', 'أنا عطشان', 'Rani 3atchan', 'راني عطشان'),
  W('fatigue', 'appel', 'Je suis fatigué', '🥱', '3yit', 'عييت', '3yit', 'عييت'),
  W('bisous', 'appel', 'Des bisous !', '😘', 'Bousat', 'بوسات', 'Bousat', 'بوسات'),
  W('bonnenuit', 'appel', 'Bonne nuit', '🛌', 'Tesbah 3la khir', 'تصبح على خير', 'Tesbah 3la khir', 'تصبح على خير'),
  W('doucement', 'appel', 'Doucement', '🤫', 'Bechwiya', 'بشوية', 'Bechwiya', 'بشوية'),
  W('vite', 'appel', 'Vite !', '⚡', 'Dghya', 'دغيا', 'Fissa3', 'فيسع'),
  W('sais', 'appel', 'Je ne sais pas', '🤷', 'Ma3reftch', 'ما عرفتش', 'Ma3labalich', 'ما علاباليش', { older: true }),
  W('nom', 'appel', 'Comment tu t’appelles ?', '🙋', 'Chnou smitek ?', 'شنو سميتك؟', 'Wach esmek ?', 'واش اسمك؟', { older: true }),
  W('moi', 'appel', 'Je m’appelle…', '📛', 'Smiti…', 'سميتي…', 'Esmi…', 'اسمي…', { older: true }),

  // Le marché de Hbibiti : fruits et légumes
  W('raisin', 'marche', 'Le raisin', '🍇', '3neb', 'عنب', '3neb', 'عنب'),
  W('fraise', 'marche', 'La fraise', '🍓', 'Tout', 'توت', 'Frez', 'فريز'),
  W('pasteque', 'marche', 'La pastèque', '🍉', 'Dellah', 'دلّاح', 'Della3', 'دلّاع'),
  W('melon', 'marche', 'Le melon', '🍈', 'Btikh', 'بطيخ', 'Bettikh', 'بطّيخ'),
  W('dattes', 'marche', 'Les dattes', '🌴', 'Tmer', 'تمر', 'Tmer', 'تمر'),
  W('olives', 'marche', 'Les olives', '🫒', 'Zitoun', 'زيتون', 'Zitoun', 'زيتون'),
  W('carotte', 'marche', 'La carotte', '🥕', 'Khizzou', 'خيزّو', 'Zrodiya', 'زرودية'),
  W('oignon', 'marche', "L'oignon", '🧅', 'Bsla', 'بصلة', 'Bsel', 'بصل'),
  W('courgette', 'marche', 'La courgette', '🥒', 'Gar3a', 'ڭرعة', 'Qar3a', 'قرعة'),
  W('citron', 'marche', 'Le citron', '🍋', 'Hamed', 'حامض', 'Qares', 'قارص'),

  // La classe de Grappo : l'école
  W('madrasa', 'ecole', "L'école", '🏫', 'Lmadrasa', 'المدرسة', 'Lakoul', 'لاكول'),
  W('maitresse', 'ecole', 'La maîtresse', '👩‍🏫', 'Lostada', 'الأستاذة', 'Lmou3allima', 'المعلّمة'),
  W('cahier', 'ecole', 'Le cahier', '📒', 'Konnach', 'كنّاش', 'Kayé', 'كاييه'),
  W('stylo', 'ecole', 'Le stylo', '🖊️', 'Stilou', 'ستيلو', 'Stilou', 'ستيلو'),
  W('crayon', 'ecole', 'Le crayon', '✏️', 'Qlam rsas', 'قلم رصاص', 'Qlam', 'قلم'),
  W('livre', 'ecole', 'Le livre', '📖', 'Ktab', 'كتاب', 'Ktab', 'كتاب'),
  W('ami', 'ecole', 'Mon ami', '🧑‍🤝‍🧑', 'Sa7bi', 'صاحبي', 'Sa7bi', 'صاحبي'),
  W('lis', 'ecole', 'Lis !', '👓', 'Qra !', 'قرا!', 'Aqra !', 'اقرا!'),
  W('ecris', 'ecole', 'Écris !', '📝', 'Kteb !', 'كتب!', 'Aktab !', 'اكتب!'),
  W('tableau', 'ecole', 'Le tableau', '🟩', 'Sbbora', 'سبّورة', 'Tablo', 'طابلو', { older: true }),
  W('ciseaux', 'ecole', 'Les ciseaux', '✂️', 'Mqess', 'مقص', 'Mqess', 'مقص', { older: true }),

  // Le terrain de Fifi : le sport
  W('ballon', 'sport', 'Le ballon', '⚽', 'Kora', 'كورة', 'Balon', 'بالون'),
  W('gagne', 'sport', 'On a gagné !', '🏆', 'Rbe7na !', 'ربحنا!', 'Rbe7na !', 'ربحنا!'),
  W('perdu', 'sport', 'On a perdu', '😞', 'Khserna', 'خسرنا', 'Khserna', 'خسرنا'),
  W('saute', 'sport', 'Saute !', '🦘', 'Nqez !', 'نقز!', 'Nagez !', 'ناقز!'),
  W('lance', 'sport', 'Lance !', '🤾', 'Lou7 !', 'لوّح!', 'Armi !', 'ارمي!'),
  W('attrape', 'sport', 'Attrape !', '🧤', 'Chedd !', 'شدّ!', 'Hkem !', 'حكم!'),
  W('equipe', 'sport', "L'équipe", '👥', 'Lfarqa', 'الفرقة', 'Lekip', 'ليكيب'),
  W('nage', 'sport', 'Nage !', '🏊', '3oum !', 'عوم!', '3oum !', 'عوم!'),
  W('velo', 'sport', 'Le vélo', '🚲', 'Bechklita', 'بشكليطة', 'Bichklita', 'بيشكليطة'),
  W('fort', 'sport', 'Fort', '💪', 'Qwi', 'قوي', 'Qwi', 'قوي', { older: true }),

  // La chambre des émotions de Maman : les sentiments
  W('content', 'emotions', 'Content', '😄', 'Fer7an', 'فرحان', 'Fer7an', 'فرحان'),
  W('triste', 'emotions', 'Triste', '😢', '7zin', 'حزين', 'Mghboun', 'مغبون'),
  W('fache', 'emotions', 'Fâché', '😠', 'Mqelleq', 'مقلّق', 'Za3fan', 'زعفان'),
  W('peur', 'emotions', "J'ai peur", '😨', 'Khayef', 'خايف', 'Khayef', 'خايف'),
  W('malade', 'emotions', 'Malade', '🤒', 'Mrid', 'مريض', 'Mrid', 'مريض'),
  W('mal', 'emotions', "J'ai mal", '🤕', 'Kaydorni', 'كيضرّني', 'Ywaja3ni', 'يوجعني'),
  W('ris', 'emotions', 'Ris !', '😂', 'Dhek !', 'ضحك!', 'Edhek !', 'اضحك!'),
  W('pleurepas', 'emotions', 'Ne pleure pas', '🥲', 'Ma tbkich', 'ما تبكيش', 'Ma tebkich', 'ما تبكيش'),
  W('gentil', 'emotions', 'Gentil', '😇', 'Driyef', 'ضريف', 'Mlih', 'مليح', { older: true }),

  // La rue des métiers de Papa
  W('medecin', 'metiers', 'Le médecin', '🩺', 'Tbib', 'طبيب', 'Tbib', 'طبيب'),
  W('policier', 'metiers', 'Le policier', '👮', 'Boulisi', 'بوليسي', 'Chorti', 'شرطي'),
  W('boulanger', 'metiers', 'Le boulanger', '🥖', 'Moul lferran', 'مول الفران', 'Khabbaz', 'خبّاز'),
  W('cuisinier', 'metiers', 'Le cuisinier', '🧑‍🍳', 'Tabbakh', 'طبّاخ', 'Tabbakh', 'طبّاخ'),
  W('chauffeur', 'metiers', 'Le chauffeur', '🚕', 'Chifor', 'شيفور', 'Chifor', 'شيفور'),
  W('coiffeur', 'metiers', 'Le coiffeur', '💈', '7ejjam', 'حجّام', '7ejjam', 'حجّام'),
  W('menuisier', 'metiers', 'Le menuisier', '🪚', 'Nejjar', 'نجّار', 'Nejjar', 'نجّار'),
  W('fermier', 'metiers', 'Le fermier', '🧑‍🌾', 'Fellah', 'فلّاح', 'Fellah', 'فلّاح'),
  W('pecheur', 'metiers', 'Le pêcheur', '🎣', 'Sayyad', 'صيّاد', 'Sayyad', 'صيّاد'),
  W('imam', 'metiers', "L'imam", '🕌', 'Limam', 'الإمام', 'Limam', 'الإمام', { older: true }),

  // La fête de Hbibiti : Ramadan et l'Aïd
  W('ramadan', 'fete', 'Le Ramadan', '🌙', 'Ramdan', 'رمضان', 'Ramdan', 'رمضان'),
  W('siyam', 'fete', 'Le jeûne', '🍽️', 'Siyam', 'الصيام', 'Siyam', 'الصيام'),
  W('ftour', 'fete', 'Le repas du soir (ftour)', '🥣', 'Lftour', 'الفطور', 'Lftour', 'الفطور'),
  W('aid', 'fete', "L'Aïd", '🎉', 'L3id', 'العيد', 'L3id', 'العيد'),
  W('aidmbarek', 'fete', 'Bonne fête !', '🎊', '3id mbarek !', 'عيد مبارك!', 'Saha 3idkoum !', 'صحّا عيدكم!'),
  W('cadeau', 'fete', 'Le cadeau', '🎁', 'Lhdiya', 'الهدية', 'Lhdiya', 'الهدية'),
  W('gateaux', 'fete', "Les gâteaux de l'Aïd", '🍪', 'Ghriba', 'غريبة', 'Makrout', 'مقروط'),
  W('habits', 'fete', 'Les habits neufs', '👘', 'Hwayej jdad', 'حوايج جداد', 'Lebsa jdida', 'لبسة جديدة'),
  W('jame3', 'fete', 'La mosquée', '🕌', 'Jjame3', 'الجامع', 'Jjame3', 'الجامع'),
  W('fanous', 'fete', 'La lanterne', '🏮', 'Fanous', 'فانوس', 'Fanous', 'فانوس'),
  W('hlal', 'fete', 'Le croissant de lune', '🌒', 'Lhlal', 'الهلال', 'Lhlal', 'الهلال', { older: true }),

  // Jardin de la mosquée : les phrases du musulman (pareilles dans les deux pays).
  // `fr` = la situation où on la dit.
  ...[
    ['bismillah', 'Avant de manger', '🍽️', 'Bismillah', 'بسم الله'],
    ['hamdoulah', 'Après avoir mangé', '😋', 'Alhamdulillah', 'الحمد لله'],
    ['salam', 'Pour dire bonjour à quelqu’un', '🙋', 'Assalamou alaykoum', 'السلام عليكم'],
    ['salam_rep', 'Pour répondre au salam', '💬', 'Wa alaykoum salam', 'وعليكم السلام'],
    ['inchallah', 'Pour parler de demain', '📅', 'Inchallah', 'إن شاء الله'],
    ['machallah', 'Devant quelque chose de beau', '🌷', 'Machallah', 'ما شاء الله'],
    ['subhanallah', 'Devant les merveilles de la création', '🌈', 'SubhanAllah', 'سبحان الله'],
    ['jazak', 'Pour remercier quelqu’un', '🎁', 'Jazak Allahou khayran', 'جزاك الله خيرا'],
    ['astaghfirullah', 'Quand on a fait une bêtise', '😔', 'Astaghfirullah', 'أستغفر الله', true],
    ['akbar', 'Pour commencer la prière', '🧎', 'Allahou akbar', 'الله أكبر', true],
  ].map(([id, fr, emoji, lat, ar, older]) => ({ id, room: 'jardin', fr, emoji, phrase: true, ma: { lat, ar }, dz: { lat, ar }, ...(older ? { older } : {}) })),
];

// Suites à remettre dans l'ordre dans le jardin (une étape à la fois).
export const SEQUENCES = [
  { id: 'woudou', title: 'Les ablutions (woudou)', ask: 'Quelle est l’étape suivante du woudou ?', steps: [
    { e: '🤲', t: 'Dire Bismillah' }, { e: '🙌', t: 'Les mains, 3 fois' }, { e: '👄', t: 'La bouche, 3 fois' },
    { e: '👃', t: 'Le nez, 3 fois' }, { e: '😊', t: 'Le visage, 3 fois' }, { e: '💪', t: 'Les bras jusqu’aux coudes, le droit d’abord' },
    { e: '💆', t: 'Les mains mouillées sur la tête' }, { e: '👂', t: 'Les oreilles' }, { e: '🦶', t: 'Les pieds jusqu’aux chevilles, le droit d’abord' },
  ] },
  { id: 'piliers', title: 'Les 5 piliers de l’islam', ask: 'Quel est le pilier suivant ?', steps: [
    { e: '☝️', t: 'La chahada : croire en Allah et en son prophète' }, { e: '🧎', t: 'La prière (salat)' },
    { e: '💝', t: 'L’aumône (zakat)' }, { e: '🌙', t: 'Le jeûne du Ramadan' }, { e: '🕋', t: 'Le pèlerinage (hajj)' },
  ] },
  { id: 'prieres', title: 'Les 5 prières de la journée', ask: 'Quelle est la prière suivante ?', steps: [
    { e: '🌅', t: 'Fajr, à l’aube' }, { e: '☀️', t: 'Dhohr, à midi' }, { e: '🌤️', t: 'Asr, l’après-midi' },
    { e: '🌇', t: 'Maghrib, au coucher du soleil' }, { e: '🌙', t: 'Icha, la nuit' },
  ] },
];

export const ROOMS = [
  { id: 'hall', name: "Hall d'entrée", theme: 'Salutations', game: 'doors', host: 'grappo', unlock: 0 },
  { id: 'stade', name: "Stade d'Assad", theme: 'La famille', game: 'penalty', host: 'assad', unlock: 0 },
  { id: 'jardin', name: 'Jardin de la mosquée', theme: 'Ma religion', game: 'garden', host: 'lantern', unlock: 0 },
  { id: 'maths', name: 'Atelier des nombres', theme: 'Maths : compter, additionner', game: 'rocket', host: 'rocket', unlock: 0, school: true },
  { id: 'lecture', name: 'Bibliothèque de Hbibiti', theme: 'Lire et écrire en français', game: 'books', host: 'books', unlock: 0, school: true },
  { id: 'poppy', name: 'Coin Poppy Playtime', theme: 'Les personnages, leurs couleurs et costumes', game: 'claw', host: 'claw', unlock: 1, school: true, fan: true },
  { id: 'alif', name: 'L’école de l’alif', theme: 'Lettres et mots arabes', game: 'garden', host: 'e-alif', unlock: 1, school: true },
  { id: 'gym', name: 'Gymnase de Fifi', theme: 'Chiffres et couleurs', game: 'basket', host: 'fifi', unlock: 2 },
  { id: 'formes', name: 'Tour de l’horloge', theme: 'Formes, suites et heure', game: 'balloons', host: 'clock', unlock: 3, school: true },
  { id: 'cuisine', name: 'Cuisine de Hbibiti', theme: 'À table !', game: 'kitchen', host: 'tajine', unlock: 4 },
  { id: 'musique', name: 'Salle de la musique', theme: 'Les actions', game: 'drums', host: 'dada', unlock: 6 },
  { id: 'corps', name: 'L’infirmerie de Fifi', theme: 'Le corps', game: 'basket', host: 'e-corps', unlock: 2 },
  { id: 'animaux', name: 'La ferme d’Assad', theme: 'Les animaux', game: 'claw', host: 'e-animaux', unlock: 3 },
  { id: 'maison', name: 'La maison de Maman', theme: 'La maison', game: 'doors', host: 'e-maison', unlock: 5 },
  { id: 'vetements', name: 'Le vestiaire de Papa', theme: 'Les vêtements', game: 'rocket', host: 'e-vetements', unlock: 7 },
  { id: 'ciel', name: 'Le balcon de Hbibiti', theme: 'Le ciel, la météo, la nature', game: 'balloons', host: 'e-ciel', unlock: 8 },
  { id: 'appel', name: 'Le téléphone de Jedda', theme: 'Parler avec la famille', game: 'drums', host: 'e-appel', unlock: 9 },
  { id: 'marche', name: 'Le marché de Hbibiti', theme: 'Fruits et légumes', game: 'kitchen', host: 'e-marche', unlock: 4 },
  { id: 'ecole', name: 'La classe de Grappo', theme: 'L’école', game: 'books', host: 'e-ecole', unlock: 6 },
  { id: 'sport', name: 'Le terrain de Fifi', theme: 'Le sport', game: 'penalty', host: 'e-sport', unlock: 10 },
  { id: 'emotions', name: 'La chambre des émotions', theme: 'Ce que je ressens', game: 'balloons', host: 'e-emotions', unlock: 11 },
  { id: 'metiers', name: 'La rue des métiers', theme: 'Les métiers', game: 'doors', host: 'e-metiers', unlock: 12 },
  { id: 'fete', name: 'La fête de Hbibiti', theme: 'Ramadan et l’Aïd', game: 'garden', host: 'e-fete', unlock: 13 },
];

export const STICKERS = [
  { e: '🦁', n: 'Assad' }, { e: '🦊', n: 'Fifi la fennec' }, { e: '🧤', n: 'Grappo' }, { e: '🥁', n: 'Darbouka Dada' },
  { e: '⚽', n: 'Le ballon d’or' }, { e: '🏀', n: 'Le ballon de Fifi' }, { e: '🫖', n: 'La théière' }, { e: '🥖', n: 'Le khobz' },
  { e: '🍊', n: 'Limoun ou tchina' }, { e: '🌴', n: 'Le palmier' }, { e: '🐪', n: 'Le chameau' }, { e: '🏆', n: 'La coupe' },
  { e: '🌙', n: 'Le croissant' }, { e: '🪔', n: 'La lanterne' }, { e: '🕌', n: 'La mosquée' }, { e: '🎵', n: 'La chanson' },
  { e: '🧞‍♂️', n: 'Le tapis volant' }, { e: '🌟', n: 'L’étoile' }, { e: '🎁', n: 'Le cadeau' }, { e: '👵', n: 'Hbibiti' },
  { e: '🍲', n: 'Le couscous' }, { e: '🪘', n: 'La derbouka d’or' }, { e: '🏟️', n: 'Le stade' }, { e: '🕋', n: 'La Kaaba' },
  { e: '🫓', n: 'Le msemen' }, { e: '🍯', n: 'Le miel' }, { e: '🌺', n: 'Le jasmin' }, { e: '⛲', n: 'La fontaine' },
  { e: '🐫', n: 'Le dromadaire' }, { e: '🦅', n: 'L’aigle de l’Atlas' },
];

// Missions à faire en vrai, en famille : une par semaine, validée par un parent.
export const MISSIONS = [
  'Dis « Sbah el khir » à un grand-parent au téléphone.',
  'Demande ton goûter en darija : « Bghit hlib ! » ou « Nhab hlib ! »',
  'Compte jusqu’à 10 en darija pendant un match de basket.',
  'Dis « Bismillah » avant chaque repas pendant une journée.',
  'Dis « Kanbghik » ou « Nhabek » à maman et à papa.',
  'Demande « Labas ? » ou « Wach rak ? » à un oncle ou une tante.',
  'Nomme 5 aliments en darija pendant le repas.',
  'Dis « Choukran » ou « Saha » quand on te donne quelque chose.',
  'Réponds au salam : « Wa alaykoum salam ».',
  'Fais le woudou avec papa ou maman.',
  'Dis « Machallah » devant quelque chose de beau.',
  'Joue à « Jacques a dit » en darija : « Gles ! Jri ! Chouf ! »',
];

export const MAX_BOX = 4; // boîte 0 = à revoir souvent … 4 = bien su

export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
export const isCousin = (w) => norm(w.ma.lat) === norm(w.dz.lat);

export function wordsFor(room, older) {
  return WORDS.filter((w) => w.room === room && (older || !w.older));
}

// Mode bilingue : les mêmes mots en anglais (une partie sur deux, ou un jour sur deux).
// Les oncles et tantes (même mot en anglais des deux côtés) et les phrases du jardin restent en arabe.
export const EN = {
  bonjour: 'Good morning', bonsoir: 'Good evening', cava: 'How are you?', merci: 'Thank you', oui: 'Yes', non: 'No',
  aurevoir: 'Goodbye', bienvenue: 'Welcome', jetaime: 'I love you', pardon: 'Sorry', beau: 'Pretty', maintenant: 'Now',
  ou: 'Where?', quoi: 'What?',
  maman: 'Mom', papa: 'Dad', frere: 'My brother', soeur: 'My sister', grandmere: 'Grandma', grandpere: 'Grandpa', bebe: 'The baby',
  n1: 'One', n2: 'Two', n3: 'Three', n4: 'Four', n5: 'Five', n6: 'Six', n7: 'Seven', n8: 'Eight', n9: 'Nine', n10: 'Ten',
  rouge: 'Red', vert: 'Green', jaune: 'Yellow', bleu: 'Blue', blanc: 'White', noir: 'Black',
  pain: 'Bread', eau: 'Water', lait: 'Milk', the: 'Tea', orange: 'Orange', tomate: 'Tomato', patate: 'Potato', viande: 'Meat',
  poulet: 'Chicken', couscous: 'Couscous', pomme: 'Apple', banane: 'Banana',
  va: 'Go!', viens: 'Come!', regarde: 'Look!', mange: 'Eat!', bois: 'Drink!', dors: 'Sleep!', cours: 'Run!', joue: 'Play!',
  chante: 'Sing!', ecoute: 'Listen!', assis: 'Sit down!', donne: 'Give me!',
  tete: 'Head', yeux: 'Eyes', oreille: 'Ear', nez: 'Nose', bouche: 'Mouth', main: 'Hand', pied: 'Foot', dents: 'Teeth',
  cheveux: 'Hair', bras: 'Arm', coeur: 'Heart',
  chat: 'Cat', chien: 'Dog', cheval: 'Horse', vache: 'Cow', mouton: 'Sheep', poule: 'Hen', oiseau: 'Bird', poisson: 'Fish',
  chameau: 'Camel', lion: 'Lion', souris: 'Mouse', tortue: 'Turtle',
  dar: 'House', porte: 'Door', fenetre: 'Window', lit: 'Bed', table: 'Table', chaise: 'Chair', cle: 'Key', lumiere: 'Light',
  tel: 'Phone', tele: 'TV', balai: 'Broom',
  chaussures: 'Shoes', pantalon: 'Pants', chemise: 'Shirt', chaussettes: 'Socks', manteau: 'Coat', casquette: 'Cap',
  lunettes: 'Glasses', robe: 'Dress', sac: 'Bag', echarpe: 'Scarf',
  soleil: 'Sun', lune: 'Moon', etoile: 'Star', pluie: 'Rain', neige: 'Snow', vent: 'Wind', froid: 'It is cold',
  chaud: 'It is hot', arbre: 'Tree', fleur: 'Flower', mer: 'Sea', aujourdhui: 'Today', demain: 'Tomorrow', hier: 'Yesterday',
  bien: 'I am fine', manque: 'I miss you', faim: 'I am hungry', soif: 'I am thirsty', fatigue: 'I am tired', bisous: 'Kisses!',
  bonnenuit: 'Good night', doucement: 'Slowly', vite: 'Quick!', sais: 'I don’t know', nom: 'What is your name?', moi: 'My name is…',
  raisin: 'Grapes', fraise: 'Strawberry', pasteque: 'Watermelon', melon: 'Melon', dattes: 'Dates', olives: 'Olives',
  carotte: 'Carrot', oignon: 'Onion', courgette: 'Zucchini', citron: 'Lemon',
  madrasa: 'School', maitresse: 'Teacher', cahier: 'Notebook', stylo: 'Pen', crayon: 'Pencil', livre: 'Book', ami: 'My friend',
  lis: 'Read!', ecris: 'Write!', tableau: 'Board', ciseaux: 'Scissors',
  ballon: 'Ball', gagne: 'We won!', perdu: 'We lost', saute: 'Jump!', lance: 'Throw!', attrape: 'Catch!', equipe: 'Team',
  nage: 'Swim!', velo: 'Bike', fort: 'Strong',
  content: 'Happy', triste: 'Sad', fache: 'Angry', peur: 'I am scared', malade: 'Sick', mal: 'It hurts', ris: 'Laugh!',
  pleurepas: 'Don’t cry', gentil: 'Kind',
  medecin: 'Doctor', policier: 'Police officer', boulanger: 'Baker', cuisinier: 'Cook', chauffeur: 'Driver', coiffeur: 'Barber',
  menuisier: 'Carpenter', fermier: 'Farmer', pecheur: 'Fisherman', imam: 'Imam',
  ramadan: 'Ramadan', siyam: 'Fasting', ftour: 'Iftar', aid: 'Eid', aidmbarek: 'Happy Eid!', cadeau: 'Present', gateaux: 'Cookies',
  habits: 'New clothes', jame3: 'Mosque', fanous: 'Lantern', hlal: 'Crescent moon',
};
// Un mot vu « en anglais » : son propre suivi de révision (id « en:… ») et la langue « en » à la place des dialectes.
export const toEnglish = (w) => ({ ...w, id: 'en:' + w.id, base: w.id, en: { lat: EN[w.id], ar: '' } });
export const englishWords = (room, older) => wordsFor(room, older).filter((w) => EN[w.id]).map(toEnglish);
// Une salle de mots peut-elle se jouer en anglais ?
export const hasEnglish = (room) => WORDS.some((w) => w.room === room && EN[w.id]);

export function newProgress() {
  return { words: {}, stickers: 0, stars: 0, levels: 0, gold: 0, missions: {}, chest: '', rooms: {}, best: 0, tales: {} };
}

export function roomUnlocked(room, progress, all = false) {
  return all || (progress.levels || 0) >= (room.unlock || 0);
}

// Répétition espacée façon Leitner : bonne réponse du premier coup = boîte suivante,
// erreur = on recule d'une boîte. Rien n'est jamais « perdu » d'un coup.
export function grade(progress, id, correct, now = Date.now()) {
  const w = progress.words[id] || (progress.words[id] = { box: 0, right: 0, wrong: 0, seen: true });
  w.seen = true;
  w.last = now;
  if (correct) { w.right++; w.box = Math.min(MAX_BOX, w.box + 1); }
  else { w.wrong++; w.box = Math.max(0, w.box - 1); }
  return w;
}

export function markSeen(progress, id) {
  const w = progress.words[id] || (progress.words[id] = { box: 0, right: 0, wrong: 0 });
  w.seen = true;
}

// Niveau moyen des boîtes (0 à 1) : le brouillard recule un peu à chaque bonne réponse.
export function mastery(progress, words) {
  if (!words.length) return 0;
  return words.reduce((a, w) => a + (progress.words[w.id]?.box || 0), 0) / (words.length * MAX_BOX);
}

export function rng(seed = Date.now()) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];
export function shuffle(arr, r = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Tirage pondéré : les mots des petites boîtes (mal sus) reviennent plus souvent.
function weighted(words, progress, r) {
  const ws = words.map((w) => MAX_BOX + 1 - (progress.words[w.id]?.box || 0));
  let t = r() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < words.length; i++) { t -= ws[i]; if (t < 0) return words[i]; }
  return words[words.length - 1];
}

// opts : { older, dialects: ['ma','dz'], count, r, seqIndex }
// Renvoie { learn: [mots nouveaux], questions: [...] }.
export function buildLevel(room, progress, opts = {}) {
  const r = opts.r || Math.random;
  const older = !!opts.older;
  const dialects = opts.lang === 'en' ? ['en'] : opts.dialects?.length ? opts.dialects : ['ma', 'dz'];
  const garden = room === 'jardin' && !opts.noSequence && opts.lang !== 'en';
  const count = opts.count || 5;
  const wordCount = garden ? count - 1 : count;
  const pool = opts.lang === 'en' ? englishWords(room, older) : wordsFor(room, older);
  const unseen = pool.filter((w) => !progress.words[w.id]?.seen);
  const learn = unseen.slice(0, Math.min(older ? 3 : 2, wordCount));
  const known = pool.filter((w) => progress.words[w.id]?.seen);

  const targets = learn.slice();
  let guard = 0;
  while (targets.length < wordCount && guard++ < 80) {
    const src = known.length ? known : learn.length ? learn : pool;
    const w = weighted(src, progress, r);
    if (targets[targets.length - 1] !== w) targets.push(w);
  }
  const questions = shuffle(targets, r).map((w, i) => makeQuestion(w, pool, {
    older, dialect: dialects[i % dialects.length], dialects, r,
  }));
  if (garden) questions.push(makeSequence(opts.seqIndex ?? Math.floor(r() * SEQUENCES.length), older));
  return { learn, questions };
}

// Mode frère-sœur : les questions alternent entre les deux enfants, chacun à son niveau.
export function buildCoop(room, players, opts = {}) {
  const per = Math.max(2, Math.ceil((opts.count || 6) / players.length));
  const build = opts.build || buildLevel;
  const levels = players.map((p, i) => build(room, p.progress, { ...opts, older: p.older, count: per, noSequence: i > 0 }));
  const questions = [];
  for (let i = 0; i < per; i++) levels.forEach((lv, pi) => { if (lv.questions[i]) questions.push({ ...lv.questions[i], player: pi }); });
  const learn = [];
  for (const lv of levels) for (const w of lv.learn) if (!learn.includes(w) && learn.length < 3) learn.push(w);
  return { learn, questions };
}

// Types : 'listen' (j'entends → je touche l'image), 'fr2dz' (mot français → darija écrite),
// 'cousin' (mot marocain → son équivalent algérien, ou l'inverse).
export function makeQuestion(word, pool, { older, dialect, dialects = ['ma', 'dz'], r = Math.random }) {
  let type = 'listen';
  if (older) {
    const types = ['listen', 'fr2dz', 'fr2dz'];
    if (dialects.length > 1 && !isCousin(word)) types.push('cousin', 'cousin');
    type = pick(types, r);
  }
  const n = 3;
  const other = dialect === 'ma' ? 'dz' : 'ma';
  const shown = type === 'listen' ? (w) => w.emoji
    : type === 'fr2dz' ? (w) => norm(w[dialect].lat)
    : (w) => norm(w[other].lat);
  const all = pool.length >= n ? pool : WORDS.filter((w) => !!w.phrase === !!word.phrase);
  const distract = shuffle(all.filter((w) => w.id !== word.id && shown(w) !== shown(word)), r);
  const choices = [word];
  for (const w of distract) {
    if (choices.length >= n) break;
    if (!choices.some((c) => shown(c) === shown(w))) choices.push(w);
  }
  return {
    type, word, dialect, other,
    choices: shuffle(choices, r).map((w) => ({ id: w.id, word: w, correct: w.id === word.id })),
  };
}

export function makeSequence(index, older) {
  const seq = SEQUENCES[((index % SEQUENCES.length) + SEQUENCES.length) % SEQUENCES.length];
  return { type: 'sequence', seq, options: older ? 4 : 3, word: { id: 'seq-' + seq.id, fr: seq.title, emoji: seq.steps[0].e } };
}

// Étape suivante d'une suite : la bonne + des étapes plus loin (jamais une étape déjà placée).
export function sequenceChoices(seq, done, options, r = Math.random) {
  const right = seq.steps[done];
  if (!right) return [];
  const rest = shuffle(seq.steps.slice(done + 1), r).slice(0, options - 1);
  return shuffle([right, ...rest], r).map((s) => ({ step: s, correct: s === right }));
}

export function weekIndex(d = new Date()) {
  return Math.floor((d.getTime() / 86400000 + 3) / 7); // semaines commençant le lundi
}
export function missionOfWeek(d = new Date()) {
  const i = weekIndex(d);
  return { key: 'w' + i, text: MISSIONS[i % MISSIONS.length] };
}

export function today(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Version lisible par une voix française d'un mot écrit « à la darija » (3 → a).
export function speakable(lat) {
  return String(lat).replace(/3/g, 'a').replace(/7/g, 'h').replace(/9/g, 'q');
}
