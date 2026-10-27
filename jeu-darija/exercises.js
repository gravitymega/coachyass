// Défis d'apprentissage : mathématiques, lecture (français), formes et heure.
// Les questions sont fabriquées à la volée (jamais deux fois la même partie) ;
// chaque compétence a sa boîte de révision, comme les mots (clé « x:<compétence> »).
// Logique pure, testable avec Node.
import { WORDS, MAX_BOX, shuffle, wordsFor, makeQuestion } from './core.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1)); // entier entre a et b inclus
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

// ---------- Banques de données ----------
// Mots illustrés pour la lecture : syllabes orales sûres (syl, null si ambigu), son du début (snd), rime.
export const MOTS = [
  ['chat', '🐱', 1, 'ch', 'a'], ['lune', '🌙', null, 'l', 'une'], ['vélo', '🚲', 2, 'v', 'o'], ['moto', '🏍️', 2, 'm', 'o'],
  ['pomme', '🍎', null, 'p', 'omme'], ['sapin', '🎄', 2, 's', 'in'], ['lapin', '🐰', 2, 'l', 'in'], ['fusée', '🚀', 2, 'f', 'é'],
  ['bébé', '👶', 2, 'b', 'é'], ['ballon', '⚽', 2, 'b', 'on'], ['soleil', '☀️', 2, 's', 'eil'], ['maison', '🏠', 2, 'm', 'on'],
  ['panda', '🐼', 2, 'p', 'a'], ['citron', '🍋', 2, 's', 'on'], ['cadeau', '🎁', 2, 'k', 'o'], ['gâteau', '🎂', 2, 'g', 'o'],
  ['tortue', '🐢', 2, 't', 'u'], ['souris', '🐭', 2, 's', 'i'], ['papillon', '🦋', 3, 'p', 'on'], ['canard', '🦆', 2, 'k', 'ar'],
  ['mouton', '🐑', 2, 'm', 'on'], ['robot', '🤖', 2, 'r', 'o'], ['kiwi', '🥝', 2, 'k', 'i'], ['dragon', '🐉', 2, 'd', 'on'],
  ['bateau', '⛵', 2, 'b', 'o'], ['chapeau', '🎩', 2, 'ch', 'o'], ['raisin', '🍇', 2, 'r', 'in'], ['poussin', '🐥', 2, 'p', 'in'],
  ['camion', '🚚', 2, 'k', 'on'], ['bonbon', '🍬', 2, 'b', 'on'], ['hibou', '🦉', 2, 'i', 'ou'], ['kangourou', '🦘', 3, 'k', 'ou'],
  ['chocolat', '🍫', 3, 'ch', 'a'], ['ananas', '🍍', 3, 'a', 'as'], ['éléphant', '🐘', 3, 'é', 'an'], ['pain', '🍞', 1, 'p', 'in'],
  ['lait', '🥛', 1, 'l', 'è'], ['fleur', '🌸', 1, 'f', 'eur'], ['train', '🚂', 1, 't', 'in'], ['clé', '🔑', 1, 'k', 'é'],
  ['roi', '👑', 1, 'r', 'oi'], ['loup', '🐺', 1, 'l', 'ou'], ['chien', '🐶', 1, 'ch', 'in'], ['fraise', '🍓', null, 'f', 'aise'],
  ['chaise', '🪑', null, 'ch', 'aise'], ['tomate', '🍅', null, 't', 'ate'], ['banane', '🍌', null, 'b', 'ane'], ['nuage', '☁️', null, 'n', 'age'],
  ['vache', '🐄', null, 'v', 'ache'], ['dinde', '🦃', null, 'd', 'inde'],
].map(([mot, e, syl, snd, rime]) => ({ mot, e, syl, snd, rime }));
const MOTS_OK = MOTS;

const PHRASES = [
  ['Le chat boit du ___.', 'lait', ['lion', 'lune']],
  ['Je mange une ___.', 'pomme', ['chaise', 'lune']],
  ['La ___ brille dans le ciel la nuit.', 'lune', ['pomme', 'poule']],
  ['Ali lance le ___ dans le panier.', 'ballon', ['bateau', 'bonbon']],
  ['Le ___ vole dans le ciel.', 'avion', ['camion', 'mouton']],
  ['Hbibiti prépare le ___.', 'couscous', ['camion', 'crayon']],
  ['Le poisson nage dans l’___.', 'eau', ['air', 'arbre']],
  ['Asma s’assoit sur la ___.', 'chaise', ['fraise', 'fusée']],
  ['Le ___ pousse dans la forêt.', 'sapin', ['lapin', 'raisin']],
  ['La ___ fait « meuh ».', 'vache', ['vélo', 'valise']],
  ['On ouvre la porte avec une ___.', 'clé', ['fleur', 'lune']],
  ['Le ___ a une couronne.', 'roi', ['loup', 'lait']],
];

