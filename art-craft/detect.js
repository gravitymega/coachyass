// Détection des joueurs dans le navigateur : MediaPipe Object Detector (Google, Apache 2.0)
// avec le modèle EfficientDet-Lite2 (entraîné sur COCO : classe « person »). Le calcul se fait
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
    categoryAllowlist: ['person'],
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
  const det = await loadDetector();
  const W = image.width, H = image.height;
  const res = det.detect(image);
  return (res.detections || [])
    .map(d => ({
      x: d.boundingBox.originX / W,
      y: d.boundingBox.originY / H,
      w: d.boundingBox.width / W,
      h: d.boundingBox.height / H,
      score: d.categories[0] ? d.categories[0].score : 0,
    }))
    .filter(b => b.h > 0.06 && b.w > 0.01);
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
