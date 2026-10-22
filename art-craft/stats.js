// Module « Stats auto » : détection des joueurs (MediaPipe, dans le navigateur), lecture des
// numéros et des actions par l'IA (fonction coach, mode « stats »), vérification par le coach,
// puis envoi dans l'Espace Joueurs : stats du match, clips privés et devoirs personnalisés.
import {
  $, showError, setProgress, parseLogDuration, parseLogTime, getFFmpeg, mountFiles, runWithLog,
} from './common.js';
import { createStreamReader } from './analyse-core.js';
import { energyEnvelope, excitementScore, findPeaks, WINDOW_S, parseTimestamp } from './highlights.js';
import {
  EVENT_TYPES, TYPE_KEYS, CLIP_TYPES, statsWindows, windowTimes, estimateCost, normalizeEvents, mergeEvents,
  boxScore, playerStatsRow, clipWindow, clipPlayers, kmeans2, hex, pickCrops, syncEvents, parseLive, fmtClock, pct,
} from './stats-core.js';
import { loadDetector, detectPlayers, jerseyColor, cropJpeg, scaledJpeg, detectorDevice } from './detect.js';
import { SITE, accessToken, rest, uploadFile, fillTeams, loadRoster, loadGames, sessionEmail, logout } from './supa.js';

const STORE_KEY = 'artcraft-voice-password'; // même mot de passe que les autres modules IA
const MOUNT = '/st';
const AUDIO_RATE = 8000;
const AUDIO_CHUNK_S = 600;
const EVERY = 1.25; // une image toutes les 1,25 s dans chaque fenêtre
const MAX_IMG = 12;
const CROPS = 8;
const state = {
  password: '', file: null, input: '', duration: 0, hasAudio: false, busy: false,
  team: null, roster: [], games: [], events: [], nextId: 1, devoirs: new Map(), live: null,
};

// ---------- Accès (mot de passe Art craft, comme l'Analyse tactique) ----------
async function post(payload) {
  return fetch('/.netlify/functions/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-art-password': state.password },
    body: JSON.stringify(payload),
  });
}
async function errorOf(res) {
  let msg = `Erreur ${res.status}`;
  try { msg = (await res.json()).error || msg; } catch { /* réponse non JSON */ }
  if (res.status === 404) msg = 'Fonction introuvable : le site doit être déployé sur Netlify.';
  return msg;
}
async function askCoach(payload, normalize) {
  const res = await post(payload);
  if (!res.ok) throw new Error(await errorOf(res));
  const reader = createStreamReader(normalize);
  const decoder = new TextDecoder();
  const stream = res.body.getReader();
  for (;;) {
    const { value, done } = await stream.read();
    if (done) break;
    reader.feed(decoder.decode(value, { stream: true }));
  }
  reader.feed(decoder.decode());
  return reader.finish();
}

try { state.password = localStorage.getItem(STORE_KEY) || ''; } catch { /* stockage indisponible */ }
if (state.password) $('password').value = state.password;

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  state.password = $('password').value;
  showError('');
  const res = await post({ ping: true }).catch(() => null);
  if (!res) { showError('Serveur injoignable : vérifie ta connexion.'); return; }
  if (res.status === 401) { showError('Mot de passe incorrect.'); return; }
  if (!res.ok) { showError(await errorOf(res)); return; }
  try { localStorage.setItem(STORE_KEY, state.password); } catch { /* stockage indisponible */ }
  if (!(await res.json()).ai) showError('ANTHROPIC_API_KEY manquant dans les variables Netlify du site art-craft : la lecture des numéros ne marchera pas.');
  $('step-login').hidden = true;
  $('step-game').hidden = false;
  initTeams();
});

// ---------- 1. Le match ----------
$('game-date').value = new Date().toISOString().slice(0, 10);

async function initTeams() {
  try {
    await fillTeams($('team'));
  } catch (err) {
    $('roster-info').textContent = 'Équipes introuvables (' + err.message + ') : tape les numéros à la main.';
  }
}

const numbers = () => [...new Set(($('numbers').value.match(/\d{1,2}/g) || []).map(Number))].sort((a, b) => a - b);

