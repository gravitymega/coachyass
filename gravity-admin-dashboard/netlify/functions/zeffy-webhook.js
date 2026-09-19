// Webhook Zeffy générique — sur CHAQUE paiement complété (`payment.completed`),
// envoie au payeur un courriel de REÇU / confirmation de paiement via Brevo.
//
// But : les gens qui paient directement sur un billet Zeffy (sans passer par le
// formulaire d'un site) ne recevaient jusqu'ici que le reçu de Zeffy. Cette
// fonction leur envoie EN PLUS le courriel de confirmation de marque Gravity,
// pour que « les réservations Zeffy passent par le même système » que les
// réservations Interac.
//
// IMPORTANT — configuration côté Zeffy (Settings → Integrations) : pointer le
// webhook vers cette URL avec le secret en paramètre :
//   https://gravity-admin-dashboard.netlify.app/.netlify/functions/zeffy-webhook?key=<ZEFFY_WEBHOOK_SECRET>
//
// NOTE sur `zeffy-webhook-prep.js` : le webhook Zeffy est réglé au niveau du
// COMPTE (une seule URL pour tous les paiements). Cette fonction-ci n'envoie
// que le courriel de reçu (elle NE crée PAS l'accès Espace Joueurs). Si un jour
// on veut aussi la création automatique d'accès Prep sur paiement, il faudra
// FUSIONNER la logique de `zeffy-webhook-prep.js` ici (une seule URL possible),
// pas configurer deux webhooks.
//
// La forme exacte du payload Zeffy varie ; l'extraction ci-dessous est donc
// volontairement tolérante (elle fouille le JSON reçu). La fonction logue le
// payload brut — si un vrai paiement de test n'envoie pas le bon courriel (ou
// affiche un mauvais montant), regarde les logs Netlify de cette fonction pour
// ajuster l'extraction.

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const WEBHOOK_SECRET = process.env.ZEFFY_WEBHOOK_SECRET;

// Expéditeur — extrait de MAILER_FROM_EMAIL (accepte « Nom <adresse> » ou juste
// « adresse »). Doit être un expéditeur vérifié dans Brevo (déjà le cas :
// notifications@osmm-mtl.site). Même variable que les autres fonctions.
const FROM_ADDRESS_MATCH = /<([^>]+)>/.exec(process.env.MAILER_FROM_EMAIL || '');
const FROM_ADDRESS = FROM_ADDRESS_MATCH ? FROM_ADDRESS_MATCH[1] : (process.env.MAILER_FROM_EMAIL || '');
const FROM = { name: 'Gravity Basketball', email: FROM_ADDRESS };

const SITE_URL = 'https://gravity.osmm-mtl.site';

// Anti-doublon léger : dédoublonne les paiements déjà traités tant que
// l'instance reste « chaude » (Zeffy peut renvoyer le même événement). Comme on
// répond toujours 2xx après un envoi réussi, Zeffy ne retente pas de toute
// façon — ceci n'est qu'une ceinture de sécurité supplémentaire.
const seen = new Set();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Cherche un courriel : d'abord une clé qui « ressemble » à un email, sinon
// n'importe quelle valeur qui matche le format email.
function findEmail(obj) {
  let found = null;
  (function walk(o) {
    if (found || !o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (found) return;
      if (typeof v === 'string' && /email|courriel/i.test(k) && EMAIL_RE.test(v.trim())) { found = v.trim(); return; }
      if (v && typeof v === 'object') walk(v);
    }
  })(obj);
  if (!found) {
    (function walk(o) {
      if (found || !o || typeof o !== 'object') return;
      for (const v of Object.values(o)) {
        if (found) return;
        if (typeof v === 'string' && EMAIL_RE.test(v.trim())) { found = v.trim(); return; }
        if (v && typeof v === 'object') walk(v);
      }
    })(obj);
  }
  return found;
}

function findName(obj) {
  let first = null;
  let last = null;
  let full = null;
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && v.trim()) {
        if (!first && /first.?name|pr[ée]nom/i.test(k)) first = v.trim();
        if (!last && /last.?name|surname|^nom$/i.test(k)) last = v.trim();
        if (!full && /full.?name|^name$/i.test(k)) full = v.trim();
      }
      if (v && typeof v === 'object') walk(v);
    }
  })(obj);
  if (first || last) return [first, last].filter(Boolean).join(' ').trim();
  return full || null;
}

// Nom du billet / campagne / formulaire, pour personnaliser le reçu.
function findTicketName(obj) {
  let name = null;
  (function walk(o) {
    if (name || !o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (name) return;
      if (typeof v === 'string' && v.trim() &&
          /campaign.?name|form.?name|product.?name|ticket.?name|event.?name|^title$|^name$/i.test(k) &&
          !EMAIL_RE.test(v.trim())) {
        name = v.trim();
        return;
      }
      if (v && typeof v === 'object') walk(v);
    }
  })(obj);
  return name;
}

// Identifiant du paiement/événement, pour l'anti-doublon.
function findPaymentId(obj) {
  if (obj && typeof obj.id === 'string') return obj.id;
  let id = null;
  (function walk(o) {
    if (id || !o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (id) return;
      if ((typeof v === 'string' || typeof v === 'number') && /(payment|transaction|order).?id|^id$/i.test(k)) {
        id = String(v);
        return;
      }
      if (v && typeof v === 'object') walk(v);
    }
  })(obj);
  return id;
}

