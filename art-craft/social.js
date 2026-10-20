// Publication directe d'un highlight sur Instagram (reel) et sur la Page Facebook.
// Réutilise la passerelle Meta du Dashboard (fonction instagram.js du site
// gravity-admin-dashboard, jeton META_PAGE_ACCESS_TOKEN côté serveur) : on se
// connecte avec le compte admin du Dashboard, la vidéo est déposée dans le
// stockage public gravity-media (Meta la télécharge par son URL), puis Meta la publie.
import { $, setProgress } from './common.js';
import { DEFAULT_TAGS, MAX_CAPTION, normalizeTags, buildCaption } from './social-core.js';

const SB_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
const SB_KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';
const BUCKET = 'gravity-media';
const META_API = 'https://gravity-admin-dashboard.netlify.app/.netlify/functions/instagram';
const SESSION_KEY = 'artcraft-dashboard-session';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let video = null;
let captionEdited = false;

// ---------- Légende ----------
$('pub-tags').value = DEFAULT_TAGS.map(t => '#' + t).join(' ');

function caption() {
  return buildCaption({
    title: $('title').value, subtitle: $('subtitle').value,
    text: $('pub-text').value, tags: normalizeTags($('pub-tags').value),
  });
}

function refreshCaption() {
  if (!captionEdited) $('pub-caption').value = caption();
  const c = $('pub-caption').value;
  const tags = (c.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  $('pub-count').textContent = `${c.length} / ${MAX_CAPTION} caractères · ${tags} / 30 hashtags`;
  $('pub-count').classList.toggle('over', c.length > MAX_CAPTION || tags > 30);
}
['title', 'subtitle', 'pub-text', 'pub-tags'].forEach(id => $(id).addEventListener('input', refreshCaption));
$('pub-caption').addEventListener('input', () => { captionEdited = true; refreshCaption(); });
$('btn-reset-caption').onclick = () => { captionEdited = false; refreshCaption(); };
refreshCaption();

async function copyCaption() {
  try { await navigator.clipboard.writeText($('pub-caption').value); return true; } catch { return false; }
}
$('btn-copy-caption').onclick = async () => {
  const ok = await copyCaption();
  $('btn-copy-caption').textContent = ok ? 'Légende copiée ✔' : 'Copie impossible';
  setTimeout(() => { $('btn-copy-caption').textContent = 'Copier la légende'; }, 1800);
};

// Appelé quand le short est prêt : la légende sert aussi au bouton « Partager… ».
export function setVideo(blob) {
  video = blob;
  $('publish').hidden = false;
  $('pub-links').textContent = '';
  refreshCaption();
}
export const currentCaption = () => $('pub-caption').value;
export { copyCaption };

// ---------- Connexion (compte admin du Dashboard, Supabase Auth en REST) ----------
function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function saveSession(s) {
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch { /* stockage indisponible */ }
}

async function authRequest(grant, body) {
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error_description || j.msg || 'Connexion refusée');
  const s = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, email: j.user && j.user.email };
  saveSession(s);
  return s;
}

function askLogin() {
  const form = $('pub-login');
  form.hidden = false;
  $('pub-email').focus();
  return new Promise((resolve, reject) => {
    form.onsubmit = async e => {
      e.preventDefault();
      $('pub-login-error').textContent = '';
      try {
        const s = await authRequest('password', { email: $('pub-email').value.trim(), password: $('pub-password').value });
        $('pub-password').value = '';
        form.hidden = true;
        resolve(s.access_token);
      } catch (err) {
        $('pub-login-error').textContent = err.message;
      }
    };
    $('pub-login-cancel').onclick = () => { form.hidden = true; reject(new Error('Connexion annulée')); };
  });
}

async function accessToken() {
  let s = loadSession();
  if (s && s.expires_at > Date.now() + 60e3) return s.access_token;
  if (s && s.refresh_token) {
    try { return (await authRequest('refresh_token', { refresh_token: s.refresh_token })).access_token; } catch { saveSession(null); }
  }
  return askLogin();
}

function showAccount() {
  const s = loadSession();
  $('pub-account').textContent = s && s.email ? `Connecté au Dashboard : ${s.email}` : '';
  $('btn-logout').hidden = !s;
}
$('btn-logout').onclick = () => { saveSession(null); showAccount(); };
showAccount();

