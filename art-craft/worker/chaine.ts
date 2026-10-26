// Gardien de la chaîne YouTube (Cloudflare Worker uniquement : stockage KV + tâche planifiée).
// La chaîne est reliée une fois (connexion Google « hors ligne ») ; le jeton de
// renouvellement reste dans le KV, jamais envoyé au navigateur. Tous les 2 jours (cron du
// wrangler.toml), le Worker corrige les descriptions et les tags, puis garde un rapport.
// Les titres et les miniatures ne sont jamais changés ici : la page « Ma chaîne » le fait
// depuis le navigateur, avec la connexion Google du propriétaire.
import { auditVideo, normalizeConfig, reportText, DEFAULT_CONFIG } from '../chaine-core.js';

type KV = {
  get(key: string, type: 'json'): Promise<any>;
  put(key: string, value: string, opts?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};
type Get = (name: string) => string | undefined;

const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const API = 'https://www.googleapis.com/youtube/v3';
const MAX_VIDEOS = 150;   // vidéos relues à chaque passage (les plus récentes)
const MAX_UPDATES = 25;   // 50 unités de quota par mise à jour : 1 250 sur 10 000 par jour
const MIN_GAP_MS = 15 * 60e3; // « Vérifier maintenant » au plus une fois par 15 min

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

async function ytFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(path.startsWith('http') ? path : `${API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = j.error?.errors?.[0]?.reason;
    if (reason === 'quotaExceeded') throw new Error('Quota YouTube du jour épuisé : la suite au prochain passage.');
    throw new Error(j.error?.message || `YouTube a répondu ${res.status}`);
  }
  return j;
}

// Jeton d'accès à partir du jeton de renouvellement gardé dans le KV.
async function accessToken(kv: KV, get: Get) {
  const auth = await kv.get('auth', 'json');
  if (!auth?.refresh_token) throw new Error('Chaîne pas encore reliée.');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: get('GOOGLE_CLIENT_ID') || '', client_secret: get('GOOGLE_CLIENT_SECRET') || '', refresh_token: auth.refresh_token, grant_type: 'refresh_token' }),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) {
    if (j.error === 'invalid_grant') {
      await kv.put('auth', JSON.stringify({ ...auth, broken: true }));
      throw new Error('Google a révoqué l\'accès (mot de passe changé, accès retiré, ou application Google encore « en test » : l\'accès expire alors après 7 jours). Reconnecte la chaîne.');
    }
    throw new Error(`Connexion Google refusée (${j.error || res.status}).`);
  }
  return j.access_token as string;
}

// Le jeton Google envoyé par la page appartient-il bien au propriétaire de la chaîne reliée ?
async function ownerCheck(req: Request, kv: KV) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const auth = await kv.get('auth', 'json');
  if (!token || !auth?.channelId) return false;
  try {
    const r = await ytFetch('channels?part=id&mine=true', token);
    return r.items?.[0]?.id === auth.channelId;
  } catch { return false; }
}

export async function runAudit(kv: KV, get: Get) {
  const cfg = normalizeConfig((await kv.get('config', 'json')) || DEFAULT_CONFIG);
  const auth = await kv.get('auth', 'json');
  const report: any = { at: Date.now(), channel: auth?.title || '', checked: 0, updated: [], pending: 0, titles: [], hashtags: [], thumbs: [], errors: [] };
  if (!cfg.enabled) {
    report.errors.push('Gardien en pause (réglage « Corrections automatiques »).');
    await kv.put('report', JSON.stringify(report));
    return report;
  }
  try {
    const token = await accessToken(kv, get);
    const ch = await ytFetch('channels?part=contentDetails,snippet&mine=true', token);
    const channel = ch.items?.[0];
    if (!channel) throw new Error('Aucune chaîne sur ce compte Google.');
    report.channel = channel.snippet.title;
    const uploads = channel.contentDetails.relatedPlaylists.uploads;
    const ids: string[] = [];
    let page = '';
    while (ids.length < MAX_VIDEOS) {
      const r = await ytFetch(`playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}${page ? `&pageToken=${page}` : ''}`, token);
      (r.items || []).forEach((it: any) => ids.push(it.contentDetails.videoId));
      page = r.nextPageToken;
      if (!page) break;
    }
    const thumbs = (await kv.get('thumbs', 'json')) || {};
    const ignored = (await kv.get('ignored', 'json')) || {};
    for (let i = 0; i < ids.length; i += 50) {
      const r = await ytFetch(`videos?part=snippet&id=${ids.slice(i, i + 50).join(',')}`, token);
      for (const v of r.items || []) {
        const a = auditVideo(v, cfg, thumbs);
        if (a.skipped) continue;
        report.checked++;
        if (a.snippet) {
          if (report.updated.length >= MAX_UPDATES) report.pending++;
          else {
            try {
              await ytFetch('videos?part=snippet', token, { method: 'PUT', body: JSON.stringify({ id: v.id, snippet: a.snippet }) });
              report.updated.push({ id: v.id, title: a.title, fixes: a.fixes });
            } catch (e: any) {
              report.errors.push(`${a.title} : ${e.message}`);
              if (/Quota/.test(e.message)) { report.pending++; break; }
            }
          }
        }
        if (a.titleIssues.length && !ignored[`title:${v.id}`]) report.titles.push({ id: v.id, title: a.title, issues: a.titleIssues, suggestion: a.titleSuggestion });
        if (a.hashtagIssue) report.hashtags.push({ id: v.id, title: a.title, issue: a.hashtagIssue });
        if (a.needsThumb) report.thumbs.push({ id: v.id, title: a.title });
      }
    }
  } catch (e: any) {
    report.errors.push(e.message);
  }
  await kv.put('report', JSON.stringify(report));
  await sendReport(report, get);
  return report;
}

// Rapport par courriel (Brevo, plan gratuit), seulement si les 3 variables sont là.
async function sendReport(report: any, get: Get) {
  const key = get('BREVO_API_KEY'), from = get('MAILER_FROM_EMAIL'), to = get('CHAINE_REPORT_EMAIL');
  if (!key || !from || !to) return;
  const nothing = !report.updated.length && !report.titles.length && !report.hashtags.length && !report.errors.length;
  if (nothing) return;
  const text = reportText(report);
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Art craft — Gravity', email: from },
      to: [{ email: to }],
      subject: `Ta chaîne YouTube : ${report.updated.length} vidéo(s) corrigée(s), ${report.titles.length} titre(s) à revoir`,
      htmlContent: `<pre style="font:14px/1.5 system-ui,sans-serif;white-space:pre-wrap">${text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[c])}</pre>`,
    }),
  }).catch(() => {});
}

export async function handleChaine(req: Request, kv: KV | undefined, get: Get): Promise<Response> {
  const url = new URL(req.url);
  const route = url.pathname.replace('/api/chaine/', '');
  if (!kv) return json({ error: 'Stockage KV « CHAINE » absent du Worker.' }, 500);
  const clientId = get('GOOGLE_CLIENT_ID') || '';
  const ready = Boolean(clientId && get('GOOGLE_CLIENT_SECRET'));
  const redirectUri = `${url.origin}/api/chaine/callback`;

  if (route === 'status' && req.method === 'GET') {
    const auth = await kv.get('auth', 'json');
    return json({
      ready, clientId,
      channel: auth ? { id: auth.channelId, title: auth.title, since: auth.at, broken: Boolean(auth.broken) } : null,
      config: normalizeConfig((await kv.get('config', 'json')) || DEFAULT_CONFIG),
      report: await kv.get('report', 'json'),
      thumbs: (await kv.get('thumbs', 'json')) || {},
      email: Boolean(get('BREVO_API_KEY') && get('MAILER_FROM_EMAIL') && get('CHAINE_REPORT_EMAIL')),
    });
  }

  if (route === 'connect' && req.method === 'GET') {
    if (!ready) return json({ error: 'GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET manquent dans les variables du Worker.' }, 500);
    const state = crypto.randomUUID();
    await kv.put(`state:${state}`, '1', { expirationTtl: 600 });
    const q = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPE, access_type: 'offline', prompt: 'consent', state });
    return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`, 302);
  }

  if (route === 'callback' && req.method === 'GET') {
    const back = (msg: string) => Response.redirect(`${url.origin}/chaine.html?msg=${encodeURIComponent(msg)}`, 302);
    const state = url.searchParams.get('state') || '';
    if (!state || !(await kv.get(`state:${state}`, 'json'))) return back('Lien de connexion expiré : recommence.');
    await kv.delete(`state:${state}`);
    if (url.searchParams.get('error')) return back('Connexion annulée.');
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: url.searchParams.get('code') || '', client_id: clientId, client_secret: get('GOOGLE_CLIENT_SECRET') || '', redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    });
    const t: any = await res.json().catch(() => ({}));
    if (!res.ok || !t.refresh_token) return back(`Google n'a pas donné d'accès permanent (${t.error || res.status}).`);
    let channel: any;
    try { channel = (await ytFetch('channels?part=snippet&mine=true', t.access_token)).items?.[0]; } catch { /* plus bas */ }
    if (!channel) return back('Ce compte Google n\'a pas de chaîne YouTube.');
    // Une seule chaîne : une autre ne peut pas prendre la place de celle déjà reliée.
    const lock = get('YT_CHANNEL_ID') || (await kv.get('auth', 'json'))?.channelId;
    if (lock && lock !== channel.id) return back(`Refusé : « ${channel.snippet.title} » n'est pas la chaîne reliée à Art craft.`);
    await kv.put('auth', JSON.stringify({ refresh_token: t.refresh_token, channelId: channel.id, title: channel.snippet.title, at: Date.now() }));
    return back(`Chaîne « ${channel.snippet.title} » reliée.`);
  }

  if (route === 'run' && req.method === 'POST') {
    const last = await kv.get('report', 'json');
    if (last && Date.now() - last.at < MIN_GAP_MS) return json({ error: 'Vérification déjà faite il y a moins de 15 minutes.' }, 429);
    return json(await runAudit(kv, get));
  }

  // Miniature actuelle d'une vidéo (fond de la miniature Gravity ; i.ytimg.com n'autorise pas le canvas).
  if (route === 'frame' && req.method === 'GET') {
    const id = url.searchParams.get('id') || '';
    if (!/^[\w-]{11}$/.test(id)) return json({ error: 'id invalide' }, 400);
    for (const name of ['maxresdefault', 'sddefault', 'hqdefault']) {
      const r = await fetch(`https://i.ytimg.com/vi/${id}/${name}.jpg`);
      if (r.ok) return new Response(r.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=600' } });
    }
    return json({ error: 'image introuvable' }, 404);
  }

  // Actions du propriétaire (vérifiées avec son jeton Google) : réglages, miniature faite, titre ignoré.
  if (route === 'owner' && req.method === 'POST') {
    if (!(await ownerCheck(req, kv))) return json({ error: 'Connecte-toi avec le compte Google de la chaîne reliée.' }, 403);
    const body: any = await req.json().catch(() => ({}));
    if (body.config) {
      const cfg = normalizeConfig(body.config);
      await kv.put('config', JSON.stringify(cfg));
      return json({ ok: true, config: cfg });
    }
    if (body.thumb && /^[\w-]{11}$/.test(body.thumb)) {
      const thumbs = (await kv.get('thumbs', 'json')) || {};
      thumbs[body.thumb] = Date.now();
      await kv.put('thumbs', JSON.stringify(thumbs));
      return json({ ok: true });
    }
    if (body.ignoreTitle && /^[\w-]{11}$/.test(body.ignoreTitle)) {
      const ignored = (await kv.get('ignored', 'json')) || {};
      ignored[`title:${body.ignoreTitle}`] = Date.now();
      await kv.put('ignored', JSON.stringify(ignored));
      return json({ ok: true });
    }
    return json({ error: 'Demande inconnue' }, 400);
  }

  return json({ error: 'Introuvable' }, 404);
}
