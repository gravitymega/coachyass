// Live YouTube (diffusé avec l'appli XbotGo) relié au Mode direct : logique pure, testable avec Node.
// Pendant le match, les grosses actions et le score s'écrivent dans le chat du live ; après le
// match, chaque panier devient un chapitre cliquable dans la description de la vidéo.
import { EVENT_TYPES } from './stats-core.js';

// Actions écrites dans le chat (les autres restent dans la feuille de stats).
export const CHAT_TYPES = ['panier_2', 'panier_3', 'interception', 'contre'];
// Actions qui deviennent des chapitres.
export const CHAPTER_TYPES = ['panier_2', 'panier_3'];
export const CHAT_MAX = 200;          // longueur max d'un message du chat YouTube
export const DESCRIPTION_MAX = 5000;  // longueur max d'une description YouTube
// Quota de l'API YouTube : 10 000 unités par jour, un message du chat en coûte 50.
// On garde de la marge pour la recherche du live et la mise à jour des chapitres.
export const CHAT_BUDGET = 150;
const CHAPTER_START = '— Chapitres (Art craft) —';
const CHAPTER_END = '— fin des chapitres —';

// « 1:02:05 » ou « 4:31 » (format attendu par YouTube pour les chapitres).
export function ytTime(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

const cut = (text, max) => (text.length <= max ? text : text.slice(0, max - 1).trimEnd() + '…');

// Qui a fait l'action : « #12 Alex », « #12 », ou le nom de l'équipe.
export function actor(ev, { team = 'Nous', opponent = 'Adversaire', roster = [] } = {}) {
  if (ev.equipe === 'adversaire') return opponent;
  if (ev.numero == null) return team;
  const p = roster.find(r => r.numero === ev.numero);
  const first = p && p.full_name ? ' ' + p.full_name.split(' ')[0] : '';
  return `#${ev.numero}${first}`;
}

// Message du chat pour une action (null si l'action ne s'écrit pas dans le chat).
export function chatMessage(ev, { team = 'Nous', opponent = 'Adversaire', roster = [], score, period = '', clock = '' } = {}) {
  if (!CHAT_TYPES.includes(ev.type)) return null;
  const def = EVENT_TYPES[ev.type];
  const icon = def.pts ? '🏀' : ev.type === 'contre' ? '🖐' : '🔥';
  const who = actor(ev, { team, opponent, roster });
  const sc = score ? ` · ${team} ${score.nous} – ${score.adversaire} ${opponent}` : '';
  const when = period ? ` (${period}${clock ? ' ' + clock : ''})` : '';
  return cut(`${icon} ${def.label.toUpperCase()} — ${who} !${sc}${when}`, CHAT_MAX);
}

// Phrase du commentateur IA, préfixée pour qu'on la reconnaisse dans le chat.
export function aiChatMessage(phrase) {
  const p = String(phrase || '').trim();
  return p ? cut(`🎙 ${p}`, CHAT_MAX) : null;
}

/**
 * Faut-il envoyer ce message maintenant ? Les actions passent toujours (au plus une toutes les 4 s),
 * les phrases de l'IA au plus une toutes les 20 s ; rien au-delà du budget de quota du match.
 */
export function canSend(kind, { sent = 0, lastAt = 0, now = Date.now(), budget = CHAT_BUDGET } = {}) {
  if (sent >= budget) return false;
  const gap = kind === 'ia' ? 20e3 : 4e3;
  return now - lastAt >= gap;
}

/**
 * Chapitres de la vidéo : « 0:00 Avant-match », le début de chaque quart-temps et chaque panier
 * (avec le score après le panier). origin = heure (ms) du début de la vidéo YouTube.
 * YouTube exige : 1er chapitre à 0:00, au moins 3 chapitres, au moins 10 s entre deux.
 */
export function buildChapters({ events = [], markers = [], origin, team = 'Nous', opponent = 'Adversaire', roster = [], lead = 8, minGap = 10, maxShift = 8 }) {
  const items = [];
  markers.forEach(m => items.push({ at: (m.wall - origin) / 1000, label: m.label, prio: 2 }));
  let nous = 0, adv = 0;
  [...events].filter(e => Number.isFinite(e.wall)).sort((a, b) => a.wall - b.wall).forEach(e => {
    const pts = EVENT_TYPES[e.type] ? EVENT_TYPES[e.type].pts : 0;
    if (e.equipe === 'adversaire') adv += pts; else nous += pts;
    if (!CHAPTER_TYPES.includes(e.type)) return;
    // Le chapitre commence quelques secondes avant le panier, pour voir l'action.
    items.push({ at: (e.wall - origin) / 1000 - lead, label: `${EVENT_TYPES[e.type].label} — ${actor(e, { team, opponent, roster })} (${nous}-${adv})`, prio: 1 });
  });
  items.sort((a, b) => a.at - b.at || b.prio - a.prio);
  const out = [{ at: 0, label: 'Avant-match' }];
  items.forEach(it => {
    if (it.at < minGap) {
      // Trop près du début : un début de quart-temps remplace « Avant-match ».
      if (it.prio === 2 && out.length === 1) out[0].label = it.label;
      return;
    }
    const last = out[out.length - 1];
    let at = it.at;
    if (at - last.at < minGap) {
      // Trop près du chapitre précédent : on le décale un peu (8 s au plus) plutôt que de le perdre.
      if (last.at + minGap - at <= maxShift) at = last.at + minGap;
      else {
        if (it.prio > (last.prio || 0)) last.label = it.label; // le quart-temps l'emporte
        return;
      }
    }
    out.push({ at, label: it.label, prio: it.prio });
  });
  return { chapters: out.map(c => ({ at: Math.floor(c.at), label: c.label })), valid: out.length >= 3 };
}

export const chapterText = chapters => chapters.map(c => `${ytTime(c.at)} ${c.label}`).join('\n');

// Ajoute (ou remplace) le bloc de chapitres d'Art craft à la fin de la description existante.
export function withChapters(description, chapters) {
  let base = String(description || '');
  const i = base.indexOf(CHAPTER_START);
  if (i >= 0) {
    const j = base.indexOf(CHAPTER_END, i);
    base = (base.slice(0, i) + (j >= 0 ? base.slice(j + CHAPTER_END.length) : '')).replace(/\n{3,}/g, '\n\n');
  }
  base = base.trimEnd();
  const block = `${CHAPTER_START}\n${chapterText(chapters)}\n${CHAPTER_END}`;
  const room = DESCRIPTION_MAX - block.length - 2;
  if (room < 0) throw new Error('Trop de chapitres pour la description YouTube.');
  return (base ? base.slice(0, room) + '\n\n' : '') + block;
}
