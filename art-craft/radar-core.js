// Radar terrain : logique pure (aucun accès au DOM), testable avec Node.
// La vidéo est filmée de côté ; on calibre le terrain en touchant 4 repères connus sur une image,
// puis chaque joueur (pieds au sol) est projeté sur un demi-terrain vu du dessus, en mètres.
//
// homography() et le suivi du ballon (BallTracker) sont portés en JavaScript depuis
// roboflow/sports (sports/common/view.py et sports/common/ball.py) :
//   MIT License — Copyright (c) 2024 Roboflow
//   Permission is hereby granted, free of charge, to any person obtaining a copy of this software
//   and associated documentation files (the "Software"), to deal in the Software without
//   restriction, including without limitation the rights to use, copy, modify, merge, publish,
//   distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the
//   Software is furnished to do so, subject to the following conditions: The above copyright notice
//   and this permission notice shall be included in all copies or substantial portions of the
//   Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
import { COURT } from './board-core.js';

const CX = COURT.w / 2;
const KEY = COURT.keyW / 2;

// Repères à toucher sur l'image, dans l'ordre, avec leur position sur le terrain (mètres :
// x de 0 à 15 de gauche à droite, y = 0 sur la ligne de fond, 14 à la ligne médiane).
export const PRESETS = {
  raquette: {
    label: 'Les 4 coins de la raquette (précis près du panier)',
    points: [
      { name: 'Coin de la raquette sur la ligne de fond, à gauche', court: [CX - KEY, 0] },
      { name: 'Coin de la raquette sur la ligne de fond, à droite', court: [CX + KEY, 0] },
      { name: 'Coin droit de la ligne des lancers francs', court: [CX + KEY, COURT.ftY] },
      { name: 'Coin gauche de la ligne des lancers francs', court: [CX - KEY, COURT.ftY] },
    ],
  },
  demi: {
    label: 'Les 4 coins du demi-terrain (précis partout, il faut les voir)',
    points: [
      { name: 'Coin de la ligne de fond, à gauche', court: [0, 0] },
      { name: 'Coin de la ligne de fond, à droite', court: [COURT.w, 0] },
      { name: 'Ligne médiane, sur la ligne de côté droite', court: [COURT.w, COURT.h] },
      { name: 'Ligne médiane, sur la ligne de côté gauche', court: [0, COURT.h] },
    ],
  },
};

// Résout A x = b (élimination de Gauss avec pivot partiel). null si le système est singulier.
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Matrice d'homographie 3×3 (tableau de 9) qui envoie 4 points source sur 4 points cible
 * (équivalent de cv2.findHomography pour 4 points). null si 3 points sont alignés.
 */
export function homography(src, dst) {
  if (src.length !== 4 || dst.length !== 4) throw new Error('Il faut 4 points');
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solve(A, b);
  return h ? [...h, 1] : null;
}

// Applique l'homographie à un point (équivalent de cv2.perspectiveTransform).
export function project(H, [x, y]) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

// Inverse d'une matrice 3×3 (pour dessiner le terrain par-dessus l'image).
export function invert(H) {
  const [a, b, c, d, e, f, g, h, i] = H;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map(v => v / det);
}

// Les 4 points touchés forment-ils un quadrilatère utilisable (pas de points confondus ni alignés) ?
export function checkQuad(pts, minDist = 0.02) {
  if (pts.length !== 4) return 'Touche les 4 repères.';
  for (let i = 0; i < 4; i++) {
    for (let j = i + 1; j < 4; j++) {
      if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < minDist) return 'Deux repères sont trop proches : recommence.';
    }
  }
  for (let i = 0; i < 4; i++) {
    const [a, b, c] = [pts[i], pts[(i + 1) % 4], pts[(i + 2) % 4]];
    const cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (Math.abs(cross) < 1e-4) return 'Trois repères sont alignés : recommence.';
  }
  return '';
}

