// Fonction Netlify — crée le compte Supabase Auth d'un joueur (Espace Joueurs)
// et le relie à sa ligne dans `players` (auth_user_id).
//
// Réservée aux admins connectés : le jeton Supabase envoyé par le client sert
// à relire la ligne admin_users correspondante (RLS), puis on vérifie que le
// joueur visé appartient bien à un des sites de cet admin avant de toucher à
// quoi que ce soit. La création du compte elle-même utilise la clé service_role
// (jamais exposée au client) car la création d'un utilisateur Auth n'est pas
// permise avec la clé anon.
//
// Le mot de passe temporaire est envoyé automatiquement au joueur par
// courriel (via gravity-mailer) une fois le compte créé, et renvoyé UNE
// SEULE FOIS dans la réponse ici aussi — en secours, si l'envoi échoue ou
// atterrit dans le spam, l'admin peut quand même le communiquer lui-même.

const SUPABASE_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Même service et même clé partagée que gravity-basketball-mtl/script.js —
// cette clé n'est pas un vrai secret (déjà expédiée au navigateur ailleurs),
// juste un frein contre l'abus ouvert de la fonction gravity-mailer.
const MAILER_URL = 'https://gravity-mailer.netlify.app/.netlify/functions/send-confirmation';
const MAILER_KEY = '11c58c7548b0ed0666742f1e44a9cec1777bddee1c9fcbe5';
// gravity-mailer exige une origine autorisée (*.netlify.app ou
// *.osmm-mtl.site) — un appel serveur-à-serveur n'a naturellement pas
// d'en-tête Origin, donc on en fournit un qui correspond à ce site.
const MAILER_ORIGIN = 'https://gravity-admin-dashboard.netlify.app';

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

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function getAdminSites(token) {
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=sites`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0].sites || [] : null;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non permise' }) };
  }
  if (!SERVICE_ROLE_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY manquant dans les variables Netlify' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const adminSites = await getAdminSites(token).catch(() => null);
  if (!adminSites) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Non autorisé — connecte-toi au Dashboard.' }) };
  }

  let d;
  try {
    d = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const playerId = String(d.player_id || '').trim();
  const email = String(d.email || '').trim().toLowerCase();
  if (!playerId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Joueur et courriel valide requis' }) };
  }

  try {
    // Vérifie que le joueur appartient à un site géré par cet admin.
    const playerRes = await fetch(`${SUPABASE_URL}/rest/v1/players?id=eq.${playerId}&select=id,site,auth_user_id,full_name`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    const players = await playerRes.json().catch(() => []);
    const player = Array.isArray(players) ? players[0] : null;
    if (!player || !adminSites.includes(player.site)) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: "Ce joueur n'appartient à aucun de tes sites." }) };
    }
    if (player.auth_user_id) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'Ce joueur a déjà un accès Espace Joueurs.' }) };
    }

    const password = randomPassword();
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const created = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      const msg = created && created.msg ? created.msg : 'Création du compte refusée';
      return { statusCode: 502, headers, body: JSON.stringify({ error: msg }) };
    }

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/players?id=eq.${playerId}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ auth_user_id: created.id, email }),
    });
    if (!patchRes.ok) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Compte créé mais liaison au profil joueur échouée — contacte le support." }) };
    }

    const emailSent = await sendAccessEmail(email, player.full_name, password).catch(() => false);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, email, password, email_sent: emailSent }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
