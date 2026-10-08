// Fonction Netlify — passerelle vers l'API Printify pour la boutique Gravity
// Basketball (gravity-basketball-mtl/boutique.html). Impression et expédition
// par Print Geek (Toronto), choisi comme imprimeur sur chaque produit Printify.
//
// Actions (?action=...) :
//   - variants (admin, GET)    liste les variantes des produits de la boutique
//                              Printify (pour relier chaque taille/couleur d'un
//                              produit du Dashboard — colonne
//                              shop_products.printify_variants)
//   - order    (PUBLIC, POST)  crée la commande dans Printify. Elle n'est PAS
//                              envoyée en production : l'admin clique « Send to
//                              production » dans Printify une fois le paiement
//                              Interac/Zeffy reçu. ⚠️ La boutique Printify doit
//                              avoir l'approbation des commandes en « Manuel »,
//                              sinon Printify l'envoie seul après 24 h.
//
// Les prix et les variantes Printify sont relus côté serveur dans Supabase
// (table shop_products) : le client n'envoie que l'id du produit, la couleur,
// la taille et la quantité.
//
// Variables d'environnement Netlify (site gravity-admin-dashboard) :
//   PRINTIFY_API_TOKEN       — jeton d'accès personnel Printify (profil →
//                              Connections). Jamais exposé au client.
//   PRINTIFY_SHOP_ID         — optionnel : id de la boutique Printify de type
//                              « API ». Déduit automatiquement s'il n'y en a qu'une.
//   GRAVITY_PICKUP_ADDRESS   — optionnel. Adresse (JSON) où expédier les
//                              commandes « remise en main propre », ex. :
//                              {"first_name":"Gravity","last_name":"Basketball",
//                               "address1":"...","city":"Montréal","region":"QC",
//                               "zip":"H...","country":"CA"}
//                              Sans elle, ces commandes ne vont pas chez Printify
//                              (notification Notion/courriel seulement).

const SUPABASE_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';
const ADMIN_SITE = 'gravity-basketball';
const PRINTIFY = 'https://api.printify.com/v1';

const TOKEN = process.env.PRINTIFY_API_TOKEN;
let shopId = process.env.PRINTIFY_SHOP_ID || null;

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

class PrintifyError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function printify(path, options = {}) {
  const res = await fetch(`${PRINTIFY}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'GravityBasketball-Boutique',
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.message || data.error || `Erreur API Printify (${res.status})`;
    console.error('Printify', res.status, JSON.stringify(data).slice(0, 1000));
    throw new PrintifyError(String(msg), res.status >= 400 && res.status < 500 ? 400 : 502);
  }
  return data;
}

async function getShopId() {
  if (shopId) return shopId;
  const shops = await printify('/shops.json');
  if (!Array.isArray(shops) || !shops.length) throw new PrintifyError('Aucune boutique Printify — crée une boutique de type « API »', 400);
  if (shops.length > 1) {
    const api = shops.filter((s) => /api|custom/i.test(s.sales_channel || ''));
    if (api.length !== 1) throw new PrintifyError('Plusieurs boutiques Printify : ajoute PRINTIFY_SHOP_ID dans Netlify', 400);
    shopId = String(api[0].id);
  } else {
    shopId = String(shops[0].id);
  }
  return shopId;
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

// Toutes les variantes actives des produits de la boutique Printify, à plat.
// La couleur et la taille sont tirées des options du produit (type color/size).
async function listVariants() {
  const shop = await getShopId();
  const products = [];
  for (let page = 1; page <= 20; page += 1) {
    const res = await printify(`/shops/${shop}/products.json?limit=50&page=${page}`);
    products.push(...(res.data || []));
    if (!res.last_page || page >= res.last_page) break;
  }
  return products.flatMap((p) => {
    const valueOf = {};
    (p.options || []).forEach((o) => (o.values || []).forEach((v) => { valueOf[v.id] = { type: o.type, title: v.title }; }));
    const image = ((p.images || []).find((i) => i.is_default) || (p.images || [])[0] || {}).src || '';
    return (p.variants || []).filter((v) => v.is_enabled).map((v) => {
      const opts = (v.options || []).map((id) => valueOf[id]).filter(Boolean);
      return {
        id: `${p.id}:${v.id}`,
        product: p.title,
        color: (opts.find((o) => o.type === 'color') || {}).title || '',
        size: (opts.find((o) => o.type === 'size') || {}).title || '',
        thumbnail: image,
        available: v.is_available !== false,
      };
    });
  });
}

const text = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

async function createOrder(body) {
  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  if (!items.length) throw new PrintifyError('Panier vide', 400);

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ids = [...new Set(items.map((i) => text(i.productId, 64)).filter((id) => UUID.test(id)))];
  if (!ids.length) throw new PrintifyError('Produits inconnus', 400);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/shop_products?select=id,name,printify_variants&active=eq.true&id=in.(${ids.join(',')})`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
  );
  if (!res.ok) throw new PrintifyError('Lecture des produits impossible', 502);
  const products = Object.fromEntries((await res.json()).map((p) => [p.id, p]));

