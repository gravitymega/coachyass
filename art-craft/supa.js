// Accès à la base Supabase de Gravity (même projet que le Dashboard et l'Espace Joueurs),
// en REST, sans SDK. Lecture publique (clé anon) pour les équipes et les joueurs ;
// écriture (stats, clips, devoirs) avec le compte admin du Dashboard, comme la publication Instagram.
import { $ } from './common.js';

export const SB_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
export const SB_KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';
export const SITE = 'gravity-basketball';
const SESSION_KEY = 'artcraft-dashboard-session'; // partagée avec la publication Instagram (social.js)

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function saveSession(s) {
  try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch { /* stockage indisponible */ }
}
export const sessionEmail = () => (loadSession() || {}).email || '';
export const logout = () => saveSession(null);

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

// Formulaire de connexion (ids : <prefix>-login, -email, -password, -login-error, -login-cancel).
function askLogin(prefix) {
  const form = $(`${prefix}-login`);
  form.hidden = false;
  $(`${prefix}-email`).focus();
  return new Promise((resolve, reject) => {
    form.onsubmit = async e => {
      e.preventDefault();
      $(`${prefix}-login-error`).textContent = '';
      try {
        const s = await authRequest('password', { email: $(`${prefix}-email`).value.trim(), password: $(`${prefix}-password`).value });
        $(`${prefix}-password`).value = '';
        form.hidden = true;
        resolve(s.access_token);
      } catch (err) {
        $(`${prefix}-login-error`).textContent = err.message;
      }
    };
    $(`${prefix}-login-cancel`).onclick = () => { form.hidden = true; reject(new Error('Connexion annulée')); };
  });
}

export async function accessToken(prefix) {
  const s = loadSession();
  if (s && s.expires_at > Date.now() + 60e3) return s.access_token;
  if (s && s.refresh_token) {
    try { return (await authRequest('refresh_token', { refresh_token: s.refresh_token })).access_token; } catch { saveSession(null); }
  }
  return askLogin(prefix);
}

async function errorText(res) {
  const j = await res.json().catch(() => ({}));
  return j.message || j.error_description || j.msg || j.error || `Erreur ${res.status}`;
}

// Requête REST (rest/v1). token = jeton admin, ou rien pour une lecture publique.
export async function rest(path, { method = 'GET', body, token, prefer } = {}) {
  const headers = { apikey: SB_KEY, Authorization: `Bearer ${token || SB_KEY}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) throw new Error(await errorText(res));
  return res.status === 204 ? null : res.json().catch(() => null);
}

// Dépôt d'un fichier dans le stockage Supabase (avec progression).
export function uploadFile(bucket, path, blob, token, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SB_URL}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('apikey', SB_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.upload.onprogress = e => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Envoi refusé (${xhr.status}) : ${xhr.responseText.slice(0, 160)}`)));
    xhr.onerror = () => reject(new Error('Envoi interrompu (réseau)'));
    xhr.send(blob);
  });
}

// Équipes et joueurs (lecture publique : équipes actives, joueurs actifs reliés à une équipe).
export async function loadTeams() {
  return rest(`teams?select=id,nom_equipe,categorie,genre&site=eq.${SITE}&active=eq.true&order=display_order.asc`);
}
export async function loadRoster(teamId, token) {
  const rows = await rest(`players?select=id,full_name,numero,poste,age_category,photo_url,auth_user_id&team_id=eq.${teamId}&active=eq.true&order=numero.asc`, { token });
  return (rows || []).map(p => ({ ...p, numero: Number.isFinite(p.numero) ? p.numero : null }));
}
// Matchs de l'équipe (lecture réservée aux admins).
export async function loadGames(teamId, token) {
  return rest(`team_games?select=id,adversaire,date_match,domicile&team_id=eq.${teamId}&order=date_match.desc`, { token });
}

// Remplit un menu déroulant d'équipes ; renvoie la liste.
export async function fillTeams(select) {
  const teams = await loadTeams();
  select.innerHTML = '<option value="">— Choisir l\'équipe —</option>';
  (teams || []).forEach(t => select.appendChild(new Option([t.nom_equipe, t.categorie, t.genre].filter(Boolean).join(' · '), t.id)));
  return teams || [];
}
