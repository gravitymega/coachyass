import { $, showError, setProgress, offerFile, slugify } from './common.js';
import { encodeWav } from './son-core.js';
import {
  STYLES, STEPS, NOTE_NAMES, generateBeat, stepTime, stepDuration, loopDuration, midiToFreq,
} from './beat-core.js';
import {
  OPENVERSE, THEMES, FILTERS, searchParams, normalizeResults, mergeResults, creditLine, detectBpm, syncTempo,
} from './music-core.js';

// Tous les sons sont synthétisés (aucun échantillon) : le beat est 100 % original et libre de droits.
const ROWS = [
  { key: 'kick', label: 'Kick' },
  { key: 'snare', label: 'Snare / clap' },
  { key: 'hat', label: 'Charleston' },
  { key: 'ohat', label: 'Charl. ouvert' },
  { key: 'perc', label: 'Percussion' },
];
// Noms des lignes selon le style (mêmes lignes, autres instruments).
const ROW_LABELS = {
  gnawa: { kick: 'Tbel', snare: 'Claps', hat: 'Qraqeb', ohat: 'Qraqeb long' },
  afrotrad: { kick: 'Dundun', snare: 'Djembé slap', hat: 'Shaker', ohat: 'Shaker long', perc: 'Djembé ton' },
};
const LAYER_LABELS = {
  gnawa: { bass: 'Guembri', melody: 'Chant (anche)', chords: 'Bourdon' },
  afrotrad: { bass: 'Basse pincée', melody: 'Kalimba' },
};
const LAYERS = [
  { key: 'drums', label: 'Batterie' },
  { key: 'bass', label: '808 / basse' },
  { key: 'chords', label: 'Accords' },
  { key: 'melody', label: 'Mélodie' },
  { key: 'music', label: 'Musique' },
];

const state = {
  beat: null,
  mute: { drums: false, bass: false, chords: false, melody: false, music: false },
  volume: { drums: 0.9, bass: 0.9, chords: 0.35, melody: 0.45, music: 1 },
  playing: false,
  // Musique libre de droits : { track, buffer, start, len, speed, filter, loop, bpm }
  music: null,
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

// Sons des styles africains : mêmes lignes de la grille, autres instruments.
const KITS = {
  gnawa: {
    // Tbel : gros tambour grave, peau frappée.
    kick(ac, dest, t) {
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(110, t);
      o.frequency.exponentialRampToValueAtTime(58, t + 0.18);
      o.connect(env(ac, dest, t, 0.002, 0.45, 1));
      o.start(t);
      o.stop(t + 0.5);
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      noise(ac, t, 0.08).connect(f);
      f.connect(env(ac, dest, t, 0.001, 0.05, 0.5));
    },
    // Qraqeb : paires de crotales en fer, chaque coup est un léger « fla ».
    hat(ac, dest, t, style, open = false) {
      [0, 0.011].forEach((d, i) => {
        const f = ac.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = i ? 5200 : 3900;
        f.Q.value = 5;
        noise(ac, t + d, 0.2).connect(f);
        f.connect(env(ac, dest, t + d, 0.001, open ? 0.22 : 0.07, i ? 0.55 : 0.75));
        [2870, 4130].forEach(fr => {
          const o = ac.createOscillator();
          o.type = 'square';
          o.frequency.value = fr * (i ? 1.02 : 1);
          o.connect(env(ac, dest, t + d, 0.001, open ? 0.15 : 0.04, 0.05));
          o.start(t + d);
          o.stop(t + d + 0.25);
        });
      });
    },
  },
  afrotrad: {
    // Dundun : tambour basse joué à la baguette.
    kick(ac, dest, t) {
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(72, t + 0.1);
      o.connect(env(ac, dest, t, 0.002, 0.3, 0.95));
      o.start(t);
      o.stop(t + 0.35);
    },
    // Slap de djembé : claquant, aigu.
    snare(ac, dest, t) {
      const f = ac.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1100;
      f.Q.value = 1.2;
      noise(ac, t, 0.12).connect(f);
      f.connect(env(ac, dest, t, 0.001, 0.09, 0.9));
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(330, t + 0.06);
      o.connect(env(ac, dest, t, 0.001, 0.07, 0.4));
      o.start(t);
      o.stop(t + 0.1);
    },
    // Ton de djembé : rond, médium.
    perc(ac, dest, t) {
      const o = ac.createOscillator();
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(190, t + 0.12);
      o.connect(env(ac, dest, t, 0.002, 0.18, 0.7));
      o.start(t);
      o.stop(t + 0.22);
    },
    // Shaker (graines).
    hat(ac, dest, t, style, open = false) {
      const f = ac.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 5000;
      noise(ac, t, open ? 0.2 : 0.08).connect(f);
      f.connect(env(ac, dest, t, 0.012, open ? 0.14 : 0.05, 0.25));
    },
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

// Guembri (luth basse gnawa) : corde pincée grave, un peu de « buzz » métallique.
function playPluckBass(ac, dest, t, midi, dur, buzz = true) {
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(1600, t);
  f.frequency.exponentialRampToValueAtTime(220, t + Math.min(0.35, dur));
  f.Q.value = 2;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.8, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.15, dur * 1.3));
  let out = f;
  if (buzz) {
    const sh = ac.createWaveShaper();
    sh.curve = shaperCurve;
    f.connect(sh);
    out = sh;
  }
  out.connect(g).connect(dest);
  ['sawtooth', 'square'].forEach((type, i) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = midiToFreq(midi);
    o.detune.value = i ? 6 : 0;
    o.connect(f);
    o.start(t);
    o.stop(t + dur * 1.3 + 0.2);
  });
}