// Montant — best effort. Priorité aux champs explicites en cents. Un entier nu
// est interprété comme des cents (convention Zeffy/Stripe) ; une valeur avec
// décimales est prise pour des dollars. Renvoie une chaîne formatée « 30,00 $ »
// ou null si rien de fiable n'est trouvé (mieux vaut ne rien afficher qu'un
// mauvais montant). À VÉRIFIER avec le premier vrai paiement (voir logs).
function findAmount(obj) {
  let cents = null;
  let dollars = null;
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'number' && isFinite(v) && v > 0) {
        if (cents == null && /cents/i.test(k)) cents = v;
        if (dollars == null && /amount|total|montant|price|prix/i.test(k) && !/cents/i.test(k)) {
          dollars = Number.isInteger(v) ? v / 100 : v; // entier => cents ; décimal => dollars
        }
      } else if (typeof v === 'string' && /amount|total|montant|price|prix/i.test(k)) {
        const n = parseFloat(v.replace(',', '.').replace(/[^\d.]/g, ''));
        if (dollars == null && isFinite(n) && n > 0) dollars = /[.,]/.test(v) ? n : n / 100;
      }
      if (v && typeof v === 'object') walk(v);
    }
  })(obj);
  const value = cents != null ? cents / 100 : dollars;
  if (value == null || !isFinite(value) || value <= 0) return null;
  return value.toFixed(2).replace('.', ',') + ' $';
}

function looksLikeBadStatus(raw) {
  return /\b(fail|refund|rembours|cancel|annul|pending|attente|declin|refus)/i.test(raw);
}

function buildSignature() {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
      <tr>
        <td style="vertical-align: middle; padding-right: 12px;">
          <img src="${SITE_URL}/assets/logo.png" alt="Gravity" width="44" height="44" style="display: block; border-radius: 8px;">
        </td>
        <td style="vertical-align: middle; font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 14px; color: #333;">
          <strong>L'équipe Gravity</strong><br><a href="${SITE_URL}" style="color: #e8672e; text-decoration: none;">gravity.osmm-mtl.site</a>
        </td>
      </tr>
    </table>
  `;
}

async function sendReceipt({ email, name, ticket, amount }) {
  const bonjour = name ? `Bonjour ${escapeHtml(name)},` : 'Bonjour,';
  const pour = ticket ? ` pour <strong>${escapeHtml(ticket)}</strong>` : '';
  const montant = amount ? ` — <strong>${escapeHtml(amount)}</strong>` : '';
  const html = `
    <p>${bonjour}</p>
    <p>Nous confirmons la réception de ton paiement${pour}${montant}. Merci !</p>
    <p>Ta place est confirmée. On te recontacte rapidement pour la suite s'il y a lieu.</p>
  ` + buildSignature();

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: FROM,
      to: [{ email }],
      subject: ticket ? `Paiement reçu — ${ticket}` : 'Paiement reçu — Gravity Basketball',
      htmlContent: html,
    }),
  });
  return res;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non permise' }) };
  }
  if (!WEBHOOK_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ZEFFY_WEBHOOK_SECRET manquant dans les variables Netlify' }) };
  }
  if (!BREVO_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'BREVO_API_KEY manquant dans les variables Netlify' }) };
  }
  if (!FROM_ADDRESS) {
    return { statusCode: 500, body: JSON.stringify({ error: 'MAILER_FROM_EMAIL manquant (doit être un expéditeur vérifié dans Brevo)' }) };
  }

  const q = event.queryStringParameters || {};
  const h = event.headers || {};
  const provided = q.key || q.token || h['x-zeffy-token'] || h['x-webhook-secret'] || '';
  if (provided !== WEBHOOK_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Non autorisé' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const raw = JSON.stringify(payload);
  console.log('zeffy-webhook payload:', raw);

  const type = payload && typeof payload.type === 'string' ? payload.type : '';
  if (type && !/payment\.completed/i.test(type)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: `type:${type}` }) };
  }
  if (!type && looksLikeBadStatus(raw)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: 'not-completed' }) };
  }

  const email = findEmail(payload);
  if (!email) {
    console.log('zeffy-webhook: aucun courriel trouvé dans le payload');
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: 'no-email' }) };
  }

  const dedupeId = findPaymentId(payload) || `${email}|${findAmount(payload) || ''}|${findTicketName(payload) || ''}`;
  if (seen.has(dedupeId)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: 'duplicate' }) };
  }

  const name = findName(payload);
  const ticket = findTicketName(payload);
  const amount = findAmount(payload);

  try {
    const res = await sendReceipt({ email, name, ticket, amount });
    if (!res.ok) {
      const detail = await res.text();
      console.error('zeffy-webhook: erreur Brevo :', detail);
      return { statusCode: 502, body: JSON.stringify({ error: 'Envoi du reçu refusé par Brevo' }) };
    }
    seen.add(dedupeId);
    return { statusCode: 200, body: JSON.stringify({ ok: true, email, ticket: ticket || null, amount: amount || null }) };
  } catch (err) {
    console.error('zeffy-webhook: erreur serveur', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
}
