import { $, showError, setProgress, offerFile } from './common.js';
import { encodeWav } from './son-core.js';
import {
  STYLES, STEPS, NOTE_NAMES, generateBeat, stepTime, stepDuration, loopDuration, midiToFreq,
} from './beat-core.js';

// Tous les sons sont synthétisés (aucun échantillon) : le beat est 100 % original et libre de droits.
const ROWS = [
  { key: 'kick', label: 'Kick' },
  { key: 'snare', label: 'Snare / clap' },
  { key: 'hat', label: 'Charleston' },
  { key: 'ohat', label: 'Charl. ouvert' },
  { key: 'perc', label: 'Percussion' },
];
const LAYERS = [
  { key: 'drums', label: 'Batterie' },
  { key: 'bass', label: '808 / basse' },
  { key: 'chords', label: 'Accords' },
  { key: 'melody', label: 'Mélodie' },
];

const state = {
  beat: null,
  mute: { drums: false, bass: false, chords: false, melody: false },
  volume: { drums: 0.9, bass: 0.9, chords: 0.35, melody: 0.45 },
  playing: false,
};

const styleSel = $('style');
Object.entries(STYLES).forEach(([k, s]) => styleSel.add(new Option(s.label, k)));

// ---------- Synthèse ----------
const noiseCache = new WeakMap();
function noiseBuffer(ac) {
  if (noiseCache.has(ac)) return noiseCache.get(ac);
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseCache.set(ac, buf);
  return buf;
}

function env(ac, dest, t, attack, decay, peak = 1) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  g.connect(dest);
  return g;
}

function noise(ac, t, dur) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  src.start(t, Math.random() * 0.5, dur);
  return src;
}

const DRUMS = {
  kick(ac, dest, t) {
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    o.connect(env(ac, dest, t, 0.002, 0.35, 1));
    o.start(t);
    o.stop(t + 0.4);
  },
  snare(ac, dest, t, style) {
    const f = ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = style === 'boombap' ? 1800 : 1400;
    f.Q.value = 0.8;
    // Clap : trois petites rafales de bruit.
    const bursts = style === 'boombap' ? [0] : [0, 0.012, 0.024];
    bursts.forEach((d, i) => {
      const n = noise(ac, t + d, 0.3);
      n.connect(env(ac, f, t + d, 0.001, i === bursts.length - 1 ? 0.2 : 0.012, 0.9));
    });
    f.connect(dest);
    const o = ac.createOscillator();
    o.frequency.value = 190;
    o.connect(env(ac, dest, t, 0.001, 0.08, 0.35));
    o.start(t);
    o.stop(t + 0.12);
  },
  hat(ac, dest, t, style, open = false) {
    const f = ac.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const n = noise(ac, t, open ? 0.35 : 0.06);
    n.connect(f);
    f.connect(env(ac, dest, t, 0.001, open ? 0.28 : 0.04, open ? 0.3 : 0.35));
  },
  perc(ac, dest, t) {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(820, t);
    o.frequency.exponentialRampToValueAtTime(600, t + 0.05);
    o.connect(env(ac, dest, t, 0.001, 0.09, 0.4));
    o.start(t);
    o.stop(t + 0.12);
  },
};

const shaperCurve = (() => {
  const c = new Float32Array(1024);
  for (let i = 0; i < c.length; i++) { const x = i / 512 - 1; c[i] = Math.tanh(2.2 * x); }
  return c;
})();

