// Module « Analyse tactique » : images clés extraites dans le navigateur (ffmpeg.wasm),
// analyse par l'IA (fonction coach), rapport écrit, voix off (voix gratuites Piper,
// générées dans le navigateur) et vidéo commentée rendue dans le navigateur.
import {
  $, showError, setProgress, parseLogDuration, getFFmpeg, mountFiles, runWithLog, offerFile, slugify,
  keepAwake, readCoachStream,
} from './common.js';
import {
  sampleTimes, trackTimes, frameArgs, createStreamReader, isNetworkError, NETWORK_HINT, thinFrames, waitLabel, reportText, SECTIONS, fmtTime,
  buildBeats, placeVoice, concatList, buildTacticArgs,
} from './analyse-core.js';
import { boardFrames, normalizeTrack } from './board-core.js';
import { drawBoard } from './board.js';
import { parseTimestamp } from './highlights.js';
import { BRAND } from './brand.js';
import { FREE_VOICES, DEFAULT_FREE_VOICE } from './piper-core.js';
import { synthFree } from './piper.js';
import { pcmToWav } from './piper-core.js';

const STORE_KEY = 'artcraft-voice-password'; // nom historique (ancien Studio voix), gardé pour ne pas redemander le mot de passe
const MOUNT = '/an';
const state = { password: '', file: null, youtube: null, input: '', duration: 0, hasAudio: false, analysis: null, start: 0, dur: 0, busy: false };

// ---------- Accès ----------
async function post(fn, payload) {
  return fetch(`/api/${fn}`, {
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
  await login();
});

async function login(auto = false) {
  showError('');
  const res = await post('coach', { ping: true }).catch(() => null);
  if (auto && (!res || !res.ok)) return; // essai silencieux : le formulaire reste affiché
  if (!res) { showError('Serveur injoignable : vérifie ta connexion.'); return; }
  if (res.status === 401) { showError('Mot de passe incorrect.'); return; }
  if (!res.ok) { showError(await errorOf(res)); return; }
  if (state.password) try { localStorage.setItem(STORE_KEY, state.password); } catch { /* stockage indisponible */ }
  if (!(await res.json()).ai) showError('Aucune IA branchée : ajoute la clé gratuite GEMINI_API_KEY dans les variables Cloudflare du site Art craft : l\'analyse ne marchera pas.');
  $('step-login').hidden = true;
  $('step-video').hidden = false;
}
// Accès libre (aucun mot de passe configuré) ou mot de passe déjà mémorisé : on entre directement.
login(true);

FREE_VOICES.forEach(v => $('voice').appendChild(new Option(v.name, v.id)));
$('voice').value = DEFAULT_FREE_VOICE;

// ---------- 1. Vidéo ----------
const video = $('video');
$('file').addEventListener('change', e => selectFile(e.target.files[0]));
$('drop').addEventListener('dragover', e => { e.preventDefault(); $('drop').classList.add('over'); });
$('drop').addEventListener('dragleave', () => $('drop').classList.remove('over'));
$('drop').addEventListener('drop', e => { e.preventDefault(); $('drop').classList.remove('over'); selectFile(e.dataTransfer.files[0]); });

// Lien YouTube (watch, youtu.be, shorts, live) → identifiant de la vidéo.
function youtubeId(raw) {
  const m = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#/].*)?$/.exec(String(raw || '').trim());
  return m ? m[1] : null;
}
const ytEmbed = (id, t = 0, autoplay = false) =>
  `https://www.youtube-nocookie.com/embed/${id}?start=${Math.floor(t)}&playsinline=1&rel=0${autoplay ? '&autoplay=1' : ''}`;

// Deux sources possibles : un fichier (tout le module) ou un lien YouTube (rapport seulement).
function useYoutube(on) {
  video.hidden = on;
  $('yt-wrap').hidden = !on;
  $('btn-here').hidden = on;
  $('track-wrap').hidden = on;
  $('player-wrap').hidden = false;
}

$('yt-form').addEventListener('submit', e => {
  e.preventDefault();
  if (state.busy) return;
  const id = youtubeId($('yt-url').value);
  if (!id) { showError('Lien YouTube non reconnu : colle l\'adresse de la vidéo (youtube.com/watch?v=… ou youtu.be/…).'); return; }
  showError('');
  state.file = null;
  state.youtube = { id, url: `https://www.youtube.com/watch?v=${id}` };
  state.duration = 0;
  if (video.src) { URL.revokeObjectURL(video.src); video.removeAttribute('src'); }
  $('yt-frame').src = ytEmbed(id, parseTimestamp($('start').value) || 0);
  $('file-info').textContent = `Vidéo YouTube · ${state.youtube.url}`;
  useYoutube(true);
});

function selectFile(file) {
  if (!file || state.busy) return;
  state.youtube = null;
  $('yt-frame').removeAttribute('src'); // arrête la vidéo YouTube
  useYoutube(false);
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

// Appel à l'IA (réponse en flux) : renvoie le JSON nettoyé par normalize.
// onTick(caractères reçus, secondes écoulées) fait vivre la barre de progression.
// Connexion coupée : un 2e essai part tout seul, avec moins d'images si `lighter` le permet.
async function askCoach(payload, normalize, onTick, lighter) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await post('coach', payload);
      if (!res.ok) throw new Error(await errorOf(res));
      return await readCoachStream(res, createStreamReader(normalize), onTick);
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      if (attempt >= 1) throw new Error(NETWORK_HINT);
      console.warn('Connexion coupée, nouvel essai', err);
      if (lighter) payload = lighter(payload);
    }
  }
}

