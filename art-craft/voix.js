import { $, showError, setProgress, offerFile } from './common.js';
import { splitText } from './voice-core.js';
import { BRAND } from './brand.js';
import { FREE_VOICES, isFreeVoice } from './piper-core.js';
import { speakFree } from './piper.js';

const ENDPOINT = '/.netlify/functions/voice';
const MAX_SAMPLE_BYTES = 4.2e6;
const MAX_CHUNK = 900;
const STORE_KEY = 'artcraft-voice-password';

const state = { password: '', samples: [], recording: null, voices: { cloned: [], premade: [] } };
let nextId = 1;

// Modèles de textes Gravity (point de départ, à adapter).
const TEMPLATES = {
  intro: `Voici les meilleurs moments du dernier match de ${BRAND.name}. Accroche-toi, ça part fort !`,
  match: `Game day ! ${BRAND.name} affronte [adversaire] ce [jour] à [heure], au [lieu]. Viens nous encourager, l'entrée est gratuite. On compte sur toi !`,
  inscription: `Les inscriptions ${BRAND.name} sont ouvertes ! Entraînements, matchs et coaching pour tous les niveaux à ${BRAND.city}. Places limitées : inscris-toi maintenant sur ${BRAND.site.replace(/\./g, ' point ')}.`,
  merci: `Merci aux joueurs, aux parents, aux coachs et à tous nos partenaires. Suivez-nous sur Instagram, ${BRAND.instagram.replace('@', 'arobase ').replace(/_/g, ' ')}, et on se voit au prochain match. Gravity, on monte !`,
};

// ---------- Appels au serveur ----------
async function call(action, payload = {}, { binary = false } = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-art-password': state.password },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try { msg = (await res.json()).error || msg; } catch { /* réponse non JSON */ }
    if (res.status === 404) msg = 'Fonction introuvable : le site art-craft doit être déployé sur Netlify (pas ouvert en fichier local).';
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  if (!binary) return res.json();
  return { blob: await res.blob(), model: res.headers.get('X-Model-Used') };
}

// ---------- Accès ----------
try { state.password = localStorage.getItem(STORE_KEY) || ''; } catch { /* stockage indisponible */ }
if (state.password) $('password').value = state.password;

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  state.password = $('password').value;
  showError('');
  try {
    await loadVoices();
    try { localStorage.setItem(STORE_KEY, state.password); } catch { /* stockage indisponible */ }
    $('step-login').hidden = true;
    $('step-clone').hidden = false;
    $('step-speak').hidden = false;
  } catch (err) {
    showError(err.message);
  }
});

async function loadVoices(selectId) {
  try {
    state.voices = await call('list');
    state.noEleven = false;
  } catch (err) {
    if (err.status !== 503) throw err;
    // Pas de compte ElevenLabs : seules les voix gratuites sont proposées.
    state.voices = { cloned: [], premade: [] };
    state.noEleven = true;
  }
  $('clone-note').hidden = !state.noEleven;
  const sel = $('voice');
  sel.innerHTML = '';
  const group = (label, list) => {
    if (!list.length) return;
    const g = document.createElement('optgroup');
    g.label = label;
    list.forEach(v => g.appendChild(new Option(v.name, v.id)));
    sel.appendChild(g);
  };
  group('Mes voix clonées', state.voices.cloned);
  group('Voix gratuites (sans compte)', FREE_VOICES);
  group('Voix prêtes ElevenLabs', state.voices.premade);
  if (selectId) sel.value = selectId;
  updateVoiceUi();
}

function updateVoiceUi() {
  const free = isFreeVoice($('voice').value);
  $('btn-delete').hidden = !state.voices.cloned.some(v => v.id === $('voice').value);
  $('step-speak').classList.toggle('free-voice', free);
  $('model-wrap').hidden = free;
  $('free-note').hidden = !free;
}
$('voice').addEventListener('change', updateVoiceUi);

// ---------- Échantillons ----------
function samplesBytes() {
  return state.samples.reduce((s, x) => s + x.blob.size, 0);
}

function addSample(blob, name) {
  state.samples.push({ id: nextId++, blob, name, url: URL.createObjectURL(blob) });
  renderSamples();
}

function renderSamples() {
  const ul = $('samples');
  ul.innerHTML = '';
  state.samples.forEach(s => {
    const li = document.createElement('li');
    li.innerHTML = '<span>🎙️</span><span class="name"></span><audio controls></audio>';
    li.querySelector('.name').textContent = s.name;
    li.querySelector('audio').src = s.url;
    const del = document.createElement('button');
    del.textContent = '✕';
    del.title = 'Retirer';
    del.onclick = () => { state.samples = state.samples.filter(x => x !== s); URL.revokeObjectURL(s.url); renderSamples(); };
    li.appendChild(del);
    ul.appendChild(li);
  });
  const mb = samplesBytes() / 1e6;
  $('samples-total').textContent = state.samples.length
    ? `${state.samples.length} enregistrement${state.samples.length > 1 ? 's' : ''} · ${mb.toFixed(1)} Mo / 4 Mo`
    : '';
  $('samples-total').classList.toggle('over', mb * 1e6 > MAX_SAMPLE_BYTES);
  updateCloneButton();
}

