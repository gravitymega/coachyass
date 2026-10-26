// Module « Vidéo IA » : description en français → prompt anglais au style Gravity (Gemini,
// fonction /api/video) → courte vidéo générée par un Space Hugging Face gratuit (ZeroGPU),
// appelé par le serveur. La page attend le résultat en flux NDJSON, puis récupère la vidéo
// par le relais du serveur pour l'aperçu et le téléchargement.
import { $, showError, setProgress, offerFile, slugify, keepAwake } from './common.js';

const STORE_KEY = 'artcraft-voice-password'; // même mot de passe mémorisé que les autres modules
const state = { password: '', titre: '', enhance: true, busy: false };

try { state.password = localStorage.getItem(STORE_KEY) || ''; } catch { /* stockage indisponible */ }
if (state.password) $('password').value = state.password;

const post = payload => fetch('/api/video', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-art-password': state.password },
  body: JSON.stringify(payload),
});

async function errorOf(res) {
  let msg = `Erreur ${res.status}`;
  try { msg = (await res.json()).error || msg; } catch { /* réponse non JSON */ }
  if (res.status === 404) msg = 'Fonction introuvable : lance le site avec « npx wrangler dev » (ou déploie-le sur Cloudflare).';
  return msg;
}

const fmtElapsed = s => (s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${String(Math.round(s % 60)).padStart(2, '0')} s`);

// ---------- Accès ----------
async function ping() {
  const res = await post({ ping: true }).catch(() => null);
  if (!res) { $('status-line').textContent = 'Serveur injoignable : vérifie que le site tourne.'; return false; }
  if (res.status === 401) { $('step-login').hidden = false; $('step-idea').hidden = true; return false; }
  if (!res.ok) { showError(await errorOf(res)); return false; }
  const info = await res.json();
  $('step-login').hidden = true;
  $('step-idea').hidden = false;
  $('status-line').textContent = [
    info.gemini ? 'Gemini branché : il écrira le prompt en anglais.' : 'Gemini pas branché (GEMINI_API_KEY absente) : le modèle vidéo améliorera lui-même ta description.',
    info.hf ? 'Token Hugging Face branché (≈ 5 min de calcul gratuites par jour).' : 'Sans token Hugging Face : quota très réduit (≈ 2 min par jour, partagées). Ajoute HF_TOKEN pour en avoir plus.',
  ].join(' ');
  return true;
}

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  state.password = $('password').value;
  showError('');
  if (await ping()) {
    try { localStorage.setItem(STORE_KEY, state.password); } catch { /* stockage indisponible */ }
  } else if (!$('step-login').hidden) showError('Mot de passe incorrect.');
});
ping();

// ---------- 1. Prompt ----------
$('btn-prompt').addEventListener('click', async () => {
  const text = $('idea').value.trim();
  showError('');
  if (text.length < 3) { showError('Décris la scène en quelques mots.'); return; }
  const btn = $('btn-prompt');
  btn.disabled = true;
  btn.textContent = 'L\'IA écrit le prompt…';
  try {
    const res = await post({ action: 'prompt', text, format: $('format').value });
    if (!res.ok) throw new Error(await errorOf(res));
    const out = await res.json();
    $('prompt').value = out.prompt;
    state.titre = out.titre || text;
    state.enhance = out.source !== 'gemini';
    $('prompt-source').textContent = out.source === 'gemini'
      ? 'Prompt écrit par Gemini à partir de ta description. Tu peux le retoucher avant de lancer.'
      : (out.warning ? out.warning + ' ' : '') + 'Le modèle vidéo améliorera lui-même ce prompt.';
    $('step-generate').hidden = false;
    $('step-generate').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    showError(err.message || 'Impossible de préparer le prompt.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Préparer le prompt';
  }
});

// ---------- 2. Génération ----------
async function readStream(res, onMessage) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const l of lines) if (l.trim()) onMessage(JSON.parse(l));
  }
  if (buffer.trim()) onMessage(JSON.parse(buffer));
}

async function generate() {
  if (state.busy) return;
  const prompt = $('prompt').value.trim();
  showError('');
  if (prompt.length < 5) { showError('Le prompt est vide.'); return; }
  state.busy = true;
  $('btn-generate').disabled = true;
  $('btn-again').disabled = true;
  const release = await keepAwake();
  const t0 = Date.now();
  let status = 'Envoi de la demande…';
  let result = null;
  let failure = null;
  const tick = () => {
    const s = (Date.now() - t0) / 1000;
    // Barre indicative : on ne connaît pas la place dans la file d'attente.
    setProgress('progress', Math.min(0.95, s / 240), `${status} · ${fmtElapsed(s)}`);
  };
  const timer = setInterval(tick, 1000);
  tick();
  try {
    const res = await post({
      action: 'generate', prompt, format: $('format').value, quality: $('quality').value,
      duration: Number($('duration').value), enhance: Boolean(state.enhance),
    });
    if (!res.ok) throw new Error(await errorOf(res));
    await readStream(res, msg => {
      if (msg.status) {
        status = msg.status.length > 90 ? 'Génération en cours…' : msg.status;
        $('wait-detail').hidden = false;
        $('wait-detail').textContent = msg.status;
      }
      if (msg.done) result = msg.done;
      if (msg.error) failure = msg.error;
      tick();
    });
    if (failure) throw new Error(failure);
    if (!result) throw new Error('La connexion avec le serveur a été coupée avant la fin. La vidéo a peut-être quand même utilisé du quota : réessaie dans un moment.');

    status = 'Récupération de la vidéo…';
    tick();
    const file = await fetch(result.video);
    if (!file.ok) throw new Error(await errorOf(file));
    const blob = await file.blob();
    const name = `gravity-video-ia-${slugify(state.titre, 'clip')}.mp4`;
    const url = offerFile(new Blob([blob], { type: 'video/mp4' }), name, { download: 'btn-download', share: 'btn-share', title: 'Vidéo IA Gravity' });
    const video = $('result-video');
    video.src = url;
    video.play().catch(() => {});
    $('result-info').textContent = `${result.width}×${result.height}, ${result.duration} s · créée par ${result.space} en ${fmtElapsed((Date.now() - t0) / 1000)}.`;
    $('step-result').hidden = false;
    setProgress('progress', 1, 'Vidéo prête');
    $('wait-detail').hidden = true;
    $('step-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    const msg = err instanceof TypeError ? 'Connexion coupée avec le serveur : vérifie ta connexion, puis réessaie.' : err.message;
    showError(msg || 'Génération impossible.');
    $('progress').hidden = true;
  } finally {
    clearInterval(timer);
    release();
    state.busy = false;
    $('btn-generate').disabled = false;
    $('btn-again').disabled = false;
  }
}

$('btn-generate').addEventListener('click', generate);
$('btn-again').addEventListener('click', generate);
