// Module « Analyse tactique » : logique pure (aucun accès au DOM ni au réseau),
// testable avec Node. Échantillonnage des images, lecture du flux de l'IA, rapport texte,
// découpage en passages (actions au ralenti, jeu à vitesse normale), piste de voix off
// et rendu ffmpeg de la vidéo commentée (vidéo en haut, tableau du coach en bas).
import { normalizeBoard } from './board-core.js';

export const MAX_FRAMES = 32;

// Instants (s) des images envoyées à l'IA : réparties sur la séquence,
// une toutes les ~3 s au plus serré, MAX_FRAMES au maximum.
export function sampleTimes(start, dur, { max = MAX_FRAMES, every = 3 } = {}) {
  const n = Math.max(2, Math.min(max, Math.round(dur / every)));
  const step = dur / n;
  return Array.from({ length: n }, (_, i) => Math.round((start + step * (i + 0.5)) * 10) / 10);
}

// Une image JPEG de 640 px de large, assez légère pour en envoyer 32 d'un coup.
export function frameArgs(input, t, output, width = 640) {
  return ['-ss', t.toFixed(2), '-i', input, '-frames:v', '1', '-vf', `scale=${width}:-2`, '-q:v', '6', output];
}

// Le serveur répond en NDJSON : {"d": morceau} … puis {"end": …} ou {"error": …}.
// feed() accepte des morceaux de texte arbitraires (coupés n'importe où).
export function createStreamReader() {
  let buffer = '';
  let text = '';
  let end = null;
  let error = null;
  const handle = raw => {
    if (!raw.trim()) return;
    const msg = JSON.parse(raw);
    if (typeof msg.d === 'string') text += msg.d;
    if (msg.end) end = msg.end;
    if (msg.error) error = msg.error;
  };
  return {
    feed(chunk) {
      buffer += chunk;
      let i;
      while ((i = buffer.indexOf('\n')) >= 0) {
        handle(buffer.slice(0, i));
        buffer = buffer.slice(i + 1);
      }
    },
    finish() {
      handle(buffer);
      buffer = '';
      if (error) throw new Error(error);
      if (!end) throw new Error('Analyse interrompue avant la fin (réseau ou délai dépassé) : réessaie avec une séquence plus courte.');
      return normalizeAnalysis(JSON.parse(text));
    },
    get length() { return text.length; },
  };
}

const list = v => (Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : []);

// Rend l'analyse sûre à afficher même si un champ manque.
export function normalizeAnalysis(a) {
  a = a && typeof a === 'object' ? a : {};
  return {
    resume: String(a.resume || '').trim(),
    attaque: list(a.attaque),
    defense: list(a.defense),
    transitions: list(a.transitions),
    systemes: (Array.isArray(a.systemes) ? a.systemes : [])
      .map(s => ({ nom: String((s && s.nom) || '').trim(), description: String((s && s.description) || '').trim() }))
      .filter(s => s.nom || s.description),
    points_forts: list(a.points_forts),
    points_faibles: list(a.points_faibles),
    conseils: list(a.conseils),
    intro: String(a.intro || '').trim(),
    moments: (Array.isArray(a.moments) ? a.moments : [])
      .filter(m => m && Number.isFinite(+m.t))
      .map(m => {
        const t = +m.t;
        let debut = Number.isFinite(+m.debut) ? +m.debut : t - 3;
        let fin = Number.isFinite(+m.fin) ? +m.fin : t + 1.5;
        if (fin - debut < 1.5 || debut > t || fin < t) { debut = t - 3; fin = t + 1.5; }
        if (fin - debut > 10) { debut = Math.max(debut, t - 6); fin = Math.min(fin, t + 4); }
        return {
          t, debut, fin,
          titre: String(m.titre || '').trim(),
          explication: String(m.explication || '').trim(),
          narration: String(m.narration || m.explication || '').trim(),
          board: normalizeBoard(m),
        };
      })
      .sort((x, y) => x.t - y.t),
    conclusion: String(a.conclusion || '').trim(),
  };
}

// Texte complet de la voix off (pour le rapport).
export function commentaryOf(a) {
  return [a.intro, ...a.moments.map(m => m.narration), a.conclusion].filter(Boolean).join(' ');
}

export const SECTIONS = [
  ['attaque', 'Attaque'],
  ['defense', 'Défense'],
  ['transitions', 'Transitions et rebonds'],
  ['points_forts', 'Points forts'],
  ['points_faibles', 'Points à travailler'],
  ['conseils', 'Conseils et exercices'],
];

