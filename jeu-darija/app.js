// L'Usine magique de Hbibiti — écrans, déroulement des parties, espace parents.
import {
  WORDS, ROOMS, STICKERS, grade, markSeen, mastery, buildLevel, buildCoop,
  isCousin, today, sequenceChoices, missionOfWeek, roomUnlocked, newProgress, shuffle, hasEnglish, EN,
} from './core.js';
import { settings, saveSettings, load, save, progressOf, saveProgressOf, putRec, delRec, recKeys, exportBackup, importBackup } from './store.js';
import { say, stopVoice, sfx, startMusic, stopMusic, voiceFor, frVoices, recordedKeys, preload, audio } from './audio.js';
import { GAMES } from './games.js';
import { buildExerciseLevel, buildChallenge, itemsFor, isExerciseRoom, clockSVG } from './exercises.js';
import * as ART from './art.js';
import { TALES, TALE_CATS, speakTale, nextTale } from './tales.js';
import { dailyMissions, dailyState, autoComplete } from './missions.js';
import { createVille } from './ville.js';
import { recordDay, weekReport, reportText } from './carnet.js';
import { initCharacters, mount, react, setMood, charIn, INTRO } from './characters.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DIALECT_NAME = { ma: 'au Maroc', dz: 'en Algérie', en: 'en anglais' };
const FLAG = { ma: '🇲🇦', dz: '🇩🇿', en: '🇬🇧' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// « Le ballon de Fifi » → « le ballon de Fifi » au milieu d'une phrase.
const mid = (s) => (/^(Le|La|Les|L’)/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// ---------- Joueurs ----------
// Un enfant seul, ou deux en mode frère-sœur. Chacun garde ses propres progrès.
let players = [];
let turn = 0; // joueur de la question en cours
const P = () => players[turn];
const saveAll = () => players.forEach((p) => { recordDay(p.progress); saveProgressOf(p.kid, p.progress); });
const coop = () => players.length > 1;
const names = () => players.map((p) => p.kid.name).join(' et ');
const levelsDone = () => Math.max(...players.map((p) => p.progress.levels || 0));

// ---------- Écrans ----------
let current = 'home';
function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 's-' + id));
  current = id;
  document.body.dataset.screen = id;
  if (id !== 'play' && id !== 'learn') stopVoice();
  if (['map', 'start', 'learn', 'play', 'reward', 'album'].includes(id)) startMusic();
  else if (['tales', 'tale', 'daily', 'ville'].includes(id)) startMusic(true);
  else stopMusic();
  if (id !== 'tale') taleTok++; // quitter une histoire arrête la lecture
}
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { sfx('tap'); route(go.dataset.go); }
});
function route(id) {
  if (id === 'map') return openMap();
  if (id === 'home') return openHome();
  show(id);
}
function applyGmName() {
  $$('.gm-name').forEach((el) => { el.textContent = settings.gm; });
  document.title = `L'Usine magique de ${settings.gm}`;
}

// ---------- Accueil ----------
function openHome() {
  applyGmName();
  const gm = mount($('#home-gm'), ART.hbibiti(), { speaker: true });
  setTimeout(() => gm?.classList.add('act'), 500);
  setTimeout(() => gm?.classList.remove('act'), 2000);
  const kids = settings.kids.map((k, i) => `
    <button class="kid" data-kid="${i}">
      <span class="kid-av">${esc(k.avatar)}</span>
      <span class="kid-name">${esc(k.name)}</span>
      <span class="kid-sub">⭐ ${progressOf(k).stars}</span>
    </button>`);
  if (settings.kids.length > 1) {
    kids.push(`<button class="kid together" data-kid="all">
      <span class="kid-av">${settings.kids.map((k) => esc(k.avatar)).join('')}</span>
      <span class="kid-name">Ensemble</span>
      <span class="kid-sub">Chacun son tour</span>
    </button>`);
  }
  $('#kids').innerHTML = kids.join('');
  show('home');
}
$('#kids').addEventListener('click', (e) => {
  const b = e.target.closest('[data-kid]');
  if (!b) return;
  audio(); // le son doit être débloqué par un geste sur iPad
  sfx('tap');
  const list = b.dataset.kid === 'all' ? settings.kids : [settings.kids[+b.dataset.kid]];
  players = list.map((kid) => ({ kid, progress: progressOf(kid) }));
  turn = 0;
  if (players.some((p) => !p.progress.story)) return openStory();
  openMap(true);
});

// ---------- Histoire du début ----------
let storyI = 0;
const STORY = [
  () => ({ art: ART.hbibiti('happy', 'speaker'), text: `Salam ${names()} ! Je suis ${settings.gm}. Bienvenue dans mon usine magique, où les jouets parlent darija, comme au Maroc et en Algérie !` }),
  () => ({ art: `<div class="fog-art">🌫️<span>🧸</span><span>🤖</span><span>🦄</span></div>`, text: 'Mais le brouillard de l’oubli est arrivé… Mes jouets se sont endormis : ils ont oublié leurs mots !' }),
  () => ({ art: `<div class="trio">${ART.grappo()}${ART.assad()}${ART.fifi()}</div>`, text: 'Avec Grappo le gant magique, Assad le lion et Fifi la fennec, aide-moi à les réveiller. Chaque mot appris fait reculer le brouillard. Yallah !' }),
];
function openStory() { storyI = 0; show('story'); showStory(); }
function showStory() {
  const s = STORY[storyI]();
  $('#story-art').innerHTML = s.art;
  $$('#story-art .char').forEach((c) => c.classList.add('pokable'));
  $('#story-text').textContent = s.text;
  $('#story-next').textContent = storyI === STORY.length - 1 ? 'Yallah ! ➜' : 'Suivant ➜';
  say(s.text);
}
$('#story-next').addEventListener('click', () => {
  sfx('tap');
  storyI++;
  if (storyI < STORY.length) return showStory();
  players.forEach((p) => { p.progress.story = true; });
  saveAll();
  openMap(false);
});

// ---------- Temps de jeu ----------
function timeState(kid) {
  const t = load('t-' + kid.id, {});
  return t.date === today() ? t : { date: today(), ms: 0, bonus: 0 };
}
function timeUp() {
  if (!players.length || !settings.limit) return false;
  return players.some((p) => { const t = timeState(p.kid); return t.ms >= settings.limit * 60000 + (t.bonus || 0); });
}
setInterval(() => {
  if (!players.length || document.hidden || ['home', 'parents', 'timeup', 'story'].includes(current)) return;
  for (const p of players) { const t = timeState(p.kid); t.ms += 5000; save('t-' + p.kid.id, t); }
  if (current === 'map' && timeUp()) showTimeUp();
}, 5000);
function showTimeUp() {
  mount($('#timeup-gm'), ART.hbibiti(), { speaker: true });
  show('timeup');
  say(`Bslama ${names()} ! Tu as bien travaillé. On se retrouve demain, inchallah.`);
}

// ---------- L'usine ----------
const HOSTS = { grappo: ART.grappo, assad: ART.assad, fifi: ART.fifi, dada: ART.dada, lantern: () => ART.lantern(), tajine: ART.tajine, rocket: () => ART.rocket(), books: ART.books, claw: ART.clawMachine, clock: () => clockSVG(3, 0),
  ...Object.fromEntries(Object.entries({ corps: '🦷💪', animaux: '🐪🐑', maison: '🏠🔑', vetements: '👟🧢', ciel: '☀️🌧️', appel: '📞💬', alif: 'أ ب ت', marche: '🍇🥕', ecole: '📚✏️', sport: '⚽🏆', emotions: '😄😢', metiers: '🩺👮', fete: '🌙🎁' })
    .map(([k, e]) => ['e-' + k, () => `<span class="host-emoji">${e}</span>`])) };
