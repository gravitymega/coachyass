// Mode direct (tablette au bord du terrain) : stats par numéro en deux touches, score et chrono,
// caméra et enregistrement facultatifs, commentateur IA à voix haute (fonction coach, mode « live »).
// Le match en cours est gardé dans le navigateur : un rechargement de la page ne perd rien.
import { $, showError } from './common.js';
import { EVENT_TYPES, TYPE_KEYS, boxScore, playerStatsRow, fmtClock, pct } from './stats-core.js';
import { FREE_VOICES, DEFAULT_FREE_VOICE } from './piper-core.js';
import { synthFree } from './piper.js';
import { canvasJpeg } from './detect.js';
import { accessToken, rest, fillTeams, loadRoster, sessionEmail } from './supa.js';

const SAVE_KEY = 'artcraft-direct-match';
const PASS_KEY = 'artcraft-voice-password';
const DEVICE_VOICE = 'device';
// Actions qui déclenchent tout de suite un commentaire.
const BIG = ['panier_2', 'panier_3', 'interception', 'contre'];

let match = null;      // { teamId, team, opponent, date, periodMin, numbers, roster, events, startedAt, clock }
let selected = null;   // numéro choisi, ou 'adv'
let clockTimer = null;
let recorder = null, recChunks = [], recStart = 0, recBlobUrl = '';
let stream = null;
let aiTimer = null, speaking = false, lastSaid = [];
let password = '';

try { password = localStorage.getItem(PASS_KEY) || ''; } catch { /* stockage indisponible */ }
$('password').value = password;
$('game-date').value = new Date().toISOString().slice(0, 10);
FREE_VOICES.forEach(v => $('voice').appendChild(new Option(v.name, v.id)));
$('voice').appendChild(new Option('Voix de l\'appareil (instantanée)', DEVICE_VOICE));
$('voice').value = DEFAULT_FREE_VOICE;

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(match)); } catch { /* stockage plein ou indisponible */ }
}
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; }
}
if (loadSaved()) $('btn-resume').hidden = false;

const numbersOf = s => [...new Set((String(s).match(/\d{1,2}/g) || []).map(Number))].sort((a, b) => a - b);
let roster = [];

fillTeams($('team')).catch(() => { /* hors ligne : numéros tapés à la main */ });
$('team').addEventListener('change', async () => {
  roster = [];
  if (!$('team').value) return;
  try {
    roster = await loadRoster($('team').value);
    const nums = roster.filter(p => p.numero != null).map(p => p.numero);
    if (nums.length) $('numbers').value = nums.join(', ');
  } catch { /* effectif indisponible */ }
});

// ---------- Début / reprise ----------
$('btn-start').addEventListener('click', async () => {
  showError('');
  const numbers = numbersOf($('numbers').value);
  if (!numbers.length) { showError('Indique au moins un numéro de joueur.'); return; }
  match = {
    format: 'artcraft-direct-1',
    teamId: $('team').value || null,
    team: $('team').value ? $('team').selectedOptions[0].text.split(' · ')[0] : 'Nous',
    opponent: $('opponent').value.trim() || 'Adversaire',
    date: $('game-date').value,
    periodMin: +$('period-min').value,
    numbers,
    roster: roster.map(p => ({ id: p.id, full_name: p.full_name, numero: p.numero })),
    events: [],
    startedAt: Date.now(),
    clock: { period: 'Q1', left: +$('period-min').value * 60, running: false },
  };
  save();
  await startLive();
});
$('btn-resume').addEventListener('click', async () => {
  match = loadSaved();
  if (!match) return;
  match.clock.running = false;
  await startLive();
});

async function startLive() {
  $('step-setup').hidden = true;
  $('step-live').hidden = false;
  $('name-us').textContent = match.team;
  $('name-them').textContent = match.opponent;
  renderPlayers();
  renderActions();
  renderAll();
  if ($('cam-on').checked || $('rec-on').checked) await startCamera();
  if ($('ai-on').checked) await startAI();
}

// Temps du match en secondes depuis le début de l'enregistrement (ou de la page) : sert à caler les clips.
const now = () => (recorder ? (performance.now() - recStart) / 1000 : (Date.now() - match.startedAt) / 1000);