function updateCloneButton() {
  $('btn-clone').disabled = state.noEleven || !($('consent').checked && state.samples.length && $('voice-name').value.trim() && samplesBytes() <= MAX_SAMPLE_BYTES);
}
['consent', 'voice-name'].forEach(id => $(id).addEventListener('input', updateCloneButton));

$('sample-files').addEventListener('change', e => {
  [...e.target.files].forEach(f => addSample(f, f.name));
  e.target.value = '';
});

$('btn-rec').onclick = async () => {
  if (state.recording) { state.recording.recorder.stop(); return; }
  showError('');
  let stream;
  try {
    // Pas de traitement automatique : le clone doit entendre la voix telle quelle.
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch {
    showError('Micro inaccessible : autorise le micro pour ce site dans ton navigateur.');
    return;
  }
  const recorder = new MediaRecorder(stream);
  const chunks = [];
  const started = Date.now();
  const timer = setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    $('rec-clock').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }, 250);
  recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = () => {
    clearInterval(timer);
    stream.getTracks().forEach(t => t.stop());
    state.recording = null;
    $('btn-rec').classList.remove('on');
    $('btn-rec').textContent = '● Enregistrer';
    const type = recorder.mimeType || 'audio/webm';
    const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
    addSample(new Blob(chunks, { type }), `Enregistrement ${state.samples.length + 1}.${ext}`);
  };
  state.recording = { recorder };
  recorder.start();
  $('btn-rec').classList.add('on');
  $('btn-rec').textContent = '■ Arrêter';
};

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

$('btn-clone').onclick = async () => {
  showError('');
  $('btn-clone').disabled = true;
  try {
    setProgress('clone-progress', 0.2, 'Envoi des enregistrements…');
    const files = await Promise.all(state.samples.map(async s => ({ name: s.name, type: s.blob.type || 'audio/webm', base64: await toBase64(s.blob) })));
    setProgress('clone-progress', 0.5, 'Création de la voix…');
    const r = await call('clone', { name: $('voice-name').value.trim(), consent: $('consent').checked, removeNoise: $('remove-noise').checked, files });
    await loadVoices(r.id);
    setProgress('clone-progress', 1, r.requiresVerification
      ? 'Voix créée : ElevenLabs demande une vérification (voir ton compte ElevenLabs) avant de l\'utiliser.'
      : 'Voix créée ✔ Elle est sélectionnée dans « Faire parler ».');
    $('step-speak').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showError('Clonage impossible : ' + err.message);
  } finally {
    updateCloneButton();
  }
};

// ---------- Synthèse ----------
document.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => {
  $('text').value = TEMPLATES[b.dataset.tpl];
  $('text').dispatchEvent(new Event('input'));
}));
$('text').addEventListener('input', () => { $('chars').textContent = `${$('text').value.length} / 5000 caractères`; });

$('btn-speak').onclick = async () => {
  const voiceId = $('voice').value;
  const chunks = splitText($('text').value, MAX_CHUNK);
  if (!voiceId) { showError('Choisis une voix.'); return; }
  if (!chunks.length) { showError('Écris un texte.'); return; }
  showError('');
  $('result').hidden = true;
  $('btn-speak').disabled = true;
  try {
    if (isFreeVoice(voiceId)) {
      const wav = await speakFree($('text').value, voiceId, {
        speed: +$('speed').value, onProgress: (r, label) => setProgress('speak-progress', r, label),
      });
      showVoice(wav, 'wav');
      return;
    }
    const parts = [];
    let model = $('model').value;
    for (let i = 0; i < chunks.length; i++) {
      setProgress('speak-progress', i / chunks.length, `Génération de la voix… ${i + 1} / ${chunks.length}`);
      const { blob, model: used } = await call('speak', {
        voiceId, model, text: chunks[i],
        previousText: chunks[i - 1] || '', nextText: chunks[i + 1] || '',
        stability: +$('stability').value, similarity: +$('similarity').value,
        style: +$('style').value, speed: +$('speed').value,
      }, { binary: true });
      parts.push(blob);
      // Si le serveur a dû se replier sur un autre modèle, on garde celui-là pour la suite.
      if (used) model = used;
    }
    // Les trames MP3 se mettent bout à bout sans réencodage.
    showVoice(new Blob(parts, { type: 'audio/mpeg' }), 'mp3');
  } catch (err) {
    showError('Génération impossible : ' + err.message);
  } finally {
    $('btn-speak').disabled = false;
  }
};

function showVoice(blob, ext) {
  const label = ($('voice').selectedOptions[0]?.text || 'gravity').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const url = offerFile(blob, `voix-${label}.${ext}`, { download: 'btn-download', share: 'btn-share', title: 'Voix off Gravity' });
  $('btn-download').textContent = `Télécharger le ${ext.toUpperCase()}`;
  $('result-audio').src = url;
  $('result').hidden = false;
  setProgress('speak-progress', 1, `Voix prête · ${(blob.size / 1e6).toFixed(1)} Mo`);
}

$('btn-delete').onclick = async () => {
  const opt = $('voice').selectedOptions[0];
  if (!opt || !confirm(`Supprimer définitivement la voix clonée « ${opt.text} » du compte ElevenLabs ?`)) return;
  try {
    await call('delete', { voiceId: opt.value });
    await loadVoices();
  } catch (err) {
    showError('Suppression impossible : ' + err.message);
  }
};
