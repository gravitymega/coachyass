// L'Usine magique de Hbibiti — logique pure (données, révision, questions).
// Aucun accès au DOM : testable avec Node (node --test jeu-darija/core.test.mjs).

// Darija écrite en lettres latines comme on l'écrit en message : 3 = ع, 7 = ح.
// `older` : mot réservé au profil « grand » (Ali), trop abstrait pour 5 ans.
export const WORDS = [
  // Hall d'entrée : salutations
  { id: 'bonjour', room: 'hall', fr: 'Bonjour', emoji: '☀️', ma: { lat: 'Sbah el khir', ar: 'صباح الخير' }, dz: { lat: 'Sbah el khir', ar: 'صباح الخير' } },
  { id: 'bonsoir', room: 'hall', fr: 'Bonsoir', emoji: '🌙', ma: { lat: 'Msa el khir', ar: 'مسا الخير' }, dz: { lat: 'Msa el khir', ar: 'مسا الخير' } },
  { id: 'cava', room: 'hall', fr: 'Ça va ?', emoji: '😊', ma: { lat: 'Labas ?', ar: 'لاباس؟' }, dz: { lat: 'Wach rak ?', ar: 'واش راك؟' } },
  { id: 'merci', room: 'hall', fr: 'Merci', emoji: '🙏', ma: { lat: 'Choukran', ar: 'شكرا' }, dz: { lat: 'Saha', ar: 'صحّة' } },
  { id: 'oui', room: 'hall', fr: 'Oui', emoji: '👍', ma: { lat: 'Iyeh', ar: 'إيه' }, dz: { lat: 'Ih', ar: 'إيه' } },
  { id: 'non', room: 'hall', fr: 'Non', emoji: '👎', ma: { lat: 'La', ar: 'لا' }, dz: { lat: 'La', ar: 'لا' } },
  { id: 'aurevoir', room: 'hall', fr: 'Au revoir', emoji: '👋', ma: { lat: 'Bslama', ar: 'بسلامة' }, dz: { lat: 'Bslama', ar: 'بسلامة' } },
  { id: 'jetaime', room: 'hall', fr: "Je t'aime", emoji: '❤️', ma: { lat: 'Kanbghik', ar: 'كنبغيك' }, dz: { lat: 'Nhabek', ar: 'نحبّك' } },
  { id: 'viens', room: 'hall', fr: 'Viens !', emoji: '🫴', ma: { lat: 'Aji !', ar: 'أجي!' }, dz: { lat: 'Arwah !', ar: 'أرواح!' } },
  { id: 'maintenant', room: 'hall', fr: 'Maintenant', emoji: '⏰', older: true, ma: { lat: 'Daba', ar: 'دابا' }, dz: { lat: 'Dorka', ar: 'درك' } },
  { id: 'ou', room: 'hall', fr: 'Où ?', emoji: '🔍', older: true, ma: { lat: 'Fin ?', ar: 'فين؟' }, dz: { lat: 'Win ?', ar: 'وين؟' } },
  { id: 'quoi', room: 'hall', fr: 'Quoi ?', emoji: '🤔', older: true, ma: { lat: 'Ach ?', ar: 'آش؟' }, dz: { lat: 'Wach ?', ar: 'واش؟' } },
  // Stade d'Assad : la famille
  { id: 'maman', room: 'stade', fr: 'Maman', emoji: '👩', ma: { lat: 'Mama', ar: 'ماما' }, dz: { lat: 'Yemma', ar: 'يمّا' } },
  { id: 'papa', room: 'stade', fr: 'Papa', emoji: '👨', ma: { lat: 'Baba', ar: 'بابا' }, dz: { lat: 'Baba', ar: 'بابا' } },
  { id: 'frere', room: 'stade', fr: 'Mon frère', emoji: '👦', ma: { lat: 'Khouya', ar: 'خويا' }, dz: { lat: 'Khouya', ar: 'خويا' } },
  { id: 'soeur', room: 'stade', fr: 'Ma sœur', emoji: '👧', ma: { lat: 'Khti', ar: 'ختي' }, dz: { lat: 'Khti', ar: 'ختي' } },
  { id: 'grandmere', room: 'stade', fr: 'Grand-mère', emoji: '👵', ma: { lat: 'Jedda', ar: 'جدّة' }, dz: { lat: 'Jedda', ar: 'جدّة' } },
  { id: 'grandpere', room: 'stade', fr: 'Grand-père', emoji: '👴', ma: { lat: 'Jeddi', ar: 'جدّي' }, dz: { lat: 'Jeddi', ar: 'جدّي' } },
  { id: 'oncle_p', room: 'stade', fr: 'Mon oncle (frère de papa)', emoji: '🧔', older: true, ma: { lat: '3ammi', ar: 'عمّي' }, dz: { lat: '3ammi', ar: 'عمّي' } },
  { id: 'oncle_m', room: 'stade', fr: 'Mon oncle (frère de maman)', emoji: '🧔‍♂️', older: true, ma: { lat: 'Khali', ar: 'خالي' }, dz: { lat: 'Khali', ar: 'خالي' } },
];

