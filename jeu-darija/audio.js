// Voix (enregistrements des parents ou voix de la tablette), petits sons et musique de fond.
// Tout est généré dans le navigateur : aucun fichier audio à télécharger.
import { speakable } from './core.js';
import { settings, getRec } from './store.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Voix ----------
const synth = window.speechSynthesis;
let voices = [];
const loadVoices = () => { voices = synth ? synth.getVoices() : []; };
loadVoices();
synth?.addEventListener?.('voiceschanged', loadVoices);
export function voiceFor(lang) {
  const list = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
  if (lang === 'fr') return list.find((v) => /fr-ca/i.test(v.lang)) || list.find((v) => /fr-fr/i.test(v.lang)) || list[0];
  return list.find((v) => /ar-(ma|dz)/i.test(v.lang)) || list[0];
}

let sayToken = 0;
let currentAudio = null;
export let speaking = false;
export function stopVoice() {
  sayToken++;
  try { synth?.cancel(); } catch { /* rien */ }
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  setSpeaking(false);
}
function setSpeaking(v) { speaking = v; duck(v); }

function speak(text, lang = 'fr', rate = 0.95) {
  return new Promise((resolve) => {
    if (!synth || !text) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    const v = voiceFor(lang);
    if (v) u.voice = v;
    u.lang = v?.lang || (lang === 'fr' ? 'fr-FR' : 'ar');
    u.rate = rate;
    u.pitch = lang === 'fr' ? 1.05 : 1;
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
  // Les phrases du jardin sont les mêmes partout : un seul enregistrement suffit.
  const rec = (await getRec(word.id + ':' + d)) || (word.phrase ? await getRec(word.id + ':' + (d === 'ma' ? 'dz' : 'ma')) : null);
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
let ac = null, master = null, musicBus = null;
export function audio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
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
    if (kind === 'chest') { [523, 784, 1047, 1568].forEach((f, i) => tone(f, i * 0.1, 0.5, 'sine', 0.1)); noise(0, 0.6, 0.05, 6000, 0.5); }
  } catch { /* pas de son */ }
}

// ---------- Musique de fond (rythme maghrébin, mélodie pentatonique facultative) ----------
// Motif de 8 croches : D = doum, t = tek, . = silence.
const PATTERN = ['D', '.', 't', 't', 'D', '.', 't', '.'];
const SCALE = [293.7, 349.2, 392, 440, 523.3, 587.3]; // ré, fa, sol, la, do, ré
let musicTimer = null, step = 0, nextTime = 0, melodyNote = 2;
const BPM = 100;
function pluck(freq, t0, vol) {
  // Corde pincée façon oud (deux oscillateurs légèrement désaccordés, extinction rapide).
  tone(freq, t0, 0.9, 'triangle', vol, musicBus);
  tone(freq * 2.003, t0, 0.4, 'sine', vol * 0.35, musicBus);
}
function schedule() {
  const spb = 60 / BPM / 2;
  while (nextTime < ac.currentTime + 0.2) {
    const t0 = nextTime - ac.currentTime;
    const s = PATTERN[step % PATTERN.length];
    if (s === 'D') doum(t0, 0.45, musicBus);
    if (s === 't') tek(t0, 0.22, musicBus);
    if (settings.music === 'full' && step % 2 === 0 && Math.random() < 0.6) {
      melodyNote = Math.max(0, Math.min(SCALE.length - 1, melodyNote + [-1, 0, 1, 1, -1, 2, -2][Math.floor(Math.random() * 7)]));
      pluck(SCALE[melodyNote], t0, 0.12);
    }
    step++;
    nextTime += spb;
  }
}
let musicLevel = 0;
export function startMusic() {
  if (settings.music === 'off') return stopMusic();
  try {
    audio();
    musicLevel = 0.22;
    musicBus.gain.setTargetAtTime(speaking ? musicLevel * 0.3 : musicLevel, ac.currentTime, 0.4);
    if (!musicTimer) { nextTime = ac.currentTime + 0.1; musicTimer = setInterval(schedule, 50); }
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