export function fmtTime(s) {
  s = Math.max(0, Math.round(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
}

// Rapport écrit (texte brut, lisible partout : courriel, Notes, Word).
export function reportText(a, { title = 'Analyse tactique', team = '', start = 0, dur = 0 } = {}) {
  const out = [title.toUpperCase()];
  if (team) out.push(`Équipe analysée : ${team}`);
  if (dur) out.push(`Séquence : ${fmtTime(start)} à ${fmtTime(start + dur)}`);
  out.push('', 'RÉSUMÉ', a.resume || '—');
  if (a.systemes.length) {
    out.push('', 'SYSTÈMES REPÉRÉS');
    a.systemes.forEach(s => out.push(`- ${s.nom}${s.description ? ' : ' + s.description : ''}`));
  }
  SECTIONS.forEach(([key, label]) => {
    if (!a[key].length) return;
    out.push('', label.toUpperCase());
    a[key].forEach(x => out.push(`- ${x}`));
  });
  if (a.moments.length) {
    out.push('', 'MOMENTS CLÉS');
    a.moments.forEach(m => out.push(`- ${fmtTime(m.t)} · ${m.titre}${m.explication ? ' : ' + m.explication : ''}`));
  }
  const voice = a.commentaire || commentaryOf(a);
  if (voice) out.push('', 'COMMENTAIRE (VOIX OFF)', voice);
  return out.join('\n');
}

// ---------- Montage : passages et ralentis ----------

/**
 * Découpe la séquence en passages : intro, chaque action au ralenti, le jeu entre les actions
 * (vitesse normale) et la conclusion. Si la voix off d'un passage est plus longue que l'image,
 * l'action est encore ralentie (jusqu'à minSlow), puis la dernière image est figée :
 * la voix ne prend jamais d'avance sur le jeu.
 *  narr : durées (s) des voix off [intro, moment 1…n, conclusion] (0 = pas de voix).
 * Renvoie { beats: [{ kind, moment, narr, src: [a, b], speed, out, freeze, t0, voiceAt }], total }.
 */
export function buildBeats({ start, dur, moments, narr = [], slow = 0.5, minSlow = 0.25, lead = 0.3, tail = 0.5 }) {
  const end = start + dur;
  const n = moments.length;
  const windows = [];
  let prev = start;
  moments.forEach((m, i) => {
    const a = Math.max(prev, start, m.debut);
    const b = Math.min(end, m.fin);
    if (b - a >= 1) { windows.push({ i, a, b }); prev = b; }
  });
  const raw = [];
  const firstA = windows.length ? windows[0].a : end;
  raw.push({ kind: 'intro', moment: windows.length ? windows[0].i : -1, narr: 0, src: [start, firstA] });
  windows.forEach((w, k) => {
    raw.push({ kind: 'action', moment: w.i, narr: w.i + 1, src: [w.a, w.b] });
    const nextA = k + 1 < windows.length ? windows[k + 1].a : end;
    if (k + 1 < windows.length) {
      if (nextA - w.b > 0.3) raw.push({ kind: 'jeu', moment: w.i, narr: -1, src: [w.b, nextA] });
    } else {
      raw.push({ kind: 'fin', moment: w.i, narr: n + 1, src: [w.b, end] });
    }
  });
  if (!windows.length) raw.push({ kind: 'fin', moment: -1, narr: n + 1, src: [end, end] });

  const beats = [];
  let t = 0;
  raw.forEach(r => {
    let len = r.src[1] - r.src[0];
    if (len < 0.1) {
      // Pas d'image à jouer : on fige une image (début de la séquence ou dernière image de l'action).
      const at = Math.min(Math.max(start, r.src[0] - (r.kind === 'intro' ? 0 : 0.1)), Math.max(start, end - 0.1));
      r.src = [at, at + 0.1];
      len = 0.1;
    }
    const voice = r.narr >= 0 ? (narr[r.narr] || 0) : 0;
    if (r.kind === 'intro' && len <= 0.1 && !voice) return;
    if (r.kind === 'fin' && len <= 0.1 && !voice) return;
    const base = r.kind === 'action' ? Math.min(1, slow) : 1;
    const need = voice > 0 ? lead + voice + tail : 0;
    let speed = base;
    if (need > len / base) speed = Math.min(base, Math.max(r.kind === 'action' ? minSlow : 0.75, len / need));
    const out = len / speed;
    const freeze = Math.max(0, need - out);
    beats.push({ ...r, speed: Math.round(speed * 1000) / 1000, out, freeze, t0: t, voiceAt: voice > 0 ? t + lead : null, voice });
    t += out + freeze;
  });
  return { beats, total: t };
}

// Piste de voix off complète : chaque voix posée au début de son passage, du silence ailleurs.
//  clips : Float32Array par voix off ([intro, moments…, conclusion]), à la fréquence rate.
export function placeVoice(beats, clips, rate, total) {
  const out = new Float32Array(Math.ceil(total * rate) + 1);
  beats.forEach(b => {
    const clip = b.narr >= 0 ? clips[b.narr] : null;
    if (!clip || b.voiceAt == null) return;
    const at = Math.round(b.voiceAt * rate);
    out.set(clip.subarray(0, Math.max(0, out.length - at)), at);
  });
  return out;
}

// atempo n'accepte que 0,5 à 2 : on enchaîne pour les ralentis plus forts.
export function atempoChain(speed) {
  const parts = [];
  let s = speed;
  while (s < 0.5) { parts.push('atempo=0.5'); s /= 0.5; }
  parts.push(`atempo=${s.toFixed(4)}`);
  return parts.join(',');
}

// Liste ffconcat des images du tableau (chaque image avec sa durée).
export function concatList(frames, name = i => `b${String(i).padStart(5, '0')}.jpg`) {
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => { lines.push(`file ${name(i)}`, `duration ${f.dur.toFixed(3)}`); });
  if (frames.length) lines.push(`file ${name(frames.length - 1)}`);
  return lines.join('\n') + '\n';
}

/**
 * Vidéo commentée verticale en un seul encodage : les passages (ralentis, images figées)
 * bout à bout en haut, le tableau du coach en bas, et le son choisi :
 *  audio = 'voix' (voix off seule), 'mix' (voix off + son du match baissé) ou 'original' (son du match).
 */
export function buildTacticArgs({ input, beats, total, hasAudio, audio = 'mix', voice, board, width, videoH, boardH, output, bgVolume = 0.2 }) {
  const useOrig = hasAudio && audio !== 'voix';
  const useVoice = audio !== 'original' && voice;
  const args = [];
  beats.forEach(b => args.push('-ss', b.src[0].toFixed(3), '-t', (b.src[1] - b.src[0]).toFixed(3), '-i', input));
  const B = beats.length;
  args.push('-f', 'concat', '-safe', '0', '-i', board);
  if (useVoice) args.push('-i', voice);
  const f = [];
  const parts = [];
  beats.forEach((b, k) => {
    const pad = b.freeze > 0.01 ? `,tpad=stop_mode=clone:stop_duration=${b.freeze.toFixed(3)}` : '';
    f.push(`[${k}:v]scale=${width}:${videoH}:force_original_aspect_ratio=decrease,pad=${width}:${videoH}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,setpts=(PTS-STARTPTS)/${b.speed},fps=30,trim=duration=${b.out.toFixed(3)}${pad},format=yuv420p[v${k}]`);
    parts.push(`[v${k}]`);
    if (useOrig) {
      const len = b.out + b.freeze;
      f.push(`[${k}:a]aresample=44100,asetpts=PTS-STARTPTS${b.speed < 0.999 ? ',' + atempoChain(b.speed) : ''},apad,atrim=duration=${len.toFixed(3)}[a${k}]`);
      parts.push(`[a${k}]`);
    }
  });
  f.push(`${parts.join('')}concat=n=${B}:v=1:a=${useOrig ? 1 : 0}[vc]${useOrig ? '[ac]' : ''}`);
  f.push(`[${B}:v]scale=${width}:${boardH},setsar=1,fps=30,format=yuv420p[bd]`);
  f.push('[vc][bd]vstack=inputs=2[vout]');
  if (useVoice) f.push(`[${B + 1}:a]aresample=44100,apad=whole_dur=${total.toFixed(3)}[vo]`);
  if (useVoice && useOrig) {
    f.push(`[ac]volume=${audio === 'voix' ? 0 : bgVolume}[bg]`);
    f.push('[vo][bg]amix=inputs=2:duration=first:normalize=0[a]');
  } else if (useVoice) {
    f.push('[vo]anull[a]');
  } else if (useOrig) {
    f.push('[ac]anull[a]');
  }
  const hasA = useVoice || useOrig;
  args.push('-filter_complex', f.join(';'), '-map', '[vout]');
  if (hasA) args.push('-map', '[a]');
  args.push('-t', total.toFixed(3), '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p');
  if (hasA) args.push('-c:a', 'aac', '-b:a', '128k');
  args.push('-movflags', '+faststart', output);
  return args;
}