$('team').addEventListener('change', async () => {
  const id = $('team').value;
  state.team = id || null;
  state.roster = [];
  state.games = [];
  if (!id) { $('roster-info').textContent = ''; return; }
  try {
    const token = sessionEmail() ? await accessToken('sb').catch(() => null) : null;
    state.roster = await loadRoster(id, token);
    if (token) state.games = await loadGames(id, token).catch(() => []);
  } catch (err) {
    $('roster-info').textContent = 'Effectif introuvable : ' + err.message;
    return;
  }
  const withNum = state.roster.filter(p => p.numero != null);
  if (withNum.length) $('numbers').value = withNum.map(p => p.numero).join(', ');
  const noNum = state.roster.filter(p => p.numero == null);
  $('roster-info').textContent = `${state.roster.length} joueur${state.roster.length > 1 ? 's' : ''} dans l'effectif` +
    (withNum.length ? ` · numéros : ${withNum.map(p => '#' + p.numero).join(' ')}` : '') +
    (noNum.length ? ` · sans numéro (à ajouter dans le Dashboard pour recevoir stats et clips) : ${noNum.map(p => p.full_name).join(', ')}` : '');
  const game = state.games.find(g => g.date_match === $('game-date').value);
  if (game && game.adversaire && !$('opponent').value) $('opponent').value = game.adversaire;
  refresh();
});

const video = $('video');
$('file').addEventListener('change', e => selectFile(e.target.files[0]));
$('drop').addEventListener('dragover', e => { e.preventDefault(); $('drop').classList.add('over'); });
$('drop').addEventListener('dragleave', () => $('drop').classList.remove('over'));
$('drop').addEventListener('drop', e => { e.preventDefault(); $('drop').classList.remove('over'); selectFile(e.dataTransfer.files[0]); });

function selectFile(file) {
  if (!file || state.busy) return;
  state.file = file;
  state.duration = 0;
  state.input = '';
  if (video.src) URL.revokeObjectURL(video.src);
  video.src = URL.createObjectURL(file);
  $('player-wrap').hidden = false;
  $('file-info').textContent = `${file.name} · ${(file.size / 1e6).toFixed(0)} Mo`;
  updateCost();
}
video.addEventListener('loadedmetadata', () => {
  if (Number.isFinite(video.duration)) {
    state.duration = video.duration;
    $('file-info').textContent = `${state.file.name} · ${(state.file.size / 1e6).toFixed(0)} Mo · ${fmtClock(video.duration)}`;
    updateCost();
  }
});

