// « Stats auto », étape 4 : highlight vertical de chaque joueur et page du match à partager
// (lien public sans compte, pour les parents). Tout le montage se fait dans le navigateur
// (WebCodecs, sinon ffmpeg.wasm) ; les fichiers de la page vont dans le bucket public
// « match-pages » de Supabase (gratuit), dépôt réservé aux admins du Dashboard.
import { $, setProgress, runWithLog, parseLogTime, getFFmpeg } from './common.js';
import { buildRenderArgs } from './highlights.js';
import { renderShortFast, fastRenderAvailable } from './fast-render.js';
import { BRAND, OUTRO, brandCardPNG } from './brand.js';
import { EVENT_TYPES, CLIP_TYPES, boxScore, clipWindow, clipPlayers, fmtClock } from './stats-core.js';
import { reelClips, reelDuration, statLine, matchPageData, pageId } from './match-core.js';
import { accessToken, uploadFile, removeFiles } from './supa.js';

const BUCKET = 'match-pages';
const PAGE_BASE = 'https://gravity.osmm-mtl.site/match.html?id=';
const PAGES_KEY = 'artcraft-match-pages';
const REEL_KBPS = 1800; // ~14 Mo pour 1 min en 720p : la page reste légère sur cellulaire
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let ctx = null; // { state, mountInput, meta() }
const reels = new Map(); // numero → { blob, url, dur }
let logo = null;

export function initShare(c) {
  ctx = c;
  const img = new Image();
  img.src = 'assets/logo.png';
  img.onload = () => { logo = img; };
  $('reel-list').addEventListener('change', updateReelSummary);
  $('btn-reels').addEventListener('click', () => guarded(() => buildReels()));
  $('btn-publish').addEventListener('click', () => guarded(() => publishPage()));
  $('btn-copy-link').addEventListener('click', copyLink);
  $('pages-list').addEventListener('click', e => {
    const b = e.target.closest('button[data-del]');
    if (b) guarded(() => deletePage(b.dataset.del));
  });
  renderPages();
}

async function guarded(fn) {
  const { state } = ctx;
  if (state.busy) return;
  state.busy = true;
  ctx.showError('');
  try {
    await fn();
  } catch (err) {
    console.error(err);
    ctx.showError(err.message || String(err));
  } finally {
    state.busy = false;
  }
}

// ---------- Liste des joueurs ----------
function playersWithReel() {
  const { state } = ctx;
  const m = ctx.meta();
  const box = boxScore(state.events, m.roster);
  return box.rows.filter(r => r.events && r.numero != null).map(r => {
    const clips = reelClips(state.events, r.numero, { duration: state.duration || Infinity });
    return { r, clips, dur: reelDuration(clips) };
  }).filter(p => p.clips.length);
}

export function renderShare() {
  if (!ctx) return;
  const list = playersWithReel();
  const prev = new Set([...$('reel-list').querySelectorAll('input:not(:checked)')].map(i => +i.value));
  $('reel-list').innerHTML = list.map(({ r, clips, dur }) => {
    const done = reels.get(r.numero);
    return `<li><label class="check"><input type="checkbox" value="${r.numero}" ${prev.has(r.numero) ? '' : 'checked'}>
      <span class="name">#${r.numero} ${esc(r.player ? r.player.full_name : '')} · ${clips.length} action${clips.length > 1 ? 's' : ''} · ${Math.round(dur)} s</span></label>
      ${done ? `<a class="tool" href="${done.url}" download="highlight-${r.numero}.mp4">⬇ ${(done.blob.size / 1e6).toFixed(1)} Mo</a>` : ''}</li>`;
  }).join('') || '<li class="muted">Aucun joueur de notre équipe avec un panier, un contre, une interception, une passe ou un rebond.</li>';
  updateReelSummary();
  renderReelPreviews();
}

function selectedNumbers() {
  return [...$('reel-list').querySelectorAll('input:checked')].map(i => +i.value);
}

function updateReelSummary() {
  const sel = new Set(selectedNumbers());
  const list = playersWithReel().filter(p => sel.has(p.r.numero));
  const total = list.reduce((s, p) => s + p.dur + 3, 0);
  $('reel-info').textContent = list.length
    ? `${list.length} highlight${list.length > 1 ? 's' : ''} · ${Math.round(total)} s de vidéo à monter${fastRenderAvailable() ? ' (montage rapide par la carte graphique)' : ' (moteur ffmpeg : compter environ le double de la durée)'}.`
    : '';
}

