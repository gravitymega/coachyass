// Fonction Netlify — avertit par courriel les joueurs concernés (Espace
// Joueurs) chaque fois l'admin ajoute ou modifie un document, une statistique,
// un communiqué, un match ou un entraînement.
//
// Réservée aux admins connectés : le jeton Supabase envoyé par le client sert
// à relire admin_users (RLS), puis à lire players/teams avec ce même jeton —
// RLS restreint déjà ces lectures aux sites de cet admin, donc pas besoin de
// la clé service_role ici. Seuls les joueurs ayant un accès Espace Joueurs
// (auth_user_id non nul) ET un courriel sont notifiés.

const SUPABASE_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const FROM_ADDRESS_MATCH = /<([^>]+)>/.exec(process.env.MAILER_FROM_EMAIL || '');
const FROM_ADDRESS = FROM_ADDRESS_MATCH ? FROM_ADDRESS_MATCH[1] : (process.env.MAILER_FROM_EMAIL || 'onboarding@resend.dev');
const FROM = `Gravity Basketball <${FROM_ADDRESS}>`;
const ESPACE_JOUEURS_URL = 'https://gravity.osmm-mtl.site/#espace-joueurs';
const BATCH_SIZE = 45; // marge sous la limite Resend (50 destinataires/appel, to+bcc compris)

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function buildSignature() {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
      <tr>
        <td style="vertical-align: middle; padding-right: 12px;">
          <img src="https://gravity.osmm-mtl.site/assets/logo.png" alt="Gravity" width="44" height="44" style="display: block; border-radius: 8px;">
        </td>
        <td style="vertical-align: middle; font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 14px; color: #333;">
          <strong>L'équipe Gravity</strong><br><a href="${ESPACE_JOUEURS_URL}" style="color: #e8672e; text-decoration: none;">gravity.osmm-mtl.site</a>
        </td>
      </tr>
    </table>
  `;
}

function ctaButton() {
  return `<p><a href="${ESPACE_JOUEURS_URL}" style="display:inline-block; padding:10px 20px; background:#e8672e; color:#fff; border-radius:8px; text-decoration:none; font-weight:600;">Ouvrir mon Espace Joueurs</a></p>`;
}

// Un gabarit par type d'ajout — `d` = détails fournis par le Dashboard,
// toujours échappés avant injection, jamais interprétés comme sujet/corps.
const TEMPLATES = {
  document(d, action) {
    return {
      subject: 'Nouveau document dans ton Espace Joueurs',
      html: `<p>Bonjour,</p><p>Un document${action === 'updated' ? ' a été mis à jour' : ' vient d\'être ajouté'} dans ton Espace Joueurs${d.titre ? ` : <strong>${escapeHtml(d.titre)}</strong>` : ''}.</p>${ctaButton()}`,
    };
  },
  stat() {
    return {
      subject: 'Tes statistiques ont été mises à jour',
      html: `<p>Bonjour,</p><p>Tes statistiques de saison viennent d'être mises à jour dans ton Espace Joueurs.</p>${ctaButton()}`,
    };
  },
  announcement(d) {
    return {
      subject: d.titre ? `Nouveau communiqué : ${d.titre}` : 'Nouveau communiqué',
      html: `<p>Bonjour,</p><p>Un nouveau communiqué${d.titre ? ` — <strong>${escapeHtml(d.titre)}</strong>` : ''} vient d'être publié dans ton Espace Joueurs.</p>${ctaButton()}`,
    };
  },
  game(d, action) {
    const when = [d.date_match, d.heure_match].filter(Boolean).join(' — ');
    return {
      subject: action === 'updated' ? 'Un match a été mis à jour' : 'Nouveau match ajouté à ton calendrier',
      html: `
        <p>Bonjour,</p>
        <p>${action === 'updated' ? 'Un match de ton calendrier a été mis à jour' : 'Un nouveau match vient d\'être ajouté à ton calendrier'}${d.adversaire ? ` : <strong>Vs ${escapeHtml(d.adversaire)}</strong>` : ''}.</p>
        ${when ? `<p>${escapeHtml(when)}</p>` : ''}
        ${d.lieu_nom ? `<p>${escapeHtml(d.lieu_nom)}</p>` : ''}
        ${ctaButton()}
      `,
    };
  },
  training(d, action) {
    const heure = [d.heure_debut, d.heure_fin].filter(Boolean).join('–');
    const when = [d.date_entrainement, heure].filter(Boolean).join(' — ');
    return {
      subject: action === 'updated' ? 'Un entraînement a été mis à jour' : 'Nouvel entraînement ajouté à ton calendrier',
      html: `
        <p>Bonjour,</p>
        <p>${action === 'updated' ? 'Un entraînement de ton calendrier a été mis à jour.' : 'Un nouvel entraînement vient d\'être ajouté à ton calendrier.'}</p>
        ${when ? `<p>${escapeHtml(when)}</p>` : ''}
        ${d.lieu_nom ? `<p>${escapeHtml(d.lieu_nom)}</p>` : ''}
        ${ctaButton()}
      `,
    };
  },
};

async function getAdminSites(token) {
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_users?select=sites`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length ? rows[0].sites || [] : null;
}

// Renvoie les courriels des joueurs concernés — uniquement ceux qui ont un
// accès Espace Joueurs actif (auth_user_id non nul) et un courriel.
async function findRecipients(token, { kind, site, playerId, teamId }) {
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  let url;
  if (kind === 'document' || kind === 'stat') {
    url = `${SUPABASE_URL}/rest/v1/players?select=email&id=eq.${playerId}&email=not.is.null&auth_user_id=not.is.null`;
  } else if (teamId) {
    url = `${SUPABASE_URL}/rest/v1/players?select=email&team_id=eq.${teamId}&email=not.is.null&auth_user_id=not.is.null`;
  } else {
    url = `${SUPABASE_URL}/rest/v1/players?select=email&site=eq.${encodeURIComponent(site)}&email=not.is.null&auth_user_id=not.is.null`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) return [];
  const rows = await res.json().catch(() => []);
  return Array.from(new Set(rows.map((r) => r.email).filter(Boolean)));
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

  const kind = String(d.kind || '');
  const buildTemplate = TEMPLATES[kind];
  const site = String(d.site || '');
  if (!buildTemplate || !site || !adminSites.includes(site)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Requête invalide' }) };
  }
  const action = d.action === 'updated' ? 'updated' : 'created';
  const details = d.details && typeof d.details === 'object' ? d.details : {};
  // Champs libres tronqués — jamais interprétés comme sujet/corps.
  const safeDetails = {};
  ['titre', 'adversaire', 'date_match', 'heure_match', 'lieu_nom', 'date_entrainement', 'heure_debut', 'heure_fin'].forEach((k) => {
    if (details[k] != null) safeDetails[k] = String(details[k]).slice(0, 200);
  });

  try {
    const recipients = await findRecipients(token, {
      kind,
      site,
      playerId: d.player_id ? String(d.player_id) : null,
      teamId: d.team_id ? String(d.team_id) : null,
    });
    if (!recipients.length) {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent: 0 }) };
    }

    const { subject, html } = buildTemplate(safeDetails, action);
    const fullHtml = html + buildSignature();
    const batches = [];
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) batches.push(recipients.slice(i, i + BATCH_SIZE));

    for (const batch of batches) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [FROM_ADDRESS], bcc: batch, subject, html: fullHtml }),
      });
      if (!res.ok) {
        const detail = await res.text();
        console.error('Erreur Resend :', detail);
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Envoi refusé par Resend' }) };
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, sent: recipients.length }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
