// Dessin du tableau du coach (canvas) : demi-terrain, pions PG/SG/SF/PF/C, défenseurs,
// trajets (coupe, dribble, écran, passe), ballon, et en tête le texte du moment.
import { COURT, POSITIONS, paths, boardAt, toPx, fitCourt } from './board-core.js';
import { BRAND } from './brand.js';

const FLOOR = '#8f1d2c';
const LINE = 'rgba(255,255,255,0.92)';

function wrapLines(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const next = cur ? cur + ' ' + w : w;
    if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = w; } else cur = next;
  });
  if (cur) lines.push(cur);
  return lines;
}

function drawCourt(ctx, box) {
  const s = box.w / COURT.w;
  const X = m => box.x + m * s;
  const Y = m => box.y + m * s;
  const lw = Math.max(2, box.w * 0.006);
  ctx.fillStyle = FLOOR;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = lw;
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  const cx = COURT.w / 2;
  // Raquette et cercle des lancers francs.
  ctx.strokeRect(X(cx - COURT.keyW / 2), Y(0), COURT.keyW * s, COURT.ftY * s);
  ctx.beginPath();
  ctx.arc(X(cx), Y(COURT.ftY), COURT.ftR * s, 0, Math.PI);
  ctx.stroke();
  ctx.save();
  ctx.setLineDash([lw * 3, lw * 3]);
  ctx.beginPath();
  ctx.arc(X(cx), Y(COURT.ftY), COURT.ftR * s, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  // Ligne à 3 points : deux droites dans les coins, puis l'arc.
  const dy = Math.sqrt(COURT.three ** 2 - (cx - COURT.cornerX) ** 2);
  const yc = COURT.hoopY + dy;
  ctx.beginPath();
  ctx.moveTo(X(COURT.cornerX), Y(0));
  ctx.lineTo(X(COURT.cornerX), Y(yc));
  ctx.moveTo(X(COURT.w - COURT.cornerX), Y(0));
  ctx.lineTo(X(COURT.w - COURT.cornerX), Y(yc));
  ctx.stroke();
  const ang = Math.atan2(dy, cx - COURT.cornerX);
  ctx.beginPath();
  ctx.arc(X(cx), Y(COURT.hoopY), COURT.three * s, ang, Math.PI - ang);
  ctx.stroke();
  // Zone restrictive, planche et cercle.
  ctx.beginPath();
  ctx.arc(X(cx), Y(COURT.hoopY), COURT.restricted * s, 0, Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(X(cx - 0.9), Y(1.2));
  ctx.lineTo(X(cx + 0.9), Y(1.2));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(cx), Y(COURT.hoopY), 0.3 * s, 0, Math.PI * 2);
  ctx.stroke();
  // Rond central sur la ligne médiane.
  ctx.beginPath();
  ctx.arc(X(cx), Y(COURT.h), 1.8 * s, Math.PI, Math.PI * 2);
  ctx.stroke();
}

function arrowHead(ctx, from, to, size) {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  ctx.beginPath();
  ctx.moveTo(to[0], to[1]);
  ctx.lineTo(to[0] - size * Math.cos(a - 0.45), to[1] - size * Math.sin(a - 0.45));
  ctx.lineTo(to[0] - size * Math.cos(a + 0.45), to[1] - size * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

// Raccourcit un segment pour ne pas recouvrir les pions.
function trim(a, b, r) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (d < r * 2.2) return null;
  const ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d;
  return [[a[0] + ux * r, a[1] + uy * r], [b[0] - ux * r, b[1] - uy * r]];
}

function drawMoves(ctx, board, box, r) {
  const pth = paths(board);
  const idx = {};
  const lw = Math.max(2.5, box.w * 0.008);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  board.moves.forEach(m => {
    let a, b;
    if (m.type === 'passe') {
      const pa = pth[m.p], pb = pth[m.vers];
      a = toPx(pa[pa.length - 1], box);
      b = toPx(pb[pb.length - 1], box);
    } else {
      idx[m.p] = (idx[m.p] || 0) + 1;
      a = toPx(pth[m.p][idx[m.p] - 1], box);
      b = toPx(m.to, box);
    }
    const seg = trim(a, b, r * 1.15);
    if (!seg) return;
    const [p0, p1] = seg;
    ctx.strokeStyle = m.type === 'passe' ? '#ffd28a' : LINE;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.setLineDash(m.type === 'passe' ? [lw * 2.5, lw * 2] : []);
    ctx.beginPath();
    if (m.type === 'dribble') {
      // Ligne en zigzag pour le dribble.
      const d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const ux = (p1[0] - p0[0]) / d, uy = (p1[1] - p0[1]) / d;
      const n = Math.max(3, Math.floor(d / (r * 0.7)));
      ctx.moveTo(p0[0], p0[1]);
      for (let k = 1; k < n; k++) {
        const o = (k % 2 ? 1 : -1) * r * 0.3;
        ctx.lineTo(p0[0] + ux * d * k / n - uy * o, p0[1] + uy * d * k / n + ux * o);
      }
      ctx.lineTo(p1[0], p1[1]);
    } else {
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (m.type === 'ecran') {
      // Écran : barre en T au bout du trajet.
      const a2 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) + Math.PI / 2;
      const t = r * 0.9;
      ctx.beginPath();
      ctx.moveTo(p1[0] - Math.cos(a2) * t, p1[1] - Math.sin(a2) * t);
      ctx.lineTo(p1[0] + Math.cos(a2) * t, p1[1] + Math.sin(a2) * t);
      ctx.stroke();
    } else {
      arrowHead(ctx, p0, p1, r * 0.8);
    }
  });
}

function drawPieces(ctx, board, box, u, r) {
  const st = boardAt(board, u);
  // Défenseurs : croix.
  ctx.strokeStyle = 'rgba(20,10,14,0.85)';
  ctx.lineWidth = Math.max(3, r * 0.22);
  board.defenders.forEach(d => {
    const [x, y] = toPx(d, box);
    const k = r * 0.55;
    ctx.beginPath();
    ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k);
    ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k);
    ctx.stroke();
  });
  // Attaquants : pions noirs étiquetés, comme sur un tableau de coach.
  POSITIONS.forEach(p => {
    const [x, y] = toPx(st.players[p], box);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#0d0b12';
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.strokeStyle = p === st.holder && !st.passing ? BRAND.orange : '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(r * (p.length > 1 ? 0.82 : 1))}px Oswald, Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p, x, y + r * 0.04);
  });
  // Ballon.
  let [bx, by] = toPx(st.ball, box);
  if (!st.passing) { bx -= r * 0.85; by += r * 0.75; }
  ctx.beginPath();
  ctx.arc(bx, by, r * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = BRAND.orange;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.strokeStyle = '#3a1406';
  ctx.stroke();
  ctx.textAlign = 'left';
}

/**
 * Dessine une image du tableau. info = {
 *   board (normalizeBoard) ou null, u (avancement 0–1), tag (petit texte en haut), badge (pastille à droite),
 *   title, text }
 */
export function drawBoard(ctx, W, H, info) {
  ctx.fillStyle = '#100d16';
  ctx.fillRect(0, 0, W, H);
  const pad = Math.round(W * 0.045);
  const headH = Math.round(H * 0.3);
  // Bande de couleur Gravity.
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, BRAND.orange);
  g.addColorStop(1, BRAND.magenta);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, Math.max(4, Math.round(H * 0.006)));
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  const tagSize = Math.round(W * 0.03);
  let y = pad;
  ctx.font = `700 ${tagSize}px Inter, system-ui, sans-serif`;
  let tagRoom = W - pad * 2;
  if (info.badge) {
    const bw = ctx.measureText(info.badge).width + tagSize * 1.4;
    const bh = tagSize * 1.7;
    const bx = W - pad - bw, by = y - tagSize * 0.35;
    ctx.fillStyle = info.slow ? BRAND.magenta : 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, bh / 2); else ctx.rect(bx, by, bw, bh);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(info.badge, bx + tagSize * 0.7, by + tagSize * 0.35);
    tagRoom -= bw + tagSize;
  }
  // Petit texte du haut, raccourci s'il touche la pastille.
  let tag = (info.tag || '').toUpperCase();
  while (tag && ctx.measureText(tag).width > tagRoom) tag = tag.slice(0, -2).trimEnd() + '…';
  ctx.fillStyle = BRAND.orange;
  ctx.fillText(tag, pad, y);
  y += tagSize * 1.9;
  const titleSize = Math.round(W * 0.058);
  ctx.font = `700 ${titleSize}px Oswald, Impact, sans-serif`;
  ctx.fillStyle = '#fff';
  const titleLines = wrapLines(ctx, (info.title || '').toUpperCase(), W - pad * 2).slice(0, 2);
  titleLines.forEach(l => { ctx.fillText(l, pad, y); y += titleSize * 1.12; });
  y += titleSize * 0.15;
  // Texte : la taille baisse jusqu'à ce que tout tienne dans l'en-tête.
  let size = Math.round(W * 0.034);
  let lines;
  for (;;) {
    ctx.font = `500 ${size}px Inter, system-ui, sans-serif`;
    lines = wrapLines(ctx, info.text, W - pad * 2);
    if (y + lines.length * size * 1.32 <= headH || size <= W * 0.024) break;
    size -= 1;
  }
  const maxLines = Math.max(1, Math.floor((headH - y) / (size * 1.32)));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + ' …';
  }
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  lines.forEach(l => { ctx.fillText(l, pad, y); y += size * 1.32; });

  const box = fitCourt(0, headH, W, H - headH, pad * 0.6);
  drawCourt(ctx, box);
  if (info.board) {
    const r = box.w * 0.042;
    drawMoves(ctx, info.board, box, r);
    drawPieces(ctx, info.board, box, info.u ?? 0, r);
  }
  // Signature discrète.
  ctx.font = `700 ${Math.round(W * 0.026)}px Oswald, Impact, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(BRAND.name.toUpperCase(), box.x + box.w - pad * 0.4, box.y + box.h - pad * 0.3);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}
