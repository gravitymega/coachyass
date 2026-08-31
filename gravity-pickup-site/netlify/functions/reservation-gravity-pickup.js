// Fonction Netlify — envoie les réservations Gravity Pickup dans Notion,
// avec une limite de 15 joueurs par date de séance.
//
// Base Notion « Réservations — Gravity Pickup » (créée le 10 août 2026) :
// title: JOUEUR, Email, Téléphone, Forfait (select), Créneau (select),
// Date séance (date), Niveau (select), Attentes (text),
// Groupe réservation (text), Statut (status : Pas commencé/En cours/Terminé),
// Payé (checkbox), Photos autorisées (checkbox).
// Contient déjà, en date du 10 août 2026, les 25 séances des 5 réservations
// reçues avant la mise en place de ce compteur (Joshua, Willy Limoges,
// Jean-Philippe Limoges, Tachefin Nekaa, Greg Rene), pour que le compte de
// places prises par date parte du bon total.
//
// Une réservation multi-séances (3 ou 6 séances) crée UNE ligne Notion PAR DATE,
// toutes partageant le même « Groupe réservation », pour permettre de compter
// les places prises par date exacte.

const NOTION_DB = process.env.NOTION_DB_GRAVITY_PICKUP || 'e3a8b88ecadf45839cb8c7ccf2829a8e';
const CAPACITE_MAX = 15;

const MONTANTS = { '1': 12, '3': 32, '6': 60 };

async function notionFetch(path, options, token) {
  return fetch(`https://api.notion.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

// Compte les réservations déjà enregistrées pour une date donnée (YYYY-MM-DD)
async function countForDate(dateIso, token) {
  const res = await notionFetch(`/v1/databases/${NOTION_DB}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Date séance',
        date: { equals: dateIso }
      },
      page_size: 100
    })
  }, token);
  if (!res.ok) throw new Error(`Notion query a échoué (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.results) ? data.results.length : 0;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const token = process.env.NOTION_TOKEN;
  if (!token || !NOTION_DB) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOTION_TOKEN ou NOTION_DB_GRAVITY_PICKUP manquant dans les variables Netlify' }) };
  }

  // GET /.netlify/functions/reservation-gravity-pickup?dates=2026-09-03,2026-09-10
  // Renvoie le nombre de places déjà prises pour chaque date demandée, pour
  // afficher "X/15 places prises" côté client avant la réservation.
  if (event.httpMethod === 'GET') {
    const raw = (event.queryStringParameters && event.queryStringParameters.dates) || '';
    const dates = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 30);
    if (!dates.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Paramètre "dates" requis (dates séparées par des virgules)' }) };
    }
    try {
      const counts = {};
      for (const date of dates) {
        counts[date] = await countForDate(date, token);
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, capacite: CAPACITE_MAX, counts }) };
    } catch (err) {
      console.error('Erreur vérification capacité (GET) :', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Impossible de vérifier les places disponibles, réessayez.' }) };
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non permise' }) };
  }

  let d;
  try {
    d = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const nom = String(d.nom || '').trim().slice(0, 200);
  const email = String(d.email || '').trim().slice(0, 200);
  const seances = Array.isArray(d.seances) ? d.seances.filter(s => s && s.date) : [];
  if (!nom || !email || !seances.length) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nom, email et au moins une date de séance sont requis' }) };
  }

  const forfaitKey = String(d.forfaitKey || '');

  // 1) Vérifier la capacité (15 max) pour chaque date demandée AVANT de rien créer
  try {
    const dejaComplets = [];
    for (const s of seances) {
      const count = await countForDate(s.date, token);
      if (count >= CAPACITE_MAX) dejaComplets.push(s.date);
    }
    if (dejaComplets.length) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          error: `Cette session est complète (${CAPACITE_MAX} joueurs) pour ${dejaComplets.length > 1 ? 'les dates' : 'la date'} : ${dejaComplets.join(', ')}. Merci de choisir une autre date.`,
          fullDates: dejaComplets
        })
      };
    }
  } catch (err) {
    console.error('Erreur vérification capacité :', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Impossible de vérifier les places disponibles, réessayez.' }) };
  }

  // 2) Créer une ligne Notion par date de séance
  const groupe = `${email}-${Date.now()}`;
  const created = [];
  try {
    for (const s of seances) {
      const properties = {
        'JOUEUR': { title: [{ text: { content: nom } }] },
        'Email': { email },
        'Statut': { status: { name: 'Pas commencé' } },
        'Payé': { checkbox: false },
        'Photos autorisées': { checkbox: d.photos === true },
        'Date séance': { date: { start: s.date } },
        'Groupe réservation': { rich_text: [{ text: { content: groupe } }] }
      };
      if (d.forfait) properties['Forfait'] = { select: { name: String(d.forfait) } };
      if (d.creneau) properties['Créneau'] = { select: { name: String(d.creneau) } };
      if (d.niveau) properties['Niveau'] = { select: { name: String(d.niveau) } };
      if (d.telephone) properties['Téléphone'] = { phone_number: String(d.telephone).slice(0, 50) };
      if (d.attentes) properties['Attentes'] = { rich_text: [{ text: { content: String(d.attentes).slice(0, 1800) } }] };
      if (d.modePaiement) properties['Mode de paiement'] = { rich_text: [{ text: { content: String(d.modePaiement).slice(0, 200) } }] };
      if (d.referenceInterac) properties['Référence Interac'] = { rich_text: [{ text: { content: String(d.referenceInterac).slice(0, 200) } }] };

      const res = await notionFetch('/v1/pages', {
        method: 'POST',
        body: JSON.stringify({ parent: { database_id: NOTION_DB }, properties })
      }, token);

      if (!res.ok) {
        const detail = await res.text();
        console.error('Erreur Notion :', detail);
        return {
          statusCode: 502,
          headers,
          body: JSON.stringify({ error: 'Notion a refusé la requête', detail, partiallyCreated: created })
        };
      }
      created.push(s.date);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, seances: created }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur', partiallyCreated: created }) };
  }
};
