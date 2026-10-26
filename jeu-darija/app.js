// L'Usine magique de Hbibiti — interface, voix, mini-jeux.
import {
  WORDS, ROOMS, STICKERS, wordsFor, newProgress, grade, markSeen, mastery,
  buildLevel, isCousin, today, speakable,
} from './core.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Stockage (tout reste sur la tablette) ----------
const LS = 'hbibiti-';
function load(key, def) {
  try { const v = localStorage.getItem(LS + key); return v ? JSON.parse(v) : def; } catch { return def; }
}
function save(key, val) {
  try { localStorage.setItem(LS + key, JSON.stringify(val)); } catch { /* stockage plein ou bloqué */ }
}

const DEFAULT_SETTINGS = {
  gm: 'Hbibiti',
  kids: [
    { id: 'ali', name: 'Ali', avatar: '👦', older: true },
    { id: 'asma', name: 'Asma', avatar: '👧', older: false },
  ],
  dialects: ['ma', 'dz'],
  arabic: false,
  sfx: true,
  limit: 0,
};
let settings = { ...DEFAULT_SETTINGS, ...load('settings', {}) };
const saveSettings = () => save('settings', settings);

let kid = null; // enfant en train de jouer
let progress = null;
const progressOf = (k) => ({ ...newProgress(), ...load('p-' + k.id, {}) });
const saveProgress = () => kid && save('p-' + kid.id, progress);

// Voix enregistrées par les parents : IndexedDB (les fichiers audio sont trop gros pour localStorage).
const db = new Promise((resolve) => {
  try {
    const req = indexedDB.open('hbibiti', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('voices');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  } catch { resolve(null); }
});
async function idb(mode, fn) {
  const d = await db;
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const tx = d.transaction('voices', mode);
      const req = fn(tx.objectStore('voices'));
      tx.oncomplete = () => resolve(req?.result ?? null);
      tx.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
const getRec = (key) => idb('readonly', (s) => s.get(key));
const putRec = (key, blob) => idb('readwrite', (s) => s.put(blob, key));
const delRec = (key) => idb('readwrite', (s) => s.delete(key));
const recKeys = () => idb('readonly', (s) => s.getAllKeys());

// ---------- Voix ----------
const synth = window.speechSynthesis;
let voices = [];
const loadVoices = () => { voices = synth ? synth.getVoices() : []; };
loadVoices();
synth?.addEventListener?.('voiceschanged', loadVoices);
function voiceFor(lang) {
  const list = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
  if (lang === 'fr') return list.find((v) => /fr-ca/i.test(v.lang)) || list.find((v) => /fr-fr/i.test(v.lang)) || list[0];
  return list.find((v) => /ar-(ma|dz)/i.test(v.lang)) || list[0];
}

let sayToken = 0;
let currentAudio = null;
function stopVoice() {
  sayToken++;
  try { synth?.cancel(); } catch { /* rien */ }
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
}
function speak(text, lang = 'fr', rate = 0.95) {
  return new Promise((resolve) => {
    if (!synth || !text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = voiceFor(lang);
    if (v) u.voice = v;
    u.lang = v?.lang || (lang === 'fr' ? 'fr-FR' : 'ar');
    u.rate = rate;
    let done = false;
    const end = () => { if (!done) { done = true; resolve(); } };
    u.onend = end; u.onerror = end;
    setTimeout(end, 1200 + text.length * 110); // certains navigateurs oublient « onend »
    synth.speak(u);
  });
}
async function playBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  currentAudio = a;
  await new Promise((resolve) => {
    a.onended = resolve; a.onerror = resolve;
    a.play().catch(resolve);
    setTimeout(resolve, 15000);
  });
  URL.revokeObjectURL(url);
  if (currentAudio === a) currentAudio = null;
}
// Le mot dans un dialecte : votre enregistrement d'abord, sinon la voix temporaire de la tablette.
async function playWord(word, d) {
  const rec = await getRec(word.id + ':' + d);
  if (rec) return playBlob(rec);
  if (voiceFor('ar')) return speak(word[d].ar, 'ar', 0.8);
  return speak(speakable(word[d].lat), 'fr', 0.8);
}
// Suite de phrases et de mots, annulée si une autre commence.
async function say(...parts) {
  stopVoice();
  const tok = sayToken;
  for (const p of parts) {
    if (tok !== sayToken) return;
    if (typeof p === 'number') await wait(p);
    else if (typeof p === 'string') await speak(p);
    else if (p?.word) await playWord(p.word, p.d);
  }
}
const DIALECT_NAME = { ma: 'au Maroc', dz: 'en Algérie' };
const FLAG = { ma: '🇲🇦', dz: '🇩🇿' };

// ---------- Petits sons (Web Audio, rien à télécharger) ----------
let ac = null;
function tone(freq, t0, dur, type = 'sine', vol = 0.18) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, ac.currentTime + t0);
  g.gain.linearRampToValueAtTime(vol, ac.currentTime + t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + dur + 0.05);
}
function sfx(kind) {
  if (!settings.sfx) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    if (kind === 'ok') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.25, 'triangle'));
    if (kind === 'miss') { tone(330, 0, 0.2, 'sine', 0.12); tone(262, 0.18, 0.3, 'sine', 0.12); }
    if (kind === 'whistle') { tone(2100, 0, 0.12, 'sine', 0.08); tone(2100, 0.16, 0.3, 'sine', 0.08); }
    if (kind === 'tap') tone(880, 0, 0.06, 'square', 0.04);
    if (kind === 'win') [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle'));
  } catch { /* pas de son */ }
}

