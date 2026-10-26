// L'Usine magique de Hbibiti — écrans, déroulement des parties, espace parents.
import {
  WORDS, ROOMS, STICKERS, grade, markSeen, mastery, buildLevel, buildCoop,
  isCousin, today, sequenceChoices, missionOfWeek, roomUnlocked, newProgress,
} from './core.js';
import { settings, saveSettings, load, save, progressOf, saveProgressOf, putRec, delRec, recKeys, exportBackup, importBackup } from './store.js';
import { say, stopVoice, sfx, startMusic, stopMusic, voiceFor, audio } from './audio.js';
import { GAMES } from './games.js';
import { buildExerciseLevel, buildChallenge, itemsFor, isExerciseRoom, clockSVG } from './exercises.js';
import * as ART from './art.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DIALECT_NAME = { ma: 'au Maroc', dz: 'en Algérie' };
const FLAG = { ma: '🇲🇦', dz: '🇩🇿' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// « Le ballon de Fifi » → « le ballon de Fifi » au milieu d'une phrase.
const mid = (s) => (/^(Le|La|Les|L’)/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// ---------- Joueurs ----------
// Un enfant seul, ou deux en mode frère-sœur. Chacun garde ses propres progrès.
let players = [];
let turn = 0; // joueur de la question en cours
const P = () => players[turn];
const saveAll = () => players.forEach((p) => saveProgressOf(p.kid, p.progress));
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
  if (['map', 'start', 'learn', 'play', 'reward', 'album'].includes(id)) startMusic(); else stopMusic();
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
  $('#home-gm').innerHTML = ART.hbibiti();
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
  () => ({ art: ART.hbibiti('talk'), text: `Salam ${names()} ! Je suis ${settings.gm}. Bienvenue dans mon usine magique, où les jouets parlent darija, comme au Maroc et en Algérie !` }),
  () => ({ art: `<div class="fog-art">🌫️<span>🧸</span><span>🤖</span><span>🦄</span></div>`, text: 'Mais le brouillard de l’oubli est arrivé… Mes jouets se sont endormis : ils ont oublié leurs mots !' }),
  () => ({ art: `<div class="trio">${ART.grappo()}${ART.assad()}${ART.fifi()}</div>`, text: 'Avec Grappo le gant magique, Assad le lion et Fifi la fennec, aide-moi à les réveiller. Chaque mot appris fait reculer le brouillard. Yallah !' }),
];
function openStory() { storyI = 0; showStory(); show('story'); }
function showStory() {
  const s = STORY[storyI]();
  $('#story-art').innerHTML = s.art;
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
  $('#timeup-gm').innerHTML = ART.hbibiti();
  show('timeup');
  say(`Bslama ${names()} ! Tu as bien travaillé. On se retrouve demain, inchallah.`);
}

// ---------- L'usine ----------
const HOSTS = { grappo: ART.grappo, assad: ART.assad, fifi: ART.fifi, dada: ART.dada, lantern: () => ART.lantern(), tajine: ART.tajine, rocket: () => ART.rocket(), books: ART.books, clock: () => clockSVG(3, 0) };
// Défi éclair : questions mêlées de toutes les salles ouvertes, chacune dans la scène de sa salle.
const DEFI = { id: 'defi', name: 'Défi éclair', theme: '10 questions de tout le jeu', game: 'rocket', host: 'rocket' };
const openRooms = () => ROOMS.filter((r) => roomUnlocked(r, { levels: levelsDone() }, settings.unlockAll));
function openMap(greet) {
  if (!players.length) return openHome();
  if (timeUp()) return showTimeUp();
  applyGmName();
  $('#map-who').innerHTML = players.map((p) => `<span class="who">${esc(p.kid.avatar)} ${esc(p.kid.name)}</span>`).join('');
  $('#map-stars').textContent = players.reduce((a, p) => a + p.progress.stars, 0);
  $('#map-gm').innerHTML = ART.hbibiti();
  const lead = players[0];
  const all = ROOMS.flatMap((r) => itemsFor(r.id, lead.kid.older));
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
  $('#map-defi').innerHTML = `<span class="mi-icon">⚡</span><span><b>Défi éclair</b>10 questions de tout le jeu : maths, lecture, darija…${best ? ` Record : ${best}/10` : ''}</span><span class="defi-go">Go !</span>`;
  $('#rooms').innerHTML = ROOMS.map((r) => {
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
$('#rooms').addEventListener('click', (e) => {
  const b = e.target.closest('[data-room]');
  if (!b) return;
  openStart(ROOMS.find((r) => r.id === b.dataset.room));
});
function openStart(r) {
  sfx('tap');
  room = r;
  $('#start-room').textContent = room.name;
  $('#start-host').innerHTML = HOSTS[room.host]?.() || '';
  show('start');
  say(room.name);
}
let room = null;

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
  const opts = { dialects: settings.dialects, seqIndex: levelsDone(), build, count: room === DEFI ? 10 : undefined };
  level = coop()
    ? buildCoop(room.id, players.map((p) => ({ progress: p.progress, older: p.kid.older })), opts)
    : build(room.id, P().progress, { ...opts, older: P().kid.older });
  level.i = 0; level.learnI = 0; level.score = players.map(() => 0);
  level.stars = players.map(() => 0);
  ctx.score = 0; ctx.streak = 0;
  say('Bismillah !');
  if (level.learn.length) showLearn(); else startPlay();
});

const anyReader = () => players.some((p) => p.kid.older);
const showAr = (p = P()) => settings.arabic && p?.kid.older;
function showLearn() {
  const w = level.learn[level.learnI];
  $('#learn-count').textContent = `${level.learnI + 1} / ${level.learn.length}`;
  $('#learn-emoji').textContent = w.emoji;
  $('#learn-fr').textContent = w.phrase ? `${w.fr}, on dit :` : w.fr;
  $('#learn-cousin').hidden = !(isCousin(w) && !w.phrase && settings.dialects.length > 1);
  for (const d of ['ma', 'dz']) {
    const b = $('#learn-' + d);
    b.hidden = !!w.phrase || !settings.dialects.includes(d);
    $('.lat', b).textContent = w[d].lat;
    $('.ar', b).textContent = settings.arabic && anyReader() ? w[d].ar : '';
  }
  const both = $('#learn-both');
  both.hidden = !w.phrase;
  $('.lat', both).textContent = w.ma.lat;
  $('.ar', both).textContent = w.ma.ar;
  players.forEach((p) => markSeen(p.progress, w.id));
  saveAll();
  show('learn');
  $('#learn-card').classList.remove('enter'); void $('#learn-card').offsetWidth; $('#learn-card').classList.add('enter');
  const seq = [];
  if (w.phrase) seq.push(`${w.fr}, on dit :`, { word: w, d: 'ma' });
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
    say({ word: w, d: d === 'both' ? 'ma' : d });
  });
}
$('#learn-next').addEventListener('click', () => {
  sfx('tap');
  level.learnI++;
  if (level.learnI < level.learn.length) showLearn(); else startPlay();
});