// Le copain qui accompagne chaque salle (il parle, se réjouit et encourage).
const BUDDY = { alif: 'hbibiti', marche: 'hbibiti', ecole: 'grappo', sport: 'fifi', emotions: 'maman', metiers: 'papa', fete: 'hbibiti', corps: 'fifi', animaux: 'assad', maison: 'maman', vetements: 'papa', ciel: 'hbibiti', appel: 'maman', poppy: 'grappo', hall: 'hbibiti', stade: 'papa', jardin: 'hbibiti', maths: 'grappo', lecture: 'hbibiti', gym: 'assad', formes: 'fifi', cuisine: 'maman', musique: 'fifi', defi: 'assad' };
const buddyOf = (r) => BUDDY[r?.id] || 'hbibiti';
// Dessine un personnage (Maman avec ou sans foulard, selon le réglage des parents).
const drawChar = (name, mood = 'happy') => (name === 'maman' ? ART.maman(mood, '', settings.mamaScarf) : ART[name](mood));
// Défi éclair : questions mêlées de toutes les salles ouvertes, chacune dans la scène de sa salle.
const DEFI = { id: 'defi', name: 'Défi éclair', theme: '10 questions de tout le jeu', game: 'rocket', host: 'rocket' };
// Le coin Poppy Playtime peut être masqué par les parents.
const gameRooms = () => ROOMS.filter((r) => !r.fan || settings.poppy);
const openRooms = () => gameRooms().filter((r) => roomUnlocked(r, { levels: levelsDone() }, settings.unlockAll));
function openMap(greet) {
  if (!players.length) return openHome();
  if (timeUp()) return showTimeUp();
  applyGmName();
  $('#map-who').innerHTML = players.map((p) => `<span class="who">${esc(p.kid.avatar)} ${esc(p.kid.name)}</span>`).join('');
  $('#map-stars').textContent = players.reduce((a, p) => a + p.progress.stars, 0);
  mount($('#map-gm'), ART.hbibiti(), { speaker: true });
  const lead = players[0];
  const all = gameRooms().flatMap((r) => itemsFor(r.id, lead.kid.older));
  const m = Math.round(mastery(lead.progress, all) * 100);
  const bubble = levelsDone()
    ? `Salam ${names()} ! L'usine est réveillée à ${m} %. Choisis une salle !`
    : `Salam ${names()} ! Choisis une salle pour réveiller mes jouets !`;
  $('#map-bubble').textContent = bubble;
  const mission = missionOfWeek();
  const done = players.every((p) => p.progress.missions?.[mission.key]);
  $('#map-mission').innerHTML = `<span class="mi-icon">${done ? '✅' : '📞'}</span><span><b>Mission de la semaine</b>${esc(mission.text)}${done ? ' <em>Réussie, bravo !</em>' : ''}</span>`;
  const best = Math.max(...players.map((p) => p.progress.best || 0));
  $('#map-defi').hidden = !levelsDone();
  const md = players.reduce((a, p) => a + Object.keys(dailyState(p.progress, today()).done).length, 0);
  $('#map-daily').innerHTML = `<span class="daily-duo">${ART.papa()}${drawChar('maman')}</span><span><b>Les missions de Papa et Maman</b>${md}/${players.length * 3} réussies aujourd'hui</span><span class="defi-go">Voir</span>`;
  $('#map-ville').innerHTML = `<span class="mi-icon">🏙️</span><span><b>La ville de ${esc(settings.gm)}</b>Cours, saute et aide les habitants : ils ont des missions pour toi !</span><span class="defi-go">Jouer</span>`;
  const heard = Object.keys(lead.progress.tales || {}).length;
  $('#map-tales').innerHTML = `<span class="mi-icon">📚</span><span><b>Les histoires de ${esc(settings.gm)}</b>Des histoires vraies : l'islam, les savants, les sciences, le monde…${heard ? ` Écoutées : ${heard} / ${TALES.length}` : ''}</span><span class="defi-go">Écouter</span>`;
  $('#map-defi').innerHTML = `<span class="mi-icon">⚡</span><span><b>Défi éclair</b>10 questions de tout le jeu : maths, lecture, darija…${best ? ` Record : ${best}/10` : ''}</span><span class="defi-go">Go !</span>`;
  $('#rooms').innerHTML = gameRooms().map((r) => {
    const open = roomUnlocked(r, { levels: levelsDone() }, settings.unlockAll);
    const ws = itemsFor(r.id, lead.kid.older);
    const rm = mastery(lead.progress, ws);
    const host = `<span class="room-host">${HOSTS[r.host]?.() || ''}</span>`;
    if (!open) {
      const left = r.unlock - levelsDone();
      return `<div class="room locked room-${r.id}">${host}<b>${r.name}</b><small>${r.theme}</small><span class="lock">🔒 Encore ${left} niveau${left > 1 ? 'x' : ''}</span></div>`;
    }
    return `<button class="room room-${r.id}" data-room="${r.id}">
      ${host}<b>${r.name}</b><small>${r.theme}</small>
      <span class="room-fog" style="opacity:${(0.8 - rm * 0.8).toFixed(2)}"></span>
      <span class="meter"><i style="width:${Math.max(3, Math.round(rm * 100))}%"></i></span>
    </button>`;
  }).join('');
  $('#fog').style.opacity = (0.55 - (m / 100) * 0.55).toFixed(2);
  show('map');
  if (greet) say(bubble);
}
$('#map-defi').addEventListener('click', () => openStart(DEFI));
$('#map-tales').addEventListener('click', () => { sfx('tap'); openTales(); });
$('#map-daily').addEventListener('click', () => { sfx('tap'); openDaily(); });
$('#map-ville').addEventListener('click', () => { sfx('tap'); openVille(); });
$('#rooms').addEventListener('click', (e) => {
  const b = e.target.closest('[data-room]');
  if (!b) return;
  openStart(ROOMS.find((r) => r.id === b.dataset.room));
});
function openStart(r) {
  sfx('tap');
  room = r;
  $('#start-room').textContent = room.name;
  const b = buddyOf(room);
  const host = mount($('#start-host'), drawChar(b), { speaker: true });
  show('start');
  setTimeout(() => host?.classList.add('act'), 300);
  setTimeout(() => host?.classList.remove('act'), 1700);
  const lang = levelLang(room);
  $('#start-lang').hidden = !bilingualRoom(room);
  $('#start-lang').textContent = lang === 'en' ? '🇬🇧 Cette partie est en anglais' : '🇲🇦 🇩🇿 Cette partie est en arabe';
  say(INTRO[b], room.name, ...(bilingualRoom(room) ? [lang === 'en' ? 'Cette partie est en anglais !' : 'Cette partie est en arabe !'] : []));
}
let room = null;

// ---------- Mode bilingue : une partie en arabe, la suivante en anglais (ou un jour sur deux) ----------
const bilingualRoom = (r) => settings.bilingual !== 'off' && r && r !== DEFI && !r.school && hasEnglish(r.id);
function levelLang(r) {
  if (!bilingualRoom(r)) return 'ar';
  if (settings.bilingual === 'jour') return Math.floor(Date.now() / 86400000) % 2 ? 'en' : 'ar';
  return players[0]?.progress.nextLang === 'en' ? 'en' : 'ar';
}

// ---------- Une partie ----------
let level = null;
const ctx = { score: 0, streak: 0 };
$('#btn-bismillah').addEventListener('click', () => {
  sfx('chime');
  if (timeUp()) return showTimeUp();
  const games = Object.fromEntries(ROOMS.map((r) => [r.id, r.game]));
  const build = room === DEFI
    ? (id, progress, o) => buildChallenge(progress, { ...o, count: coop() ? 5 : 10, rooms: openRooms().map((r) => r.id), games })
    : isExerciseRoom(room.id) ? buildExerciseLevel : buildLevel;
  const lang = levelLang(room);
  const opts = { dialects: settings.dialects, seqIndex: levelsDone(), build, count: room === DEFI ? 10 : undefined, lang };
  level = coop()
    ? buildCoop(room.id, players.map((p) => ({ progress: p.progress, older: p.kid.older })), opts)
    : build(room.id, P().progress, { ...opts, older: P().kid.older });
  level.i = 0; level.learnI = 0; level.score = players.map(() => 0); level.lang = lang;
  level.stars = players.map(() => 0);
  ctx.score = 0; ctx.streak = 0;
  say('Bismillah !');
  preload(level.questions.flatMap((x) => (x.type === 'gen' ? [...x.say, ...x.answer.say] : [])));
  if (level.learn.length) showLearn(); else startPlay();
});

