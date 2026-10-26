// Module « Sous-titres » d'Art craft : transcription automatique (Whisper dans le navigateur),
// correction du texte, incrustation aux couleurs Gravity (ffmpeg.wasm) et export SRT / VTT.
import { $, showError, setProgress, getFFmpeg, mountFiles, runWithLog, parseLogTime, parseLogDuration, offerFile, slugify } from './common.js';
import { BRAND } from './brand.js';
import { splitCues, toSRT, toVTT, parseSubtitles, cueAt, cueConcatList, buildBurnArgs, STYLES } from './soustitres-core.js';
import { MODELS, SAMPLE_RATE, loadTranscriber, transcribe } from './whisper.js';

const MOUNT = '/st';
const state = { file: null, duration: 0, w: 0, h: 0, raw: null, cues: [], busy: false };

Object.entries(MODELS).forEach(([k, m]) => $('model').add(new Option(m.label, k)));
Object.entries(STYLES).forEach(([k, s]) => $('style').add(new Option(s.label, k)));

const video = $('video');
const overlay = $('overlay');

// ---------- Vidéo ----------
$('file').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  showError('');
  state.file = file;
  state.raw = null;
  state.cues = [];
  $('result').hidden = true;
  video.src = URL.createObjectURL(file);
  $('stage').hidden = false;
  $('step-transcribe').hidden = false;
  $('video-info').textContent = 'Lecture de la vidéo…';
  try {
    await probe(file);
    $('video-info').textContent = `${file.name} · ${fmt(state.duration)} · ${state.w} × ${state.h}`;
  } catch (err) {
    showError(err.message);
  }
  renderCues();
});

// Durée et dimensions affichées (rotation des téléphones comprise) : par le navigateur si
// possible, sinon par ffmpeg (vidéos HEVC que le navigateur ne lit pas).
async function probe(file) {
  const fromBrowser = await new Promise(res => {
    const done = () => res(video.videoWidth ? { w: video.videoWidth, h: video.videoHeight, d: video.duration } : null);
    if (video.readyState >= 1) return done();
    video.addEventListener('loadedmetadata', done, { once: true });
    video.addEventListener('error', () => res(null), { once: true });
    setTimeout(() => res(null), 4000);
  });
  if (fromBrowser && Number.isFinite(fromBrowser.d)) {
    Object.assign(state, { w: fromBrowser.w, h: fromBrowser.h, duration: fromBrowser.d });
  } else {
    const ff = await getFFmpeg('progress');
    const [path] = await mountFiles(ff, MOUNT, [file]);
    let w = 0, h = 0, d = 0, rot = 0;
    await runWithLog(ff, ['-hide_banner', '-i', path], line => {
      const dd = parseLogDuration(line);
      if (dd != null) d = dd;
      const m = /Video:.*?(\d{2,5})x(\d{2,5})/.exec(line);
      if (m && !w) { w = +m[1]; h = +m[2]; }
      const r = /rotation of (-?\d+)/.exec(line) || /rotate\s*:\s*(-?\d+)/.exec(line);
      if (r) rot = Math.abs(+r[1]) % 180;
    });
    if (rot === 90) [w, h] = [h, w];
    Object.assign(state, { w: w || 1080, h: h || 1920, duration: d });
    $('progress').hidden = true;
  }
  state.w = Math.round(state.w / 2) * 2;
  state.h = Math.round(state.h / 2) * 2;
  // Aperçu : le calque des sous-titres a les proportions de la vidéo.
  const k = Math.min(1, 720 / Math.max(state.w, state.h));
  overlay.width = Math.round(state.w * k);
  overlay.height = Math.round(state.h * k);
  $('stage').style.aspectRatio = `${state.w} / ${state.h}`;
}

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtPrecise = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