// ---------- Boutons ----------
function renderPlayers() {
  const byNum = new Map(match.roster.map(p => [p.numero, p]));
  $('players').innerHTML = match.numbers.map(n => {
    const p = byNum.get(n);
    return `<button type="button" data-n="${n}">#${n}${p ? `<small>${p.full_name.split(' ')[0]}</small>` : ''}</button>`;
  }).join('') + '<button type="button" data-n="?">?<small>numéro inconnu</small></button><button type="button" data-n="adv">ADV<small>adversaire</small></button>';
}
function renderActions() {
  $('actions').innerHTML = TYPE_KEYS.map(k => {
    const d = EVENT_TYPES[k];
    const cls = d.shot ? (d.made ? 'made' : 'miss') : '';
    return `<button type="button" class="${cls}" data-type="${k}">${d.short}<small>${d.label}</small></button>`;
  }).join('');
}
$('players').addEventListener('click', e => {
  const b = e.target.closest('button[data-n]');
  if (!b) return;
  selected = selected === b.dataset.n ? null : b.dataset.n;
  [...$('players').children].forEach(x => x.classList.toggle('on', x.dataset.n === selected));
  $('who').textContent = selected == null ? '' : selected === 'adv' ? '→ adversaire' : selected === '?' ? '→ numéro inconnu' : `→ #${selected}`;
});
$('actions').addEventListener('click', e => {
  const b = e.target.closest('button[data-type]');
  if (!b) return;
  if (selected == null) { flash('Touche d\'abord un numéro (ou ADV).'); return; }
  const ev = {
    id: (match.events.at(-1)?.id || 0) + 1,
    t: Math.round(now() * 10) / 10,
    type: b.dataset.type,
    equipe: selected === 'adv' ? 'adversaire' : 'nous',
    numero: selected === 'adv' || selected === '?' ? null : +selected,
    period: match.clock.period,
    clock: fmtClock(match.clock.left),
  };
  match.events.push(ev);
  selected = null;
  [...$('players').children].forEach(x => x.classList.remove('on'));
  $('who').textContent = '';
  save();
  renderAll();
  if (navigator.vibrate) navigator.vibrate(30);
  if (aiTimer !== null && BIG.includes(ev.type)) comment('action');
});
$('btn-undo').addEventListener('click', () => {
  if (!match.events.length) return;
  match.events.pop();
  save();
  renderAll();
});
function flash(msg) {
  $('who').textContent = msg;
  setTimeout(() => { if ($('who').textContent === msg) $('who').textContent = ''; }, 1800);
}

const describe = ev => `${EVENT_TYPES[ev.type].label} — ${ev.equipe === 'adversaire' ? match.opponent : ev.numero != null ? '#' + ev.numero : match.team}`;

function renderAll() {
  const box = boxScore(match.events, match.numbers.map(n => match.roster.find(p => p.numero === n) || { numero: n }));
  $('pts-us').textContent = box.score.nous;
  $('pts-them').textContent = box.score.adversaire;
  $('period').value = match.clock.period;
  $('clock').textContent = fmtClock(match.clock.left);
  const items = match.events.slice(-30).reverse().map(ev => `<li>${ev.period} ${ev.clock} · ${describe(ev)}</li>`);
  $('feed').innerHTML = lastSaid.slice(-3).reverse().map(s => `<li class="ai">🎙 ${s.replace(/</g, '&lt;')}</li>`).join('') + items.join('');
  return box;
}

// ---------- Chrono ----------
$('btn-clock').addEventListener('click', () => {
  match.clock.running = !match.clock.running;
  $('btn-clock').textContent = match.clock.running ? '⏸ Chrono' : '▶ Chrono';
  clearInterval(clockTimer);
  if (match.clock.running) {
    clockTimer = setInterval(() => {
      match.clock.left = Math.max(0, match.clock.left - 1);
      $('clock').textContent = fmtClock(match.clock.left);
      if (!match.clock.left) { match.clock.running = false; clearInterval(clockTimer); $('btn-clock').textContent = '▶ Chrono'; }
      if (match.clock.left % 10 === 0) save();
    }, 1000);
  }
});
$('period').addEventListener('change', () => {
  match.clock.period = $('period').value;
  match.clock.left = (match.clock.period === 'Prol.' ? 5 : match.periodMin) * 60;
  save();
  renderAll();
});