async function grabFrames(ff, times, width, onEach) {
  const frames = [];
  for (let i = 0; i < times.length; i++) {
    if (onEach) onEach(i);
    const code = await ff.exec(frameArgs(state.input, times[i], '/frame.jpg', width));
    if (code !== 0) continue;
    const data = await ff.readFile('/frame.jpg');
    await ff.deleteFile('/frame.jpg');
    frames.push({ t: times[i], data: toBase64(data) });
  }
  return frames;
}

// 2e passe : chaque action est suivie image par image (une toutes les 0,5 s), pour que le
// tableau rejoue les vraies positions des joueurs. Une action qui échoue garde son schéma.
async function trackMoments(ff, onProgress) {
  const ms = state.analysis.moments;
  for (let i = 0; i < ms.length; i++) {
    const m = ms[i];
    const label = `Suivi des joueurs · action ${i + 1} / ${ms.length}`;
    try {
      const times = trackTimes(Math.max(state.start, m.debut), Math.min(state.start + state.dur, m.fin));
      const frames = await grabFrames(ff, times, 960, k => onProgress((i + 0.3 * k / times.length) / ms.length, `${label} · image ${k + 1} / ${times.length}`));
      if (frames.length < 2) continue;
      const raw = await askCoach({
        mode: 'track', frames, team: $('team').value.trim(),
        moment: {
          titre: m.titre, explication: m.explication, narration: m.narration, ballon: m.board.ball,
          joueurs: Object.entries(m.board.players).map(([p, [x, y]]) => ({ p, x: +x.toFixed(2), y: +y.toFixed(2) })),
        },
      }, a => a, (n, sec) => onProgress((i + 0.3 + 0.7 * Math.min(1, n ? n / 6000 : sec / 90)) / ms.length, `${label} · l'IA place les joueurs… ${waitLabel(n, sec)}`),
      p => ({ ...p, frames: thinFrames(p.frames, 8) }));
      m.track = normalizeTrack(raw, m.board);
    } catch (err) {
      console.warn('Suivi impossible pour l\'action', i + 1, err);
    }
  }
}

// Lien YouTube : Gemini regarde la vidéo de la séquence choisie (pas d'images à extraire,
// pas de suivi image par image ni de vidéo commentée, faute de fichier).
async function analyseYoutube() {
  const start = Math.max(0, parseTimestamp($('start').value) || 0);
  const dur = +$('dur').value;
  state.start = start;
  state.dur = dur;
  setProgress('analyse-progress', 0.05, 'Envoi du lien à l\'IA… (Gemini regarde la vidéo, compte 1 à 2 minutes)');
  state.analysis = await askCoach({
    youtube: state.youtube.url, team: $('team').value.trim(), context: $('context').value.trim(), start, dur,
  }, undefined, (n, sec) => setProgress('analyse-progress', 0.1 + Math.min(0.85, (n ? n / 9000 : sec / 150) * 0.85), `L'IA regarde la vidéo… ${waitLabel(n, sec)}`));
  renderReport();
  setProgress('analyse-progress', 1, 'Analyse prête · vidéo YouTube regardée par l\'IA');
}