// ---------- Transcription ----------
async function extractAudio() {
  const ff = await getFFmpeg('progress');
  const [path] = await mountFiles(ff, MOUNT, [state.file]);
  setProgress('progress', 0, 'Extraction du son…');
  const total = state.duration || 1;
  const code = await runWithLog(ff, ['-i', path, '-vn', '-ac', '1', '-ar', String(SAMPLE_RATE), '-f', 'f32le', '/st-audio.pcm'], line => {
    const t = parseLogTime(line);
    if (t != null) setProgress('progress', t / total, `Extraction du son… ${Math.round(t)} s`);
  });
  if (code !== 0) throw new Error('Pas de son lisible dans cette vidéo.');
  const data = await ff.readFile('/st-audio.pcm');
  await ff.deleteFile('/st-audio.pcm');
  return new Float32Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 4));
}

$('btn-transcribe').addEventListener('click', async () => {
  if (state.busy || !state.file) return;
  if (state.duration > 30 * 60) { showError('Vidéo trop longue pour les sous-titres (30 min au plus) : coupe d\'abord l\'extrait voulu dans l\'Éditeur.'); return; }
  state.busy = true;
  $('btn-transcribe').disabled = true;
  showError('');
  try {
    const audio = await extractAudio();
    const entry = await loadTranscriber($('model').value, (r, label) => setProgress('progress', r, label));
    setProgress('progress', 0, entry.device === 'webgpu' ? 'Transcription (carte graphique)…' : 'Transcription (processeur, plus lent)…');
    state.raw = await transcribe(entry, audio, {
      language: $('language').value || null,
      onProgress: (r, label) => setProgress('progress', r, label),
    });
    if (!state.raw.length) throw new Error('Aucune parole détectée dans cette vidéo.');
    resplit();
    setProgress('progress', 1, `${state.cues.length} sous-titres créés${entry.words ? '' : ' (heure par phrase : vérifie le calage)'}`);
  } catch (err) {
    console.error(err);
    showError('Transcription impossible : ' + (err.message || err));
  } finally {
    state.busy = false;
    $('btn-transcribe').disabled = false;
  }
});

function resplit() {
  const n = +$('words').value;
  state.cues = splitCues(state.raw, { maxWords: n, maxChars: n >= 8 ? 42 : n * 9 + 6 });
  renderCues();
}
$('words').addEventListener('change', () => {
  if (!state.raw) return;
  if (state.cues.some(c => c.edited) && !confirm('Redécouper efface tes corrections. Continuer ?')) return;
  resplit();
});

$('srt-file').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  const cues = parseSubtitles(await f.text());
  if (!cues.length) { showError('Aucun sous-titre lisible dans ce fichier.'); return; }
  showError('');
  state.raw = null;
  state.cues = cues;
  renderCues();
  e.target.value = '';
});