// ---------- Caméra et enregistrement ----------
async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: $('rec-on').checked });
    const v = $('live-cam');
    v.srcObject = stream;
    v.hidden = false;
    await v.play().catch(() => {});
    if ($('rec-on').checked) {
      const type = ['video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
      recorder = new MediaRecorder(stream, { mimeType: type || undefined, videoBitsPerSecond: 2_000_000 });
      recChunks = [];
      recorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
      recorder.start(10_000);
      // Les actions notées à partir de maintenant sont datées depuis le début de l'enregistrement.
      recStart = performance.now();
      $('rec-status').textContent = '● Enregistrement en cours';
    }
  } catch (err) {
    showError('Caméra indisponible : ' + (err.message || err) + ' (les stats marchent sans caméra).');
  }
}

function stopCamera() {
  return new Promise(resolve => {
    if (!recorder || recorder.state === 'inactive') { resolve(null); return; }
    recorder.onstop = () => resolve(new Blob(recChunks, { type: recorder.mimeType || 'video/webm' }));
    recorder.stop();
  }).then(blob => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    $('rec-status').textContent = '';
    return blob;
  });
}

function camFrame() {
  const v = $('live-cam');
  if (!stream || !v.videoWidth) return null;
  const c = document.createElement('canvas');
  const scale = Math.min(1, 640 / v.videoWidth);
  c.width = Math.round(v.videoWidth * scale);
  c.height = Math.round(v.videoHeight * scale);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  return canvasJpeg(c, 0.7);
}

// ---------- Commentateur IA ----------
async function startAI() {
  password = $('password').value;
  const res = await fetch('/.netlify/functions/coach', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-art-password': password }, body: JSON.stringify({ ping: true }),
  }).catch(() => null);
  if (!res || !res.ok) { showError(res && res.status === 401 ? 'Mot de passe Art craft incorrect : commentateur désactivé.' : 'Serveur injoignable : commentateur désactivé.'); return; }
  try { localStorage.setItem(PASS_KEY, password); } catch { /* stockage indisponible */ }
  $('btn-say').hidden = false;
  const every = +$('ai-every').value;
  aiTimer = every ? setInterval(() => comment('rythme'), every * 1000) : 0;
  comment('debut');
}
$('btn-say').addEventListener('click', () => comment('demande'));

// Une seule phrase à la fois : une grosse action pendant que la voix parle est commentée juste après.
let pending = false, queued = null;
async function comment(reason) {
  if (pending || speaking) {
    if (reason === 'action' || reason === 'demande') queued = reason;
    return;
  }
  pending = true;
  try {
    const box = boxScore(match.events, []);
    const frame = await camFrame();
    const facts = {
      raison: reason,
      equipes: { nous: match.team, adversaire: match.opponent },
      score: box.score,
      periode: match.clock.period,
      temps_restant: fmtClock(match.clock.left),
      dernieres_actions: match.events.slice(-6).map(describe),
      phrases_precedentes: lastSaid.slice(-4),
    };
    const res = await fetch('/.netlify/functions/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-art-password': password },
      body: JSON.stringify({ mode: 'live', facts, frames: frame ? [{ t: now(), data: frame }] : [] }),
    });
    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    let text = '', err = '';
    for (const line of (await res.text()).split('\n')) {
      if (!line.trim()) continue;
      const m = JSON.parse(line);
      if (m.d) text += m.d;
      if (m.error) err = m.error;
    }
    if (err) throw new Error(err);
    const phrase = String(JSON.parse(text).phrase || '').trim();
    if (!phrase) return;
    lastSaid.push(phrase);
    lastSaid = lastSaid.slice(-8);
    renderAll();
    await speak(phrase);
  } catch (e) {
    console.warn('commentateur', e);
  } finally {
    pending = false;
    if (queued && aiTimer !== null) {
      const next = queued;
      queued = null;
      setTimeout(() => comment(next), 300);
    }
  }
}

