// Détection des temps forts d'une game à partir du son.
// Un panier, un contre ou un buzzer se repèrent à la réaction de la salle :
// le niveau sonore monte nettement au-dessus de l'ambiance des secondes autour.
// Module pur (aucun accès au DOM) : testable avec Node.

export const WINDOW_S = 0.25;

// Niveau sonore (dB) par fenêtre de WINDOW_S, à partir d'un PCM 16 bits mono.
export function energyEnvelope(samples, sampleRate, windowS = WINDOW_S) {
  const n = Math.max(1, Math.round(sampleRate * windowS));
  const count = Math.floor(samples.length / n);
  const env = new Float32Array(count);
  for (let w = 0; w < count; w++) {
    let sum = 0;
    const off = w * n;
    for (let i = 0; i < n; i++) {
      const s = samples[off + i] / 32768;
      sum += s * s;
    }
    env[w] = 10 * Math.log10(sum / n + 1e-10);
  }
  return env;
}

function movingAverage(arr, radius) {
  const prefix = new Float64Array(arr.length + 1);
  for (let i = 0; i < arr.length; i++) prefix[i + 1] = prefix[i] + arr[i];
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    const a = Math.max(0, i - radius);
    const b = Math.min(arr.length, i + radius + 1);
    out[i] = (prefix[b] - prefix[a]) / (b - a);
  }
  return out;
}

// Score d'excitation : niveau lissé sur ~1 s moins l'ambiance locale (~40 s).
// Un score de 6 = la salle est 6 dB plus forte que d'habitude à ce moment-là.
export function excitementScore(env, windowS = WINDOW_S) {
  const short = movingAverage(env, Math.round(0.6 / windowS));
  const base = movingAverage(env, Math.round(20 / windowS));
  const score = new Float32Array(env.length);
  for (let i = 0; i < env.length; i++) score[i] = short[i] - base[i];
  return score;
}

// Pics les plus forts, espacés d'au moins minGapS secondes.
export function findPeaks(score, windowS = WINDOW_S, { minGapS = 12, maxCount = 40, minScore = 1.5 } = {}) {
  const order = Array.from(score.keys()).sort((a, b) => score[b] - score[a]);
  const peaks = [];
  for (const i of order) {
    if (score[i] < minScore || peaks.length >= maxCount) break;
    const t = i * windowS;
    if (peaks.every(p => Math.abs(p.t - t) >= minGapS)) peaks.push({ t, score: score[i] });
  }
  return peaks;
}

// Transforme les pics en extraits : l'action se passe avant la réaction de la salle.
// Les meilleurs pics sont présélectionnés jusqu'à remplir targetS secondes.
export function buildClips(peaks, { duration, targetS = 60, before = 6, after = 2 } = {}) {
  let total = 0;
  const clips = peaks.map((p, rank) => {
    const start = Math.max(0, p.t - before);
    const end = duration ? Math.min(duration, p.t + after) : p.t + after;
    const dur = Math.max(1, end - start);
    const on = total + dur <= targetS + 1;
    if (on) total += dur;
    return { t: p.t, score: p.score, rank, start, dur, on };
  });
  return clips.sort((a, b) => a.start - b.start);
}