function renderReelPreviews() {
  const names = new Map(playersWithReel().map(p => [p.r.numero, p.r.player ? p.r.player.full_name : '']));
  $('reel-previews').innerHTML = [...reels.entries()].map(([n, x]) =>
    `<figure class="reel-fig"><video src="${x.url}" controls playsinline preload="metadata"></video><figcaption>#${n} ${esc(names.get(n) || '')}</figcaption></figure>`).join('');
  $('reel-previews').hidden = !reels.size;
}

// ---------- Habillage du highlight ----------
function drawReelOverlay(c, W, H, { numero, name, line, sub }) {
  const g = c.createLinearGradient(0, 0, 0, H * 0.26);
  g.addColorStop(0, 'rgba(0,0,0,.78)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H * 0.26);
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.shadowColor = 'rgba(0,0,0,.6)';
  c.shadowBlur = W * 0.01;
  const title = `#${numero}${name ? ' ' + name.toUpperCase() : ''}`;
  let size = W * 0.095;
  c.font = `700 ${size}px Oswald, Impact, sans-serif`;
  while (c.measureText(title).width > W * 0.9 && size > 10) { size -= 2; c.font = `700 ${size}px Oswald, Impact, sans-serif`; }
  c.fillStyle = '#fff';
  c.fillText(title, W / 2, H * 0.095);
  c.font = `700 ${W * 0.05}px Oswald, Impact, sans-serif`;
  c.fillStyle = BRAND.orange;
  c.fillText(line, W / 2, H * 0.095 + W * 0.075);
  if (sub) {
    c.font = `600 ${W * 0.034}px Inter, sans-serif`;
    c.fillStyle = 'rgba(255,255,255,.85)';
    c.fillText(sub, W / 2, H * 0.095 + W * 0.13);
  }
  c.shadowBlur = 0;
  if (logo) {
    const s = W * 0.14;
    c.globalAlpha = 0.9;
    c.drawImage(logo, W / 2 - s / 2, H * 0.83, s, s);
    c.globalAlpha = 1;
  }
}

async function overlayFor(W, H, info) {
  try { await document.fonts.load(`700 ${Math.round(W * 0.095)}px Oswald`); } catch { /* police de secours */ }
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  drawReelOverlay(cv.getContext('2d'), W, H, info);
  return cv;
}

const canvasPNG = async cv => new Uint8Array(await (await new Promise(res => cv.toBlob(res, 'image/png'))).arrayBuffer());

async function renderOne(p, { W, H, onProgress }) {
  const { state } = ctx;
  const m = ctx.meta();
  const info = {
    numero: p.r.numero,
    name: p.r.player ? p.r.player.full_name.split(' ')[0] : '',
    line: statLine(p.r),
    sub: [m.opponent && `vs ${m.opponent}`, m.date].filter(Boolean).join(' · '),
  };
  const overlay = await overlayFor(W, H, info);
  const total = p.dur + 3;
  if (fastRenderAvailable()) {
    try {
      const outro = { image: await createImageBitmap(new Blob([await brandCardPNG(W, H, logo, OUTRO)], { type: 'image/png' })), dur: 3 };
      return await renderShortFast({
        file: state.file, clips: p.clips.map(c => ({ start: c.start, dur: c.dur })), layout: 'full', width: W, height: H,
        overlay, outro, maxKbps: REEL_KBPS, onProgress: r => onProgress(r),
      });
    } catch (err) {
      console.warn('Rendu rapide impossible, passage à ffmpeg :', err);
    }
  }
  const ff = await getFFmpeg('share-progress');
  await ctx.mountInput(ff);
  await ff.writeFile('/reel-ov.png', await canvasPNG(overlay));
  await ff.writeFile('/reel-out.png', await brandCardPNG(W, H, logo, OUTRO));
  const args = buildRenderArgs({
    input: state.input, clips: p.clips, hasAudio: state.hasAudio, layout: 'full', width: W, height: H,
    overlay: '/reel-ov.png', outro: { path: '/reel-out.png', dur: 3 }, maxKbps: REEL_KBPS, output: '/reel.mp4',
  });
  const errors = [];
  const code = await runWithLog(ff, args, line => {
    const t = parseLogTime(line);
    if (t != null) onProgress(t / total);
    if (/error|invalid|failed/i.test(line)) errors.push(line);
  });
  await ff.deleteFile('/reel-ov.png').catch(() => {});
  await ff.deleteFile('/reel-out.png').catch(() => {});
  if (code !== 0) throw new Error(errors.slice(-2).join(' · ') || `ffmpeg a échoué (code ${code})`);
  const data = await ff.readFile('/reel.mp4');
  await ff.deleteFile('/reel.mp4');
  return new Blob([data], { type: 'video/mp4' });
}

/** Monte le highlight des joueurs cochés (ou de `only`). Renvoie le nombre de highlights faits. */
export async function buildReels({ only = null } = {}) {
  const { state } = ctx;
  if (!state.file) throw new Error('dépose d\'abord la vidéo du match.');
  const want = new Set(only || selectedNumbers());
  const list = playersWithReel().filter(p => want.has(p.r.numero));
  if (!list.length) throw new Error('aucun joueur choisi pour un highlight.');
  const [W, H] = $('reel-quality').value === '1080' ? [1080, 1920] : [720, 1280];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const label = `Highlight de #${p.r.numero} · ${i + 1} / ${list.length}`;
    setProgress('share-progress', i / list.length, label + '…');
    const blob = await renderOne(p, { W, H, onProgress: r => setProgress('share-progress', (i + Math.min(1, r)) / list.length, `${label} · ${Math.round(Math.min(1, r) * 100)} %`) });
    const old = reels.get(p.r.numero);
    if (old) URL.revokeObjectURL(old.url);
    reels.set(p.r.numero, { blob, url: URL.createObjectURL(blob), dur: p.dur + 3 });
    renderShare();
  }
  setProgress('share-progress', 1, `${list.length} highlight${list.length > 1 ? 's' : ''} prêt${list.length > 1 ? 's' : ''} : télécharge-les ou publie la page du match.`);
  return list.length;
}