// ---------- Écrans ----------
function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 's-' + id));
  current = id;
  if (id !== 'play' && id !== 'learn') stopVoice();
}
let current = 'home';
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { sfx('tap'); route(go.dataset.go); }
});
function route(id) {
  if (id === 'map') return openMap();
  if (id === 'home') return openHome();
  show(id);
}
function applyGmName() { $$('.gm-name').forEach((el) => { el.textContent = settings.gm; }); document.title = `L'Usine magique de ${settings.gm}`; }

function openHome() {
  applyGmName();
  $('#kids').innerHTML = settings.kids.map((k, i) => `
    <button class="kid" data-kid="${i}">
      <span class="kid-av">${esc(k.avatar)}</span>
      <span class="kid-name">${esc(k.name)}</span>
      <span class="kid-sub">⭐ ${progressOf(k).stars}</span>
    </button>`).join('');
  show('home');
}
$('#kids').addEventListener('click', (e) => {
  const b = e.target.closest('[data-kid]');
  if (!b) return;
  kid = settings.kids[+b.dataset.kid];
  progress = progressOf(kid);
  sfx('tap');
  openMap(true);
});

// ---------- Temps de jeu ----------
function timeState() {
  const t = load('t-' + kid.id, {});
  return t.date === today() ? t : { date: today(), ms: 0, bonus: 0 };
}
function timeUp() {
  if (!kid || !settings.limit) return false;
  const t = timeState();
  return t.ms >= settings.limit * 60000 + (t.bonus || 0);
}
setInterval(() => {
  if (!kid || document.hidden || ['home', 'parents', 'timeup'].includes(current)) return;
  const t = timeState();
  t.ms += 5000;
  save('t-' + kid.id, t);
  if (current === 'map' && timeUp()) showTimeUp();
}, 5000);
function showTimeUp() {
  show('timeup');
  say(`Bslama ${kid.name} ! On se retrouve demain, inchallah.`);
}

