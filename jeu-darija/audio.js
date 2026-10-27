// Voix (enregistrements des parents ou voix de la tablette), petits sons et musique de fond.
// Tout est généré dans le navigateur : aucun fichier audio à télécharger.
import { speakable } from './core.js';
import { fixFr, voiceKey } from './voix.js';
import { settings, getRec } from './store.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Voix ----------
const synth = window.speechSynthesis;
let voices = [];
const loadVoices = () => { voices = synth ? synth.getVoices() : []; };
loadVoices();
synth?.addEventListener?.('voiceschanged', loadVoices);
// Les voix les plus naturelles d'abord (voix « premium », « naturelles » ou en ligne), féminines et douces de préférence.
const NICE = /premium|enhanced|améliorée|natural|neural|online|google|siri/i;
const SOFT = /amélie|audrey|aurélie|marie|denise|sylvie|chantal|julie|céline|hortense|virginie|léa|eloise|élise|joséphine|vivienne|female|femme/i;
const score = (v) => (NICE.test(v.name) ? 6 : 0) + (SOFT.test(v.name) ? 3 : 0) + (/fr-ca/i.test(v.lang) ? 1 : 0) + (v.localService ? 1 : 0);
export const frVoices = () => voices.filter((v) => v.lang?.toLowerCase().startsWith('fr')).sort((a, b) => score(b) - score(a));
export function voiceFor(lang) {
  if (lang === 'fr') {
    const list = frVoices();
    return list.find((v) => v.name === settings.frVoice) || list[0];
  }
  const list = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
  return list.find((v) => /ar-(ma|dz)/i.test(v.lang)) || list[0];
}