// "3:12", "1:02:30" ou "95" → secondes. Retourne null si illisible.
export function parseTimestamp(text) {
  const parts = String(text).trim().split(':').map(Number);
  if (!parts.length || parts.some(n => !Number.isFinite(n) || n < 0)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function formatTime(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? h + ':' : '') + mm + ':' + String(sec).padStart(2, '0');
}

// Arguments ffmpeg du rendu final : un seul encodage pour tous les extraits.
// zoom = taille de travail (zoomSize) ; chaque extrait peut avoir c.zoom = { max, hx, hy, t0, t1 }.
// maxKbps : plafond de débit vidéo (garde le fichier publiable : stockage et réseaux sociaux).
export function buildRenderArgs({ input, clips, hasAudio, layout, width, height, overlay, outro = null, zoom = null, maxKbps = null, output }) {
  const args = [];
  clips.forEach(c => args.push('-ss', c.start.toFixed(2), '-t', c.dur.toFixed(2), '-i', input));
  if (overlay) args.push('-i', overlay);
  // Carte de fin (modèle Gravity) : image fixe ajoutée après les extraits.
  const outroIn = clips.length + (overlay ? 1 : 0);
  if (outro) args.push('-loop', '1', '-framerate', '30', '-t', outro.dur.toFixed(2), '-i', outro.path);
  const W = width, H = height;
  const parts = [];
  const concatIn = [];
  clips.forEach((c, i) => {
    const fadeOut = Math.max(0, c.dur - 0.2).toFixed(2);
    let src = `${i}:v`;
    if (c.zoom && zoom) {
      parts.push(`[${src}]${zoomFilter(c.zoom, zoom)}[z${i}]`);
      src = `z${i}`;
    }
    if (layout === 'crop') {
      const x = Math.min(1, Math.max(0, c.cropX ?? 0.5)).toFixed(3);
      parts.push(`[${src}]scale=-2:${H},crop=${W}:${H}:(iw-ow)*${x}:0,setsar=1,fps=30,format=yuv420p,fade=t=in:d=0.15[v${i}]`);
    } else {
      // Plein cadre : la vidéo entière au centre, fond flou de la même image.
      parts.push(`[${src}]split[b${i}][f${i}]`);
      parts.push(`[b${i}]scale=${W / 8}:${H / 8}:force_original_aspect_ratio=increase,crop=${W / 8}:${H / 8},boxblur=6:2,scale=${W}:${H},eq=brightness=-0.12[bg${i}]`);
      parts.push(`[f${i}]scale=${W}:-2[fg${i}]`);
      parts.push(`[bg${i}][fg${i}]overlay=(W-w)/2:(H-h)/2,setsar=1,fps=30,format=yuv420p,fade=t=in:d=0.15[v${i}]`);
    }
    concatIn.push(`[v${i}]`);
    if (hasAudio) {
      parts.push(`[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,afade=t=in:d=0.1,afade=t=out:st=${fadeOut}:d=0.2[a${i}]`);
      concatIn.push(`[a${i}]`);
    }
  });
  const n = clips.length;
  parts.push(`${concatIn.join('')}concat=n=${n}:v=1:a=${hasAudio ? 1 : 0}[cv]${hasAudio ? '[ca]' : ''}`);
  const main = outro ? 'mv' : 'outv';
  if (overlay) parts.push(`[cv][${n}:v]overlay=0:0,format=yuv420p[${main}]`);
  else parts.push(`[cv]null[${main}]`);
  let audioOut = 'ca';
  if (outro) {
    parts.push(`[${outroIn}:v]scale=${W}:${H},setsar=1,fps=30,format=yuv420p,fade=t=in:d=0.3[ov]`);
    if (hasAudio) {
      parts.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${outro.dur.toFixed(2)},aformat=sample_fmts=fltp:channel_layouts=stereo[oa]`);
      parts.push('[mv][ca][ov][oa]concat=n=2:v=1:a=1[outv][outa]');
      audioOut = 'outa';
    } else {
      parts.push('[mv][ov]concat=n=2:v=1:a=0[outv]');
    }
  }
  args.push('-filter_complex', parts.join(';'), '-map', '[outv]');
  if (hasAudio) args.push('-map', `[${audioOut}]`, '-c:a', 'aac', '-b:a', '128k');
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23');
  if (maxKbps) args.push('-maxrate', `${Math.round(maxKbps)}k`, '-bufsize', `${Math.round(maxKbps * 2)}k`);
  args.push('-pix_fmt', 'yuv420p', '-movflags', '+faststart', output);
  return args;
}

// ---------- Paniers marqués (caméra fixe) ----------
// L'utilisateur montre le cercle sur une image. Autour de chaque moment fort repéré
// au son, on mesure le mouvement dans une petite zone autour du cercle et du filet :
// un ballon qui traverse le filet y crée un pic de mouvement bref et net.

export const NET_FPS = 15;
export const NET_SIZE = 16;

// Zone d'analyse (coordonnées 0 à 1) : le cercle et le filet qui pend dessous.
export function hoopBox(hoop, size = 1) {
  const w = 0.06 * size, h = 0.09 * size;
  const x = Math.min(1 - w, Math.max(0, hoop.x - w / 2));
  const y = Math.min(1 - h, Math.max(0, hoop.y - 0.015 * size));
  return { x, y, w, h };
}

// Arguments ffmpeg : zones des paniers réduites à 16×16 en gris, côte à côte.
export function netMotionArgs({ input, start, dur, hoops, size = 1, output }) {
  const crops = hoops.map(hp => {
    const b = hoopBox(hp, size);
    return `crop=iw*${b.w.toFixed(4)}:ih*${b.h.toFixed(4)}:iw*${b.x.toFixed(4)}:ih*${b.y.toFixed(4)},scale=${NET_SIZE}:${NET_SIZE}:flags=area,format=gray`;
  });
  let graph;
  if (crops.length === 1) {
    graph = `[0:v]fps=${NET_FPS},${crops[0]}[o]`;
  } else {
    const labels = crops.map((_, k) => `[s${k}]`).join('');
    graph = [`[0:v]fps=${NET_FPS},split=${crops.length}${labels}`,
      ...crops.map((c, k) => `[s${k}]${c}[c${k}]`),
      `${crops.map((_, k) => `[c${k}]`).join('')}hstack=inputs=${crops.length}[o]`].join(';');
  }
  return ['-ss', Math.max(0, start).toFixed(2), '-t', dur.toFixed(2), '-i', input,
    '-filter_complex', graph, '-map', '[o]', '-f', 'rawvideo', output];
}

// Mouvement image par image (différence moyenne, 0 à 255) pour chaque panier.
export function netMotion(raw, hoopCount) {
  const rowLen = NET_SIZE * hoopCount;
  const frameLen = rowLen * NET_SIZE;
  const frames = Math.floor(raw.length / frameLen);
  const out = Array.from({ length: hoopCount }, () => new Float32Array(Math.max(0, frames - 1)));
  for (let f = 1; f < frames; f++) {
    const a = (f - 1) * frameLen, b = f * frameLen;
    for (let k = 0; k < hoopCount; k++) {
      let sum = 0;
      for (let r = 0; r < NET_SIZE; r++) {
        const o = r * rowLen + k * NET_SIZE;
        for (let c = 0; c < NET_SIZE; c++) sum += Math.abs(raw[b + o + c] - raw[a + o + c]);
      }
      out[k][f - 1] = sum / (NET_SIZE * NET_SIZE);
    }
  }
  return out;
}

function median(arr) {
  const s = Array.from(arr).sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

// Pic de mouvement le plus net dans [from, to] secondes (relatif au début de l'analyse).
// z = écart au mouvement habituel de la zone, en « écarts types robustes ».
export function basketPeak(diff, fps = NET_FPS, { from = 0, to = Infinity } = {}) {
  if (!diff.length) return { t: 0, z: 0 };
  const m = median(diff);
  const mad = median(Array.from(diff, v => Math.abs(v - m)));
  const scale = 1.4826 * mad + 0.5;
  let best = { t: 0, z: -Infinity };
  for (let i = 0; i < diff.length; i++) {
    const t = (i + 1) / fps;
    if (t < from || t > to) continue;
    const z = (diff[i] - m) / scale;
    if (z > best.z) best = { t, z };
  }
  return best.z === -Infinity ? { t: 0, z: 0 } : best;
}

export const BASKET_Z = 6;

// ---------- Paniers marqués vus par l'IA (Gemini gratuit, sans rien toucher) ----------
// Pour chaque moment fort : une image par seconde sur les 7 s avant la réaction de la salle
// et la 1re seconde après, en 640 px. Ça marche aussi quand la caméra suit le jeu (XbotGo).
export const AI_LOOK_BEFORE = 7;
export const AI_LOOK_DUR = 8;
export const AI_PER_BATCH = 3; // 3 moments × 8 images = 24 images par demande

export function aiFrameArgs({ input, t, output = '/pk%02d.jpg' }) {
  const start = Math.max(0, t - AI_LOOK_BEFORE);
  return {
    start,
    args: ['-ss', start.toFixed(2), '-t', String(AI_LOOK_DUR), '-i', input, '-an',
      '-vf', 'fps=1,scale=640:-2', '-q:v', '6', output],
  };
}

export function aiBatches(list, size = AI_PER_BATCH) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

// Réponse de l'IA ({moments:[{moment, panier, t, x, y, confiance}]}) → candidats marqués.
// « moment » est l'indice du candidat dans le lot ; une confiance basse ne compte pas.
export function applyAiBaskets(batch, verdicts) {
  const clamp = (v, lo, hi, d) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : d);
  let found = 0;
  batch.forEach((c, i) => {
    const v = (verdicts?.moments || []).find(m => +m.moment === i + 1);
    c.checked = true;
    c.basket = Boolean(v && v.panier === true && v.confiance !== 'basse');
    if (!c.basket) return;
    found++;
    c.netZ = v.confiance === 'haute' ? 20 : 10;
    c.tb = clamp(v.t, Math.max(0, c.t - AI_LOOK_BEFORE), c.t + 1, c.t - 2);
    c.hoop = { x: clamp(v.x, 0, 1, 0.5), y: clamp(v.y, 0, 1, 0.5) };
  });
  return found;
}

// Extraits à partir des moments forts (avec ou sans vérification des paniers).
// pick = 'baskets' : seulement les paniers marqués, tous gardés (la durée visée ne coupe pas) ;
// pick = 'all' : les moments forts au son, paniers d'abord, jusqu'à la durée visée.
export function candidatesToClips(cands, { duration, targetS = 60, pick = 'baskets' } = {}) {
  const baskets = cands.filter(c => c.basket).sort((a, b) => (b.netZ + b.score) - (a.netZ + a.score));
  const others = pick === 'baskets' ? [] : cands.filter(c => !c.basket).sort((a, b) => b.score - a.score);
  let total = 0;
  const clips = [...baskets, ...others].map((c, rank) => {
    const anchor = c.basket ? c.tb : c.t;
    const before = c.basket ? 5.5 : 6, after = 2;
    const start = Math.max(0, anchor - before);
    const end = duration ? Math.min(duration, anchor + after) : anchor + after;
    const dur = Math.max(1, end - start);
    const on = pick === 'baskets' || total + dur <= targetS + 1;
    if (on) total += dur;
    return { ...c, rank, start, dur, on };
  });
  return clips.sort((a, b) => a.start - b.start);
}

// Zoom progressif (filtre zoompan) : vers le panier juste avant que le ballon rentre,
// ou zoom avant doux au centre pour les autres moments.
export function zoomFilter({ max, hx = 0.5, hy = 0.5, t0, t1 }, size, fps = 30) {
  const span = Math.max(0.1, t1 - t0);
  const p = `clip((on/${fps}-${t0.toFixed(2)})/${span.toFixed(2)},0,1)`;
  const s = `(${p}*${p}*(3-2*${p}))`;
  const z = `1+${(max - 1).toFixed(3)}*${s}`;
  const cx = `(0.5+(${(hx - 0.5).toFixed(4)})*${s})`;
  const cy = `(0.5+(${(hy - 0.5).toFixed(4)})*${s})`;
  return `fps=${fps},zoompan=z='${z}':x='clip(${cx}*iw-iw/zoom/2,0,iw-iw/zoom)'` +
    `:y='clip(${cy}*ih-ih/zoom/2,0,ih-ih/zoom)':d=1:s=${size.w}x${size.h}:fps=${fps}`;
}

// Taille de travail du zoom : celle de la vidéo, limitée à 1280 px de large (ou de haut).
export function zoomSize(w, h) {
  if (!w || !h) return { w: 1280, h: 720 };
  const k = Math.min(1, 1280 / Math.max(w, h));
  const even = n => Math.max(2, Math.round(n * k / 2) * 2);
  return { w: even(w), h: even(h) };
}
