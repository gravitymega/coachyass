// Module « Analyse tactique » : images clés extraites dans le navigateur (ffmpeg.wasm),
// analyse par l'IA (fonction coach), rapport écrit, voix off (voix gratuites Piper,
// générées dans le navigateur) et vidéo commentée rendue dans le navigateur.
import {
  $, showError, setProgress, parseLogDuration, getFFmpeg, mountFiles, runWithLog, offerFile, slugify,
} from './common.js';
import {
  sampleTimes, frameArgs, targetWords, createStreamReader, reportText, captionTimes, buildCommentaryArgs,
  SECTIONS, fmtTime,
} from './analyse-core.js';
import { parseTimestamp } from './highlights.js';
import { BRAND } from './brand.js';
import { FREE_VOICES, DEFAULT_FREE_VOICE } from './piper-core.js';
import { speakFree } from './piper.js';

const STORE_KEY = 'artcraft-voice-password'; // nom historique (ancien Studio voix), gardé pour ne pas redemander le mot de passe
const MOUNT = '/an';
const state = { password: '', file: null, input: '', duration: 0, hasAudio: false, analysis: null, start: 0, dur: 0, busy: false };

// ---------- Accès ----------
async function post(fn, payload) {
  return fetch(`/.netlify/functions/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-art-password': state.password },
    body: JSON.stringify(payload),
  });
}

async function errorOf(res) {
  let msg = `Erreur ${res.status}`;
  try { msg = (await res.json()).error || msg; } catch { /* réponse non JSON */ }
  if (res.status === 404) msg = 'Fonction introuvable : le site doit être déployé sur Netlify.';
  return msg;
}

try { state.password = localStorage.getItem(STORE_KEY) || ''; } catch { /* stockage indisponible */ }
if (state.password) $('password').value = state.password;

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  state.password = $('password').value;
  showError('');
  const res = await post('coach', { ping: true }).catch(() => null);
  if (!res) { showError('Serveur injoignable : vérifie ta connexion.'); return; }
  if (res.status === 401) { showError('Mot de passe incorrect.'); return; }
  if (!res.ok) { showError(await errorOf(res)); return; }
  try { localStorage.setItem(STORE_KEY, state.password); } catch { /* stockage indisponible */ }
  if (!(await res.json()).ai) showError('ANTHROPIC_API_KEY manquant dans les variables Netlify du site art-craft : l\'analyse ne marchera pas.');
  $('step-login').hidden = true;
  $('step-video').hidden = false;
});

FREE_VOICES.forEach(v => $('voice').appendChild(new Option(v.name, v.id)));
$('voice').value = DEFAULT_FREE_VOICE;

// ---------- 1. Vidéo ----------
const video = $('video');
$('file').addEventListener('change', e => selectFile(e.target.files[0]));
$('drop').addEventListener('dragover', e => { e.preventDefault(); $('drop').classList.add('over'); });
$('drop').addEventListener('dragleave', () => $('drop').classList.remove('over'));
$('drop').addEventListener('drop', e => { e.preventDefault(); $('drop').classList.remove('over'); selectFile(e.dataTransfer.files[0]); });

function selectFile(file) {
  if (!file || state.busy) return;
  state.file = file;
  state.duration = 0;
  state.input = '';
  if (video.src) URL.revokeObjectURL(video.src);
  video.src = URL.createObjectURL(file);
  $('player-wrap').hidden = false;
  $('file-info').textContent = `${file.name} · ${(file.size / 1e6).toFixed(0)} Mo`;
}
video.addEventListener('loadedmetadata', () => {
  if (Number.isFinite(video.duration)) {
    state.duration = video.duration;
    $('file-info').textContent = `${state.file.name} · ${(state.file.size / 1e6).toFixed(0)} Mo · ${fmtTime(video.duration)}`;
  }
});
$('btn-here').onclick = () => { $('start').value = fmtTime(video.currentTime || 0); };

async function mountInput(ff) {
  [state.input] = await mountFiles(ff, MOUNT, [state.file]);
  // Durée et présence de son lues par ffmpeg (aussi pour les vidéos que le navigateur ne lit pas).
  let audio = false;
  await runWithLog(ff, ['-i', state.input], line => {
    const d = parseLogDuration(line);
    if (d && !state.duration) state.duration = d;
    if (/Stream #.*Audio:/.test(line)) audio = true;
  });
  state.hasAudio = audio;
}

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

$('btn-analyse').onclick = async () => {
  if (!state.file || state.busy) return;
  state.busy = true;
  $('btn-analyse').disabled = true;
  showError('');
  try {
    const ff = await getFFmpeg('analyse-progress');
    await mountInput(ff);
    const start = Math.max(0, parseTimestamp($('start').value) || 0);
    if (state.duration && start >= state.duration - 2) throw new Error('Le début est après la fin de la vidéo.');
    const dur = Math.min(+$('dur').value, (state.duration || Infinity) - start);
    state.start = start;
    state.dur = dur;

    const times = sampleTimes(start, dur);
    const frames = [];
    for (let i = 0; i < times.length; i++) {
      setProgress('analyse-progress', (i / times.length) * 0.3, `Images clés… ${i + 1} / ${times.length}`);
      const code = await ff.exec(frameArgs(state.input, times[i], '/frame.jpg'));
      if (code !== 0) continue;
      const data = await ff.readFile('/frame.jpg');
      await ff.deleteFile('/frame.jpg');
      frames.push({ t: times[i], data: toBase64(data) });
    }
    if (frames.length < 2) throw new Error('Impossible d\'extraire des images de cette vidéo.');

    setProgress('analyse-progress', 0.32, 'Envoi à l\'IA…');
    const res = await post('coach', {
      frames, team: $('team').value.trim(), context: $('context').value.trim(),
      start, dur, words: targetWords(dur),
    });
    if (!res.ok) throw new Error(await errorOf(res));
    const reader = createStreamReader();
    const decoder = new TextDecoder();
    const stream = res.body.getReader();
    for (;;) {
      const { value, done } = await stream.read();
      if (done) break;
      reader.feed(decoder.decode(value, { stream: true }));
      // Le JSON complet fait ~4 000 à 8 000 caractères : progression approximative.
      setProgress('analyse-progress', 0.35 + Math.min(0.6, reader.length / 9000), `L'IA analyse le jeu… ${reader.length} caractères`);
    }
    reader.feed(decoder.decode());
    state.analysis = reader.finish();
    renderReport();
    setProgress('analyse-progress', 1, `Analyse prête · ${frames.length} images étudiées`);
  } catch (err) {
    console.error(err);
    showError('Analyse impossible : ' + (err.message || err));
  } finally {
    state.busy = false;
    $('btn-analyse').disabled = false;
  }
};