const anyReader = () => players.some((p) => p.kid.older);
const showAr = (p = P()) => settings.arabic && p?.kid.older;
function showLearn() {
  const w = level.learn[level.learnI];
  $('#learn-count').textContent = `${level.learnI + 1} / ${level.learn.length}`;
  $('#learn-emoji').textContent = w.emoji;
  $('#learn-fr').textContent = w.phrase ? `${w.fr}, on dit :` : w.fr;
  const en = level.lang === 'en';
  $('#learn-cousin').hidden = en || !(isCousin(w) && !w.phrase && settings.dialects.length > 1);
  for (const d of ['ma', 'dz']) {
    const b = $('#learn-' + d);
    b.hidden = en || !!w.phrase || !settings.dialects.includes(d);
    $('.lat', b).textContent = w[d].lat;
    $('.ar', b).textContent = settings.arabic && anyReader() ? w[d].ar : '';
    $('.dia-who', b).innerHTML = drawChar(d === 'ma' ? 'papa' : 'maman');
  }
  const both = $('#learn-both');
  both.hidden = !w.phrase && !en;
  $('.flag', both).textContent = en ? '🇬🇧 English' : '🤲';
  $('.lat', both).textContent = en ? w.en.lat : w.ma.lat;
  $('.ar', both).textContent = en ? '' : w.ma.ar;
  players.forEach((p) => markSeen(p.progress, w.id));
  saveAll();
  show('learn');
  if (!$('#learn-buddy .char')) mount($('#learn-buddy'), ART.hbibiti(), { speaker: true });
  $('#learn-card').classList.remove('enter'); void $('#learn-card').offsetWidth; $('#learn-card').classList.add('enter');
  const seq = [];
  if (w.phrase) seq.push(`${w.fr}, on dit :`, { word: w, d: 'ma' });
  else if (en) seq.push(w.fr, 300, 'En anglais, on dit :', { word: w, d: 'en' }, 400);
  else {
    seq.push(w.fr, 300);
    for (const d of settings.dialects) seq.push(`${cap(DIALECT_NAME[d])}, on dit :`, { word: w, d }, 400);
    if (isCousin(w) && settings.dialects.length > 1) seq.push("C'est un mot cousin !");
  }
  say(...seq);
}
for (const d of ['ma', 'dz', 'both']) {
  $('#learn-' + d).addEventListener('click', () => {
    const w = level.learn[level.learnI];
    const b = $('#learn-' + d);
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    say({ word: w, d: d === 'both' ? (level.lang === 'en' ? 'en' : 'ma') : d });
  });
}
$('#learn-next').addEventListener('click', () => {
  sfx('tap');
  level.learnI++;
  if (level.learnI < level.learn.length) showLearn(); else startPlay();
});

function startPlay() {
  mount($('#play-buddy'), drawChar(buddyOf(room)), { speaker: true });
  show('play');
  $('#play-dots').innerHTML = level.questions.map((qq) => `<i>${coop() ? esc(players[qq.player].kid.avatar) : ''}</i>`).join('');
  nextQuestion();
}
$('#play-quit').addEventListener('click', () => { saveAll(); openMap(); });
$('#play-replay').addEventListener('click', () => promptVoice());

let q = null;
let busy = false;
const ansDialect = () => (q.type === 'cousin' ? q.other : q.dialect);
const curGame = () => q.game || room.game;

function promptHTML() {
  const w = q.word;
  if (q.type === 'sequence') return `${esc(q.seq.title)}<br><small>${esc(q.seq.ask)}</small>`;
  if (q.type === 'gen') return `<div class="q-text">${q.text}</div>${q.visual ? `<div class="q-visual">${q.visual}</div>` : ''}`;
  if (q.type === 'listen') {
    if (w.phrase) return '🔊 Écoute bien : quand dit-on ça ?';
    if (curGame() === 'kitchen') return `🔊 ${esc(settings.gm)} te demande quelque chose : écoute bien !`;
    return '🔊 Écoute bien et trouve la bonne image !';
  }
  if (q.type === 'fr2dz') {
    if (w.phrase) return `<b>${esc(w.fr)}</b>, on dit… ?`;
    return `Comment on dit <b>« ${esc(w.fr)} »</b> ${DIALECT_NAME[q.dialect]} ${FLAG[q.dialect]} ?`;
  }
  return `${FLAG[q.dialect]} ${cap(DIALECT_NAME[q.dialect])}, on dit <b>« ${esc(w[q.dialect].lat)} »</b>.<br>Et ${DIALECT_NAME[q.other]} ${FLAG[q.other]} ?`;
}
function promptVoice() {
  const w = q.word;
  if (q.type === 'sequence') return say(q.seq.title, q.seq.ask);
  if (q.type === 'gen') return say(...q.say);
  if (q.type === 'listen') {
    if (w.phrase) return say('Écoute bien.', { word: w, d: q.dialect }, 'Quand dit-on ça ?');
    if (curGame() === 'kitchen') return say(`${settings.gm} demande :`, { word: w, d: q.dialect });
    return say('Écoute bien.', { word: w, d: q.dialect });
  }
  if (q.type === 'fr2dz') return say(w.phrase ? `${w.fr}, on dit quoi ?` : `Comment on dit ${w.fr}, ${DIALECT_NAME[q.dialect]} ?`);
  return say(`${cap(DIALECT_NAME[q.dialect])}, on dit :`, { word: w, d: q.dialect }, `Et ${DIALECT_NAME[q.other]} ?`);
}
function choiceLabel(c) {
  if (q.type === 'gen') return c.html;
  if (q.type === 'listen') return `<span class="c-emoji">${c.word.emoji}</span>`;
  const d = ansDialect();
  return `<span class="c-text">${esc(c.word[d].lat)}</span>${showAr() ? `<span class="c-ar">${esc(c.word[d].ar)}</span>` : ''}`;
}

async function nextQuestion() {
  if (level.i >= level.questions.length) return finishLevel();
  q = level.questions[level.i];
  q.misses = 0;
  busy = true;
  turn = q.player ?? 0;
  $$('#play-dots i').forEach((d, i) => d.classList.toggle('now', i === level.i));
  $('#play-prompt').innerHTML = promptHTML();
  $('#feedback').textContent = '';
  const scene = $('#scene');
  if (q.type === 'sequence') buildSequence(scene);
  else {
    scene.className = 'scene game-' + curGame() + (q.type === 'gen' ? ' gen' : '');
    scene.innerHTML = GAMES[curGame()].build(q, choiceLabel, ctx);
    $$('.choice', scene).forEach((b) => b.addEventListener('click', () => answer(+b.dataset.i, b)));
  }
  if (coop()) {
    const t = $('#play-turn');
    t.hidden = false;
    t.innerHTML = `C'est au tour de <b>${esc(P().kid.avatar)} ${esc(P().kid.name)}</b> !`;
    t.classList.remove('enter'); void t.offsetWidth; t.classList.add('enter');
    await say(`À toi, ${P().kid.name} !`);
  } else $('#play-turn').hidden = true;
  busy = false;
  promptVoice();
}

const PRAISE = ['Bravo !', 'Machallah !', 'Zwin bezzaf !', 'Super !', 'Saha !', 'Waouh !', 'Top !'];
const praise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
function markDot(firstTry) { $$('#play-dots i')[level.i]?.classList.add(firstTry ? 'ok' : 'meh'); }

async function answer(i, el) {
  if (busy || el.classList.contains('tried')) return;
  busy = true;
  stopVoice();
  const c = q.choices[i];
  const good = c.correct;
  await GAMES[curGame()].anim($('#scene'), i, good, ctx);
  // Tout le monde réagit : le copain, et les personnages de la scène (le gardien, lui, est content quand il arrête !).
  react(charIn($('#play-buddy')), good);
  $$('#scene .char').forEach((c) => (c.closest('.keeper') ? setMood(c, good ? 'wow' : 'cheer', 1200) : react(c, good)));
  const w = q.word;
  const d = ansDialect();
  if (good) {
    sfx('ok');
    confetti();
    const firstTry = q.misses === 0;
    grade(P().progress, w.id, firstTry);
    if (firstTry) { P().progress.stars++; level.stars[turn]++; level.score[turn]++; }
    saveAll();
    markDot(firstTry);
    const p = praise();
    if (q.type === 'gen') {
      $('#feedback').textContent = `${p} ${q.answer.text}`;
      await say(p, ...q.answer.say);
    } else {
      $('#feedback').innerHTML = w.phrase ? `${p} ${esc(w.ma.lat)} 🤲` : `${p} ${FLAG[d]} ${esc(w[d].lat)}`;
      await say(p, { word: w, d });
    }
    await wait(400);
    level.i++;
    return nextQuestion();
  }
  sfx('miss');
  q.misses++;
  el.classList.add('tried');
  if (q.misses >= 2) {
    // Deux essais : on montre la bonne réponse, sans gronder, et on avance.
    grade(P().progress, w.id, false);
    saveAll();
    const right = $$('.choice', $('#scene'))[q.choices.findIndex((x) => x.correct)];
    right?.classList.add('reveal');
    markDot(false);
    if (q.type === 'gen') {
      $('#feedback').textContent = `La bonne réponse : ${q.answer.text}`;
      await say('Voici la bonne réponse.', ...q.answer.say, 300);
    } else {
      $('#feedback').textContent = w.phrase ? `C'était : ${w.ma.lat}` : `C'était celui-là : ${w.fr} = ${w[d].lat}`;
      await say("C'était celui-là !", { word: w, d }, 300);
    }
    await wait(900);
    level.i++;
    return nextQuestion();
  }
  $('#feedback').textContent = 'Presque ! Essaie encore 💪';
  await say('Presque ! Essaie encore.', 200);
  if (q.type !== 'fr2dz') await promptVoice();
  busy = false;
}

