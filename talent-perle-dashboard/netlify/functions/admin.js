// Fonction Netlify — sert de porte unique entre le Dashboard Talent Perlé
// et Supabase. Le mot de passe (DASHBOARD_PASSWORD) protège tout : pas de
// compte, pas de session, juste un mot de passe partagé vérifié à chaque
// appel — suffisant puisqu'il n'y a qu'un seul utilisateur (Karim).
// La clé service_role ne quitte jamais le serveur.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD;

const ENTITIES = ['activities', 'photos', 'events', 'partners'];
const BUCKET = 'talent-perle';

function sbHeaders(extra) {
  return Object.assign(
    { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    extra || {}
  );
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-password',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non permise' }) };
  }
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DASHBOARD_PASSWORD) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY ou DASHBOARD_PASSWORD manquant dans les variables Netlify' }) };
  }

  const givenPassword = event.headers['x-admin-password'] || event.headers['X-Admin-Password'] || '';
  if (givenPassword !== DASHBOARD_PASSWORD) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Mot de passe incorrect' }) };
  }

  let d;
  try {
    d = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'JSON invalide' }) };
  }

  const action = String(d.action || '');

  try {
    if (action === 'upload') {
      const filename = String(d.filename || 'fichier').replace(/[^a-zA-Z0-9._-]/g, '_');
      const contentType = String(d.contentType || 'application/octet-stream');
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;
      const buffer = Buffer.from(String(d.contentBase64 || ''), 'base64');

      const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: sbHeaders({ 'Content-Type': contentType }),
        body: buffer,
      });
      if (!res.ok) {
        const detail = await res.text();
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Téléversement refusé par Supabase', detail }) };
      }
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, url: publicUrl }) };
    }

    const entity = String(d.entity || '');
    if (!ENTITIES.includes(entity)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Entité inconnue' }) };
    }

    if (action === 'list') {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${entity}?select=*&order=sort_order.asc`, {
        headers: sbHeaders(),
      });
      const rows = await res.json().catch(() => []);
      if (!res.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: 'Lecture refusée par Supabase', detail: rows }) };
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, rows }) };
    }

    if (action === 'create') {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${entity}`, {
        method: 'POST',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(d.data || {}),
      });
      const rows = await res.json().catch(() => []);
      if (!res.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: 'Création refusée par Supabase', detail: rows }) };
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, row: rows[0] }) };
    }

    if (action === 'update') {
      const id = String(d.id || '');
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id requis' }) };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${entity}?id=eq.${id}`, {
        method: 'PATCH',
        headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(d.data || {}),
      });
      const rows = await res.json().catch(() => []);
      if (!res.ok) return { statusCode: 502, headers, body: JSON.stringify({ error: 'Modification refusée par Supabase', detail: rows }) };
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, row: rows[0] }) };
    }

    if (action === 'delete') {
      const id = String(d.id || '');
      if (!id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'id requis' }) };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${entity}?id=eq.${id}`, {
        method: 'DELETE',
        headers: sbHeaders(),
      });
      if (!res.ok) {
        const detail = await res.text();
        return { statusCode: 502, headers, body: JSON.stringify({ error: 'Suppression refusée par Supabase', detail }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Action inconnue' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