// Kalimba / balafon : note pincée et brève, avec un partiel aigu qui s'éteint vite.
function playKalimba(ac, dest, t, midi, dur) {
  [[1, 0.35, Math.min(1.2, dur * 2)], [5.4, 0.08, 0.08]].forEach(([mult, peak, dec]) => {
    const o = ac.createOscillator();
    o.frequency.value = midiToFreq(midi) * mult;
    o.connect(env(ac, dest, t, 0.002, dec, peak));
    o.start(t);
    o.stop(t + dec + 0.05);
  });
}

// Voix lead façon chant gnawa (anche, vibrato) pour les réponses mélodiques.
function playReed(ac, dest, t, midi, dur) {
  const o = ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = midiToFreq(midi);
  const lfo = ac.createOscillator();
  lfo.frequency.value = 5.5;
  const depth = ac.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(18, t + Math.min(0.3, dur));
  lfo.connect(depth).connect(o.detune);
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1300;
  f.Q.value = 0.9;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.04);
  g.gain.setValueAtTime(0.35, t + Math.max(0.05, dur - 0.08));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(dest);
  [o, lfo].forEach(n => { n.start(t); n.stop(t + dur + 0.05); });
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
  const kit = KITS[beat.style] || {};
  const drum = key => kit[key] || DRUMS[key];
  for (let step = from; step < to; step++) {
    const t = t0 + stepTime(step, bpm, swing);
    ROWS.forEach(({ key }) => {
      const v = beat.grid[key][step];
      if (!v) return;
      if (key === 'hat' && v > 1) {
        for (let k = 0; k < v; k++) drum('hat')(ac, mix.layers.drums, t + (k * sd) / v, beat.style);
      } else if (key === 'ohat') {
        drum('hat')(ac, mix.layers.drums, t, beat.style, true);
      } else {
        drum(key)(ac, mix.layers.drums, t, beat.style);
      }
    });
    beat.bass.forEach((n, i) => {
      if (n.step !== step) return;
      if (beat.style === 'gnawa') playPluckBass(ac, mix.layers.bass, t, n.midi, n.len * sd);
      else if (beat.style === 'afrotrad') playPluckBass(ac, mix.layers.bass, t, n.midi + 12, n.len * sd, false);
      else play808(ac, mix.layers.bass, t, n, beat.bass[i + 1], n.len * sd);
    });
    beat.melody.forEach(n => {
      if (n.step !== step) return;
      if (beat.style === 'gnawa') playReed(ac, mix.layers.melody, t, n.midi - 12, Math.max(0.2, n.len * sd * 1.4));
      else if (beat.style === 'afrotrad') playKalimba(ac, mix.layers.melody, t, n.midi, n.len * sd);
      else {
        const pluck = beat.style === 'boombap' ? { type: 'sine', peak: 0.35, cutoff: 2500 } : { type: 'triangle', peak: 0.3, cutoff: 5000, detune: 7 };
        playTone(ac, mix.layers.melody, t, n.midi, Math.max(0.2, n.len * sd * 1.6), pluck);
      }
    });
    if (step % 16 === 0) {
      beat.chords[step / 16].forEach(m => playTone(ac, mix.layers.chords, t, m, 16 * sd, { type: 'sawtooth', attack: 0.25, peak: 0.12, cutoff: 1400, detune: 9 }));
    }
  }
}

