// Fonction Netlify — passerelle vers l'API Meta (Instagram Graph API) pour le
// compte Instagram de Gravity Basketball (@gravitybasketball_mtl).
//
// Un seul point d'entrée, plusieurs actions (?action=...) :
//   - feed               (PUBLIC, GET)  dernières publications, pour la section
//                                       "Vidéos" de gravity-basketball-mtl
//   - overview           (admin)        statistiques du compte + des publications
//   - comments           (admin)        commentaires d'une publication
//   - reply_comment      (admin)        répondre à un commentaire
//   - hide_comment       (admin)        masquer / réafficher un commentaire
//   - create_container   (admin)        étape 1 de publication (photo ou reel)
//   - container_status   (admin)        étape 2 : attendre que Meta ait traité le média
//   - publish_container  (admin)        étape 3 : publier sur le compte
//   - conversations      (admin)        messages privés (DM) — liste
//   - messages           (admin)        messages privés — fil d'une conversation
//   - send_message       (admin)        messages privés — répondre
//
// La publication est découpée en 3 appels parce qu'un reel peut prendre
// plusieurs dizaines de secondes à être traité par Meta, plus que la durée
// maximale d'une fonction Netlify : c'est le Dashboard qui attend entre les
// étapes, pas la fonction.
//
// Variable d'environnement Netlify requise (site gravity-admin-dashboard) :
//   META_PAGE_ACCESS_TOKEN — jeton d'accès de la PAGE Facebook reliée au compte
//                            Instagram (jeton de page "longue durée", qui
//                            n'expire pas s'il est tiré d'un jeton utilisateur
//                            longue durée). Jamais exposé au client.
// Optionnelles :
//   META_IG_USER_ID        — identifiant du compte Instagram professionnel ;
//                            déduit automatiquement de la Page si absent.
//   META_GRAPH_VERSION     — version de l'API Graph (défaut ci-dessous).
//
// Accès admin : même vérification que create-player-account.js (jeton Supabase
// de l'admin connecté -> ligne admin_users), limité aux admins qui gèrent le
// site gravity-basketball (seul compte Instagram branché).

const SUPABASE_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';
const ADMIN_SITE = 'gravity-basketball';

const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v23.0';
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

let cachedIgUserId = process.env.META_IG_USER_ID || null;

const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
};

function reply(statusCode, body, extraHeaders) {
  return { statusCode, headers: { ...baseHeaders, ...(extraHeaders || {}) }, body: JSON.stringify(body) };
}