async function mountInput(ff) {
  [state.input] = await mountFiles(ff, MOUNT, [state.file]);
  let audio = false;
  await runWithLog(ff, ['-i', state.input], line => {
    const d = parseLogDuration(line);
    if (d && !state.duration) state.duration = d;
    if (/Stream #.*Audio:/.test(line)) audio = true;
  });
  state.hasAudio = audio;
  updateCost();
}

const mode = () => document.querySelector('input[name=mode]:checked').value;
function range() {
  const a = parseTimestamp($('range-start').value) || 0;
  const b = parseTimestamp($('range-end').value);
  return { from: a, to: b && b > a ? Math.min(b, state.duration || b) : state.duration };
}
function updateCost() {
  $('max-wrap').hidden = mode() !== 'peaks';
  if (!state.duration) { $('cost').textContent = ''; return; }
  const { from, to } = range();
  const n = mode() === 'full' ? Math.ceil((to - from) / 15) : +$('max').value;
  const wins = Array.from({ length: n }, (_, i) => ({ start: i * 15, end: i * 15 + 10 }));
  const usd = estimateCost(wins, { every: EVERY, max: MAX_IMG, crops: CROPS });
  $('cost').textContent = `Environ ${n} portions à faire lire par l'IA · coût estimé ~${usd.toFixed(2)} $ US de crédits Anthropic.`;
}
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', updateCost));
['max', 'range-start', 'range-end'].forEach(id => $(id).addEventListener('change', updateCost));

// Image de la vidéo en pleine résolution (au plus 1920 px), extraite par ffmpeg en BMP :
// sans perte (les numéros restent nets) ; l'encodeur JPEG de ffmpeg.wasm bloque sur
// certaines vidéos en qualité élevée. Délai de sécurité : une image illisible est sautée.
async function grabBitmap(ff, t) {
  const code = await ff.exec(['-ss', t.toFixed(2), '-i', state.input, '-frames:v', '1', '-vf', "scale='min(1920,iw)':-2", '/f.bmp'], 30000);
  if (code !== 0) return null;
  const data = await ff.readFile('/f.bmp');
  await ff.deleteFile('/f.bmp');
  return createImageBitmap(new Blob([data], { type: 'image/bmp' }));
}

// Test de la détection sur l'image affichée (boîtes dessinées par-dessus la vidéo).
$('btn-detect').addEventListener('click', async () => {
  if (state.busy || !state.file) return;
  state.busy = true;
  showError('');
  $('detect-info').textContent = 'Chargement du détecteur de joueurs (une seule fois)…';
  try {
    const ff = await getFFmpeg('run-progress');
    await mountInput(ff);
    await loadDetector();
    const img = await grabBitmap(ff, video.currentTime || 0);
    if (!img) throw new Error('image illisible');
    const boxes = await detectPlayers(img);
    const c = $('det-canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const colors = boxes.map(b => jerseyColor(ctx, b, img.width, img.height));
    const { labels } = kmeans2(colors);
    ctx.lineWidth = Math.max(2, img.width / 400);
    boxes.forEach((b, i) => {
      ctx.strokeStyle = labels[i] ? '#e8672e' : '#3ec8ff';
      ctx.strokeRect(b.x * img.width, b.y * img.height, b.w * img.width, b.h * img.height);
    });
    c.hidden = false;
    $('detect-info').textContent = `${boxes.length} joueur${boxes.length > 1 ? 's' : ''} détecté${boxes.length > 1 ? 's' : ''} (calcul sur la ${detectorDevice}) · couleurs = les deux équipes d'après les maillots. Clique sur l'image pour revenir à la vidéo.`;
  } catch (err) {
    console.error(err);
    $('detect-info').textContent = '';
    showError('Détection impossible : ' + (err.message || err));
  } finally {
    state.busy = false;
  }
});
$('det-canvas').addEventListener('click', () => { $('det-canvas').hidden = true; });

// ---------- Recherche des actions ----------
async function soundPeaks(ff, from, to) {
  const envs = [];
  let heard = 0;
  for (let start = from; start < to; start += AUDIO_CHUNK_S) {
    const len = Math.min(AUDIO_CHUNK_S, to - start);
    const code = await runWithLog(ff, ['-ss', String(start), '-t', String(len), '-i', state.input,
      '-map', '0:a:0', '-vn', '-ac', '1', '-ar', String(AUDIO_RATE), '-f', 's16le', '/a.raw'], line => {
      const t = parseLogTime(line);
      if (t != null) setProgress('run-progress', (start - from + t) / (to - from) * 0.15, `Écoute du match… ${fmtClock(start + t)}`);
    });
    if (code !== 0) break;
    const raw = await ff.readFile('/a.raw');
    await ff.deleteFile('/a.raw');
    const samples = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 2));
    envs.push(energyEnvelope(samples, AUDIO_RATE));
    heard += samples.length / AUDIO_RATE;
    if (samples.length < (len - 1) * AUDIO_RATE) break;
  }
  if (heard < 5) return [];
  const env = new Float32Array(envs.reduce((n, e) => n + e.length, 0));
  envs.reduce((off, e) => { env.set(e, off); return off + e.length; }, 0);
  return findPeaks(excitementScore(env), WINDOW_S, { maxCount: 80 }).map(p => ({ t: from + p.t, score: p.score }));
}