// Coin Poppy Playtime : questions sur les personnages du jeu préféré d'Ali (couleurs, costumes, particularités).
// Rien d'effrayant : seulement l'apparence et ce qui les rend reconnaissables. Pas de dessin officiel :
// chaque personnage est un jeton de couleur avec un emoji. Les couleurs se répondent en darija.
export const POPPY = [
  { id: 'huggy', n: 'Huggy Wuggy', e: '🤗', c: '#2f6fe0', color: 'bleu', part: 'la fourrure de Huggy Wuggy', clues: ['Il a une fourrure toute bleue.', 'C’est la mascotte de l’usine Playtime Co.'] },
  { id: 'kissy', n: 'Kissy Missy', e: '💗', c: '#ff6fae', clues: ['Elle ressemble à Huggy Wuggy, mais elle est toute rose.', 'C’est la copine de Huggy Wuggy.'] },
  { id: 'poppy', n: 'Poppy', e: '🎎', c: '#e5484d', color: 'rouge', part: 'les cheveux de Poppy', clues: ['C’est une poupée aux cheveux roux tout bouclés.', 'Elle porte une jolie robe bleue.', 'On la trouve enfermée dans une vitrine en verre.', 'Le jeu porte son nom.'] },
  { id: 'mommy', n: 'Mommy Long Legs', e: '🕷️', c: '#d6409f', clues: ['Elle est rose et ressemble à une araignée.', 'Ses bras et ses jambes s’étirent comme de l’élastique.'] },
  { id: 'pj', n: 'PJ Pug-a-Pillar', e: '🐛', c: '#8bc34a', clues: ['C’est une chenille avec une tête de chien carlin.'] },
  { id: 'bunzo', n: 'Bunzo Bunny', e: '🐰', c: '#ffc93c', clues: ['C’est un lapin qui joue des cymbales.'] },
  { id: 'boxy', n: 'Boxy Boo', e: '📦', c: '#c0392b', clues: ['Il sort d’une boîte à surprise.'] },
  { id: 'catnap', n: 'CatNap', e: '🐱', c: '#7c4dcc', symbol: '🌙', symbolName: 'une lune', clues: ['C’est un grand chat violet.', 'Il a une lune dessinée sur le ventre.', 'Son nom veut dire « petite sieste » en anglais.'] },
  { id: 'dogday', n: 'DogDay', e: '🐶', c: '#ff9f1c', symbol: '☀️', symbolName: 'un soleil', clues: ['C’est un chien orange.', 'Il a un soleil dessiné sur le ventre.', 'C’est le chef des Smiling Critters.'] },
  { id: 'bobby', n: 'Bobby BearHug', e: '🐻', c: '#ff5c7a', symbol: '❤️', symbolName: 'un cœur', clues: ['C’est une ourse qui adore faire des câlins.', 'Elle a un cœur dessiné sur le ventre.'] },
  { id: 'delight', n: 'Miss Delight', e: '🍎', c: '#5aa469', clues: ['C’est la maîtresse de l’école de l’usine.'] },
  { id: 'grabpack', n: 'Le GrabPack', e: '🎒', c: '#3b7dd8', clues: ['C’est le sac à dos du joueur, avec des mains qui s’allongent pour attraper les choses.'] },
];
// Les couleurs qu'on peut dire en darija (mots de la salle de Fifi).
const POPPY_COLORS = [
  ['La main gauche du GrabPack', 'bleu'], ['La main droite du GrabPack', 'rouge'], ['La main du GrabPack qui donne de l’électricité', 'vert'],
  ...POPPY.filter((x) => x.color).map((x) => [cap(x.part), x.color]),
];
const COLOR_HEX = { bleu: '#2f6fe0', rouge: '#e5484d', vert: '#2bb673', jaune: '#ffc93c', blanc: '#ffffff', noir: '#222222' };
const token = (x, withName = true) => `<span class="ptoken" style="--c:${x.c}"><span class="pt-e">${x.e}</span></span>${withName ? `<small class="pt-n">${esc(x.n)}</small>` : ''}`;

const LETTRES = 'ABCDEFILMOPRSTUV'.split('');
const SONS = { ch: 'ch', l: 'l', v: 'v', m: 'm', p: 'p', s: 's', f: 'f', b: 'b', k: 'k', g: 'g', t: 't', r: 'r', d: 'd', i: 'i', a: 'a', é: 'é', n: 'n' };
const OBJETS = ['🍎', '⚽', '🏀', '⭐', '🐟', '🌸', '🧸', '🍬', '🦆', '🚗'];
const OBJ_NOM = { '🍎': 'pommes', '⚽': 'ballons', '🏀': 'ballons', '⭐': 'étoiles', '🐟': 'poissons', '🌸': 'fleurs', '🧸': 'oursons', '🍬': 'bonbons', '🦆': 'canards', '🚗': 'voitures' };
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const COULEURS = ['🔴', '🔵', '🟢', '🟡', '🟣'];
export const FORMES = {
  cercle: { n: 'le cercle', cotes: 0 }, carre: { n: 'le carré', cotes: 4 }, triangle: { n: 'le triangle', cotes: 3 },
  rectangle: { n: 'le rectangle', cotes: 4 }, etoile: { n: 'l’étoile', cotes: 10 }, coeur: { n: 'le cœur', cotes: 0 },
  losange: { n: 'le losange', cotes: 4 }, pentagone: { n: 'le pentagone', cotes: 5 }, hexagone: { n: 'l’hexagone', cotes: 6 },
};

