// Sous-titres automatiques : logique pure (aucun accès au DOM), testable avec Node.
// La transcription (Whisper, dans le navigateur) renvoie des morceaux { text, timestamp: [début, fin] },
// mot par mot si possible, sinon phrase par phrase. On les regroupe en sous-titres courts,
// lisibles sur un short vertical, puis on exporte en SRT / VTT.

// Regroupe les morceaux en sous-titres de maxWords mots et maxChars caractères au plus.
// Un morceau de plusieurs mots (transcription par phrase) est d'abord coupé en mots, avec un
// temps réparti selon la longueur de chaque mot.
export function splitCues(chunks, { maxWords = 4, maxChars = 26, minDur = 0.6, maxGap = 0.8 } = {}) {
  const words = [];
  for (const c of chunks || []) {
    const [s0, e0] = c.timestamp || [];
    const text = String(c.text || '').trim();
    if (!text || !Number.isFinite(s0)) continue;
    const end = Number.isFinite(e0) && e0 > s0 ? e0 : s0 + Math.max(0.4, text.length * 0.07);
    const parts = text.split(/\s+/).filter(Boolean);
    const total = parts.reduce((n, w) => n + w.length + 1, 0);
    let t = s0;
    parts.forEach(w => {
      const d = (end - s0) * ((w.length + 1) / total);
      words.push({ text: w, start: t, end: t + d });
      t += d;
    });
  }
  const cues = [];
  let cur = null;
  for (const w of words) {
    const len = cur ? cur.text.length + 1 + w.text.length : w.text.length;
    const breakHere = !cur || cur.n >= maxWords || len > maxChars || w.start - cur.end > maxGap
      || /[.!?…]$/.test(cur.text);
    if (breakHere) {
      if (cur) cues.push(cur);
      cur = { start: w.start, end: w.end, text: w.text, n: 1 };
    } else {
      cur.text += ' ' + w.text;
      cur.end = w.end;
      cur.n++;
    }
  }
  if (cur) cues.push(cur);
  // Durée minimale de lecture, sans chevaucher le sous-titre suivant.
  return cues.map((c, i) => {
    const next = cues[i + 1];
    let end = Math.max(c.end, c.start + minDur);
    if (next) end = Math.min(end, next.start);
    return { start: round(c.start), end: round(Math.max(end, c.start + 0.1)), text: c.text };
  });
}

const round = v => Math.round(v * 1000) / 1000;

function stamp(s, sep) {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(sec)}${sep}${p(ms % 1000, 3)}`;
}
export const srtTime = s => stamp(s, ',');

export function toSRT(cues) {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n');
}

export function toVTT(cues) {
  return 'WEBVTT\n\n' + cues.map(c => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n');
}

function parseStamp(s) {
  const m = /(?:(\d+):)?(\d{1,2}):(\d{1,2})[,.](\d{1,3})/.exec(s);
  if (!m) return NaN;
  return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4].padEnd(3, '0')) / 1000;
}

// Lit un fichier .srt ou .vtt (les balises de style sont retirées).
export function parseSubtitles(text) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n{2,}/);
  const cues = [];
  for (const b of blocks) {
    const lines = b.split('\n').filter(l => l.trim() !== '');
    const i = lines.findIndex(l => l.includes('-->'));
    if (i < 0) continue;
    const [a, z] = lines[i].split('-->');
    const start = parseStamp(a), end = parseStamp(z);
    const txt = lines.slice(i + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && txt) cues.push({ start, end, text: txt });
  }
  return cues.sort((x, y) => x.start - y.start);
}

// Sous-titre affiché à l'instant t (ou null).
export function cueAt(cues, t) {
  return cues.find(c => t >= c.start && t < c.end) || null;
}

/**
 * Liste ffconcat qui enchaîne les images de sous-titres (PNG transparents) sur toute la vidéo :
 * une image vide entre deux sous-titres. frames[i] = chemin du PNG du sous-titre i.
 */
export function cueConcatList(cues, frames, blank, duration) {
  const out = ['ffconcat version 1.0'];
  let t = 0;
  const push = (file, d) => { if (d > 0.001) out.push(`file '${file}'`, `duration ${d.toFixed(3)}`); };
  cues.forEach((c, i) => {
    const s = Math.max(t, Math.min(c.start, duration)), e = Math.min(c.end, duration);
    if (e <= s) return;
    push(blank, s - t);
    push(frames[i], e - s);
    t = e;
  });
  push(blank, Math.max(0.04, duration - t));
  // Le démultiplexeur concat ignore la durée de la dernière entrée : on la répète.
  out.push(`file '${blank}'`);
  return out.join('\n') + '\n';
}

// Arguments ffmpeg : vidéo d'origine + piste d'images de sous-titres superposée.
export function buildBurnArgs({ input, list, output, crf = 21 }) {
  return [
    '-i', input, '-f', 'concat', '-safe', '0', '-i', list,
    '-filter_complex', '[1:v]format=rgba[s];[0:v][s]overlay=0:0:eof_action=pass:format=auto,format=yuv420p[v]',
    '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', String(crf),
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', output,
  ];
}

export const STYLES = {
  gravity: { label: 'Gravity (blanc contour noir, mot clé orange)' },
  jaune: { label: 'Jaune contour noir (classique TikTok)' },
  boite: { label: 'Texte blanc sur bandeau sombre' },
};
