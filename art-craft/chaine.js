// Page « Ma chaîne » : état du Gardien de chaîne YouTube, titres à revoir, miniatures Gravity, réglages.
// Les corrections automatiques sont faites par le Worker (worker/chaine.ts) ; les titres et les
// miniatures sont envoyés d'ici, avec la connexion Google du propriétaire de la chaîne.
import { $, showError, loadImage } from './common.js';
import { googleToken, setGoogleClientId } from './google-auth.js';
import { BRAND } from './brand.js';
import { brandBlock } from './chaine-core.js';

const SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const API = 'https://www.googleapis.com/youtube/v3';
let state = null;
let logo = null;
let current = null; // vidéo dont on prépare la miniature : { id, title, bg }

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const when = ms => new Date(ms).toLocaleString('fr-CA', { dateStyle: 'medium', timeStyle: 'short' });
const thumbUrl = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

async function token() {
  return (await googleToken(SCOPE, 'YouTube')).value;
}

async function yt(path, init = {}) {
  const t = await token();
  const res = await fetch(path.startsWith('http') ? path : `${API}/${path}`, { ...init, headers: { Authorization: `Bearer ${t}`, ...(init.headers || {}) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason;
    if (reason === 'quotaExceeded') throw new Error('Quota YouTube du jour épuisé : réessaie demain.');
    if (/thumbnail/i.test(path) && res.status === 403) throw new Error('YouTube refuse les miniatures perso tant que la chaîne n\'est pas validée par téléphone (youtube.com/verify).');
    throw new Error((j.error && j.error.message) || `YouTube a répondu ${res.status}`);
  }
  return j;
}

// Action réservée au propriétaire : le Worker vérifie que le jeton Google est celui de la chaîne reliée.
async function owner(body) {
  const t = await token();
  const res = await fetch('/api/chaine/owner', { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `Erreur ${res.status}`);
  return j;
}

async function load() {
  const res = await fetch('/api/chaine/status');
  state = await res.json().catch(() => ({ error: 'Réponse illisible' }));
  if (!res.ok) throw new Error(state.error || `Erreur ${res.status}`);
  setGoogleClientId(state.clientId);
  render();
}

function render() {
  const ch = state.channel;
  $('setup').hidden = state.ready;
  $('btn-connect').hidden = !state.ready || (ch && !ch.broken);
  $('btn-connect').textContent = ch ? 'Reconnecter la chaîne' : 'Relier ma chaîne YouTube';
  $('link-status').innerHTML = !state.ready
    ? 'Pas encore configuré : il manque l\'identifiant Google du Worker (étapes ci-dessous).'
    : !ch ? 'Aucune chaîne reliée. Connecte-toi avec le compte Google de la chaîne Gravity Basketball.'
      : ch.broken ? `⚠️ L'accès à « ${esc(ch.title)} » a été coupé par Google : reconnecte la chaîne.`
        : `<span class="ok-line">✔ « ${esc(ch.title)} » reliée depuis le ${when(ch.since)}.</span>${state.email ? ' Rapport envoyé par courriel après chaque passage.' : ''}`;
  const linked = Boolean(ch);
  ['step-report', 'step-config'].forEach(id => { $(id).hidden = !linked; });
  renderConfig();
  renderReport();
}

function renderReport() {
  const r = state.report;
  if (!r) {
    $('report-summary').textContent = 'Pas encore de passage. Clique « Vérifier maintenant » ou attends le prochain passage automatique.';
    $('report-updated').innerHTML = '';
    $('report-errors').hidden = true;
    $('step-titles').hidden = $('step-thumbs').hidden = true;
    return;
  }
  $('report-summary').innerHTML = `${when(r.at)} · <b>${r.checked}</b> vidéo(s) vérifiée(s) · <b>${r.updated.length}</b> corrigée(s) automatiquement${r.pending ? ` · ${r.pending} au prochain passage` : ''}.`;
  $('report-updated').innerHTML = r.updated.map(v => `<li>✔ ${esc(v.title)} — ${esc(v.fixes.join(', '))}</li>`).join('')
    + (r.hashtags || []).map(v => `<li>⚠️ ${esc(v.title)} — ${esc(v.issue)}</li>`).join('');
  $('report-errors').hidden = !r.errors.length;
  $('report-errors').textContent = r.errors.join(' · ');

  $('step-titles').hidden = !r.titles.length;
  $('titles').innerHTML = r.titles.map(v => `
    <div class="vid" data-id="${v.id}">
      <img src="${thumbUrl(v.id)}" alt="" loading="lazy">
      <div class="grow">
        <b>${esc(v.title)}</b>
        <span class="muted">${esc(v.issues.join(' · '))}</span>
        <input value="${esc(v.suggestion || v.title)}" maxlength="100" aria-label="Nouveau titre">
        <div class="row">
          <button class="btn" data-act="apply" type="button">Appliquer</button>
          <button class="btn ghost" data-act="keep" type="button">Garder tel quel</button>
          <a class="btn ghost" href="https://www.youtube.com/watch?v=${v.id}" target="_blank" rel="noopener">Voir</a>
        </div>
      </div>
    </div>`).join('');

  const todo = r.thumbs.filter(v => !state.thumbs[v.id]);
  $('step-thumbs').hidden = !todo.length && $('thumb-editor').hidden;
  $('thumbs-intro').textContent = todo.length
    ? `${todo.length} vidéo(s) sans miniature Gravity faite ici. « Préparer » : photo de la vidéo + logo et titre aux couleurs Gravity. Si une miniature est déjà la bonne, clique « Déjà bonne ».`
    : 'Toutes les vidéos ont leur miniature Gravity.';
  $('thumbs').innerHTML = todo.slice(0, 30).map(v => `
    <div class="vid" data-id="${v.id}">
      <img src="${thumbUrl(v.id)}" alt="" loading="lazy">
      <div class="grow">
        <b>${esc(v.title)}</b>
        <div class="row">
          <button class="btn" data-act="prep" type="button">Préparer</button>
          <button class="btn ghost" data-act="good" type="button">Déjà bonne</button>
        </div>
      </div>
    </div>`).join('') + (todo.length > 30 ? `<p class="muted">… et ${todo.length - 30} autre(s), après celles-ci.</p>` : '');
}

function renderConfig() {
  const c = state.config;
  $('cfg-enabled').checked = c.enabled;
  $('cfg-footer').value = c.footer;
  $('cfg-tags').value = c.tags.join(', ');
}

// ---------- Titres ----------
$('titles').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const row = btn.closest('.vid');
  const id = row.dataset.id;
  btn.disabled = true;
  try {
    if (btn.dataset.act === 'apply') {
      const title = row.querySelector('input').value.replace(/\s+/g, ' ').trim();
      if (!title) throw new Error('Titre vide.');
      const v = (await yt(`videos?part=snippet&id=${id}`)).items[0];
      if (!v) throw new Error('Vidéo introuvable.');
      const sn = v.snippet;
      const snippet = { title, categoryId: sn.categoryId, description: sn.description };
      ['tags', 'defaultLanguage', 'defaultAudioLanguage'].forEach(k => { if (sn[k]) snippet[k] = sn[k]; });
      await yt('videos?part=snippet', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, snippet }) });
    } else {
      await owner({ ignoreTitle: id });
    }
    state.report.titles = state.report.titles.filter(v => v.id !== id);
    renderReport();
  } catch (err) {
    showError(err.message);
    btn.disabled = false;
  }
});