// Une portion : images d'ensemble + vignettes des joueurs (numéros), envoyées à l'IA.
async function readWindow(ff, win, nums) {
  const times = windowTimes(win, { every: EVERY, max: MAX_IMG });
  const frames = [];
  const dets = [];
  const bitmaps = [];
  for (let i = 0; i < times.length; i++) {
    const img = await grabBitmap(ff, times[i]);
    if (!img) continue;
    frames.push({ t: times[i], data: await scaledJpeg(img, 960) });
    // Détection sur une image sur deux (les joueurs bougent peu en 2,5 s) : vignettes pour lire les numéros.
    if (i % 2 === 1 || i === times.length - 1) {
      const boxes = await detectPlayers(img).catch(() => []);
      const c = new OffscreenCanvas(img.width, img.height);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      boxes.forEach(b => dets.push({ ...b, frame: bitmaps.length, t: times[i], color: jerseyColor(ctx, b, img.width, img.height) }));
      bitmaps.push(img);
    } else {
      img.close();
    }
  }
  if (frames.length < 2) return [];
  const { labels, centers } = kmeans2(dets.map(d => d.color));
  dets.forEach((d, i) => { d.team = labels[i]; });
  const crops = [];
  for (const d of pickCrops(dets, CROPS, bitmaps[0] ? bitmaps[0].width / bitmaps[0].height : 16 / 9)) {
    crops.push({
      t: d.t,
      label: `joueur ${crops.length + 1}, maillot ${hex(d.color)} (groupe de couleur ${d.team === 0 ? 'A ' + hex(centers[0]) : 'B ' + hex(centers[1])})`,
      data: await cropJpeg(bitmaps[d.frame], d),
    });
  }
  bitmaps.forEach(b => b.close());
  const raw = await askCoach({
    mode: 'stats', frames, crops, start: win.start, dur: win.end - win.start,
    team: [$('team').selectedOptions[0]?.value ? $('team').selectedOptions[0].text : 'notre équipe', $('jersey').value && `maillots ${$('jersey').value}`].filter(Boolean).join(', '),
    roster: nums.length ? nums : undefined,
    context: $('context').value,
  }, o => o);
  return normalizeEvents(raw, win, nums);
}

$('btn-run').addEventListener('click', run);
async function run() {
  if (state.busy || !state.file) return;
  state.busy = true;
  $('btn-run').disabled = true;
  showError('');
  try {
    const ff = await getFFmpeg('run-progress');
    await mountInput(ff);
    setProgress('run-progress', 0, 'Chargement du détecteur de joueurs (une seule fois)…');
    await loadDetector();
    const { from, to } = range();
    let windows;
    if (mode() === 'full') {
      windows = statsWindows({ duration: to - from, mode: 'full' }).map(w => ({ start: w.start + from, end: w.end + from }));
    } else {
      if (!state.hasAudio) throw new Error('pas de son dans cette vidéo : choisis « Toute la vidéo ».');
      const peaks = (await soundPeaks(ff, from, to)).filter(p => p.t >= from && p.t <= to);
      windows = statsWindows({ duration: state.duration, mode: 'peaks', peaks, max: +$('max').value });
    }
    if (!windows.length) throw new Error('aucun moment fort trouvé : choisis « Toute la vidéo ».');
    const nums = numbers();
    const found = [];
    let failed = 0;
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      setProgress('run-progress', 0.15 + 0.85 * i / windows.length,
        `Lecture des actions · portion ${i + 1} / ${windows.length} (${fmtClock(w.start)}) · ${found.length} action${found.length > 1 ? 's' : ''}`);
      try {
        found.push(...await readWindow(ff, w, nums));
      } catch (err) {
        console.warn('portion', w, err);
        failed++;
        if (/Mot de passe|ANTHROPIC|refusée/.test(err.message)) throw err;
      }
    }
    setEvents([...state.events.filter(e => e.manual), ...found]);
    setProgress('run-progress', 1, `${state.events.length} actions trouvées sur ${windows.length} portions` + (failed ? ` (${failed} portion${failed > 1 ? 's' : ''} illisible${failed > 1 ? 's' : ''})` : '') + ' : vérifie-les ci-dessous.');
  } catch (err) {
    console.error(err);
    showError('Recherche impossible : ' + (err.message || err));
  } finally {
    state.busy = false;
    $('btn-run').disabled = false;
  }
}