// --- Suite à remettre dans l'ordre (jardin) ---
function buildSequence(scene) {
  q.done = 0;
  scene.className = 'scene game-sequence';
  scene.innerHTML = `
    <div class="seq-track">${q.seq.steps.map((s, k) => `<div class="seq-slot" data-k="${k}"><span class="n">${k + 1}</span></div>`).join('')}</div>
    <div class="seq-choices" id="seq-choices"></div>`;
  renderSeqChoices();
}
function renderSeqChoices() {
  const cs = sequenceChoices(q.seq, q.done, q.options);
  q.seqChoices = cs;
  $('#seq-choices').innerHTML = cs.map((c, i) => `
    <button class="choice seq-card" data-i="${i}"><span class="c-emoji">${c.step.e}</span>${P().kid.older ? `<span class="seq-t">${esc(c.step.t)}</span>` : ''}</button>`).join('');
  $$('#seq-choices .choice').forEach((b) => b.addEventListener('click', () => seqAnswer(+b.dataset.i, b)));
}
async function seqAnswer(i, el) {
  if (busy || el.classList.contains('tried')) return;
  busy = true;
  const c = q.seqChoices[i];
  if (c.correct) {
    sfx('pop');
    const slot = $(`.seq-slot[data-k="${q.done}"]`);
    slot.innerHTML = `<span class="c-emoji">${c.step.e}</span><small>${esc(c.step.t)}</small>`;
    slot.classList.add('filled');
    q.done++;
    await say(c.step.t);
    if (q.done >= q.seq.steps.length) {
      sfx('ok');
      confetti(50);
      const firstTry = q.misses === 0;
      if (firstTry) { P().progress.stars += 2; level.stars[turn] += 2; level.score[turn]++; }
      grade(P().progress, q.word.id, firstTry);
      saveAll();
      markDot(firstTry);
      $('#feedback').textContent = `${praise()} Tout est dans l'ordre !`;
      await say('Machallah ! Tout est dans le bon ordre.');
      await wait(600);
      level.i++;
      return nextQuestion();
    }
    renderSeqChoices();
    busy = false;
    return;
  }
  sfx('miss');
  q.misses++;
  el.classList.add('tried', 'shake');
  $('#feedback').textContent = 'Pas encore celle-là… essaie une autre 💪';
  await say('Pas encore celle-là.');
  busy = false;
}

// ---------- Fin du niveau ----------
function finishLevel() {
  const shown = [];
  let chest = false;
  const defi = room === DEFI;
  const records = [];
  players.forEach((p, k) => {
    p.progress.levels++;
    if (bilingualRoom(room) && settings.bilingual === 'partie') p.progress.nextLang = level.lang === 'en' ? 'ar' : 'en';
    if (defi) {
      const total = level.questions.filter((x) => (x.player ?? 0) === k).length;
      const best = p.progress.best || 0;
      const sc = Math.round((level.score[k] / total) * 10);
      if (sc > best) p.progress.best = sc;
      records.push({ sc, best, total, record: sc > best });
    } else {
      p.progress.rooms = p.progress.rooms || {};
      p.progress.rooms[room.id] = (p.progress.rooms[room.id] || 0) + 1;
    }
    const st = STICKERS[p.progress.stickers % STICKERS.length];
    if (p.progress.stickers < STICKERS.length) p.progress.stickers++;
    shown.push(st);
    if (p.progress.chest !== today()) { p.progress.chest = today(); p.progress.stars += 3; chest = true; }
  });
  const kind = defi ? 'defi' : room.id === 'poppy' ? 'poppy' : 'room';
  const missionsDone = players.flatMap((p) => autoComplete(p.progress, missionsOf(p), today(), { kind, school: !!room.school && !room.fan }).map((m) => ({ p, m })));
  missionsDone.forEach(({ p }) => { p.progress.stars += 3; });
  saveAll();
  sfx('win');
  confetti(90);
  const lead = players[0];
  const m = defi ? 0 : Math.round(mastery(lead.progress, itemsFor(room.id, lead.kid.older)) * 100);
  $('#reward-sticker').innerHTML = `<div class="reward-char"></div>` + shown.map((st) => `<div class="st-wrap"><span class="st">${st.e}</span><small>${esc(st.n)}</small></div>`).join('');
  const rc = mount($('#reward-sticker .reward-char'), drawChar(buddyOf(room)), { speaker: true });
  setTimeout(() => setMood(rc, 'cheer', 2400), 200);
  $('#reward-sticker').classList.toggle('two', shown.length > 1);
  const stars = level.stars.reduce((a, b) => a + b, 0);
  $('#reward-text').textContent = coop()
    ? `Bravo ${names()} ! Vous avez réveillé ${shown.map((s) => mid(s.n)).join(' et ')} !${stars ? ` +${stars} ⭐` : ''}`
    : `Tu as réveillé ${mid(shown[0].n)} !${stars ? ` +${stars} ⭐` : ''}${room.game === 'basket' && ctx.score ? ` · ${ctx.score} points de basket` : ''}`;
  $('#reward-chest').hidden = !chest;
  $('#reward-chest').innerHTML = chest ? `<span class="chest-icon">🎁</span> Le coffre de ${esc(settings.gm)} du jour : +3 ⭐` : '';
  if (chest) setTimeout(() => sfx('chest'), 900);
  $('#reward-fog').textContent = defi
    ? records.map((x, k) => `⚡ ${coop() ? players[k].kid.name + ' : ' : ''}${x.sc}/10${x.record ? ' — nouveau record !' : x.best ? ` (record : ${x.best}/10)` : ''}`).join(' · ')
    : m ? `🌫️ Le brouillard recule : ${room.name} réveillé à ${m} %` : '🌫️ Rejoue pour faire reculer le brouillard !';
  $('#reward-mission').hidden = !missionsDone.length;
  $('#reward-mission').textContent = missionsDone.map(({ p, m }) => `📋 ${coop() ? p.kid.name + ' : ' : ''}mission de ${m.from === 'papa' ? 'Papa' : 'Maman'} réussie ! +3 ⭐`).join(' · ');
  show('reward');
  say('Alhamdulillah !', 200, coop() ? `Bravo ${names()} !` : `Bravo ${lead.kid.name}, tu as réveillé ${mid(shown[0].n)} !`, ...(chest ? [`Et voici le coffre de ${settings.gm} !`] : []));
}
$('#reward-again').addEventListener('click', () => { sfx('tap'); if (timeUp()) return showTimeUp(); show('start'); });

$('#btn-album').addEventListener('click', () => {
  sfx('tap');
  const p = players[0];
  $('#album-title').textContent = coop() ? 'Nos albums' : `L'album de ${p.kid.name}`;
  $('#album-gold').textContent = `🏅 ${players.reduce((a, x) => a + (x.progress.gold || 0), 0)} doré(s)`;
  $('#album').innerHTML = players.map((pl) => `
    ${coop() ? `<h3 class="album-kid">${esc(pl.kid.avatar)} ${esc(pl.kid.name)}</h3>` : ''}
    <div class="album-grid">${STICKERS.map((s, i) => i < pl.progress.stickers
      ? `<div class="sticker"><span>${s.e}</span><small>${esc(s.n)}</small></div>`
      : `<div class="sticker locked"><span>?</span><small>À réveiller</small></div>`).join('')}
      ${Array.from({ length: pl.progress.gold || 0 }, () => '<div class="sticker gold"><span>🏅</span><small>Mission réussie</small></div>').join('')}
    </div>`).join('');
  show('album');
});

