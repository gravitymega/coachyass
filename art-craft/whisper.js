// Transcription de la voix dans le navigateur avec Whisper (OpenAI, MIT), exécuté par
// Transformers.js (Hugging Face, Apache 2.0) sur la carte graphique (WebGPU) ou, à défaut,
// sur le processeur (WebAssembly). Même principe que les sous-titres de FreeCut.
// Aucun serveur ni clé : le modèle se télécharge une fois, puis reste dans le cache du navigateur.

const LIB_URLS = [
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js',
  'https://unpkg.com/@huggingface/transformers@3.8.1/dist/transformers.min.js',
];

// Modèles « _timestamped » : ils donnent l'heure de chaque mot. Sinon, repli sur le modèle
// standard (heure par phrase, répartie ensuite sur les mots).
export const MODELS = {
  rapide: { label: 'Rapide (Whisper base, ~80 Mo)', id: 'onnx-community/whisper-base_timestamped', fallback: 'onnx-community/whisper-base' },
  precis: { label: 'Précis (Whisper small, ~250 Mo)', id: 'onnx-community/whisper-small_timestamped', fallback: 'onnx-community/whisper-small' },
};

export const SAMPLE_RATE = 16000;
const WINDOW_S = 28; // Whisper lit 30 s à la fois : on découpe nous-mêmes pour suivre la progression.

let libPromise = null;
function loadLib() {
  if (!libPromise) {
    libPromise = (async () => {
      let last;
      for (const url of LIB_URLS) {
        try { return await import(/* @vite-ignore */ url); } catch (e) { last = e; }
      }
      throw new Error('Moteur de transcription injoignable (' + (last && last.message) + ')');
    })().catch(e => { libPromise = null; throw e; });
  }
  return libPromise;
}

const cache = new Map(); // clé de modèle → { asr, words }

// onProgress(ratio, texte) pendant le téléchargement du modèle.
export async function loadTranscriber(key, onProgress = () => {}) {
  if (cache.has(key)) return cache.get(key);
  const { pipeline } = await loadLib();
  const model = MODELS[key] || MODELS.rapide;
  const device = navigator.gpu ? 'webgpu' : 'wasm';
  const files = new Map();
  const progress_callback = p => {
    if (p.status !== 'progress' || !p.total) return;
    files.set(p.file, [p.loaded, p.total]);
    let a = 0, b = 0;
    files.forEach(([l, t]) => { a += l; b += t; });
    onProgress(a / b, `Téléchargement du modèle (1re fois seulement)… ${Math.round(b / 1e6)} Mo`);
  };
  const make = async (id, dev) => pipeline('automatic-speech-recognition', id, {
    device: dev,
    dtype: dev === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback,
  });
  let asr = null, words = true;
  for (const [id, w] of [[model.id, true], [model.fallback, false]]) {
    try { asr = await make(id, device); words = w; break; } catch (e) {
      // WebGPU indisponible malgré navigator.gpu (pilote) : on réessaie sur le processeur.
      if (device === 'webgpu') {
        try { asr = await make(id, 'wasm'); words = w; break; } catch { /* modèle suivant */ }
      }
      console.warn('whisper', id, e);
    }
  }
  if (!asr) throw new Error('Impossible de charger le modèle Whisper (connexion ?).');
  const entry = { asr, words, device };
  cache.set(key, entry);
  return entry;
}

/**
 * audio : Float32Array mono 16 kHz. language : 'french', 'english' ou null (détection).
 * Renvoie des morceaux { text, timestamp: [début, fin] } en secondes depuis le début.
 */
export async function transcribe(entry, audio, { language = 'french', onProgress = () => {} } = {}) {
  const win = WINDOW_S * SAMPLE_RATE;
  const n = Math.max(1, Math.ceil(audio.length / win));
  const chunks = [];
  for (let i = 0; i < n; i++) {
    const offset = i * WINDOW_S;
    const piece = audio.subarray(i * win, Math.min(audio.length, (i + 1) * win));
    onProgress(i / n, `Transcription… ${Math.round(offset)} s / ${Math.round(audio.length / SAMPLE_RATE)} s`);
    if (silent(piece)) continue;
    const opts = { task: 'transcribe', return_timestamps: entry.words ? 'word' : true };
    if (language) opts.language = language;
    let out;
    try {
      out = await entry.asr(piece, opts);
    } catch (e) {
      if (!entry.words) throw e;
      entry.words = false; // le modèle ne sait pas donner l'heure des mots : heure par phrase
      out = await entry.asr(piece, { ...opts, return_timestamps: true });
    }
    for (const c of out.chunks || []) {
      const [s, e] = c.timestamp || [];
      if (!Number.isFinite(s)) continue;
      chunks.push({ text: c.text, timestamp: [s + offset, Number.isFinite(e) ? e + offset : null] });
    }
  }
  onProgress(1, 'Transcription terminée');
  return chunks;
}

function silent(a) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 16) sum += a[i] * a[i];
  return Math.sqrt(sum / Math.max(1, a.length / 16)) < 0.003;
}
