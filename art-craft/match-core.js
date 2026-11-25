// Highlight par joueur et page du match à partager : logique pure, testable avec Node.
// Utilisée par le module « Stats auto » (stats-share.js). Inspiré de ce que proposent
// SportsVisio ou Hudl (feuille de match + highlights par joueur envoyés aux familles),
// refait avec notre code, gratuitement.
import { EVENT_TYPES, boxScore, clipWindow, clipPlayers, fmtClock, momentum } from './stats-core.js';

// Actions gardées dans le highlight d'un joueur, de la plus spectaculaire à la moins.
// Pas de tirs ratés, pertes ni fautes : c'est un montage pour le joueur et sa famille.
export const REEL_PRIORITY = ['panier_3', 'contre', 'panier_2', 'interception', 'passe_decisive', 'rebond_off', 'rebond_def'];
export const REEL_MAX_CLIPS = 12;
export const REEL_BEFORE = 5;
export const REEL_AFTER = 2.5;

const round1 = v => Math.round(v * 10) / 10;

/**
 * Extraits du highlight d'un joueur : ses meilleures actions (et les paniers marqués
 * sur ses passes décisives), au plus `max`, remis dans l'ordre du match.
 * Deux actions proches (ex. interception puis panier) forment un seul extrait.
 * Renvoie [{ start, dur, types: [...], t }].
 */
export function reelClips(events, numero, { duration = Infinity, max = REEL_MAX_CLIPS, before = REEL_BEFORE, after = REEL_AFTER } = {}) {
  const mine = events.filter(e => e.equipe === 'nous' && REEL_PRIORITY.includes(e.type) &&
    (e.numero === numero || (e.type !== 'passe_decisive' && clipPlayers(e, events).includes(numero))));
  // Une passe décisive est montrée par le panier qu'elle amène (la passe est dans l'extrait).
  const shown = mine.filter(e => !(e.type === 'passe_decisive' && mine.some(o => o !== e && EVENT_TYPES[o.type].made && Math.abs(o.t - e.t) <= 4)));
  const rank = e => REEL_PRIORITY.indexOf(e.type) * 1000 - (e.confiance === 'haute' ? 1 : 0);
  const best = [...shown].sort((a, b) => rank(a) - rank(b) || a.t - b.t).slice(0, max).sort((a, b) => a.t - b.t);
  const out = [];
  for (const e of best) {
    const { start, dur } = clipWindow(e, duration, { before, after });
    const last = out[out.length - 1];
    if (last && start <= last.start + last.dur + 0.5) {
      last.dur = round1(Math.max(last.dur, start + dur - last.start));
      last.types.push(e.type);
    } else {
      out.push({ start, dur, t: e.t, types: [e.type] });
    }
  }
  return out;
}

export const reelDuration = clips => round1(clips.reduce((s, c) => s + c.dur, 0));

// Ligne de stats courte pour l'habillage du highlight : « 18 PTS · 6 REB · 4 PASSES ».
export function statLine(r) {
  const parts = [`${r.pts} PTS`];
  const reb = r.oreb + r.dreb;
  if (reb) parts.push(`${reb} REB`);
  if (r.ast) parts.push(`${r.ast} PASSE${r.ast > 1 ? 'S' : ''}`);
  if (r.stl) parts.push(`${r.stl} INTERC.`);
  if (r.blk) parts.push(`${r.blk} CONTRE${r.blk > 1 ? 'S' : ''}`);
  return parts.join(' · ');
}

/**
 * Nom affiché sur la page publique : les joueurs sont souvent mineurs, donc par défaut
 * le prénom seulement. privacy = 'full' | 'first' | 'number'.
 */
export function publicName(player, numero, privacy = 'first') {
  if (privacy === 'number' || !player || !player.full_name) return `#${numero}`;
  const name = String(player.full_name).trim().replace(/\s+/g, ' ');
  if (privacy === 'full') return name;
  return name.split(' ')[0];
}

// Identifiant de page non devinable (le lien est la seule protection, comme un lien « non répertorié »).
export function pageId(rand = () => (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now())) {
  return String(rand()).replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 40);
}

const lineOf = r => ({
  pts: r.pts, fg2: [r.fg2m, r.fg2a], fg3: [r.fg3m, r.fg3a], ft: [r.ftm, r.fta],
  oreb: r.oreb, dreb: r.dreb, ast: r.ast, stl: r.stl, blk: r.blk, tov: r.tov, pf: r.pf,
});

/**
 * Données de la page du match (fichier data.json lu par la page publique).
 * clips : [{ id, t, type, numeros, file }] ; reels : Map numero → { file, dur }.
 * Ne contient que des noms selon `privacy`, jamais d'identifiant Supabase de joueur.
 */
export function matchPageData({ events, roster = [], team = 'Gravity', opponent = '', date = '', privacy = 'first', clips = [], reels = new Map(), created = new Date().toISOString() }) {
  const box = boxScore(events, roster);
  const players = box.rows.filter(r => r.events).map(r => ({
    numero: r.numero,
    nom: publicName(r.player, r.numero, privacy),
    ligne: lineOf(r),
    resume: statLine(r),
    reel: reels.get(r.numero) || null,
  }));
  const mom = momentum(events);
  return {
    v: 1,
    created,
    team: String(team || 'Gravity').slice(0, 80),
    opponent: String(opponent || 'Adversaire').slice(0, 80),
    date,
    score: box.score,
    players,
    unknown: box.unknown.events ? lineOf(box.unknown) : null,
    total: lineOf(box.team),
    opp: lineOf(box.opp),
    momentum: (mom.points || []).map(p => [round1(p.t), p.diff]),
    clips: clips.map(c => ({
      t: round1(c.t), clock: fmtClock(c.t), type: c.type, label: EVENT_TYPES[c.type]?.label || c.type,
      numeros: c.numeros || [], file: c.file,
    })),
  };
}
