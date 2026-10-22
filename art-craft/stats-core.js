// Statistiques automatiques par numéro de joueur : logique pure, testable avec Node.
// Utilisée par le module « Stats auto » (stats.js) et par le « Mode direct » (direct.js).

// Types d'actions notées. pts = points marqués, shot = tir (et lequel), reb/ast… = colonne du tableau.
export const EVENT_TYPES = {
  panier_2: { label: 'Panier à 2 pts', short: '+2', pts: 2, shot: '2', made: true },
  panier_3: { label: 'Panier à 3 pts', short: '+3', pts: 3, shot: '3', made: true },
  lf_reussi: { label: 'Lancer franc réussi', short: 'LF', pts: 1, shot: 'lf', made: true },
  tir_rate_2: { label: 'Tir à 2 pts raté', short: '2 ✗', pts: 0, shot: '2', made: false },
  tir_rate_3: { label: 'Tir à 3 pts raté', short: '3 ✗', pts: 0, shot: '3', made: false },
  lf_rate: { label: 'Lancer franc raté', short: 'LF ✗', pts: 0, shot: 'lf', made: false },
  rebond_off: { label: 'Rebond offensif', short: 'Reb O', pts: 0, stat: 'oreb' },
  rebond_def: { label: 'Rebond défensif', short: 'Reb D', pts: 0, stat: 'dreb' },
  passe_decisive: { label: 'Passe décisive', short: 'Passe', pts: 0, stat: 'ast' },
  interception: { label: 'Interception', short: 'Interc.', pts: 0, stat: 'stl' },
  contre: { label: 'Contre', short: 'Contre', pts: 0, stat: 'blk' },
  perte: { label: 'Perte de balle', short: 'Perte', pts: 0, stat: 'tov' },
  faute: { label: 'Faute', short: 'Faute', pts: 0, stat: 'pf' },
};
export const TYPE_KEYS = Object.keys(EVENT_TYPES);
// Actions qui méritent un clip dans l'Espace Joueurs (pas les fautes ni les lancers francs).
export const CLIP_TYPES = ['panier_2', 'panier_3', 'passe_decisive', 'interception', 'contre', 'rebond_off', 'rebond_def', 'perte', 'tir_rate_2', 'tir_rate_3'];

const round1 = v => Math.round(v * 10) / 10;

/**
 * Fenêtres de la vidéo à faire regarder à l'IA.
 * mode 'peaks' : autour des moments forts au son (l'action précède la réaction de la salle).
 * mode 'full'  : toute la vidéo, fenêtre après fenêtre (plus complet, plus cher).
 */
export function statsWindows({ duration, mode = 'peaks', peaks = [], max = 40, size = 15 }) {
  const out = [];
  if (mode === 'full') {
    for (let s = 0; s < duration - 1 && out.length < 2000; s += size) out.push({ start: round1(s), end: round1(Math.min(duration, s + size)) });
    return out;
  }
  [...peaks].sort((a, b) => b.score - a.score).slice(0, max)
    .map(p => ({ start: round1(Math.max(0, p.t - 8)), end: round1(Math.min(duration || Infinity, p.t + 2)) }))
    .sort((a, b) => a.start - b.start)
    .forEach(w => {
      const last = out[out.length - 1];
      if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
      else out.push(w);
    });
  return out;
}

// Instants des images envoyées pour une fenêtre (au plus max images).
export function windowTimes({ start, end }, { every = 1.25, max = 12 } = {}) {
  const len = Math.max(0.5, end - start);
  const n = Math.max(2, Math.min(max, Math.floor(len / every) + 1));
  return Array.from({ length: n }, (_, i) => round1(start + (len * i) / (n - 1)));
}

// Coût estimé (dollars US) : ~1 500 jetons par image (vue d'ensemble + vignettes), Claude Opus 5.5 à 4 $ / M en entrée.
export function estimateCost(windows, { every = 1.25, max = 12, crops = 8 } = {}) {
  const images = windows.reduce((n, w) => n + windowTimes(w, { every, max }).length + crops, 0);
  const tokensIn = images * 1100 + windows.length * 1500;
  const tokensOut = windows.length * 600;
  return (tokensIn * 4 + tokensOut * 20) / 1e6;
}