// ---------- 2. Rapport ----------
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderReport() {
  const a = state.analysis;
  const box = $('report');
  box.innerHTML = '';
  box.append(el('p', 'resume', a.resume || '—'));
  if (a.systemes.length) {
    box.append(el('h3', '', 'Systèmes repérés'));
    const ul = el('ul');
    a.systemes.forEach(s => {
      const li = el('li');
      li.append(el('b', '', s.nom), document.createTextNode(s.description ? ' : ' + s.description : ''));
      ul.append(li);
    });
    box.append(ul);
  }
  SECTIONS.forEach(([key, label]) => {
    if (!a[key].length) return;
    box.append(el('h3', '', label));
    const ul = el('ul');
    a[key].forEach(x => ul.append(el('li', '', x)));
    box.append(ul);
  });
  if (a.moments.length) {
    box.append(el('h3', '', 'Moments clés'));
    const ul = el('ul', 'moments');
    a.moments.forEach(m => {
      const li = el('li');
      const t = el('button', 'tool', fmtTime(m.t));
      t.type = 'button';
      t.title = 'Voir ce moment';
      t.onclick = () => { video.currentTime = m.t; video.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      li.append(t, ' ', el('b', '', m.titre), document.createTextNode(m.explication ? ' — ' + m.explication : ''));
      ul.append(li);
    });
    box.append(ul);
  }
  const text = currentReport();
  const dl = $('btn-report-dl');
  if (dl.href) URL.revokeObjectURL(dl.href);
  dl.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  dl.download = `analyse-${slugify($('team').value, 'gravity')}-${fmtTime(state.start).replace(/:/g, 'h')}.txt`;
  $('commentary').value = a.commentaire;
  updateCount();
  $('step-report').hidden = false;
  $('step-voice').hidden = false;
  $('step-report').scrollIntoView({ behavior: 'smooth' });
}

const currentReport = () => reportText({ ...state.analysis, commentaire: $('commentary').value.trim() }, {
  title: 'Analyse tactique — ' + BRAND.name, team: $('team').value.trim(), start: state.start, dur: state.dur,
});

$('btn-copy').onclick = async () => {
  try {
    await navigator.clipboard.writeText(currentReport());
    $('btn-copy').textContent = 'Rapport copié ✔';
  } catch {
    $('btn-copy').textContent = 'Copie impossible';
  }
  setTimeout(() => { $('btn-copy').textContent = 'Copier le rapport'; }, 1800);
};
$('btn-print').onclick = () => window.print();

function updateCount() {
  const words = $('commentary').value.trim().split(/\s+/).filter(Boolean).length;
  $('commentary-count').textContent = `${words} mots · environ ${Math.round(words / 2.4)} s de voix off`;
}
$('commentary').addEventListener('input', updateCount);

// ---------- 3. Vidéo commentée ----------
function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  words.forEach(w => {
    const next = cur ? cur + ' ' + w : w;
    if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = w; } else cur = next;
  });
  if (cur) lines.push(cur);
  return lines;
}