function play808(ac, dest, t, note, nextNote, dur) {
  const o = ac.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(midiToFreq(note.midi), t);
  if (note.glide && nextNote) o.frequency.exponentialRampToValueAtTime(midiToFreq(nextNote.midi), t + dur * 0.9);
  const sh = ac.createWaveShaper();
  sh.curve = shaperCurve;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.9, t + 0.005);
  g.gain.setValueAtTime(0.9, t + Math.max(0.01, dur - 0.08));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(sh).connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function playTone(ac, dest, t, midi, dur, { type = 'triangle', attack = 0.005, peak = 0.3, cutoff = 3500, detune = 0 }) {
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(cutoff, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(300, cutoff / 4), t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(dest);
  [-detune, detune].forEach(dt => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = midiToFreq(midi);
    o.detune.value = dt;
    o.connect(f);
    o.start(t);
    o.stop(t + dur + 0.05);
  });
}

function reverbImpulse(ac, seconds = 2.2) {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

// Chaîne de mixage : une entrée par couche, réverbe partagée, limiteur final.
function buildMixer(ac, destination) {
  const master = ac.createGain();
  master.gain.value = +$('master').value;
  // Marge avant le limiteur : le compresseur Web Audio ajoute lui-même du gain
  // de compensation, sans cette marge le mix sature.
  const headroom = ac.createGain();
  headroom.gain.value = 0.45;
  const limiter = ac.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.12;
  master.connect(headroom).connect(limiter).connect(destination);
  const verb = ac.createConvolver();
  verb.buffer = reverbImpulse(ac);
  const verbGain = ac.createGain();
  verbGain.gain.value = 0.25;
  verb.connect(verbGain).connect(master);
  const layers = {};
  LAYERS.forEach(({ key }) => {
    const g = ac.createGain();
    g.gain.value = state.mute[key] ? 0 : state.volume[key];
    g.connect(master);
    if (key === 'chords' || key === 'melody') g.connect(verb);
    layers[key] = g;
  });
  return { master, layers };
}

// Programme une boucle complète de 4 mesures à partir de l'instant t0.
function scheduleLoop(ac, mix, beat, t0, from = 0, to = STEPS) {
  const { bpm, swing } = beat;
  const sd = stepDuration(bpm);
  for (let step = from; step < to; step++) {
    const t = t0 + stepTime(step, bpm, swing);
    ROWS.forEach(({ key }) => {
      const v = beat.grid[key][step];
      if (!v) return;
      if (key === 'hat' && v > 1) {
        for (let k = 0; k < v; k++) DRUMS.hat(ac, mix.layers.drums, t + (k * sd) / v, beat.style);
      } else if (key === 'ohat') {
        DRUMS.hat(ac, mix.layers.drums, t, beat.style, true);
      } else {
        DRUMS[key](ac, mix.layers.drums, t, beat.style);
      }
    });
    beat.bass.forEach((n, i) => {
      if (n.step === step) play808(ac, mix.layers.bass, t, n, beat.bass[i + 1], n.len * sd);
    });
    beat.melody.forEach(n => {
      if (n.step === step) {
        const pluck = beat.style === 'boombap' ? { type: 'sine', peak: 0.35, cutoff: 2500 } : { type: 'triangle', peak: 0.3, cutoff: 5000, detune: 7 };
        playTone(ac, mix.layers.melody, t, n.midi, Math.max(0.2, n.len * sd * 1.6), pluck);
      }
    });
    if (step % 16 === 0) {
      beat.chords[step / 16].forEach(m => playTone(ac, mix.layers.chords, t, m, 16 * sd, { type: 'sawtooth', attack: 0.25, peak: 0.12, cutoff: 1400, detune: 9 }));
    }
  }
}

// ---------- Lecture en direct ----------
let ac = null;
let live = null; // { mix, start, nextStep, timer }

function liveCtx() {
  if (!ac) ac = new AudioContext();
  return ac;
}

function play() {
  if (state.playing) return stop();
  const ctx = liveCtx();
  ctx.resume();
  const mix = buildMixer(ctx, ctx.destination);
  const start = ctx.currentTime + 0.08;
  live = { mix, start, scheduled: 0 };
  // Programmation par petits morceaux, quelques dixièmes de seconde à l'avance.
  const pump = () => {
    const beat = state.beat;
    const loop = loopDuration(beat.bpm);
    const horizon = ctx.currentTime + 0.25;
    while (live && live.start + stepTime(live.scheduled % STEPS, beat.bpm, beat.swing) + Math.floor(live.scheduled / STEPS) * loop < horizon) {
      const n = live.scheduled;
      scheduleLoop(ctx, live.mix, beat, live.start + Math.floor(n / STEPS) * loop, n % STEPS, n % STEPS + 1);
      live.scheduled++;
    }
  };
  pump();
  live.timer = setInterval(pump, 40);
  state.playing = true;
  $('btn-play').textContent = '■ Stop';
  drawPlayhead();
}

function stop() {
  if (live) {
    clearInterval(live.timer);
    live.mix.master.gain.setTargetAtTime(0, ac.currentTime, 0.02);
    const m = live.mix.master;
    setTimeout(() => m.disconnect(), 300);
  }
  live = null;
  state.playing = false;
  $('btn-play').textContent = '▶ Écouter';
  document.querySelectorAll('.grid .now').forEach(el => el.classList.remove('now'));
}

function restartIfPlaying() {
  if (state.playing) { stop(); play(); }
}

function drawPlayhead() {
  if (!live) return;
  const beat = state.beat;
  const loop = loopDuration(beat.bpm);
  const pos = ((ac.currentTime - live.start) % loop + loop) % loop;
  const step = Math.min(STEPS - 1, Math.floor(pos / stepDuration(beat.bpm)));
  document.querySelectorAll('.grid .now').forEach(el => el.classList.remove('now'));
  document.querySelectorAll(`.grid [data-step="${step}"]`).forEach(el => el.classList.add('now'));
  requestAnimationFrame(drawPlayhead);
}

// ---------- Interface ----------
function newSeed() {
  return Math.floor(Math.random() * 1e9);
}

function generate(seed = newSeed()) {
  const beat = generateBeat(styleSel.value, seed);
  if ($('bpm-lock').checked && state.beat) beat.bpm = state.beat.bpm;
  state.beat = beat;
  $('bpm').value = beat.bpm;
  $('bpm-val').textContent = beat.bpm;
  $('seed').value = seed;
  $('info').textContent = `${STYLES[beat.style].label} · ${beat.bpm} BPM · ${NOTE_NAMES[beat.key]} mineur`;
  renderGrid();
  restartIfPlaying();
}

function renderGrid() {
  const g = $('grid');
  g.innerHTML = '';
  ROWS.forEach(({ key, label }) => {
    const row = document.createElement('div');
    row.className = 'grow';
    row.innerHTML = `<span class="glabel">${label}</span>`;
    const cells = document.createElement('div');
    cells.className = 'cells';
    for (let s = 0; s < STEPS; s++) {
      const b = document.createElement('button');
      const v = state.beat.grid[key][s];
      b.dataset.step = s;
      b.className = (v ? 'on' : '') + (s % 4 === 0 ? ' beat' : '') + (s % 16 === 0 ? ' bar' : '');
      if (v > 1) b.textContent = v;
      b.title = key === 'hat' ? 'Toucher : on/off · on → roulement ×2, ×3, ×4' : 'Toucher : on/off';
      b.onclick = () => {
        const cur = state.beat.grid[key][s];
        state.beat.grid[key][s] = key === 'hat' ? (cur >= 4 ? 0 : cur + 1) : (cur ? 0 : 1);
        if (key === 'kick') state.beat.bass = rebuildBass();
        renderGrid();
      };
      cells.appendChild(b);
    }
    row.appendChild(cells);
    g.appendChild(row);
  });
}

// Quand on modifie le kick, la 808 suit (même graine → mêmes notes autant que possible).
function rebuildBass() {
  const b = state.beat;
  const fresh = generateBeat(b.style, b.seed);
  fresh.grid = b.grid;
  const notes = [];
  for (let step = 0; step < STEPS; step++) {
    if (!b.grid.kick[step]) continue;
    const old = fresh.bass.find(n => n.step === step) || b.bass.find(n => n.step <= step && n.step + n.len > step) || fresh.bass[0];
    notes.push({ step, midi: old ? old.midi : b.root - 24, glide: !!(old && old.glide) });
  }
  notes.forEach((n, i) => {
    const next = notes[i + 1] ? notes[i + 1].step : STEPS;
    n.len = Math.max(1, Math.min(next - n.step, b.style === 'boombap' ? 4 : 16));
  });
  return notes;
}

function renderLayers() {
  const box = $('layers');
  LAYERS.forEach(({ key, label }) => {
    const el = document.createElement('label');
    el.className = 'layer';
    el.innerHTML = `<input type="checkbox" checked> ${label} <input type="range" min="0" max="1.5" step="0.05" value="${state.volume[key]}">`;
    const [cb, vol] = el.querySelectorAll('input');
    cb.onchange = () => { state.mute[key] = !cb.checked; applyLayer(key); };
    vol.oninput = () => { state.volume[key] = +vol.value; applyLayer(key); };
    box.appendChild(el);
  });
}

function applyLayer(key) {
  if (live) live.mix.layers[key].gain.setTargetAtTime(state.mute[key] ? 0 : state.volume[key], ac.currentTime, 0.02);
}

$('btn-generate').onclick = () => generate();
$('btn-play').onclick = play;
styleSel.onchange = () => { $('bpm-lock').checked = false; generate(); };
$('bpm').oninput = e => {
  state.beat.bpm = +e.target.value;
  $('bpm-val').textContent = state.beat.bpm;
  $('bpm-lock').checked = true;
  $('info').textContent = `${STYLES[state.beat.style].label} · ${state.beat.bpm} BPM · ${NOTE_NAMES[state.beat.key]} mineur`;
};
$('bpm').onchange = restartIfPlaying;
$('btn-seed').onclick = () => {
  const s = parseInt($('seed').value, 10);
  if (Number.isFinite(s)) generate(s);
};
$('master').oninput = () => { if (live) live.mix.master.gain.setTargetAtTime(+$('master').value, ac.currentTime, 0.02); };

// ---------- Export ----------
$('btn-export').onclick = async () => {
  showError('');
  $('result').hidden = true;
  $('btn-export').disabled = true;
  try {
    const beat = state.beat;
    const loop = loopDuration(beat.bpm);
    const want = $('length').value;
    const dur = want === 'loop' ? loop : +want;
    const rate = 44100;
    setProgress('export-progress', 0.1, 'Mixage du beat…');
    const off = new OfflineAudioContext(2, Math.ceil((dur + 0.05) * rate), rate);
    const mix = buildMixer(off, off.destination);
    for (let k = 0; k * loop < dur; k++) scheduleLoop(off, mix, beat, k * loop);
    if (want !== 'loop') {
      mix.master.gain.setValueAtTime(+$('master').value, Math.max(0, dur - 1.5));
      mix.master.gain.linearRampToValueAtTime(0, dur);
    }
    const rendered = await off.startRendering();
    setProgress('export-progress', 0.85, 'Encodage WAV…');
    const blob = encodeWav(rendered);
    const name = `beat-${beat.style}-${beat.bpm}bpm-${beat.seed}.wav`;
    const url = offerFile(blob, name, { download: 'btn-download', share: 'btn-share', title: 'Beat Art craft' });
    $('result-audio').src = url;
    $('result').hidden = false;
    setProgress('export-progress', 1, `Beat prêt · ${dur.toFixed(1)} s · ${(blob.size / 1e6).toFixed(1)} Mo`);
  } catch (err) {
    console.error(err);
    showError('Export impossible : ' + (err.message || err));
  } finally {
    $('btn-export').disabled = false;
  }
};

renderLayers();
generate();
