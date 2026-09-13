// Gravity Mailer — service central d'envoi de courriels de confirmation
// pour les sites Gravity / OSMM (Coaching, Pickup, Basketball MTL, OSMM).
//
// Le sujet et le corps du courriel sont TOUJOURS générés côté serveur à
// partir d'un gabarit fixe par "type" — le client ne peut jamais fournir de
// contenu libre (sujet/corps arbitraire), pour empêcher que cette fonction
// serve de relais de courriel/spam ouvert. Seules quelques valeurs
// (nom, forfait, date...) sont injectées dans le gabarit.

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAILER_SHARED_KEY = process.env.MAILER_SHARED_KEY;

// SUSPENSION TEMPORAIRE (13 sept. 2026) — le compte Resend utilisé ici affiche,
// pour mail.osmm-mtl.site ET pour tout nouveau domaine testé, des enregistrements
// SPF pointant vers forge.rmta.net ("SendBeam", un tiers sans lien connu avec
// Resend) au lieu de l'infra Resend habituelle (amazonses.com / resend-dns.com).
// Tant que cette anomalie n'est pas éclaircie côté sécurité (compte Resend et/ou
// navigateur compromis), on n'effectue plus aucun appel à l'API Resend. Repasser
// à `false` seulement une fois le problème résolu et confirmé par Yassine.
const RESEND_SUSPENDED = true;

// Adresse d'envoi commune — extraite de MAILER_FROM_EMAIL si défini (accepte
// "Nom <adresse>" ou juste "adresse"), sinon repli sur le domaine de test
// Resend. Le nom affiché, lui, varie par site (voir FROM_NAMES ci-dessous).
// MAILER_FROM_EMAIL configurée le 13 septembre 2026 sur mail.osmm-mtl.site,
// une fois le domaine vérifié dans Resend (commit forçant le redéploiement
// nécessaire pour charger cette variable — voir CLAUDE.md).
const FROM_ADDRESS_MATCH = /<([^>]+)>/.exec(process.env.MAILER_FROM_EMAIL || '');
const FROM_ADDRESS = FROM_ADDRESS_MATCH ? FROM_ADDRESS_MATCH[1] : (process.env.MAILER_FROM_EMAIL || 'onboarding@resend.dev');

// Nom d'expéditeur affiché aux destinataires — différent par site.
const FROM_NAMES = {
  coaching: 'Coach Yass',
  pickup: 'Gravity Pickup',
  'basketball-mtl': 'Gravity Basketball',
  'osmm-membre': 'Gravity Basketball',
  'osmm-contact': 'Gravity Basketball',
  'basketball-mtl-prep-admin': 'Gravity Basketball',
  'espace-joueurs-access': 'Gravity Basketball',
};

function buildFrom(type) {
  return `${FROM_NAMES[type] || 'Gravity Basketball'} <${FROM_ADDRESS}>`;
}

// Notifications internes : le destinataire n'est jamais fourni par le client
// (contrairement aux confirmations, où `to` est l'adresse du visiteur) — il
// est fixé ici pour empêcher que la fonction serve à envoyer ailleurs.
const ADMIN_NOTIFICATION_RECIPIENTS = {
  'basketball-mtl-prep-admin': 'Gravitybasketball@gmail.com',
};

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)?osmm-mtl\.site$/,
  /^https:\/\/([a-z0-9-]+--)?[a-z0-9-]+\.netlify\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
];

function corsOrigin(event) {
  const origin = event.headers.origin || event.headers.Origin || '';
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin)) ? origin : '';
}

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Lien du site à afficher dans la signature — un par type de courriel, pour
// pointer vers le bon site plutôt qu'un lien générique.
const SITE_URLS = {
  coaching: 'https://coaching.osmm-mtl.site',
  pickup: 'https://pickup.osmm-mtl.site',
  'basketball-mtl': 'https://gravity.osmm-mtl.site',
  'osmm-membre': 'https://osmm-mtl.site',
  'osmm-contact': 'https://osmm-mtl.site',
  'basketball-mtl-prep-admin': 'https://gravity.osmm-mtl.site',
  'espace-joueurs-access': 'https://gravity.osmm-mtl.site',
};

