// Fonction Netlify du Studio beat : relais vers la bibliothèque libre de droits
// Openverse, utilisé quand le navigateur ne peut pas la joindre directement (CORS).
//   GET ?action=search&q=…&license=credit|free&page=N → résultats Openverse (licences filtrées ici aussi)
//   GET ?action=file&url=…                            → le fichier audio (hôtes autorisés seulement)
// Aucun secret : tout ce qui transite est déjà public. La liste d'hôtes empêche
// d'en faire un relais ouvert vers n'importe quel site.

const OPENVERSE = 'https://api.openverse.org/v1/audio/';
const UA = 'ArtCraftGravity/1.0 (https://art-craft-gravity.netlify.app)';
const LICENSES = { credit: 'cc0,pdm,by', free: 'cc0,pdm' };
const AUDIO_HOSTS = ['cdn.freesound.org', 'freesound.org', 'ccmixter.org', 'upload.wikimedia.org', 'jamendo.com', 'archive.org'];
// Réponse d'une fonction : 6 Mo maximum, base64 compris.
const MAX_FILE_BYTES = 4.4e6;

const json = (statusCode, body, extra = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', ...extra },
  body: JSON.stringify(body),
});

function allowedAudioUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  return AUDIO_HOSTS.some(a => h === a || h.endsWith('.' + a));
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Méthode non autorisée' });
  const q = event.queryStringParameters || {};
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
      return json(200, body, { 'Cache-Control': 'public, max-age=600', 'Netlify-CDN-Cache-Control': 'public, s-maxage=86400' });
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
      if (len > MAX_FILE_BYTES) return json(413, { error: 'Morceau trop lourd pour le relais (plus de 4,4 Mo).' });
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_FILE_BYTES) return json(413, { error: 'Morceau trop lourd pour le relais (plus de 4,4 Mo).' });
      return {
        statusCode: 200,
        headers: {
          'Content-Type': res.headers.get('content-type') || 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
        },
        body: buf.toString('base64'),
        isBase64Encoded: true,
      };
    }

    return json(400, { error: 'Action inconnue' });
  } catch (err) {
    return json(502, { error: 'Bibliothèque injoignable : ' + (err.message || err) });
  }
};