function confetti(n = 36) {
  const box = $('#confetti');
  const bits = ['🟠', '🟢', '⭐', '✨', '🔴', '🟡', '🌙'];
  for (let k = 0; k < n; k++) {
    const s = document.createElement('span');
    s.textContent = bits[k % bits.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDelay = Math.random() * 0.4 + 's';
    s.style.fontSize = 12 + Math.random() * 18 + 'px';
    box.appendChild(s);
    setTimeout(() => s.remove(), 2400);
  }
}

// ---------- Espace parents ----------
let gateNext = null;
function openGate(then) {
  const a = 4 + Math.floor(Math.random() * 6), b = 4 + Math.floor(Math.random() * 6);
  $('#gate-q').textContent = `${a} × ${b} = ?`;
  $('#gate-a').value = '';
  $('#gate').dataset.ans = a * b;
  $('#gate').hidden = false;
  gateNext = then;
  setTimeout(() => $('#gate-a').focus(), 50);
}
$('#gate-cancel').addEventListener('click', () => { $('#gate').hidden = true; });
$('#gate-ok').addEventListener('click', () => {
  if (+$('#gate-a').value === +$('#gate').dataset.ans) { $('#gate').hidden = true; gateNext?.(); }
  else { $('#gate-a').value = ''; $('#gate-a').classList.add('shake'); setTimeout(() => $('#gate-a').classList.remove('shake'), 400); }
});
$('#gate-a').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#gate-ok').click(); });
$('#btn-parents').addEventListener('click', () => openGate(openParents));
$('#timeup-parents').addEventListener('click', () => openGate(openParents));

function openParents() {
  stopVoice();
  renderVoices();
  renderMissions();
  renderSettings();
  renderProgress();
  renderCarnet();
  show('parents');
}
$('#ptabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  $$('#ptabs button').forEach((x) => x.classList.toggle('on', x === b));
  $$('.ptab').forEach((t) => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
});

// --- Voix : liste mot par mot ---
async function renderVoices() {
  const have = new Set(await recKeys());
  const plain = WORDS.filter((w) => !w.phrase);
  const rel = WORDS.filter((w) => w.phrase);
  const n = (d) => plain.filter((w) => have.has(w.id + ':' + d)).length;
  $('#voice-count').textContent = `Enregistrés : 🇲🇦 ${n('ma')} / ${plain.length} · 🇩🇿 ${n('dz')} / ${plain.length} · 🤲 ${rel.filter((w) => have.has(w.id + ':ma')).length} / ${rel.length}`;
  $('#voice-list').innerHTML = ROOMS.filter((r) => WORDS.some((w) => w.room === r.id)).map((r) => `
    <h3>${r.name}</h3>
    ${WORDS.filter((w) => w.room === r.id).map((w) => `
      <div class="vrow">
        <div class="vword"><span>${w.emoji}</span> ${esc(w.fr)}</div>
        ${(w.phrase ? ['ma'] : ['ma', 'dz']).map((d) => {
          const key = w.id + ':' + d;
          return `<div class="vcell ${have.has(key) ? 'has' : ''}" data-key="${key}">
            <span class="vlab">${w.phrase ? '🤲' : FLAG[d]} ${esc(w[d].lat)} ${have.has(key) ? '✅' : ''}</span>
            <span class="vbtns">
              <button data-act="rec" aria-label="Enregistrer">🎙</button>
              <button data-act="play" aria-label="Écouter">▶</button>
              ${have.has(key) ? '<button data-act="del" aria-label="Effacer">🗑</button>' : ''}
              <label class="vimp" aria-label="Importer un fichier audio">📁<input type="file" accept="audio/*" hidden></label>
            </span></div>`;
        }).join('')}
      </div>`).join('')}`).join('');
}
let recorder = null;
async function recordOnce(stream, ms = 8000) {
  const chunks = [];
  const r = new MediaRecorder(stream);
  recorder = r;
  r.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
  const done = new Promise((resolve) => { r.onstop = () => resolve(new Blob(chunks, { type: r.mimeType || chunks[0]?.type || 'audio/webm' })); });
  r.start();
  setTimeout(() => r.state === 'recording' && r.stop(), ms);
  const blob = await done;
  recorder = null;
  return blob;
}
const micError = () => alert("Le micro n'est pas accessible. Autorisez le micro pour ce site dans les réglages de la tablette (il faut aussi que le site soit en https).");
$('#voice-list').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const key = b.closest('.vcell').dataset.key;
  const [id, d] = key.split(':');
  const word = WORDS.find((w) => w.id === id);
  if (b.dataset.act === 'play') return say({ word, d });
  if (b.dataset.act === 'del') { await delRec(key); return renderVoices(); }
  if (b.dataset.act === 'rec') {
    if (recorder) { recorder.stop(); return; }
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return micError(); }
    b.textContent = '⏹';
    b.classList.add('recording');
    const blob = await recordOnce(stream);
    stream.getTracks().forEach((t) => t.stop());
    if (blob.size) await putRec(key, blob);
    await renderVoices();
    say({ word, d });
  }
});
$('#voice-list').addEventListener('change', async (e) => {
  const input = e.target.closest('input[type=file]');
  if (!input?.files?.[0]) return;
  await putRec(input.closest('.vcell').dataset.key, input.files[0]);
  renderVoices();
});

// --- Enregistrement rapide : un mot après l'autre, en gardant le doigt appuyé ---
const wz = { items: [], i: 0, d: 'ma', stream: null };
$$('[data-wizard]').forEach((b) => b.addEventListener('click', async () => {
  const mode = b.dataset.wizard;
  wz.d = mode === 'rel' ? 'ma' : mode;
  wz.items = WORDS.filter((w) => (mode === 'rel' ? w.phrase : !w.phrase));
  const have = new Set(await recKeys());
  const first = wz.items.findIndex((w) => !have.has(w.id + ':' + wz.d));
  wz.i = first < 0 ? 0 : first;
  try { wz.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { return micError(); }
  $('#wizard').hidden = false;
  showWizard();
}));
async function showWizard() {
  const w = wz.items[wz.i];
  const have = new Set(await recKeys());
  $('#wz-count').textContent = `${wz.i + 1} / ${wz.items.length} · ${w.phrase ? '🤲 Phrases du jardin' : wz.d === 'ma' ? '🇲🇦 Darija marocaine' : '🇩🇿 Darija algérienne'}`;
  $('#wz-emoji').textContent = w.emoji;
  $('#wz-fr').textContent = w.fr;
  $('#wz-word').innerHTML = `${esc(w[wz.d].lat)} <span class="c-ar">${esc(w[wz.d].ar)}</span>`;
  $('#wz-status').textContent = have.has(w.id + ':' + wz.d) ? '✅ Déjà enregistré. Vous pouvez refaire si besoin.' : 'Appuyez et gardez le doigt pendant que vous dites le mot.';
}
const wzRec = $('#wz-rec');
let wzPending = null;
wzRec.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (recorder || !wz.stream) return;
  wzRec.classList.add('recording');
  $('#wz-status').textContent = '🔴 J’écoute…';
  const w = wz.items[wz.i];
  wzPending = recordOnce(wz.stream, 10000).then(async (blob) => {
    wzRec.classList.remove('recording');
    if (blob.size > 800) {
      await putRec(w.id + ':' + wz.d, blob);
      $('#wz-status').textContent = '✅ Enregistré ! Écoutez, puis « Suivant ».';
      await say({ word: w, d: wz.d });
    } else $('#wz-status').textContent = 'Trop court : gardez le doigt appuyé pendant que vous parlez.';
  });
});
const wzStop = () => { if (recorder?.state === 'recording') setTimeout(() => recorder?.state === 'recording' && recorder.stop(), 250); };
wzRec.addEventListener('pointerup', wzStop);
wzRec.addEventListener('pointerleave', wzStop);
wzRec.addEventListener('pointercancel', wzStop);
wzRec.addEventListener('contextmenu', (e) => e.preventDefault());
$('#wz-play').addEventListener('click', () => say({ word: wz.items[wz.i], d: wz.d }));
const wzMove = async (k) => { await wzPending; wz.i = Math.min(wz.items.length - 1, Math.max(0, wz.i + k)); showWizard(); };
$('#wz-next').addEventListener('click', () => (wz.i >= wz.items.length - 1 ? closeWizard() : wzMove(1)));
$('#wz-skip').addEventListener('click', () => (wz.i >= wz.items.length - 1 ? closeWizard() : wzMove(1)));
async function closeWizard() {
  await wzPending;
  wz.stream?.getTracks().forEach((t) => t.stop());
  wz.stream = null;
  $('#wizard').hidden = true;
  renderVoices();
}
$('#wz-close').addEventListener('click', closeWizard);

// --- Missions ---
function renderMissions() {
  const m = missionOfWeek();
  $('#pm-text').innerHTML = `<span class="mi-icon">📞</span><span>${esc(m.text)}</span>`;
  $('#pm-kids').innerHTML = settings.kids.map((k, i) => {
    const p = progressOf(k);
    return `<label class="check big"><input type="checkbox" data-mk="${i}" ${p.missions?.[m.key] ? 'checked' : ''}> Réussie par ${esc(k.avatar)} ${esc(k.name)}</label>`;
  }).join('');
}
$('#pm-kids').addEventListener('change', (e) => {
  const t = e.target.closest('[data-mk]');
  if (!t) return;
  const k = settings.kids[+t.dataset.mk];
  const p = progressOf(k);
  const key = missionOfWeek().key;
  p.missions = p.missions || {};
  if (t.checked && !p.missions[key]) { p.missions[key] = true; p.gold = (p.gold || 0) + 1; p.stars += 5; sfx('chest'); }
  if (!t.checked && p.missions[key]) { delete p.missions[key]; p.gold = Math.max(0, (p.gold || 0) - 1); p.stars = Math.max(0, p.stars - 5); }
  saveProgressOf(k, p);
  const pl = players.find((x) => x.kid.id === k.id);
  if (pl) pl.progress = p;
});

