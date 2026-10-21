// Module « Analyse tactique » : logique pure (aucun accès au DOM ni au réseau),
// testable avec Node. Échantillonnage des images, lecture du flux de l'IA,
// rapport texte, sous-titres des moments clés et rendu ffmpeg de la vidéo commentée.

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

// Longueur visée du commentaire : ~2,3 mots par seconde de vidéo, entre 60 et 450 mots.
export function targetWords(dur) {
  return Math.max(60, Math.min(450, Math.round(dur * 2.3)));
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
    moments: (Array.isArray(a.moments) ? a.moments : [])
      .filter(m => m && Number.isFinite(+m.t))
      .map(m => ({ t: +m.t, titre: String(m.titre || '').trim(), explication: String(m.explication || '').trim() }))
      .sort((x, y) => x.t - y.t),
    commentaire: String(a.commentaire || '').trim(),
  };
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
  if (a.commentaire) out.push('', 'COMMENTAIRE (VOIX OFF)', a.commentaire);
  return out.join('\n');
}

// Encadrés à l'écran : chaque moment clé reste affiché ~4,5 s (sans chevaucher
// le suivant), en temps relatif au début de la séquence.
export function captionTimes(moments, start, dur, { show = 4.5, lead = 0.5 } = {}) {
  const inside = moments.filter(m => m.t >= start - 1 && m.t <= start + dur + 1);
  return inside.map((m, i) => {
    const t0 = Math.max(0, m.t - start - lead);
    const next = inside[i + 1] ? Math.max(0, inside[i + 1].t - start - lead) : Infinity;
    const t1 = Math.min(t0 + show, next - 0.1, dur);
    return { ...m, t0, t1 };
  }).filter(c => c.t1 - c.t0 >= 1);
}

// Vidéo commentée en un seul encodage : la séquence (prolongée sur la dernière
// image si la voix est plus longue), les encadrés des moments clés, la voix off
// par-dessus le son de la salle baissé.
export function buildCommentaryArgs({ input, start, dur, voice, voiceDur, hasAudio, captions = [], width, height, output, bgVolume = 0.2, voiceDelay = 0.4 }) {
  const total = Math.max(dur, voiceDur + voiceDelay + 0.6);
  const args = ['-ss', start.toFixed(2), '-t', dur.toFixed(2), '-i', input, '-i', voice];
  captions.forEach(c => args.push('-loop', '1', '-framerate', '30', '-t', total.toFixed(2), '-i', c.path));
  const f = [];
  const pad = total - dur > 0.05 ? `,tpad=stop_mode=clone:stop_duration=${(total - dur).toFixed(2)}` : '';
  f.push(`[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30${pad}[v0]`);
  let last = 'v0';
  captions.forEach((c, i) => {
    const out = `v${i + 1}`;
    f.push(`[${last}][${i + 2}:v]overlay=0:0:enable='between(t,${c.t0.toFixed(2)},${c.t1.toFixed(2)})'[${out}]`);
    last = out;
  });
  const ms = Math.round(voiceDelay * 1000);
  f.push(`[1:a]aresample=44100,adelay=${ms}|${ms},apad=whole_dur=${total.toFixed(2)}[vo]`);
  if (hasAudio) {
    f.push(`[0:a]aresample=44100,volume=${bgVolume},apad=whole_dur=${total.toFixed(2)}[bg]`);
    f.push('[bg][vo]amix=inputs=2:duration=longest:normalize=0[a]');
  } else {
    f.push('[vo]anull[a]');
  }
  args.push('-filter_complex', f.join(';'), '-map', `[${last}]`, '-map', '[a]', '-t', total.toFixed(2),
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output);
  return { args, total };
}