// ---------- L'usine ----------
function openMap(greet) {
  if (!kid) return openHome();
  if (timeUp()) return showTimeUp();
  applyGmName();
  $('#map-avatar').textContent = kid.avatar;
  $('#map-name').textContent = kid.name;
  $('#map-stars').textContent = progress.stars;
  const playable = ROOMS.filter((r) => !r.soon);
  const all = playable.flatMap((r) => wordsFor(r.id, kid.older));
  const m = Math.round(mastery(progress, all) * 100);
  $('#map-bubble').textContent = progress.levels
    ? `Salam ${kid.name} ! Le brouillard de l'oubli recule : l'usine est réveillée à ${m} %. Choisis une salle !`
    : `Salam ${kid.name} ! Le brouillard de l'oubli a endormi mes jouets. Aide-moi à les réveiller avec les mots de la darija !`;
  $('#rooms').innerHTML = ROOMS.map((r) => {
    if (r.soon) return `<div class="room soon"><span class="room-emoji">${r.emoji}</span><b>${r.name}</b><small>${r.theme} · bientôt</small><span class="lock">🔒</span></div>`;
    const ws = wordsFor(r.id, kid.older);
    const rm = mastery(progress, ws);
    const seen = ws.filter((w) => progress.words[w.id]?.seen).length;
    return `<button class="room" data-room="${r.id}">
      <span class="room-emoji">${r.emoji}</span><b>${r.name}</b><small>${r.theme} · ${seen}/${ws.length} mots</small>
      <span class="room-fog" style="opacity:${(0.85 - rm * 0.85).toFixed(2)}"></span>
      <span class="meter"><i style="width:${Math.round(rm * 100)}%"></i></span>
    </button>`;
  }).join('');
  $('#fog').style.opacity = (0.5 - (m / 100) * 0.5).toFixed(2);
  show('map');
  if (greet) say($('#map-bubble').textContent);
}
$('#rooms').addEventListener('click', (e) => {
  const b = e.target.closest('[data-room]');
  if (!b) return;
  sfx('tap');
  room = ROOMS.find((r) => r.id === b.dataset.room);
  $('#start-room').textContent = `${room.emoji} ${room.name}`;
  show('start');
});
let room = null;

// ---------- Une partie ----------
let level = null;
$('#btn-bismillah').addEventListener('click', () => {
  sfx('tap');
  level = buildLevel(room.id, progress, { older: kid.older, dialects: settings.dialects });
  level.i = 0; level.learnI = 0; level.stars = 0;
  say('Bismillah !');
  if (level.learn.length) showLearn(); else startPlay();
});

const showAr = () => settings.arabic && kid?.older;
function showLearn() {
  const w = level.learn[level.learnI];
  $('#learn-count').textContent = `${level.learnI + 1} / ${level.learn.length}`;
  $('#learn-emoji').textContent = w.emoji;
  $('#learn-fr').textContent = w.fr;
  $('#learn-cousin').hidden = !(isCousin(w) && settings.dialects.length > 1);
  for (const d of ['ma', 'dz']) {
    const b = $('#learn-' + d);
    b.hidden = !settings.dialects.includes(d);
    $('.lat', b).textContent = w[d].lat;
    $('.ar', b).textContent = showAr() ? w[d].ar : '';
  }
  markSeen(progress, w.id);
  saveProgress();
  show('learn');
  const seq = [w.fr, 300];
  for (const d of settings.dialects) seq.push(`${DIALECT_NAME[d]}, on dit :`, { word: w, d }, 400);
  if (isCousin(w) && settings.dialects.length > 1) seq.push("C'est un mot cousin !");
  say(...seq);
}
for (const d of ['ma', 'dz']) {
  $('#learn-' + d).addEventListener('click', () => {
    const w = level.learn[level.learnI];
    $('#learn-' + d).classList.add('pop');
    setTimeout(() => $('#learn-' + d).classList.remove('pop'), 400);
    say({ word: w, d });
  });
}
$('#learn-next').addEventListener('click', () => {
  sfx('tap');
  level.learnI++;
  if (level.learnI < level.learn.length) showLearn(); else startPlay();
});

function startPlay() {
  show('play');
  $('#play-dots').innerHTML = level.questions.map(() => '<i></i>').join('');
  nextQuestion();
}
$('#play-quit').addEventListener('click', () => { saveProgress(); openMap(); });
$('#play-replay').addEventListener('click', () => promptVoice());

