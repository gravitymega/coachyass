// Tableau du coach (demi-terrain vu de dessus, panier en haut) : logique pure, testable avec Node.
// Repère partagé avec l'IA : x de 0 (côté gauche) à 1 (côté droit), y de 0 (ligne de fond) à 1 (ligne médiane).

export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
export const POS_NAMES = { PG: 'meneur', SG: 'arrière', SF: 'ailier', PF: 'ailier fort', C: 'pivot' };
export const MOVES = ['coupe', 'dribble', 'ecran', 'passe'];

// Demi-terrain FIBA en mètres : 15 de large, 14 de profondeur.
export const COURT = { w: 15, h: 14, hoopY: 1.575, keyW: 4.9, ftY: 5.8, ftR: 1.8, three: 6.75, cornerX: 0.9, restricted: 1.25 };

// Placement de repli (4 extérieurs, 1 intérieur) si l'IA n'a pas placé un joueur.
export const DEFAULT_SPOTS = { PG: [0.5, 0.62], SG: [0.14, 0.42], SF: [0.86, 0.42], PF: [0.32, 0.3], C: [0.68, 0.22] };

const clamp01 = v => Math.min(1, Math.max(0, Number.isFinite(+v) ? +v : 0.5));

// Rend un moment sûr à dessiner : 5 joueurs, coordonnées dans le terrain, trajets valides.
export function normalizeBoard(m) {
  m = m && typeof m === 'object' ? m : {};
  const players = {};
  (Array.isArray(m.joueurs) ? m.joueurs : []).forEach(j => {
    if (j && POSITIONS.includes(j.p) && !players[j.p]) players[j.p] = [clamp01(j.x), clamp01(j.y)];
  });
  POSITIONS.forEach(p => { if (!players[p]) players[p] = DEFAULT_SPOTS[p].slice(); });
  const defenders = (Array.isArray(m.defenseurs) ? m.defenseurs : []).slice(0, 5).map(d => [clamp01(d && d.x), clamp01(d && d.y)]);
  const moves = (Array.isArray(m.trajets) ? m.trajets : [])
    .filter(t => t && POSITIONS.includes(t.p) && MOVES.includes(t.type))
    .filter(t => t.type !== 'passe' || (POSITIONS.includes(t.vers) && t.vers !== t.p))
    .slice(0, 8)
    .map(t => ({ p: t.p, type: t.type, to: [clamp01(t.x), clamp01(t.y)], vers: t.type === 'passe' ? t.vers : '' }));
  return { players, defenders, moves, ball: POSITIONS.includes(m.ballon) ? m.ballon : 'PG' };
}

const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
export const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

// Trajet de chaque joueur (départ puis points d'arrivée de ses coupes, dribbles et écrans).
export function paths(board) {
  const out = {};
  POSITIONS.forEach(p => { out[p] = [board.players[p]]; });
  board.moves.forEach(m => { if (m.type !== 'passe') out[m.p].push(m.to); });
  return out;
}

// Position sur une ligne brisée à l'avancement u (0 à 1), à vitesse constante.
export function along(path, u) {
  if (path.length < 2) return path[0].slice();
  const seg = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    seg.push(d);
    total += d;
  }
  if (total === 0) return path[0].slice();
  let rest = Math.min(1, Math.max(0, u)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (rest <= seg[i] || i === seg.length - 1) return lerp(path[i], path[i + 1], seg[i] ? Math.min(1, rest / seg[i]) : 1);
    rest -= seg[i];
  }
  return path[path.length - 1].slice();
}

/**
 * État du tableau à l'avancement u (0 → 1) de l'action : les joueurs bougent sur u ∈ [0, 0,8],
 * les passes partent l'une après l'autre (u ∈ [0,25, 0,9]) et le ballon voyage en 0,12.
 */
export function boardAt(board, u) {
  const pth = paths(board);
  const players = {};
  const mu = ease(Math.min(1, u / 0.8));
  POSITIONS.forEach(p => { players[p] = along(pth[p], mu); });
  const passes = board.moves.filter(m => m.type === 'passe');
  let holder = board.ball;
  let ball = null;
  passes.forEach((ps, i) => {
    const t0 = 0.25 + (0.65 * i) / Math.max(1, passes.length);
    if (u >= t0 + 0.12) holder = ps.vers;
    else if (u >= t0 && !ball) ball = lerp(players[ps.p], players[ps.vers], ease((u - t0) / 0.12));
  });
  return { players, holder, ball: ball || players[holder], passing: Boolean(ball) };
}

// Coordonnées terrain (0–1) → pixels dans le cadre { x, y, w, h } du terrain dessiné.
export function toPx(pt, box) {
  return [box.x + pt[0] * box.w, box.y + pt[1] * box.h];
}

// Plus grand terrain (rapport 15 × 14) qui tient dans la zone donnée, centré.
export function fitCourt(x, y, w, h, margin = 0) {
  const ratio = COURT.h / COURT.w;
  let cw = w - margin * 2;
  let ch = cw * ratio;
  if (ch > h - margin * 2) { ch = h - margin * 2; cw = ch / ratio; }
  return { x: x + (w - cw) / 2, y: y + (h - ch) / 2, w: cw, h: ch };
}

/**
 * Images du tableau sur toute la vidéo : une image par 1/fps pendant les actions (les pions bougent),
 * une seule image pour les passages fixes. Renvoie [{ beat, u, dur }] (u = avancement de l'action).
 */
export function boardFrames(beats, fps = 10) {
  const frames = [];
  const push = (beat, u, dur) => {
    const last = frames[frames.length - 1];
    if (last && last.beat === beat && last.u === u) last.dur += dur;
    else frames.push({ beat, u, dur });
  };
  beats.forEach((b, i) => {
    const dur = b.out + b.freeze;
    if (b.kind !== 'action') { push(i, 1, dur); return; }
    const n = Math.max(1, Math.round(dur * fps));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / fps;
      // Les pions bougent pendant la partie vidéo, puis restent en place pendant l'image figée.
      const u = Math.round(Math.min(1, t / Math.max(0.1, b.out)) * 50) / 50;
      push(i, u, Math.min(1 / fps, dur - k / fps));
    }
  });
  return frames.filter(f => f.dur > 0.001);
}
