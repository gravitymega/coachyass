// Enregistrement des shorts dans Google Drive, directement depuis le navigateur.
// Connexion Google officielle (Google Identity Services) avec la permission
// « drive.file » : l'outil ne voit que les fichiers qu'il a créés lui-même,
// jamais le reste du Drive. Les shorts vont dans le dossier DRIVE_FOLDER.
// Aucun secret : l'identifiant client OAuth (GOOGLE_CLIENT_ID) est public par nature,
// il doit simplement autoriser l'adresse du site dans la console Google Cloud.
import { $, setProgress } from './common.js';

export const GOOGLE_CLIENT_ID = '';
export const DRIVE_FOLDER = 'Art craft — Gravity';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const AUTO_KEY = 'artcraft-drive-auto';

let token = null; // { value, expires }
let tokenClient = null;

function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Connexion Google indisponible (script bloqué ?)'));
    document.head.appendChild(s);
  });
}

// Doit être appelé pendant un clic : Google ouvre une fenêtre de connexion.
async function getToken() {
  if (token && token.expires > Date.now() + 60e3) return token.value;
  if (!GOOGLE_CLIENT_ID) throw new Error('Google Drive n\'est pas encore configuré (identifiant client Google manquant).');
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: r => {
        if (r.error) return reject(new Error(r.error === 'access_denied' ? 'Accès à Google Drive refusé' : r.error));
        token = { value: r.access_token, expires: Date.now() + (r.expires_in || 3600) * 1000 };
        resolve(token.value);
      },
      error_callback: e => reject(new Error(e && e.type === 'popup_closed' ? 'Fenêtre Google fermée' : 'Connexion Google impossible')),
    });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

async function api(path, init = {}) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token.value}`, ...(init.headers || {}) },
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.error && j.error.message) || `Google Drive a répondu ${res.status}`);
  return j;
}

async function folderId() {
  const q = encodeURIComponent(`name = '${DRIVE_FOLDER.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const found = await api(`files?q=${q}&fields=files(id)&spaces=drive`);
  if (found.files && found.files.length) return found.files[0].id;
  const made = await api('files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: DRIVE_FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return made.id;
}

// Envoi « reprenable » : une session, puis le fichier en un seul PUT (avec progression).
async function uploadFile(blob, name, description, parent, onProgress) {
  const init = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token.value}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': blob.type || 'video/mp4',
      'X-Upload-Content-Length': String(blob.size),
    },
    body: JSON.stringify({ name, parents: [parent], description: description.slice(0, 2000) }),
  });
  const session = init.headers.get('Location');
  if (!init.ok || !session) {
    const j = await init.json().catch(() => ({}));
    throw new Error((j.error && j.error.message) || `Envoi vers Google Drive refusé (${init.status})`);
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', session);
    xhr.setRequestHeader('Content-Type', blob.type || 'video/mp4');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { return resolve(JSON.parse(xhr.responseText)); } catch { return resolve({}); }
      }
      reject(new Error(`Envoi vers Google Drive interrompu (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Envoi vers Google Drive interrompu (réseau)'));
    xhr.send(blob);
  });
}

// ---------- Interface ----------
let current = null; // { blob, name, description }
let savedFor = null;

function setLink(file) {
  const box = $('drive-result');
  box.textContent = '✅ Enregistré dans Google Drive (dossier « ' + DRIVE_FOLDER + ' ») : ';
  const a = document.createElement('a');
  a.href = file.webViewLink || 'https://drive.google.com/drive/my-drive';
  a.target = '_blank';
  a.rel = 'noopener';
  a.textContent = 'ouvrir';
  box.appendChild(a);
}

async function save() {
  if (!current) return;
  const btn = $('btn-drive');
  btn.disabled = true;
  $('drive-error').textContent = '';
  try {
    await getToken();
    setProgress('drive-progress', 0, 'Préparation du dossier Drive…');
    const parent = await folderId();
    const file = await uploadFile(current.blob, current.name, current.description(), parent,
      r => setProgress('drive-progress', r, `Envoi vers Google Drive… ${Math.round(r * 100)} %`));
    savedFor = current.blob;
    setProgress('drive-progress', 1, 'Enregistré');
    setLink(file);
  } catch (err) {
    $('drive-progress').hidden = true;
    $('drive-error').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

$('btn-drive').onclick = save;
try { $('drive-auto').checked = localStorage.getItem(AUTO_KEY) === '1'; } catch { /* stockage indisponible */ }
$('drive-auto').onchange = () => { try { localStorage.setItem(AUTO_KEY, $('drive-auto').checked ? '1' : '0'); } catch { /* idem */ } };

// Appelé quand un short est prêt. Si « automatique » est coché et que Google a déjà
// donné son accord pendant cette visite, l'envoi part tout seul ; sinon un clic suffit
// (la toute première connexion Google exige un clic).
export function offerDrive(blob, name, description) {
  current = { blob, name, description };
  $('drive').hidden = false;
  $('drive-result').textContent = '';
  $('drive-error').textContent = '';
  $('drive-progress').hidden = true;
  $('drive-setup').hidden = !!GOOGLE_CLIENT_ID;
  if ($('drive-auto').checked && token && token.expires > Date.now() + 60e3 && savedFor !== blob) save();
}