let q = null;
let busy = false;
function promptText() {
  const w = q.word;
  if (q.type === 'listen') return { html: `🔊 Écoute bien et touche ${room.game === 'penalty' ? 'le bon ballon' : 'la bonne porte'} !` };
  if (q.type === 'fr2dz') return { html: `Comment on dit <b>« ${esc(w.fr)} »</b> ${DIALECT_NAME[q.dialect]} ${FLAG[q.dialect]} ?` };
  return { html: `${FLAG[q.dialect]} ${DIALECT_NAME[q.dialect].replace('au', 'Au').replace('en', 'En')}, on dit <b>« ${esc(w[q.dialect].lat)} »</b>.<br>Et ${DIALECT_NAME[q.other]} ${FLAG[q.other]} ?` };
}
function promptVoice() {
  const w = q.word;
  if (q.type === 'listen') return say('Écoute bien.', { word: w, d: q.dialect });
  if (q.type === 'fr2dz') return say(`Comment on dit ${w.fr}, ${DIALECT_NAME[q.dialect]} ?`);
  return say(`${DIALECT_NAME[q.dialect]}, on dit :`, { word: w, d: q.dialect }, `Et ${DIALECT_NAME[q.other]} ?`);
}
function choiceLabel(c) {
  if (q.type === 'listen') return `<span class="c-emoji">${c.word.emoji}</span>`;
  const d = q.type === 'fr2dz' ? q.dialect : q.other;
  return `<span class="c-text">${esc(c.word[d].lat)}</span>${showAr() ? `<span class="c-ar">${esc(c.word[d].ar)}</span>` : ''}`;
}

function nextQuestion() {
  if (level.i >= level.questions.length) return finishLevel();
  q = level.questions[level.i];
  q.misses = 0;
  busy = false;
  $$('#play-dots i').forEach((d, i) => d.classList.toggle('now', i === level.i));
  $('#play-prompt').innerHTML = promptText().html;
  $('#feedback').textContent = '';
  (room.game === 'penalty' ? buildPenalty : buildDoors)();
  promptVoice();
}

const PRAISE = ['Bravo !', 'Machallah !', 'Zwin bezzaf !', 'Super !', 'Saha !', 'Waouh !'];
async function answer(i, el) {
  if (busy) return;
  const c = q.choices[i];
  if (el.classList.contains('tried')) return;
  busy = true;
  stopVoice();
  const good = c.correct;
  await (room.game === 'penalty' ? shootAnim(i, good) : grabAnim(i, good));
  const w = q.word;
  if (good) {
    sfx('ok');
    confetti();
    const firstTry = q.misses === 0;
    grade(progress, w.id, firstTry);
    if (firstTry) { progress.stars++; level.stars++; }
    saveProgress();
    $$('#play-dots i')[level.i].classList.add(firstTry ? 'ok' : 'meh');
    const p = PRAISE[Math.floor(Math.random() * PRAISE.length)];
    $('#feedback').textContent = `${p} ${FLAG[q.type === 'cousin' ? q.other : q.dialect]} ${w[q.type === 'cousin' ? q.other : q.dialect].lat}`;
    await say(p, { word: w, d: q.type === 'cousin' ? q.other : q.dialect });
    await wait(500);
    level.i++;
    nextQuestion();
    return;
  }
  sfx('miss');
  q.misses++;
  el.classList.add('tried');
  if (q.misses >= 2) {
    // Deux essais : on montre la bonne réponse, sans gronder, et on avance.
    grade(progress, w.id, false);
    saveProgress();
    const right = $$('.choice', $('#scene'))[q.choices.findIndex((x) => x.correct)];
    right?.classList.add('reveal');
    $$('#play-dots i')[level.i].classList.add('meh');
    $('#feedback').textContent = `C'était celui-là : ${w.fr} = ${w[q.type === 'cousin' ? q.other : q.dialect].lat}`;
    await say("C'était celui-là !", { word: w, d: q.type === 'cousin' ? q.other : q.dialect }, 300);
    await wait(900);
    level.i++;
    nextQuestion();
    return;
  }
  $('#feedback').textContent = 'Presque ! Essaie encore 💪';
  await say('Presque ! Essaie encore.', 200);
  if (q.type !== 'fr2dz') await promptVoice();
  busy = false;
}