// ---------- Voix enregistrée de Hbibiti ----------
// voix/index.json liste les phrases enregistrées à l'avance (outils/voix) ; les autres passent par la voix de la tablette.
let recorded = new Set();
fetch('voix/index.json').then((r) => (r.ok ? r.json() : [])).then((keys) => { recorded = new Set(keys); }).catch(() => {});
export const recordedKeys = () => [...recorded];
export const isRecorded = (text) => recorded.has(voiceKey(text));
const buffers = new Map();
async function loadBuffer(key) {
  if (buffers.has(key)) return buffers.get(key);
  const p = fetch(`voix/${key}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('absent'))))
    .then((b) => audio().decodeAudioData(b));
  buffers.set(key, p);
  if (buffers.size > 60) buffers.delete(buffers.keys().next().value);
  p.catch(() => buffers.delete(key));
  return p;
}
// Prépare à l'avance les phrases qui vont être dites (pas d'attente au moment de parler).
export function preload(texts) {
  if (settings.voice === 'tablette') return;
  for (const t of texts) if (typeof t === 'string' && isRecorded(t)) loadBuffer(voiceKey(t)).catch(() => {});
}
let currentSrc = null;
async function playRecorded(text) {
  const tok = sayToken;
  const buf = await loadBuffer(voiceKey(text));
  if (tok !== sayToken) return; // annulé pendant le chargement
  await new Promise((resolve) => {
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(voiceBus);
    src.onended = resolve;
    currentSrc = src;
    src.start();
  });
  currentSrc = null;
}

let sayToken = 0;
let currentAudio = null;
export let speaking = false;
export function stopVoice() {
  sayToken++;
  try { synth?.cancel(); } catch { /* rien */ }
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if (currentSrc) { try { currentSrc.onended?.(); currentSrc.stop(); } catch { /* déjà fini */ } currentSrc = null; }
  setSpeaking(false);
}
function setSpeaking(v) {
  speaking = v;
  duck(v);
  // Les personnages « qui parlent » bougent la bouche pendant ce temps (characters.js).
  window.dispatchEvent(new CustomEvent('hbibiti-speaking', { detail: v }));
}

async function speak(text, lang = 'fr', rate = 0.92) {
  if (lang === 'fr' && text && settings.voice !== 'tablette' && isRecorded(text)) {
    try { return await playRecorded(text); } catch { /* fichier introuvable : voix de la tablette */ }
  }
  return speakTablet(lang === 'fr' ? fixFr(text) : text, lang, rate);
}
function speakTablet(text, lang, rate) {
  return new Promise((resolve) => {
    if (!synth || !text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = voiceFor(lang);
    if (v) u.voice = v;
    u.lang = v?.lang || (lang === 'fr' ? 'fr-FR' : 'ar');
    u.rate = rate;
    u.pitch = lang === 'fr' ? 1.08 : 1;
    let done = false;
    const end = () => { if (!done) { done = true; resolve(); } };
    u.onend = end; u.onerror = end;
    setTimeout(end, 1500 + text.length * 110); // certains navigateurs oublient « onend »
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
export async function playWord(word, d) {
  const tok = sayToken;
  // Les phrases du jardin sont les mêmes partout : un seul enregistrement suffit.
  const rec = (await getRec(word.id + ':' + d)) || (word.phrase ? await getRec(word.id + ':' + (d === 'ma' ? 'dz' : 'ma')) : null);
  if (tok !== sayToken) return;
  if (rec) return playBlob(rec);
  if (voiceFor('ar')) return speak(word[d].ar, 'ar', 0.8);
  return speak(speakable(word[d].lat), 'fr', 0.8);
}
export const hasRecording = async (word, d) => !!(await getRec(word.id + ':' + d));

// Suite de phrases (texte), de mots ({ word, d }) et de pauses (nombre de ms), annulée si une autre commence.
export async function say(...parts) {
  stopVoice();
  const tok = sayToken;
  setSpeaking(true);
  for (const p of parts) {
    if (tok !== sayToken) return;
    if (typeof p === 'number') await wait(p);
    else if (typeof p === 'string') await speak(p);
    else if (p?.word) await playWord(p.word, p.d);
  }
  if (tok === sayToken) setSpeaking(false);
}

// ---------- Moteur audio ----------
let ac = null, master = null, musicBus = null, voiceBus = null;
export function audio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    voiceBus = ac.createGain(); voiceBus.gain.value = 1; voiceBus.connect(ac.destination);
    musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function tone(freq, t0, dur, type = 'sine', vol = 0.18, dest = master, bend = 0) {
  const o = ac.createOscillator(), g = ac.createGain();
  const t = ac.currentTime + t0;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function noise(t0, dur, vol, freq, q = 1, dest = master, type = 'bandpass') {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  const t = ac.currentTime + t0;
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t); s.stop(t + dur + 0.02);
}
// Sons de darbouka : « doum » grave et « tek » sec.
function doum(t0, vol = 0.5, dest = master) { tone(110, t0, 0.35, 'sine', vol, dest, 0.6); noise(t0, 0.06, vol * 0.3, 300, 1, dest); }
function tek(t0, vol = 0.3, dest = master) { noise(t0, 0.07, vol, 3200, 1.5, dest); tone(700, t0, 0.04, 'triangle', vol * 0.3, dest); }

export function sfx(kind) {
  if (!settings.sfx) return;
  try {
    audio();
    if (kind === 'ok') [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.08, 0.28, 'triangle', 0.16));
    if (kind === 'miss') { tone(330, 0, 0.18, 'sine', 0.1); tone(262, 0.16, 0.3, 'sine', 0.1); }
    if (kind === 'whistle') { tone(2300, 0, 0.1, 'sine', 0.07); tone(2300, 0.14, 0.32, 'sine', 0.07); }
    if (kind === 'tap') tone(900, 0, 0.05, 'triangle', 0.06);
    if (kind === 'pop') tone(600, 0, 0.12, 'sine', 0.12, master, 2);
    if (kind === 'swish') noise(0, 0.35, 0.25, 2500, 0.7);
    if (kind === 'kick') { tone(90, 0, 0.15, 'sine', 0.4, master, 0.5); noise(0, 0.05, 0.2, 1200); }
    if (kind === 'bounce') tone(160, 0, 0.12, 'sine', 0.3, master, 0.7);
    if (kind === 'cheer') { for (let i = 0; i < 6; i++) noise(i * 0.05, 1.2, 0.07, 1000 + i * 300, 0.6); }
    if (kind === 'door') { tone(200, 0, 0.4, 'sawtooth', 0.04, master, 1.5); noise(0, 0.3, 0.06, 600); }
    if (kind === 'doum') doum(0, 0.6);
    if (kind === 'tek') tek(0, 0.4);
    if (kind === 'chime') [1319, 1568, 1976].forEach((f, i) => tone(f, i * 0.12, 0.8, 'sine', 0.08));
    if (kind === 'win') [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.32, 'triangle', 0.15));
    if (kind === 'giggle') [880, 1100, 990, 1320, 1180].forEach((f, i) => tone(f, i * 0.07, 0.09, 'sine', 0.09, master, 1.15));
    if (kind === 'roar') { tone(140, 0, 0.5, 'sawtooth', 0.06, master, 0.6); noise(0, 0.45, 0.12, 400, 0.8); }
    if (kind === 'boing') tone(220, 0, 0.35, 'sine', 0.18, master, 3);
    if (kind === 'beep') { tone(1200, 0, 0.08, 'square', 0.05); tone(1600, 0.1, 0.12, 'square', 0.05); }
    if (kind === 'drum') { doum(0, 0.6); tek(0.15, 0.35); tek(0.3, 0.35); }
    if (kind === 'chest') { [523, 784, 1047, 1568].forEach((f, i) => tone(f, i * 0.1, 0.5, 'sine', 0.1)); noise(0, 0.6, 0.05, 6000, 0.5); }
  } catch { /* pas de son */ }
}

// ---------- Musique de fond ----------
// « doux » (par défaut) : berceuse très douce, boîte à musique et nappe légère, pour jouer et écouter les histoires.
// « perc » : rythme de darbouka ; « full » : darbouka et mélodie façon oud ; « off » : rien.
// Motif de 8 croches : D = doum, t = tek, . = silence.
const PATTERN = ['D', '.', 't', 't', 'D', '.', 't', '.'];
const SCALE = [293.7, 349.2, 392, 440, 523.3, 587.3]; // ré, fa, sol, la, do, ré
let musicTimer = null, step = 0, nextTime = 0, melodyNote = 2, style = 'perc';
function pluck(freq, t0, vol) {
  // Corde pincée façon oud (deux oscillateurs légèrement désaccordés, extinction rapide).
  tone(freq, t0, 0.9, 'triangle', vol, musicBus);
  tone(freq * 2.003, t0, 0.4, 'sine', vol * 0.35, musicBus);
}
// Boîte à musique : note claire qui s'éteint lentement.
function bell(freq, t0, vol) {
  tone(freq, t0, 2.2, 'sine', vol, musicBus);
  tone(freq * 2, t0, 1.2, 'sine', vol * 0.18, musicBus);
  tone(freq * 3.01, t0, 0.5, 'sine', vol * 0.06, musicBus);
}
// Nappe : accord tenu, très doux, filtré (attaque et fin lentes).
function pad(freqs, t0, dur, vol) {
  const t = ac.currentTime + t0;
  const f = ac.createBiquadFilter(), g = ac.createGain();
  f.type = 'lowpass'; f.frequency.value = 900;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  f.connect(g).connect(musicBus);
  for (const fr of freqs) for (const det of [-4, 4]) {
    const o = ac.createOscillator();
    o.type = 'triangle'; o.frequency.value = fr; o.detune.value = det;
    o.connect(f); o.start(t); o.stop(t + dur + 0.1);
  }
}
// Berceuse en fa majeur pentatonique : fa, sol, la, do, ré. Accords : Fa, Ré m, Si♭, Do.
const LULL = [349.2, 392, 440, 523.3, 587.3, 698.5, 784, 880];
const CHORDS = [[174.6, 220, 261.6], [146.8, 174.6, 220], [116.5, 146.8, 174.6], [130.8, 164.8, 196]];
function scheduleSoft() {
  const spb = 60 / 66; // une noire, tempo lent
  while (nextTime < ac.currentTime + 0.3) {
    const t0 = nextTime - ac.currentTime;
    if (step % 8 === 0) pad(CHORDS[(step / 8) % CHORDS.length], t0, spb * 8.4, 0.035);
    if (step % 2 === 0 || Math.random() < 0.35) {
      melodyNote = Math.max(0, Math.min(LULL.length - 1, melodyNote + [-1, 0, 1, 1, -1, 2, -2][Math.floor(Math.random() * 7)]));
      bell(LULL[melodyNote], t0, step % 8 === 0 ? 0.09 : 0.06);
    }
    step++;
    nextTime += spb;
  }
}
function schedule() {
  if (style === 'doux') return scheduleSoft();
  const spb = 60 / BPM / 2;
  while (nextTime < ac.currentTime + 0.2) {
    const t0 = nextTime - ac.currentTime;
    const s = PATTERN[step % PATTERN.length];
    if (s === 'D') doum(t0, 0.45, musicBus);
    if (s === 't') tek(t0, 0.22, musicBus);
    if (style === 'full' && step % 2 === 0 && Math.random() < 0.6) {
      melodyNote = Math.max(0, Math.min(SCALE.length - 1, melodyNote + [-1, 0, 1, 1, -1, 2, -2][Math.floor(Math.random() * 7)]));
      pluck(SCALE[melodyNote], t0, 0.12);
    }
    step++;
    nextTime += spb;
  }
}
const BPM = 100;
let musicLevel = 0;
// soft : forcer la berceuse (histoires, missions), quel que soit le style choisi.
export function startMusic(soft = false) {
  if (settings.music === 'off') return stopMusic();
  try {
    audio();
    const want = soft ? 'doux' : settings.music;
    if (want !== style) { style = want; step = 0; melodyNote = 2; }
    musicLevel = style === 'doux' ? (soft ? 0.5 : 0.6) : 0.22;
    musicBus.gain.setTargetAtTime(speaking ? musicLevel * 0.3 : musicLevel, ac.currentTime, 0.6);
    if (!musicTimer) { nextTime = ac.currentTime + 0.1; musicTimer = setInterval(schedule, 60); }
  } catch { /* pas de son */ }
}
export function stopMusic() {
  musicLevel = 0;
  if (musicBus) musicBus.gain.setTargetAtTime(0, ac.currentTime, 0.3);
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}
// La musique baisse quand quelqu'un parle.
function duck(on) {
  if (!musicBus || !musicLevel) return;
  musicBus.gain.setTargetAtTime(on ? musicLevel * 0.3 : musicLevel, ac.currentTime, 0.15);
}
