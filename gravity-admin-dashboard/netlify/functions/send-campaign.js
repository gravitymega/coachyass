// Fonction Netlify — envoie une campagne (un seul message, en Cci) à une
// liste de contacts sélectionnés dans l'onglet "Communication" du Dashboard.
//
// Réservée aux admins connectés : le jeton Supabase envoyé par le client est
// transmis tel quel à Supabase pour relire la ligne admin_users correspondante
// (protégée par RLS — un jeton invalide ou un utilisateur non-admin ne
// renvoie aucune ligne). Le sujet/corps viennent de l'admin lui-même (pas
// d'un visiteur public) : contrairement à gravity-mailer, du contenu libre
// est donc acceptable ici.

const SUPABASE_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Adresse d'envoi commune — extraite de MAILER_FROM_EMAIL si défini (accepte
// "Nom <adresse>" ou juste "adresse"), sinon repli sur le domaine de test
// Resend. Le nom affiché, lui, varie par site (voir FROM_NAMES ci-dessous).
const FROM_ADDRESS_MATCH = /<([^>]+)>/.exec(process.env.MAILER_FROM_EMAIL || '');
const FROM_ADDRESS = FROM_ADDRESS_MATCH ? FROM_ADDRESS_MATCH[1] : (process.env.MAILER_FROM_EMAIL || 'onboarding@resend.dev');

// Nom d'expéditeur affiché aux destinataires — différent par site (même
// slugs Supabase que SITE_URLS ci-dessous).
const FROM_NAMES = {
  coachyass: 'Coach Yass',
  basketlibre: 'Gravity Pickup',
  'gravity-basketball': 'Gravity Basketball',
  'gravity-basketball-mtl': 'Gravity Basketball',
  osmm: 'Gravity Basketball',
};

function buildFrom(site) {
  return `${FROM_NAMES[site] || 'Gravity Basketball'} <${FROM_ADDRESS}>`;
}

const MAX_RECIPIENTS = 1000;
const BATCH_SIZE = 45; // marge sous la limite Resend (50 destinataires/appel, to+bcc compris)

// Un lien de site par slug Supabase (voir SITE_LABELS dans app.js) — pointe
// vers le bon site plutôt qu'un lien générique. 'all' / inconnu retombe sur
// le site principal Gravity Basketball.
const SITE_URLS = {
  coachyass: 'https://coaching.osmm-mtl.site',
  basketlibre: 'https://pickup.osmm-mtl.site',
  'gravity-basketball': 'https://gravity.osmm-mtl.site',
  'gravity-basketball-mtl': 'https://gravity.osmm-mtl.site',
  osmm: 'https://osmm-mtl.site',
};
const DEFAULT_SITE_URL = 'https://gravity.osmm-mtl.site';

function buildSignature(siteUrl) {
  const url = siteUrl || DEFAULT_SITE_URL;
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
      <tr>
        <td style="vertical-align: middle; padding-right: 12px;">
          <img src="https://gravity.osmm-mtl.site/assets/logo.png" alt="Gravity" width="44" height="44" style="display: block; border-radius: 8px;">
        </td>
        <td style="vertical-align: middle; font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 14px; color: #333;">
          <strong>L'équipe Gravity</strong><br><a href="${url}" style="color: #e8672e; text-decoration: none;">${url.replace(/^https?:\/\//, '')}</a>
        </td>
      </tr>
    </table>
  `;
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function textToHtml(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

async function isAuthorizedAdmin(token) {
  if (!token) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=id`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return false;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
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
  if (!RESEND_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'RESEND_API_KEY manquant dans les variables Netlify' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const authorized = await isAuthorizedAdmin(token).catch(() => false);
  if (!authorized) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Non autorisé — connecte-toi au Dashboard.' }) };
  }

  let d;
  try {
    d = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const subject = String(d.subject || '').trim().slice(0, 200);
  const bodyText = String(d.body || '').trim().slice(0, 10000);
  const emails = Array.isArray(d.emails)
    ? Array.from(new Set(d.emails.map((e) => String(e || '').trim()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))))
    : [];

  if (!subject || !bodyText) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Sujet et message requis' }) };
  }
  if (!emails.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Aucun destinataire valide' }) };
  }
  if (emails.length > MAX_RECIPIENTS) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Trop de destinataires (max ${MAX_RECIPIENTS} par envoi)` }) };
  }

  const site = String(d.site || '');
  const html = textToHtml(bodyText) + buildSignature(SITE_URLS[site]);
  const from = buildFrom(site);
  const batches = [];
  for (let i = 0; i < emails.length; i += BATCH_SIZE) batches.push(emails.slice(i, i + BATCH_SIZE));

  try {
    for (const batch of batches) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [from], bcc: batch, subject, html }),
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error('Erreur Resend :', detail);
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Envoi refusé par Resend', detail }) };
      }
    }
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent: emails.length, batches: batches.length }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