// --- Mini-jeu : les portes de l'usine (Grappo, le gant magique) ---
const TOYS = ['🧸', '🤖', '🦄', '🐻', '🪀', '🎈', '🚂', '🪁', '🐢', '🦖'];
function buildDoors() {
  const toys = [...TOYS].sort(() => Math.random() - 0.5);
  $('#scene').className = 'scene doors';
  $('#scene').innerHTML = `
    <div class="door-row">${q.choices.map((c, i) => `
      <button class="choice door" data-i="${i}">
        <span class="toy">${toys[i]}</span>
        <span class="door-leaf"><span class="door-label">${choiceLabel(c)}</span><span class="lever"></span></span>
      </button>`).join('')}
    </div>
    <div class="grappo"><span class="arm"></span><span class="hand">🧤</span></div>`;
  $$('.choice', $('#scene')).forEach((b) => b.addEventListener('click', () => answer(+b.dataset.i, b)));
}
async function grabAnim(i, good) {
  const door = $$('.door', $('#scene'))[i];
  const hand = $('.grappo .hand'), arm = $('.grappo .arm');
  const h = hand.getBoundingClientRect(), d = $('.lever', door).getBoundingClientRect();
  const dx = d.left + d.width / 2 - (h.left + h.width / 2), dy = d.top + d.height / 2 - (h.top + h.height / 2);
  const len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  arm.style.transform = `rotate(${ang}rad)`;
  arm.style.width = '0px';
  sfx('tap');
  await wait(20);
  arm.style.transition = 'width .35s ease-out';
  arm.style.width = len + 'px';
  hand.style.transition = 'transform .35s ease-out';
  hand.style.transform = `translate(${dx}px, ${dy}px)`;
  await wait(380);
  door.classList.add(good ? 'open' : 'shake');
  await wait(300);
  arm.style.width = '0px';
  hand.style.transform = 'translate(0,0)';
  await wait(good ? 500 : 350);
  door.classList.remove('shake');
}

// --- Mini-jeu : tirs au but contre Assad ---
function buildPenalty() {
  $('#scene').className = 'scene penalty';
  $('#scene').innerHTML = `
    <div class="goal"><div class="net"></div>
      <div class="spot s0"></div><div class="spot s1"></div><div class="spot s2"></div>
      <div class="keeper">🦁</div>
      <div class="goal-text">BUT !</div>
    </div>
    <div class="ball-row">${q.choices.map((c, i) => `
      <button class="choice ball-btn" data-i="${i}"><span class="ball">⚽</span><span class="ball-label">${choiceLabel(c)}</span></button>`).join('')}
    </div>`;
  $$('.choice', $('#scene')).forEach((b) => b.addEventListener('click', () => answer(+b.dataset.i, b)));
}
async function shootAnim(i, good) {
  const btn = $$('.ball-btn', $('#scene'))[i];
  const ball = $('.ball', btn);
  const spot = $('.spot.s' + i).getBoundingClientRect();
  const b = ball.getBoundingClientRect();
  const keeper = $('.keeper');
  const dx = spot.left + spot.width / 2 - (b.left + b.width / 2), dy = spot.top + spot.height / 2 - (b.top + b.height / 2);
  sfx('whistle');
  ball.style.transition = 'transform .5s cubic-bezier(.2,.7,.3,1)';
  ball.style.transform = `translate(${dx}px, ${dy}px) scale(.7) rotate(540deg)`;
  // Assad plonge : du mauvais côté si c'est la bonne réponse, sur le ballon sinon.
  const side = good ? (i === 0 ? 2 : i === 2 ? 0 : Math.random() < 0.5 ? 0 : 2) : i;
  keeper.className = 'keeper dive' + side;
  await wait(560);
  if (good) { $('.goal').classList.add('scored'); } else { keeper.classList.add('catch'); }
  await wait(good ? 700 : 600);
  ball.style.transition = 'none';
  ball.style.transform = '';
  if (!good) keeper.className = 'keeper';
}