// ---------- Import du Mode direct ----------
$('btn-import').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async e => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try {
    const live = parseLive(await f.text());
    state.live = live;
    if (live.teamId && [...$('team').options].some(o => o.value === live.teamId) && $('team').value !== live.teamId) {
      $('team').value = live.teamId;
      $('team').dispatchEvent(new Event('change'));
    }
    if (live.opponent) $('opponent').value = live.opponent;
    if (live.date) $('game-date').value = live.date;
    setEvents(live.events.map(ev => ({ ...ev, manual: true })));
    const sel = $('sync-event');
    sel.innerHTML = '';
    state.events.forEach(ev => sel.appendChild(new Option(`${fmtClock(ev.t)} · ${EVENT_TYPES[ev.type].label}${ev.numero != null ? ' · #' + ev.numero : ''}`, ev.id)));
    $('step-sync').hidden = false;
  } catch (err) {
    showError('Import impossible : ' + err.message);
  }
});
$('btn-sync').addEventListener('click', () => {
  setEvents(syncEvents(state.events, +$('sync-event').value, video.currentTime || 0), { keepIds: true });
  $('step-sync').hidden = true;
});

// ---------- 2. Vérification ----------
function setEvents(list, { keepIds = false } = {}) {
  const merged = keepIds ? [...list].sort((a, b) => a.t - b.t) : mergeEvents(list);
  state.events = merged.map(e => ({ ...e, id: keepIds ? e.id : state.nextId++ }));
  $('step-review').hidden = false;
  $('step-send').hidden = false;
  refresh();
}

const playerOf = n => state.roster.find(p => p.numero === n) || null;
const doubtful = e => e.confiance === 'basse' || e.numero == null || (e.equipe === 'nous' && numbers().length && !numbers().includes(e.numero));

function typeOptions(sel) {
  return TYPE_KEYS.map(k => `<option value="${k}"${k === sel ? ' selected' : ''}>${EVENT_TYPES[k].label}</option>`).join('');
}
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderEvents() {
  const only = $('only-doubt').checked;
  const rows = state.events.filter(e => !only || doubtful(e));
  $('events').innerHTML = '<thead><tr><th>Moment</th><th>Action</th><th>Équipe</th><th>N°</th><th>Confiance</th><th>Détail</th><th></th></tr></thead><tbody>' +
    rows.map(e => `<tr data-id="${e.id}" class="${doubtful(e) ? 'doubt' : ''}">
      <td><button class="tool" data-act="seek">${fmtClock(e.t)}</button></td>
      <td><select data-f="type">${typeOptions(e.type)}</select></td>
      <td><select data-f="equipe"><option value="nous"${e.equipe === 'nous' ? ' selected' : ''}>Nous</option><option value="adversaire"${e.equipe === 'adversaire' ? ' selected' : ''}>Adversaire</option></select></td>
      <td><input data-f="numero" inputmode="numeric" size="3" value="${e.numero == null ? '' : e.numero}" placeholder="?"></td>
      <td>${e.manual ? 'noté à la main' : esc(e.confiance)}</td>
      <td class="det">${esc(e.detail)}</td>
      <td><button class="tool" data-act="del" title="Supprimer">✕</button></td>
    </tr>`).join('') + '</tbody>';
  if (!rows.length) $('events').innerHTML += '<tbody><tr><td colspan="7" class="muted">Aucune action.</td></tr></tbody>';
}

$('events').addEventListener('click', e => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = +btn.closest('tr').dataset.id;
  const ev = state.events.find(x => x.id === id);
  if (btn.dataset.act === 'seek') { $('det-canvas').hidden = true; video.currentTime = Math.max(0, ev.t - 5); video.play().catch(() => {}); }
  if (btn.dataset.act === 'del') { state.events = state.events.filter(x => x.id !== id); refresh(); }
});
$('events').addEventListener('change', e => {
  const f = e.target.dataset.f;
  if (!f) return;
  const ev = state.events.find(x => x.id === +e.target.closest('tr').dataset.id);
  if (f === 'numero') {
    const n = Number.parseInt(e.target.value, 10);
    ev.numero = Number.isFinite(n) ? n : null;
  } else ev[f] = e.target.value;
  ev.confiance = 'haute';
  refresh();
});
$('only-doubt').addEventListener('change', renderEvents);
$('btn-add').addEventListener('click', () => {
  state.events.push({ id: state.nextId++, t: Math.round((video.currentTime || 0) * 10) / 10, type: 'panier_2', equipe: 'nous', numero: null, confiance: 'haute', detail: '', manual: true });
  state.events.sort((a, b) => a.t - b.t);
  $('step-review').hidden = false;
  $('step-send').hidden = false;
  refresh();
});
$('numbers').addEventListener('change', refresh);

