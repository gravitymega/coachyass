// Voix gratuites Piper dans le navigateur : phonétisation espeak-ng (piper-wasm, MIT)
// puis modèle VITS exécuté par ONNX Runtime Web (MIT). Le modèle de la voix (~60 Mo)
// est téléchargé une fois depuis Hugging Face puis gardé dans le cache du navigateur.
import { freeVoice, modelPath, MODEL_BASES, freeChunks, scales, phonemeIds, joinPcm, pcmToWav } from './piper-core.js';

const ORT_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
const PHONEMIZE_BASES = [
  'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/',
  'https://unpkg.com/@diffusionstudio/piper-wasm@1.0.0/build/',
];
const CACHE = 'artcraft-piper-v1';

const scripts = new Map();
function loadScript(src) {
  if (!scripts.has(src)) {
    scripts.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.crossOrigin = 'anonymous';
      s.onload = resolve;
      s.onerror = () => { scripts.delete(src); reject(new Error('Chargement impossible : ' + src)); };
      document.head.appendChild(s);
    }));
  }
  return scripts.get(src);
}

// Téléchargement avec progression, gardé dans le cache du navigateur.
async function fetchCached(urls, onBytes) {
  let cache = null;
  try { cache = await caches.open(CACHE); } catch { /* Cache API indisponible */ }
  for (const url of urls) {
    const hit = cache && await cache.match(url).catch(() => null);
    if (hit) return hit.arrayBuffer();
  }
  let lastErr;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = +res.headers.get('Content-Length') || 0;
      const reader = res.body.getReader();
      const parts = [];
      let loaded = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        loaded += value.length;
        if (onBytes) onBytes(loaded, total);
      }
      const blob = new Blob(parts);
      if (cache) await cache.put(url, new Response(blob)).catch(() => {});
      return blob.arrayBuffer();
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error('Téléchargement impossible (' + (lastErr && lastErr.message) + ')');
}

let phonemizeAssets = null;
function loadPhonemizer(onBytes) {
  if (!phonemizeAssets) {
    phonemizeAssets = (async () => {
      let base = null;
      for (const b of PHONEMIZE_BASES) {
        try { await loadScript(b + 'piper_phonemize.js'); base = b; break; } catch { /* essai suivant */ }
      }
      if (!base) throw new Error('Moteur de phonétisation introuvable (réseau ?)');
      const [wasm, data] = await Promise.all([
        fetchCached(PHONEMIZE_BASES.map(b => b + 'piper_phonemize.wasm')),
        fetchCached(PHONEMIZE_BASES.map(b => b + 'piper_phonemize.data'), onBytes),
      ]);
      return { wasm, data };
    })().catch(err => { phonemizeAssets = null; throw err; });
  }
  return phonemizeAssets;
}

// Texte → phonèmes, un résultat par morceau (une seule instance du module).
async function phonemize(chunks, espeakVoice) {
  const { wasm, data } = await loadPhonemizer();
  const lines = [];
  const errors = [];
  const mod = await window.createPiperPhonemize({
    print: line => lines.push(line),
    printErr: msg => errors.push(msg),
    wasmBinary: wasm.slice(0),
    getPreloadedPackage: () => data.slice(0),
    locateFile: f => PHONEMIZE_BASES[0] + f,
  });
  mod.callMain(['-l', espeakVoice, '--input', JSON.stringify(chunks.map(text => ({ text }))), '--espeak_data', '/espeak-ng-data']);
  if (lines.length !== chunks.length) throw new Error('Phonétisation impossible' + (errors.length ? ' : ' + errors.slice(-1)[0] : ''));
  return lines.map(l => JSON.parse(l));
}

let ortReady = null;
function loadOrt() {
  if (!ortReady) {
    ortReady = loadScript(ORT_BASE + 'ort.wasm.min.js').then(() => {
      const ort = window.ort;
      ort.env.wasm.wasmPaths = ORT_BASE;
      ort.env.wasm.numThreads = 1; // pas d'isolation cross-origin sur le site
      return ort;
    }).catch(err => { ortReady = null; throw err; });
  }
  return ortReady;
}

const sessions = new Map(); // clé du modèle → { session, config }
async function loadVoice(key, onBytes) {
  if (!sessions.has(key)) {
    sessions.set(key, (async () => {
      const path = modelPath(key);
      const ort = await loadOrt();
      const config = JSON.parse(new TextDecoder().decode(await fetchCached(MODEL_BASES.map(b => `${b}/${path}.json`))));
      const model = await fetchCached(MODEL_BASES.map(b => `${b}/${path}`), onBytes);
      const session = await ort.InferenceSession.create(model, { executionProviders: ['wasm'] });
      return { session, config };
    })().catch(err => { sessions.delete(key); throw err; }));
  }
  return sessions.get(key);
}

/**
 * Synthèse d'un texte avec une voix gratuite. Renvoie un Blob WAV.
 * onProgress(ratio 0–1, libellé)
 */
export async function speakFree(text, voiceId, { speed = 1, onProgress = () => {} } = {}) {
  const voice = freeVoice(voiceId);
  if (!voice) throw new Error('Voix gratuite inconnue');
  const chunks = freeChunks(text);
  if (!chunks.length) throw new Error('Aucun texte à lire');
  const mb = (l, t) => `${(l / 1e6).toFixed(0)}${t ? ' / ' + (t / 1e6).toFixed(0) : ''} Mo`;
  onProgress(0, 'Chargement du moteur de voix gratuit…');
  await loadPhonemizer((l, t) => onProgress(t ? 0.1 * l / t : 0, `Téléchargement du moteur de voix (une seule fois)… ${mb(l, t)}`));
  const { session, config } = await loadVoice(voice.key,
    (l, t) => onProgress(0.1 + (t ? 0.4 * l / t : 0), `Téléchargement de la voix ${voice.name} (une seule fois)… ${mb(l, t)}`));
  const ort = window.ort;
  const ids = (await phonemize(chunks, (config.espeak && config.espeak.voice) || 'fr'))
    .map(line => phonemeIds(line, config.phoneme_id_map));
  const scale = scales(config, speed);
  const multi = Object.keys(config.speaker_id_map || {}).length > 0;
  const pcms = [];
  for (let i = 0; i < ids.length; i++) {
    onProgress(0.5 + 0.5 * i / ids.length, `Voix gratuite… ${i + 1} / ${ids.length}`);
    const feeds = {
      input: new ort.Tensor('int64', BigInt64Array.from(ids[i], BigInt), [1, ids[i].length]),
      input_lengths: new ort.Tensor('int64', BigInt64Array.from([BigInt(ids[i].length)]), [1]),
      scales: new ort.Tensor('float32', Float32Array.from(scale), [3]),
    };
    if (multi) feeds.sid = new ort.Tensor('int64', BigInt64Array.from([BigInt(voice.speaker)]), [1]);
    const out = await session.run(feeds);
    pcms.push(Float32Array.from(out.output.data));
    await new Promise(r => setTimeout(r)); // laisse respirer l'interface
  }
  const rate = config.audio.sample_rate;
  onProgress(1, 'Voix prête');
  return new Blob([pcmToWav(joinPcm(pcms, rate), rate)], { type: 'audio/wav' });
}