// --- Réglages ---
const AVATARS = ['👦', '👧', '🧒', '👦🏽', '👧🏽', '👦🏻', '👧🏻', '🦁', '🦊', '⚽', '🏀', '🐱'];
function renderSettings() {
  $('#set-gm').value = settings.gm;
  $('#set-dialects').value = settings.dialects.join(',');
  $('#set-arabic').checked = settings.arabic;
  $('#set-music').value = settings.music;
  $('#set-sfx').checked = settings.sfx;
  $('#set-unlock-all').checked = settings.unlockAll;
  $('#set-poppy').checked = settings.poppy;
  $('#set-scarf').checked = settings.mamaScarf;
  $('#set-bilingual').value = settings.bilingual;
  $('#set-limit').value = String(settings.limit);
  $('#set-kids').innerHTML = settings.kids.map((k, i) => `
    <div class="kid-set" data-i="${i}">
      <select data-f="avatar" aria-label="Avatar">${AVATARS.map((a) => `<option ${a === k.avatar ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <input data-f="name" value="${esc(k.name)}" maxlength="16" aria-label="Prénom">
      <label class="check"><input type="checkbox" data-f="older" ${k.older ? 'checked' : ''}> sait lire (6 ans et +)</label>
    </div>`).join('');
  $('#set-voice').value = settings.voice;
  $('#set-frvoice').innerHTML = `<option value="">Automatique (la plus naturelle)</option>` + frVoices().map((x) => `<option ${x.name === settings.frVoice ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  const v = { fr: voiceFor('fr'), ar: voiceFor('ar') };
  $('#voice-info').textContent = `Voix de cette tablette — français : ${v.fr ? v.fr.name : 'aucune'} ; arabe : ${v.ar ? v.ar.name + ' (arabe standard, pas la darija)' : 'aucune (les mots sont lus en français, très approximatif)'}. Vos enregistrements passent toujours en premier.`;
}
$('#tab-settings').addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'set-gm') settings.gm = t.value.trim() || 'Hbibiti';
  if (t.id === 'set-dialects') settings.dialects = t.value.split(',');
  if (t.id === 'set-arabic') settings.arabic = t.checked;
  if (t.id === 'set-music') settings.music = t.value;
  if (t.id === 'set-sfx') settings.sfx = t.checked;
  if (t.id === 'set-unlock-all') settings.unlockAll = t.checked;
  if (t.id === 'set-poppy') settings.poppy = t.checked;
  if (t.id === 'set-scarf') settings.mamaScarf = t.checked;
  if (t.id === 'set-bilingual') settings.bilingual = t.value;
  if (t.id === 'set-limit') settings.limit = +t.value;
  if (t.id === 'set-voice') settings.voice = t.value;
  if (t.id === 'set-frvoice') settings.frVoice = t.value;
  const ks = t.closest('.kid-set');
  if (ks) {
    const k = settings.kids[+ks.dataset.i];
    if (t.dataset.f === 'name') k.name = t.value.trim() || k.name;
    if (t.dataset.f === 'avatar') k.avatar = t.value;
    if (t.dataset.f === 'older') k.older = t.checked;
  }
  saveSettings();
  applyGmName();
});
$('#set-unlock').addEventListener('click', () => {
  for (const k of settings.kids) {
    const t = timeState(k);
    t.bonus = (t.bonus || 0) + 10 * 60000;
    save('t-' + k.id, t);
  }
  alert('10 minutes de plus pour aujourd’hui.');
});
$('#set-testvoice').addEventListener('click', () => say('Salam ya galbi ! Je suis Hbibiti. Viens, on apprend ensemble.', { word: WORDS[0], d: 'ma' }));
// Garder toutes les voix enregistrées sur la tablette, pour jouer sans internet.
$('#set-dlvoices').addEventListener('click', async () => {
  const keys = recordedKeys();
  const out = $('#dlvoices-state');
  if (!keys.length) { out.textContent = 'Aucune voix enregistrée trouvée.'; return; }
  let n = 0;
  for (let i = 0; i < keys.length; i += 6) {
    await Promise.all(keys.slice(i, i + 6).map((k) => fetch(`voix/${k}.mp3`).then(() => { n++; }).catch(() => {})));
    out.textContent = `Téléchargement : ${n} / ${keys.length}…`;
  }
  out.textContent = `C'est prêt : ${n} phrases gardées sur la tablette.`;
});
$('#backup-export').addEventListener('click', async () => {
  const blob = await exportBackup();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hbibiti-sauvegarde-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});
$('#backup-import').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const n = await importBackup(f);
    alert(`Sauvegarde restaurée : ${n} enregistrement(s) de voix.`);
    players = [];
    openParents();
  } catch (err) { alert(err.message || 'Fichier illisible.'); }
  e.target.value = '';
});

// --- Progrès ---
function renderProgress() {
  $('#progress-list').innerHTML = settings.kids.map((k) => {
    const p = progressOf(k);
    const ws = WORDS.filter((w) => k.older || !w.older);
    const hard = ws.filter((w) => (p.words[w.id]?.wrong || 0) > (p.words[w.id]?.right || 0));
    const t = timeState(k);
    return `<div class="pkid">
      <h3>${esc(k.avatar)} ${esc(k.name)}</h3>
      <p>${p.levels} niveau(x) · ⭐ ${p.stars} · ${p.stickers} autocollant(s) · 🏅 ${p.gold || 0} mission(s) · aujourd'hui : ${Math.round(t.ms / 60000)} min</p>
      <p>Mots en anglais bien sus : <b>${Object.keys(EN).filter((id) => (p.words['en:' + id]?.box || 0) >= 2).length} / ${Object.keys(EN).length}</b></p>
      <p>Mots bien sus : <b>${ws.filter((w) => (p.words[w.id]?.box || 0) >= 2).length} / ${ws.length}</b>${hard.length ? ` · À revoir : ${hard.map((w) => esc(w.fr)).join(', ')}` : ''}</p>
      <p>Histoires écoutées : <b>${Object.keys(p.tales || {}).length} / ${TALES.length}</b></p>
      ${ROOMS.filter((r) => WORDS.some((w) => w.room === r.id)).map((r) => `<div class="proom"><b>${r.name}</b><div class="pwords">${ws.filter((w) => w.room === r.id).map((w) => {
        const s = p.words[w.id];
        const box = s?.box || 0;
        return `<span class="pw ${s?.seen ? '' : 'unseen'}" title="${esc(w.fr)}">${w.emoji}<i>${'●'.repeat(box)}${'○'.repeat(4 - box)}</i></span>`;
      }).join('')}</div></div>`).join('')}
    </div>`;
  }).join('');
}
// ---------- Le carnet de fierté (à montrer aux grands-parents) ----------
function renderCarnet() {
  $('#carnet-list').innerHTML = settings.kids.map((k, i) => {
    const r = weekReport(progressOf(k));
    const ds = settings.dialects;
    return `<div class="pkid carnet">
      <h3>${esc(k.avatar)} ${esc(k.name)} <small>${r.days} jour${r.days > 1 ? 's' : ''} de jeu</small></h3>
      <div class="carnet-stats">
        <span><b>${r.words.length}</b>mots de darija</span><span><b>${r.english}</b>mots d'anglais</span>
        <span><b>${r.tales}</b>histoires</span><span><b>${r.missions}</b>missions</span>
        <span><b>${r.ville}</b>aides en ville</span><span><b>⭐ ${r.stars}</b>étoiles</span>
      </div>
      ${r.words.length ? `<div class="carnet-words">${r.words.map((w) => `<span>${w.emoji || ''} ${esc(w.fr)} : <b>${[...new Set(ds.map((d) => w[d]?.lat).filter(Boolean))].map(esc).join(' / ')}</b></span>`).join('')}</div>`
    : '<p>Pas encore de nouveau mot cette semaine.</p>'}
      <button class="go small" data-share="${i}">📤 Envoyer aux grands-parents</button>
    </div>`;
  }).join('');
}
$('#carnet-list').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-share]');
  if (!b) return;
  const k = settings.kids[+b.dataset.share];
  const text = reportText(k.name, weekReport(progressOf(k)), settings.dialects);
  try {
    if (navigator.share) await navigator.share({ text });
    else { await navigator.clipboard.writeText(text); b.textContent = '✅ Copié : collez-le dans WhatsApp'; }
  } catch { /* partage annulé */ }
});

