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
    const q = makeExercise(skill, { dialect: i % 2 ? 'ma' : 'dz', player: kids[i % kids.length] });
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

// La ville de Hbibiti
import { NPCS } from '../../ville-core.js';
add(`Bienvenue dans la ville de ${gm} ! Cours, saute et parle aux habitants pour recevoir des missions.`);
add("Salam ! J'ai une question pour toi.", 'Merci pour ton aide ! Va voir les autres habitants.', 'Merci beaucoup ! En darija, on dit :', 'Encore 1 !', 'Encore 2 !');
for (const n of NPCS) {
  add(`Tu as tout trouvé ! Retourne voir ${n.name}.`, `Finis d'abord la mission de ${n.name}, puis reviens me voir !`);
}
for (const w of WORDS) if (w.emoji && !w.phrase) add(`Peux-tu me trouver 3 fois : ${w.fr} ? Ils sont cachés dans la ville.`);

// Activités
const PRAISE_LIST = ['Bravo !', 'Machallah !', 'Zwin bezzaf !', 'Super !', 'Saha !', 'Waouh !', 'Top !'];
import { VILLES, RECETTES, NOMS, PRODUITS, SOURATES } from '../../act-data.js';
import { ALIF } from '../../exercises.js';
import { PRAYERS } from '../../calendrier.js';
add('Choisis un bloc, puis touche une case pour construire. Touche ton bloc pour l’enlever.', 'Il te manque des pièces ! Ramasse les pièces de la ville ou réussis un niveau.',
  'Ramadan mbarek ! La ville est illuminée. Les habitants préparent la fête.', 'Bienvenue au souk ! Achète, paie et compte bien.', 'Bravo ! Tu connais bien ta famille. Machallah !',
  'Buuut !', 'Choisis ton adversaire. Assad compte sur toi !', 'Choisis ton animal et donne-lui un prénom.', 'Choisis une sourate. On l’apprend ligne par ligne.',
  'Choisis une ville. On part en voyage au Maroc et en Algérie !', 'Demande à Papa ou Maman d’ajouter des photos de la famille : Jeddi, Jedda, tes oncles et tes tantes !',
  'Demande à Papa ou à Maman de réciter ce verset, puis de l’enregistrer avec le bouton Parents.', 'Il te faut une étoile. Joue dans l’usine pour en gagner !',
  'Maintiens d’abord le micro et dis le mot !', 'Oups, reste bien sur la lettre ! On recommence.', 'Pas de ballon cette fois. Question suivante !',
  'Ton rythme est gardé ! Fais-le écouter à Papa et Maman.', 'Touche les cases pour créer ton rythme, puis appuie sur Jouer. Doum, tek, tek !',
  'Bravo ! Tu sais faire les courses au souk.', 'Les Lions d’Assad sont champions ! Bravo !', 'La saison est finie. On recommence pour gagner la coupe ?',
  'Miam miam ! Bssaha !', 'Et après ?', 'Par quoi on commence ?', 'Panier !', 'Swish !', 'Surprise ! Quelqu’un t’a envoyé un message. Touche l’enveloppe !',
  'Touche une enveloppe pour écouter le message.', "C'était :", 'Le compte est bon !', 'À toi de tirer !', 'Égalité ! Bravo à tous les deux !', 'Papa a gagné cette fois. Revanche ?', 'Maman a gagné cette fois. Revanche ?',
  'Mimi a faim ! Donne-lui à manger.', 'Mimi est content de te voir !', 'Waouh ! Mimi a grandi !');
for (let n = 1; n <= 20; n++) add(String(n));
for (const pr of PRAISE_LIST) {
  add(`${pr} Le compte est bon !`, `${pr} À toi de tirer !`);
  for (let price = 2; price <= 8; price++) { const given = price < 5 ? 5 : 10; add(`${pr} ${given} moins ${price}, ça fait ${given - price}.`); }
}
for (const L of ALIF) add(`Trace la lettre ${L.say}. Commence au point vert.`, `La lettre ${L.say}.`, ...PRAISE_LIST.map((pr) => `${pr} Tu as écrit la lettre ${L.say}, comme dans ${L.fr}.`));
for (const s of SOURATES) add(`Machallah ! Tu connais l’ordre de la sourate ${s.name}.`);
for (const v of VILLES) {
  add(`Bienvenue à ${v.name} ! Voici ${v.monument.name}. ${v.monument.fact} Ici, on mange ${v.plat.name.toLowerCase()}. Et on dit ${v.mot.lat} : ${v.mot.fr}.`,
    `Bravo ! Tu as gagné le tampon de ${v.name} dans ton passeport.`, `Quel monument as-tu vu à ${v.name} ?`, `Qu'est-ce qu'on mange à ${v.name} ?`, `Que veut dire « ${v.mot.lat} » ?`);
}
add('Écoute bien et trouve-le avec la lampe !', 'Pas celui-là ! Cherche encore avec la lampe.', 'Bravo ! Avec Glowby, tu as trouvé tous les mots cachés !');
for (const w of WORDS) for (const d of ['ma', 'dz']) add(`Trouve comment on dit ${w.fr}, ${DIALECT[d]}.`);
add(`Qu'est-ce qu'on prépare aujourd'hui avec ${gm} ?`, `Bssaha ! C'est prêt. ${gm} est fière de toi !`);
for (const r of RECETTES) for (const ing of r.ing) add(`Apporte-moi ${ing.n} ${ing.unit ? ing.unit + ' de ' : ''}${ing.fr}.`, `Non, ça c'est autre chose. Il faut : ${ing.fr}.`);
for (const n of NOMS) add(`${n.lat} : ${n.fr}.`);
for (const it of PRODUITS) for (const money of ['dirhams', 'dinars']) {
  const c = it.fr.charAt(0).toUpperCase() + it.fr.slice(1);
  for (let price = 1; price <= 9; price++) {
    add(`${c}, ça fait ${price} ${money}.`, `Oh, c'est trop ! Il faut ${price}. On recommence.`);
    if (price >= 2 && price <= 8) add(`${c} coûte ${price} ${money}. Tu donnes ${price < 5 ? 5 : 10}. Combien le marchand te rend ?`);
  }
}
for (let a = 1; a <= 10; a++) for (let b = 1; b <= 9; b++) { add(`${a} plus ${b}, ça fait combien ?`); if (a > b) add(`${a} moins ${b}, ça fait combien ?`); }
for (let a = 1; a <= 3; a++) for (let b = 1; b <= 2; b++) add(`Compte les ballons : ${a} plus ${b}.`);
for (let s = 0; s <= 6; s++) add(`Bravo ! ${s} paniers. Fifi est contente !`);
for (const pr of PRAYERS) add(`C'est l'heure de la prière ${pr.name}. Allons faire les ablutions !`);
for (const d of ['ma', 'dz']) add(`Qui c'est ? Dis-le ${DIALECT[d]}.`);
for (const n of [...kids, 'Papa', 'Maman']) add(`À toi, ${n} !`, `${n} a gagné ! Machallah !`);
for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) { if (a > b) add(`Victoire ${a} à ${b} ! Bravo !`); if (a === b) add(`Match nul, ${a} partout !`); if (a < b) add(`Défaite ${a} à ${b}. On fera mieux au prochain match !`); }

const list = [...out].map(([key, text]) => ({ key, text, say: fixFr(text) }))
  .concat([...english].map(([key, text]) => ({ key, text, say: text, lang: 'en-us', voice: 'af_heart' })));
process.stdout.write(JSON.stringify(list, null, 0));
console.error(`${list.length} phrases`);