  const lines = [];
  const missing = [];
  for (const item of items) {
    const p = products[item.productId];
    const qte = Math.min(Math.max(parseInt(item.qte, 10) || 0, 0), 20);
    if (!p || !qte) continue;
    const key = `${text(item.couleur, 40)}|${text(item.taille, 40)}`;
    const [productId, variantId] = String((p.printify_variants || {})[key] || '').split(':');
    if (!productId || !Number(variantId)) {
      missing.push(`${p.name} (${key.replace('|', ', ')})`);
      continue;
    }
    lines.push({ product_id: productId, variant_id: Number(variantId), quantity: qte });
  }
  if (!lines.length) return { created: false, missing, reason: 'Aucun article relié à Printify' };

  let address;
  if (body.livraison === 'domicile') {
    const r = body.recipient || {};
    const name = text(r.name, 100).split(/\s+/);
    address = {
      first_name: name[0] || '',
      last_name: name.slice(1).join(' ') || name[0] || '',
      email: text(r.email, 200),
      phone: text(r.phone, 30),
      country: 'CA',
      region: text(r.state_code, 2).toUpperCase(),
      address1: text(r.address1, 200),
      address2: text(r.address2, 200),
      city: text(r.city, 100),
      zip: text(r.zip, 10).toUpperCase(),
    };
    if (!address.first_name || !address.address1 || !address.city || !address.zip || !PROVINCES.includes(address.region)) {
      throw new PrintifyError('Adresse de livraison incomplète', 400);
    }
  } else {
    try {
      address = JSON.parse(process.env.GRAVITY_PICKUP_ADDRESS || 'null');
    } catch (e) {
      address = null;
    }
    if (!address) return { created: false, missing, reason: 'Remise en main propre : GRAVITY_PICKUP_ADDRESS non configurée' };
  }

  const reference = text(body.reference, 50).replace(/[^A-Za-z0-9_-]/g, '');
  const shop = await getShopId();
  const order = await printify(`/shops/${shop}/orders.json`, {
    method: 'POST',
    body: JSON.stringify({
      external_id: reference || undefined,
      label: reference || undefined,
      line_items: lines,
      shipping_method: 1,
      send_shipping_notification: true,
      address_to: address,
    }),
  });
  return { created: true, printifyOrderId: order.id, missing };
}

exports.handler = async (event) => {
  const headers = headersFor(event);
  const reply = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (!TOKEN) return reply(500, { error: 'PRINTIFY_API_TOKEN manquant dans les variables Netlify du site gravity-admin-dashboard' });

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
    console.error(`printify ${action}:`, err);
    return reply(err instanceof PrintifyError ? err.status : 500, { error: err.message || 'Erreur serveur' });
  }
};