// ---------- Petits dessins ----------
const SHAPE_COLORS = ['#ff8a3d', '#2bb673', '#3b7dd8', '#e5484d', '#9b5de5', '#ffc93c'];
export function shapeSVG(kind, color = '#ff8a3d', size = 80) {
  const P = {
    cercle: '<circle cx="50" cy="50" r="40"/>',
    carre: '<rect x="12" y="12" width="76" height="76" rx="4"/>',
    triangle: '<polygon points="50,8 92,88 8,88"/>',
    rectangle: '<rect x="4" y="26" width="92" height="48" rx="4"/>',
    etoile: '<polygon points="50,5 61,38 96,38 68,58 79,92 50,72 21,92 32,58 4,38 39,38"/>',
    coeur: '<path d="M50 88 C10 60 4 34 22 20 C36 10 48 18 50 30 C52 18 64 10 78 20 C96 34 90 60 50 88Z"/>',
    losange: '<polygon points="50,4 90,50 50,96 10,50"/>',
    pentagone: '<polygon points="50,6 94,38 77,90 23,90 6,38"/>',
    hexagone: '<polygon points="27,8 73,8 96,50 73,92 27,92 4,50"/>',
  };
  return `<svg class="shape" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><g fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="3">${P[kind]}</g></svg>`;
}
export function clockSVG(h, m) {
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const x = 50 + Math.sin(a) * 38, y = 50 - Math.cos(a) * 38;
    return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="800" fill="#2b2140">${i === 0 ? 12 : i}</text>`;
  }).join('');
  const ah = ((h % 12) + m / 60) / 12 * 360, am = m / 60 * 360;
  return `<svg class="clock" viewBox="0 0 100 100" aria-hidden="true">
    <circle cx="50" cy="50" r="47" fill="#fff8ec" stroke="#ff8a3d" stroke-width="5"/>${ticks}
    <line x1="50" y1="50" x2="50" y2="28" stroke="#2b2140" stroke-width="5" stroke-linecap="round" transform="rotate(${ah} 50 50)"/>
    <line x1="50" y1="50" x2="50" y2="15" stroke="#e5484d" stroke-width="3" stroke-linecap="round" transform="rotate(${am} 50 50)"/>
    <circle cx="50" cy="50" r="4" fill="#2b2140"/></svg>`;
}
const group = (e, n, row = 5) => {
  const rows = [];
  for (let i = 0; i < n; i += row) rows.push(`<span class="grp-row">${e.repeat(Math.min(row, n - i))}</span>`);
  return `<span class="grp">${rows.join('')}</span>`;
};
const dots = (n) => `<span class="dots-mini">${'●'.repeat(n)}</span>`;
const num = (n, withDots) => `<span class="c-num">${n}</span>${withDots && n <= 10 ? dots(n) : ''}`;

// Trois nombres différents autour de la bonne réponse, jamais négatifs.
function nearNumbers(ans, r, spread = 3, min = 0, max = 100) {
  const set = new Set([ans]);
  let guard = 0;
  while (set.size < 3 && guard++ < 50) {
    const d = ri(r, 1, spread) * (r() < 0.5 ? -1 : 1);
    const v = ans + d;
    if (v >= min && v <= max) set.add(v);
  }
  for (let v = min; set.size < 3; v++) set.add(v);
  return [...set];
}
// Les 3 premières valeurs différentes et positives (la bonne réponse en premier).
const uniq = (vals) => vals.filter((v, i, a) => v >= 0 && a.indexOf(v) === i).slice(0, 3);
const numChoices = (ans, values, withDots, sayFn = (v) => String(v)) => values.map((v) => ({ key: String(v), html: num(v, withDots), say: sayFn(v), correct: v === ans }));

// ---------- Compétences ----------
// young : profil qui ne lit pas encore (tout est dit à voix haute).  min : niveaux joués dans la salle avant d'apparaître.
export const SKILLS = {
  // Mathématiques
  'm-count': { room: 'maths', young: true, older: false, title: 'Compter' },
  'm-number': { room: 'maths', young: true, older: false, title: 'Reconnaître les nombres' },
  'm-more': { room: 'maths', young: true, older: false, title: 'Le plus grand groupe' },
  'm-addpic': { room: 'maths', young: true, older: false, title: 'Additions en images' },
  'm-count20': { room: 'maths', older: true, title: 'Compter jusqu’à 20' },
  'm-add10': { room: 'maths', older: true, title: 'Additions jusqu’à 10' },
  'm-sub10': { room: 'maths', older: true, title: 'Soustractions jusqu’à 10' },
  'm-compare': { room: 'maths', older: true, title: 'Plus grand, plus petit' },
  'm-next': { room: 'maths', older: true, title: 'Avant, après' },
  'm-add20': { room: 'maths', older: true, min: 1, title: 'Additions jusqu’à 20' },
  'm-sub20': { room: 'maths', older: true, min: 2, title: 'Soustractions jusqu’à 20' },
  'm-double': { room: 'maths', older: true, min: 1, title: 'Les doubles' },
  'm-seq': { room: 'maths', older: true, min: 2, title: 'Suites de nombres' },
  'm-tens': { room: 'maths', older: true, min: 3, title: 'Dizaines et unités' },
  'm-problem': { room: 'maths', older: true, min: 2, title: 'Petits problèmes' },
  'm-darija': { room: 'maths', older: true, min: 1, title: 'Calcul en darija' },
  // Lecture
  'l-letter': { room: 'lecture', young: true, older: false, title: 'Les lettres' },
  'l-sound': { room: 'lecture', young: true, older: false, title: 'Le premier son' },
  'l-syll': { room: 'lecture', young: true, older: true, title: 'Les syllabes' },
  'l-first': { room: 'lecture', older: true, title: 'La première lettre' },
  'l-read': { room: 'lecture', older: true, title: 'Lire un mot' },
  'l-write': { room: 'lecture', older: true, title: 'Le bon mot' },
  'l-missing': { room: 'lecture', older: true, min: 1, title: 'La lettre qui manque' },
  'l-rhyme': { room: 'lecture', older: true, min: 1, title: 'Les rimes' },
  'l-sentence': { room: 'lecture', older: true, min: 2, title: 'Compléter la phrase' },
  // Formes et heure
  'f-shape': { room: 'formes', young: true, older: true, title: 'Les formes' },
  'f-pattern': { room: 'formes', young: true, older: true, title: 'Les suites de couleurs' },
  'f-big': { room: 'formes', young: true, older: false, title: 'Grand et petit' },
  'f-sides': { room: 'formes', older: true, title: 'Les côtés' },
  'f-clock': { room: 'formes', older: true, title: 'Lire l’heure' },
  'f-days': { room: 'formes', older: true, min: 1, title: 'Les jours de la semaine' },
  // Coin Poppy Playtime
  'p-who': { room: 'poppy', young: true, older: true, title: 'Qui est-ce ?' },
  'p-color': { room: 'poppy', young: true, older: true, title: 'Les couleurs en darija' },
  'p-true': { room: 'poppy', older: true, title: 'Vrai pour qui ?' },
  'p-symbol': { room: 'poppy', young: true, older: true, min: 1, title: 'Les Smiling Critters' },
  'p-math': { room: 'poppy', older: true, min: 1, title: 'Les calculs de l’usine' },
};
const defaultsOlder = (s) => (s.older === undefined ? true : s.older);

export function skillsFor(room, older, roomLevels = Infinity) {
  return Object.entries(SKILLS)
    .filter(([, s]) => s.room === room && (older ? defaultsOlder(s) : s.young) && (s.min || 0) <= roomLevels)
    .map(([id]) => id);
}
// Objets « révisables » d'une salle (mots ou compétences) : pour la maîtrise et le brouillard.
export function itemsFor(room, older) {
  const skills = skillsFor(room, older);
  return skills.length ? skills.map((id) => ({ id: 'x:' + id, fr: SKILLS[id].title })) : wordsFor(room, older);
}
export const isExerciseRoom = (room) => Object.values(SKILLS).some((s) => s.room === room);

const Q = (skill, text, sayParts, choices, answer, visual = '') => ({
  type: 'gen', skill, word: { id: 'x:' + skill, fr: SKILLS[skill].title }, text, visual, say: sayParts,
  choices: shuffle(choices), answer,
});

// Fabrique une question pour une compétence. dialect sert au calcul en darija.
export function makeExercise(skill, { r = Math.random, dialect = 'ma' } = {}) {
  switch (skill) {
    case 'm-count': {
      const e = pick(OBJETS, r), n = ri(r, 1, 6);
      return Q(skill, `Combien de ${OBJ_NOM[e]} ?`, [`Compte bien. Combien de ${OBJ_NOM[e]} ?`],
        numChoices(n, nearNumbers(n, r, 2, 1, 10), true), { text: String(n), say: [`Il y en a ${n} !`] }, group(e, n));
    }
    case 'm-number': {
      const n = ri(r, 1, 10);
      return Q(skill, '🔊 Touche le bon nombre', [`Touche le nombre ${n}.`],
        numChoices(n, nearNumbers(n, r, 4, 0, 10), false), { text: String(n), say: [`C'est le ${n} !`] });
    }
    case 'm-more': {
      const e = pick(OBJETS, r);
      const counts = shuffle([1, 2, 3, 4, 5, 6, 7], r).slice(0, 3);
      const max = Math.max(...counts);
      return Q(skill, `Où y a-t-il le plus de ${OBJ_NOM[e]} ?`, [`Où y a-t-il le plus de ${OBJ_NOM[e]} ?`],
        counts.map((c) => ({ key: String(c), html: `<span class="mini-grp">${e.repeat(c)}</span>`, correct: c === max })),
        { text: `${max} ${OBJ_NOM[e]}`, say: [`C'est celui-là : il y en a ${max} !`] });
    }
    case 'm-addpic': {
      const e = pick(OBJETS, r), a = ri(r, 1, 3), b = ri(r, 1, 3), s = a + b;
      return Q(skill, `Combien de ${OBJ_NOM[e]} en tout ?`, [`${a} ${OBJ_NOM[e]}, et encore ${b}. Combien en tout ?`],
        numChoices(s, nearNumbers(s, r, 2, 1, 10), true), { text: `${a} + ${b} = ${s}`, say: [`${a} plus ${b}, ça fait ${s} !`] },
        `${group(e, a)}<b class="op">+</b>${group(e, b)}`);
    }
    case 'm-count20': {
      const e = pick(OBJETS, r), n = ri(r, 8, 20);
      return Q(skill, `Combien de ${OBJ_NOM[e]} ? (compte par 5)`, [`Compte les ${OBJ_NOM[e]}. Astuce : chaque ligne en a 5.`],
        numChoices(n, nearNumbers(n, r, 3, 1, 25), false), { text: String(n), say: [`Il y en a ${n} !`] }, group(e, n, 5));
    }
    case 'm-add10': case 'm-add20': {
      const max = skill === 'm-add10' ? 10 : 20;
      const a = ri(r, skill === 'm-add20' ? 4 : 1, max - 1), b = ri(r, 1, max - a), s = a + b;
      return Q(skill, `<span class="calc">${a} + ${b} = ?</span>`, [`Combien font ${a} plus ${b} ?`],
        numChoices(s, nearNumbers(s, r, 3, 0, max + 3), false), { text: `${a} + ${b} = ${s}`, say: [`${a} plus ${b}, égale ${s} !`] });
    }
    case 'm-sub10': case 'm-sub20': {
      const max = skill === 'm-sub10' ? 10 : 20;
      const a = ri(r, skill === 'm-sub20' ? 11 : 2, max), b = ri(r, 1, a - 1), d = a - b;
      return Q(skill, `<span class="calc">${a} − ${b} = ?</span>`, [`Combien font ${a} moins ${b} ?`],
        numChoices(d, nearNumbers(d, r, 3, 0, max), false), { text: `${a} − ${b} = ${d}`, say: [`${a} moins ${b}, égale ${d} !`] });
    }
    case 'm-compare': {
      // Deux nombres proches (jusqu'à 9 d'écart) : plus intéressant à comparer.
      const a = ri(r, 0, 50), b = r() < 0.2 ? a : Math.min(50, Math.max(0, a + ri(r, 1, 9) * (r() < 0.5 ? -1 : 1)));
      const sign = a < b ? '<' : a > b ? '>' : '=';
      const name = { '<': 'plus petit que', '>': 'plus grand que', '=': 'égal à' };
      return Q(skill, `<span class="calc">${a} <span class="blank">?</span> ${b}</span>`, [`Quel signe va entre ${a} et ${b} ?`],
        ['<', '>', '='].map((s) => ({ key: s, html: `<span class="c-num">${s}</span><small>${name[s]}</small>`, correct: s === sign })),
        { text: `${a} ${sign} ${b}`, say: [`${a} est ${name[sign]} ${b} !`] });
    }
    case 'm-next': {
      const n = ri(r, 5, 98), after = r() < 0.5, ans = after ? n + 1 : n - 1;
      const w = after ? 'juste après' : 'juste avant';
      return Q(skill, `Quel nombre vient <b>${w}</b> ${n} ?`, [`Quel nombre vient ${w} ${n} ?`],
        numChoices(ans, uniq([ans, after ? n - 1 : n + 1, ans + 10, ans - 10, ans + 2]), false),
        { text: String(ans), say: [`C'est ${ans} !`] });
    }
    case 'm-double': {
      const n = ri(r, 1, 10), d = n * 2;
      return Q(skill, `Le double de <b>${n}</b> ?`, [`Quel est le double de ${n} ?`],
        numChoices(d, nearNumbers(d, r, 2, 0, 22), false), { text: `${n} + ${n} = ${d}`, say: [`${n} plus ${n}, ça fait ${d} !`] });
    }
    case 'm-seq': {
      const step = pick([1, 2, 5, 10], r), start = step === 10 ? ri(r, 0, 5) * 10 : ri(r, 0, 20);
      const seq = [0, 1, 2, 3].map((k) => start + k * step), ans = start + 4 * step;
      return Q(skill, `<span class="calc">${seq.join(', ')}, ?</span>`, [`Quel nombre vient ensuite : ${seq.join(', ')} ?`],
        numChoices(ans, uniq([ans, ans + step, ans - 1 === seq[3] ? ans + 1 : ans - 1, ans + 2 * step]), false),
        { text: `On ajoute ${step} : ${ans}`, say: [`On ajoute ${step} à chaque fois : ${ans} !`] });
    }
    case 'm-tens': {
      const t = ri(r, 1, 9), u = ri(r, 0, 9), n = t * 10 + u;
      const vals = uniq([n, u * 10 + t, t + u, n + 10, n + 1]);
      return Q(skill, `<b>${t}</b> dizaine${t > 1 ? 's' : ''} et <b>${u}</b> unité${u > 1 ? 's' : ''} = ?`, [`${t} dizaines et ${u} unités, ça fait combien ?`],
        numChoices(n, vals, false), { text: String(n), say: [`Ça fait ${n} !`] }, `<span class="grp">${'🔟'.repeat(t)}</span>${u ? `<b class="op">+</b><span class="grp">${'🟡'.repeat(u)}</span>` : ''}`);
    }
    case 'm-problem': {
      const kind = ri(r, 0, 3);
      let text, ans, how;
      if (kind === 0) { const a = ri(r, 3, 12), b = ri(r, 2, 8); ans = a + b; how = `${a} + ${b}`; text = `Ali a ${a} ballons. Asma lui en donne ${b}. Combien de ballons a Ali maintenant ?`; }
      else if (kind === 1) { const a = ri(r, 6, 15), b = ri(r, 1, a - 1); ans = a - b; how = `${a} − ${b}`; text = `Hbibiti a fait ${a} msemens. Les enfants en mangent ${b}. Combien en reste-t-il ?`; }
      else if (kind === 2) { const a = ri(r, 3, 10), b = ri(r, 2, 6); ans = a + b; how = `${a} + ${b}`; text = `Il y a ${a} joueurs sur le terrain et ${b} sur le banc. Combien de joueurs en tout ?`; }
      else { const b = ri(r, 2, 8), a = b + ri(r, 1, 6); ans = a - b; how = `${a} − ${b}`; text = `Fifi marque ${a} paniers et Assad en marque ${b}. Combien de paniers de plus pour Fifi ?`; }
      return Q(skill, esc(text), [text], numChoices(ans, nearNumbers(ans, r, 3, 0, 30), false), { text: `${how} = ${ans}`, say: [`${how.replace('−', 'moins').replace('+', 'plus')}, égale ${ans} !`] });
    }
    case 'm-darija': {
      const a = ri(r, 1, 5), b = ri(r, 1, 10 - a), s = a + b;
      const w = (n) => WORDS.find((x) => x.id === 'n' + n);
      const vals = nearNumbers(s, r, 2, 2, 10);
      return Q(skill, `<span class="calc">${esc(w(a)[dialect].lat)} + ${esc(w(b)[dialect].lat)} = ?</span>`,
        [{ word: w(a), d: dialect }, 'plus', { word: w(b), d: dialect }, 'égale combien ?'],
        vals.map((v) => ({ key: String(v), html: `<span class="c-text">${esc(w(v)[dialect].lat)}</span>`, say: { word: w(v), d: dialect }, correct: v === s })),
        { text: `${a} + ${b} = ${s} : ${w(s)[dialect].lat}`, say: [{ word: w(s), d: dialect }] });
    }
    // ----- Lecture -----
    case 'l-letter': {
      const L = pick(LETTRES, r);
      const others = shuffle(LETTRES.filter((x) => x !== L), r).slice(0, 2);
      return Q(skill, '🔊 Touche la bonne lettre', [`Touche la lettre ${L}.`],
        [L, ...others].map((x) => ({ key: x, html: `<span class="c-letter">${x}</span>`, correct: x === L })), { text: L, say: [`C'est la lettre ${L} !`] });
    }
    case 'l-sound': {
      const pool = MOTS_OK.filter((m) => SONS[m.snd]);
      const ref = pick(pool.filter((m) => pool.some((x) => x !== m && x.snd === m.snd)), r);
      const same = shuffle(pool.filter((m) => m.snd === ref.snd && m !== ref), r)[0];
      const diff = shuffle(pool.filter((m) => m.snd !== ref.snd), r);
      const others = [diff[0], diff.find((m) => m.snd !== diff[0].snd)];
      return Q(skill, `Qui commence comme <b>${ref.e}</b> ?`, [`Trouve le mot qui commence comme ${ref.mot}.`],
        [same, ...others].map((m) => ({ key: m.mot, html: `<span class="c-emoji">${m.e}</span>`, say: m.mot, correct: m === same })),
        { text: `${ref.mot} et ${same.mot}`, say: [`${ref.mot}… ${same.mot} ! Ils commencent pareil.`] }, `<span class="big-pic">${ref.e}</span>`);
    }
    case 'l-syll': {
      const m = pick(MOTS_OK.filter((x) => x.syl), r);
      return Q(skill, `Combien de syllabes dans <b>${m.mot}</b> ? 👏`, [`Tape dans tes mains : ${m.mot}. Combien de syllabes ?`],
        [1, 2, 3].map((n) => ({ key: String(n), html: `<span class="c-num">${n}</span><span class="claps">${'👏'.repeat(n)}</span>`, correct: n === m.syl })),
        { text: `${m.mot} : ${m.syl} syllabe${m.syl > 1 ? 's' : ''}`, say: [`${m.mot}, ${m.syl} syllabe${m.syl > 1 ? 's' : ''} !`] }, `<span class="big-pic">${m.e}</span>`);
    }
    case 'l-first': {
      const m = pick(MOTS_OK, r);
      const L = m.mot[0].normalize('NFD')[0].toUpperCase();
      const others = shuffle('ABCDEFGHIJKLMNOPRSTUV'.split('').filter((x) => x !== L), r).slice(0, 2);
      return Q(skill, 'Par quelle lettre commence ce mot ?', [`Par quelle lettre commence le mot ${m.mot} ?`],
        [L, ...others].map((x) => ({ key: x, html: `<span class="c-letter">${x}</span>`, correct: x === L })),
        { text: `${m.mot.toUpperCase()} commence par ${L}`, say: [`${m.mot} commence par la lettre ${L} !`] }, `<span class="big-pic">${m.e}</span>`);
    }
    case 'l-read': {
      const ms = shuffle(MOTS_OK, r).slice(0, 3);
      return Q(skill, `Lis le mot : <b class="read-word">${ms[0].mot}</b>`, ['Lis le mot, et trouve la bonne image.'],
        ms.map((m, i) => ({ key: m.mot, html: `<span class="c-emoji">${m.e}</span>`, correct: i === 0 })), { text: ms[0].mot, say: [`${ms[0].mot} !`] });
    }
    case 'l-write': {
      const m = pick(MOTS_OK, r);
      const near = shuffle(MOTS_OK.filter((x) => x !== m && (x.mot[0] === m.mot[0] || x.rime === m.rime)), r);
      const far = shuffle(MOTS_OK.filter((x) => x !== m && !near.includes(x)), r);
      const ds = [...near, ...far].slice(0, 2);
      return Q(skill, 'Quel est le bon mot ?', ['Quel mot va avec l’image ?'],
        [m, ...ds].map((x) => ({ key: x.mot, html: `<span class="c-text">${x.mot}</span>`, correct: x === m })), { text: m.mot, say: [`${m.mot} !`] }, `<span class="big-pic">${m.e}</span>`);
    }
    case 'l-missing': {
      const m = pick(MOTS_OK.filter((x) => /[aeiou]/.test(x.mot)), r);
      const idx = [...m.mot].map((c, i) => ('aeiou'.includes(c) ? i : -1)).filter((i) => i >= 0);
      const i = pick(idx, r), L = m.mot[i];
      const others = shuffle('aeiou'.split('').filter((x) => x !== L), r).slice(0, 2);
      const shown = m.mot.slice(0, i) + '_' + m.mot.slice(i + 1);
      return Q(skill, `Quelle lettre manque ? <b class="read-word">${shown}</b>`, [`Quelle lettre manque dans le mot ${m.mot} ?`],
        [L, ...others].map((x) => ({ key: x, html: `<span class="c-letter">${x}</span>`, correct: x === L })), { text: m.mot, say: [`${m.mot}, avec la lettre ${L} !`] }, `<span class="big-pic">${m.e}</span>`);
    }
    case 'l-rhyme': {
      const groups = {};
      for (const m of MOTS_OK) (groups[m.rime] = groups[m.rime] || []).push(m);
      const keys = Object.keys(groups).filter((k) => groups[k].length >= 2);
      const k = pick(keys, r);
      const [ref, good] = shuffle(groups[k], r);
      const bad = shuffle(MOTS_OK.filter((m) => m.rime !== k), r);
      const ds = [bad[0], bad.find((m) => m.rime !== bad[0].rime)];
      return Q(skill, `Quel mot rime avec <b>${ref.mot}</b> ${ref.e} ?`, [`Quel mot rime avec ${ref.mot} ?`],
        [good, ...ds].map((m) => ({ key: m.mot, html: `<span class="c-emoji">${m.e}</span><small>${m.mot}</small>`, say: m.mot, correct: m === good })),
        { text: `${ref.mot} – ${good.mot}`, say: [`${ref.mot}, ${good.mot} : ça rime !`] });
    }
    case 'l-sentence': {
      const [s, good, bad] = pick(PHRASES, r);
      return Q(skill, esc(s).replace('___', '<span class="blank">___</span>'), [s.replace('___', 'quoi')],
        [good, ...bad].map((w) => ({ key: w, html: `<span class="c-text">${esc(w)}</span>`, correct: w === good })),
        { text: s.replace('___', good), say: [s.replace('___', good)] });
    }
    // ----- Formes et heure -----
    case 'f-shape': {
      const kinds = shuffle(['cercle', 'carre', 'triangle', 'rectangle', 'etoile', 'coeur'], r).slice(0, 3);
      const target = kinds[0];
      return Q(skill, `🔊 Touche ${FORMES[target].n}`, [`Touche ${FORMES[target].n}.`],
        kinds.map((k, i) => ({ key: k, html: shapeSVG(k, SHAPE_COLORS[ri(r, 0, 5)]), correct: i === 0 })),
        { text: FORMES[target].n, say: [`Voici ${FORMES[target].n} !`] });
    }
    case 'f-sides': {
      const k = pick(['triangle', 'carre', 'rectangle', 'pentagone', 'hexagone', 'losange'], r), n = FORMES[k].cotes;
      return Q(skill, `Combien de côtés a ${FORMES[k].n} ?`, [`Combien de côtés a ${FORMES[k].n} ?`],
        numChoices(n, nearNumbers(n, r, 2, 3, 8), false), { text: `${n} côtés`, say: [`${FORMES[k].n} a ${n} côtés !`] }, shapeSVG(k, '#3b7dd8', 110));
    }
    case 'f-pattern': {
      const [a, b, c] = shuffle(COULEURS, r);
      const motifs = [[a, b], [a, a, b], [a, b, b], [a, b, c]];
      const motif = pick(motifs, r);
      const seq = Array.from({ length: 6 }, (_, i) => motif[i % motif.length]);
      const ans = motif[6 % motif.length];
      const opts = [...new Set([ans, ...shuffle(COULEURS.filter((x) => x !== ans), r)])].slice(0, 3);
      return Q(skill, 'Quelle couleur vient ensuite ?', ['Regarde bien la suite. Quelle couleur vient ensuite ?'],
        opts.map((x) => ({ key: x, html: `<span class="c-emoji">${x}</span>`, correct: x === ans })), { text: 'La suite continue !', say: ['Bravo, la suite continue !'] },
        `<span class="pattern">${seq.join('')}<span class="blank">❓</span></span>`);
    }
    case 'f-big': {
      const e = pick(OBJETS, r), small = r() < 0.5;
      const sizes = shuffle([28, 48, 72], r);
      const target = small ? 28 : 72;
      return Q(skill, `🔊 Touche le plus ${small ? 'petit' : 'grand'}`, [`Touche le plus ${small ? 'petit' : 'grand'}.`],
        sizes.map((s) => ({ key: String(s), html: `<span style="font-size:${s}px;line-height:1">${e}</span>`, correct: s === target })),
        { text: small ? 'le plus petit' : 'le plus grand', say: [`Oui, c'est le plus ${small ? 'petit' : 'grand'} !`] });
    }
    case 'f-clock': {
      const h = ri(r, 1, 12), half = r() < 0.4, m = half ? 30 : 0;
      const label = (hh, mm) => `${hh} h${mm ? ' 30' : ''}`;
      const sayH = (hh, mm) => `${hh} heure${hh > 1 ? 's' : ''}${mm ? ' et demie' : ''}`;
      const opts = [[h, m], [h % 12 + 1, m], [h, half ? 0 : 30]];
      return Q(skill, 'Quelle heure est-il ?', ['Quelle heure est-il ?'],
        opts.map(([hh, mm], i) => ({ key: label(hh, mm), html: `<span class="c-text">${label(hh, mm)}</span>`, say: sayH(hh, mm), correct: i === 0 })),
        { text: label(h, m), say: [`Il est ${sayH(h, m)} !`] }, clockSVG(h, m));
    }
    case 'f-days': {
      const i = ri(r, 0, 6), after = r() < 0.6;
      const ans = JOURS[(i + (after ? 1 : 6)) % 7];
      const opts = [ans, ...shuffle(JOURS.filter((d) => d !== ans && d !== JOURS[i]), r).slice(0, 2)];
      return Q(skill, `Quel jour vient <b>${after ? 'après' : 'avant'}</b> ${JOURS[i]} ?`, [`Quel jour vient ${after ? 'après' : 'avant'} ${JOURS[i]} ?`],
        opts.map((d) => ({ key: d, html: `<span class="c-text">${d}</span>`, correct: d === ans })), { text: ans, say: [`C'est ${ans} !`] });
    }
    // ----- Coin Poppy Playtime -----
    case 'p-who': {
      const x = pick(POPPY, r), clue = pick(x.clues, r);
      const others = shuffle(POPPY.filter((y) => y !== x), r).slice(0, 2);
      return Q(skill, `Qui est-ce ? <b>${esc(clue)}</b>`, ['Qui est-ce ?', clue],
        [x, ...others].map((y) => ({ key: y.id, html: token(y), say: y.n, correct: y === x })),
        { text: x.n, say: [`C'est ${x.n} !`] });
    }
    case 'p-true': {
      const x = pick(POPPY, r), good = pick(x.clues, r);
      const bad = shuffle(POPPY.filter((y) => y !== x), r).slice(0, 2).map((y) => pick(y.clues, r));
      return Q(skill, `Qu’est-ce qui est vrai pour <b>${esc(x.n)}</b> ?`, [`Qu'est-ce qui est vrai pour ${x.n} ?`],
        [good, ...bad].map((t, i) => ({ key: t, html: `<span class="c-text small">${esc(t)}</span>`, correct: i === 0 })),
        { text: good, say: [good] }, token(x, false));
    }
    case 'p-color': {
      const [what, col] = pick(POPPY_COLORS, r);
      const w = (id) => WORDS.find((x) => x.id === id);
      const opts = [col, ...shuffle(Object.keys(COLOR_HEX).filter((k) => k !== col), r).slice(0, 2)];
      return Q(skill, `${esc(what)} est de quelle couleur ? <small>Réponds en darija ${dialect === 'ma' ? '🇲🇦' : '🇩🇿'} !</small>`,
        [`${what} est de quelle couleur ? Réponds en darija !`],
        opts.map((k) => ({ key: k, html: `<span class="swatch" style="--c:${COLOR_HEX[k]}"></span><span class="c-text">${esc(w(k)[dialect].lat)}</span>`, say: { word: w(k), d: dialect }, correct: k === col })),
        { text: `${w(col).fr} : ${w(col)[dialect].lat}`, say: [{ word: w(col), d: dialect }] });
    }
    case 'p-symbol': {
      const crit = POPPY.filter((x) => x.symbol);
      const x = pick(crit, r);
      return Q(skill, `Quel dessin a <b>${esc(x.n)}</b> sur le ventre ?`, [`Quel dessin ${x.n} a sur le ventre ?`],
        crit.map((y) => ({ key: y.symbol, html: `<span class="c-emoji">${y.symbol}</span>`, correct: y === x })),
        { text: `${x.n} : ${x.symbolName}`, say: [`${x.n} a ${x.symbolName} sur le ventre !`] }, token(x, false));
    }
    case 'p-math': {
      const kind = ri(r, 0, 3);
      let text, ans, how;
      if (kind === 0) { const a = ri(r, 2, 9), b = ri(r, 2, 9); ans = a + b; how = `${a} + ${b}`; text = `Le GrabPack attrape ${a} jouets, puis encore ${b}. Combien de jouets en tout ?`; }
      else if (kind === 1) { const b = ri(r, 1, 7); ans = 8 - b; how = `8 − ${b}`; text = `Les Smiling Critters sont 8 amis. ${b} font la sieste avec CatNap. Combien sont réveillés ?`; }
      else if (kind === 2) { const a = ri(r, 2, 5); ans = a * 2; how = `${a} + ${a}`; text = `Huggy Wuggy et Kissy Missy ont chacun ${a} ballons. Combien de ballons en tout ?`; }
      else { const a = ri(r, 10, 18), b = ri(r, 2, 9); ans = a - b; how = `${a} − ${b}`; text = `Bunzo Bunny frappe ses cymbales ${a} fois. Il en a déjà fait ${b}. Combien en reste-t-il ?`; }
      return Q(skill, esc(text), [text], numChoices(ans, nearNumbers(ans, r, 3, 0, 30), false),
        { text: `${how} = ${ans}`, say: [`${how.replace('−', 'moins').replace('+', 'plus')}, égale ${ans} !`] });
    }
    default:
      throw new Error('Compétence inconnue : ' + skill);
  }
}

