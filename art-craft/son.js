import { $, showError, setProgress, offerFile } from './common.js';
import { encodeWav, trackSpan, projectDuration, normalizeGain } from './son-core.js';

const state = {
  tracks: [],   // { id, name, buffer, gain, pan, offset, trimStart, trimEnd, fadeIn, fadeOut, mute, solo, clean, bass, mid, treble }
  playing: false,
  position: 0,  // tête de lecture (s)
  recording: null,
};
let nextId = 1;
let ctx = null;
let live = null; // { sources, startedAt, from }

function audioCtx() {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

// ---------- Graphe audio (lecture en direct et export hors ligne) ----------
function audible(t) {
  const anySolo = state.tracks.some(x => x.solo);
  return !t.mute && (!anySolo || t.solo);
}

function buildGraph(ac, destination, when, from) {
  const master = ac.createGain();
  master.gain.value = +$('master').value;
  // Limiteur : empêche la saturation quand plusieurs pistes s'additionnent.
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.15;
  master.connect(limiter).connect(destination);
  const sources = [];
  state.tracks.filter(audible).forEach(t => {
    const { start, end } = trackSpan(t);
    if (from >= end) return;
    const src = ac.createBufferSource();
    src.buffer = t.buffer;
    let node = src;
    if (t.clean) {
      // Nettoyage voix : coupe les graves (souffle, ventilation, chocs), puis
      // compresse pour une voix régulière et présente.
      const hp = ac.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 90;
      const presence = ac.createBiquadFilter();
      presence.type = 'peaking';
      presence.frequency.value = 3000;
      presence.gain.value = 3;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -26;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.2;
      // Le compresseur Web Audio compense déjà le volume (gain de rattrapage automatique) :
      // on le ramène à un niveau proche de l'original.
      const trim = ac.createGain();
      trim.gain.value = 0.5;
      node.connect(hp).connect(presence).connect(comp).connect(trim);
      node = trim;
    }
    // Égaliseur 3 bandes (graves 120 Hz, médiums 1,5 kHz, aigus 6 kHz), en dB.
    [['lowshelf', 120, t.bass], ['peaking', 1500, t.mid], ['highshelf', 6000, t.treble]].forEach(([type, f, db]) => {
      if (!db) return;
      const eq = ac.createBiquadFilter();
      eq.type = type;
      eq.frequency.value = f;
      eq.gain.value = db;
      node.connect(eq);
      node = eq;
    });
    const fade = ac.createGain();
    const gain = ac.createGain();
    gain.gain.value = t.gain;
    const pan = ac.createStereoPanner();
    pan.pan.value = t.pan;
    node.connect(fade).connect(gain).connect(pan).connect(master);

    const delay = Math.max(0, start - from);
    const skip = Math.max(0, from - start);
    const len = end - start;
    const at = when + delay;
    // Fondus exprimés en temps du contexte audio.
    const t0 = at - skip;
    fade.gain.setValueAtTime(1, when);
    if (t.fadeIn > 0 && skip < t.fadeIn) {
      fade.gain.setValueAtTime(skip / t.fadeIn, at);
      fade.gain.linearRampToValueAtTime(1, t0 + t.fadeIn);
    }
    if (t.fadeOut > 0) {
      const fs = Math.max(t0, t0 + len - t.fadeOut);
      if (fs >= at) fade.gain.setValueAtTime(1, fs);
      fade.gain.linearRampToValueAtTime(0, t0 + len);
    }
    src.start(at, t.trimStart + skip, len - skip);
    sources.push(src);
  });
  return { sources, master };
}

// ---------- Transport ----------
function currentPosition() {
  if (!live) return state.position;
  return live.from + (ctx.currentTime - live.startedAt);
}

function play() {
  if (state.playing) return pause();
  const ac = audioCtx();
  ac.resume();
  const when = ac.currentTime + 0.05;
  const { sources } = buildGraph(ac, ac.destination, when, state.position);
  live = { sources, startedAt: when, from: state.position };
  state.playing = true;
  $('btn-play').textContent = '❚❚ Pause';
  tick();
}

function stopSources() {
  if (!live) return;
  live.sources.forEach(s => { try { s.stop(); } catch { /* déjà arrêtée */ } });
  live = null;
}

function pause() {
  state.position = currentPosition();
  stopSources();
  state.playing = false;
  $('btn-play').textContent = '▶ Lecture';
  drawAll();
}

function seek(pos) {
  const wasPlaying = state.playing;
  if (wasPlaying) pause();
  state.position = Math.max(0, pos);
  drawAll();
  if (wasPlaying) play();
}

function tick() {
  if (!state.playing && !state.recording) return;
  const pos = currentPosition();
  if (state.playing && !state.recording && pos >= projectDuration(state.tracks)) {
    pause();
    state.position = 0;
    drawAll();
    return;
  }
  updateClock(pos);
  drawAll(pos);
  requestAnimationFrame(tick);
}

function updateClock(pos) {
  const m = Math.floor(pos / 60), s = pos - m * 60;
  $('clock').textContent = `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

$('btn-play').onclick = play;
$('btn-stop').onclick = () => { if (state.playing) pause(); seek(0); updateClock(0); };
$('master').oninput = () => { if (state.playing) { pause(); play(); } };

// ---------- Pistes ----------
function addTrack(name, buffer, offset = 0) {
  state.tracks.push({
    id: nextId++, name, buffer, gain: 1, pan: 0, offset, trimStart: 0, trimEnd: buffer.duration,
    fadeIn: 0, fadeOut: 0, mute: false, solo: false, clean: false, bass: 0, mid: 0, treble: 0,
  });
  renderTracks();
}

$('files').addEventListener('change', async e => {
  showError('');
  for (const f of e.target.files) {
    try {
      const buffer = await audioCtx().decodeAudioData(await f.arrayBuffer());
      addTrack(f.name, buffer);
    } catch {
      showError(`Pas de son lisible dans « ${f.name} » (format non pris en charge par ce navigateur).`);
    }
  }
  e.target.value = '';
});

function renderTracks() {
  const box = $('tracks');
  box.innerHTML = '';
  state.tracks.forEach(t => {
    const el = document.createElement('div');
    el.className = 'track';
    el.innerHTML = `
      <div class="head">
        <span class="tname"></span>
        <div class="btns">
          <button class="tool${t.mute ? ' on' : ''}" data-a="mute" title="Couper">M</button>
          <button class="tool${t.solo ? ' on' : ''}" data-a="solo" title="Écouter seule">S</button>
          <button class="tool${t.clean ? ' on' : ''}" data-a="clean" title="Nettoyer la voix">Voix ✨</button>
          <button class="tool" data-a="norm" title="Monter le volume au maximum sans saturer">Normaliser</button>
          <button class="tool" data-a="del" title="Supprimer">✕</button>
        </div>
        <label>Volume <input type="range" data-k="gain" min="0" max="2" step="0.05" value="${t.gain}"></label>
        <label>Gauche/Dr. <input type="range" data-k="pan" min="-1" max="1" step="0.1" value="${t.pan}"></label>
        <label>Fondu ↗ <input type="range" data-k="fadeIn" min="0" max="5" step="0.25" value="${t.fadeIn}"></label>
        <label>Fondu ↘ <input type="range" data-k="fadeOut" min="0" max="5" step="0.25" value="${t.fadeOut}"></label>
        <label>Début <input type="range" data-k="trimStart" min="0" max="${t.buffer.duration.toFixed(2)}" step="0.1" value="${t.trimStart}"></label>
        <label>Fin <input type="range" data-k="trimEnd" min="0" max="${t.buffer.duration.toFixed(2)}" step="0.1" value="${t.trimEnd}"></label>
        <label>Graves <input type="range" data-k="bass" min="-12" max="12" step="1" value="${t.bass}"></label>
        <label>Médiums <input type="range" data-k="mid" min="-12" max="12" step="1" value="${t.mid}"></label>
        <label>Aigus <input type="range" data-k="treble" min="-12" max="12" step="1" value="${t.treble}"></label>
      </div>
      <canvas></canvas>`;
    el.querySelector('.tname').textContent = t.name;
    el.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('input', () => {
      const k = inp.dataset.k;
      t[k] = +inp.value;
      if (k === 'trimStart') t.trimStart = Math.min(t.trimStart, t.trimEnd - 0.1);
      if (k === 'trimEnd') t.trimEnd = Math.max(t.trimEnd, t.trimStart + 0.1);
      drawAll();
    }));
    el.querySelectorAll('input[data-k]').forEach(inp => inp.addEventListener('change', () => {
      if (state.playing) { pause(); play(); }
    }));
    el.querySelector('.btns').addEventListener('click', e => {
      const a = e.target.dataset.a;
      if (!a) return;
      if (a === 'del') state.tracks = state.tracks.filter(x => x !== t);
      else if (a === 'norm') {
        const sr = t.buffer.sampleRate;
        const chans = Array.from({ length: t.buffer.numberOfChannels }, (_, i) => t.buffer.getChannelData(i));
        t.gain = normalizeGain(chans, Math.floor(t.trimStart * sr), Math.ceil(t.trimEnd * sr));
      } else t[a] = !t[a];
      if (state.playing) { pause(); play(); }
      renderTracks();
    });
    const cv = el.querySelector('canvas');
    t.canvas = cv;
    attachDrag(cv, t);
    box.appendChild(el);
  });
  const has = state.tracks.length > 0;
  $('empty').hidden = has;
  $('hint').hidden = !has;
  $('step-export').hidden = !has;
  drawAll();
}

// Glisser une piste pour la déplacer dans le temps ; un simple toucher place la tête de lecture.
function attachDrag(cv, t) {
  let startX = null, startOffset = 0, moved = false;
  cv.addEventListener('pointerdown', e => {
    startX = e.clientX;
    startOffset = t.offset;
    moved = false;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (startX == null) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 4) moved = true;
    if (!moved) return;
    const secPerPx = viewDuration() / cv.clientWidth;
    t.offset = Math.max(0, startOffset + dx * secPerPx);
    drawAll();
  });
  cv.addEventListener('pointerup', e => {
    if (startX != null && !moved) {
      const r = cv.getBoundingClientRect();
      seek(((e.clientX - r.left) / r.width) * viewDuration());
      updateClock(state.position);
    } else if (moved && state.playing) { pause(); play(); }
    startX = null;
  });
}

function viewDuration() {
  return Math.max(10, projectDuration(state.tracks) * 1.1);
}

const peaksCache = new WeakMap();
function peaks(buffer, n) {
  const key = peaksCache.get(buffer);
  if (key && key.n === n) return key.data;
  const ch = buffer.getChannelData(0);
  const per = Math.max(1, Math.floor(ch.length / n));
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = i * per; j < (i + 1) * per && j < ch.length; j++) m = Math.max(m, Math.abs(ch[j]));
    data[i] = m;
  }
  peaksCache.set(buffer, { n, data });
  return data;
}

function drawAll(pos = state.position) {
  const view = viewDuration();
  state.tracks.forEach(t => {
    const cv = t.canvas;
    if (!cv || !cv.clientWidth) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const x = s => (s / view) * w;
    // Secondes
    g.fillStyle = 'rgba(255,255,255,.06)';
    for (let s = 0; s < view; s += 5) g.fillRect(x(s), 0, 1, h);
    const full = t.buffer.duration;
    const bx = x(t.offset - t.trimStart), bw = x(full);
    const p = peaks(t.buffer, 1200);
    const { start, end } = trackSpan(t);
    g.fillStyle = audible(t) ? 'rgba(232,103,46,.12)' : 'rgba(255,255,255,.04)';
    g.fillRect(x(start), 2, x(end - start), h - 4);
    for (let px = 0; px < bw; px++) {
      const sx = bx + px;
      if (sx < 0 || sx > w) continue;
      const v = p[Math.floor((px / bw) * p.length)] || 0;
      const sec = t.offset - t.trimStart + (px / bw) * full;
      const inside = sec >= start && sec <= end;
      g.fillStyle = inside ? (audible(t) ? '#e8672e' : '#666') : 'rgba(255,255,255,.12)';
      const bh = Math.max(1, v * (h - 8));
      g.fillRect(sx, (h - bh) / 2, 1, bh);
    }
    g.fillStyle = '#fff';
    g.fillRect(x(pos), 0, 1.5, h);
  });
}
window.addEventListener('resize', () => drawAll());

// ---------- Enregistrement micro ----------
$('btn-rec').onclick = async () => {
  if (state.recording) {
    state.recording.recorder.stop();
    return;
  }
  showError('');
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    showError('Micro inaccessible : autorise le micro pour ce site dans ton navigateur.');
    return;
  }
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  const offset = state.position;
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    const wasPlaying = state.playing;
    if (wasPlaying) pause();
    state.recording = null;
    $('btn-rec').classList.remove('on');
    $('btn-rec').textContent = '● Enregistrer au micro';
    try {
      const blob = new Blob(chunks, { type: recorder.mimeType });
      const buffer = await audioCtx().decodeAudioData(await blob.arrayBuffer());
      addTrack(`Voix ${state.tracks.filter(t => t.name.startsWith('Voix')).length + 1}`, buffer, offset);
      state.tracks[state.tracks.length - 1].clean = true;
      renderTracks();
    } catch (err) {
      console.error(err);
      showError('Enregistrement illisible, réessaie.');
    }
  };
  state.recording = { recorder };
  recorder.start();
  $('btn-rec').classList.add('on');
  $('btn-rec').textContent = '■ Arrêter l\'enregistrement';
  // Les autres pistes jouent pendant l'enregistrement (voix off sur la musique).
  if (!state.playing && state.tracks.length) play();
  else tick();
};

// ---------- Export ----------
$('btn-export').onclick = async () => {
  if (!state.tracks.length) return;
  if (state.playing) pause();
  showError('');
  $('result').hidden = true;
  $('btn-export').disabled = true;
  try {
    const rate = 44100;
    const dur = projectDuration(state.tracks.filter(audible));
    if (!dur) throw new Error('toutes les pistes sont coupées');
    setProgress('export-progress', 0.1, 'Mixage…');
    const off = new OfflineAudioContext(2, Math.ceil(dur * rate), rate);
    buildGraph(off, off.destination, 0, 0);
    const rendered = await off.startRendering();
    setProgress('export-progress', 0.8, 'Encodage WAV…');
    const blob = encodeWav(rendered);
    const url = offerFile(blob, 'art-craft-mix.wav', { download: 'btn-download', share: 'btn-share', title: 'Mix Art craft' });
    $('result-audio').src = url;
    $('result').hidden = false;
    setProgress('export-progress', 1, `Mix prêt · ${dur.toFixed(1)} s · ${(blob.size / 1e6).toFixed(1)} Mo`);
  } catch (err) {
    console.error(err);
    showError('Export impossible : ' + (err.message || err));
  } finally {
    $('btn-export').disabled = false;
  }
};
