// Module « Radar terrain » : joueurs détectés dans le navigateur (MediaPipe), projetés sur un
// demi-terrain vu du dessus grâce à 4 repères touchés sur l'image (homographie, radar-core.js).
// Possession, passes, pertes, zones, écartement, cartes de chaleur, fiche PNG, CSV et vidéo radar.
import {
  $, showError, setProgress, parseLogDuration, getFFmpeg, mountFiles, runWithLog, offerFile, slugify, loadImage,
} from './common.js';
import { loadDetector, detectScene, jerseyColor, detectorDevice } from './detect.js';
import { kmeans2, hex } from './stats-core.js';
import {
  PRESETS, homography, project, invert, checkQuad, courtLines, feet, onCourt, nearestTeam, BallTracker,
  ballHolder, possession, teamMetrics, heatmap, sampleTimes, frameAt, toCSV, radarConcat, buildRadarArgs,
} from './radar-core.js';
import { COURT, fitCourt } from './board-core.js';
import { drawCourt } from './board.js';
import { fmtTime } from './analyse-core.js';
import { parseTimestamp } from './highlights.js';
import { BRAND } from './brand.js';

const MOUNT = '/rd';
const FALLBACK_COLORS = ['#3ec8ff', BRAND.orange];
const state = {
  file: null, input: '', duration: 0, hasAudio: false, busy: false,
  frame: null, frameT: 0, taps: [], H: null, centers: null,
  frames: [], start: 0, dur: 0, pos: null, metrics: null, playing: false,
};