// Lignes du demi-terrain (en mètres), découpées en segments : pour les dessiner par-dessus l'image.
export function courtLines(step = 0.25) {
  const lines = [];
  const seg = pts => lines.push(pts);
  const arc = (cx, cy, r, a0, a1) => {
    const n = Math.max(8, Math.ceil((Math.abs(a1 - a0) * r) / step));
    seg(Array.from({ length: n + 1 }, (_, k) => {
      const a = a0 + ((a1 - a0) * k) / n;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    }));
  };
  seg([[0, 0], [COURT.w, 0], [COURT.w, COURT.h], [0, COURT.h], [0, 0]]);
  seg([[CX - KEY, 0], [CX - KEY, COURT.ftY], [CX + KEY, COURT.ftY], [CX + KEY, 0]]);
  arc(CX, COURT.ftY, COURT.ftR, 0, Math.PI);
  const dy = Math.sqrt(COURT.three ** 2 - (CX - COURT.cornerX) ** 2);
  seg([[COURT.cornerX, 0], [COURT.cornerX, COURT.hoopY + dy]]);
  seg([[COURT.w - COURT.cornerX, 0], [COURT.w - COURT.cornerX, COURT.hoopY + dy]]);
  const ang = Math.atan2(dy, CX - COURT.cornerX);
  arc(CX, COURT.hoopY, COURT.three, ang, Math.PI - ang);
  arc(CX, COURT.h, 1.8, Math.PI, Math.PI * 2);
  return lines;
}

// Point des pieds d'un joueur (milieu du bas de sa boîte), en coordonnées image 0 à 1.
export const feet = b => [b.x + b.w / 2, b.y + b.h];

// Le point est-il sur le terrain (avec une marge en mètres, pour garder les joueurs sur les lignes) ?
export const onCourt = ([x, y], margin = 1) => x >= -margin && x <= COURT.w + margin && y >= -margin && y <= COURT.h + margin;

// Équipe d'un maillot : centre de couleur le plus proche (k-moyennes faites sur l'image de calibration).
export function nearestTeam(color, centers) {
  let best = 0, bd = Infinity;
  centers.forEach((c, k) => {
    const d = (c[0] - color[0]) ** 2 + (c[1] - color[1]) ** 2 + (c[2] - color[2]) ** 2;
    if (d < bd) { bd = d; best = k; }
  });
  return best;
}

/**
 * Suivi du ballon (port de BallTracker, roboflow/sports) : parmi les ballons détectés sur une image,
 * garde celui qui est le plus près de la moyenne des dernières positions.
 */
export class BallTracker {
  constructor(size = 6) { this.size = size; this.buffer = []; }
  update(balls) {
    this.buffer.push(balls.map(b => [b.x + b.w / 2, b.y + b.h / 2]));
    if (this.buffer.length > this.size) this.buffer.shift();
    if (!balls.length) return null;
    const all = this.buffer.flat();
    const c = [all.reduce((s, p) => s + p[0], 0) / all.length, all.reduce((s, p) => s + p[1], 0) / all.length];
    let best = 0, bd = Infinity;
    balls.forEach((b, i) => {
      const d = Math.hypot(b.x + b.w / 2 - c[0], b.y + b.h / 2 - c[1]);
      if (d < bd) { bd = d; best = i; }
    });
    return balls[best];
  }
}

/**
 * Porteur du ballon sur une image : le joueur dont la boîte (un peu élargie) contient le ballon ;
 * à égalité, le plus proche horizontalement. Coordonnées image 0 à 1. Renvoie l'indice ou -1.
 */