$('#set-reset').addEventListener('click', () => {
  if (!confirm('Effacer tous les progrès des enfants ? (Vos enregistrements de voix sont gardés.)')) return;
  for (const k of settings.kids) { saveProgressOf(k, newProgress()); save('t-' + k.id, {}); }
  players = [];
  renderProgress();
});

// ---------- La ville de Hbibiti : courir, sauter, parler aux habitants ----------
let ville = null;
function openVille() {
  if (!players.length) return openHome();
  if (timeUp()) return showTimeUp();
  show('ville');
  ville?.stop();
  let turnK = 0;
  say(`Bienvenue dans la ville de ${settings.gm} ! Cours, saute et parle aux habitants pour recevoir des missions.`);
  const kidLook = (k) => (k.older ? 'ali' : 'asma');
  ville = createVille({
    older: () => players[turnK % players.length].kid.older,
    dialects: settings.dialects,
    kidLook: kidLook(players[0].kid),
    kidLook2: coop() ? kidLook(players[1].kid) : null,
    scarf: settings.mamaScarf,
    say, sfx, stop: stopVoice,
    // Une question posée par un habitant : 2 essais, comme dans les salles.
    ask(question, box, textEl) {
      turn = turnK % players.length;
      const w = question.word, d = question.dialect, o = question.other;
      const who = coop() ? `${P().kid.avatar} ${P().kid.name} : ` : '';
      const label = (c) => (question.type === 'listen' ? `<span class="c-emoji">${c.word.emoji}</span>`
        : `<span class="c-text">${esc(c.word[question.type === 'cousin' ? o : d].lat)}</span>`);
      let prompt, voice;
      if (question.type === 'listen') { prompt = w.phrase ? '🔊 Écoute bien : quand dit-on ça ?' : '🔊 Écoute bien et trouve la bonne image !'; voice = ['Écoute bien.', { word: w, d }]; }
      else if (question.type === 'fr2dz') { prompt = `Comment on dit « ${esc(w.fr)} » ${DIALECT_NAME[d]} ${FLAG[d]} ?`; voice = [`Comment on dit ${w.fr}, ${DIALECT_NAME[d]} ?`]; }
      else { prompt = `${FLAG[d]} On dit « ${esc(w[d].lat)} ». Et ${DIALECT_NAME[o]} ${FLAG[o]} ?`; voice = [`${cap(DIALECT_NAME[d])}, on dit :`, { word: w, d }, `Et ${DIALECT_NAME[o]} ?`]; }
      textEl.innerHTML = who + prompt;
      box.innerHTML = question.choices.map((c, i) => `<button class="v-choice" data-i="${i}">${label(c)}</button>`).join('');
      say(...voice);
      let misses = 0;
      return new Promise((resolve) => {
        box.querySelectorAll('.v-choice').forEach((b) => b.addEventListener('click', async () => {
          if (b.disabled) return;
          const c = question.choices[+b.dataset.i];
          const ad = question.type === 'cousin' ? o : d;
          if (c.correct) {
            sfx('ok'); confetti(30);
            box.querySelectorAll('.v-choice').forEach((x) => { x.disabled = true; });
            b.classList.add('won');
            grade(P().progress, w.id, misses === 0);
            if (misses === 0) P().progress.stars++;
            saveAll();
            textEl.textContent = `${praise()} ${w[ad].lat}`;
            await say(praise(), { word: w, d: ad });
            turnK++;
            return resolve(misses === 0);
          }
          sfx('miss'); misses++; b.disabled = true; b.classList.add('tried');
          if (misses >= 2) {
            box.querySelectorAll('.v-choice').forEach((x) => { x.disabled = true; });
            box.querySelectorAll('.v-choice')[question.choices.findIndex((x) => x.correct)].classList.add('reveal');
            grade(P().progress, w.id, false); saveAll();
            textEl.textContent = `C'était : ${w[ad].lat}`;
            await say("C'était celui-là !", { word: w, d: ad });
            turnK++;
            return resolve(false);
          }
          await say('Presque ! Essaie encore.');
        }));
      });
    },
    onAskDone() { villeDone('ask'); },
    onFetchDone(npc, w) {
      players.forEach((p) => { markSeen(p.progress, w.id); p.progress.stars += 2; });
      saveAll(); confetti(60); villeDone('fetch');
    },
    onCoins(n) { players.forEach((p) => { p.progress.stars += n; }); saveAll(); },
  });
  if (location.search.includes('e2e')) window.__ville = ville; // pour les tests automatiques
}
// Chaque mission réussie en ville compte pour la mission du jour « balade en ville ».
function villeDone() {
  players.forEach((p) => {
    p.progress.ville = (p.progress.ville || 0) + 1;
    autoComplete(p.progress, missionsOf(p), today(), { kind: 'ville' }).forEach(() => { p.progress.stars += 3; });
  });
  saveAll();
}
$('#ville-back').addEventListener('click', () => { sfx('tap'); ville?.stop(); ville = null; openMap(); });

// ---------- Les missions de Papa et Maman ----------
// 3 missions par jour et par enfant : en vrai (confirmées par un parent) ou dans le jeu (validées toutes seules).
const FROM = { papa: 'Papa', maman: 'Maman' };
function missionsOf(p) {
  const sib = settings.kids.find((k) => k.id !== p.kid.id);
  return dailyMissions(p.kid, today(), { sibling: sib?.name, poppy: settings.poppy, levels: p.progress.levels || 0 });
}
function openDaily() {
  if (!players.length) return openHome();
  mount($('#daily-papa'), ART.papa(), { speaker: true });
  mount($('#daily-maman'), drawChar('maman'), { speaker: true });
  renderDaily();
  show('daily');
  const left = players.reduce((a, p) => a + missionsOf(p).filter((m) => !dailyState(p.progress, today()).done[m.id]).length, 0);
  say(left ? `Salam ${names()} ! Voici les missions de Papa et Maman pour aujourd'hui. Touche une mission pour l'écouter.` : `Machallah ${names()} ! Toutes les missions sont réussies aujourd'hui. Papa et Maman sont très fiers de toi !`);
}
function renderDaily() {
  $('#daily-list').innerHTML = players.map((p, k) => {
    const st = dailyState(p.progress, today());
    return `<div class="daily-kid">${coop() ? `<h3>${esc(p.kid.avatar)} ${esc(p.kid.name)}</h3>` : ''}
      ${missionsOf(p).map((m) => {
        const done = !!st.done[m.id];
        return `<div class="dm ${done ? 'done' : ''} from-${m.from}" data-p="${k}" data-m="${m.id}">
          <span class="dm-from">${drawChar(m.from)}<small>${FROM[m.from]}</small></span>
          <span class="dm-t">${esc(m.t)}</span>
          ${done ? '<span class="dm-ok">✅</span>' : m.auto ? '<span class="dm-auto">🎮 en jouant</span>' : '<button class="go small dm-btn">C\'est fait !</button>'}
        </div>`;
      }).join('')}</div>`;
  }).join('');
}
$('#daily-list').addEventListener('click', (e) => {
  const card = e.target.closest('.dm');
  if (!card) return;
  const p = players[+card.dataset.p];
  const m = missionsOf(p).find((x) => x.id === card.dataset.m);
  const who = m.from === 'papa' ? $('#daily-papa') : $('#daily-maman');
  if (!e.target.closest('.dm-btn')) {
    sfx('tap');
    who.querySelector('.char')?.classList.add('act');
    setTimeout(() => who.querySelector('.char')?.classList.remove('act'), 1400);
    return say(`${FROM[m.from]} dit :`, m.t);
  }
  // Un parent confirme que la mission est faite en vrai.
  sfx('tap');
  openGate(() => {
    dailyState(p.progress, today()).done[m.id] = true;
    p.progress.stars += 3;
    const st = dailyState(p.progress, today());
    const all = missionsOf(p).every((x) => st.done[x.id]);
    if (all) p.progress.gold = (p.progress.gold || 0) + 1;
    saveAll();
    renderDaily();
    sfx(all ? 'win' : 'ok'); confetti(all ? 90 : 40);
    setMood(charIn(who), 'cheer', 1800);
    say(all ? `Machallah ${p.kid.name} ! Les trois missions sont réussies : médaille d'or !` : `Bravo ${p.kid.name} ! ${FROM[m.from]} est très fier de toi.`.replace('Maman est très fier', 'Maman est très fière'));
  });
});