$('btn-analyse').onclick = async () => {
  if ((!state.file && !state.youtube) || state.busy) return;
  if (state.youtube) {
    state.busy = true;
    $('btn-analyse').disabled = true;
    showError('');
    const release = await keepAwake();
    try {
      await analyseYoutube();
    } catch (err) {
      console.error(err);
      showError('Analyse impossible : ' + (err.message || err));
    } finally {
      release();
      state.busy = false;
      $('btn-analyse').disabled = false;
    }
    return;
  }
  state.busy = true;
  $('btn-analyse').disabled = true;
  showError('');
  const release = await keepAwake();
  try {
    const ff = await getFFmpeg('analyse-progress');
    await mountInput(ff);
    const start = Math.max(0, parseTimestamp($('start').value) || 0);
    if (state.duration && start >= state.duration - 2) throw new Error('Le début est après la fin de la vidéo.');
    const dur = Math.min(+$('dur').value, (state.duration || Infinity) - start);
    state.start = start;
    state.dur = dur;

    const times = sampleTimes(start, dur);
    const frames = await grabFrames(ff, times, 640, i => setProgress('analyse-progress', (i / times.length) * 0.3, `Images clés… ${i + 1} / ${times.length}`));
    if (frames.length < 2) throw new Error('Impossible d\'extraire des images de cette vidéo.');

    setProgress('analyse-progress', 0.3, 'Envoi à l\'IA…');
    const track = $('track').checked;
    const end = track ? 0.6 : 0.95;
    state.analysis = await askCoach({
      frames, team: $('team').value.trim(), context: $('context').value.trim(), start, dur,
    }, undefined, (n, sec) => setProgress('analyse-progress', 0.32 + Math.min(end - 0.33, (n ? n / 9000 : sec / 120) * (end - 0.33)), `L'IA analyse le jeu… ${waitLabel(n, sec)}`),
    p => ({ ...p, frames: thinFrames(p.frames, 14) }));
    if (track) await trackMoments(ff, (r, label) => setProgress('analyse-progress', end + (0.99 - end) * r, label));
    renderReport();
    const tracked = state.analysis.moments.filter(m => m.track).length;
    setProgress('analyse-progress', 1, `Analyse prête · ${frames.length} images étudiées${track ? ` · ${tracked} / ${state.analysis.moments.length} actions suivies image par image` : ''}`);
  } catch (err) {
    console.error(err);
    showError('Analyse impossible : ' + (err.message || err));
  } finally {
    release();
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
      t.onclick = () => {
        if (state.youtube) {
          $('yt-frame').src = ytEmbed(state.youtube.id, Math.max(0, m.t - 3), true);
          $('yt-wrap').scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        video.currentTime = m.t;
        video.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };
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
  renderScript();
  $('step-report').hidden = false;
  // La vidéo commentée a besoin du fichier : avec un lien YouTube, seulement le rapport.
  $('step-voice').hidden = Boolean(state.youtube);
  if (state.youtube) box.append(el('p', 'muted', 'Pour la vidéo commentée (ralenti, voix off, tableau du coach), dépose le fichier de cette vidéo à l\'étape 1.'));
  $('step-report').scrollIntoView({ behavior: 'smooth' });
}

const currentReport = () => reportText({ ...state.analysis, commentaire: scriptTexts().filter(Boolean).join(' ') }, {
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

// Script du coach : intro, une voix off par moment clé, conclusion (modifiables).
function renderScript() {
  const a = state.analysis;
  const box = $('script');
  box.innerHTML = '';
  const field = (label, value, rows = 2) => {
    const l = el('label', '', label);
    const t = document.createElement('textarea');
    t.rows = rows;
    t.value = value;
    t.addEventListener('input', updateCount);
    l.append(t);
    box.append(l);
  };
  field('Intro (avant la première action)', a.intro);
  a.moments.forEach((m, i) => field(`Action ${i + 1} · ${fmtTime(m.t)} · ${m.titre} (au ralenti)`, m.narration, 3));
  field('Conclusion (la leçon à retenir)', a.conclusion, 3);
  updateCount();
}

// [intro, moments…, conclusion], dans l'ordre du script.
const scriptTexts = () => [...$('script').querySelectorAll('textarea')].map(t => t.value.trim());

function updateCount() {
  const words = scriptTexts().join(' ').split(/\s+/).filter(Boolean).length;
  $('commentary-count').textContent = `${words} mots · environ ${Math.round(words / 2.4)} s de voix off`;
}

$('audio-mode').addEventListener('change', () => { $('voice-wrap').hidden = $('audio-mode').value === 'original'; });

// ---------- 3. Vidéo commentée ----------
const BOARD_FPS = 10;

// Texte et état du tableau pour chaque passage.
function boardInfo(beat, idx, beats, u) {
  const a = state.analysis;
  const slowTxt = beat.speed < 0.999 ? `RALENTI × ${String(beat.speed).replace('.', ',')}` : 'VITESSE NORMALE';
  const m = beat.moment >= 0 ? a.moments[beat.moment] : null;
  const n = a.moments.length;
  if (beat.kind === 'intro') {
    return {
      tag: `Analyse tactique · ${BRAND.name}`, badge: 'AVANT L\'ACTION',
      title: $('team').value.trim() || 'Séance vidéo', text: scriptTexts()[0] || a.resume,
      board: m && m.board, u: 0, track: m && m.track, s: m && m.track ? m.track[0].t : null,
    };
  }
  if (beat.kind === 'action') {
    const frozen = u >= 1 && beat.freeze > 0.01;
    return {
      tag: `Action ${beat.moment + 1} / ${n} · ${fmtTime(m.t)}`, badge: frozen ? 'IMAGE FIGÉE' : slowTxt, slow: beat.speed < 0.999,
      title: m.titre, text: m.explication, board: m.board, u,
      // Suivi réel : l'instant de la vidéo affiché en haut, pour que les pions suivent l'image.
      track: m.track, s: beat.src[0] + Math.min(1, u) * (beat.src[1] - beat.src[0]),
    };
  }
  if (beat.kind === 'jeu') {
    const next = beats.slice(idx + 1).find(b => b.kind === 'action');
    const nm = next ? a.moments[next.moment] : null;
    return {
      tag: 'Jeu', badge: 'VITESSE NORMALE', title: nm ? 'Prochaine action : ' + nm.titre : 'Le jeu continue',
      text: m ? m.explication : '', board: m && m.board, u: 1, track: m && m.track, s: m && m.track ? m.track[m.track.length - 1].t : null,
    };
  }
  return {
    tag: 'À retenir', badge: 'CONCLUSION', title: 'La leçon du coach',
    text: scriptTexts()[scriptTexts().length - 1] || a.conclusion, board: m && m.board, u: 1,
    track: m && m.track, s: m && m.track ? m.track[m.track.length - 1].t : null,
  };
}

async function writeBoard(ff, beats, W, H, onProgress) {
  try {
    await Promise.all([document.fonts.load(`700 ${Math.round(W * 0.058)}px Oswald`), document.fonts.load(`500 ${Math.round(W * 0.034)}px Inter`)]);
  } catch { /* polices de secours */ }
  const frames = boardFrames(beats, BOARD_FPS);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  try { await ff.createDir('/board'); } catch { /* existe déjà */ }
  const names = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    drawBoard(ctx, W, H, boardInfo(beats[f.beat], f.beat, beats, f.u));
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
    const name = `b${String(i).padStart(5, '0')}.jpg`;
    await ff.writeFile('/board/' + name, new Uint8Array(await blob.arrayBuffer()));
    names.push(name);
    if (i % 10 === 0) onProgress(i / frames.length, `Tableau du coach… ${i + 1} / ${frames.length} images`);
  }
  await ff.writeFile('/board/list.txt', concatList(frames));
  return names;
}

$('btn-render').onclick = async () => {
  if (!state.analysis || state.busy) return;
  const audio = $('audio-mode').value;
  const texts = scriptTexts();
  if (audio !== 'original' && !texts.some(Boolean)) { showError('Écris au moins une phrase pour la voix off.'); return; }
  state.busy = true;
  $('btn-render').disabled = true;
  showError('');
  $('result').hidden = true;
  const ff0 = [];
  try {
    // 1. Voix off, phrase par phrase : sa durée fixe la longueur de chaque ralenti.
    const clips = [];
    let rate = 22050;
    if (audio !== 'original') {
      for (let i = 0; i < texts.length; i++) {
        if (!texts[i]) { clips.push(null); continue; }
        const r = await synthFree(texts[i], $('voice').value, {
          onProgress: (x, label) => setProgress('render-progress', 0.3 * (i + x) / texts.length, `Voix du coach ${i + 1} / ${texts.length} · ${label}`),
        });
        clips.push(r.pcm);
        rate = r.rate;
      }
    }
    const narr = clips.map(c => (c ? c.length / rate : 0));
    const slow = +$('slow').value;
    // « Aucun ralenti » : si le coach parle plus longtemps que l'action, l'image se fige au lieu de ralentir.
    const { beats, total } = buildBeats({
      start: state.start, dur: state.dur, moments: state.analysis.moments, narr, slow, minSlow: slow >= 1 ? 1 : 0.25,
    });
    if (!beats.length) throw new Error('Rien à monter : séquence trop courte.');

    // 2. Images du tableau, synchronisées avec les passages.
    const ff = await getFFmpeg('render-progress');
    await mountInput(ff);
    const [W, H] = $('quality').value === '1080' ? [1080, 1920] : [720, 1280];
    const videoH = Math.round((W * 9) / 16 / 2) * 2;
    const boardH = H - videoH;
    const names = await writeBoard(ff, beats, W, boardH, (r, label) => setProgress('render-progress', 0.3 + 0.1 * r, label));
    ff0.push(...names.map(n => '/board/' + n), '/board/list.txt');

    // 3. Piste de voix off complète.
    let voiceBlob = null;
    if (audio !== 'original') {
      voiceBlob = new Blob([pcmToWav(placeVoice(beats, clips, rate, total), rate)], { type: 'audio/wav' });
      await ff.writeFile('/voice.wav', new Uint8Array(await voiceBlob.arrayBuffer()));
      ff0.push('/voice.wav');
    }

    // 4. Montage : passages ralentis en haut, tableau en bas, son choisi.
    const args = buildTacticArgs({
      input: state.input, beats, total, hasAudio: state.hasAudio, audio, voice: voiceBlob ? '/voice.wav' : null,
      board: '/board/list.txt', width: W, videoH, boardH, output: '/commentee.mp4',
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
    const name = `analyse-${slugify($('team').value, 'gravity')}.mp4`;
    const url = offerFile(new Blob([data], { type: 'video/mp4' }), name, {
      download: 'btn-download', share: 'btn-share', title: 'Analyse tactique ' + BRAND.name, text: state.analysis.resume,
    });
    $('result-video').src = url;
    const vdl = $('btn-voice-dl');
    if (vdl.href) URL.revokeObjectURL(vdl.href);
    vdl.hidden = !voiceBlob;
    if (voiceBlob) {
      vdl.href = URL.createObjectURL(voiceBlob);
      vdl.download = name.replace(/\.mp4$/, '-voix.wav');
    }
    $('result').hidden = false;
    const slowCount = beats.filter(b => b.kind === 'action').length;
    setProgress('render-progress', 1, `Vidéo commentée prête · ${Math.round(total)} s · ${slowCount} action${slowCount > 1 ? "s" : ""} commentée${slowCount > 1 ? "s" : ""} · ${(data.length / 1e6).toFixed(1)} Mo`);
  } catch (err) {
    console.error(err);
    showError('Vidéo commentée impossible : ' + (err.message || err));
  } finally {
    const ff = await getFFmpeg('render-progress').catch(() => null);
    if (ff) for (const f of ff0) await ff.deleteFile(f).catch(() => {});
    state.busy = false;
    $('btn-render').disabled = false;
  }
};