function renderBox() {
  const box = boxScore(state.events, state.roster.length ? state.roster : numbers().map(n => ({ numero: n })));
  $('score').textContent = `${$('team').value ? $('team').selectedOptions[0].text.split(' · ')[0] : 'Nous'} ${box.score.nous} – ${box.score.adversaire} ${$('opponent').value || 'Adversaire'} (points vus dans la vidéo)`;
  const line = (label, r) => `<tr><td>${label}</td><td><b>${r.pts}</b></td><td>${pct(r.fg2m, r.fg2a)}</td><td>${pct(r.fg3m, r.fg3a)}</td><td>${pct(r.ftm, r.fta)}</td><td>${r.oreb}</td><td>${r.dreb}</td><td>${r.ast}</td><td>${r.stl}</td><td>${r.blk}</td><td>${r.tov}</td><td>${r.pf}</td></tr>`;
  $('box').innerHTML = '<thead><tr><th>Joueur</th><th>Pts</th><th>Tirs 2</th><th>Tirs 3</th><th>LF</th><th>Reb O</th><th>Reb D</th><th>Passes</th><th>Interc.</th><th>Contres</th><th>Pertes</th><th>Fautes</th></tr></thead><tbody>' +
    box.rows.filter(r => r.events || r.player).map(r => line(`#${r.numero} ${esc(r.player ? r.player.full_name : '(pas de fiche)')}`, r)).join('') +
    (box.unknown.events ? line('Numéro inconnu', box.unknown) : '') +
    line('<b>Équipe</b>', box.team) + line(esc($('opponent').value || 'Adversaire'), box.opp) + '</tbody>';
  const csv = [['joueur', 'numero', 'pts', 'fg2m', 'fg2a', 'fg3m', 'fg3a', 'ftm', 'fta', 'oreb', 'dreb', 'ast', 'stl', 'blk', 'tov', 'pf'].join(',')]
    .concat(box.rows.filter(r => r.events).map(r => [`"${(r.player ? r.player.full_name : '').replace(/"/g, '""')}"`, r.numero, r.pts, r.fg2m, r.fg2a, r.fg3m, r.fg3a, r.ftm, r.fta, r.oreb, r.dreb, r.ast, r.stl, r.blk, r.tov, r.pf].join(',')));
  const a = $('btn-csv');
  if (a.href.startsWith('blob:')) URL.revokeObjectURL(a.href);
  a.href = URL.createObjectURL(new Blob(['﻿' + csv.join('\n')], { type: 'text/csv' }));
  a.download = `stats-${$('game-date').value || 'match'}.csv`;
  return box;
}

function renderSendList(box) {
  const rows = box.rows.filter(r => r.events);
  $('send-list').innerHTML = rows.map(r => {
    const p = r.player;
    const clips = state.events.filter(e => CLIP_TYPES.includes(e.type) && e.equipe === 'nous' && clipPlayers(e, state.events).includes(r.numero)).length;
    const status = !p ? '⚠ pas de fiche avec ce numéro : rien ne sera envoyé'
      : !p.auth_user_id ? '⚠ pas encore d\'accès Espace Joueurs (créer l\'accès dans le Dashboard) : envoyé quand même, visible dès que l\'accès existe'
        : 'Espace Joueurs actif';
    return `<li><span class="name">#${r.numero} ${esc(p ? p.full_name : '')} · ${r.pts} pts · ${clips} clip${clips > 1 ? 's' : ''}</span><small>${status}</small></li>`;
  }).join('') || '<li class="muted">Aucune action de notre équipe avec un numéro.</li>';
}

function refresh() {
  renderEvents();
  const box = renderBox();
  renderSendList(box);
  const s = sessionEmail();
  $('sb-account').textContent = s ? `Connecté au Dashboard : ${s}` : '';
}