// ---------- Envoi ----------
function upload(blob, path, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SB_URL}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('apikey', SB_KEY);
    xhr.setRequestHeader('Content-Type', 'video/mp4');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(`${SB_URL}/storage/v1/object/public/${BUCKET}/${path}`);
      let msg = `Envoi refusé (${xhr.status})`;
      try { msg = JSON.parse(xhr.responseText).message || msg; } catch { /* réponse non JSON */ }
      if (xhr.status === 413 || /size/i.test(msg)) msg = 'Vidéo trop lourde pour l\'envoi (100 Mo max) : refais le short en 720 × 1280.';
      reject(Object.assign(new Error(msg), { status: xhr.status }));
    };
    xhr.onerror = () => reject(new Error('Envoi interrompu (réseau)'));
    xhr.send(blob);
  });
}

async function meta(action, payload, token) {
  const res = await fetch(META_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.error || `Erreur ${res.status}`), { status: res.status });
  return j;
}

async function publishInstagram(url, text, token, status) {
  const container = await meta('create_container', { kind: 'reel', video_url: url, caption: text }, token);
  const deadline = Date.now() + 8 * 60e3;
  for (;;) {
    const { status_code: code, status: detail } = await meta('container_status', { container_id: container.id }, token);
    if (code === 'FINISHED') break;
    if (code === 'ERROR' || code === 'EXPIRED') throw new Error(`Instagram a refusé la vidéo (${detail || code})`);
    if (Date.now() > deadline) throw new Error('Instagram met trop de temps à traiter la vidéo : vérifie dans l\'appli dans quelques minutes.');
    status('Instagram traite la vidéo…');
    await sleep(5000);
  }
  const done = await meta('publish_container', { container_id: container.id }, token);
  return done.permalink || 'https://www.instagram.com/gravitybasketball_mtl/';
}

async function publishFacebook(url, text, title, token, status) {
  const { id } = await meta('facebook_video', { file_url: url, description: text, title }, token);
  const deadline = Date.now() + 8 * 60e3;
  for (;;) {
    const st = await meta('facebook_video_status', { video_id: id }, token);
    if (st.video_status === 'ready') return st.permalink || 'https://www.facebook.com/';
    if (st.video_status === 'error' || st.error) throw new Error(`Facebook a refusé la vidéo (${st.error || 'erreur de traitement'})`);
    if (Date.now() > deadline) return st.permalink || null; // publiée, encore en traitement chez Facebook
    status('Facebook traite la vidéo…');
    await sleep(6000);
  }
}

function addLink(label, href, error) {
  const p = document.createElement('p');
  if (error) {
    p.className = 'error';
    p.textContent = `${label} : ${error}`;
  } else {
    p.innerHTML = `✅ ${label} : `;
    const a = document.createElement('a');
    a.href = href || '#';
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = href ? 'voir la publication' : 'publiée (lien bientôt disponible)';
    p.appendChild(a);
  }
  $('pub-links').appendChild(p);
}

$('btn-publish').onclick = async () => {
  const toIg = $('pub-ig').checked, toFb = $('pub-fb').checked;
  const text = $('pub-caption').value.trim();
  if (!video) return;
  if (!toIg && !toFb) { addLink('Publication', null, 'coche Instagram et/ou Facebook.'); return; }
  const where = [toIg && 'Instagram (@gravitybasketball_mtl)', toFb && 'la Page Facebook'].filter(Boolean).join(' et ');
  if (!confirm(`Publier maintenant ce highlight sur ${where} ? Il sera visible par tous tes abonnés.`)) return;

  $('btn-publish').disabled = true;
  $('pub-links').textContent = '';
  const status = label => setProgress('publish-progress', 0.6, label);
  try {
    let token = await accessToken();
    showAccount();
    const path = `instagram/art-craft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    let url;
    try {
      url = await upload(video, path, token, r => setProgress('publish-progress', r * 0.5, `Envoi de la vidéo… ${Math.round(r * 100)} %`));
    } catch (err) {
      if (err.status !== 401 && err.status !== 403) throw err;
      saveSession(null);
      token = await askLogin();
      url = await upload(video, path, token, r => setProgress('publish-progress', r * 0.5, `Envoi de la vidéo… ${Math.round(r * 100)} %`));
    }
    status('Envoi à Meta…');
    const title = [$('title').value.trim(), $('subtitle').value.trim()].filter(Boolean).join(' · ');
    const jobs = [];
    if (toIg) jobs.push(publishInstagram(url, text, token, status).then(h => addLink('Instagram', h), e => addLink('Instagram', null, e.message)));
    if (toFb) jobs.push(publishFacebook(url, text, title, token, status).then(h => addLink('Facebook', h), e => addLink('Facebook', null, e.message)));
    await Promise.all(jobs);
    setProgress('publish-progress', 1, 'Terminé');
  } catch (err) {
    setProgress('publish-progress', 0, '');
    addLink('Publication', null, err.message);
  } finally {
    $('btn-publish').disabled = false;
  }
};
