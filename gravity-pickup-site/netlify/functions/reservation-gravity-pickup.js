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

const nodemailer = require('nodemailer');

const NOTION_DB = process.env.NOTION_DB_GRAVITY_PICKUP || 'e3a8b88ecadf45839cb8c7ccf2829a8e';
const CAPACITE_MAX = 15;

const MONTANTS = { '1': 12, '3': 32, '6': 60 };

const ZEFFY_LINKS = {
  mercredi: 'https://www.zeffy.com/en-CA/ticketing/gravity-ligue-maison-inscription',
  jeudi: 'https://www.zeffy.com/en-CA/ticketing/gravity-pickup-jeudi-andre-grasset-5v5-18-ans-et',
  samedi: 'https://www.zeffy.com/en-CA/ticketing/gravity-pickup-samedi-dorval-5v5-18-ans-et'
};

function formatDateFr(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Envoie l'email de confirmation au client (best-effort : ne bloque jamais la réservation)
async function sendConfirmationEmail({ to, nom, forfait, montant, creneauLabel, creneauKey, seances, modePaiement }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('GMAIL_USER/GMAIL_APP_PASSWORD manquants, email de confirmation non envoyé');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
  });

  const montantLine = montant ? `${montant} $` : 'le montant du forfait';
  const datesLines = (seances || [])
    .map(s => `${formatDateFr(s.date)}${s.heure ? ` à ${String(s.heure).replace(':', 'h')}` : ''}`)
    .join('<br>');

  const isZeffy = modePaiement === 'Zeffy';
  const zeffyUrl = ZEFFY_LINKS[creneauKey];
  const paymentBlock = isZeffy
    ? `<p style="font-size:14px;color:#111;line-height:1.6;margin:0 0 12px;">Complète ton paiement de <strong>${montantLine}</strong> en ligne pour confirmer ta place.</p>
       ${zeffyUrl ? `<a href="${zeffyUrl}" style="display:inline-block;background:#FF8A4C;color:#0a0a0a;font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:13px;padding:12px 20px;border-radius:8px;text-decoration:none;">🎟️ Payer avec Zeffy</a>` : ''}`
    : `<p style="font-size:14px;color:#111;line-height:1.6;margin:0;">Envoie <strong>${montantLine}</strong> par virement Interac au <a href="tel:+14383412051" style="color:#E8722C;font-weight:700;text-decoration:none;">438-341-2051</a> ou à <strong>mqtad9@hotmail.com</strong> pour confirmer ta place.</p>`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f0e1;padding:24px 12px;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e0d0;">
      <div style="background:#0a0a0a;padding:24px;text-align:center;">
        <div style="font-family:Arial,sans-serif;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#ffffff;font-size:20px;">🏀 Gravity Pickups</div>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;color:#111;margin:0 0 16px;">Salut ${nom} 👋</p>
        <p style="font-size:15px;color:#111;line-height:1.6;margin:0 0 20px;">Ta place est <strong>réservée</strong> ! Voici le récapitulatif :</p>
        <div style="background:#f5f0e1;border-left:3px solid #FF8A4C;border-radius:8px;padding:14px 16px;margin:0 0 20px;font-size:14px;color:#111;line-height:1.7;">
          <strong>${forfait || ''}</strong><br>
          ${creneauLabel ? `📍 ${creneauLabel}<br>` : ''}
          ${datesLines}
        </div>
        <div style="border:2px solid #FF8A4C;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
          <div style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:12px;color:#E8722C;margin:0 0 8px;">💳 Prochaine étape : paiement</div>
          ${paymentBlock}
        </div>
        <p style="font-size:13px;color:#666;line-height:1.6;margin:0;">À bientôt sur le terrain !</p>
      </div>
      <div style="background:#f5f0e1;padding:16px 24px;text-align:center;font-size:12.5px;color:#888;">
        Gravity Pickups · Basketball · Montréal<br>
        <a href="https://www.instagram.com/basket_libre" style="color:#E8722C;text-decoration:none;">@basket_libre</a>
      </div>
    </div>
  </div>`;

  const text = `Salut ${nom},\n\nTa place Gravity Pickups est réservée : ${forfait || ''}${creneauLabel ? ` — ${creneauLabel}` : ''}.\n\nProchaine étape : ${isZeffy ? `complète ton paiement de ${montantLine} en ligne${zeffyUrl ? ` (${zeffyUrl})` : ''}` : `envoie ${montantLine} par virement Interac au 438-341-2051 ou à mqtad9@hotmail.com`} pour confirmer ta place.\n\nÀ bientôt sur le terrain !\nGravity Pickups`;

  await transporter.sendMail({
    from: `"Gravity Pickups" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Ta place Gravity Pickups est réservée — paiement à compléter',
    html,
    text
  });
}

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

exports.sendConfirmationEmail = sendConfirmationEmail;

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
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOTION_TOKEN ou NOTION_DB_GRAVITY_PICKUP manquant dans les variables Netlify' }) };
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

    try {
      await sendConfirmationEmail({
        to: email,
        nom,
        forfait: d.forfait,
        montant: MONTANTS[forfaitKey],
        creneauLabel: d.creneau,
        creneauKey: d.creneauKey,
        seances,
        modePaiement: d.modePaiement
      });
    } catch (err) {
      console.error('Erreur envoi email de confirmation :', err);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, seances: created }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur', partiallyCreated: created }) };
  }
};
