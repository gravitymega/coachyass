// Webhook Zeffy — dès qu'un paiement Gravity Prep est complété, crée (ou
// retrouve) la fiche joueur et lui envoie directement son invitation Espace
// Joueurs, sans attendre que l'admin clique "Créer un accès" dans le
// Dashboard.
//
// IMPORTANT — à configurer côté Zeffy (Settings → Integrations → Webhooks) :
// pointer vers cette URL avec ?key=<ZEFFY_PREP_WEBHOOK_SECRET>. La forme
// exacte du payload envoyé par Zeffy n'a pas pu être vérifiée depuis cet
// environnement (accès à support.zeffy.com bloqué) — l'extraction ci-dessous
// est donc volontairement tolérante (elle fouille le JSON reçu plutôt que de
// viser des chemins figés). Si un vrai paiement de test ne déclenche pas
// l'invitation, regarde les logs de cette fonction dans Netlify (elle logue
// le payload brut) pour ajuster l'extraction.
//
// Comme le webhook Zeffy est probablement réglé au niveau du compte (pas par
// événement), on filtre aussi sur la présence du mot "prep" dans le payload
// pour ignorer les paiements des autres programmes (Ligue 3v3, Ligue Maison,
// OSMM, etc.) qui partageraient le même webhook.

const SUPABASE_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = process.env.ZEFFY_PREP_WEBHOOK_SECRET;

const GRAVITY_PREP_EMAIL = 'Gravitybasketball@gmail.com';

// Même service et même clé partagée que create-player-account.js.
const MAILER_URL = 'https://gravity-mailer.netlify.app/.netlify/functions/send-confirmation';
const MAILER_KEY = '11c58c7548b0ed0666742f1e44a9cec1777bddee1c9fcbe5';
const MAILER_ORIGIN = 'https://gravity-admin-dashboard.netlify.app';

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function sendAccessEmail(email, fullName, password) {
  const res = await fetch(MAILER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-mailer-key': MAILER_KEY, Origin: MAILER_ORIGIN },
    body: JSON.stringify({
      type: 'espace-joueurs-access',
      to: email,
      fields: { nom: fullName, courriel: email, motDePasse: password },
    }),
  });
  return res.ok;
}

// Alerte admin — même filet FormSubmit que le reste du site (indépendant de
// gravity-mailer/Brevo), pour que l'admin sache qu'une fiche a été créée
// automatiquement et doit être complétée (équipe, numéro, photo).
async function notifyAdmin(fullName, email, created) {
  await fetch(`https://formsubmit.co/ajax/${GRAVITY_PREP_EMAIL}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      _subject: 'Paiement Gravity Prep reçu — accès Espace Joueurs créé',
      _template: 'table',
      _captcha: 'false',
      Nom: fullName || '—',
      Email: email,
      'Fiche joueur': created ? 'Créée automatiquement (à compléter : équipe, numéro, photo)' : 'Déjà existante',
      Action: "Complète la fiche dans Mes équipes — Joueurs (gravity-admin-dashboard).",
    }),
  }).catch(() => {});
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function findEmail(obj) {
  let found = null;
  (function walk(o) {
    if (found || !o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (found) return;
      if (typeof v === 'string' && /email/i.test(k) && EMAIL_RE.test(v.trim())) { found = v.trim(); return; }
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

function looksLikeBadStatus(raw) {
  return /\b(fail|refund|cancel|pending|declin)/i.test(raw);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non permise' }) };
  }
  if (!SERVICE_ROLE_KEY || !WEBHOOK_SECRET) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Variables Netlify manquantes (SUPABASE_SERVICE_ROLE_KEY / ZEFFY_PREP_WEBHOOK_SECRET)' }) };
  }
  const key = (event.queryStringParameters || {}).key;
  if (key !== WEBHOOK_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Non autorisé' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const raw = JSON.stringify(payload);
  console.log('zeffy-webhook-prep payload:', raw);

  if (!/prep/i.test(raw)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: 'not-prep' }) };
  }
  if (looksLikeBadStatus(raw)) {
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: 'not-completed' }) };
  }

  const email = findEmail(payload);
  if (!email) {
    console.log('zeffy-webhook-prep: aucun courriel trouvé dans le payload');
    return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: 'no-email' }) };
  }
  const fullName = findName(payload) || 'Nouveau joueur Gravity Prep';

  const dbHeaders = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };

  try {
    // Cherche une fiche joueur Gravity Prep existante (créée à la main par
    // l'admin) qui correspond à ce courriel.
    const lookupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/players?site=eq.gravity-basketball&age_category=eq.Prep&select=id,email,auth_user_id,full_name`,
      { headers: dbHeaders }
    );
    const existingPlayers = await lookupRes.json().catch(() => []);
    const match = Array.isArray(existingPlayers)
      ? existingPlayers.find((p) => (p.email || '').toLowerCase() === email.toLowerCase())
      : null;

    let playerId = match ? match.id : null;
    let playerName = match ? match.full_name : fullName;
    let createdFiche = false;

    if (match && match.auth_user_id) {
      // Accès déjà créé (paiement en double, retry du webhook, etc.).
      return { statusCode: 200, body: JSON.stringify({ ok: true, ignored: 'already-has-access' }) };
    }

    if (!playerId) {
      // Aucune fiche joueur trouvée — on en crée une minimale (nom + courriel)
      // à partir des infos du paiement Zeffy ; l'admin complète équipe/photo/
      // numéro plus tard dans Mes équipes — Joueurs.
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/players`, {
        method: 'POST',
        headers: { ...dbHeaders, Prefer: 'return=representation' },
        body: JSON.stringify({
          site: 'gravity-basketball',
          program: 'equipe',
          age_category: 'Prep',
          full_name: fullName,
          email,
        }),
      });
      const inserted = await insertRes.json().catch(() => []);
      if (!insertRes.ok || !Array.isArray(inserted) || !inserted[0]) {
        console.error('zeffy-webhook-prep: échec création fiche joueur', inserted);
        return { statusCode: 502, body: JSON.stringify({ error: 'Création de la fiche joueur échouée' }) };
      }
      playerId = inserted[0].id;
      playerName = inserted[0].full_name;
      createdFiche = true;
    }

    const password = randomPassword();
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: dbHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      const msg = created && created.msg ? created.msg : 'Création du compte refusée';
      console.error('zeffy-webhook-prep: échec création compte Auth', msg);
      return { statusCode: 502, body: JSON.stringify({ error: msg }) };
    }

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/players?id=eq.${playerId}`, {
      method: 'PATCH',
      headers: { ...dbHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ auth_user_id: created.id, email }),
    });
    if (!patchRes.ok) {
      console.error('zeffy-webhook-prep: compte créé mais liaison au profil échouée');
      return { statusCode: 500, body: JSON.stringify({ error: 'Compte créé mais liaison échouée' }) };
    }

    await sendAccessEmail(email, playerName, password).catch(() => false);
    await notifyAdmin(playerName, email, createdFiche);

    return { statusCode: 200, body: JSON.stringify({ ok: true, email, created_fiche: createdFiche }) };
  } catch (err) {
    console.error('zeffy-webhook-prep: erreur serveur', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
