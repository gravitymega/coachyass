// Fonction Netlify — envoie les réservations Coach Yass dans Notion
// La clé secrète NOTION_TOKEN reste côté serveur : jamais visible par les visiteurs.

const nodemailer = require('nodemailer');

const NOTION_DB = process.env.NOTION_DB_COACH_YASS || '7eda882ea6144a65a465e4fdb1e92b94';

const MONTANTS = { '1': 30, '3': 65, '6': 110, '12': 190 };

function formatDateFr(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Envoie l'email de confirmation au client (best-effort : ne bloque jamais la réservation)
async function sendConfirmationEmail({ to, nom, forfait, montant, date, heure, terrain }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('GMAIL_USER/GMAIL_APP_PASSWORD manquants, email de confirmation non envoyé');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
  });

  const dateLine = date ? `${formatDateFr(date)}${heure ? ` à ${heure.replace(':', 'h')}` : ''}` : '';
  const montantLine = montant ? `${montant} $` : 'le montant du forfait';

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f5f0e1;padding:24px 12px;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e0d0;">
      <div style="background:#0a0a0a;padding:24px;text-align:center;">
        <div style="font-family:Arial,sans-serif;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#ffffff;font-size:20px;">🏀 Gravity Coaching</div>
      </div>
      <div style="padding:24px;">
        <p style="font-size:15px;color:#111;margin:0 0 16px;">Salut ${nom} 👋</p>
        <p style="font-size:15px;color:#111;line-height:1.6;margin:0 0 20px;">Ta séance est <strong>réservée</strong> ! Voici le récapitulatif :</p>
        <div style="background:#f5f0e1;border-left:3px solid #FF8A4C;border-radius:8px;padding:14px 16px;margin:0 0 20px;font-size:14px;color:#111;line-height:1.7;">
          <strong>${forfait || ''}</strong><br>
          ${dateLine ? `📅 ${dateLine}<br>` : ''}
          ${terrain ? `📍 ${terrain}` : ''}
        </div>
        <div style="border:2px solid #FF8A4C;border-radius:8px;padding:14px 16px;margin:0 0 20px;">
          <div style="font-weight:800;text-transform:uppercase;letter-spacing:.04em;font-size:12px;color:#E8722C;margin:0 0 8px;">💳 Prochaine étape : paiement</div>
          <p style="font-size:14px;color:#111;line-height:1.6;margin:0;">Envoie <strong>${montantLine}</strong> par virement Interac au <a href="tel:+14383412051" style="color:#E8722C;font-weight:700;text-decoration:none;">438-341-2051</a> ou à <strong>mqtad9@hotmail.com</strong> pour confirmer ta place.</p>
        </div>
        <p style="font-size:13px;color:#666;line-height:1.6;margin:0 0 6px;">☔ En cas de pluie, la séance sera reportée — tu seras recontacté(e) pour reprogrammer.</p>
        <p style="font-size:13px;color:#666;line-height:1.6;margin:0;">À bientôt sur le terrain !</p>
      </div>
      <div style="background:#f5f0e1;padding:16px 24px;text-align:center;font-size:12.5px;color:#888;">
        Gravity Coaching · Basketball · Montréal<br>
        <a href="https://www.instagram.com/coach_yass1" style="color:#E8722C;text-decoration:none;">@coach_yass1</a>
      </div>
    </div>
  </div>`;

  const text = `Salut ${nom},\n\nTa séance Gravity Coaching est réservée : ${forfait || ''}${dateLine ? ` — ${dateLine}` : ''}${terrain ? ` — ${terrain}` : ''}.\n\nProchaine étape : envoie ${montantLine} par virement Interac au 438-341-2051 ou à mqtad9@hotmail.com pour confirmer ta place.\n\nÀ bientôt sur le terrain !\nGravity Coaching`;

  await transporter.sendMail({
    from: `"Gravity Coaching" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Ta séance Gravity Coaching est réservée — paiement à compléter',
    html,
    text
  });
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
  if (d.referenceInterac) properties['Référence Interac'] = { rich_text: [{ text: { content: String(d.referenceInterac).slice(0, 200) } }] };

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

    try {
      await sendConfirmationEmail({
        to: email,
        nom,
        forfait: d.forfait,
        montant: MONTANTS[forfaitKey],
        date: d.date,
        heure: d.heure,
        terrain: d.terrain
      });
    } catch (err) {
      console.error('Erreur envoi email de confirmation :', err);
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