export function ballHolder(players, ball, { pad = 0.35 } = {}) {
  if (!ball) return -1;
  const bx = ball.x + ball.w / 2, by = ball.y + ball.h / 2;
  let best = -1, bd = Infinity;
  players.forEach((p, i) => {
    const m = p.box.w * pad;
    if (bx < p.box.x - m || bx > p.box.x + p.box.w + m) return;
    if (by < p.box.y - p.box.h * 0.15 || by > p.box.y + p.box.h * 1.05) return;
    const d = Math.abs(bx - (p.box.x + p.box.w / 2)) / p.box.h;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

/**
 * Possession, passes et pertes de balle sur la suite des images.
 * frames : [{ t, players: [{ court, team }], holder }] (holder = indice du porteur ou -1).
 * Le porteur est gardé tant que le ballon n'est pas revu ailleurs (au plus `hold` s).
 * Passe : le ballon saute de plus de `passDist` m dans la même équipe, plus vite qu'un joueur ne court.
 * Perte : le ballon passe à l'autre équipe (vol, interception, ou changement de possession).
 */
// Un saut du ballon plus long que passDist et plus rapide qu'un joueur qui court (speed m/s) = une passe
// (sinon c'est le même porteur qui dribble).
function isPass(cur, h, t, passDist, speed) {
  const d = Math.hypot(h.court[0] - cur.court[0], h.court[1] - cur.court[1]);
  return d > passDist && d / Math.max(0.1, t - cur.t) > speed;
}

export function possession(frames, { hold = 1.5, passDist = 2.5, speed = 8 } = {}) {
  const time = [0, 0];
  const events = [];
  const counts = { passes: [0, 0], pertes: [0, 0] };
  let cur = null; // { team, court, t }
  frames.forEach((f, i) => {
    const dt = i + 1 < frames.length ? frames[i + 1].t - f.t : (frames.length > 1 ? f.t - frames[i - 1].t : 0);
    const h = f.holder >= 0 ? f.players[f.holder] : null;
    if (h) {
      if (cur && h.team !== cur.team) {
        counts.pertes[cur.team]++;
        events.push({ t: f.t, type: 'perte', team: cur.team, from: cur.court, to: h.court });
      } else if (cur && isPass(cur, h, f.t, passDist, speed)) {
        counts.passes[h.team]++;
        events.push({ t: f.t, type: 'passe', team: h.team, from: cur.court, to: h.court });
      }
      cur = { team: h.team, court: h.court, t: f.t };
    } else if (cur && f.t - cur.t > hold) {
      cur = null;
    }
    if (cur) time[cur.team] += dt;
  });
  const total = time[0] + time[1];
  return { share: total ? time.map(x => x / total) : [0, 0], seconds: time, ...counts, events };
}

// Zone du terrain d'un point : 'raquette', 'trois' (derrière la ligne à 3 points) ou 'mi' (mi-distance).
export function zoneOf([x, y]) {
  if (Math.abs(x - CX) <= KEY && y <= COURT.ftY) return 'raquette';
  const dy = Math.sqrt(COURT.three ** 2 - (CX - COURT.cornerX) ** 2);
  if (y <= COURT.hoopY + dy && (x < COURT.cornerX || x > COURT.w - COURT.cornerX)) return 'trois';
  return Math.hypot(x - CX, y - COURT.hoopY) > COURT.three ? 'trois' : 'mi';
}

// Écartement d'une équipe sur une image : distance moyenne entre coéquipiers (mètres), ou null.
export function spacing(points) {
  if (points.length < 3) return null;
  let s = 0, n = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) { s += Math.hypot(points[i][0] - points[j][0], points[i][1] - points[j][1]); n++; }
  }
  return s / n;
}

/**
 * Indicateurs par équipe sur toute la séquence : présence moyenne, temps par zone (%),
 * écartement moyen et profondeur moyenne (distance moyenne à la ligne de fond).
 */
export function teamMetrics(frames) {
  return [0, 1].map(team => {
    const zones = { raquette: 0, mi: 0, trois: 0 };
    let pts = 0, spSum = 0, spN = 0, depth = 0, seen = 0;
    frames.forEach(f => {
      const mine = f.players.filter(p => p.team === team).map(p => p.court);
      if (mine.length) seen++;
      mine.forEach(c => { zones[zoneOf(c)]++; depth += c[1]; pts++; });
      const sp = spacing(mine);
      if (sp != null) { spSum += sp; spN++; }
    });
    const pct = k => (pts ? zones[k] / pts : 0);
    return {
      players: frames.length ? pts / frames.length : 0,
      zones: { raquette: pct('raquette'), mi: pct('mi'), trois: pct('trois') },
      spacing: spN ? spSum / spN : null,
      depth: pts ? depth / pts : null,
      seen: frames.length ? seen / frames.length : 0,
    };
  });
}

/**
 * Carte de chaleur : grille nx × ny sur le demi-terrain, lissée (noyau gaussien), valeurs 0 à 1.
 */
export function heatmap(points, { nx = 30, ny = 28, sigma = 1.2 } = {}) {
  const raw = new Float32Array(nx * ny);
  points.forEach(([x, y]) => {
    const i = Math.floor((x / COURT.w) * nx), j = Math.floor((y / COURT.h) * ny);
    if (i >= 0 && i < nx && j >= 0 && j < ny) raw[j * nx + i]++;
  });
  const r = Math.ceil(sigma * 2.5);
  const k = Array.from({ length: 2 * r + 1 }, (_, d) => Math.exp(-((d - r) ** 2) / (2 * sigma * sigma)));
  const tmp = new Float32Array(nx * ny), out = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let s = 0;
    for (let d = -r; d <= r; d++) { const ii = i + d; if (ii >= 0 && ii < nx) s += raw[j * nx + ii] * k[d + r]; }
    tmp[j * nx + i] = s;
  }
  let max = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let s = 0;
    for (let d = -r; d <= r; d++) { const jj = j + d; if (jj >= 0 && jj < ny) s += tmp[jj * nx + i] * k[d + r]; }
    out[j * nx + i] = s;
    if (s > max) max = s;
  }
  if (max > 0) for (let n = 0; n < out.length; n++) out[n] /= max;
  return { nx, ny, values: out };
}