// Nettoie les actions renvoyées par l'IA pour une fenêtre.
export function normalizeEvents(raw, win, numbers = []) {
  const list = raw && Array.isArray(raw.evenements) ? raw.evenements : [];
  return list
    .filter(e => e && EVENT_TYPES[e.type])
    .map(e => {
      let t = Number(e.t);
      if (!Number.isFinite(t)) t = win.end - 1;
      t = round1(Math.min(win.end + 1, Math.max(win.start - 1, t)));
      const n = Number.parseInt(e.numero, 10);
      const equipe = e.equipe === 'adversaire' ? 'adversaire' : 'nous';
      return {
        t,
        type: e.type,
        equipe,
        numero: Number.isFinite(n) && n >= 0 && n < 100 ? n : null,
        confiance: ['haute', 'moyenne', 'basse'].includes(e.confiance) ? e.confiance : 'moyenne',
        detail: String(e.detail || '').slice(0, 160),
        known: equipe === 'nous' && Number.isFinite(n) && numbers.includes(n),
      };
    });
}

// Fusionne les actions de toutes les fenêtres : même action vue deux fois (fenêtres qui se touchent) = une seule.
export function mergeEvents(events, { gap = 2.5 } = {}) {
  const sorted = [...events].sort((a, b) => a.t - b.t);
  const out = [];
  sorted.forEach(e => {
    const dup = out.find(o => o.type === e.type && o.equipe === e.equipe && o.numero === e.numero && Math.abs(o.t - e.t) <= gap);
    if (!dup) out.push({ ...e });
    else if (e.confiance === 'haute' && dup.confiance !== 'haute') Object.assign(dup, e);
  });
  return out.map((e, i) => ({ ...e, id: i + 1 }));
}

const emptyLine = () => ({ pts: 0, fg2m: 0, fg2a: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, events: 0 });

function addEvent(line, e) {
  const def = EVENT_TYPES[e.type];
  if (!def) return;
  line.events++;
  line.pts += def.pts;
  if (def.shot === '2') { line.fg2a++; if (def.made) line.fg2m++; }
  if (def.shot === '3') { line.fg3a++; if (def.made) line.fg3m++; }
  if (def.shot === 'lf') { line.fta++; if (def.made) line.ftm++; }
  if (def.stat) line[def.stat]++;
}

/**
 * Tableau de stats (box score) : une ligne par numéro de notre équipe,
 * plus le total de l'équipe, la ligne « numéro inconnu » et les points de l'adversaire.
 */
export function boxScore(events, roster = []) {
  const byNum = new Map();
  roster.forEach(p => { if (Number.isFinite(p.numero)) byNum.set(p.numero, { player: p, numero: p.numero, ...emptyLine() }); });
  const unknown = { player: null, numero: null, ...emptyLine() };
  const team = emptyLine();
  const opp = emptyLine();
  events.forEach(e => {
    if (e.equipe === 'adversaire') { addEvent(opp, e); return; }
    addEvent(team, e);
    if (e.numero == null) { addEvent(unknown, e); return; }
    if (!byNum.has(e.numero)) byNum.set(e.numero, { player: null, numero: e.numero, ...emptyLine() });
    addEvent(byNum.get(e.numero), e);
  });
  const rows = [...byNum.values()].sort((a, b) => b.pts - a.pts || b.events - a.events || a.numero - b.numero);
  rows.forEach(r => { r.reb = r.oreb + r.dreb; });
  unknown.reb = unknown.oreb + unknown.dreb;
  team.reb = team.oreb + team.dreb;
  opp.reb = opp.oreb + opp.dreb;
  return { rows, unknown, team, opp, score: { nous: team.pts, adversaire: opp.pts } };
}

// Ligne de la table player_stats (Supabase) pour un joueur.
export function playerStatsRow(line, { playerId, gameDate, gameId = null, notes = '' }) {
  return {
    player_id: playerId,
    game_date: gameDate,
    game_id: gameId,
    points: line.pts,
    rebounds: line.oreb + line.dreb,
    off_rebounds: line.oreb,
    assists: line.ast,
    steals: line.stl,
    blocks: line.blk,
    turnovers: line.tov,
    fouls: line.pf,
    fg2_made: line.fg2m, fg2_att: line.fg2a,
    fg3_made: line.fg3m, fg3_att: line.fg3a,
    ft_made: line.ftm, ft_att: line.fta,
    source: 'art-craft',
    notes: String(notes).slice(0, 500),
  };
}

// Portion de vidéo d'un clip : l'action se prépare avant l'instant noté.
export function clipWindow(e, duration = Infinity, { before = 6, after = 2.5 } = {}) {
  const start = Math.max(0, e.t - before);
  const end = Math.min(duration, e.t + after);
  return { start: round1(start), dur: round1(Math.max(1, end - start)) };
}

