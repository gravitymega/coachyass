// Fonction Netlify — envoie les réservations Gravity Coaching dans Notion
// La clé secrète NOTION_TOKEN reste côté serveur : jamais visible par les visiteurs.
//
// Base Notion « Réservations — Gravity Coaching » (créée le 10 août 2026) :
// title: JOUEUR, Email, Téléphone, Forfait (select), Montant (number $),
// Date séance (date), Terrain (text), Remarque (text), Statut (status : Pas commencé/
// En cours/Terminé), Payé (checkbox), Photos autorisées (checkbox).

const NOTION_DB = process.env.NOTION_DB_GRAVITY_COACHING || 'f55adb865220465980ff72c1b2a5dfd7';

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
  if (!token || !NOTION_DB) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOTION_TOKEN ou NOTION_DB_GRAVITY_COACHING manquant dans les variables Netlify' }) };
  }

  let d;
  try {
    d = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const nom = String(d.nom || '').trim().slice(0, 200);
  const email = String(d.email || '').trim().slice(0, 200);
  if (!nom || !email) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Nom et email requis' }) };
  }

  const forfaitKey = String(d.forfaitKey || '');
  const properties = {
    'JOUEUR': { title: [{ text: { content: nom } }] },
    'Email': { email: email },
    'Statut': { status: { name: 'Pas commencé' } },
    'Payé': { checkbox: false },
    'Photos autorisées': { checkbox: d.photos === true }
  };

  if (d.forfait) properties['Forfait'] = { select: { name: String(d.forfait) } };
  if (MONTANTS[forfaitKey]) properties['Montant'] = { number: MONTANTS[forfaitKey] };

  const seances = Array.isArray(d.seances) ? d.seances : (d.date ? [{ date: d.date, heure: d.heure }] : []);
  if (seances.length) {
    const first = seances[0];
    const start = first.heure ? `${first.date}T${first.heure}:00-04:00` : first.date;
    properties['Date séance'] = { date: { start } };
  }
  if (d.terrain) properties['Terrain'] = { rich_text: [{ text: { content: String(d.terrain).slice(0, 1800) } }] };
  if (d.telephone) properties['Téléphone'] = { phone_number: String(d.telephone).slice(0, 50) };

  let remarque = String(d.remarque || '').trim();
  if (seances.length > 1) {
    const list = seances.map((s, i) => `Séance ${i + 1} : ${s.date}${s.heure ? ' ' + s.heure : ''}`).join(' · ');
    remarque = remarque ? `${remarque}\n${list}` : list;
  }
  if (remarque) properties['Remarque'] = { rich_text: [{ text: { content: remarque.slice(0, 1800) } }] };

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