// ---------- 3. Devoirs (IA) ----------
async function history(playerId, token) {
  return rest(`player_stats?select=game_date,points,rebounds,assists,steals,turnovers,fg2_made,fg2_att,fg3_made,fg3_att,ft_made,ft_att&player_id=eq.${playerId}&order=game_date.desc&limit=8`, { token }).catch(() => []);
}

const sendable = box => box.rows.filter(r => r.events && r.player);

$('btn-devoirs').addEventListener('click', async () => {
  if (state.busy) return;
  state.busy = true;
  showError('');
  try {
    const box = renderBox();
    const rows = sendable(box);
    if (!rows.length) throw new Error('aucun joueur avec une fiche (et son numéro) dans les actions.');
    const token = await accessToken('sb');
    $('devoirs').innerHTML = '';
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      setProgress('send-progress', i / rows.length, `Devoirs de #${r.numero} ${r.player.full_name}… ${i + 1} / ${rows.length}`);
      const player = {
        poste: r.player.poste, categorie_age: r.player.age_category,
        match: { date: $('game-date').value, adversaire: $('opponent').value },
        stats: { points: r.pts, tirs_2: `${r.fg2m}/${r.fg2a}`, tirs_3: `${r.fg3m}/${r.fg3a}`, lancers: `${r.ftm}/${r.fta}`, rebonds_off: r.oreb, rebonds_def: r.dreb, passes: r.ast, interceptions: r.stl, contres: r.blk, pertes: r.tov, fautes: r.pf },
        actions: state.events.filter(e => e.equipe === 'nous' && e.numero === r.numero).map(e => ({ moment: fmtClock(e.t), action: EVENT_TYPES[e.type].label, detail: e.detail })),
        matchs_precedents: await history(r.player.id, token),
      };
      try {
        const d = await askCoach({ mode: 'devoirs', player }, o => o);
        state.devoirs.set(r.player.id, d);
      } catch (err) {
        state.devoirs.delete(r.player.id);
        console.warn(err);
      }
      renderDevoirs(rows);
    }
    setProgress('send-progress', 1, 'Devoirs prêts : relis-les, enlève ceux qui ne conviennent pas, puis envoie.');
  } catch (err) {
    console.error(err);
    showError('Devoirs impossibles : ' + (err.message || err));
  } finally {
    state.busy = false;
  }
});

function renderDevoirs(rows) {
  $('devoirs').innerHTML = rows.filter(r => state.devoirs.has(r.player.id)).map(r => {
    const d = state.devoirs.get(r.player.id);
    return `<div class="devoir-card" data-player="${r.player.id}">
      <h3>#${r.numero} ${esc(r.player.full_name)}</h3>
      <p class="muted">✅ ${esc((d.points_forts || []).join(' · '))}<br>🎯 ${esc((d.points_faibles || []).join(' · '))}</p>
      <ul class="bin">${(d.devoirs || []).map((x, i) => `<li><span class="name"><b>${esc(x.titre)}</b> — ${esc(x.description)} <small>(${esc(x.repetitions)}, ${x.duree_min} min)</small></span><button class="tool" data-del="${i}">✕</button></li>`).join('')}</ul>
      <p>${esc(d.message || '')}</p>
    </div>`;
  }).join('');
}
$('devoirs').addEventListener('click', e => {
  const b = e.target.closest('button[data-del]');
  if (!b) return;
  const id = b.closest('[data-player]').dataset.player;
  state.devoirs.get(id).devoirs.splice(+b.dataset.del, 1);
  renderDevoirs(sendable(renderBox()));
});