function startPlay() {
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
  saveAll();
  sfx('win');
  confetti(90);
  const lead = players[0];
  const m = defi ? 0 : Math.round(mastery(lead.progress, itemsFor(room.id, lead.kid.older)) * 100);
  $('#reward-sticker').innerHTML = shown.map((st) => `<div class="st-wrap"><span class="st">${st.e}</span><small>${esc(st.n)}</small></div>`).join('');
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
  $('#voice-list').innerHTML = ROOMS.map((r) => `
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
  $('#set-limit').value = String(settings.limit);
  $('#set-kids').innerHTML = settings.kids.map((k, i) => `
    <div class="kid-set" data-i="${i}">
      <select data-f="avatar" aria-label="Avatar">${AVATARS.map((a) => `<option ${a === k.avatar ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <input data-f="name" value="${esc(k.name)}" maxlength="16" aria-label="Prénom">
      <label class="check"><input type="checkbox" data-f="older" ${k.older ? 'checked' : ''}> sait lire (6 ans et +)</label>
    </div>`).join('');
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
  if (t.id === 'set-limit') settings.limit = +t.value;
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
$('#set-testvoice').addEventListener('click', () => say('Salam ! Voici la voix de la tablette.', { word: WORDS[0], d: 'ma' }));
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
      <p>Mots bien sus : <b>${ws.filter((w) => (p.words[w.id]?.box || 0) >= 2).length} / ${ws.length}</b>${hard.length ? ` · À revoir : ${hard.map((w) => esc(w.fr)).join(', ')}` : ''}</p>
      ${ROOMS.map((r) => `<div class="proom"><b>${r.name}</b><div class="pwords">${ws.filter((w) => w.room === r.id).map((w) => {
        const s = p.words[w.id];
        const box = s?.box || 0;
        return `<span class="pw ${s?.seen ? '' : 'unseen'}" title="${esc(w.fr)}">${w.emoji}<i>${'●'.repeat(box)}${'○'.repeat(4 - box)}</i></span>`;
      }).join('')}</div></div>`).join('')}
    </div>`;
  }).join('');
}
$('#set-reset').addEventListener('click', () => {
  if (!confirm('Effacer tous les progrès des enfants ? (Vos enregistrements de voix sont gardés.)')) return;
  for (const k of settings.kids) { saveProgressOf(k, newProgress()); save('t-' + k.id, {}); }
  players = [];
  renderProgress();
});

// ---------- Démarrage ----------
openHome();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