// Joueurs concernés par un clip : celui qui fait l'action, et le passeur si un panier suit une passe décisive.
export function clipPlayers(e, events, { gap = 4 } = {}) {
  const nums = e.numero != null ? [e.numero] : [];
  if (EVENT_TYPES[e.type]?.made && EVENT_TYPES[e.type].shot !== 'lf') {
    events.filter(o => o.type === 'passe_decisive' && o.equipe === e.equipe && o.numero != null && Math.abs(o.t - e.t) <= gap)
      .forEach(o => { if (!nums.includes(o.numero)) nums.push(o.numero); });
  }
  return nums;
}

// ---------- Couleur des maillots (deux équipes) ----------

// Zone du torse dans une boîte de détection (là où est le maillot).
export function torsoBox(b) {
  return { x: b.x + b.w * 0.28, y: b.y + b.h * 0.2, w: b.w * 0.44, h: b.h * 0.3 };
}

const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

// k-moyennes à 2 groupes sur des couleurs RVB : sépare les deux équipes (maillots clairs / foncés…).
export function kmeans2(colors, iters = 12) {
  if (!colors.length) return { labels: [], centers: [] };
  const lum = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const sorted = [...colors].sort((a, b) => lum(a) - lum(b));
  let centers = [sorted[0].slice(), sorted[sorted.length - 1].slice()];
  let labels = colors.map(() => 0);
  for (let it = 0; it < iters; it++) {
    labels = colors.map(c => (dist2(c, centers[0]) <= dist2(c, centers[1]) ? 0 : 1));
    centers = centers.map((old, k) => {
      const mine = colors.filter((_, i) => labels[i] === k);
      if (!mine.length) return old;
      return [0, 1, 2].map(j => mine.reduce((s, c) => s + c[j], 0) / mine.length);
    });
  }
  return { labels, centers };
}

export const hex = c => '#' + c.map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

// Vignettes à envoyer à l'IA : un joueur = une vignette. Les joueurs bougent d'une image à l'autre,
// donc on part de l'image où l'on voit le plus de joueurs (la plus récente à égalité), puis on
// complète avec les autres images seulement pour des joueurs loin de ceux déjà pris.
// Les personnes assises (spectateurs, banc : boîte presque carrée) passent après les joueurs debout.
// aspect = largeur / hauteur de l'image (les boîtes sont en coordonnées 0 à 1).
export function pickCrops(dets, max = 8, aspect = 16 / 9) {
  const byFrame = new Map();
  dets.forEach(d => { if (!byFrame.has(d.frame)) byFrame.set(d.frame, []); byFrame.get(d.frame).push(d); });
  const frames = [...byFrame.keys()].sort((a, b) => byFrame.get(b).length - byFrame.get(a).length || b - a);
  const standing = d => d.h / (d.w * aspect) >= 1.6;
  const weight = d => d.score * d.h * (standing(d) ? 1 : 0.25);
  const rank = list => [...list].sort((a, b) => weight(b) - weight(a));
  const out = [];
  frames.forEach((f, i) => {
    for (const d of rank(byFrame.get(f))) {
      if (out.length >= max) return;
      const near = out.some(o => Math.abs(o.x + o.w / 2 - d.x - d.w / 2) < Math.max(o.w, d.w) * 1.2 && Math.abs(o.y + o.h - d.y - d.h) < Math.max(o.h, d.h) * 0.6);
      if (i === 0 || !near) out.push(d);
    }
  });
  return out;
}

// ---------- Mode direct → Stats auto ----------

// Actions notées en direct (instant en secondes depuis le début de l'enregistrement)
// recalées sur une autre vidéo : l'action « anchorId » se passe à « videoT » dans la vidéo.
export function syncEvents(events, anchorId, videoT) {
  const a = events.find(e => e.id === anchorId);
  if (!a) return events;
  const shift = videoT - a.t;
  return events.map(e => ({ ...e, t: round1(e.t + shift) }));
}

// Lit le fichier JSON exporté par le Mode direct.
export function parseLive(json) {
  const o = typeof json === 'string' ? JSON.parse(json) : json;
  if (!o || o.format !== 'artcraft-direct-1' || !Array.isArray(o.events)) throw new Error('Ce fichier ne vient pas du Mode direct d\'Art craft.');
  const events = mergeEvents(o.events.filter(e => e && EVENT_TYPES[e.type]).map(e => ({
    t: Number(e.t) || 0,
    type: e.type,
    equipe: e.equipe === 'adversaire' ? 'adversaire' : 'nous',
    numero: Number.isFinite(e.numero) ? e.numero : null,
    confiance: 'haute',
    detail: String(e.detail || ''),
  })), { gap: 0 });
  return { ...o, events };
}

export function fmtClock(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
}

// Pourcentage de réussite « 3/7 (43 %) ».
export function pct(made, att) {
  return att ? `${made}/${att} (${Math.round((made / att) * 100)} %)` : '—';
}
