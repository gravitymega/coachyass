// Code partagé par les modules d'Art craft : moteur ffmpeg.wasm, barre de
// progression, messages d'erreur et utilitaires de fichiers.

// L'enveloppe (petite) est servie par le site, le cœur (32 Mo) vient du CDN et
// reste ensuite dans le cache du navigateur.
const CORE_BASE = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

export const $ = id => document.getElementById(id);

export function showError(msg, id = 'error') {
  const el = $(id);
  el.textContent = msg;
  el.hidden = !msg;
}

export function setProgress(id, ratio, label) {
  const box = $(id);
  box.hidden = false;
  box.querySelector('div').style.width = Math.round(Math.min(1, Math.max(0, ratio)) * 100) + '%';
  box.querySelector('span').textContent = label;
}

export function parseLogTime(message) {
  const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : null;
}

export function parseLogDuration(message) {
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(message);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : null;
}

async function fetchBlobURL(url, type, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status}) : ${url}`);
  const total = +res.headers.get('content-length') || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (onProgress && total) onProgress(received / total);
  }
  return URL.createObjectURL(new Blob(chunks, { type }));
}

let ffmpegPromise = null;
export function getFFmpeg(progressId) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      if (!window.FFmpegWASM) throw new Error('Le moteur vidéo n\'a pas pu être chargé.');
      setProgress(progressId, 0, 'Chargement du moteur vidéo (1re fois seulement)…');
      const coreURL = await fetchBlobURL(`${CORE_BASE}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await fetchBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm',
        r => setProgress(progressId, r, `Chargement du moteur vidéo… ${Math.round(r * 100)} %`));
      const ff = new window.FFmpegWASM.FFmpeg();
      await ff.load({ coreURL, wasmURL });
      return ff;
    })().catch(err => { ffmpegPromise = null; throw err; });
  }
  return ffmpegPromise;
}

// Monte des fichiers en WORKERFS : ils sont lus morceau par morceau, jamais
// copiés en mémoire, ce qui permet de traiter des vidéos de plusieurs Go.
// Retourne le chemin de chaque fichier dans le système de fichiers ffmpeg.
const mounted = new Map();
export async function mountFiles(ff, mountPoint, files) {
  if (mounted.get(mountPoint) === files) return files.map(f => `${mountPoint}/${f.name}`);
  if (mounted.has(mountPoint)) {
    try { await ff.unmount(mountPoint); } catch { /* déjà démonté */ }
    mounted.delete(mountPoint);
  }
  try { await ff.createDir(mountPoint); } catch { /* déjà créé */ }
  await ff.mount('WORKERFS', { files }, mountPoint);
  mounted.set(mountPoint, files);
  return files.map(f => `${mountPoint}/${f.name}`);
}

export async function runWithLog(ff, args, onLine) {
  const handler = ({ message }) => onLine(message);
  ff.on('log', handler);
  try {
    return await ff.exec(args);
  } finally {
    ff.off('log', handler);
  }
}

export function slugify(text, fallback) {
  const s = String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return s || fallback;
}

// Bouton « Télécharger » + bouton « Partager » (Web Share API, surtout mobile).
export function offerFile(blob, name, { download, share, title }) {
  const url = URL.createObjectURL(blob);
  const dl = $(download);
  if (dl.href && dl.href.startsWith('blob:')) URL.revokeObjectURL(dl.href);
  dl.href = url;
  dl.download = name;
  const btn = share && $(share);
  if (btn) {
    const file = new File([blob], name, { type: blob.type });
    btn.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    btn.onclick = () => navigator.share({ files: [file], title }).catch(() => {});
  }
  return url;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = src;
  });
}
