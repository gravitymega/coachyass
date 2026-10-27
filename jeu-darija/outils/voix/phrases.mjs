// Liste toutes les phrases françaises que le jeu peut dire, pour les enregistrer à l'avance.
// Usage : node jeu-darija/outils/voix/phrases.mjs > phrases.json
// À relancer après chaque changement de texte ; les phrases manquantes passent par la voix de la tablette.
import { WORDS, ROOMS, SEQUENCES, STICKERS, EN } from '../../core.js';
import { SKILLS, makeExercise } from '../../exercises.js';
import { TALES, speakTale } from '../../tales.js';
import { DAILY } from '../../missions.js';
// characters.js et store.js sont écrits pour le navigateur : on leur donne un faux décor minimal.
globalThis.window = { addEventListener() {}, dispatchEvent() {} };
globalThis.document = { addEventListener() {} };
globalThis.CustomEvent = class {};
globalThis.fetch = () => Promise.reject(new Error('hors navigateur'));
const { PHRASES, INTRO } = await import('../../characters.js');
const { DEFAULT_SETTINGS } = await import('../../store.js');
import { voiceKey, normalize, fixFr } from '../../voix.js';

const out = new Map();
const add = (...ts) => { for (const t of ts) if (typeof t === 'string' && /[a-zà-ÿ0-9]/i.test(t)) out.set(voiceKey(t), normalize(t)); };

const kids = DEFAULT_SETTINGS.kids.map((k) => k.name);
const groups = [...kids, kids.join(' et ')];
const gm = DEFAULT_SETTINGS.gm;
const mid = (s) => (/^(Le|La|Les|L’)/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const DIALECT = { ma: 'au Maroc', dz: 'en Algérie' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Accueil, histoire du début, carte, fin de journée
for (const n of groups) {
  add(`Salam ${n} ! Je suis ${gm}. Bienvenue dans mon usine magique, où les jouets parlent darija, comme au Maroc et en Algérie !`);
  add(`Bslama ${n} ! Tu as bien travaillé. On se retrouve demain, inchallah.`);
  add(`Salam ${n} ! Choisis une salle pour réveiller mes jouets !`);
  for (let m = 0; m <= 100; m++) add(`Salam ${n} ! L'usine est réveillée à ${m} %. Choisis une salle !`);
  add(`Viens t'asseoir près de moi, ${n}. Quelle histoire veux-tu écouter ?`);
  add(`Salam ${n} ! Voici les missions de Papa et Maman pour aujourd'hui. Touche une mission pour l'écouter.`);
  add(`Machallah ${n} ! Toutes les missions sont réussies aujourd'hui. Papa et Maman sont très fiers de toi !`);
  add(`Bravo ${n} !`);
}
add('Mais le brouillard de l’oubli est arrivé… Mes jouets se sont endormis : ils ont oublié leurs mots !');
add('Avec Grappo le gant magique, Assad le lion et Fifi la fennec, aide-moi à les réveiller. Chaque mot appris fait reculer le brouillard. Yallah !');
add(...Object.values(INTRO), ...Object.values(PHRASES).flat());
add(...ROOMS.map((r) => r.name), 'Défi éclair');
add('Bismillah !', 'Alhamdulillah !', `Et voici le coffre de ${gm} !`, 'Salam ya galbi ! Je suis Hbibiti. Viens, on apprend ensemble.');
for (const n of kids) {
  add(`À toi, ${n} !`);
  for (const st of STICKERS) add(`Bravo ${n}, tu as réveillé ${mid(st.n)} !`);
  add(`Machallah ${n} ! Les trois missions sont réussies : médaille d'or !`, `Bravo ${n} ! Papa est très fier de toi.`, `Bravo ${n} ! Maman est très fière de toi.`);
}

// Mots : apprendre et questions
add("C'est un mot cousin !", 'Écoute bien.', 'Quand dit-on ça ?', `${gm} demande :`, "C'était celui-là !");
for (const d of ['ma', 'dz']) add(`${cap(DIALECT[d])}, on dit :`, `Et ${DIALECT[d]} ?`);
for (const w of WORDS) {
  add(w.fr, `${w.fr}, on dit :`, `${w.fr}, on dit quoi ?`);
  for (const d of ['ma', 'dz']) add(`Comment on dit ${w.fr}, ${DIALECT[d]} ?`);
}
for (const s of SEQUENCES) add(s.title, s.ask, ...s.steps.map((x) => x.t));
add('Machallah ! Tout est dans le bon ordre.', 'Pas encore celle-là.');

// Réponses
add('Bravo !', 'Machallah !', 'Zwin bezzaf !', 'Super !', 'Saha !', 'Waouh !', 'Top !');
add('Presque ! Essaie encore.', 'Voici la bonne réponse.', 'Voici la bonne réponse :');

// Exercices : on tire chaque compétence jusqu'à ne plus trouver de nouvelle phrase.
for (const skill of Object.keys(SKILLS)) {
  let calm = 0;
  for (let i = 0; i < 400000 && calm < 40000; i++) {
    const before = out.size;
    const q = makeExercise(skill, { dialect: i % 2 ? 'ma' : 'dz' });
    add(...q.say, ...q.answer.say, ...q.choices.map((c) => c.say));
    calm = out.size === before ? calm + 1 : 0;
  }
}

// Histoires
for (const t of TALES) {
  add(t.title + '.', ...t.pages.map((p) => speakTale(p.t)));
  for (const q of t.quiz) add(speakTale(q.q), ...q.a.map((a) => speakTale(a[1])));
  add(`Demain, je te raconterai peut-être : ${t.title}.`);
}
add('ou', 'Alhamdulillah ! Bravo, tu as bien écouté.');

// Mode bilingue : consignes en français et mots en anglais (voix anglaise).
add('En anglais, on dit :', 'Et en anglais ?', 'Cette partie est en anglais !', 'Cette partie est en arabe !');
const english = new Map();
for (const w of WORDS) if (EN[w.id]) {
  add(`Comment on dit ${w.fr}, en anglais ?`);
  english.set(voiceKey('EN|' + EN[w.id]), EN[w.id]);
}

// Missions de Papa et Maman
add('Papa dit :', 'Maman dit :');
for (const m of DAILY) for (const n of m.t.includes('{frere}') ? kids : [null]) add(m.t.replace('{frere}', n || ''));

const list = [...out].map(([key, text]) => ({ key, text, say: fixFr(text) }))
  .concat([...english].map(([key, text]) => ({ key, text, say: text, lang: 'en-us', voice: 'af_heart' })));
process.stdout.write(JSON.stringify(list, null, 0));
console.error(`${list.length} phrases`);