class GraphError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Appel à l'API Graph. `params` part en query string (GET) ou en corps
// x-www-form-urlencoded (POST) — les deux formats acceptés partout par Meta.
async function graph(path, params = {}, method = 'GET') {
  const qs = new URLSearchParams({ ...params, access_token: PAGE_TOKEN });
  const url = method === 'GET' ? `${GRAPH}/${path}?${qs}` : `${GRAPH}/${path}`;
  const res = await fetch(url, {
    method,
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : qs.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    const msg = (data.error && (data.error.error_user_msg || data.error.message)) || `Erreur API Meta (${res.status})`;
    throw new GraphError(msg, res.status >= 400 && res.status < 500 ? 400 : 502);
  }
  return data;
}

async function igUserId() {
  if (cachedIgUserId) return cachedIgUserId;
  const page = await graph('me', { fields: 'instagram_business_account' });
  const id = page.instagram_business_account && page.instagram_business_account.id;
  if (!id) {
    throw new GraphError(
      "Aucun compte Instagram professionnel n'est relié à la Page Facebook de ce jeton (ou le jeton n'est pas un jeton de Page).",
      500
    );
  }
  cachedIgUserId = id;
  return id;
}

async function isGravityAdmin(token) {
  if (!token) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=sites`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0 && (rows[0].sites || []).includes(ADMIN_SITE);
}

const MEDIA_FIELDS = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';

// ---------- Actions ----------

async function feed() {
  const id = await igUserId();
  const data = await graph(`${id}/media`, {
    fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp',
    limit: '24',
  });
  return { items: data.data || [] };
}

// Insights d'une publication. Les métriques disponibles varient selon le type
// (reel, photo, carrousel) et Meta rejette toute la requête si une seule n'est
// pas supportée — on essaie donc la liste complète, puis on se rabat sur la
// portée seule, puis sur rien.
async function mediaInsights(mediaId) {
  for (const metric of ['reach,views,saved,shares', 'reach']) {
    try {
      const data = await graph(`${mediaId}/insights`, { metric });
      const out = {};
      (data.data || []).forEach((m) => {
        out[m.name] = m.values && m.values[0] ? m.values[0].value : m.total_value ? m.total_value.value : null;
      });
      return out;
    } catch (e) {
      /* métrique non supportée pour ce média : on tente la liste suivante */
    }
  }
  return {};
}

async function overview() {
  const id = await igUserId();
  const until = Math.floor(Date.now() / 1000);
  const since = until - 28 * 24 * 3600;

  const [account, media, insights] = await Promise.all([
    graph(id, { fields: 'username,name,profile_picture_url,followers_count,follows_count,media_count' }),
    graph(`${id}/media`, { fields: MEDIA_FIELDS, limit: '12' }),
    graph(`${id}/insights`, {
      metric: 'reach,accounts_engaged,total_interactions,profile_views',
      period: 'day',
      metric_type: 'total_value',
      since: String(since),
      until: String(until),
    }).catch(() => ({ data: [] })),
  ]);

  const totals = {};
  (insights.data || []).forEach((m) => {
    totals[m.name] = m.total_value ? m.total_value.value : null;
  });

  const items = media.data || [];
  const perMedia = await Promise.all(items.map((m) => mediaInsights(m.id)));
  items.forEach((m, i) => {
    m.insights = perMedia[i];
  });

  return { account, totals_28d: totals, media: items };
}

async function comments(p) {
  if (!p.media_id) throw new GraphError('media_id requis', 400);
  const data = await graph(`${p.media_id}/comments`, {
    fields: 'id,text,username,timestamp,like_count,hidden,replies{id,text,username,timestamp}',
    limit: '50',
  });
  return { comments: data.data || [] };
}

async function replyComment(p) {
  const message = String(p.message || '').trim();
  if (!p.comment_id || !message) throw new GraphError('comment_id et message requis', 400);
  return graph(`${p.comment_id}/replies`, { message }, 'POST');
}

async function hideComment(p) {
  if (!p.comment_id) throw new GraphError('comment_id requis', 400);
  const hide = p.hide === true || p.hide === 'true';
  return graph(p.comment_id, { hide: hide ? 'true' : 'false' }, 'POST');
}

async function createContainer(p) {
  const id = await igUserId();
  const caption = String(p.caption || '');
  if (p.kind === 'reel') {
    if (!p.video_url) throw new GraphError('video_url requis', 400);
    return graph(`${id}/media`, { media_type: 'REELS', video_url: p.video_url, caption, share_to_feed: 'true' }, 'POST');
  }
  if (!p.image_url) throw new GraphError('image_url requis', 400);
  return graph(`${id}/media`, { image_url: p.image_url, caption }, 'POST');
}

async function containerStatus(p) {
  if (!p.container_id) throw new GraphError('container_id requis', 400);
  return graph(p.container_id, { fields: 'status_code,status' });
}

async function publishContainer(p) {
  if (!p.container_id) throw new GraphError('container_id requis', 400);
  const id = await igUserId();
  const published = await graph(`${id}/media_publish`, { creation_id: p.container_id }, 'POST');
  const media = await graph(published.id, { fields: 'id,permalink' }).catch(() => ({ id: published.id }));
  return media;
}

async function conversations() {
  const [igId, data] = await Promise.all([
    igUserId(),
    graph('me/conversations', {
      platform: 'instagram',
      fields: 'id,updated_time,participants,messages.limit(1){message,from,created_time}',
      limit: '25',
    }),
  ]);
  return { ig_user_id: igId, conversations: data.data || [] };
}

async function messages(p) {
  if (!p.conversation_id) throw new GraphError('conversation_id requis', 400);
  const [igId, data] = await Promise.all([
    igUserId(),
    graph(p.conversation_id, { fields: 'participants,messages.limit(30){id,message,from,created_time}' }),
  ]);
  return { ig_user_id: igId, participants: data.participants, messages: (data.messages && data.messages.data) || [] };
}

// Meta n'autorise une réponse que dans les 24 h suivant le dernier message
// reçu de cette personne — au-delà, l'API renvoie une erreur explicite qu'on
// relaie telle quelle au Dashboard.
async function sendMessage(p) {
  const text = String(p.message || '').trim();
  if (!p.recipient_id || !text) throw new GraphError('recipient_id et message requis', 400);
  return graph(
    'me/messages',
    { recipient: JSON.stringify({ id: p.recipient_id }), message: JSON.stringify({ text }) },
    'POST'
  );
}

const ADMIN_ACTIONS = {
  overview,
  comments,
  reply_comment: replyComment,
  hide_comment: hideComment,
  create_container: createContainer,
  container_status: containerStatus,
  publish_container: publishContainer,
  conversations,
  messages,
  send_message: sendMessage,
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: baseHeaders };
  if (!PAGE_TOKEN) {
    return reply(500, { error: 'META_PAGE_ACCESS_TOKEN manquant dans les variables Netlify du site gravity-admin-dashboard' });
  }

  const query = event.queryStringParameters || {};
  let body = {};
  if (event.httpMethod === 'POST') {
    try {
      body = JSON.parse(event.body || '{}');
    } catch (e) {
      return reply(400, { error: 'JSON invalide' });
    }
  }
  const params = { ...query, ...body };
  const action = params.action;

  try {
    if (action === 'feed') {
      // Mis en cache sur le CDN Netlify : le site public ne déclenche pas un
      // appel à Meta à chaque visite (limite de débit de l'API).
      return reply(200, await feed(), {
        'Cache-Control': 'public, max-age=300',
        'Netlify-CDN-Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
      });
    }

    const handler = ADMIN_ACTIONS[action];
    if (!handler) return reply(400, { error: 'Action inconnue' });

    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!(await isGravityAdmin(token).catch(() => false))) {
      return reply(401, { error: 'Non autorisé — connecte-toi au Dashboard avec un compte qui gère Gravity Basketball.' });
    }

    return reply(200, await handler(params));
  } catch (err) {
    console.error(`instagram ${action}:`, err);
    return reply(err instanceof GraphError ? err.status : 500, { error: err.message || 'Erreur serveur' });
  }
};