// ---------- Fin du niveau ----------
function finishLevel() {
  progress.levels++;
  const st = STICKERS[progress.stickers % STICKERS.length];
  const isNew = progress.stickers < STICKERS.length;
  if (isNew) progress.stickers++;
  saveProgress();
  sfx('win');
  confetti(80);
  const ws = wordsFor(room.id, kid.older);
  const m = Math.round(mastery(progress, ws) * 100);
  $('#reward-sticker').innerHTML = `<span class="st">${st.e}</span><small>${esc(st.n)}</small>`;
  $('#reward-text').textContent = isNew
    ? `Tu as réveillé ${st.n} ! +${level.stars} ⭐`
    : `Bravo ${kid.name} ! +${level.stars} ⭐`;
  $('#reward-fog').textContent = `🌫️ Le brouillard recule : ${room.name} réveillé à ${m} %`;
  show('reward');
  say('Alhamdulillah !', 200, isNew ? `Bravo ${kid.name}, tu as réveillé ${st.n} !` : `Bravo ${kid.name} !`);
}
$('#reward-again').addEventListener('click', () => { sfx('tap'); if (timeUp()) return showTimeUp(); show('start'); });

$('#btn-album').addEventListener('click', () => {
  sfx('tap');
  $('#album').innerHTML = STICKERS.map((s, i) => i < progress.stickers
    ? `<div class="sticker"><span>${s.e}</span><small>${esc(s.n)}</small></div>`
    : `<div class="sticker locked"><span>?</span><small>À réveiller</small></div>`).join('');
  show('album');
});

