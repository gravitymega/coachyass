import {
  WINDOW_S, energyEnvelope, excitementScore, findPeaks, candidatesToClips,
  parseTimestamp, formatTime, buildRenderArgs,
  hoopBox, netMotionArgs, netMotion, basketPeak, BASKET_Z, NET_FPS, zoomSize,
} from './highlights.js';

import {
  $, showError, setProgress, parseLogTime, parseLogDuration, getFFmpeg, mountFiles,
  runWithLog, slugify, offerFile,
} from './common.js';
import { OUTRO, brandCardPNG } from './brand.js';
import { setVideo, currentCaption } from './social.js';
import { offerDrive } from './drive.js';
import { uploadKbps } from './social-core.js';
import { renderShortFast, fastRenderAvailable } from './fast-render.js';

const AUDIO_RATE = 8000;
const AUDIO_CHUNK_S = 600;
const MOUNT = '/in';

const state = {
  file: null,
  inputPath: null,
  duration: 0,
  hasAudio: true,
  score: null,
  cands: [],     // moments forts repérés au son (+ résultat de la vérification panier)
  clips: [],
  hoops: [],     // paniers montrés par l'utilisateur, coordonnées 0 à 1
  srcW: 0,
  srcH: 0,
  frameT: 0,
  logo: null,
  busy: false,
};
// Nombre de moments forts vérifiés au filet : assez pour remplir la durée visée
// (un extrait fait ~7,5 s et environ un moment fort sur deux est un panier).
const checkedFor = target => Math.min(80, Math.max(30, Math.ceil((target / 7.5) * 2.5)));
let nextId = 1;

async function mountInput(ff) {
  [state.inputPath] = await mountFiles(ff, MOUNT, [state.file]);
}

// ---------- 1. Import ----------
async function selectFile(file) {
  if (!file || state.busy) return;
  showError('');
  state.file = file;
  state.clips = [];
  state.cands = [];
  state.hoops = [];
  state.score = null;
  state.duration = 0;
  state.srcW = state.srcH = 0;
  const video = $('video');
  if (video.src) URL.revokeObjectURL(video.src);
  video.src = URL.createObjectURL(file);
  $('player-wrap').hidden = false;
  $('no-preview').hidden = true;
  $('file-info').textContent = `${file.name} · ${(file.size / 1e6).toFixed(0)} Mo`;
  $('step-analyse').hidden = false;
  ['step-clips', 'step-style', 'step-export', 'result', 'analyse-progress', 'render-progress', 'hoop-step', 'basket-progress']
    .forEach(id => { $(id).hidden = true; });
}

$('file').addEventListener('change', e => selectFile(e.target.files[0]));
const drop = $('drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
drop.addEventListener('drop', e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); });

const video = $('video');
video.addEventListener('loadedmetadata', () => {
  if (Number.isFinite(video.duration)) {
    state.duration = video.duration;
    $('file-info').textContent += ` · ${formatTime(video.duration)}`;
  }
});
video.addEventListener('error', () => { if (state.file) $('no-preview').hidden = false; });
video.addEventListener('timeupdate', () => { drawEnergy(); drawPreview(); });
video.addEventListener('seeked', drawPreview);

// ---------- 2. Analyse ----------
$('btn-analyse').addEventListener('click', analyse);

