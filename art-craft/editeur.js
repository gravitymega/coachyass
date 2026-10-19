import {
  $, showError, setProgress, parseLogTime, getFFmpeg, mountFiles, runWithLog, offerFile, loadImage,
} from './common.js';
import { FORMATS, clipOutDuration, timelineDuration, buildEditorArgs } from './editor-core.js';
import { formatTime } from './highlights.js';
import { BRAND, OUTRO, brandCardPNG } from './brand.js';

const MOUNT = '/m';
const state = {
  media: [],      // { id, file, kind, name, url, duration }
  clips: [],      // { id, mediaId, start, dur, speed, text, pos }
  selected: null,
  logo: null,
  busy: false,
};
let nextId = 1;

loadImage('assets/logo.png').then(img => { state.logo = img; }).catch(() => {});

const formatSel = $('format');
Object.entries(FORMATS).forEach(([k, f]) => formatSel.add(new Option(f.label, k)));

const mediaById = id => state.media.find(m => m.id === id);
const kindOf = file => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'video';
};

// ---------- Médias ----------
function readDuration(m) {
  return new Promise(resolve => {
    if (m.kind === 'image') return resolve(4);
    const el = document.createElement(m.kind === 'audio' ? 'audio' : 'video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => resolve(null);
    el.src = m.url;
  });
}

async function probeDuration(m) {
  const ff = await getFFmpeg('render-progress');
  const paths = await mountFiles(ff, MOUNT, state.media.map(x => x.file));
  let d = null;
  await runWithLog(ff, ['-hide_banner', '-i', paths[state.media.indexOf(m)]], line => {
    const r = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(line);
    if (r) d = (+r[1]) * 3600 + (+r[2]) * 60 + (+r[3]);
  });
  $('render-progress').hidden = true;
  return d;
}

async function addFiles(files) {
  showError('');
  for (const raw of files) {
    const id = nextId++;
    // Nom unique dans le système de fichiers ffmpeg (deux IMG_0001.MOV possibles).
    const safe = raw.name.replace(/[^\w.-]+/g, '_');
    const file = new File([raw], `${id}-${safe}`, { type: raw.type });
    const m = { id, file, kind: kindOf(raw), name: raw.name, url: URL.createObjectURL(raw), duration: null };
    state.media.push(m);
    m.duration = await readDuration(m);
    if (m.duration == null) {
      try { m.duration = await probeDuration(m); } catch (err) { console.error(err); }
    }
    if (m.duration == null) {
      showError(`Impossible de lire « ${m.name} ».`);
      state.media = state.media.filter(x => x !== m);
      continue;
    }
    if (m.kind === 'audio' && !$('music').value) {
      renderBin();
      $('music').value = String(m.id);
    } else if (m.kind !== 'audio') {
      addClip(m, false);
    }
  }
  renderBin();
  renderTimeline();
}

$('files').addEventListener('change', e => { addFiles([...e.target.files]); e.target.value = ''; });
const drop = $('drop');
['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, () => drop.classList.remove('over')));
drop.addEventListener('drop', e => { e.preventDefault(); addFiles([...e.dataTransfer.files]); });

function renderBin() {
  const bin = $('bin');
  bin.innerHTML = '';
  const music = $('music');
  const current = music.value;
  music.length = 1;
  state.media.forEach(m => {
    const li = document.createElement('li');
    const icon = { video: '🎬', image: '🖼️', audio: '🎵' }[m.kind];
    li.innerHTML = `<span>${icon}</span><span class="name"></span><small>${m.kind === 'image' ? 'photo' : formatTime(m.duration)}</small>`;
    li.querySelector('.name').textContent = m.name;
    const btn = document.createElement('button');
    btn.textContent = m.kind === 'audio' ? 'Musique' : '+ Timeline';
    btn.onclick = () => {
      if (m.kind === 'audio') { $('music').value = String(m.id); return; }
      addClip(m, true);
    };
    li.appendChild(btn);
    bin.appendChild(li);
    if (m.kind !== 'image') music.add(new Option(m.name, String(m.id)));
  });
  music.value = current;
  const hasClips = state.media.some(m => m.kind !== 'audio');
  $('step-timeline').hidden = !hasClips;
  $('step-export').hidden = !hasClips;
}

// ---------- Timeline ----------
function addClip(m, select) {
  const dur = m.kind === 'image' ? 4 : Math.min(m.duration, 10);
  const clip = { id: nextId++, mediaId: m.id, start: 0, dur, speed: 1, text: '', pos: 'bottom' };
  state.clips.push(clip);
  if (select) state.selected = clip.id;
  renderTimeline();
}

function totalDuration() {
  return timelineDuration(state.clips, $('transition').value);
}

function renderTimeline() {
  const tl = $('timeline');
  tl.innerHTML = '';
  state.clips.forEach((c, i) => {
    const m = mediaById(c.mediaId);
    const li = document.createElement('li');
    li.draggable = true;
    li.className = c.id === state.selected ? 'sel' : '';
    li.style.flexGrow = String(Math.max(1, clipOutDuration(c)));
    li.innerHTML = `<b>${i + 1}</b><span class="name"></span><small>${clipOutDuration(c).toFixed(1)} s${c.speed !== 1 ? ` · ×${c.speed}` : ''}</small>`;
    li.querySelector('.name').textContent = c.text || m.name;
    li.onclick = () => { state.selected = c.id; renderTimeline(); previewClip(c, false); };
    li.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', String(c.id)); });
    li.addEventListener('dragover', e => e.preventDefault());
    li.addEventListener('drop', e => {
      e.preventDefault();
      const from = state.clips.findIndex(x => x.id === +e.dataTransfer.getData('text/plain'));
      const to = state.clips.indexOf(c);
      if (from < 0 || from === to) return;
      const [moved] = state.clips.splice(from, 1);
      state.clips.splice(to, 0, moved);
      renderTimeline();
    });
    tl.appendChild(li);
  });
  $('total').textContent = `${state.clips.length} extrait${state.clips.length > 1 ? 's' : ''} · ${formatTime(totalDuration())}`;
  $('btn-render').disabled = !state.clips.length;
  renderInspector();
  layoutStage();
}

const selectedClip = () => state.clips.find(c => c.id === state.selected);

function renderInspector() {
  const c = selectedClip();
  $('inspector').hidden = !c;
  if (!c) return;
  const m = mediaById(c.mediaId);
  $('insp-name').textContent = m.name;
  const isVideo = m.kind === 'video';
  $('lbl-start').hidden = !isVideo;
  $('lbl-speed').hidden = !isVideo;
  $('insp-start').value = c.start.toFixed(1);
  $('insp-start').max = Math.max(0, m.duration - 0.5).toFixed(1);
  $('insp-dur').value = c.dur.toFixed(1);
  $('insp-speed').value = String(c.speed);
  $('insp-text').value = c.text;
  $('insp-pos').value = c.pos;
}

function clampClip(c) {
  const m = mediaById(c.mediaId);
  if (m.kind === 'image') { c.start = 0; c.dur = Math.min(Math.max(0.5, c.dur), 30); return; }
  c.start = Math.min(Math.max(0, c.start), Math.max(0, m.duration - 0.5));
  c.dur = Math.min(Math.max(0.5, c.dur), m.duration - c.start);
}

[['insp-start', 'start'], ['insp-dur', 'dur'], ['insp-speed', 'speed']].forEach(([id, key]) => {
  $(id).addEventListener('change', e => {
    const c = selectedClip();
    if (!c) return;
    c[key] = +e.target.value || (key === 'speed' ? 1 : 0);
    clampClip(c);
    renderTimeline();
    if (key === 'start') previewClip(c, false);
  });
});
$('insp-text').addEventListener('input', e => {
  const c = selectedClip();
  if (!c) return;
  c.text = e.target.value;
  $('stage-text').textContent = c.text;
  const name = $('timeline').querySelector('li.sel .name');
  if (name) name.textContent = c.text || mediaById(c.mediaId).name;
});
$('insp-pos').addEventListener('change', e => {
  const c = selectedClip();
  if (c) { c.pos = e.target.value; showStageText(c); }
});
$('insp-preview').onclick = () => { const c = selectedClip(); if (c) previewClip(c, true); };
$('insp-left').onclick = () => moveSelected(-1);
$('insp-right').onclick = () => moveSelected(1);
$('insp-dup').onclick = () => {
  const c = selectedClip();
  if (!c) return;
  const copy = { ...c, id: nextId++ };
  state.clips.splice(state.clips.indexOf(c) + 1, 0, copy);
  state.selected = copy.id;
  renderTimeline();
};
$('insp-del').onclick = () => {
  const c = selectedClip();
  if (!c) return;
  state.clips = state.clips.filter(x => x !== c);
  state.selected = null;
  renderTimeline();
};
function moveSelected(delta) {
  const c = selectedClip();
  const i = state.clips.indexOf(c);
  const j = i + delta;
  if (!c || j < 0 || j >= state.clips.length) return;
  [state.clips[i], state.clips[j]] = [state.clips[j], state.clips[i]];
  renderTimeline();
}
$('transition').addEventListener('change', renderTimeline);

// ---------- Aperçu ----------
const stageVideo = $('stage-video');
const stageImg = $('stage-img');
let playQueue = [];
let stopAt = null;
let imgTimer = null;

function layoutStage() {
  const f = FORMATS[$('format').value];
  const stage = $('stage');
  stage.style.aspectRatio = `${f.w} / ${f.h}`;
  const fit = $('fit').value === 'crop' ? 'cover' : 'contain';
  stageVideo.style.objectFit = fit;
  stageImg.style.objectFit = fit;
}
['format', 'fit'].forEach(id => $(id).addEventListener('change', layoutStage));

function showStageText(c) {
  const t = $('stage-text');
  t.textContent = c.text;
  t.dataset.pos = c.pos;
}

function previewClip(c, play) {
  clearTimeout(imgTimer);
  const m = mediaById(c.mediaId);
  showStageText(c);
  if (m.kind === 'image') {
    stageVideo.pause();
    stageVideo.hidden = true;
    stageImg.hidden = false;
    stageImg.src = m.url;
    if (play) imgTimer = setTimeout(nextInQueue, clipOutDuration(c) * 1000);
    return;
  }
  stageImg.hidden = true;
  stageVideo.hidden = false;
  if (stageVideo.dataset.media !== String(m.id)) {
    stageVideo.src = m.url;
    stageVideo.dataset.media = String(m.id);
  }
  stageVideo.currentTime = c.start;
  stageVideo.playbackRate = c.speed;
  stageVideo.muted = false;
  stopAt = play ? c.start + c.dur : null;
  if (play) stageVideo.play().catch(() => {});
  else stageVideo.pause();
}

function nextInQueue() {
  const next = playQueue.shift();
  if (next) previewClip(next, true);
  else { stageVideo.pause(); stopAt = null; }
}

stageVideo.addEventListener('timeupdate', () => {
  if (stopAt != null && stageVideo.currentTime >= stopAt) {
    stopAt = null;
    stageVideo.pause();
    nextInQueue();
  }
});
$('btn-play').onclick = () => {
  playQueue = [...state.clips];
  nextInQueue();
};

// ---------- Export ----------
const TEXT_Y = { top: 0.14, middle: 0.5, bottom: 0.8 };

async function overlayFor(c, W, H) {
  const showLogo = $('show-logo').checked && state.logo;
  if (!c.text && !showLogo) return null;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const base = Math.min(W, H);
  if (c.text) {
    const text = c.text.toUpperCase();
    let size = base * 0.09;
    try { await document.fonts.load(`700 ${Math.round(size)}px Oswald`); } catch { /* police de secours */ }
    ctx.font = `700 ${size}px Oswald, Impact, sans-serif`;
    while (ctx.measureText(text).width > W * 0.88 && size > 10) {
      size -= 2;
      ctx.font = `700 ${size}px Oswald, Impact, sans-serif`;
    }
    const y = H * TEXT_Y[c.pos];
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect((W - tw) / 2 - size * 0.4, y - size * 0.95, tw + size * 0.8, size * 1.35);
    const g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, '#e8672e');
    g.addColorStop(1, '#d81e5b');
    ctx.fillStyle = g;
    ctx.fillRect((W - tw) / 2 - size * 0.4, y + size * 0.4, tw + size * 0.8, size * 0.08);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(text, W / 2, y);
  }
  if (showLogo) {
    const s = base * 0.12;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(state.logo, W - s - base * 0.04, base * 0.04, s, s);
    ctx.globalAlpha = 1;
  }
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

async function hasAudioStream(ff, path) {
  let found = false;
  await runWithLog(ff, ['-hide_banner', '-i', path], line => { if (/Stream #.*Audio:/.test(line)) found = true; });
  return found;
}

$('btn-render').onclick = async () => {
  if (state.busy || !state.clips.length) return;
  state.busy = true;
  $('btn-render').disabled = true;
  $('result').hidden = true;
  showError('');
  const written = [];
  try {
    const ff = await getFFmpeg('render-progress');
    const paths = await mountFiles(ff, MOUNT, state.media.map(m => m.file));
    const pathOf = m => paths[state.media.indexOf(m)];
    const f = FORMATS[$('format').value];
    const q = +$('quality').value;
    const W = Math.round(f.w * q / 2) * 2, H = Math.round(f.h * q / 2) * 2;
    setProgress('render-progress', 0, 'Préparation…');
    const audioCache = new Map();
    const clips = [];
    for (const [i, c] of state.clips.entries()) {
      const m = mediaById(c.mediaId);
      if (m.kind === 'video' && !audioCache.has(m.id)) audioCache.set(m.id, await hasAudioStream(ff, pathOf(m)));
      const png = await overlayFor(c, W, H);
      let overlay = null;
      if (png) {
        overlay = `/ov${i}.png`;
        await ff.writeFile(overlay, png);
        written.push(overlay);
      }
      clips.push({ kind: m.kind, path: pathOf(m), start: c.start, dur: c.dur, speed: c.speed, hasAudio: !!audioCache.get(m.id), overlay });
    }
    // Modèle Gravity : cartes d'intro et d'outro ajoutées autour du montage.
    if ($('brand-intro').checked) {
      await ff.writeFile('/brand-intro.png', await brandCardPNG(W, H, state.logo, {
        kicker: BRAND.name, title: $('brand-title').value.trim(), sub: $('brand-sub').value.trim(), footer: BRAND.site,
      }));
      written.push('/brand-intro.png');
      clips.unshift({ kind: 'image', path: '/brand-intro.png', start: 0, dur: 2.5, speed: 1, hasAudio: false, overlay: null });
    }
    if ($('brand-outro').checked) {
      await ff.writeFile('/brand-outro.png', await brandCardPNG(W, H, state.logo, OUTRO));
      written.push('/brand-outro.png');
      clips.push({ kind: 'image', path: '/brand-outro.png', start: 0, dur: 3, speed: 1, hasAudio: false, overlay: null });
    }
    const musicMedia = mediaById(+$('music').value);
    const total = timelineDuration(clips, $('transition').value);
    const args = buildEditorArgs({
      clips, width: W, height: H, fit: $('fit').value, transition: $('transition').value,
      music: musicMedia ? { path: pathOf(musicMedia), volume: +$('music-vol').value } : null,
      originalVolume: +$('orig-vol').value, output: '/edit.mp4',
    });
    const errors = [];
    const code = await runWithLog(ff, args, line => {
      const t = parseLogTime(line);
      if (t != null) setProgress('render-progress', t / total, `Export… ${Math.round(t)} s / ${Math.round(total)} s`);
      if (/error|invalid|failed/i.test(line)) errors.push(line);
    });
    if (code !== 0) throw new Error(errors.slice(-2).join(' · ') || `ffmpeg a échoué (code ${code})`);
    const data = await ff.readFile('/edit.mp4');
    await ff.deleteFile('/edit.mp4');
    const blob = new Blob([data], { type: 'video/mp4' });
    const url = offerFile(blob, 'art-craft-montage.mp4', { download: 'btn-download', share: 'btn-share', title: 'Gravity Basketball' });
    $('result-video').src = url;
    $('result').hidden = false;
    setProgress('render-progress', 1, `Vidéo prête · ${formatTime(total)} · ${(blob.size / 1e6).toFixed(1)} Mo`);
  } catch (err) {
    console.error(err);
    showError('Export impossible : ' + (err.message || err));
  } finally {
    const ff = await getFFmpeg('render-progress').catch(() => null);
    for (const p of written) { try { await ff.deleteFile(p); } catch { /* rien */ } }
    state.busy = false;
    $('btn-render').disabled = false;
  }
};