// ---------- Les histoires de Hbibiti ----------
// Petites histoires vraies lues à voix haute, page par page, puis deux petites questions.
let tale = null, taleI = 0, talePlaying = true, taleTok = 0, taleCat = null;
function openTales(cat = taleCat) {
  if (!players.length) return openHome();
  if (timeUp()) return showTimeUp();
  taleCat = cat;
  const heard = (id) => players.some((p) => p.progress.tales?.[id]);
  const next = nextTale(Object.fromEntries(TALES.filter((t) => heard(t.id)).map((t) => [t.id, true])), cat);
  $('#tale-cats').innerHTML = [['', '✨', 'Toutes'], ...Object.entries(TALE_CATS).map(([k, c]) => [k, c.e, c.n])]
    .map(([k, e, n]) => `<button data-cat="${k}" class="${(cat || '') === k ? 'on' : ''}">${e} ${n}</button>`).join('');
  $('#tale-grid').innerHTML = TALES.filter((t) => !cat || t.cat === cat).map((t) => `
    <button class="tale-item cat-${t.cat} ${t === next && !heard(t.id) ? 'suggest' : ''}" data-tale="${t.id}">
      <span class="ti-e">${t.e}</span><b>${esc(t.title)}</b>
      <small>${TALE_CATS[t.cat].e} ${TALE_CATS[t.cat].n}${heard(t.id) ? ' · ✅ écoutée' : t === next ? ' · ⭐ à découvrir' : ''}</small>
    </button>`).join('');
  $('#tales-count').textContent = `✅ ${TALES.filter((t) => heard(t.id)).length} / ${TALES.length}`;
  show('tales');
  say(`Viens t'asseoir près de moi, ${names()}. Quelle histoire veux-tu écouter ?`);
}
$('#tale-cats').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (b) { sfx('tap'); openTales(b.dataset.cat || null); } });
$('#tale-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-tale]'); if (b) openTale(TALES.find((t) => t.id === b.dataset.tale)); });

function openTale(t) {
  sfx('chime');
  tale = t; taleI = 0; talePlaying = true;
  preload([t.title + '.', ...t.pages.map((pg) => speakTale(pg.t))]);
  show('tale');
  mount($('#tale-teller'), ART.hbibiti(), { speaker: true });
  $('#tale-dots').innerHTML = t.pages.map(() => '<i></i>').join('') + '<i class="q">❓</i>';
  renderTalePage();
  readTalePage();
}
function renderTalePage() {
  const pg = tale.pages[taleI];
  $('#tale-quiz').hidden = true;
  $('#tale-card').hidden = false;
  $('#tale-ctrl').hidden = false;
  $('#tale-title').textContent = tale.title;
  $('#tale-pic').textContent = pg.e;
  $('#tale-text').textContent = pg.t;
  $('#tale-play').textContent = talePlaying ? '⏸ Pause' : '▶ Écouter';
  $('#tale-prev').disabled = taleI === 0;
  $$('#tale-dots i').forEach((d, i) => { d.classList.toggle('now', i === taleI); d.classList.toggle('ok', i < taleI); });
  const card = $('#tale-card');
  card.classList.remove('enter'); void card.offsetWidth; card.classList.add('enter');
}
async function readTalePage() {
  const tok = ++taleTok;
  const pg = tale.pages[taleI];
  await say(...(taleI === 0 ? [tale.title + '.', 500] : []), speakTale(pg.t));
  if (tok !== taleTok || !talePlaying) return;
  await wait(900);
  if (tok !== taleTok || !talePlaying) return;
  goTalePage(taleI + 1);
}
function goTalePage(i) {
  taleTok++;
  stopVoice();
  if (i >= tale.pages.length) return startTaleQuiz();
  taleI = Math.max(0, i);
  renderTalePage();
  if (talePlaying) readTalePage();
}
$('#tale-prev').addEventListener('click', () => { sfx('tap'); goTalePage(taleI - 1); });
$('#tale-next').addEventListener('click', () => { sfx('tap'); goTalePage(taleI + 1); });
$('#tale-play').addEventListener('click', () => {
  sfx('tap');
  talePlaying = !talePlaying;
  $('#tale-play').textContent = talePlaying ? '⏸ Pause' : '▶ Écouter';
  if (talePlaying) readTalePage(); else { taleTok++; stopVoice(); }
});
$('#tale-back').addEventListener('click', () => { sfx('tap'); openTales(); });

// Deux petites questions pour vérifier qu'on a bien écouté (chacun son tour en mode Ensemble).
let tq = null;
function startTaleQuiz() {
  $('#tale-card').hidden = true;
  $('#tale-ctrl').hidden = true;
  $$('#tale-dots i').forEach((d) => { d.classList.remove('now'); d.classList.add('ok'); });
  $('#tale-dots i.q')?.classList.add('now');
  tq = { k: 0, gained: players.map(() => 0) };
  showTaleQuestion();
}
async function showTaleQuestion() {
  const item = tale.quiz[tq.k];
  turn = tq.k % players.length;
  tq.misses = 0;
  tq.busy = true;
  tq.choices = shuffle(item.a.map(([e, t], i) => ({ e, t, correct: i === 0 })));
  const who = coop() ? `<p class="tq-who">C'est au tour de <b>${esc(P().kid.avatar)} ${esc(P().kid.name)}</b> !</p>` : '';
  $('#tale-quiz').innerHTML = `${who}<p class="tq-q">❓ ${esc(item.q)}</p>
    <div class="tq-choices">${tq.choices.map((c, i) => `<button class="choice tq-c" data-i="${i}"><span class="c-emoji">${c.e}</span><span class="tq-t">${esc(c.t)}</span></button>`).join('')}</div>
    <p class="feedback" id="tq-feedback"></p>`;
  $('#tale-quiz').hidden = false;
  $$('#tale-quiz .tq-c').forEach((b) => b.addEventListener('click', () => taleAnswer(+b.dataset.i, b)));
  const opts = tq.choices.flatMap((c, i) => [i ? 'ou' : '', speakTale(c.t)]).filter(Boolean);
  await say(...(coop() ? [`À toi, ${P().kid.name} !`] : []), speakTale(item.q), 300, ...opts);
  tq.busy = false;
}
async function taleAnswer(i, el) {
  if (tq.busy || el.classList.contains('tried')) return;
  tq.busy = true;
  stopVoice();
  const c = tq.choices[i];
  const fb = $('#tq-feedback');
  if (c.correct) {
    sfx('ok'); confetti();
    el.classList.add('won');
    react(charIn($('#tale-teller')), true);
    if (tq.misses === 0) { P().progress.stars++; tq.gained[turn]++; saveAll(); }
    fb.textContent = `${praise()} ${c.t}`;
    await say(praise(), speakTale(c.t));
  } else {
    sfx('miss');
    tq.misses++;
    el.classList.add('tried');
    react(charIn($('#tale-teller')), false);
    if (tq.misses < 2) {
      fb.textContent = 'Presque ! Essaie encore 💪';
      await say('Presque ! Essaie encore.');
      tq.busy = false;
      return;
    }
    const right = tq.choices.findIndex((x) => x.correct);
    $$('#tale-quiz .tq-c')[right].classList.add('reveal');
    fb.textContent = `La bonne réponse : ${tq.choices[right].t}`;
    await say('Voici la bonne réponse :', speakTale(tq.choices[right].t));
  }
  await wait(700);
  tq.k++;
  if (tq.k < tale.quiz.length) return showTaleQuestion();
  finishTale();
}
function finishTale() {
  players.forEach((p) => { p.progress.tales = { ...(p.progress.tales || {}), [tale.id]: true }; });
  const taleMissions = players.filter((p) => autoComplete(p.progress, missionsOf(p), today(), { kind: 'tale' }).length);
  taleMissions.forEach((p) => { p.progress.stars += 3; });
  saveAll();
  const stars = tq.gained.map((g, i) => (g ? (coop() ? `${esc(players[i].kid.name)} +${g} ⭐` : `+${g} ⭐`) : '')).filter(Boolean).join(' · ') || 'Merci d’avoir écouté !';
  const next = nextTale(players[0].progress.tales, tale.cat);
  $('#tale-quiz').innerHTML = `<p class="tq-q">Alhamdulillah, bravo ! ${stars}</p>${taleMissions.length ? '<p class="tq-who">📋 Mission de Maman réussie ! +3 ⭐</p>' : ''}
    <div class="row"><button class="go" id="tale-more">📚 Une autre histoire</button><button class="go alt" id="tale-again">🔁 Réécouter</button></div>`;
  $('#tale-more').addEventListener('click', () => { sfx('tap'); openTales(); });
  $('#tale-again').addEventListener('click', () => openTale(tale));
  setMood(charIn($('#tale-teller')), 'cheer', 1600);
  sfx('win');
  say('Alhamdulillah ! Bravo, tu as bien écouté.', ...(next && !players[0].progress.tales[next.id] ? [`Demain, je te raconterai peut-être : ${next.title}.`] : []));
}

// ---------- Démarrage ----------
initCharacters();
openHome();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