// Tirage pondéré par la boîte de révision : les compétences fragiles reviennent plus souvent.
function weightedSkill(skills, progress, r) {
  const ws = skills.map((s) => MAX_BOX + 1 - (progress.words['x:' + s]?.box || 0));
  let t = r() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < skills.length; i++) { t -= ws[i]; if (t < 0) return skills[i]; }
  return skills[skills.length - 1];
}

export function buildExerciseLevel(room, progress, opts = {}) {
  const r = opts.r || Math.random;
  const dialects = opts.dialects?.length ? opts.dialects : ['ma', 'dz'];
  const skills = skillsFor(room, !!opts.older, progress.rooms?.[room] || 0);
  const count = opts.count || 5;
  const questions = [];
  // Une nouvelle compétence est toujours essayée dans la partie.
  const fresh = skills.filter((s) => !progress.words['x:' + s]);
  let last = null;
  for (let i = 0; i < count; i++) {
    let s = i === 0 && fresh.length ? fresh[0] : weightedSkill(skills, progress, r);
    if (s === last && skills.length > 1) s = weightedSkill(skills.filter((x) => x !== last), progress, r);
    last = s;
    questions.push(makeExercise(s, { r, dialect: dialects[i % dialects.length] }));
  }
  return { learn: [], questions };
}