// ---------- 1. Vidéo ----------
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
  $('step-calib').hidden = false;
  $('file-info').textContent = `${file.name} · ${(file.size / 1e6).toFixed(0)} Mo`;
}
video.addEventListener('loadedmetadata', () => {
  if (Number.isFinite(video.duration)) {
    state.duration = video.duration;
    $('file-info').textContent = `${state.file.name} · ${(state.file.size / 1e6).toFixed(0)} Mo · ${fmtTime(video.duration)}`;
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
}

// Image de la vidéo à l'instant t, lue par ffmpeg (marche aussi pour les vidéos que le navigateur ne lit pas).
async function grabBitmap(ff, t, width = 1280) {
  const code = await ff.exec(['-ss', t.toFixed(2), '-i', state.input, '-frames:v', '1', '-vf', `scale='min(${width},iw)':-2`, '/rd.bmp'], 30000);
  if (code !== 0) return null;
  const data = await ff.readFile('/rd.bmp');
  await ff.deleteFile('/rd.bmp');
  return createImageBitmap(new Blob([data], { type: 'image/bmp' }));
}

// ---------- 2. Calibration ----------
Object.entries(PRESETS).forEach(([k, p]) => $('preset').appendChild(new Option(p.label, k)));
const preset = () => PRESETS[$('preset').value];
$('preset').addEventListener('change', () => { state.taps = []; updateCalib(); });

$('btn-frame').addEventListener('click', async () => {
  if (state.busy || !state.file) return;
  state.busy = true;
  showError('');
  $('calib-info').textContent = 'Lecture de l\'image…';
  try {
    const ff = await getFFmpeg('run-progress');
    await mountInput(ff);
    state.frameT = video.currentTime || 0;
    state.frame = await grabBitmap(ff, state.frameT);
    if (!state.frame) throw new Error('image illisible');
    $('run-progress').hidden = true;
    state.taps = [];
    $('calib-wrap').hidden = false;
    updateCalib();
    $('calib-wrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
    detectTeams();
  } catch (err) {
    console.error(err);
    showError('Image impossible à lire : ' + (err.message || err));
  } finally {
    state.busy = false;
  }
});

const calib = $('calib');
calib.addEventListener('click', e => {
  if (!state.frame || state.taps.length >= 4) return;
  const r = calib.getBoundingClientRect();
  state.taps.push([(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]);
  updateCalib();
});
$('btn-undo').onclick = () => { state.taps.pop(); updateCalib(); };
$('btn-reset').onclick = () => { state.taps = []; updateCalib(); };

function updateCalib() {
  const img = state.frame;
  if (!img) return;
  calib.width = img.width;
  calib.height = img.height;
  const ctx = calib.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const pts = preset().points;
  const s = Math.max(img.width / 400, 2);
  state.H = null;
  if (state.taps.length === 4) {
    const err = checkQuad(state.taps);
    // Terrain (mètres) → image (0 à 1) : la matrice qui sert au radar va de l'image vers le terrain.
    const H = err ? null : homography(state.taps, pts.map(p => p.court));
    const back = H && invert(H);
    if (back) {
      state.H = H;
      ctx.strokeStyle = 'rgba(255, 214, 0, .95)';
      ctx.lineWidth = s * 1.2;
      courtLines().forEach(line => {
        ctx.beginPath();
        line.forEach((c, i) => {
          const [u, v] = project(back, c);
          if (i) ctx.lineTo(u * img.width, v * img.height); else ctx.moveTo(u * img.width, v * img.height);
        });
        ctx.stroke();
      });
    }
    $('calib-ask').textContent = state.H
      ? '✔ Terrain calé : les lignes jaunes doivent tomber sur les lignes du terrain. Sinon, recommence en touchant plus précisément.'
      : (err || 'Repères impossibles à utiliser : recommence.');
  } else {
    const next = pts[state.taps.length];
    $('calib-ask').innerHTML = '';
    const b = document.createElement('b');
    b.textContent = `Repère ${state.taps.length + 1} / 4 : `;
    $('calib-ask').append(b, next.name);
  }
  state.taps.forEach(([u, v], i) => {
    ctx.fillStyle = BRAND.orange;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = s;
    ctx.beginPath();
    ctx.arc(u * img.width, v * img.height, s * 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(s * 7)}px Inter, sans-serif`;
    ctx.fillText(String(i + 1), u * img.width + s * 7, v * img.height - s * 5);
  });
  $('step-run').hidden = !state.H;
  updateEta();
}

// Couleurs des deux équipes : k-moyennes sur les maillots des joueurs debout sur le terrain.
async function detectTeams() {
  $('calib-info').textContent = 'Recherche des joueurs et des couleurs de maillots (le détecteur se télécharge la 1re fois)…';
  try {
    await loadDetector();
    const { players } = await detectScene(state.frame, { grid: 2 });
    const c = document.createElement('canvas');
    c.width = state.frame.width;
    c.height = state.frame.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(state.frame, 0, 0);
    const colors = players.map(b => jerseyColor(ctx, b, c.width, c.height));
    const { centers } = kmeans2(colors);
    state.centers = centers.length === 2 ? centers : null;
    [0, 1].forEach(k => { $('sw' + k).style.background = state.centers ? hex(state.centers[k]) : FALLBACK_COLORS[k]; });
    $('teams').hidden = false;
    $('calib-info').textContent = `${players.length} personne${players.length > 1 ? 's' : ''} détectée${players.length > 1 ? 's' : ''} sur cette image (calcul sur la ${detectorDevice}).`;
  } catch (err) {
    console.error(err);
    $('calib-info').textContent = 'Détecteur indisponible : ' + (err.message || err);
  }
}
$('btn-swap').onclick = () => { const a = $('name0').value; $('name0').value = $('name1').value; $('name1').value = a; };
const names = () => [$('name0').value.trim() || 'Équipe A', $('name1').value.trim() || 'Équipe B'];
const teamColor = k => (state.centers ? hex(state.centers[k]) : FALLBACK_COLORS[k]);

// ---------- 3. Analyse ----------
$('btn-here').onclick = () => { $('start').value = fmtTime(video.currentTime || 0); updateEta(); };
['start', 'dur', 'fps', 'grid'].forEach(id => $(id).addEventListener('change', updateEta));
function updateEta() {
  const n = Math.floor(+$('dur').value * +$('fps').value);
  const k = +$('grid').value > 1 ? 3 : 1;
  $('eta').textContent = `${n} images à analyser · compte environ ${Math.max(1, Math.round((n * 0.7 * k) / 60))} à ${Math.max(2, Math.round((n * 1.5 * k) / 60))} min selon l'appareil.`;
}

$('btn-run').addEventListener('click', async () => {
  if (state.busy || !state.H) return;
  state.busy = true;
  $('btn-run').disabled = true;
  showError('');
  try {
    const ff = await getFFmpeg('run-progress');
    await mountInput(ff);
    await loadDetector();
    const start = Math.max(0, parseTimestamp($('start').value) || 0);
    if (state.duration && start >= state.duration - 1) throw new Error('Le début est après la fin de la vidéo.');
    const dur = Math.min(+$('dur').value, (state.duration || Infinity) - start);
    const times = sampleTimes(start, dur, +$('fps').value);
    const tracker = new BallTracker();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const frames = [];
    for (let i = 0; i < times.length; i++) {
      setProgress('run-progress', i / times.length, `Image ${i + 1} / ${times.length} · joueurs et ballon…`);
      const img = await grabBitmap(ff, times[i], 1280);
      if (!img) continue;
      const { players, balls } = await detectScene(img, { grid: +$('grid').value });
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const list = [];
      players.forEach(box => {
        const court = project(state.H, feet(box));
        if (!onCourt(court)) return; // banc, spectateurs, arbitres hors du terrain
        const team = state.centers ? nearestTeam(jerseyColor(ctx, box, img.width, img.height), state.centers) : 0;
        list.push({ box, court, team });
      });
      const ball = tracker.update(balls);
      frames.push({ t: times[i], players: list, holder: ballHolder(list, ball), ball: Boolean(ball) });
      img.close();
    }
    if (frames.length < 2) throw new Error('Impossible de lire assez d\'images de cette vidéo.');
    state.frames = frames;
    state.start = start;
    state.dur = dur;
    state.pos = possession(frames);
    state.metrics = teamMetrics(frames);
    const seen = frames.filter(f => f.ball).length;
    setProgress('run-progress', 1, `Radar prêt · ${frames.length} images · ballon vu sur ${Math.round((seen / frames.length) * 100)} % des images`);
    renderResults();
  } catch (err) {
    console.error(err);
    showError('Radar impossible : ' + (err.message || err));
  } finally {
    state.busy = false;
    $('btn-run').disabled = false;
  }
});

// ---------- 4. Résultats ----------
const radar = $('radar');
const toPx = (box, [x, y]) => [box.x + (x / COURT.w) * box.w, box.y + (y / COURT.h) * box.h];

function drawRadar(ctx, W, H, f, { title = true } = {}) {
  ctx.fillStyle = BRAND.dark;
  ctx.fillRect(0, 0, W, H);
  const head = title ? Math.round(H * 0.09) : 0;
  const box = fitCourt(0, head, W, H - head, Math.round(W * 0.03));
  drawCourt(ctx, box);
  const r = box.w * 0.024;
  if (title) {
    const n = names();
    ctx.font = `700 ${Math.round(head * 0.42)}px Oswald, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = teamColor(0);
    ctx.textAlign = 'left';
    ctx.fillText('● ' + n[0], W * 0.04, head * 0.55);
    ctx.fillStyle = teamColor(1);
    ctx.textAlign = 'right';
    ctx.fillText(n[1] + ' ●', W * 0.96, head * 0.55);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    if (f) ctx.fillText(fmtTime(f.t), W / 2, head * 0.55);
  }
  if (!f) return;
  f.players.forEach((p, i) => {
    const [x, y] = toPx(box, p.court);
    ctx.fillStyle = teamColor(p.team);
    ctx.strokeStyle = 'rgba(0,0,0,.65)';
    ctx.lineWidth = r * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (i === f.holder) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = r * 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r * 1.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = BRAND.orange;
      ctx.beginPath();
      ctx.arc(x + r * 1.15, y - r * 1.15, r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

function sizeRadar() {
  const w = Math.min(720, radar.parentElement.clientWidth || 360) * (window.devicePixelRatio > 1 ? 2 : 1);
  radar.width = Math.round(w);
  radar.height = Math.round(w * 1.02);
}

function showAt(t) {
  const f = frameAt(state.frames, t);
  drawRadar(radar.getContext('2d'), radar.width, radar.height, f);
  $('scrub-t').textContent = fmtTime(t);
  $('scrub').value = String(Math.round(((t - state.start) / Math.max(0.1, state.dur)) * 1000));
}

$('scrub').addEventListener('input', () => {
  const t = state.start + (+$('scrub').value / 1000) * state.dur;
  showAt(t);
  if (!state.playing && Number.isFinite(video.duration)) video.currentTime = t;
});

// Rejouer : la vidéo et le radar ensemble (si le navigateur lit la vidéo), sinon le radar seul.
let raf = 0;
$('btn-play').onclick = () => {
  if (state.playing) { stopPlay(); return; }
  state.playing = true;
  $('btn-play').textContent = '⏸ Pause';
  const canVideo = Number.isFinite(video.duration) && video.readyState >= 2;
  const t0 = performance.now();
  if (canVideo) { video.currentTime = state.start; video.play().catch(() => {}); }
  const tick = () => {
    const t = canVideo ? video.currentTime : state.start + (performance.now() - t0) / 1000;
    if (t >= state.start + state.dur) { stopPlay(); return; }
    showAt(t);
    raf = requestAnimationFrame(tick);
  };
  tick();
};
function stopPlay() {
  state.playing = false;
  cancelAnimationFrame(raf);
  video.pause();
  $('btn-play').textContent = '▶ Rejouer';
}

const pctTxt = x => `${Math.round(x * 100)} %`;
const mTxt = x => (x == null ? '—' : `${x.toFixed(1).replace('.', ',')} m`);

function statRows() {
  const m = state.metrics, p = state.pos;
  const dec = x => x.toFixed(1).replace('.', ',');
  return [
    ['Possession', pctTxt(p.share[0]), pctTxt(p.share[1])],
    ['Passes', String(p.passes[0]), String(p.passes[1])],
    ['Ballons perdus', String(p.pertes[0]), String(p.pertes[1])],
    ['Dans la raquette', pctTxt(m[0].zones.raquette), pctTxt(m[1].zones.raquette)],
    ['Mi-distance', pctTxt(m[0].zones.mi), pctTxt(m[1].zones.mi)],
    ['Derrière la ligne à 3 pts', pctTxt(m[0].zones.trois), pctTxt(m[1].zones.trois)],
    ['Écartement moyen', mTxt(m[0].spacing), mTxt(m[1].spacing)],
    ['Distance moyenne à la ligne de fond', mTxt(m[0].depth), mTxt(m[1].depth)],
    ['Joueurs vus par image', dec(m[0].players), dec(m[1].players)],
  ];
}

function renderStats() {
  const n = names();
  const box = $('stats');
  box.innerHTML = '';
  // Barre de possession.
  const bar = document.createElement('div');
  bar.className = 'poss-bar';
  [0, 1].forEach(k => {
    const s = document.createElement('span');
    s.style.flexGrow = String(Math.max(0.02, state.pos.share[k]));
    s.style.background = teamColor(k);
    s.textContent = pctTxt(state.pos.share[k]);
    bar.append(s);
  });
  const table = document.createElement('table');
  table.className = 'stat-table';
  const head = table.insertRow();
  ['', n[0], n[1]].forEach((txt, k) => {
    const th = document.createElement('th');
    th.textContent = txt;
    if (k) th.style.color = teamColor(k - 1);
    head.append(th);
  });
  statRows().forEach(([label, a, b]) => {
    const tr = table.insertRow();
    [label, a, b].forEach(txt => { tr.insertCell().textContent = txt; });
  });
  const tip = document.createElement('p');
  tip.className = 'muted';
  tip.textContent = coachTip();
  box.append(bar, table, tip);
}

// Lecture rapide pour le coach, d'après les chiffres (pas d'IA).
function coachTip() {
  const n = names(), m = state.metrics;
  const tips = [];
  if (m[0].spacing != null && m[0].spacing < 4.5) tips.push(`${n[0]} joue resserré (écartement ${mTxt(m[0].spacing)}) : écarter le jeu ouvrirait la raquette.`);
  if (m[0].spacing != null && m[0].spacing >= 6) tips.push(`${n[0]} écarte bien le jeu (${mTxt(m[0].spacing)}).`);
  if (m[0].zones.raquette > 0.35) tips.push(`${n[0]} passe beaucoup de temps dans la raquette (${pctTxt(m[0].zones.raquette)}).`);
  if (m[0].zones.trois > 0.45) tips.push(`${n[0]} est souvent derrière la ligne à 3 points (${pctTxt(m[0].zones.trois)}).`);
  if (state.pos.pertes[0] > state.pos.pertes[1]) tips.push(`${n[0]} perd plus de ballons que ${n[1]} sur cette séquence.`);
  return tips.length ? 'À retenir : ' + tips.join(' ') : 'À retenir : séquence équilibrée, rien de marquant dans les chiffres.';
}

const HEAT_STOPS = [[0, [0, 0, 0, 0]], [0.25, [62, 200, 255, 120]], [0.55, [255, 214, 0, 170]], [1, [216, 30, 91, 215]]];
function heatColor(v) {
  for (let i = 1; i < HEAT_STOPS.length; i++) {
    const [v1, c1] = HEAT_STOPS[i];
    if (v <= v1) {
      const [v0, c0] = HEAT_STOPS[i - 1];
      const u = (v - v0) / (v1 - v0);
      return c0.map((c, k) => Math.round(c + (c1[k] - c) * u));
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1];
}

function drawHeat(ctx, box, team) {
  drawCourt(ctx, box);
  const pts = state.frames.flatMap(f => f.players.filter(p => p.team === team).map(p => p.court));
  if (!pts.length) return;
  const hm = heatmap(pts);
  const off = document.createElement('canvas');
  off.width = hm.nx;
  off.height = hm.ny;
  const o = off.getContext('2d');
  const data = o.createImageData(hm.nx, hm.ny);
  hm.values.forEach((v, i) => { data.data.set(heatColor(v), i * 4); });
  o.putImageData(data, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, box.x, box.y, box.w, box.h);
  ctx.restore();
}

function renderHeat() {
  const n = names();
  [0, 1].forEach(k => {
    const c = $('heat' + k);
    c.width = 600;
    c.height = 560;
    const ctx = c.getContext('2d');
    ctx.fillStyle = BRAND.dark;
    ctx.fillRect(0, 0, c.width, c.height);
    drawHeat(ctx, fitCourt(0, 0, c.width, c.height, 12), k);
    $('cap' + k).textContent = `${n[k]} · où l'équipe a passé son temps`;
    $('cap' + k).style.color = teamColor(k);
  });
}

function renderEvents() {
  const n = names();
  const ul = $('events');
  ul.innerHTML = '';
  if (!state.pos.events.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Aucune passe ni perte repérée (ballon peu visible ou séquence courte).';
    ul.append(li);
    return;
  }
  state.pos.events.forEach(e => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool';
    b.textContent = fmtTime(e.t);
    b.onclick = () => {
      showAt(e.t);
      if (Number.isFinite(video.duration)) { video.currentTime = Math.max(0, e.t - 2); video.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    };
    const dot = document.createElement('span');
    dot.className = 'swatch small';
    dot.style.background = teamColor(e.team);
    const txt = e.type === 'passe'
      ? ` Passe de ${n[e.team]} (${Math.hypot(e.to[0] - e.from[0], e.to[1] - e.from[1]).toFixed(0)} m)`
      : ` Ballon perdu par ${n[e.team]}`;
    li.append(b, ' ', dot, document.createTextNode(txt));
    ul.append(li);
  });
}

function renderResults() {
  $('step-results').hidden = false;
  sizeRadar();
  renderStats();
  renderHeat();
  renderEvents();
  showAt(state.start);
  // CSV des positions.
  const csv = $('btn-csv');
  if (csv.href) URL.revokeObjectURL(csv.href);
  csv.href = URL.createObjectURL(new Blob(['﻿' + toCSV(state.frames, names())], { type: 'text/csv;charset=utf-8' }));
  csv.download = `radar-${slugify(names()[0], 'gravity')}-${fmtTime(state.start).replace(/:/g, 'h')}.csv`;
  makeCard();
  $('step-results').scrollIntoView({ behavior: 'smooth' });
}
['name0', 'name1'].forEach(id => $(id).addEventListener('change', () => { if (state.frames.length) renderResults(); }));
$('btn-swap').addEventListener('click', () => { if (state.frames.length) renderResults(); });

// Fiche de synthèse 1080 × 1350 aux couleurs Gravity (Instagram 4:5).
async function makeCard() {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  try { await document.fonts.load('700 60px Oswald'); } catch { /* police de secours */ }
  ctx.fillStyle = BRAND.dark;
  ctx.fillRect(0, 0, W, H);
  [[0.1, 0.05, BRAND.orange], [0.95, 0.95, BRAND.magenta]].forEach(([x, y, col]) => {
    const g = ctx.createRadialGradient(W * x, H * y, 0, W * x, H * y, W * 0.8);
    g.addColorStop(0, col + '55');
    g.addColorStop(1, col + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });
  let logo = null;
  try { logo = await loadImage('assets/logo.png'); } catch { /* sans logo */ }
  if (logo) ctx.drawImage(logo, 48, 40, 110, 110 * (logo.height / logo.width));
  const n = names();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 64px Oswald, sans-serif';
  ctx.fillText('RADAR DU MATCH', 180, 100);
  ctx.font = '500 30px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.fillText(`${n[0]} vs ${n[1]} · ${fmtTime(state.start)} → ${fmtTime(state.start + state.dur)}`, 182, 142);
  // Barre de possession.
  const y0 = 200, bw = W - 96;
  ctx.font = '700 30px Oswald, sans-serif';
  let x = 48;
  [0, 1].forEach(k => {
    const w = bw * state.pos.share[k];
    ctx.fillStyle = teamColor(k);
    ctx.fillRect(x, y0, w, 56);
    ctx.fillStyle = '#0d0b12';
    if (w > 120) ctx.fillText(`${n[k]} ${pctTxt(state.pos.share[k])}`, x + 16, y0 + 39);
    x += w;
  });
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.font = '500 24px Inter, sans-serif';
  ctx.fillText('Possession', 48, y0 + 88);
  // Cartes de chaleur.
  const hw = (W - 96 - 24) / 2;
  [0, 1].forEach(k => {
    const box = fitCourt(48 + k * (hw + 24), 320, hw, hw * 0.94, 0);
    drawHeat(ctx, box, k);
    ctx.fillStyle = teamColor(k);
    ctx.font = '700 28px Oswald, sans-serif';
    ctx.fillText(n[k], box.x, box.y + box.h + 38);
  });
  // Tableau.
  let ty = 320 + hw * 0.94 + 90;
  ctx.font = '500 26px Inter, sans-serif';
  statRows().slice(1, 8).forEach(([label, a, b]) => {
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.textAlign = 'left';
    ctx.fillText(label, 48, ty);
    ctx.textAlign = 'right';
    ctx.fillStyle = teamColor(0);
    ctx.fillText(a, W - 240, ty);
    ctx.fillStyle = teamColor(1);
    ctx.fillText(b, W - 48, ty);
    ty += 44;
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = '500 22px Inter, sans-serif';
  ctx.fillText(`${BRAND.instagram} · ${BRAND.site}`, 48, H - 36);
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  const a = $('btn-card');
  if (a.href) URL.revokeObjectURL(a.href);
  a.href = URL.createObjectURL(blob);
  a.download = `radar-${slugify(n[0], 'gravity')}.png`;
}

// ---------- Vidéo radar ----------
$('btn-render').addEventListener('click', async () => {
  if (state.busy || !state.frames.length) return;
  state.busy = true;
  $('btn-render').disabled = true;
  showError('');
  const written = [];
  try {
    const ff = await getFFmpeg('render-progress');
    await mountInput(ff);
    const W = 720, RH = 736;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = RH;
    const ctx = c.getContext('2d');
    try { await ff.createDir('/radar'); } catch { /* déjà là */ }
    for (let i = 0; i < state.frames.length; i++) {
      setProgress('render-progress', (i / state.frames.length) * 0.3, `Images du radar… ${i + 1} / ${state.frames.length}`);
      drawRadar(ctx, W, RH, state.frames[i]);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
      const name = `/radar/r${String(i).padStart(5, '0')}.jpg`;
      await ff.writeFile(name, new Uint8Array(await blob.arrayBuffer()));
      written.push(name);
    }
    await ff.writeFile('/radar/list.txt', radarConcat(state.frames.map(f => f.t - state.start), state.dur));
    written.push('/radar/list.txt');
    const onLog = ({ message }) => {
      const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);
      if (m) setProgress('render-progress', 0.3 + 0.7 * Math.min(1, ((+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])) / state.dur), 'Montage de la vidéo radar…');
    };
    ff.on('log', onLog);
    let code;
    try {
      code = await ff.exec(buildRadarArgs({
        input: state.input, start: state.start, dur: state.dur, list: '/radar/list.txt', width: W, radarH: RH, hasAudio: state.hasAudio, output: '/radar.mp4',
      }));
    } finally {
      ff.off('log', onLog);
    }
    if (code !== 0) throw new Error('le montage a échoué');
    const data = await ff.readFile('/radar.mp4');
    await ff.deleteFile('/radar.mp4');
    const name = `radar-${slugify(names()[0], 'gravity')}-${fmtTime(state.start).replace(/:/g, 'h')}.mp4`;
    const url = offerFile(new Blob([data], { type: 'video/mp4' }), name, {
      download: 'btn-download', share: 'btn-share', title: 'Radar du match', text: `Radar ${names()[0]} vs ${names()[1]} · ${BRAND.instagram}`,
    });
    $('result-video').src = url;
    $('result').hidden = false;
    setProgress('render-progress', 1, `Vidéo radar prête · ${(data.length / 1e6).toFixed(1)} Mo`);
  } catch (err) {
    console.error(err);
    showError('Vidéo radar impossible : ' + (err.message || err));
  } finally {
    const ff = await getFFmpeg('render-progress').catch(() => null);
    if (ff) for (const f of written) await ff.deleteFile(f).catch(() => {});
    state.busy = false;
    $('btn-render').disabled = false;
  }
});

window.addEventListener('resize', () => { if (state.frames.length && !state.playing) { sizeRadar(); showAt(state.start + (+$('scrub').value / 1000) * state.dur); } });