async function analyse() {
  if (state.busy) return;
  state.busy = true;
  $('btn-analyse').disabled = true;
  showError('');
  try {
    const ff = await getFFmpeg('analyse-progress');
    await mountInput(ff);
    setProgress('analyse-progress', 0, 'Écoute de la game…');
    // Le son est lu par tranches de AUDIO_CHUNK_S : la mémoire reste la même
    // pour une game de 20 min ou de 2 h (important sur téléphone).
    const envs = [];
    let heard = 0;
    for (let start = 0; ; start += AUDIO_CHUNK_S) {
      const code = await runWithLog(ff, [
        '-ss', String(start), '-t', String(AUDIO_CHUNK_S), '-i', state.inputPath,
        '-map', '0:a:0', '-vn', '-ac', '1', '-ar', String(AUDIO_RATE), '-f', 's16le', '/audio.raw',
      ], line => {
        const d = parseLogDuration(line);
        if (d && !state.duration) state.duration = d;
        readVideoSize(line);
        const t = parseLogTime(line);
        if (t != null && state.duration) {
          setProgress('analyse-progress', (start + t) / state.duration, `Écoute de la game… ${formatTime(start + t)} / ${formatTime(state.duration)}`);
        }
      });
      if (code !== 0) break;
      const raw = await ff.readFile('/audio.raw');
      await ff.deleteFile('/audio.raw');
      const samples = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 2));
      envs.push(energyEnvelope(samples, AUDIO_RATE));
      heard += samples.length / AUDIO_RATE;
      if (samples.length < (AUDIO_CHUNK_S - 1) * AUDIO_RATE || (state.duration && start + AUDIO_CHUNK_S >= state.duration)) break;
    }
    state.hasAudio = heard > 1;
    if (state.hasAudio) {
      if (!state.duration) state.duration = heard;
      const env = new Float32Array(envs.reduce((n, e) => n + e.length, 0));
      envs.reduce((off, e) => { env.set(e, off); return off + e.length; }, 0);
      state.score = excitementScore(env);
      state.cands = findPeaks(state.score, WINDOW_S, { maxCount: 80 }).map(p => ({ t: p.t, score: p.score }));
      autoSelect();
      setProgress('analyse-progress', 1, `${state.cands.length} moments forts trouvés au son`);
      $('hoop-step').hidden = false;
      loadFrame(state.duration * 0.3);
    } else {
      state.score = null;
      state.clips = [];
      setProgress('analyse-progress', 1, 'Pas de son dans cette vidéo : ajoute les moments à la main');
    }
    ['step-clips', 'step-style', 'step-export'].forEach(id => { $(id).hidden = false; });
    renderClips();
    drawPreview();
  } catch (err) {
    console.error(err);
    showError('Analyse impossible : ' + (err.message || err));
  } finally {
    state.busy = false;
    $('btn-analyse').disabled = false;
  }
}

// Taille réelle de la vidéo (après rotation éventuelle d'un téléphone), lue dans le journal ffmpeg.
function readVideoSize(line) {
  const m = /Video: .*?(\d{2,5})x(\d{2,5})/.exec(line);
  if (m && !state.srcW) { state.srcW = +m[1]; state.srcH = +m[2]; }
  if (/rotation of -?90/.test(line) && state.srcW > state.srcH) [state.srcW, state.srcH] = [state.srcH, state.srcW];
}

function autoSelect() {
  if (!state.score) return;
  const target = +$('target').value;
  const manual = state.clips.filter(c => c.manual);
  const manualTotal = manual.reduce((s, c) => s + (c.on ? c.dur : 0), 0);
  const auto = candidatesToClips(state.cands, { duration: state.duration, targetS: Math.max(0, target - manualTotal), pick: $('pick').value })
    .filter(c => !manual.some(m => Math.abs(m.t - c.t) < 8))
    .map(c => ({ ...c, id: nextId++, cropX: c.basket && c.hoop ? c.hoop.x : 0.5 }));
  state.clips = [...manual, ...auto].sort((a, b) => a.start - b.start);
}

// ---------- 2 bis. Paniers marqués ----------
const hoopCanvas = $('hoop-canvas');
let frameImg = null;

async function loadFrame(t) {
  try {
    const ff = await getFFmpeg('analyse-progress');
    await mountInput(ff);
    state.frameT = Math.max(0, Math.min(t, (state.duration || 1) - 1));
    const code = await ff.exec(['-ss', state.frameT.toFixed(2), '-i', state.inputPath, '-frames:v', '1', '-vf', 'scale=960:-2', '/frame.png']);
    if (code !== 0) throw new Error('image illisible');
    const data = await ff.readFile('/frame.png');
    await ff.deleteFile('/frame.png');
    frameImg = await createImageBitmap(new Blob([data], { type: 'image/png' }));
    drawHoops();
  } catch (err) {
    console.error(err);
    showError('Impossible d\'afficher une image de la vidéo : ' + (err.message || err));
  }
}