// Musique libre de droits : partie choisie, vitesse, filtre, en boucle ou non.
const driveCurve = (() => {
  const c = new Float32Array(1024);
  for (let i = 0; i < c.length; i++) { const x = i / 512 - 1; c[i] = Math.tanh(1.6 * x) / Math.tanh(1.6); }
  return c;
})();

function startMusic(ctx, mix, t0, maxDur) {
  const m = state.music;
  if (!m) return;
  const src = ctx.createBufferSource();
  src.buffer = m.buffer;
  src.playbackRate.value = m.speed;
  let node = src;
  const preset = FILTERS[m.filter] || FILTERS.none;
  preset.nodes.forEach(spec => {
    const f = ctx.createBiquadFilter();
    f.type = spec.type;
    f.frequency.value = spec.f;
    if (spec.Q) f.Q.value = spec.Q;
    if (spec.gain) f.gain.value = spec.gain;
    node.connect(f);
    node = f;
  });
  if (preset.drive) {
    const sh = ctx.createWaveShaper();
    sh.curve = driveCurve;
    node.connect(sh);
    node = sh;
  }
  // Petits fondus pour éviter les clics au début et à la fin.
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(1, t0 + 0.03);
  node.connect(g).connect(mix.layers.music);
  if (m.loop) {
    src.loop = true;
    src.loopStart = m.start;
    src.loopEnd = m.start + m.len;
    src.start(t0, m.start);
    if (maxDur) src.stop(t0 + maxDur);
  } else {
    const end = t0 + m.len / m.speed;
    g.gain.setValueAtTime(1, Math.max(t0 + 0.03, end - 0.06));
    g.gain.linearRampToValueAtTime(0, end);
    src.start(t0, m.start, m.len);
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
  startMusic(ctx, mix, start);
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
function beatInfo(b) {
  return `${STYLES[b.style].label} · ${b.bpm} BPM · ${NOTE_NAMES[b.key]} ${STYLES[b.style].mode || 'mineur'}`;
}

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
  $('info').textContent = beatInfo(beat);
  document.querySelectorAll('#layers .layer').forEach(el => {
    const def = LAYERS.find(l => l.key === el.dataset.layer).label;
    el.querySelector('.lname').textContent = (LAYER_LABELS[beat.style] || {})[el.dataset.layer] || def;
  });
  renderGrid();
  restartIfPlaying();
}

function renderGrid() {
  const g = $('grid');
  g.innerHTML = '';
  ROWS.forEach(({ key, label }) => {
    const row = document.createElement('div');
    row.className = 'grow';
    row.innerHTML = `<span class="glabel">${(ROW_LABELS[state.beat.style] || {})[key] || label}</span>`;
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
  // Le riff de guembri ne suit pas le tambour : il reste tel quel.
  if (b.style === 'gnawa') return b.bass;
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
    el.dataset.layer = key;
    el.hidden = key === 'music' && !state.music;
    el.innerHTML = `<input type="checkbox" checked> <span class="lname">${label}</span> <input type="range" min="0" max="1.5" step="0.05" value="${state.volume[key]}">`;
    const [cb, vol] = el.querySelectorAll('input');
    cb.onchange = () => { state.mute[key] = !cb.checked; applyLayer(key); };
    el.sync = () => { cb.checked = !state.mute[key]; };
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
  $('info').textContent = beatInfo(state.beat);
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
    const m = state.music;
    const dur = want === 'loop' ? loop : want === 'music' ? (m ? m.len / m.speed : loop) : +want;
    const rate = 44100;
    setProgress('export-progress', 0.1, 'Mixage du beat…');
    const off = new OfflineAudioContext(2, Math.ceil((dur + 0.05) * rate), rate);
    const mix = buildMixer(off, off.destination);
    for (let k = 0; k * loop < dur; k++) scheduleLoop(off, mix, beat, k * loop);
    startMusic(off, mix, 0, dur);
    if (want !== 'loop') {
      mix.master.gain.setValueAtTime(+$('master').value, Math.max(0, dur - 1.5));
      mix.master.gain.linearRampToValueAtTime(0, dur);
    }
    const rendered = await off.startRendering();
    setProgress('export-progress', 0.85, 'Encodage WAV…');
    const blob = encodeWav(rendered);
    const name = m
      ? `mix-${slugify(m.track.title, 'musique').slice(0, 40)}-${Math.round(beat.bpm)}bpm.wav`
      : `beat-${beat.style}-${beat.bpm}bpm-${beat.seed}.wav`;
    $('credit-reminder').hidden = !(m && m.track.needsCredit);
    $('credit-reminder').textContent = m && m.track.needsCredit
      ? `Ce morceau est sous ${m.track.licenseLabel} : colle le crédit (étape 2) dans la description de ta vidéo.`
      : '';
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

// ---------- Bibliothèque libre de droits ----------
const FUNC = '/.netlify/functions/music';
const lib = { q: [], page: 1, pages: 1, results: [], previewId: null };
const preview = $('lib-preview');
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

THEMES.forEach(t => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = t.label;
  b.onclick = () => {
    document.querySelectorAll('#themes button').forEach(x => x.classList.toggle('on', x === b));
    const qs = [].concat(t.q);
    $('q').value = qs[0];
    search(qs);
  };
  $('themes').appendChild(b);
});
Object.entries(FILTERS).forEach(([k, f]) => $('m-filter').add(new Option(f.label, k)));

// Openverse d'abord en direct ; si le navigateur est bloqué (CORS, réseau), via la fonction Netlify.
async function fetchJSON(direct, relay) {
  try {
    const r = await fetch(direct);
    if (r.ok) return await r.json();
    if (r.status === 429) throw Object.assign(new Error('Trop de recherches : réessaie dans une minute.'), { final: true });
  } catch (err) {
    if (err.final) throw err;
  }
  const r = await fetch(relay);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Recherche impossible (${r.status})`);
  return j;
}

// q : un mot-clé, ou une liste (thème) dont les résultats sont fusionnés.
async function search(q, page = 1) {
  const list = [].concat(q).map(x => String(x || '').trim()).filter(Boolean);
  if (!list.length) return;
  const license = $('lic').value;
  lib.q = list;
  lib.page = page;
  $('lib-status').textContent = 'Recherche…';
  $('btn-more').hidden = true;
  try {
    const jsons = await Promise.all(list.map(one => fetchJSON(
      `${OPENVERSE}?${searchParams({ q: one, license, page })}`,
      `${FUNC}?action=search&${new URLSearchParams({ q: one, license, page: String(page) })}`,
    )));
    const found = mergeResults(jsons.map(j => normalizeResults(j, license)));
    const known = new Set(page === 1 ? [] : lib.results.map(t => t.id));
    lib.results = (page === 1 ? [] : lib.results).concat(found.filter(t => !known.has(t.id)));
    lib.pages = Math.max(...jsons.map(j => j.page_count || 1));
    renderResults();
    const total = jsons.reduce((n, j) => n + (j.result_count || 0), 0);
    const label = list.length > 1 ? list.join(', ') : list[0];
    $('lib-status').textContent = lib.results.length
      ? `${total || lib.results.length} morceaux trouvés pour « ${label} »`
      : `Rien trouvé pour « ${label} » : essaie un autre mot (en anglais, ça marche mieux).`;
    $('btn-more').hidden = !(lib.page < lib.pages && found.length);
  } catch (err) {
    $('lib-status').textContent = '';
    showError(err.message || String(err));
  }
}

function renderResults() {
  const ul = $('tracks');
  ul.innerHTML = '';
  lib.results.forEach(t => {
    const li = document.createElement('li');
    li.classList.toggle('sel', !!(state.music && state.music.track.id === t.id));
    const play = document.createElement('button');
    play.textContent = lib.previewId === t.id && !preview.paused ? '■' : '▶';
    play.title = 'Écouter';
    play.onclick = () => togglePreview(t);
    const name = document.createElement('span');
    name.className = 'name';
    name.innerHTML = '<b></b><small></small>';
    name.querySelector('b').textContent = t.title;
    name.querySelector('small').textContent = `${t.creator}${t.duration ? ' · ' + fmt(t.duration) : ''} · ${t.source}`;
    const badge = document.createElement('span');
    badge.className = 'badge' + (t.needsCredit ? '' : ' free');
    badge.textContent = t.licenseLabel;
    badge.title = t.needsCredit ? 'Libre, à condition de citer l\'auteur' : 'Aucune condition';
    const use = document.createElement('button');
    use.textContent = state.music && state.music.track.id === t.id ? 'Choisi ✔' : 'Utiliser';
    use.onclick = () => useTrack(t, use);
    li.append(play, name, badge, use);
    ul.appendChild(li);
  });
}

function togglePreview(t) {
  if (lib.previewId === t.id && !preview.paused) {
    preview.pause();
  } else {
    if (state.playing) stop();
    lib.previewId = t.id;
    preview.src = t.url;
    preview.play().catch(() => showError('Écoute impossible pour ce morceau.'));
  }
  renderResults();
}
preview.onended = preview.onpause = () => renderResults();

async function fetchAudio(url) {
  try {
    const r = await fetch(url);
    if (r.ok) return await r.arrayBuffer();
  } catch { /* CORS : on passe par la fonction */ }
  const r = await fetch(`${FUNC}?action=file&url=${encodeURIComponent(url)}`);
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `Téléchargement impossible (${r.status})`);
  }
  return r.arrayBuffer();
}

async function useTrack(t, btn) {
  showError('');
  btn.disabled = true;
  btn.textContent = 'Chargement…';
  try {
    const data = await fetchAudio(t.url);
    const buffer = await liveCtx().decodeAudioData(data);
    // Tempo estimé sur les 90 premières secondes (mono).
    const n = Math.min(buffer.length, Math.floor(buffer.sampleRate * 90));
    const mono = new Float32Array(n);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = buffer.getChannelData(c);
      for (let i = 0; i < n; i++) mono[i] += d[i] / buffer.numberOfChannels;
    }
    const bpm = detectBpm(mono, buffer.sampleRate);
    preview.pause();
    state.music = {
      track: t, buffer, bpm,
      start: 0, len: Math.min(buffer.duration, 180), speed: 1, filter: 'none', loop: false,
    };
    state.mute.music = false;
    musicUI();
    document.querySelectorAll('#layers .layer').forEach(el => { if (el.dataset.layer === 'music') { el.hidden = false; el.sync(); } });
    $('length').querySelector('option[value="music"]').hidden = false;
    $('length').value = 'music';
    renderResults();
    $('music-edit').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    restartIfPlaying();
  } catch (err) {
    console.error(err);
    showError('Ce morceau ne peut pas être chargé : ' + (err.message || err) + '. Essaie-en un autre.');
    renderResults();
  }
}

function musicUI() {
  const m = state.music;
  $('music-edit').hidden = !m;
  if (!m) return;
  const total = m.buffer.duration;
  m.start = Math.max(0, Math.min(m.start, total - 1));
  m.len = Math.max(0.5, Math.min(m.len, total - m.start));
  $('m-title').textContent = `${m.track.title} — ${m.track.creator}`;
  $('m-lic').textContent = `${m.track.licenseLabel} · ${m.track.needsCredit ? 'libre, à condition de citer l\'auteur' : 'domaine public, aucune condition'} · ${fmt(total)}`;
  $('m-start').max = Math.max(0, total - 0.5).toFixed(2);
  $('m-start').value = m.start;
  $('m-start-v').textContent = m.start.toFixed(2) + ' s';
  $('m-len').max = Math.max(0.5, total - m.start).toFixed(2);
  $('m-len').min = 0.5;
  $('m-len').value = m.len;
  $('m-len-v').textContent = m.len.toFixed(2) + ' s' + (m.speed !== 1 ? ` (${(m.len / m.speed).toFixed(1)} s joués)` : '');
  $('m-speed').value = m.speed;
  $('m-speed-v').textContent = '×' + m.speed.toFixed(2);
  $('m-filter').value = m.filter;
  $('m-loop').checked = m.loop;
  $('m-bpm').textContent = m.bpm ? `${m.bpm} BPM${m.speed !== 1 ? ` (${(m.bpm * m.speed).toFixed(1)} à cette vitesse)` : ''}` : 'non détecté';
  $('m-credit').value = creditLine(m.track);
}

const musicInput = (id, key, parse = Number) => {
  $(id).addEventListener('input', () => { if (state.music) { state.music[key] = parse($(id).value); musicUI(); } });
  $(id).addEventListener('change', restartIfPlaying);
};
musicInput('m-start', 'start');
musicInput('m-len', 'len');
musicInput('m-speed', 'speed');
musicInput('m-filter', 'filter', String);
$('m-loop').onchange = () => { if (state.music) { state.music.loop = $('m-loop').checked; musicUI(); restartIfPlaying(); } };
document.querySelectorAll('[data-nudge]').forEach(b => b.addEventListener('click', () => {
  if (!state.music) return;
  state.music.start = Math.max(0, state.music.start + +b.dataset.nudge);
  musicUI();
  restartIfPlaying();
}));
$('m-half').onclick = () => { if (state.music && state.music.bpm) { state.music.bpm = Math.round(state.music.bpm * 5) / 10; musicUI(); } };
$('m-double').onclick = () => { if (state.music && state.music.bpm) { state.music.bpm = Math.round(state.music.bpm * 20) / 10; musicUI(); } };
$('m-sync').onclick = () => {
  const m = state.music;
  const s = m && syncTempo(m.bpm, m.speed);
  if (!s) { showError('Tempo de la musique non détecté : règle le tempo de la batterie à l\'oreille.'); return; }
  showError('');
  state.beat.bpm = s.bpm;
  $('bpm').value = s.bpm;
  $('bpm-val').textContent = s.bpm;
  $('bpm-lock').checked = true;
  $('info').textContent = beatInfo(state.beat);
  m.loop = true;
  m.len = Math.min(s.loopSource, m.buffer.duration - m.start);
  musicUI();
  restartIfPlaying();
};
$('m-drums').onclick = () => {
  ['bass', 'chords', 'melody'].forEach(k => { state.mute[k] = true; applyLayer(k); });
  state.mute.drums = false;
  applyLayer('drums');
  document.querySelectorAll('#layers .layer').forEach(el => el.sync && el.sync());
};
$('m-copy').onclick = async () => {
  try { await navigator.clipboard.writeText($('m-credit').value); $('m-copy').textContent = 'Copié ✔'; } catch { $('m-credit').select(); }
  setTimeout(() => { $('m-copy').textContent = 'Copier le crédit'; }, 1500);
};
$('m-remove').onclick = () => {
  state.music = null;
  musicUI();
  document.querySelectorAll('#layers .layer').forEach(el => { if (el.dataset.layer === 'music') el.hidden = true; });
  $('length').querySelector('option[value="music"]').hidden = true;
  if ($('length').value === 'music') $('length').value = '60';
  renderResults();
  restartIfPlaying();
};
$('btn-search').onclick = () => {
  document.querySelectorAll('#themes button').forEach(x => x.classList.remove('on'));
  search($('q').value);
};
$('q').addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-search').click(); });
$('lic').onchange = () => { if (lib.q.length) search(lib.q); };
$('btn-more').onclick = () => search(lib.q, lib.page + 1);

renderLayers();
generate();