// ---------- Page du match ----------
async function cutPageClip(ff, ev) {
  const { state } = ctx;
  const { start, dur } = clipWindow(ev, state.duration || Infinity);
  const code = await ff.exec(['-ss', start.toFixed(2), '-t', dur.toFixed(2), '-i', state.input,
    '-map', '0:v:0', '-map', '0:a:0?', '-vf', "scale='min(854,iw)':-2", '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', '/pclip.mp4']);
  if (code !== 0) throw new Error('découpe du clip impossible');
  const data = await ff.readFile('/pclip.mp4');
  await ff.deleteFile('/pclip.mp4');
  return new Blob([data], { type: 'video/mp4' });
}

function loadPages() {
  try { return JSON.parse(localStorage.getItem(PAGES_KEY) || '[]'); } catch { return []; }
}
function savePages(list) {
  try { localStorage.setItem(PAGES_KEY, JSON.stringify(list.slice(0, 50))); } catch { /* stockage indisponible */ }
}

function renderPages() {
  const list = loadPages();
  $('pages-list').innerHTML = list.map(p => `<li><span class="name"><a href="${PAGE_BASE}${esc(p.id)}" target="_blank" rel="noopener">${esc(p.title)}</a></span>
    <small>${esc(p.created.slice(0, 10))} · ${(p.bytes / 1e6).toFixed(0)} Mo</small><button type="button" data-del="${esc(p.id)}">Supprimer</button></li>`).join('');
  $('pages-wrap').hidden = !list.length;
}

async function copyLink() {
  const url = $('page-link').href;
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ title: $('page-link').textContent, url });
    else { await navigator.clipboard.writeText(url); $('btn-copy-link').textContent = 'Lien copié ✓'; }
  } catch { /* partage annulé */ }
}

const bucketHint = err => (/bucket|not found|row-level|policy|403|404/i.test(err.message)
  ? new Error(`${err.message}. Le stockage des pages de match n'est peut-être pas encore créé : colle le fichier gravity-admin-dashboard/match_pages.sql dans Supabase → SQL Editor → Run, puis réessaie.`)
  : err);

