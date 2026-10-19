// Générateur de beats (logique pure, aucun accès au DOM ni à l'audio).
// Chaque beat est déterminé par (style, graine) : la même graine redonne le même beat.
// Grille : 4 mesures × 16 doubles-croches = 64 pas.

export const STEPS = 64;
export const NOTE_NAMES = ['Do', 'Do#', 'Ré', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];

const MINOR = [0, 2, 3, 5, 7, 8, 10];

export const STYLES = {
  trap: { label: 'Trap', bpm: [132, 150], swing: 0 },
  drill: { label: 'Drill', bpm: [140, 145], swing: 0 },
  boombap: { label: 'Boom bap', bpm: [86, 94], swing: 0.18 },
  afro: { label: 'Afro / amapiano', bpm: [108, 116], swing: 0.08 },
};

// Suites d'accords en mineur (degrés de la gamme) qui sonnent « rap actuel ».
const PROGRESSIONS = [
  [0, 5, 2, 6], // i VI III VII
  [0, 3, 5, 4], // i iv VI v
  [0, 6, 5, 6], // i VII VI VII
  [0, 5, 3, 4], // i VI iv v
  [0, 0, 5, 4], // i i VI v
];

// Générateur pseudo-aléatoire reproductible (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const chance = (r, p) => r() < p;

// Note de la gamme mineure (degré pouvant dépasser 7) à partir de la tonique MIDI.
export function scaleNote(root, degree) {
  const oct = Math.floor(degree / 7);
  const d = ((degree % 7) + 7) % 7;
  return root + MINOR[d] + 12 * oct;
}

export function chordNotes(root, degree) {
  return [0, 2, 4].map(k => scaleNote(root, degree + k));
}

function emptyGrid() {
  return new Array(STEPS).fill(0);
}

function drums(style, r) {
  const kick = emptyGrid(), snare = emptyGrid(), hat = emptyGrid(), ohat = emptyGrid(), perc = emptyGrid();
  for (let bar = 0; bar < 4; bar++) {
    const o = bar * 16;
    const last = bar === 3;
    if (style === 'trap' || style === 'drill') {
      kick[o] = 1;
      [3, 7, 10, 11, 14].forEach(s => { if (chance(r, style === 'drill' ? 0.3 : 0.35)) kick[o + s] = 1; });
      snare[o + 8] = 1;
      if (style === 'drill') {
        // Drill : caisse claire décalée et fantômes typiques.
        if (bar % 2) { snare[o + 8] = 0; snare[o + 9] = 1; }
        if (chance(r, 0.5)) snare[o + 14] = 1;
        [0, 3, 6, 8, 11, 14].forEach(s => { hat[o + s] = 1; });
        if (chance(r, 0.6)) hat[o + pick(r, [6, 14])] = 3;
      } else {
        for (let s = 0; s < 16; s += 2) hat[o + s] = 1;
        // Roulements de charleston (2, 3 ou 4 coups) : la signature trap.
        const rolls = last ? 3 : 1 + Math.floor(r() * 2);
        for (let k = 0; k < rolls; k++) hat[o + pick(r, [6, 10, 12, 14])] = pick(r, [2, 3, 4]);
        if (chance(r, 0.5)) ohat[o + 15] = 1;
      }
      if (last && chance(r, 0.6)) snare[o + 15] = 1;
    } else if (style === 'boombap') {
      kick[o] = 1;
      kick[o + 10] = 1;
      if (chance(r, 0.5)) kick[o + 7] = 1;
      if (chance(r, 0.3)) kick[o + 3] = 1;
      snare[o + 4] = 1;
      snare[o + 12] = 1;
      for (let s = 0; s < 16; s += 2) hat[o + s] = 1;
      if (chance(r, 0.5)) ohat[o + 14] = 1;
      if (chance(r, 0.4)) perc[o + 15] = 1;
    } else {
      // Afro / amapiano : kick régulier, percussions en 3-3-2, shaker en doubles-croches.
      [0, 8].forEach(s => { kick[o + s] = 1; });
      if (chance(r, 0.5)) kick[o + 11] = 1;
      snare[o + 8] = 1;
      [0, 3, 6, 10, 12].forEach(s => { perc[o + s] = 1; });
      for (let s = 0; s < 16; s++) hat[o + s] = s % 2 ? 1 : 0;
      if (chance(r, 0.6)) ohat[o + 6] = 1;
    }
  }
  return { kick, snare, hat, ohat, perc };
}

function bassline(style, r, root, prog, kick) {
  const notes = [];
  for (let step = 0; step < STEPS; step++) {
    if (!kick[step]) continue;
    const bar = Math.floor(step / 16);
    const degree = prog[bar];
    const options = [degree, degree, degree, degree + 4, degree + 7];
    const midi = scaleNote(root - 12, pick(r, options));
    notes.push({ step, midi, glide: style === 'drill' && chance(r, 0.35) });
  }
  // Longueur : jusqu'à la note suivante (808 tenue).
  notes.forEach((n, i) => {
    const next = notes[i + 1] ? notes[i + 1].step : STEPS;
    n.len = Math.max(1, Math.min(next - n.step, style === 'boombap' ? 4 : 16));
  });
  return notes;
}

// Mélodie : un motif de 2 mesures répété, avec une variation sur la dernière.
function melody(style, r, root, prog) {
  const rhythm = [];
  const density = style === 'boombap' ? 0.3 : style === 'afro' ? 0.45 : 0.4;
  for (let s = 0; s < 32; s++) if ((s % 2 === 0 && chance(r, density)) || s === 0) rhythm.push(s);
  const notes = [];
  for (let rep = 0; rep < 2; rep++) {
    rhythm.forEach((s, i) => {
      const step = rep * 32 + s;
      const bar = Math.floor(step / 16);
      const chord = chordNotes(root + 24, prog[bar]);
      let midi = chord[(i + Math.floor(r() * 2)) % 3];
      if (rep === 1 && s >= 16 && chance(r, 0.4)) midi = scaleNote(root + 24, pick(r, [4, 6, 7]));
      const next = rhythm[i + 1] ?? 32;
      notes.push({ step, midi, len: Math.max(1, Math.min(next - s, 6)) });
    });
  }
  return notes;
}

export function generateBeat(style, seed) {
  const r = rng(seed);
  const cfg = STYLES[style];
  const bpm = Math.round(cfg.bpm[0] + r() * (cfg.bpm[1] - cfg.bpm[0]));
  const key = Math.floor(r() * 12);
  const root = 48 + key; // tonique autour du Do3
  const prog = pick(r, PROGRESSIONS);
  const d = drums(style, r);
  return {
    style, seed, bpm, key, root, prog,
    swing: cfg.swing,
    grid: d,
    bass: bassline(style, r, root - 12, prog, d.kick),
    melody: melody(style, r, root, prog),
    chords: prog.map(deg => chordNotes(root, deg)),
  };
}

export function stepDuration(bpm) {
  return 60 / bpm / 4;
}

// Instant (s) d'un pas dans la boucle, avec le swing sur les doubles-croches paires.
export function stepTime(step, bpm, swing) {
  const d = stepDuration(bpm);
  return step * d + (step % 2 ? swing * d : 0);
}

export function loopDuration(bpm) {
  return STEPS * stepDuration(bpm);
}

export function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}