// Encadré « moment clé » en bas à gauche, image transparente plein cadre.
async function captionPNG(W, H, m) {
  try { await document.fonts.load(`700 ${Math.round(H * 0.05)}px Oswald`); } catch { /* police de secours */ }
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const pad = Math.round(H * 0.035);
  const maxW = Math.round(W * 0.62);
  const tSize = Math.round(H * 0.048), bSize = Math.round(H * 0.032);
  ctx.font = `600 ${bSize}px Inter, system-ui, sans-serif`;
  const body = wrap(ctx, m.explication, maxW - pad * 2).slice(0, 3);
  ctx.font = `700 ${tSize}px Oswald, Impact, sans-serif`;
  const title = m.titre.toUpperCase();
  const boxW = Math.min(maxW, Math.max(ctx.measureText(title).width + pad * 3, maxW * 0.6));
  const boxH = pad * 2 + tSize * 1.15 + body.length * bSize * 1.3;
  const x = Math.round(W * 0.04), y = Math.round(H - boxH - H * 0.06);
  ctx.fillStyle = 'rgba(13, 11, 18, 0.82)';
  ctx.fillRect(x, y, boxW, boxH);
  const g = ctx.createLinearGradient(x, 0, x + boxW, 0);
  g.addColorStop(0, BRAND.orange);
  g.addColorStop(1, BRAND.magenta);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, Math.round(H * 0.008), boxH);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'top';
  ctx.font = `700 ${tSize}px Oswald, Impact, sans-serif`;
  ctx.fillText(title, x + pad * 1.4, y + pad);
  ctx.font = `600 ${bSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,.9)';
  body.forEach((l, i) => ctx.fillText(l, x + pad * 1.4, y + pad + tSize * 1.15 + i * bSize * 1.3));
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

async function audioDuration(blob) {
  const ac = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 1, 44100);
  const buf = await ac.decodeAudioData(await blob.arrayBuffer());
  return buf.duration;
}

$('btn-render').onclick = async () => {
  if (!state.analysis || state.busy) return;
  const text = $('commentary').value.trim();
  if (!text) { showError('Écris un commentaire pour la voix off.'); return; }
  state.busy = true;
  $('btn-render').disabled = true;
  showError('');
  $('result').hidden = true;
  try {
    const voice = await speakFree(text, $('voice').value, { onProgress: (r, label) => setProgress('render-progress', r * 0.35, label) });
    const voicePath = '/voice.wav';
    const voiceDur = await audioDuration(voice);
    const ff = await getFFmpeg('render-progress');
    await mountInput(ff);
    const [W, H] = $('quality').value === '1080' ? [1920, 1080] : [1280, 720];
    await ff.writeFile(voicePath, new Uint8Array(await voice.arrayBuffer()));
    const caps = $('show-captions').checked ? captionTimes(state.analysis.moments, state.start, state.dur) : [];
    for (let i = 0; i < caps.length; i++) {
      caps[i].path = `/cap${i}.png`;
      await ff.writeFile(caps[i].path, await captionPNG(W, H, caps[i]));
    }
    const { args, total } = buildCommentaryArgs({
      input: state.input, start: state.start, dur: state.dur, voice: voicePath, voiceDur,
      hasAudio: state.hasAudio, captions: caps, width: W, height: H, output: '/commentee.mp4',
    });
    const errors = [];
    const code = await runWithLog(ff, args, line => {
      const m = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
      if (m) {
        const t = +m[1] * 3600 + +m[2] * 60 + +m[3];
        setProgress('render-progress', 0.4 + 0.6 * Math.min(1, t / total), `Montage de la vidéo commentée… ${Math.round(t)} s / ${Math.round(total)} s`);
      }
      if (/error|invalid|failed/i.test(line)) errors.push(line);
    });
    if (code !== 0) throw new Error(errors.slice(-2).join(' · ') || `ffmpeg a échoué (code ${code})`);
    const data = await ff.readFile('/commentee.mp4');
    await ff.deleteFile('/commentee.mp4');
    await ff.deleteFile(voicePath);
    for (const c of caps) await ff.deleteFile(c.path);
    const name = `analyse-${slugify($('team').value, 'gravity')}.mp4`;
    const url = offerFile(new Blob([data], { type: 'video/mp4' }), name, {
      download: 'btn-download', share: 'btn-share', title: 'Analyse tactique ' + BRAND.name, text: state.analysis.resume,
    });
    $('result-video').src = url;
    const vdl = $('btn-voice-dl');
    if (vdl.href) URL.revokeObjectURL(vdl.href);
    vdl.href = URL.createObjectURL(voice);
    vdl.download = name.replace(/\.mp4$/, '-voix.wav');
    $('result').hidden = false;
    setProgress('render-progress', 1, `Vidéo commentée prête · ${Math.round(total)} s · ${(data.length / 1e6).toFixed(1)} Mo`);
  } catch (err) {
    console.error(err);
    showError('Vidéo commentée impossible : ' + (err.message || err));
  } finally {
    state.busy = false;
    $('btn-render').disabled = false;
  }
};
