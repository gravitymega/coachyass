// Voix gratuites Piper (open source, licence MIT) : logique pure, testable avec Node.
// La synthèse se fait dans le navigateur (piper.js) : aucun compte, aucune clé, aucun serveur.
import { splitText } from './voice-core.js';

// Voix françaises de rhasspy/piper-voices. speaker = n° du locuteur pour les modèles à plusieurs voix.
export const FREE_VOICES = [
  { id: 'piper:fr_FR-tom-medium', name: 'Tom (homme)', key: 'fr_FR-tom-medium', speaker: 0, mb: 64 },
  { id: 'piper:fr_FR-upmc-medium#1', name: 'Pierre (homme)', key: 'fr_FR-upmc-medium', speaker: 1, mb: 77 },
  { id: 'piper:fr_FR-siwis-medium', name: 'Siwis (femme)', key: 'fr_FR-siwis-medium', speaker: 0, mb: 63 },
  { id: 'piper:fr_FR-upmc-medium#0', name: 'Jessica (femme)', key: 'fr_FR-upmc-medium', speaker: 0, mb: 77 },
  { id: 'piper:fr_FR-gilles-low', name: 'Gilles (homme, plus léger)', key: 'fr_FR-gilles-low', speaker: 0, mb: 63 },
];
export const DEFAULT_FREE_VOICE = FREE_VOICES[0].id;

export const isFreeVoice = id => typeof id === 'string' && id.startsWith('piper:');
export const freeVoice = id => FREE_VOICES.find(v => v.id === id) || null;

// Modèle hébergé sur Hugging Face (dépôt officiel, puis miroir de secours).
export const MODEL_BASES = [
  'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0',
  'https://huggingface.co/diffusionstudio/piper-voices/resolve/main',
];

// « fr_FR-tom-medium » → « fr/fr_FR/tom/medium/fr_FR-tom-medium.onnx »
export function modelPath(key) {
  const m = /^([a-z]{2,3})_([A-Z]{2})-(.+)-(x_low|low|medium|high)$/.exec(key);
  if (!m) throw new Error('Voix inconnue : ' + key);
  const [, lang, region, name, quality] = m;
  return `${lang}/${lang}_${region}/${name}/${quality}/${key}.onnx`;
}

// Morceaux courts (~300 caractères) : le modèle reste rapide et la mémoire stable.
export function freeChunks(text, max = 300) {
  return splitText(text, max);
}

// Phonèmes → identifiants avec la table du modèle (^ début, _ entre chaque son, $ fin),
// comme Piper. Les sons absents de la table sont ignorés. Sans table : identifiants du phonétiseur.
export function phonemeIds(line, map) {
  if (!map || !Array.isArray(line.phonemes)) return line.phoneme_ids;
  const get = p => map[p] || [];
  const ids = [...get('^'), ...get('_')];
  line.phonemes.forEach(p => { if (map[p]) ids.push(...map[p], ...get('_')); });
  ids.push(...get('$'));
  return ids;
}

// Réglages du modèle ; speed > 1 = débit plus rapide.
export function scales(config, speed = 1) {
  const inf = (config && config.inference) || {};
  const s = Math.min(1.5, Math.max(0.6, Number(speed) || 1));
  return [inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) / s, inf.noise_w ?? 0.8];
}

// Recolle les morceaux avec une courte pause entre eux.
export function joinPcm(parts, sampleRate, pause = 0.25) {
  const gap = Math.round(sampleRate * pause);
  const total = parts.reduce((n, p) => n + p.length, 0) + gap * Math.max(0, parts.length - 1);
  const out = new Float32Array(total);
  let o = 0;
  parts.forEach((p, i) => {
    out.set(p, o);
    o += p.length + (i < parts.length - 1 ? gap : 0);
  });
  return out;
}

// WAV 16 bits mono.
export function pcmToWav(pcm, sampleRate) {
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true);
  }
  return view.buffer;
}