// Une partie pour n'importe quelle salle (mots ou exercices).
export function buildAny(room, progress, opts, buildWords) {
  return isExerciseRoom(room) ? buildExerciseLevel(room, progress, opts) : buildWords(room, progress, opts);
}

// Défi éclair : 10 questions mêlées de toutes les salles ouvertes (mots déjà vus + exercices).
export function buildChallenge(progress, opts = {}) {
  const r = opts.r || Math.random;
  const older = !!opts.older;
  const dialects = opts.dialects?.length ? opts.dialects : ['ma', 'dz'];
  const rooms = opts.rooms || [];
  const games = opts.games || {};
  const questions = [];
  const seen = WORDS.filter((w) => progress.words[w.id]?.seen && rooms.includes(w.room) && (older || !w.older));
  let guard = 0;
  while (questions.length < (opts.count || 10) && guard++ < 100) {
    const exRooms = rooms.filter(isExerciseRoom);
    const useWord = seen.length >= 3 && (!exRooms.length || r() < 0.5);
    if (useWord) {
      const w = pick(seen, r);
      const q = makeQuestion(w, wordsFor(w.room, older), { older, dialect: pick(dialects, r), dialects, r });
      questions.push({ ...q, game: games[w.room] });
    } else if (exRooms.length) {
      const room = pick(exRooms, r);
      const skills = skillsFor(room, older, progress.rooms?.[room] || 0);
      questions.push({ ...makeExercise(pick(skills, r), { r, dialect: pick(dialects, r) }), game: games[room] });
    } else break;
  }
  return { learn: [], questions, challenge: true };
}

