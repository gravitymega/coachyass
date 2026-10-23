// Mouvement d'une caméra qui suit le jeu (XbotGo, téléphone qui pivote) : entre deux images
// successives, des points fixes du décor (lignes, gradins, panneaux) sont suivis par flux optique
// (Lucas-Kanade), puis une homographie est calculée par RANSAC, qui écarte les points qui bougent
// tout seuls (les joueurs). Tout se fait dans le navigateur avec OpenCV.js (Apache 2.0).
import { mul } from './radar-core.js';

const VERSION = '4.10.0-release.1';
const URLS = [
  `https://cdn.jsdelivr.net/npm/@techstark/opencv-js@${VERSION}/dist/opencv.js`,
  `https://unpkg.com/@techstark/opencv-js@${VERSION}/dist/opencv.js`,
];

let cvPromise = null;
function addScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => { s.remove(); reject(new Error('chargement impossible : ' + src)); };
    document.head.append(s);
  });
}

// OpenCV.js (~10 Mo, gardé ensuite dans le cache du navigateur).
export function loadOpenCV() {
  if (!cvPromise) {
    cvPromise = (async () => {
      let last;
      for (const url of URLS) {
        try { await addScript(url); last = null; break; } catch (err) { last = err; }
      }
      if (last) throw new Error('Moteur de suivi de caméra injoignable (' + last.message + ')');
      let cv = window.cv;
      if (cv && typeof cv.then === 'function' && !cv.Mat) cv = await cv;
      if (!cv.Mat) await new Promise(r => { cv.onRuntimeInitialized = r; });
      return cv;
    })().catch(err => { cvPromise = null; throw err; });
  }
  return cvPromise;
}

// Coordonnées pixels ↔ image 0 à 1 : Hn = S⁻¹ · H · S.
function normalize(H, w, h) {
  return mul([1 / w, 0, 0, 0, 1 / h, 0, 0, 0, 1], mul(H, [w, 0, 0, 0, h, 0, 0, 0, 1]));
}

/**
 * Suit la caméra d'une image grise à la suivante.
 * Renvoie l'homographie (coordonnées 0 à 1) qui envoie l'image `next` sur l'image `prev`,
 * ou null si le suivi n'est pas fiable (trop peu de points fixes, mouvement aberrant).
 */
export function pairMotion(cv, prev, next, w, h, { maxCorners = 400, minInliers = 14 } = {}) {
  const a = cv.matFromArray(h, w, cv.CV_8UC1, prev);
  const b = cv.matFromArray(h, w, cv.CV_8UC1, next);
  const corners = new cv.Mat(), nextPts = new cv.Mat(), status = new cv.Mat(), err = new cv.Mat();
  const none = new cv.Mat();
  let src = null, dst = null, H = null, inl = null;
  try {
    cv.goodFeaturesToTrack(a, corners, maxCorners, 0.01, Math.max(4, w / 60), none, 3);
    if (corners.rows < minInliers) return null;
    cv.calcOpticalFlowPyrLK(a, b, corners, nextPts, status, err, new cv.Size(21, 21), 3);
    const p = [], q = [];
    for (let i = 0; i < corners.rows; i++) {
      if (!status.data[i]) continue;
      const [x0, y0] = [corners.data32F[i * 2], corners.data32F[i * 2 + 1]];
      const [x1, y1] = [nextPts.data32F[i * 2], nextPts.data32F[i * 2 + 1]];
      if (x1 < 0 || y1 < 0 || x1 >= w || y1 >= h) continue;
      p.push(x0, y0);
      q.push(x1, y1);
    }
    if (p.length / 2 < minInliers) return null;
    src = cv.matFromArray(q.length / 2, 1, cv.CV_32FC2, q);
    dst = cv.matFromArray(p.length / 2, 1, cv.CV_32FC2, p);
    inl = new cv.Mat();
    H = cv.findHomography(src, dst, cv.RANSAC, 2.0, inl);
    if (H.empty()) return null;
    let n = 0;
    for (let i = 0; i < inl.rows; i++) n += inl.data[i] ? 1 : 0;
    if (n < minInliers || n < 0.35 * (p.length / 2)) return null;
    const M = Array.from(H.data64F);
    const Hn = normalize(M, w, h);
    // Garde-fou : entre deux images (¼ s), le cadre ne peut pas sauter de plus de 40 % de sa largeur.
    const c = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => {
      const W = Hn[6] * x + Hn[7] * y + Hn[8];
      return [(Hn[0] * x + Hn[1] * y + Hn[2]) / W - x, (Hn[3] * x + Hn[4] * y + Hn[5]) / W - y];
    });
    if (c.some(([dx, dy]) => !Number.isFinite(dx) || Math.hypot(dx, dy) > 0.4)) return null;
    return Hn;
  } finally {
    [a, b, corners, nextPts, status, err, none, src, dst, H, inl].forEach(m => { if (m) m.delete(); });
  }
}