// Signature ajoutée en bas de chaque courriel — même logo pour tous les
// sites (hébergé sur gravity.osmm-mtl.site, accessible publiquement), avec
// un lien vers le site concerné.
function buildSignature(siteUrl) {
  const siteLink = siteUrl
    ? `<br><a href="${siteUrl}" style="color: #e8672e; text-decoration: none;">${siteUrl.replace(/^https?:\/\//, '')}</a>`
    : '';
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e5e5;">
      <tr>
        <td style="vertical-align: middle; padding-right: 12px;">
          <img src="https://gravity.osmm-mtl.site/assets/logo.png" alt="Gravity" width="44" height="44" style="display: block; border-radius: 8px;">
        </td>
        <td style="vertical-align: middle; font-family: system-ui, -apple-system, Arial, sans-serif; font-size: 14px; color: #333;">
          <strong>L'équipe Gravity</strong>${siteLink}
        </td>
      </tr>
    </table>
  `;
}

// Gabarits — un par type de confirmation, un par site. `f` = les champs
// fournis par le site appelant (déjà validés/tronqués avant d'arriver ici).
const TEMPLATES = {
  coaching(f) {
    return {
      subject: 'Confirmation de votre réservation — Coach Yass',
      html: `
        <p>Bonjour ${escapeHtml(f.nom)},</p>
        <p>Merci ! Coach Yass a bien reçu votre demande de réservation${f.forfait ? ` (<strong>${escapeHtml(f.forfait)}</strong>)` : ''}.</p>
        ${f.date ? `<p>Date demandée : <strong>${escapeHtml(f.date)}</strong>${f.heure ? ` à ${escapeHtml(f.heure)}` : ''}</p>` : ''}
        <p>Dernière étape : envoyez le montant par virement Interac au <strong>438-341-2051</strong> ou à <strong>mqtad9@hotmail.com</strong> pour confirmer votre place.</p>
        <p>On vous recontacte rapidement pour finaliser les détails.</p>
      `,
    };
  },
  pickup(f) {
    return {
      subject: 'Confirmation de votre réservation — Gravity Pickup',
      html: `
        <p>Bonjour ${escapeHtml(f.nom)},</p>
        <p>Merci ! Gravity Pickups a bien reçu votre réservation${f.forfait ? ` (<strong>${escapeHtml(f.forfait)}</strong>)` : ''}${f.creneau ? `, créneau <strong>${escapeHtml(f.creneau)}</strong>` : ''}.</p>
        ${f.dates ? `<p>Date(s) : <strong>${escapeHtml(f.dates)}</strong></p>` : ''}
        ${f.modePaiement === 'Zeffy'
          ? '<p>Complétez votre paiement en ligne par carte (lien envoyé séparément) pour confirmer votre place.</p>'
          : '<p>Dernière étape : envoyez le montant par virement Interac au <strong>438-341-2051</strong> ou à <strong>mqtad9@hotmail.com</strong> pour confirmer votre place.</p>'}
      `,
    };
  },
  'basketball-mtl'(f) {
    // Gravity Prep a sa propre adresse de contact/paiement — le reste des
    // programmes (Ligue 3v3, Ligue Maison, U15 Masculin) garde l'adresse
    // habituelle.
    const interacEmail = f.programme === 'Gravity Prep' ? 'Gravitybasketball@gmail.com' : 'mqtad9@hotmail.com';
    return {
      subject: `Confirmation de votre inscription — ${f.programme || 'Gravity Basketball'}`,
      html: `
        <p>Bonjour ${escapeHtml(f.nom)},</p>
        <p>Merci ! Gravity Basketball a bien reçu votre demande d'inscription${f.programme ? ` — <strong>${escapeHtml(f.programme)}</strong>` : ''}.</p>
        <p>On vous recontacte par téléphone, courriel ou Instagram pour confirmer.</p>
        ${f.modePaiement === 'Zeffy'
          ? '<p>Complétez votre paiement en ligne par carte (lien envoyé séparément) pour confirmer votre place.</p>'
          : `<p>Dernière étape : envoyez le montant d'inscription par virement Interac au <strong>438-341-2051</strong> ou à <strong>${interacEmail}</strong> pour confirmer votre place.</p>`}
      `,
    };
  },
  'basketball-mtl-prep-admin'(f) {
    const rows = [
      ['Nom complet', f.nom],
      ['Téléphone', f.telephone],
      ['Courriel', f.courriel],
      ['Catégorie d\'âge', f.ageCategorie],
      ['Type d\'inscription', f.typeInscription],
      ['Adresse', f.adresse],
      ['Niveau de jeu', f.niveau],
      ['Poste de jeu', f.posteDeJeu],
      ['Taille de vêtement', f.tailleVetement],
      ['Grandeur', f.grandeur],
      ['Poids', f.poids],
      ['Occupation', f.occupation],
      ['Objectif de la saison', f.objectifSaison],
      ['Réseaux sociaux', f.reseauxSociaux],
      ['Disponibilités', f.disponibilites],
      ['Mode de paiement', f.modePaiement],
      ['Référence', f.reference],
      ['Remarque', f.remarque],
    ].filter(([, v]) => v);
    return {
      subject: `Nouvelle inscription Gravity Prep — ${f.nom || 'sans nom'}`,
      html: `
        <p>Nouvelle demande d'inscription <strong>Gravity Prep</strong> :</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
          ${rows.map(([label, v]) => `
            <tr>
              <td style="padding:4px 12px 4px 0; color:#666; white-space:nowrap; vertical-align:top;"><strong>${escapeHtml(label)}</strong></td>
              <td style="padding:4px 0;">${escapeHtml(v)}</td>
            </tr>`).join('')}
        </table>
      `,
    };
  },
  'osmm-membre'(f) {
    return {
      subject: 'Confirmation de votre demande d\'adhésion — OSMM',
      html: `
        <p>Bonjour ${escapeHtml(f.nom)},</p>
        <p>Merci ! L'OSMM a bien reçu votre demande d'adhésion${f.activite ? ` pour l'activité <strong>${escapeHtml(f.activite)}</strong>` : ''}.</p>
        <p>Notre équipe vous recontacte prochainement.</p>
      `,
    };
  },
  'osmm-contact'(f) {
    return {
      subject: 'Nous avons bien reçu votre message — OSMM',
      html: `
        <p>Bonjour ${escapeHtml(f.nom)},</p>
        <p>Merci pour votre message ! L'OSMM vous répond dans les meilleurs délais.</p>
      `,
    };
  },
  'espace-joueurs-access'(f) {
    return {
      subject: 'Ton accès à l\'Espace Joueurs — Gravity Basketball',
      html: `
        <p>Bonjour ${escapeHtml(f.nom)},</p>
        <p>Ton accès à l'<strong>Espace Joueurs</strong> est prêt ! Tu peux dès maintenant consulter tes documents, tes statistiques, le calendrier des matchs et des entraînements, et les communiqués de ton équipe.</p>
        <p>
          <strong>Courriel :</strong> ${escapeHtml(f.courriel)}<br>
          <strong>Mot de passe temporaire :</strong> ${escapeHtml(f.motDePasse)}
        </p>
        <p><a href="https://gravity.osmm-mtl.site/#espace-joueurs" style="display:inline-block; padding:10px 20px; background:#e8672e; color:#fff; border-radius:8px; text-decoration:none; font-weight:600;">Accéder à mon Espace Joueurs</a></p>
        <p>Une fois connecté, pense à changer ton mot de passe dans l'onglet "Mon compte".</p>
      `,
    };
  },
};

exports.handler = async (event) => {
  const origin = corsOrigin(event);
  const headers = {
    'Access-Control-Allow-Origin': origin || 'null',
    'Access-Control-Allow-Headers': 'Content-Type, x-mailer-key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non permise' }) };
  }
  if (!origin) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: 'Origine non autorisée' }) };
  }

  if (!MAILER_SHARED_KEY || event.headers['x-mailer-key'] !== MAILER_SHARED_KEY) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Non autorisé' }) };
  }

  if (RESEND_SUSPENDED) {
    console.warn('Gravity Mailer — envoi suspendu (investigation sécurité Resend/forge.rmta.net en cours) : requête ignorée, aucun appel à l\'API Resend effectué.');
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({ error: 'Envoi de courriels temporairement suspendu (maintenance sécurité) — réessayez plus tard.' }),
    };
  }

  if (!RESEND_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'RESEND_API_KEY manquant dans les variables Netlify' }) };
  }

  let d;
  try {
    d = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const type = String(d.type || '');
  const buildTemplate = TEMPLATES[type];
  if (!buildTemplate) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Type de courriel inconnu : ${type}` }) };
  }

  // Pour une notification interne, le destinataire est fixé côté serveur
  // (ADMIN_NOTIFICATION_RECIPIENTS) — jamais celui fourni par l'appelant.
  let to = ADMIN_NOTIFICATION_RECIPIENTS[type];
  if (!to) {
    to = String(d.to || '').trim().slice(0, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Adresse courriel invalide' }) };
    }
  }

  // Champs libres acceptés — toujours tronqués, jamais interprétés comme
  // sujet/corps : ils ne font qu'être injectés (échappés) dans le gabarit.
  const fields = {};
  [
    'nom', 'forfait', 'date', 'heure', 'dates', 'creneau', 'programme', 'modePaiement', 'activite',
    'telephone', 'courriel', 'ageCategorie', 'typeInscription', 'adresse', 'niveau', 'posteDeJeu',
    'tailleVetement', 'grandeur', 'poids', 'occupation', 'objectifSaison', 'reseauxSociaux',
    'disponibilites', 'reference', 'remarque', 'motDePasse',
  ].forEach((k) => {
    if (d.fields && d.fields[k] != null) fields[k] = String(d.fields[k]).slice(0, 300);
  });

  // Reply-To : quand une notification interne référence le courriel d'un
  // visiteur, permet à l'admin de répondre directement depuis sa boîte.
  const replyTo = type in ADMIN_NOTIFICATION_RECIPIENTS && fields.courriel ? fields.courriel : undefined;

  const { subject, html } = buildTemplate(fields);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: buildFrom(type),
        to: [to],
        subject,
        html: html + buildSignature(SITE_URLS[type]),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('Erreur Resend :', detail);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Envoi du courriel refusé' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
