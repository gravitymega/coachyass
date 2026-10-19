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
export function buildRenderArgs({ input, clips, hasAudio, layout, width, height, overlay, output }) {
  const args = [];
  clips.forEach(c => args.push('-ss', c.start.toFixed(2), '-t', c.dur.toFixed(2), '-i', input));
  if (overlay) args.push('-i', overlay);
  const W = width, H = height;
  const parts = [];
  const concatIn = [];
  clips.forEach((c, i) => {
    const fadeOut = Math.max(0, c.dur - 0.2).toFixed(2);
    if (layout === 'crop') {
      const x = Math.min(1, Math.max(0, c.cropX ?? 0.5)).toFixed(3);
      parts.push(`[${i}:v]scale=-2:${H},crop=${W}:${H}:(iw-ow)*${x}:0,setsar=1,fps=30,format=yuv420p,fade=t=in:d=0.15[v${i}]`);
    } else {
      // Plein cadre : la vidéo entière au centre, fond flou de la même image.
      parts.push(`[${i}:v]split[b${i}][f${i}]`);
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
  if (overlay) parts.push(`[cv][${n}:v]overlay=0:0,format=yuv420p[outv]`);
  else parts.push('[cv]null[outv]');
  args.push('-filter_complex', parts.join(';'), '-map', '[outv]');
  if (hasAudio) args.push('-map', '[ca]', '-c:a', 'aac', '-b:a', '128k');
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output);
  return args;
}