// Instants d'analyse : `fps` images par seconde de start à start + dur.
export function sampleTimes(start, dur, fps = 2) {
  const n = Math.max(2, Math.floor(dur * fps));
  return Array.from({ length: n }, (_, i) => +(start + i / fps).toFixed(3));
}

// Image du radar la plus proche de l'instant t (frames triées par t).
export function frameAt(frames, t) {
  if (!frames.length) return null;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t < t) lo = mid + 1; else hi = mid;
  }
  if (lo > 0 && Math.abs(frames[lo - 1].t - t) < Math.abs(frames[lo].t - t)) lo--;
  return frames[lo];
}

// Positions en CSV (une ligne par joueur et par image) : à ouvrir dans Excel ou Google Sheets.
export function toCSV(frames, names = ['Équipe A', 'Équipe B']) {
  const rows = ['temps_s;equipe;x_m;y_m;zone;porteur'];
  frames.forEach(f => f.players.forEach((p, i) => {
    rows.push([f.t.toFixed(2), names[p.team], p.court[0].toFixed(2), p.court[1].toFixed(2), zoneOf(p.court), i === f.holder ? 'oui' : ''].join(';'));
  }));
  return rows.join('\n') + '\n';
}

// Liste ffconcat des images du radar (une par instant analysé) pour la vidéo radar.
export function radarConcat(times, end, name = i => `r${String(i).padStart(5, '0')}.jpg`) {
  const lines = ['ffconcat version 1.0'];
  times.forEach((t, i) => {
    const next = i + 1 < times.length ? times[i + 1] : end;
    lines.push(`file ${name(i)}`, `duration ${Math.max(0.04, next - t).toFixed(3)}`);
  });
  if (times.length) lines.push(`file ${name(times.length - 1)}`);
  return lines.join('\n') + '\n';
}

/**
 * Vidéo radar verticale : la séquence en haut, le radar en dessous, son d'origine gardé.
 * width : largeur commune ; radarH : hauteur du radar (paire).
 */
export function buildRadarArgs({ input, start, dur, list, width = 720, radarH, hasAudio, output }) {
  const args = ['-ss', start.toFixed(3), '-t', dur.toFixed(3), '-i', input, '-f', 'concat', '-safe', '0', '-i', list];
  const f = [
    `[0:v]scale=${width}:-2,setsar=1,fps=30[top]`,
    `[1:v]scale=${width}:${radarH},setsar=1,fps=30,format=yuv420p[rad]`,
    '[top][rad]vstack=inputs=2:shortest=1,format=yuv420p[v]',
  ];
  args.push('-filter_complex', f.join(';'), '-map', '[v]');
  if (hasAudio) args.push('-map', '0:a:0', '-c:a', 'aac', '-b:a', '128k');
  args.push('-t', dur.toFixed(3), '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-movflags', '+faststart', output);
  return args;
}
