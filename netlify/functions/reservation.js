// Fonction Netlify — envoie les réservations Coach Yass dans Notion
// La clé secrète NOTION_TOKEN reste côté serveur : jamais visible par les visiteurs.

const NOTION_DB = process.env.NOTION_DB_COACH_YASS || '7eda882ea6144a65a465e4fdb1e92b94';

const MONTANTS = { '1': 20, '3': 55, '6': 100, '12': 180 };

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non permise' }) };
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOTION_TOKEN manquant dans les variables Netlify' }) };
  }

  let d;
  try {
    d = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  // Garde-fous simples
  const nom = String(d.nom || '').trim().slice(0, 200);
  const email = String(d.email || '').trim().slice(0, 200);
  if (!nom || !email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nom et email requis' }) };
  }

  const forfaitKey = String(d.forfaitKey || '');
  const properties = {
    'Nom': { title: [{ text: { content: nom } }] },
    'Email': { email: email },
    'Statut': { status: { name: 'Not started' } },
    'Payé': { checkbox: false },
    'Photos autorisées': { checkbox: d.photos === true }
  };

  if (d.forfait) properties['Forfait'] = { select: { name: String(d.forfait) } };
  if (MONTANTS[forfaitKey]) properties['Montant'] = { number: MONTANTS[forfaitKey] };
  if (d.date) {
    // date + heure combinées si l'heure est fournie
    const start = d.heure ? `${d.date}T${d.heure}:00-04:00` : d.date;
    properties['Date séance'] = { date: { start } };
  }
  if (d.terrain) properties['Terrain'] = { rich_text: [{ text: { content: String(d.terrain).slice(0, 1800) } }] };
  if (d.telephone) properties['Téléphone'] = { phone_number: String(d.telephone).slice(0, 50) };
  if (d.remarque) properties['Remarque'] = { rich_text: [{ text: { content: String(d.remarque).slice(0, 1800) } }] };

  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ parent: { database_id: NOTION_DB }, properties })
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