// ---------- 3 bis. Envoi ----------
async function cutClip(ff, ev) {
  const { start, dur } = clipWindow(ev, state.duration || Infinity);
  const args = ['-ss', start.toFixed(2), '-t', dur.toFixed(2), '-i', state.input,
    '-map', '0:v:0', '-map', '0:a:0?', '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '/clip.mp4'];
  const code = await ff.exec(args);
  if (code !== 0) throw new Error('découpe du clip impossible');
  const data = await ff.readFile('/clip.mp4');
  await ff.deleteFile('/clip.mp4');
  return new Blob([data], { type: 'video/mp4' });
}

$('btn-send').addEventListener('click', async () => {
  if (state.busy) return;
  state.busy = true;
  $('btn-send').disabled = true;
  showError('');
  try {
    const box = renderBox();
    const rows = sendable(box);
    if (!rows.length) throw new Error('aucun joueur avec une fiche (et son numéro) dans les actions.');
    const token = await accessToken('sb');
    const date = $('game-date').value || new Date().toISOString().slice(0, 10);
    const opp = $('opponent').value.trim();
    const game = state.games.find(g => g.date_match === date) || null;
    const byNum = new Map(rows.map(r => [r.numero, r.player]));
    let done = 0;
    const steps = [];

    if ($('send-stats').checked) {
      setProgress('send-progress', 0, 'Envoi des stats…');
      await rest('player_stats', {
        method: 'POST', token, prefer: 'return=minimal',
        body: rows.map(r => playerStatsRow(r, { playerId: r.player.id, gameDate: date, gameId: game && game.id, notes: opp ? `vs ${opp} (Art craft)` : 'Art craft' })),
      });
      steps.push(`stats de ${rows.length} joueur${rows.length > 1 ? 's' : ''}`);
    }

    if ($('send-clips').checked) {
      const ff = await getFFmpeg('send-progress');
      await mountInput(ff);
      const clips = state.events.filter(e => e.equipe === 'nous' && CLIP_TYPES.includes(e.type))
        .map(e => ({ e, players: clipPlayers(e, state.events).map(n => byNum.get(n)).filter(Boolean) }))
        .filter(c => c.players.length);
      const folder = `${date}_${(state.team || 'equipe').slice(0, 8)}`;
      for (let i = 0; i < clips.length; i++) {
        const { e, players } = clips[i];
        setProgress('send-progress', i / clips.length, `Clips · ${i + 1} / ${clips.length} (${EVENT_TYPES[e.type].label}, ${fmtClock(e.t)})`);
        const blob = await cutClip(ff, e);
        const path = `${folder}/${Math.round(e.t * 10)}-${e.type}.mp4`;
        await uploadFile('player-clips', path, blob, token);
        await rest('player_clips', {
          method: 'POST', token, prefer: 'return=minimal',
          body: players.map(p => ({
            site: SITE, player_id: p.id, game_id: game && game.id, game_date: date, adversaire: opp || null,
            event_type: e.type, titre: EVENT_TYPES[e.type].label + (p.numero !== e.numero && e.numero != null ? ` de #${e.numero} (ta passe)` : ''),
            t_seconds: e.t, file_path: path,
          })),
        });
        done++;
      }
      steps.push(`${done} clip${done > 1 ? 's' : ''}`);
    }

    if ($('send-devoirs').checked && state.devoirs.size) {
      let n = 0;
      for (const r of rows) {
        const d = state.devoirs.get(r.player.id);
        if (!d) continue;
        const [rep] = await rest('player_reports', {
          method: 'POST', token, prefer: 'return=representation',
          body: { site: SITE, player_id: r.player.id, game_id: game && game.id, game_date: date, adversaire: opp || null, points_forts: d.points_forts || [], points_faibles: d.points_faibles || [], message: d.message || '' },
        });
        if ((d.devoirs || []).length) {
          await rest('player_assignments', {
            method: 'POST', token, prefer: 'return=minimal',
            body: d.devoirs.map(x => ({ site: SITE, player_id: r.player.id, report_id: rep.id, titre: x.titre, categorie: x.categorie, description: x.description, repetitions: x.repetitions, duree_min: x.duree_min })),
          });
        }
        n++;
      }
      steps.push(`devoirs de ${n} joueur${n > 1 ? 's' : ''}`);
    } else if ($('send-devoirs').checked) {
      steps.push('pas de devoirs (clique d\'abord « Préparer les devoirs »)');
    }
    setProgress('send-progress', 1, `Envoyé dans l'Espace Joueurs : ${steps.join(', ')}.`);
    refresh();
  } catch (err) {
    console.error(err);
    showError('Envoi impossible : ' + (err.message || err));
  } finally {
    state.busy = false;
    $('btn-send').disabled = false;
  }
});
$('sb-account').addEventListener('dblclick', () => { logout(); refresh(); });
