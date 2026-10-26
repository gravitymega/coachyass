// Logique pure de l'Éditeur (aucun accès au DOM) : durées et arguments ffmpeg
// du rendu final. Testable avec Node.

export const FORMATS = {
  vertical: { label: 'Vertical 9:16 (Reels, TikTok, Shorts)', w: 1080, h: 1920 },
  horizontal: { label: 'Horizontal 16:9 (YouTube)', w: 1920, h: 1080 },
  square: { label: 'Carré 1:1', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 4:5 (post Instagram)', w: 1080, h: 1350 },
};

export const TRANSITION_S = 0.4;

// ---------- Looks (étalonnage) ----------
// Chaque look est une fonction couleur (r, g, b entre 0 et 1) transformée en fichier LUT .cube,
// appliqué par le filtre lut3d de ffmpeg (même principe que les LUT de FreeCut / OpenReel).
const clamp01 = v => Math.min(1, Math.max(0, v));
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
// Courbe en S autour de 0,5 (k > 0 : plus de contraste).
const sCurve = (v, k) => clamp01(v + k * (v - 0.5) * (1 - Math.abs(2 * v - 1)) * 2);
function tone([r, g, b], { contrast = 0, sat = 1, lift = 0, gain = 1, shadows = [0, 0, 0], highs = [0, 0, 0] }) {
  const l = luma(r, g, b);
  let c = [r, g, b].map(v => l + (v - l) * sat);
  const ws = (1 - l) * (1 - l), wh = l * l; // poids ombres / hautes lumières
  c = c.map((v, i) => v + shadows[i] * ws + highs[i] * wh);
  return c.map(v => sCurve(clamp01(lift + v * gain * (1 - lift)), contrast));
}
export const LOOKS = {
  none: { label: 'Aucun (couleurs d\'origine)' },
  gravity: { label: 'Gravity (chaud, orange et bleu)', css: 'contrast(1.15) saturate(1.2) sepia(0.1)', fn: c => tone(c, { contrast: 0.22, sat: 1.18, shadows: [-0.04, 0.02, 0.07], highs: [0.07, 0.02, -0.05] }) },
  nuit: { label: 'Nuit de match (froid, contrasté)', css: 'contrast(1.25) saturate(0.9) brightness(0.92) hue-rotate(-8deg)', fn: c => tone(c, { contrast: 0.3, sat: 0.9, gain: 0.92, shadows: [-0.03, 0, 0.06], highs: [-0.01, 0.01, 0.04] }) },
  film: { label: 'Film (noirs délavés, doux)', css: 'contrast(0.92) saturate(0.82) brightness(1.05)', fn: c => tone(c, { contrast: -0.05, sat: 0.82, lift: 0.07, highs: [0.03, 0.015, -0.02] }) },
  eclat: { label: 'Éclat (couleurs vives)', css: 'saturate(1.4) contrast(1.1)', fn: c => tone(c, { contrast: 0.15, sat: 1.4 }) },
  nb: { label: 'Noir et blanc contrasté', css: 'grayscale(1) contrast(1.3)', fn: c => tone(c, { contrast: 0.35, sat: 0 }) },
};

// Texte d'un fichier .cube (rouge varie le plus vite, comme l'exige le format).
export function cubeLUT(fn, size = 17) {
  const lines = [`TITLE "Art craft"`, `LUT_3D_SIZE ${size}`, 'DOMAIN_MIN 0 0 0', 'DOMAIN_MAX 1 1 1'];
  for (let b = 0; b < size; b++) for (let g = 0; g < size; g++) for (let r = 0; r < size; r++) {
    const out = fn([r / (size - 1), g / (size - 1), b / (size - 1)]);
    lines.push(out.map(v => clamp01(v).toFixed(5)).join(' '));
  }
  return lines.join('\n') + '\n';
}

// Vérifie un .cube importé (3D seulement) : renvoie sa taille ou lève une erreur lisible.
export function checkCube(text) {
  const m = /^\s*LUT_3D_SIZE\s+(\d+)/m.exec(text);
  if (!m) throw new Error('Fichier .cube non reconnu (il faut une LUT 3D).');
  const n = +m[1];
  if (n < 2 || n > 65) throw new Error('Taille de LUT non prise en charge.');
  const rows = text.split(/\r?\n/).filter(l => /^\s*-?[\d.]+(e-?\d+)?\s+-?[\d.]+(e-?\d+)?\s+-?[\d.]+(e-?\d+)?\s*$/i.test(l)).length;
  if (rows < n * n * n) throw new Error(`LUT incomplète (${rows} lignes sur ${n * n * n}).`);
  return n;
}

// ---------- Effets par extrait ----------
export const EFFECTS = {
  none: { label: 'Aucun' },
  glitch: { label: 'Glitch (couleurs décalées)' },
  flash: { label: 'Flash blanc à l\'entrée' },
  punch: { label: 'Zoom « punch » à l\'entrée' },
  nb: { label: 'Noir et blanc' },
};
// Filtre ffmpeg de l'effet (après le cadrage, avant le texte). outDur : durée de l'extrait.
export function effectFilter(effect, W, H) {
  if (effect === 'glitch') {
    // Rouge et bleu décalés + image qui tremble à l'horizontale (rgbashift n'accepte pas d'expression).
    return `rgbashift=rh=-8:bh=8:rv=3,crop=w=${W - 16}:h=${H}:x='8+7*sin(t*43)*sin(t*7)':y=0,scale=${W}:${H},eq=contrast=1.08:saturation=1.15`;
  }
  if (effect === 'flash') return 'fade=t=in:st=0:d=0.35:color=white';
  if (effect === 'punch') {
    // Part d'un zoom ×1,25 et revient au plan normal en 0,35 s.
    return `scale=w='${W}*(1+0.25*max(0,1-t/0.35))':h='${H}*(1+0.25*max(0,1-t/0.35))':eval=frame,crop=${W}:${H}`;
  }
  if (effect === 'nb') return 'hue=s=0,eq=contrast=1.15';
  return '';
}

// Durée d'un extrait une fois le ralenti/accéléré appliqué.
export function clipOutDuration(clip) {
  return clip.dur / (clip.speed || 1);
}

export function timelineDuration(clips, transition) {
  const sum = clips.reduce((s, c) => s + clipOutDuration(c), 0);
  if (transition !== 'crossfade' || clips.length < 2) return sum;
  return sum - TRANSITION_S * (clips.length - 1);
}

function even(n) {
  return Math.round(n / 2) * 2;
}

// Vidéo ou image adaptée au format de sortie W×H.
function fitFilter(src, out, fit, W, H) {
  if (fit === 'crop') {
    return [`[${src}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}[${out}]`];
  }
  if (fit === 'contain') {
    return [`[${src}]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black[${out}]`];
  }
  const bw = even(W / 8), bh = even(H / 8);
  return [
    `[${src}]split[${out}b][${out}f]`,
    `[${out}b]scale=${bw}:${bh}:force_original_aspect_ratio=increase,crop=${bw}:${bh},boxblur=6:2,scale=${W}:${H},eq=brightness=-0.12[${out}bg]`,
    `[${out}f]scale=${W}:${H}:force_original_aspect_ratio=decrease[${out}fg]`,
    `[${out}bg][${out}fg]overlay=(W-w)/2:(H-h)/2[${out}]`,
  ];
}

// clips : [{ kind: 'video'|'image', path, start, dur, speed, hasAudio, overlay, effect, grade }]
//   effect = clé de EFFECTS ; grade = false pour ne pas étalonner (cartes de marque).
// look : chemin d'un fichier .cube (lut3d) appliqué aux extraits, ou null.
//   overlay = chemin d'un PNG transparent W×H (texte, logo) ou null.
// music : { path, volume } ou null. originalVolume : volume du son des vidéos.
export function buildEditorArgs({ clips, width: W, height: H, fit = 'blur', transition = 'cut', music = null, originalVolume = 1, look = null, output }) {
  const args = [];
  const filters = [];
  let input = 0;
  const T = TRANSITION_S;
  const segments = clips.map((c, i) => {
    const speed = c.speed || 1;
    const outDur = clipOutDuration(c);
    if (c.kind === 'image') {
      args.push('-loop', '1', '-framerate', '30', '-t', c.dur.toFixed(3), '-i', c.path);
    } else {
      args.push('-ss', c.start.toFixed(3), '-t', c.dur.toFixed(3), '-i', c.path);
    }
    const vIn = input++;
    let ovIn = null;
    if (c.overlay) {
      args.push('-i', c.overlay);
      ovIn = input++;
    }
    const chain = [`[${vIn}:v]setpts=(PTS-STARTPTS)/${speed},fps=30,format=yuv420p[s${i}]`];
    chain.push(...fitFilter(`s${i}`, `f${i}`, fit, W, H));
    let last = `f${i}`;
    const fx = [];
    if (look && c.grade !== false) fx.push(`lut3d=file=${look}`);
    const ef = effectFilter(c.effect, W, H);
    if (ef) fx.push(ef);
    if (fx.length) {
      chain.push(`[${last}]${fx.join(',')}[e${i}]`);
      last = `e${i}`;
    }
    if (ovIn != null) {
      chain.push(`[${last}][${ovIn}:v]overlay=0:0[o${i}]`);
      last = `o${i}`;
    }
    let tail = 'setsar=1,format=yuv420p';
    if (transition === 'fade') {
      const st = Math.max(0, outDur - T).toFixed(3);
      tail += `,fade=t=in:st=0:d=${T},fade=t=out:st=${st}:d=${T}`;
    }
    chain.push(`[${last}]${tail}[v${i}]`);
    if (c.kind === 'video' && c.hasAudio) {
      chain.push(`[${vIn}:a]asetpts=PTS-STARTPTS,atempo=${speed},aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,apad,atrim=duration=${outDur.toFixed(3)}[a${i}]`);
    } else {
      chain.push(`anullsrc=r=44100:cl=stereo,atrim=duration=${outDur.toFixed(3)},aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`);
    }
    if (transition === 'fade') {
      const st = Math.max(0, outDur - T).toFixed(3);
      chain.push(`[a${i}]afade=t=in:d=${T},afade=t=out:st=${st}:d=${T}[af${i}]`);
    } else {
      chain.push(`[a${i}]anull[af${i}]`);
    }
    filters.push(...chain);
    return { v: `v${i}`, a: `af${i}`, dur: outDur };
  });

  if (transition === 'crossfade' && segments.length > 1) {
    let v = segments[0].v, a = segments[0].a, acc = segments[0].dur;
    for (let i = 1; i < segments.length; i++) {
      const offset = (acc - T).toFixed(3);
      filters.push(`[${v}][${segments[i].v}]xfade=transition=fade:duration=${T}:offset=${offset}[xv${i}]`);
      filters.push(`[${a}][${segments[i].a}]acrossfade=d=${T}[xa${i}]`);
      v = `xv${i}`;
      a = `xa${i}`;
      acc += segments[i].dur - T;
    }
    filters.push(`[${v}]null[cv]`, `[${a}]anull[ca]`);
  } else {
    filters.push(`${segments.map(s => `[${s.v}][${s.a}]`).join('')}concat=n=${segments.length}:v=1:a=1[cv][ca]`);
  }

  const total = timelineDuration(clips, transition).toFixed(3);
  if (music) {
    args.push('-stream_loop', '-1', '-i', music.path);
    const m = input++;
    filters.push(`[ca]volume=${originalVolume}[base]`);
    filters.push(`[${m}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo,atrim=duration=${total},volume=${music.volume},afade=t=out:st=${Math.max(0, total - 1.5).toFixed(3)}:d=1.5[mus]`);
    filters.push('[base][mus]amix=inputs=2:duration=first:normalize=0[outa]');
  } else {
    filters.push(`[ca]volume=${originalVolume}[outa]`);
  }
  args.push('-filter_complex', filters.join(';'), '-map', '[cv]', '-map', '[outa]',
    '-t', total, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', output);
  return args;
}
