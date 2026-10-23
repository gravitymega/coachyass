// Détection des joueurs dans le navigateur : MediaPipe Object Detector (Google, Apache 2.0)
// avec le modèle EfficientDet-Lite2 (entraîné sur COCO : classes « person » et « sports ball »). Le calcul se fait
// sur la carte graphique (délégué GPU de MediaPipe), avec repli sur le processeur.
// Rien n'est envoyé sur Internet : seuls le moteur (~10 Mo) et le modèle (~12 Mo) sont téléchargés
// une fois, puis gardés en cache par le navigateur.
import { torsoBox } from './stats-core.js';

const VERSION = '0.10.21';
const BASES = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}`,
  `https://unpkg.com/@mediapipe/tasks-vision@${VERSION}`,
];
export const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite';

let detectorPromise = null;
export let detectorDevice = '';

async function create(vision, FilesetResolver, base, delegate) {
  const fileset = await FilesetResolver.forVisionTasks(`${base}/wasm`);
  return vision.ObjectDetector.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'IMAGE',
    scoreThreshold: 0.3,
    maxResults: 30,
    categoryAllowlist: ['person', 'sports ball'],
  });
}

export function loadDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      let lastErr;
      for (const base of BASES) {
        let vision;
        try { vision = await import(`${base}/vision_bundle.mjs`); } catch (err) { lastErr = err; continue; }
        for (const delegate of ['GPU', 'CPU']) {
          try {
            const det = await create(vision, vision.FilesetResolver, base, delegate);
            detectorDevice = delegate === 'GPU' ? 'carte graphique' : 'processeur';
            return det;
          } catch (err) { lastErr = err; }
        }
      }
      throw new Error('Détecteur de joueurs indisponible (' + (lastErr && lastErr.message) + ')');
    })().catch(err => { detectorPromise = null; throw err; });
  }
  return detectorPromise;
}

/**
 * Joueurs (personnes) visibles sur une image. Boîtes en coordonnées 0 à 1.
 * Les personnes minuscules (spectateurs au loin) sont écartées.
 */
export async function detectPlayers(image) {
  return (await detectScene(image)).players;
}

// Recouvrement de deux boîtes : intersection / plus petite des deux aires.
function overlap(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w <= 0 || h <= 0 ? 0 : (w * h) / Math.min(a.w * a.h, b.w * b.h);
}

/**
 * Joueurs et ballons visibles sur une image (boîtes en coordonnées 0 à 1).
 * grid > 1 : l'image est découpée en grid × grid zones qui se chevauchent, analysées une par une
 * (le modèle réduit chaque image à ~448 px : sur une vue large, les joueurs lointains et le ballon
 * deviennent trop petits). Les doublons aux bords des zones sont fusionnés.
 */
export async function detectScene(image, { grid = 1 } = {}) {
  const det = await loadDetector();
  const W = image.width, H = image.height;
  const read = (res, ox, oy, sw, sh) => (res.detections || []).map(d => ({
    x: (ox + d.boundingBox.originX) / W,
    y: (oy + d.boundingBox.originY) / H,
    w: d.boundingBox.width / W,
    h: d.boundingBox.height / H,
    score: d.categories[0] ? d.categories[0].score : 0,
    kind: d.categories[0] ? d.categories[0].categoryName : '',
  }));
  let all = read(det.detect(image), 0, 0);
  if (grid > 1) {
    const tw = Math.round(W / grid * 1.3), th = Math.round(H / grid * 1.3);
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        const ox = Math.min(W - tw, Math.max(0, Math.round((c * W) / grid - (tw - W / grid) / 2)));
        const oy = Math.min(H - th, Math.max(0, Math.round((r * H) / grid - (th - H / grid) / 2)));
        const tile = await createImageBitmap(image, ox, oy, tw, th);
        all = all.concat(read(det.detect(tile), ox, oy));
        tile.close();
      }
    }
    // Fusion : on garde la meilleure boîte de chaque groupe qui se recouvre.
    all.sort((a, b) => b.score - a.score);
    const kept = [];
    all.forEach(b => { if (!kept.some(k => k.kind === b.kind && overlap(k, b) > 0.6)) kept.push(b); });
    all = kept;
  }
  return {
    players: all.filter(b => b.kind === 'person' && b.h > 0.06 && b.w > 0.01),
    balls: all.filter(b => b.kind === 'sports ball'),
  };
}

// Couleur moyenne du maillot (zone du torse) d'une boîte, lue sur un canvas.
export function jerseyColor(ctx, box, W, H) {
  const t = torsoBox(box);
  const x = Math.max(0, Math.round(t.x * W)), y = Math.max(0, Math.round(t.y * H));
  const w = Math.max(1, Math.min(W - x, Math.round(t.w * W))), h = Math.max(1, Math.min(H - y, Math.round(t.h * H)));
  const px = ctx.getImageData(x, y, w, h).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < px.length; i += 16) { r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
  return n ? [r / n, g / n, b / n] : [128, 128, 128];
}

// Vignette agrandie d'un joueur (pour lire son numéro), en JPEG base64.
export async function cropJpeg(image, box, { height = 260, pad = 0.12 } = {}) {
  const W = image.width, H = image.height;
  const x0 = Math.max(0, (box.x - box.w * pad) * W), y0 = Math.max(0, (box.y - box.h * pad * 0.5) * H);
  const x1 = Math.min(W, (box.x + box.w * (1 + pad)) * W), y1 = Math.min(H, (box.y + box.h * (1 + pad * 0.5)) * H);
  const sw = Math.max(1, x1 - x0), sh = Math.max(1, y1 - y0);
  const scale = Math.min(4, height / sh);
  const c = document.createElement('canvas');
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, x0, y0, sw, sh, 0, 0, c.width, c.height);
  return canvasJpeg(c, 0.85);
}

export async function canvasJpeg(canvas, quality = 0.8) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

// Image entière réduite à « width » pixels de large, en JPEG base64.
export async function scaledJpeg(image, width = 960, quality = 0.78) {
  const scale = Math.min(1, width / image.width);
  const c = document.createElement('canvas');
  c.width = Math.round(image.width * scale);
  c.height = Math.round(image.height * scale);
  c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
  return canvasJpeg(c, quality);
}
