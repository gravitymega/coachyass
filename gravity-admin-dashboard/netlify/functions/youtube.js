// Dernières vidéos de la chaîne YouTube Gravity Basketball, pour la section « Vidéos »
// du site public (gravity.osmm-mtl.site). Gratuit et sans clé : on lit le flux RSS
// public de la chaîne (youtube.com/feeds/videos.xml), que le navigateur ne peut pas
// lire lui-même (pas d'en-tête CORS).
//
// Chaîne : variable Netlify YOUTUBE_CHANNEL (identifiant « UC… » ou pseudo « @… »),
// sinon la valeur par défaut ci-dessous. Un pseudo est converti une fois en
// identifiant (lu dans la page de la chaîne) puis gardé en mémoire.
//
// GET /.netlify/functions/youtube → { channel: { id, title, url }, videos: [{ id, title, published }] }

const DEFAULT_CHANNEL = '@gravitybasketball_mtl'; // chaîne Gravity Basketball (remplaçable par la variable YOUTUBE_CHANNEL)
const MAX_VIDEOS = 12;
const CACHE_S = 1800; // 30 min : les nouvelles vidéos apparaissent vite, sans surcharger YouTube

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
};
const reply = (statusCode, body, cache = 0) => ({
  statusCode,
  headers: { ...headers, 'Cache-Control': cache ? `public, max-age=${cache}` : 'no-store' },
  body: JSON.stringify(body),
});

let resolved = null; // { key, id }

async function channelId(value) {
  const v = String(value || '').trim();
  if (/^UC[\w-]{22}$/.test(v)) return v;
  const handle = v.replace(/^https?:\/\/(www\.)?youtube\.com\//, '').replace(/\/.*$/, '');
  if (!/^@[\w.-]{3,40}$/.test(handle)) throw new Error('YOUTUBE_CHANNEL invalide (attendu : UC… ou @pseudo)');
  if (resolved && resolved.key === handle) return resolved.id;
  const res = await fetch(`https://www.youtube.com/${handle}`, { headers: { 'Accept-Language': 'fr-CA,fr;q=0.9' } });
  if (!res.ok) throw new Error(`chaîne introuvable (${res.status})`);
  const html = await res.text();
  const m = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/) ||
    html.match(/"(?:channelId|externalId)":"(UC[\w-]{22})"/);
  if (!m) throw new Error('identifiant de chaîne introuvable');
  resolved = { key: handle, id: m[1] };
  return m[1];
}

const decode = s => String(s || '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// Lecture du flux Atom (assez simple pour une expression régulière par balise).
function parseFeed(xml) {
  const title = decode((xml.match(/<title>([^<]*)<\/title>/) || [])[1]);
  const videos = [];
  for (const entry of xml.split('<entry>').slice(1)) {
    const id = (entry.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
    if (!id) continue;
    videos.push({
      id,
      title: decode((entry.match(/<title>([^<]*)<\/title>/) || [])[1]),
      published: (entry.match(/<published>([^<]*)<\/published>/) || [])[1] || null,
      short: /\/shorts\//.test(entry),
    });
    if (videos.length >= MAX_VIDEOS) break;
  }
  return { title, videos };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  const value = process.env.YOUTUBE_CHANNEL || DEFAULT_CHANNEL;
  if (!value) return reply(200, { channel: null, videos: [] }, 300);
  try {
    const id = await channelId(value);
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
    if (!res.ok) throw new Error(`flux YouTube indisponible (${res.status})`);
    const { title, videos } = parseFeed(await res.text());
    return reply(200, { channel: { id, title, url: `https://www.youtube.com/channel/${id}` }, videos }, CACHE_S);
  } catch (err) {
    console.error('youtube:', err.message);
    return reply(502, { error: err.message, channel: null, videos: [] }, 60);
  }
};

exports.parseFeed = parseFeed;
