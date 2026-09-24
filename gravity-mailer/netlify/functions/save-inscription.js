// Gravity Notion Sync — écrit chaque inscription/réservation (Coaching,
// Pickup, Gravity Basketball, OSMM) dans la base Notion partagée
// "🏀 Inscription GRAV", pour les regrouper au même endroit, filtrables par
// Programme et par Équipe. Réutilise la même clé partagée que
// send-confirmation.js (MAILER_SHARED_KEY / en-tête x-mailer-key).
//
// Chaque site continue par ailleurs d'écrire dans son propre système
// existant (bases Notion dédiées pour Coaching/Pickup, Supabase pour
// Gravity Basketball) — cet appel est additif, jamais bloquant.
//
// NOTION_TOKEN et NOTION_DB_INSCRIPTION_GRAV sont ajoutées via l'API Netlify
// (pas dans netlify.toml) : elles ne prennent effet qu'au prochain déploiement
// du site, jamais sur une fonction déjà chaude — un changement de ces
// variables doit toujours être suivi d'un redéploiement de ce site.

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB_INSCRIPTION_GRAV = process.env.NOTION_DB_INSCRIPTION_GRAV;
const MAILER_SHARED_KEY = process.env.MAILER_SHARED_KEY;

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/([a-z0-9-]+\.)?osmm-mtl\.site$/,
  /^https:\/\/([a-z0-9-]+--)?[a-z0-9-]+\.netlify\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
];

function corsOrigin(event) {
  const origin = event.headers.origin || event.headers.Origin || '';
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin)) ? origin : '';
}

// Seuls ces programmes sont acceptés — évite qu'un appel mal formé crée une
// valeur de select imprévue dans Notion.
const PROGRAMMES = ['Coach Yass', 'Gravity Pickup', 'Ligue 3v3', 'Ligue Maison', 'Gravity U15 Masculin', 'Gravity Prep', 'OSMM'];

function truncate(v, max) {
  return v == null ? '' : String(v).slice(0, max);
}

function richText(value, max) {
  const text = truncate(value, max);
  return text ? { rich_text: [{ text: { content: text } }] } : undefined;
}

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
  if (!NOTION_TOKEN || !NOTION_DB_INSCRIPTION_GRAV) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOTION_TOKEN ou NOTION_DB_INSCRIPTION_GRAV manquant dans les variables Netlify' }) };
  }

  let d;
  try {
    d = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const programme = String(d.programme || '');
  if (!PROGRAMMES.includes(programme)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Programme inconnu : ${programme}` }) };
  }

  const nom = truncate(d.nom, 200).trim();
  if (!nom) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nom requis' }) };
  }

  const properties = {
    'Nom': { title: [{ text: { content: nom } }] },
    'Programme': { select: { name: programme } },
  };

  const equipe = richText(d.equipe, 200);
  if (equipe) properties['Équipe'] = equipe;

  const email = truncate(d.email, 200).trim();
  if (email) properties['Email'] = { email };

  const telephone = truncate(d.telephone, 50).trim();
  if (telephone) properties['Téléphone'] = { phone_number: telephone };

  const dateSeance = truncate(d.dateSeance, 10);
  if (dateSeance) properties['Date séance'] = { date: { start: dateSeance } };

  const forfait = richText(d.forfait, 300);
  if (forfait) properties['Forfait / Type'] = forfait;

  const modePaiement = richText(d.modePaiement, 100);
  if (modePaiement) properties['Mode de paiement'] = modePaiement;

  if (typeof d.montant === 'number' && Number.isFinite(d.montant)) {
    properties['Montant'] = { number: d.montant };
  }

  const remarque = richText(d.remarque, 1900);
  if (remarque) properties['Remarque'] = remarque;

  const details = richText(d.details, 1900);
  if (details) properties['Détails'] = details;

  // Formulaire « Infos maillot » (gravity-basketball-mtl/maillots-*.html) :
  // ces lignes ont Forfait / Type = « Maillot » et apparaissent dans la vue
  // Notion « 👕 Maillots ».
  const maillot = d.maillot && typeof d.maillot === 'object' ? d.maillot : null;
  if (maillot) {
    const nomMaillot = richText(maillot.nom, 100);
    if (nomMaillot) properties['Nom sur le maillot'] = nomMaillot;
    const numero = richText(maillot.numero, 10);
    if (numero) properties['Numéro maillot'] = numero;
    const numero2 = richText(maillot.numero2, 10);
    if (numero2) properties['2e choix numéro'] = numero2;
    const poids = Number(maillot.poidsLb);
    if (Number.isFinite(poids) && poids > 0) properties['Poids (lb)'] = { number: poids };
    const taille = richText(maillot.taille, 20);
    if (taille) properties['Taille'] = taille;
  }

  if (d.photosAutorisees != null) {
    properties['Photos autorisées'] = { checkbox: !!d.photosAutorisees };
  }

  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parent: { database_id: NOTION_DB_INSCRIPTION_GRAV }, properties }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('Erreur Notion :', detail);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'Notion a refusé la requête', detail }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