function drawHoops() {
  if (!frameImg) return;
  hoopCanvas.width = frameImg.width;
  hoopCanvas.height = frameImg.height;
  const ctx = hoopCanvas.getContext('2d');
  const W = hoopCanvas.width, H = hoopCanvas.height;
  ctx.drawImage(frameImg, 0, 0);
  state.hoops.forEach((hp, i) => {
    const b = hoopBox(hp, +$('hoop-size').value);
    ctx.lineWidth = Math.max(2, W / 320);
    ctx.strokeStyle = '#e8672e';
    ctx.strokeRect(b.x * W, b.y * H, b.w * W, b.h * H);
    ctx.fillStyle = '#e8672e';
    ctx.beginPath();
    ctx.arc(hp.x * W, hp.y * H, Math.max(3, W / 200), 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `700 ${Math.round(W / 40)}px Inter, sans-serif`;
    ctx.fillText(`Panier ${i + 1}`, b.x * W, b.y * H - 6);
  });
  $('btn-baskets').disabled = !state.hoops.length || state.busy;
}

hoopCanvas.addEventListener('click', e => {
  const r = hoopCanvas.getBoundingClientRect();
  const hp = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  if (state.hoops.length >= 2) {
    // Deux paniers maximum : le clic remplace le plus proche.
    const d = h => (h.x - hp.x) ** 2 + (h.y - hp.y) ** 2;
    state.hoops[d(state.hoops[0]) < d(state.hoops[1]) ? 0 : 1] = hp;
  } else {
    state.hoops.push(hp);
  }
  drawHoops();
});
$('hoop-size').addEventListener('input', drawHoops);
$('btn-hoop-clear').addEventListener('click', () => { state.hoops = []; drawHoops(); });
$('btn-other-frame').addEventListener('click', () => {
  if (!state.busy) loadFrame((state.frameT + (state.duration || 60) * 0.17) % Math.max(1, state.duration || 60));
});
$('btn-baskets').addEventListener('click', detectBaskets);

// Pour chaque moment fort (les plus forts d'abord), regarde le filet dans les 8 s qui précèdent la réaction.
async function detectBaskets() {
  if (state.busy || !state.hoops.length || !state.cands.length) return;
  state.busy = true;
  $('btn-baskets').disabled = true;
  showError('');
  try {
    const ff = await getFFmpeg('basket-progress');
    await mountInput(ff);
    const size = +$('hoop-size').value;
    const todo = [...state.cands].sort((a, b) => b.score - a.score).slice(0, checkedFor(+$('target').value));
    let found = 0;
    for (let i = 0; i < todo.length; i++) {
      const c = todo[i];
      setProgress('basket-progress', i / todo.length, `Vérification du filet… ${i + 1} / ${todo.length} (${found} panier${found > 1 ? 's' : ''})`);
      const start = Math.max(0, c.t - 8);
      const code = await ff.exec(netMotionArgs({ input: state.inputPath, start, dur: 9.5, hoops: state.hoops, size, output: '/net.raw' }));
      if (code !== 0) continue;
      const raw = await ff.readFile('/net.raw');
      await ff.deleteFile('/net.raw');
      const diffs = netMotion(raw, state.hoops.length);
      // Le ballon traverse le filet avant la réaction de la salle (jusqu'à ~7 s avant).
      const from = Math.max(0.5, c.t - start - 7.5), to = c.t - start + 0.8;
      let best = { z: 0, t: 0, k: 0 };
      diffs.forEach((d, k) => {
        const pk = basketPeak(d, NET_FPS, { from, to });
        if (pk.z > best.z) best = { ...pk, k };
      });
      c.checked = true;
      c.netZ = best.z;
      c.basket = best.z >= BASKET_Z;
      if (c.basket) {
        c.tb = start + best.t;
        c.hoop = state.hoops[best.k];
        found++;
      }
    }
    $('pick').value = found ? 'baskets' : 'all';
    autoSelect();
    renderClips();
    setProgress('basket-progress', 1, found
      ? `${found} panier${found > 1 ? 's' : ''} marqué${found > 1 ? 's' : ''} trouvé${found > 1 ? 's' : ''} sur ${todo.length} moments forts vérifiés`
      : `Aucun panier vu dans le filet : vérifie la position et la taille de la zone, ou garde la sélection au son`);
  } catch (err) {
    console.error(err);
    showError('Détection des paniers impossible : ' + (err.message || err));
  } finally {
    state.busy = false;
    drawHoops();
  }
}

// ---------- 3. Extraits ----------
function addMoment(t) {
  if (!Number.isFinite(t)) return;
  if (state.duration) t = Math.min(t, state.duration);
  const start = Math.max(0, t - 5);
  const end = state.duration ? Math.min(state.duration, t + 3) : t + 3;
  state.clips.push({ id: nextId++, t, score: null, start, dur: Math.max(1, end - start), on: true, manual: true, cropX: 0.5 });
  state.clips.sort((a, b) => a.start - b.start);
  renderClips();
}

$('btn-add-here').addEventListener('click', () => addMoment(video.currentTime));
$('btn-add-times').addEventListener('click', () => {
  const input = $('manual-times');
  const bad = [];
  input.value.split(/[,;\s]+/).filter(Boolean).forEach(txt => {
    const t = parseTimestamp(txt);
    if (t == null || (state.duration && t > state.duration)) bad.push(txt);
    else addMoment(t);
  });
  input.value = bad.join(', ');
  showError(bad.length ? `Minutes non reconnues ou après la fin de la vidéo : ${bad.join(', ')}` : '');
});
$('btn-auto').addEventListener('click', () => { autoSelect(); renderClips(); });
$('target').addEventListener('change', () => { if (state.score) { autoSelect(); renderClips(); } });
$('pick').addEventListener('change', () => { if (state.score) { autoSelect(); renderClips(); } });

function totalSelected() {
  return state.clips.filter(c => c.on).reduce((s, c) => s + c.dur, 0);
}

function renderClips() {
  const list = $('clips');
  list.innerHTML = '';
  const maxScore = Math.max(1, ...state.clips.map(c => c.score || 0));
  const isCrop = $('layout').value === 'crop';
  state.clips.forEach(c => {
    const li = document.createElement('li');
    li.className = c.on ? '' : 'off';
    const label = c.manual ? 'ajouté à la main' : `salle +${c.score.toFixed(1)} dB`;
    const tag = c.basket ? '<span class="tag">🏀 Panier</span>' : c.checked ? '<span class="tag no">pas de panier vu</span>' : '';
    li.innerHTML = `
      <input type="checkbox" ${c.on ? 'checked' : ''} aria-label="Garder cet extrait">
      <div>
        <div class="when">${formatTime(c.start)} → ${formatTime(c.start + c.dur)}${tag}<small>${label}</small></div>
        ${c.manual ? '' : `<div class="bar" style="width:${Math.round((c.score / maxScore) * 100)}%"></div>`}
      </div>
      <div class="ctl">
        <button data-a="play">▶ Voir</button>
        <button data-a="earlier" title="Commencer 1 s plus tôt">−1 s</button>
        <button data-a="later" title="Commencer 1 s plus tard">+1 s</button>
        <input type="number" min="2" max="20" step="1" value="${Math.round(c.dur)}" aria-label="Durée en secondes"> s
        <button data-a="del" title="Retirer">✕</button>
      </div>
      ${isCrop ? `<label class="crop">Cadrage ◀ <input type="range" min="0" max="1" step="0.01" value="${c.cropX}"> ▶</label>` : ''}`;
    li.querySelector('input[type=checkbox]').addEventListener('change', e => { c.on = e.target.checked; renderClips(); });
    li.querySelector('input[type=number]').addEventListener('change', e => {
      const max = state.duration ? state.duration - c.start : 20;
      c.dur = Math.min(Math.max(2, +e.target.value || 8), 20, max);
      renderClips();
    });
    const range = li.querySelector('input[type=range]');
    if (range) {
      range.addEventListener('input', e => { c.cropX = +e.target.value; drawPreview(); });
      range.addEventListener('focus', () => seek(c.start + c.dur / 2));
    }
    li.querySelector('.ctl').addEventListener('click', e => {
      const a = e.target.dataset.a;
      if (!a) return;
      if (a === 'play') playClip(c);
      if (a === 'earlier') { c.start = Math.max(0, c.start - 1); renderClips(); seek(c.start); }
      if (a === 'later') { c.start = Math.min(c.start + 1, (state.duration || Infinity) - c.dur); renderClips(); seek(c.start); }
      if (a === 'del') { state.clips = state.clips.filter(x => x !== c); renderClips(); }
    });
    list.appendChild(li);
  });
  const total = totalSelected();
  const target = +$('target').value;
  const el = $('total');
  const n = state.clips.filter(c => c.on).length;
  el.textContent = `${n} extrait${n > 1 ? 's' : ''} retenu${n > 1 ? 's' : ''} · ${Math.round(total)} s / ${target} s`;
  el.classList.toggle('over', total > target + 2);
  $('btn-render').disabled = n === 0;
  drawEnergy();
}

function seek(t) {
  if (Number.isFinite(t)) video.currentTime = t;
}

let stopAt = null;
let queue = [];
function playClip(c) {
  queue = [];
  seek(c.start);
  stopAt = c.start + c.dur;
  video.play().catch(() => {});
}
$('btn-preview').addEventListener('click', () => {
  queue = state.clips.filter(c => c.on);
  const first = queue.shift();
  if (!first) return;
  seek(first.start);
  stopAt = first.start + first.dur;
  video.play().catch(() => {});
});
video.addEventListener('timeupdate', () => {
  if (stopAt == null || video.currentTime < stopAt) return;
  const next = queue.shift();
  if (next) { seek(next.start); stopAt = next.start + next.dur; }
  else { video.pause(); stopAt = null; }
});

// Graphique d'excitation de la salle sur toute la game.
const energy = $('energy');
function drawEnergy() {
  if ($('step-clips').hidden) return;
  const dpr = window.devicePixelRatio || 1;
  const w = energy.clientWidth, h = energy.clientHeight;
  if (!w) return;
  energy.width = w * dpr;
  energy.height = h * dpr;
  const ctx = energy.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  const dur = state.duration || 1;
  const x = t => (t / dur) * w;
  if (state.score) {
    const s = state.score;
    const per = s.length / w;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let px = 0; px < w; px++) {
      let m = -Infinity;
      for (let i = Math.floor(px * per); i < Math.floor((px + 1) * per) && i < s.length; i++) m = Math.max(m, s[i]);
      const v = Math.max(0, Math.min(1, (m + 2) / 14));
      ctx.lineTo(px, h - v * (h - 6));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(216,30,91,.75)');
    g.addColorStop(1, 'rgba(232,103,46,.15)');
    ctx.fillStyle = g;
    ctx.fill();
  }
  state.clips.forEach(c => {
    ctx.fillStyle = c.on ? 'rgba(232,103,46,.35)' : 'rgba(255,255,255,.08)';
    ctx.fillRect(x(c.start), 0, Math.max(2, x(c.dur)), h);
    ctx.fillStyle = c.on ? '#e8672e' : '#666';
    ctx.fillRect(x(c.t ?? c.start), 0, 2, h);
  });
  ctx.fillStyle = '#fff';
  ctx.fillRect(x(video.currentTime || 0), 0, 1.5, h);
}
energy.addEventListener('click', e => {
  const r = energy.getBoundingClientRect();
  seek(((e.clientX - r.left) / r.width) * (state.duration || 0));
});
window.addEventListener('resize', drawEnergy);

// ---------- 4. Habillage ----------
const logoImg = new Image();
logoImg.src = 'assets/logo.png';
logoImg.onload = () => { state.logo = logoImg; drawPreview(); };

['layout', 'title', 'subtitle', 'show-logo', 'quality'].forEach(id => $(id).addEventListener('input', () => {
  if (id === 'layout') renderClips();
  drawPreview();
}));

// Titre, score et logo, dessinés une fois en PNG transparent par-dessus la vidéo.
function drawOverlay(ctx, W, H) {
  const title = $('title').value.trim().toUpperCase();
  const sub = $('subtitle').value.trim();
  if (title || sub) {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.24);
    g.addColorStop(0, 'rgba(0,0,0,.7)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.24);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (title) {
    let size = W * 0.085;
    ctx.font = `700 ${size}px Oswald, Impact, sans-serif`;
    while (ctx.measureText(title).width > W * 0.9 && size > 10) {
      size -= 2;
      ctx.font = `700 ${size}px Oswald, Impact, sans-serif`;
    }
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = W * 0.01;
    ctx.fillText(title, W / 2, H * 0.115);
  }
  if (sub) {
    ctx.font = `600 ${W * 0.05}px Inter, sans-serif`;
    ctx.fillStyle = '#ff8a4c';
    ctx.fillText(sub, W / 2, H * 0.115 + W * 0.075);
  }
  ctx.shadowBlur = 0;
  if ($('show-logo').checked && state.logo) {
    const s = W * 0.16;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(state.logo, W / 2 - s / 2, H * 0.80, s, s);
    ctx.globalAlpha = 1;
  }
}

function currentClipCropX() {
  const t = video.currentTime;
  const c = state.clips.find(x => t >= x.start && t <= x.start + x.dur);
  return c ? c.cropX : 0.5;
}

function drawPreview() {
  if ($('step-style').hidden) return;
  const cv = $('preview');
  const W = cv.width, H = cv.height;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const vw = video.videoWidth, vh = video.videoHeight;
  if (vw && vh) {
    if ($('layout').value === 'crop') {
      const scale = H / vh;
      const sw = W / scale;
      const sx = (vw - sw) * currentClipCropX();
      ctx.drawImage(video, Math.max(0, sx), 0, Math.min(vw, sw), vh, 0, 0, W, H);
    } else {
      const bgScale = Math.max(W / vw, H / vh);
      ctx.filter = 'blur(8px) brightness(0.85)';
      ctx.drawImage(video, (W - vw * bgScale) / 2, (H - vh * bgScale) / 2, vw * bgScale, vh * bgScale);
      ctx.filter = 'none';
      const fh = vh * (W / vw);
      ctx.drawImage(video, 0, (H - fh) / 2, W, fh);
    }
  }
  drawOverlay(ctx, W, H);
}

async function overlayCanvas(W, H) {
  try { await document.fonts.load(`700 ${Math.round(W * 0.085)}px Oswald`); } catch { /* police de secours */ }
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  drawOverlay(cv.getContext('2d'), W, H);
  return cv;
}

async function overlayPNG(W, H) {
  const cv = await overlayCanvas(W, H);
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

// ---------- 5. Export ----------
$('btn-render').addEventListener('click', render);

async function render() {
  if (state.busy) return;
  const clips = state.clips.filter(c => c.on);
  if (!clips.length) return;
  state.busy = true;
  $('btn-render').disabled = true;
  $('result').hidden = true;
  showError('');
  const total = clips.reduce((s, c) => s + c.dur, 0) + ($('brand-outro').checked ? 3 : 0);
  try {
    const [W, H] = $('quality').value === '720' ? [720, 1280] : [1080, 1920];
    const hasOverlay = $('title').value.trim() || $('subtitle').value.trim() || $('show-logo').checked;
    const fast = await renderFast(clips, W, H, hasOverlay, total);
    if (fast) {
      showResult(fast);
      setProgress('render-progress', 1, `Short prêt · ${Math.round(total)} s · ${(fast.size / 1e6).toFixed(1)} Mo · rendu rapide`);
      return;
    }
    const ff = await getFFmpeg('render-progress');
    await mountInput(ff);
    if (hasOverlay) await ff.writeFile('/overlay.png', await overlayPNG(W, H));
    const outro = $('brand-outro').checked ? { path: '/outro.png', dur: 3 } : null;
    if (outro) await ff.writeFile(outro.path, await brandCardPNG(W, H, state.logo, OUTRO));
    setProgress('render-progress', 0, 'Montage du short…');
    const strength = +$('zoom').value;
    const zoomed = clips.map(c => ({ ...c, zoom: strength > 1 ? clipZoom(c, strength) : null }));
    const args = buildRenderArgs({
      input: state.inputPath, clips: zoomed, hasAudio: state.hasAudio, layout: $('layout').value,
      width: W, height: H, overlay: hasOverlay ? '/overlay.png' : null, outro,
      zoom: strength > 1 ? zoomSize(state.srcW, state.srcH) : null,
      maxKbps: uploadKbps(total, W), output: '/short.mp4',
    });
    const errors = [];
    const code = await runWithLog(ff, args, line => {
      const t = parseLogTime(line);
      if (t != null) setProgress('render-progress', t / total, `Montage du short… ${Math.round(t)} s / ${Math.round(total)} s`);
      if (/error|invalid|failed/i.test(line)) errors.push(line);
    });
    if (code !== 0) throw new Error(errors.slice(-2).join(' · ') || `ffmpeg a échoué (code ${code})`);
    const data = await ff.readFile('/short.mp4');
    await ff.deleteFile('/short.mp4');
    if (hasOverlay) await ff.deleteFile('/overlay.png');
    if (outro) await ff.deleteFile(outro.path);
    const blob = new Blob([data], { type: 'video/mp4' });
    showResult(blob);
    setProgress('render-progress', 1, `Short prêt · ${Math.round(total)} s · ${(blob.size / 1e6).toFixed(1)} Mo`);
  } catch (err) {
    console.error(err);
    showError('Montage impossible : ' + (err.message || err));
  } finally {
    state.busy = false;
    $('btn-render').disabled = false;
  }
}

// Rendu rapide (WebCodecs + Mediabunny). Renvoie null si le navigateur ne sait pas faire :
// render() passe alors au montage ffmpeg.wasm, plus lent mais qui marche partout.
async function renderFast(clips, W, H, hasOverlay, total) {
  if (!fastRenderAvailable()) return null;
  try {
    setProgress('render-progress', 0, 'Montage rapide du short…');
    const strength = +$('zoom').value;
    const outro = $('brand-outro').checked
      ? { image: await createImageBitmap(new Blob([await brandCardPNG(W, H, state.logo, OUTRO)], { type: 'image/png' })), dur: 3 }
      : null;
    return await renderShortFast({
      file: state.file,
      clips: clips.map(c => ({ start: c.start, dur: c.dur, cropX: c.cropX, zoom: strength > 1 ? clipZoom(c, strength) : null })),
      layout: $('layout').value, width: W, height: H,
      overlay: hasOverlay ? await overlayCanvas(W, H) : null, outro,
      maxKbps: uploadKbps(total, W),
      onProgress: r => setProgress('render-progress', r, `Montage rapide du short… ${Math.round(r * total)} s / ${Math.round(total)} s`),
    });
  } catch (err) {
    console.warn('Rendu rapide impossible, passage à ffmpeg :', err);
    return null;
  }
}

// Panier : zoom progressif vers le filet pendant les ~2 s avant que le ballon rentre.
// Autre moment : léger zoom avant au centre sur toute la durée.
function clipZoom(c, strength) {
  if (c.basket && c.hoop && Number.isFinite(c.tb)) {
    const tb = c.tb - c.start;
    const t0 = Math.max(0, tb - 2.2);
    return { max: strength, hx: c.hoop.x, hy: Math.min(0.95, c.hoop.y + 0.03), t0, t1: Math.max(t0 + 0.4, tb - 0.3) };
  }
  return { max: 1 + (strength - 1) * 0.35, hx: 0.5, hy: 0.5, t0: 0, t1: c.dur };
}

function showResult(blob) {
  const name = `${slugify($('title').value, 'gravity-highlights')}.mp4`;
  const url = offerFile(blob, name, { download: 'btn-download', share: 'btn-share', title: $('title').value || 'Gravity Basketball', text: currentCaption });
  const out = $('result-video');
  if (out.src) URL.revokeObjectURL(out.src);
  out.src = url;
  $('result').hidden = false;
  setVideo(blob);
  offerDrive(blob, name, currentCaption);
}