function confetti(n = 36) {
  const box = $('#confetti');
  const bits = ['🟠', '🟢', '⭐', '✨', '🔴', '🟡'];
  for (let k = 0; k < n; k++) {
    const s = document.createElement('span');
    s.textContent = bits[k % bits.length];
    s.style.left = Math.random() * 100 + 'vw';
    s.style.animationDelay = Math.random() * 0.4 + 's';
    s.style.fontSize = 12 + Math.random() * 18 + 'px';
    box.appendChild(s);
    setTimeout(() => s.remove(), 2200);
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

async function renderVoices() {
  const have = new Set((await recKeys()) || []);
  $('#voice-list').innerHTML = ROOMS.filter((r) => !r.soon).map((r) => `
    <h3>${r.emoji} ${r.name}</h3>
    ${WORDS.filter((w) => w.room === r.id).map((w) => `
      <div class="vrow">
        <div class="vword"><span>${w.emoji}</span> ${esc(w.fr)}</div>
        ${['ma', 'dz'].map((d) => {
          const key = w.id + ':' + d;
          return `<div class="vcell ${have.has(key) ? 'has' : ''}" data-key="${key}">
            <span class="vlab">${FLAG[d]} ${esc(w[d].lat)} ${have.has(key) ? '✅' : ''}</span>
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
$('#voice-list').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const cell = b.closest('.vcell');
  const key = cell.dataset.key;
  const [id, d] = key.split(':');
  const word = WORDS.find((w) => w.id === id);
  if (b.dataset.act === 'play') return say({ word, d });
  if (b.dataset.act === 'del') { await delRec(key); return renderVoices(); }
  if (b.dataset.act === 'rec') {
    if (recorder) { recorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = recorder.mimeType || chunks[0]?.type || 'audio/webm';
        recorder = null;
        if (chunks.length) await putRec(key, new Blob(chunks, { type }));
        await renderVoices();
        say({ word, d });
      };
      recorder.start();
      b.textContent = '⏹';
      b.classList.add('recording');
      setTimeout(() => recorder?.state === 'recording' && recorder.stop(), 8000);
    } catch {
      recorder = null;
      alert("Le micro n'est pas accessible. Autorisez le micro pour ce site dans les réglages de la tablette.");
    }
  }
});
$('#voice-list').addEventListener('change', async (e) => {
  const input = e.target.closest('input[type=file]');
  if (!input?.files?.[0]) return;
  const key = input.closest('.vcell').dataset.key;
  await putRec(key, input.files[0]);
  renderVoices();
});

const AVATARS = ['👦', '👧', '🧒', '👦🏽', '👧🏽', '👦🏻', '👧🏻', '🦁', '🦊', '⚽', '🏀'];
function renderSettings() {
  $('#set-gm').value = settings.gm;
  $('#set-dialects').value = settings.dialects.join(',');
  $('#set-arabic').checked = settings.arabic;
  $('#set-music').checked = settings.sfx;
  $('#set-limit').value = String(settings.limit);
  $('#set-kids').innerHTML = settings.kids.map((k, i) => `
    <div class="kid-set" data-i="${i}">
      <select data-f="avatar">${AVATARS.map((a) => `<option ${a === k.avatar ? 'selected' : ''}>${a}</option>`).join('')}</select>
      <input data-f="name" value="${esc(k.name)}" maxlength="16">
      <label class="check"><input type="checkbox" data-f="older" ${k.older ? 'checked' : ''}> sait lire (6 ans et +)</label>
    </div>`).join('');
  const v = { fr: voiceFor('fr'), ar: voiceFor('ar') };
  $('#voice-info').textContent = `Voix temporaires de cette tablette — français : ${v.fr ? v.fr.name : 'aucune'} ; arabe : ${v.ar ? v.ar.name + ' (arabe standard, pas de darija)' : 'aucune (les mots sont lus en français, très approximatif)'}. Vos enregistrements remplacent toujours ces voix.`;
}
$('#tab-settings').addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'set-gm') settings.gm = t.value.trim() || 'Hbibiti';
  if (t.id === 'set-dialects') settings.dialects = t.value.split(',');
  if (t.id === 'set-arabic') settings.arabic = t.checked;
  if (t.id === 'set-music') settings.sfx = t.checked;
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
    const t = load('t-' + k.id, {});
    if (t.date === today()) { t.bonus = (t.bonus || 0) + 10 * 60000; save('t-' + k.id, t); }
  }
  alert('10 minutes de plus pour aujourd’hui.');
});
$('#set-testvoice').addEventListener('click', () => say('Salam ! Voici la voix temporaire.', { word: WORDS[0], d: 'ma' }));

function renderProgress() {
  $('#progress-list').innerHTML = settings.kids.map((k) => {
    const p = progressOf(k);
    const ws = WORDS.filter((w) => k.older || !w.older);
    const hard = ws.filter((w) => (p.words[w.id]?.wrong || 0) > (p.words[w.id]?.right || 0));
    return `<div class="pkid">
      <h3>${esc(k.avatar)} ${esc(k.name)} — ${p.levels} niveau(x), ⭐ ${p.stars}, ${p.stickers} autocollant(s)</h3>
      <p>Mots bien sus : ${ws.filter((w) => (p.words[w.id]?.box || 0) >= 2).length} / ${ws.length}${hard.length ? ` · À revoir : ${hard.map((w) => esc(w.fr)).join(', ')}` : ''}</p>
      <div class="pwords">${ws.map((w) => {
        const s = p.words[w.id];
        const box = s?.box || 0;
        return `<span class="pw ${s?.seen ? '' : 'unseen'}" title="${esc(w.fr)}">${w.emoji}<i>${'●'.repeat(box)}${'○'.repeat(4 - box)}</i></span>`;
      }).join('')}</div>
    </div>`;
  }).join('');
}
$('#set-reset').addEventListener('click', () => {
  if (!confirm('Effacer tous les progrès des enfants ? (Vos enregistrements de voix sont gardés.)')) return;
  for (const k of settings.kids) { save('p-' + k.id, newProgress()); save('t-' + k.id, {}); }
  if (kid) progress = progressOf(kid);
  renderProgress();
});

// ---------- Démarrage ----------
openHome();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