// ---------- Miniatures ----------
function wrap(ctx, text, maxW, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines.length <= maxLines ? lines : null;
}

async function drawThumb() {
  const cv = $('thumb-canvas');
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  try { await document.fonts.load('700 120px Oswald'); } catch { /* police de secours */ }
  ctx.fillStyle = BRAND.dark;
  ctx.fillRect(0, 0, W, H);
  const bg = current && current.bg;
  if (bg) {
    const s = Math.max(W / bg.width, H / bg.height);
    ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
  }
  // Voile sombre à gauche et en bas pour la lisibilité du titre.
  let g = ctx.createLinearGradient(0, 0, W * 0.75, 0);
  g.addColorStop(0, 'rgba(13,11,18,.92)');
  g.addColorStop(1, 'rgba(13,11,18,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  g = ctx.createLinearGradient(0, H * 0.45, 0, H);
  g.addColorStop(0, 'rgba(13,11,18,0)');
  g.addColorStop(1, 'rgba(13,11,18,.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, BRAND.orange);
  grad.addColorStop(1, BRAND.magenta);
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - 18, W, 18);

  // Étiquette.
  const kicker = $('thumb-kicker').value.trim().toUpperCase();
  let y = 120;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if (kicker) {
    ctx.font = '700 34px Inter, sans-serif';
    const kw = ctx.measureText(kicker).width;
    ctx.fillStyle = grad;
    ctx.fillRect(64, y - 40, kw + 40, 56);
    ctx.fillStyle = '#fff';
    ctx.fillText(kicker, 84, y);
    y += 40;
  }
  // Titre : le plus gros possible sur 3 lignes, dans les 2/3 gauches.
  const title = $('thumb-title').value.trim().toUpperCase();
  let size = 150, lines = null;
  while (size > 50) {
    ctx.font = `700 ${size}px Oswald, Impact, sans-serif`;
    lines = wrap(ctx, title, W * 0.66, 3);
    if (lines && lines.length * size * 1.02 <= H - y - 70) break;
    size -= 6;
  }
  lines = lines || [title];
  ctx.fillStyle = '#fff';
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 18;
  lines.forEach((l, i) => ctx.fillText(l, 64, y + size * 0.95 + i * size * 1.02));
  ctx.shadowBlur = 0;
  // Logo en haut à droite.
  if (logo) {
    const L = 170;
    ctx.drawImage(logo, W - L - 48, 40, L, L);
  }
}

const thumbBlob = () => new Promise(r => $('thumb-canvas').toBlob(r, 'image/jpeg', 0.9));

async function prep(v) {
  current = { id: v.id, title: v.title, bg: null };
  $('thumb-editor').hidden = false;
  $('thumb-status').textContent = 'Chargement de l\'image de la vidéo…';
  $('thumb-title').value = v.title.replace(/\s*[|–—-]\s*Gravity Basketball\s*$/i, '').slice(0, 60);
  try { current.bg = await loadImage(`/api/chaine/frame?id=${v.id}`); } catch { /* fond uni */ }
  $('thumb-status').textContent = current.bg ? '' : 'Image de la vidéo indisponible : choisis une image de fond.';
  await drawThumb();
  $('thumb-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('thumbs').addEventListener('click', async e => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('.vid').dataset.id;
  const v = state.report.thumbs.find(t => t.id === id);
  if (btn.dataset.act === 'prep') return prep(v);
  btn.disabled = true;
  try {
    await owner({ thumb: id });
    state.thumbs[id] = Date.now();
    renderReport();
  } catch (err) {
    showError(err.message);
    btn.disabled = false;
  }
});

['thumb-title', 'thumb-kicker'].forEach(id => $(id).addEventListener('input', drawThumb));
$('thumb-file').addEventListener('change', async () => {
  const f = $('thumb-file').files[0];
  if (!f || !current) return;
  current.bg = await loadImage(URL.createObjectURL(f));
  drawThumb();
});
$('thumb-close').addEventListener('click', () => { $('thumb-editor').hidden = true; current = null; renderReport(); });
$('thumb-download').addEventListener('click', async () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await thumbBlob());
  a.download = `miniature-${current ? current.id : 'gravity'}.jpg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10e3);
});
$('thumb-send').addEventListener('click', async () => {
  if (!current) return;
  const btn = $('thumb-send');
  btn.disabled = true;
  $('thumb-status').textContent = 'Envoi sur YouTube…';
  try {
    const blob = await thumbBlob();
    await yt(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${current.id}&uploadType=media`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
    await owner({ thumb: current.id });
    state.thumbs[current.id] = Date.now();
    $('thumb-status').textContent = '✔ Miniature en ligne (YouTube peut mettre quelques minutes à l\'afficher).';
    $('thumb-editor').hidden = true;
    current = null;
    renderReport();
  } catch (err) {
    $('thumb-status').textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});

// ---------- Passage manuel et réglages ----------
$('btn-run').addEventListener('click', async () => {
  const btn = $('btn-run');
  btn.disabled = true;
  btn.textContent = 'Vérification…';
  try {
    const res = await fetch('/api/chaine/run', { method: 'POST' });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error || `Erreur ${res.status}`);
    state.report = j;
    renderReport();
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Vérifier maintenant';
  }
});

$('cfg-save').addEventListener('click', async () => {
  const btn = $('cfg-save');
  btn.disabled = true;
  try {
    const r = await owner({ config: { enabled: $('cfg-enabled').checked, footer: $('cfg-footer').value, tags: $('cfg-tags').value.split(',') } });
    state.config = r.config;
    renderConfig();
    $('cfg-status').textContent = '✔ Enregistré. Bloc ajouté aux descriptions :\n' + brandBlock(r.config);
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
  }
});

const msg = new URLSearchParams(location.search).get('msg');
if (msg) {
  $('msg').textContent = msg;
  $('msg').hidden = false;
  history.replaceState(null, '', location.pathname);
}
loadImage('assets/logo.png').then(img => { logo = img; }).catch(() => {});
load().catch(err => {
  $('link-status').textContent = 'Gardien indisponible : ' + err.message;
});
