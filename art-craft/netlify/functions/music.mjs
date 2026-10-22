// Relais du Studio beat vers la bibliothèque libre de droits Openverse, utilisé quand le
// navigateur ne peut pas la joindre directement (CORS). Commun à Netlify (ci-dessous) et à
// Cloudflare Pages (functions/api/music.js).
//   GET ?action=search&q=…&license=credit|free&page=N → résultats Openverse (licences filtrées ici aussi)
//   GET ?action=file&url=…                            → le fichier audio (hôtes autorisés seulement)
// Aucun secret : tout ce qui transite est déjà public. La liste d'hôtes empêche
// d'en faire un relais ouvert vers n'importe quel site.

const OPENVERSE = 'https://api.openverse.org/v1/audio/';
const UA = 'ArtCraftGravity/1.0 (outil interne Gravity Basketball)';
const LICENSES = { credit: 'cc0,pdm,by', free: 'cc0,pdm' };
const AUDIO_HOSTS = ['cdn.freesound.org', 'freesound.org', 'ccmixter.org', 'upload.wikimedia.org', 'jamendo.com', 'archive.org'];
// Réponse d'une fonction Netlify : 6 Mo maximum (Cloudflare n'a pas cette limite).
const NETLIFY_MAX_BYTES = 4.4e6;

const json = (status, body, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } });

function allowedAudioUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  return AUDIO_HOSTS.some(a => h === a || h.endsWith('.' + a));
}

export async function handleMusic(req, { maxBytes = NETLIFY_MAX_BYTES } = {}) {
  if (req.method !== 'GET') return json(405, { error: 'Méthode non autorisée' });
  const q = Object.fromEntries(new URL(req.url).searchParams);
  const tooBig = `Morceau trop lourd pour le relais (plus de ${(maxBytes / 1e6).toFixed(1).replace('.', ',')} Mo).`;
  try {
    if (q.action === 'search') {
      const license = LICENSES[q.license] ? q.license : 'credit';
      const params = new URLSearchParams({
        q: String(q.q || '').trim().slice(0, 200),
        license: LICENSES[license],
        page: String(Math.max(1, Math.min(20, parseInt(q.page, 10) || 1))),
        page_size: '20',
        mature: 'false',
      });
      const res = await fetch(`${OPENVERSE}?${params}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return json(res.status === 429 ? 429 : 502, { error: res.status === 429 ? 'Trop de recherches : réessaie dans une minute.' : `Openverse a répondu ${res.status}` });
      const allowed = LICENSES[license].split(',');
      body.results = (body.results || []).filter(r => allowed.includes(String(r.license).toLowerCase()));
      return json(200, body, { 'Cache-Control': 'public, max-age=600', 'Netlify-CDN-Cache-Control': 'public, s-maxage=86400', 'Cloudflare-CDN-Cache-Control': 'public, max-age=86400' });
    }

    if (q.action === 'file') {
      if (!allowedAudioUrl(q.url)) return json(400, { error: 'Adresse de fichier non autorisée' });
      // Certains hébergeurs ne répondent jamais aux serveurs : on abandonne avant
      // la limite de temps de la fonction pour renvoyer une erreur claire.
      let res;
      try {
        res = await fetch(q.url, { redirect: 'follow', signal: AbortSignal.timeout(8000) });
      } catch {
        return json(504, { error: 'Ce site ne laisse pas le relais télécharger le morceau.' });
      }
      if (!res.ok || !allowedAudioUrl(res.url || q.url)) return json(502, { error: `Fichier inaccessible (${res.status})` });
      const len = +res.headers.get('content-length') || 0;
      if (len > maxBytes) return json(413, { error: tooBig });
      const buf = await res.arrayBuffer();
      if (buf.byteLength > maxBytes) return json(413, { error: tooBig });
      return new Response(buf, {
        status: 200,
        headers: {
          'Content-Type': res.headers.get('content-type') || 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return json(400, { error: 'Action inconnue' });
  } catch (err) {
    return json(502, { error: 'Bibliothèque injoignable : ' + (err.message || err) });
  }
}

export default (req) => handleMusic(req);
