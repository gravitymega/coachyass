// Fonction Netlify — passerelle vers l'API Printful pour la boutique Gravity
// Basketball (gravity-basketball-mtl/boutique.html).
//
// Actions (?action=...) :
//   - variants (admin, GET)    liste toutes les variantes synchronisées de la
//                              boutique Printful (pour relier chaque taille/
//                              couleur d'un produit du Dashboard à une
//                              variante Printful — colonne
//                              shop_products.printful_variants)
//   - order    (PUBLIC, POST)  crée une commande Printful EN BROUILLON pour une
//                              commande de la boutique. Rien n'est imprimé ni
//                              facturé tant que l'admin ne la confirme pas dans
//                              Printful (une fois le paiement Interac/Zeffy reçu).
//
// Les prix et les variantes Printful sont relus côté serveur dans Supabase
// (table shop_products) : le client n'envoie que l'id du produit, la couleur,
// la taille et la quantité.
//
// Variables d'environnement Netlify (site gravity-admin-dashboard) :
//   PRINTFUL_API_TOKEN       — jeton privé Printful (Developers → Private
//                              tokens). Jamais exposé au client.
//   PRINTFUL_STORE_ID        — seulement si le jeton est de niveau compte
//                              (plusieurs boutiques Printful) : id de la
//                              boutique « Manual order / API ».
//   GRAVITY_PICKUP_ADDRESS   — optionnel. Adresse (JSON) où Printful expédie
//                              les commandes « remise en main propre », ex. :
//                              {"name":"Gravity Basketball","address1":"...",
//                               "city":"Montréal","state_code":"QC",
//                               "zip":"H...","country_code":"CA"}
//                              Sans elle, ces commandes ne sont pas envoyées
//                              à Printful (notification Notion/courriel seulement).

const SUPABASE_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';
const ADMIN_SITE = 'gravity-basketball';
const PRINTFUL = 'https://api.printful.com';

const TOKEN = process.env.PRINTFUL_API_TOKEN;
const STORE_ID = process.env.PRINTFUL_STORE_ID;

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)?osmm-mtl\.site$/,
  /^https:\/\/([a-z0-9-]+--)?[a-z0-9-]+\.netlify\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
];

const PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];

function headersFor(event) {
  const origin = event.headers.origin || event.headers.Origin || '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin)) ? origin : 'null',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
    Vary: 'Origin',
  };
}

class PrintfulError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function printful(path, options = {}) {
  const headers = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
  if (STORE_ID) headers['X-PF-Store-Id'] = STORE_ID;
  const res = await fetch(`${PRINTFUL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data.error && data.error.message) || data.result || `Erreur API Printful (${res.status})`;
    throw new PrintfulError(String(msg), res.status >= 400 && res.status < 500 ? 400 : 502);
  }
  return data.result;
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

// Toutes les variantes synchronisées de la boutique Printful, à plat.
async function listVariants() {
  const products = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const page = await printful(`/store/products?limit=100&offset=${offset}`);
    products.push(...page);
    if (page.length < 100) break;
  }
  const details = await Promise.all(products.map((p) => printful(`/store/products/${p.id}`)));
  return details.flatMap((d) => (d.sync_variants || []).map((v) => ({
    id: v.id,
    name: v.name,
    product: d.sync_product.name,
    size: v.size || '',
    color: v.color || '',
    thumbnail: d.sync_product.thumbnail_url || (v.product && v.product.image) || '',
    available: v.availability_status !== 'discontinued' && v.availability_status !== 'out_of_stock',
  })));
}

const text = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

async function createOrder(body) {
  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  if (!items.length) throw new PrintfulError('Panier vide', 400);

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = [...new Set(items.map((i) => text(i.productId, 64)).filter((id) => UUID.test(id)))];
  if (!ids.length) throw new PrintfulError('Produits inconnus', 400);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/shop_products?select=id,name,price,printful_variants&active=eq.true&id=in.(${ids.map(encodeURIComponent).join(',')})`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
  );
  if (!res.ok) throw new PrintfulError('Lecture des produits impossible', 502);
  const products = Object.fromEntries((await res.json()).map((p) => [p.id, p]));

  const lines = [];
  const missing = [];
  for (const item of items) {
    const p = products[item.productId];
    const qte = Math.min(Math.max(parseInt(item.qte, 10) || 0, 0), 20);
    if (!p || !qte) continue;
    const key = `${text(item.couleur, 40)}|${text(item.taille, 40)}`;
    const variantId = (p.printful_variants || {})[key];
    if (!variantId) {
      missing.push(`${p.name} (${key.replace('|', ', ')})`);
      continue;
    }
    lines.push({ sync_variant_id: Number(variantId), quantity: qte, retail_price: Number(p.price).toFixed(2) });
  }
  if (!lines.length) return { created: false, missing, reason: 'Aucun article relié à Printful' };

  let recipient;
  if (body.livraison === 'domicile') {
    const r = body.recipient || {};
    recipient = {
      name: text(r.name, 100),
      address1: text(r.address1, 200),
      address2: text(r.address2, 200) || undefined,
      city: text(r.city, 100),
      state_code: text(r.state_code, 2).toUpperCase(),
      country_code: 'CA',
      zip: text(r.zip, 10).toUpperCase(),
      email: text(r.email, 200) || undefined,
      phone: text(r.phone, 30) || undefined,
    };
    if (!recipient.name || !recipient.address1 || !recipient.city || !recipient.zip || !PROVINCES.includes(recipient.state_code)) {
      throw new PrintfulError('Adresse de livraison incomplète', 400);
    }
  } else {
    try {
      recipient = JSON.parse(process.env.GRAVITY_PICKUP_ADDRESS || 'null');
    } catch (e) {
      recipient = null;
    }
    if (!recipient) return { created: false, missing, reason: 'Remise en main propre : GRAVITY_PICKUP_ADDRESS non configurée' };
  }

  const order = await printful('/orders', {
    method: 'POST',
    body: JSON.stringify({
      external_id: text(body.reference, 32).replace(/[^A-Za-z0-9_-]/g, '') || undefined,
      recipient,
      items: lines,
    }),
  });
  return { created: true, printfulOrderId: order.id, status: order.status, missing };
}

exports.handler = async (event) => {
  const headers = headersFor(event);
  const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (!TOKEN) return reply(500, { error: 'PRINTFUL_API_TOKEN manquant dans les variables Netlify du site gravity-admin-dashboard' });

  const action = (event.queryStringParameters || {}).action;
  try {
    if (action === 'order') {
      if (event.httpMethod !== 'POST') return reply(405, { error: 'Méthode non permise' });
      if (headers['Access-Control-Allow-Origin'] === 'null') return reply(403, { error: 'Origine non autorisée' });
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (e) {
        return reply(400, { error: 'JSON invalide' });
      }
      return reply(200, await createOrder(body));
    }

    if (action === 'variants') {
      const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '');
      if (!(await isGravityAdmin(token).catch(() => false))) {
        return reply(401, { error: 'Non autorisé — connecte-toi au Dashboard avec un compte qui gère Gravity Basketball.' });
      }
      return reply(200, { variants: await listVariants() });
    }

    return reply(400, { error: 'Action inconnue' });
  } catch (err) {
    console.error(`printful ${action}:`, err);
    return reply(err instanceof PrintfulError ? err.status : 500, { error: err.message || 'Erreur serveur' });
  }
};