/** Publie la page du match. Renvoie son adresse. */
export async function publishPage() {
  const { state } = ctx;
  if (!state.events.length) throw new Error('aucune action : lance d\'abord « Trouver les actions ».');
  const token = await accessToken('share');
  const m = ctx.meta();
  const id = pageId();
  const withReels = $('page-reels').checked;
  const withClips = $('page-clips').checked;
  if (withReels) {
    const missing = selectedNumbers().filter(n => !reels.has(n));
    if (missing.length) await buildReels({ only: missing });
  }
  const files = [];
  let bytes = 0;
  const put = async (path, blob, label, from, span) => {
    try {
      await uploadFile(BUCKET, `${id}/${path}`, blob, token, r => setProgress('share-progress', from + span * r, label));
    } catch (err) { throw bucketHint(err); }
    files.push(`${id}/${path}`);
    bytes += blob.size;
  };
  try {
    const reelInfo = new Map();
    if (withReels) {
      const list = [...reels.entries()].filter(([n]) => selectedNumbers().includes(n));
      for (let i = 0; i < list.length; i++) {
        const [n, x] = list[i];
        await put(`reels/${n}.mp4`, x.blob, `Envoi du highlight de #${n} (${i + 1} / ${list.length})…`, 0.05 + 0.4 * i / list.length, 0.4 / list.length);
        reelInfo.set(n, { file: `reels/${n}.mp4`, dur: Math.round(x.dur) });
      }
    }
    const clipRows = [];
    if (withClips) {
      const evs = state.events.filter(e => e.equipe === 'nous' && CLIP_TYPES.includes(e.type) && !['tir_rate_2', 'tir_rate_3', 'perte'].includes(e.type));
      if (evs.length) {
        const ff = await getFFmpeg('share-progress');
        await ctx.mountInput(ff);
        for (let i = 0; i < evs.length; i++) {
          const e = evs[i];
          const from = 0.45 + 0.5 * i / evs.length;
          setProgress('share-progress', from, `Clips de la page · ${i + 1} / ${evs.length} (${EVENT_TYPES[e.type].label}, ${fmtClock(e.t)})`);
          const blob = await cutPageClip(ff, e);
          const path = `clips/${i + 1}.mp4`;
          await put(path, blob, `Clips de la page · ${i + 1} / ${evs.length}`, from, 0.5 / evs.length);
          clipRows.push({ t: e.t, type: e.type, numeros: clipPlayers(e, state.events), file: path });
        }
      }
    }
    const data = matchPageData({
      events: state.events, roster: m.roster, team: m.team, opponent: m.opponent, date: m.date,
      privacy: $('page-privacy').value, clips: clipRows, reels: reelInfo,
    });
    await put('data.json', new Blob([JSON.stringify(data)], { type: 'application/json' }), 'Envoi de la feuille de match…', 0.96, 0.04);
  } catch (err) {
    // Page à moitié envoyée : on efface ce qui est parti pour ne rien laisser traîner.
    if (files.length) await removeFiles(BUCKET, files, token).catch(() => {});
    throw err;
  }
  const url = PAGE_BASE + id;
  const title = `${m.team} ${boxScore(state.events, m.roster).score.nous}–${boxScore(state.events, m.roster).score.adversaire} ${m.opponent || 'Adversaire'}${m.date ? ' · ' + m.date : ''}`;
  savePages([{ id, title, created: new Date().toISOString(), bytes, files }, ...loadPages()]);
  renderPages();
  $('page-link').href = url;
  $('page-link').textContent = title;
  $('btn-copy-link').textContent = navigator.share && matchMedia('(pointer: coarse)').matches ? 'Partager le lien' : 'Copier le lien';
  $('page-result').hidden = false;
  setProgress('share-progress', 1, `Page du match en ligne (${(bytes / 1e6).toFixed(0)} Mo) : envoie le lien aux parents.`);
  return url;
}

async function deletePage(id) {
  const page = loadPages().find(p => p.id === id);
  if (!page || !confirm(`Supprimer la page « ${page.title} » ? Le lien ne marchera plus pour personne.`)) return;
  const token = await accessToken('share');
  await removeFiles(BUCKET, page.files, token);
  savePages(loadPages().filter(p => p.id !== id));
  renderPages();
}
