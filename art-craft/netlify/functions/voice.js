// Fonction Netlify du Studio voix d'Art craft : porte unique vers ElevenLabs
// (clonage de voix instantané + synthèse vocale). La clé ELEVENLABS_API_KEY ne
// quitte jamais le serveur, et chaque appel exige le mot de passe ART_CRAFT_PASSWORD
// (sinon n'importe qui pourrait consommer les crédits du compte).

const crypto = require('crypto');

const API = 'https://api.elevenlabs.io/v1';
const API_KEY = process.env.ELEVENLABS_API_KEY;
const PASSWORD = process.env.ART_CRAFT_PASSWORD;

const MODELS = ['eleven_v4', 'eleven_multilingual_v2', 'eleven_flash_v2_5'];
const MAX_CHARS = 900;              // par appel : reste sous la limite de temps d'une fonction Netlify
const MAX_SAMPLES_BYTES = 4.2e6;    // la requête entière doit rester sous 6 Mo (base64 compris)

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function samePassword(given) {
  const a = Buffer.from(String(given || ''));
  const b = Buffer.from(String(PASSWORD));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function eleven(path, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'xi-api-key': API_KEY, ...(init.headers || {}) },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const j = await res.json();
      detail = (j.detail && (j.detail.message || j.detail.status || JSON.stringify(j.detail))) || JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => '');
    }
    const err = new Error(`ElevenLabs ${res.status} : ${detail}`.slice(0, 400));
    err.status = res.status;
    throw err;
  }
  return res;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Méthode non permise' });
  if (!PASSWORD) return json(500, { error: 'ART_CRAFT_PASSWORD manquant dans les variables Netlify du site art-craft' });
  if (!samePassword(event.headers['x-art-password'])) return json(401, { error: 'Mot de passe incorrect' });
  // Mot de passe bon mais pas de compte ElevenLabs : les voix gratuites (Piper) restent utilisables.
  if (!API_KEY) return json(503, { error: 'ELEVENLABS_API_KEY manquant dans les variables Netlify du site art-craft', code: 'no_elevenlabs' });

  let d;
  try {
    d = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'JSON invalide' });
  }

  try {
    if (d.action === 'list') {
      const r = await (await eleven('/voices')).json();
      const voices = (r.voices || []).map(v => ({ id: v.voice_id, name: v.name, category: v.category }));
      return json(200, {
        cloned: voices.filter(v => v.category === 'cloned' || v.category === 'professional'),
        premade: voices.filter(v => v.category !== 'cloned' && v.category !== 'professional').slice(0, 40),
      });
    }

    if (d.action === 'clone') {
      // Le consentement est vérifié ici aussi, pas seulement dans la page.
      if (d.consent !== true) return json(400, { error: 'Le consentement de la personne dont c\'est la voix est obligatoire.' });
      const name = String(d.name || '').trim().slice(0, 60);
      if (!name) return json(400, { error: 'Donne un nom à la voix.' });
      const files = Array.isArray(d.files) ? d.files.slice(0, 10) : [];
      if (!files.length) return json(400, { error: 'Ajoute au moins un enregistrement.' });
      const form = new FormData();
      form.append('name', name);
      form.append('description', `Voix clonée depuis Art craft (Gravity) le ${new Date().toISOString().slice(0, 10)}, avec consentement confirmé par l'utilisateur.`);
      form.append('remove_background_noise', d.removeNoise ? 'true' : 'false');
      let total = 0;
      files.forEach((f, i) => {
        const buf = Buffer.from(String(f.base64 || ''), 'base64');
        total += buf.length;
        const type = String(f.type || 'audio/webm');
        form.append('files', new Blob([buf], { type }), String(f.name || `extrait-${i + 1}`).replace(/[^\w.-]+/g, '_'));
      });
      if (total > MAX_SAMPLES_BYTES) return json(413, { error: 'Enregistrements trop lourds (4 Mo max au total).' });
      const r = await (await eleven('/voices/add', { method: 'POST', body: form })).json();
      return json(200, { id: r.voice_id, requiresVerification: !!r.requires_verification });
    }

    if (d.action === 'speak') {
      const voiceId = String(d.voiceId || '');
      const text = String(d.text || '').trim();
      if (!/^[\w-]{6,64}$/.test(voiceId)) return json(400, { error: 'Voix invalide' });
      if (!text) return json(400, { error: 'Texte vide' });
      if (text.length > MAX_CHARS) return json(400, { error: `Texte trop long pour un seul appel (${MAX_CHARS} caractères max)` });
      const clamp = (v, def, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : def));
      const model = MODELS.includes(d.model) ? d.model : MODELS[0];
      const body = (modelId) => JSON.stringify({
        text,
        model_id: modelId,
        language_code: 'fr',
        previous_text: d.previousText ? String(d.previousText).slice(-300) : undefined,
        next_text: d.nextText ? String(d.nextText).slice(0, 300) : undefined,
        voice_settings: {
          stability: clamp(d.stability, 0.45),
          similarity_boost: clamp(d.similarity, 0.85),
          style: clamp(d.style, 0.25),
          use_speaker_boost: true,
          speed: clamp(d.speed, 1, 0.7, 1.2),
        },
      });
      const path = `/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
      const opts = (m) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body(m) });
      let res;
      let used = model;
      try {
        res = await eleven(path, opts(model));
      } catch (err) {
        // Si un modèle récent refuse un réglage, on retombe sur le modèle multilingue éprouvé.
        if (model === 'eleven_multilingual_v2' || ![400, 422].includes(err.status)) throw err;
        used = 'eleven_multilingual_v2';
        res = await eleven(path, opts(used));
      }
      const audio = Buffer.from(await res.arrayBuffer());
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'X-Model-Used': used },
        body: audio.toString('base64'),
        isBase64Encoded: true,
      };
    }

    if (d.action === 'delete') {
      const voiceId = String(d.voiceId || '');
      if (!/^[\w-]{6,64}$/.test(voiceId)) return json(400, { error: 'Voix invalide' });
      await eleven(`/voices/${voiceId}`, { method: 'DELETE' });
      return json(200, { ok: true });
    }

    return json(400, { error: 'Action inconnue' });
  } catch (err) {
    console.error(err);
    return json(err.status && err.status < 500 ? err.status : 502, { error: err.message || String(err) });
  }
};