let audioCtx = null;
async function speak(text) {
  speaking = true;
  try {
    if ($('voice').value === DEVICE_VOICE || !window.WebAssembly) {
      await new Promise(resolve => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'fr-CA';
        u.rate = 1.08;
        u.onend = resolve;
        u.onerror = resolve;
        speechSynthesis.speak(u);
      });
      return;
    }
    const { pcm, rate } = await synthFree(text, $('voice').value, { speed: 1.1 });
    audioCtx = audioCtx || new AudioContext();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    const buf = audioCtx.createBuffer(1, pcm.length, rate);
    buf.copyToChannel(pcm, 0);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    await new Promise(resolve => { src.onended = resolve; src.start(); });
  } finally {
    speaking = false;
  }
}

// ---------- Fin du match ----------
$('btn-end').addEventListener('click', async () => {
  if (!confirm('Terminer le match ? (tu pourras encore corriger dans Stats auto)')) return;
  clearInterval(aiTimer);
  aiTimer = null;
  clearInterval(clockTimer);
  match.clock.running = false;
  const blob = await stopCamera();
  save();
  $('step-live').hidden = true;
  $('step-end').hidden = false;
  if (blob) {
    if (recBlobUrl) URL.revokeObjectURL(recBlobUrl);
    recBlobUrl = URL.createObjectURL(blob);
    const a = $('btn-video');
    a.href = recBlobUrl;
    a.download = `match-${match.date}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
    a.hidden = false;
  }
  const json = new Blob([JSON.stringify(match, null, 1)], { type: 'application/json' });
  $('btn-json').href = URL.createObjectURL(json);
  $('btn-json').download = `stats-direct-${match.date}.json`;
  renderEndBox();
});

function renderEndBox() {
  const box = boxScore(match.events, match.numbers.map(n => match.roster.find(p => p.numero === n) || { numero: n }));
  const line = (label, r) => `<tr><td>${label}</td><td><b>${r.pts}</b></td><td>${pct(r.fg2m, r.fg2a)}</td><td>${pct(r.fg3m, r.fg3a)}</td><td>${pct(r.ftm, r.fta)}</td><td>${r.oreb + r.dreb}</td><td>${r.ast}</td><td>${r.stl}</td><td>${r.blk}</td><td>${r.tov}</td><td>${r.pf}</td></tr>`;
  $('box').innerHTML = '<thead><tr><th>Joueur</th><th>Pts</th><th>Tirs 2</th><th>Tirs 3</th><th>LF</th><th>Reb</th><th>Passes</th><th>Interc.</th><th>Contres</th><th>Pertes</th><th>Fautes</th></tr></thead><tbody>' +
    box.rows.map(r => line(`#${r.numero} ${r.player && r.player.full_name ? r.player.full_name : ''}`, r)).join('') +
    line('<b>Équipe</b>', box.team) + line(match.opponent, box.opp) + '</tbody>';
  return box;
}

$('btn-send').addEventListener('click', async () => {
  showError('');
  try {
    const box = renderEndBox();
    const rows = box.rows.filter(r => r.events && r.player && r.player.id);
    if (!rows.length) throw new Error('aucun joueur relié à une fiche (choisis l\'équipe avant le match, et ajoute les numéros dans le Dashboard).');
    const token = await accessToken('sb');
    await rest('player_stats', {
      method: 'POST', token, prefer: 'return=minimal',
      body: rows.map(r => playerStatsRow(r, { playerId: r.player.id, gameDate: match.date, notes: `vs ${match.opponent} (Mode direct)` })),
    });
    $('send-status').textContent = `Stats envoyées pour ${rows.length} joueur${rows.length > 1 ? 's' : ''} (${sessionEmail()}). Pour les clips et les devoirs : Stats auto → importer le .json avec la vidéo.`;
  } catch (err) {
    showError('Envoi impossible : ' + (err.message || err));
  }
});

$('btn-new').addEventListener('click', () => {
  if (!confirm('Effacer ce match de la tablette ? (exporte le .json avant si besoin)')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* stockage indisponible */ }
  location.reload();
});
