// Mode direct ↔ chaîne YouTube Gravity Basketball (live diffusé par l'appli XbotGo).
// API YouTube Data v3 appelée directement depuis le navigateur, avec la connexion Google
// officielle (permission youtube.force-ssl : lire ses lives, écrire dans leur chat,
// modifier la description de ses vidéos). Aucun secret, aucune fonction serveur.
import { $ } from './common.js';
import { GOOGLE_CLIENT_ID, googleToken } from './google-auth.js';
import { CHAT_BUDGET, canSend, buildChapters, chapterText, withChapters } from './youtube-core.js';

const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const API = 'https://www.googleapis.com/youtube/v3';

let token = null;
const live = { id: '', chatId: '', title: '', startMs: 0, sent: 0, lastAt: 0, lastIaAt: 0, errors: 0 };

async function api(path, init = {}) {
  if (!token || token.expires < Date.now() + 60e3) token = await googleToken(SCOPE, 'YouTube');
  const res = await fetch(`${API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token.value}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers || {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason;
    if (reason === 'quotaExceeded') throw new Error('Quota YouTube du jour épuisé (10 000 unités) : réessaie demain.');
    if (reason === 'liveChatEnded' || reason === 'liveChatNotFound') throw new Error('Le chat de ce live est fermé.');
    if (reason === 'youtubeSignupRequired' || reason === 'insufficientPermissions') throw new Error('Ce compte Google n\'a pas accès à la chaîne : connecte-toi avec le compte de la chaîne Gravity Basketball.');
    throw new Error((j.error && j.error.message) || `YouTube a répondu ${res.status}`);
  }
  return j;
}

export const youtubeLinked = () => Boolean(live.chatId);
export const youtubeLive = () => ({ ...live });

function status(text) { $('yt-status').textContent = text; }

// Lives en cours (et à venir) de la chaîne connectée.
async function findBroadcasts() {
  const lists = await Promise.all(['active', 'upcoming'].map(s =>
    api(`liveBroadcasts?part=snippet,status&broadcastStatus=${s}&broadcastType=all&maxResults=10`).then(r => r.items || [])));
  return lists.flat();
}

async function connect() {
  const btn = $('yt-connect');
  btn.disabled = true;
  status('Connexion à YouTube…');
  try {
    const items = await findBroadcasts();
    const sel = $('yt-broadcast');
    sel.innerHTML = '';
    if (!items.length) {
      status('Aucun live en cours ou programmé sur la chaîne. Lance le direct dans l\'appli XbotGo, puis clique encore « Trouver mon live ».');
      sel.hidden = true;
      return;
    }
    items.forEach(b => sel.appendChild(new Option(`${b.status.lifeCycleStatus === 'live' ? '🔴 En direct' : '🕒 Programmé'} · ${b.snippet.title}`, b.id)));
    sel.hidden = false;
    sel.onchange = () => pick(items.find(b => b.id === sel.value));
    pick(items[0]);
  } catch (err) {
    status(err.message);
  } finally {
    btn.disabled = false;
  }
}

function pick(b) {
  if (!b) return;
  live.id = b.id;
  live.chatId = b.snippet.liveChatId || '';
  live.title = b.snippet.title;
  live.startMs = b.snippet.actualStartTime ? Date.parse(b.snippet.actualStartTime) : 0;
  status(live.chatId
    ? `Relié au live « ${b.snippet.title} » : les paniers et le score s'écriront dans son chat.`
    : `Live « ${b.snippet.title} » trouvé, mais son chat est désactivé : seuls les chapitres seront possibles.`);
  renderQuota();
}

function renderQuota() {
  if (!live.id) return;
  $('yt-quota').textContent = live.chatId ? `${live.sent} / ${CHAT_BUDGET} messages envoyés dans le chat pour ce match` : '';
}

// Envoie un message dans le chat du live (sans bloquer le Mode direct si YouTube refuse).
export async function sendChat(text, kind = 'action') {
  if (!live.chatId || !text) return false;
  if (kind === 'ia' && !$('yt-ai').checked) return false;
  if (kind !== 'ia' && !$('yt-chat').checked) return false;
  const now = Date.now();
  if (!canSend(kind, { sent: live.sent, lastAt: kind === 'ia' ? live.lastIaAt : live.lastAt, now })) return false;
  live.sent++;
  if (kind === 'ia') live.lastIaAt = now; else live.lastAt = now;
  try {
    await api('liveChat/messages?part=snippet', {
      method: 'POST',
      body: JSON.stringify({ snippet: { liveChatId: live.chatId, type: 'textMessageEvent', textMessageDetails: { messageText: text } } }),
    });
    renderQuota();
    return true;
  } catch (err) {
    live.sent--;
    live.errors++;
    status('Chat YouTube : ' + err.message);
    if (/fermé|Quota/.test(err.message)) live.chatId = '';
    return false;
  }
}

// Début de la vidéo YouTube (pour caler les chapitres) : heure réelle du début du live.
async function videoStart() {
  if (live.startMs) return live.startMs;
  const r = await api(`videos?part=liveStreamingDetails&id=${live.id}`);
  const d = r.items && r.items[0] && r.items[0].liveStreamingDetails;
  live.startMs = d && d.actualStartTime ? Date.parse(d.actualStartTime) : 0;
  return live.startMs;
}

/**
 * Chapitres du match. Avec un live relié, ils sont calés sur l'heure de début du live.
 * Sinon, « offset » = moment de la vidéo où le match commence (en secondes).
 */
export function matchChapters(match, { origin, offset = 0 } = {}) {
  const base = origin || (match.startedAt - offset * 1000);
  return buildChapters({
    events: match.events, markers: match.markers || [], origin: base,
    team: match.team, opponent: match.opponent, roster: match.roster,
  });
}

// Ajoute les chapitres à la description de la vidéo du live (garde le titre, les tags, etc.).
export async function publishChapters(match) {
  if (!live.id) throw new Error('Relie d\'abord le live YouTube (bouton « Trouver mon live »).');
  const origin = await videoStart();
  if (!origin) throw new Error('Le live n\'a pas encore commencé : impossible de caler les chapitres.');
  const { chapters, valid } = matchChapters(match, { origin });
  if (!valid) throw new Error('Il faut au moins 2 paniers (ou quarts-temps) espacés de 10 s pour faire des chapitres YouTube.');
  const r = await api(`videos?part=snippet&id=${live.id}`);
  const v = r.items && r.items[0];
  if (!v) throw new Error('Vidéo du live introuvable.');
  const sn = v.snippet;
  const snippet = { title: sn.title, categoryId: sn.categoryId, description: withChapters(sn.description, chapters) };
  ['tags', 'defaultLanguage', 'defaultAudioLanguage'].forEach(k => { if (sn[k]) snippet[k] = sn[k]; });
  await api('videos?part=snippet', { method: 'PUT', body: JSON.stringify({ id: live.id, snippet }) });
  return { url: `https://www.youtube.com/watch?v=${live.id}`, count: chapters.length, text: chapterText(chapters) };
}

// ---------- Interface ----------
$('yt-connect').addEventListener('click', connect);
$('yt-setup').hidden = Boolean(GOOGLE_CLIENT_ID);
