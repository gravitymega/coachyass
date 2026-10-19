// Logique pure de l'Éditeur (aucun accès au DOM) : durées et arguments ffmpeg
// du rendu final. Testable avec Node.

export const FORMATS = {
  vertical: { label: 'Vertical 9:16 (Reels, TikTok, Shorts)', w: 1080, h: 1920 },
  horizontal: { label: 'Horizontal 16:9 (YouTube)', w: 1920, h: 1080 },
  square: { label: 'Carré 1:1', w: 1080, h: 1080 },
  portrait: { label: 'Portrait 4:5 (post Instagram)', w: 1080, h: 1350 },
};

export const TRANSITION_S = 0.4;

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

// clips : [{ kind: 'video'|'image', path, start, dur, speed, hasAudio, overlay }]
//   overlay = chemin d'un PNG transparent W×H (texte, logo) ou null.
// music : { path, volume } ou null. originalVolume : volume du son des vidéos.
export function buildEditorArgs({ clips, width: W, height: H, fit = 'blur', transition = 'cut', music = null, originalVolume = 1, output }) {
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