// ---------- Édition ----------
function renderCues() {
  const list = $('cues');
  list.innerHTML = '';
  state.cues.forEach((c, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <button class="tool when" type="button" title="Aller à ce moment">${fmtPrecise(c.start)}</button>
      <input class="t" type="number" step="0.1" min="0" aria-label="Début (s)">
      <input class="t" type="number" step="0.1" min="0" aria-label="Fin (s)">
      <input class="txt" maxlength="120" aria-label="Texte">
      <button class="tool" type="button" data-a="del" title="Supprimer">✕</button>`;
    const [a, z] = li.querySelectorAll('input.t');
    const txt = li.querySelector('input.txt');
    a.value = c.start.toFixed(1);
    z.value = c.end.toFixed(1);
    txt.value = c.text;
    li.querySelector('.when').onclick = () => { video.currentTime = c.start + 0.01; drawOverlay(); };
    a.onchange = () => { c.start = Math.max(0, +a.value || 0); c.end = Math.max(c.end, c.start + 0.1); c.edited = true; sortCues(); };
    z.onchange = () => { c.end = Math.max(c.start + 0.1, +z.value || 0); c.edited = true; refreshExports(); drawOverlay(); };
    txt.oninput = () => { c.text = txt.value; c.edited = true; refreshExports(); drawOverlay(); };
    li.querySelector('[data-a="del"]').onclick = () => { state.cues.splice(i, 1); renderCues(); };
    list.appendChild(li);
  });
  const has = state.cues.length > 0;
  $('step-edit').hidden = !has;
  $('step-export').hidden = !has;
  refreshExports();
  drawOverlay();
}
function sortCues() {
  state.cues.sort((x, y) => x.start - y.start);
  renderCues();
}
$('btn-add').onclick = () => {
  const t = video.currentTime || 0;
  state.cues.push({ start: t, end: Math.min(t + 1.5, state.duration || t + 1.5), text: 'Nouveau sous-titre', edited: true });
  sortCues();
};
const shift = d => { state.cues.forEach(c => { c.start = Math.max(0, c.start + d); c.end = Math.max(c.start + 0.1, c.end + d); }); renderCues(); };
$('btn-shift-minus').onclick = () => shift(-0.1);
$('btn-shift-plus').onclick = () => shift(0.1);

function refreshExports() {
  const base = slugify(state.file && state.file.name.replace(/\.[^.]+$/, ''), 'sous-titres');
  const set = (id, text, ext, type) => {
    const a = $(id);
    if (a.href && a.href.startsWith('blob:')) URL.revokeObjectURL(a.href);
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = `${base}.${ext}`;
  };
  const cues = state.cues.map(c => ({ ...c, text: displayText(c.text) }));
  set('btn-srt', toSRT(cues), 'srt', 'application/x-subrip');
  set('btn-vtt', toVTT(cues), 'vtt', 'text/vtt');
}

// ---------- Dessin d'un sous-titre (aperçu et export identiques) ----------
const displayText = t => ($('upper').checked ? String(t).toUpperCase() : String(t)).trim();

function wrap(ctx, words, maxW) {
  const lines = [];
  let cur = [];
  for (const w of words) {
    const test = [...cur, w].join(' ');
    if (cur.length && ctx.measureText(test).width > maxW) { lines.push(cur); cur = [w]; } else cur.push(w);
  }
  if (cur.length) lines.push(cur);
  return lines;
}

function drawCue(ctx, W, H, text) {
  ctx.clearRect(0, 0, W, H);
  const t = displayText(text);
  if (!t) return;
  const style = $('style').value;
  let size = Math.round(Math.min(W, H * 0.5625) * +$('size').value * (W > H ? 0.8 : 1));
  ctx.font = `700 ${size}px Oswald, Impact, "Arial Narrow", sans-serif`;
  const words = t.split(/\s+/);
  let lines = wrap(ctx, words, W * 0.86);
  while (lines.length > 3 && size > 12) { size = Math.round(size * 0.85); ctx.font = `700 ${size}px Oswald, Impact, sans-serif`; lines = wrap(ctx, words, W * 0.86); }
  const lh = size * 1.18;
  const pos = $('position').value;
  const cy = pos === 'top' ? H * 0.2 : pos === 'middle' ? H * 0.5 : H * (W > H ? 0.84 : 0.72);
  const y0 = cy - (lines.length * lh) / 2 + lh / 2;
  // Mot clé (style Gravity) : le mot le plus long de 4 lettres ou plus, en orange.
  const key = style === 'gravity' ? words.reduce((b, w) => (w.replace(/\W/g, '').length >= 4 && w.length > (b || '').length ? w : b), null) : null;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  lines.forEach((ln, i) => {
    const y = y0 + i * lh;
    const line = ln.join(' ');
    const lw = ctx.measureText(line).width;
    let x = (W - lw) / 2;
    if (style === 'boite') {
      const pad = size * 0.3;
      ctx.fillStyle = 'rgba(12, 10, 18, 0.78)';
      roundRect(ctx, x - pad, y - lh / 2, lw + pad * 2, lh, size * 0.2);
      ctx.fill();
    }
    ln.forEach((w, j) => {
      const piece = j < ln.length - 1 ? w + ' ' : w;
      if (style !== 'boite') {
        ctx.lineWidth = Math.max(3, size * 0.16);
        ctx.strokeStyle = '#000';
        ctx.strokeText(w, x, y);
      }
      ctx.fillStyle = style === 'jaune' ? '#ffe11a' : (w === key ? BRAND.orange : '#fff');
      ctx.fillText(w, x, y);
      x += ctx.measureText(piece).width;
    });
  });
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

let lastDrawn = null;
function drawOverlay(force = true) {
  const c = cueAt(state.cues, video.currentTime || 0);
  const key = c ? c.text + c.start : '';
  if (!force && key === lastDrawn) return;
  lastDrawn = key;
  drawCue(overlay.getContext('2d'), overlay.width, overlay.height, c ? c.text : '');
}
const loop = () => { drawOverlay(false); if (!video.paused) requestAnimationFrame(loop); };
video.addEventListener('play', loop);
video.addEventListener('seeked', () => drawOverlay());
video.addEventListener('timeupdate', () => drawOverlay(false));
['style', 'position', 'size', 'upper'].forEach(id => $(id).addEventListener('change', () => { drawOverlay(); refreshExports(); }));
document.fonts && document.fonts.load('700 40px Oswald').then(() => drawOverlay()).catch(() => {});

// ---------- Incrustation ----------
$('btn-burn').addEventListener('click', async () => {
  if (state.busy || !state.cues.length) return;
  state.busy = true;
  $('btn-burn').disabled = true;
  $('result').hidden = true;
  showError('');
  const written = [];
  try {
    const ff = await getFFmpeg('burn-progress');
    const [path] = await mountFiles(ff, MOUNT, [state.file]);
    const { w: W, h: H } = state;
    setProgress('burn-progress', 0, 'Préparation des sous-titres…');
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    const png = async () => new Uint8Array(await (await new Promise(r => cv.toBlob(r, 'image/png'))).arrayBuffer());
    const cues = state.cues.filter(c => c.text.trim()).slice().sort((a, b) => a.start - b.start);
    drawCue(ctx, W, H, '');
    await ff.writeFile('/st-blank.png', await png());
    written.push('/st-blank.png');
    const frames = [];
    for (const [i, c] of cues.entries()) {
      drawCue(ctx, W, H, c.text);
      const p = `/st-${i}.png`;
      await ff.writeFile(p, await png());
      written.push(p);
      frames.push(p);
    }
    await ff.writeFile('/st-list.txt', new TextEncoder().encode(cueConcatList(cues, frames, '/st-blank.png', state.duration)));
    written.push('/st-list.txt');
    const total = state.duration || 1;
    const errors = [];
    const code = await runWithLog(ff, buildBurnArgs({ input: path, list: '/st-list.txt', output: '/st-out.mp4' }), line => {
      const t = parseLogTime(line);
      if (t != null) setProgress('burn-progress', t / total, `Incrustation… ${Math.round(t)} s / ${Math.round(total)} s`);
      if (/error|invalid|failed/i.test(line)) errors.push(line);
    });
    if (code !== 0) throw new Error(errors.slice(-2).join(' · ') || `ffmpeg a échoué (code ${code})`);
    const data = await ff.readFile('/st-out.mp4');
    await ff.deleteFile('/st-out.mp4');
    const blob = new Blob([data], { type: 'video/mp4' });
    const name = `${slugify(state.file.name.replace(/\.[^.]+$/, ''), 'video')}-sous-titres.mp4`;
    $('result-video').src = offerFile(blob, name, { download: 'btn-download', share: 'btn-share', title: BRAND.name });
    $('result').hidden = false;
    setProgress('burn-progress', 1, `Vidéo prête · ${(blob.size / 1e6).toFixed(1)} Mo`);
  } catch (err) {
    console.error(err);
    showError('Incrustation impossible : ' + (err.message || err));
  } finally {
    const ff = await getFFmpeg('burn-progress').catch(() => null);
    for (const p of written) { try { await ff.deleteFile(p); } catch { /* rien */ } }
    state.busy = false;
    $('btn-burn').disabled = false;
  }
});