export const ROOMS = [
  { id: 'hall', name: "Hall d'entrée", theme: 'Salutations', game: 'doors', emoji: '🚪', host: 'Grappo, le gant magique' },
  { id: 'stade', name: "Stade d'Assad", theme: 'La famille', game: 'penalty', emoji: '⚽', host: 'Assad, le lion de l’Atlas' },
  { id: 'gym', name: 'Gymnase de Fifi', theme: 'Chiffres', soon: true, emoji: '🏀' },
  { id: 'cuisine', name: 'Cuisine de Hbibiti', theme: 'Nourriture', soon: true, emoji: '🍲' },
  { id: 'musique', name: 'Salle de la musique', theme: 'Actions', soon: true, emoji: '🥁' },
  { id: 'jardin', name: 'Jardin de la mosquée', theme: 'Religion', soon: true, emoji: '🕌' },
];

// Un autocollant par niveau terminé, dans cet ordre.
export const STICKERS = [
  { e: '🦁', n: 'Assad' }, { e: '🦊', n: 'Fifi la fennec' }, { e: '🧤', n: 'Grappo' }, { e: '🥁', n: 'Darbouka Dada' },
  { e: '⚽', n: 'Le ballon d’or' }, { e: '🏀', n: 'Le ballon de Fifi' }, { e: '🫖', n: 'La théière' }, { e: '🥖', n: 'Lkhobz' },
  { e: '🍊', n: 'Limoun / Tchina' }, { e: '🌴', n: 'Le palmier' }, { e: '🐪', n: 'Le chameau' }, { e: '🏆', n: 'La coupe' },
  { e: '🌙', n: 'Le croissant' }, { e: '🪔', n: 'La lanterne' }, { e: '🕌', n: 'La mosquée' }, { e: '🎵', n: 'La chanson' },
  { e: '🧞‍♂️', n: 'Le tapis volant' }, { e: '🌟', n: 'L’étoile' }, { e: '🎁', n: 'Le cadeau' }, { e: '👵', n: 'Hbibiti' },
];

export const MAX_BOX = 4; // boîte 0 = à revoir souvent … 4 = bien su

export const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const isCousin = (w) => norm(w.ma.lat) === norm(w.dz.lat);

export function wordsFor(room, older) {
  return WORDS.filter((w) => w.room === room && (older || !w.older));
}

export function newProgress() {
  return { words: {}, stickers: 0, stars: 0, levels: 0 };
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

// Niveau moyen des boîtes (0 à 1) : sert au brouillard qui recule, un peu à chaque bonne réponse.
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

// opts : { older, dialects: ['ma','dz'], count, r }
// Renvoie { learn: [mots nouveaux], questions: [...] }.
export function buildLevel(room, progress, opts = {}) {
  const r = opts.r || Math.random;
  const older = !!opts.older;
  const dialects = opts.dialects?.length ? opts.dialects : ['ma', 'dz'];
  const count = opts.count || 5;
  const pool = wordsFor(room, older);
  const unseen = pool.filter((w) => !progress.words[w.id]?.seen);
  const learn = unseen.slice(0, older ? 3 : 2);
  const known = pool.filter((w) => progress.words[w.id]?.seen);

  const targets = learn.slice();
  let guard = 0;
  while (targets.length < count && guard++ < 50) {
    const src = known.length ? known : learn.length ? learn : pool;
    const w = weighted(src, progress, r);
    if (targets[targets.length - 1] !== w) targets.push(w);
  }
  const ordered = shuffle(targets, r);
  const questions = ordered.map((w, i) => makeQuestion(w, pool, {
    older, dialect: dialects[i % dialects.length], dialects, r,
  }));
  return { learn, questions };
}

// Types : 'listen' (j'entends → je touche l'image), 'fr2dz' (mot français → darija écrite),
// 'cousin' (mot marocain → son équivalent algérien, ou l'inverse).
export function makeQuestion(word, pool, { older, dialect, dialects = ['ma', 'dz'], r = Math.random }) {
  let type = 'listen';
  if (older) {
    const types = ['listen', 'fr2dz'];
    if (dialects.length > 1 && !isCousin(word)) types.push('cousin', 'cousin');
    type = pick(types, r);
  }
  const n = 3; // 3 ballons, 3 portes
  const other = dialect === 'ma' ? 'dz' : 'ma';
  // Ce que l'enfant doit reconnaître dans les choix :
  const shown = type === 'listen' ? (w) => w.emoji
    : type === 'fr2dz' ? (w) => norm(w[dialect].lat)
    : (w) => norm(w[other].lat);
  const all = pool.length >= n ? pool : WORDS;
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

export function today(d = new Date()) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Version lisible par une voix française d'un mot écrit « à la darija » (3 → a, 7 → h, 9 → q).
export function speakable(lat) {
  return String(lat).replace(/3/g, 'a').replace(/7/g, 'h').replace(/9/g, 'q');
}
