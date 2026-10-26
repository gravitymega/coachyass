// Rendu rapide du short avec WebCodecs (librairie Mediabunny, MPL-2.0, dans vendor/mediabunny).
// Même résultat que buildRenderArgs (highlights.js) : cadrage, fond flou, zoom, fondus,
// texte par-dessus et carte de fin. Le navigateur encode en H.264 avec la carte graphique,
// souvent 5 à 20 fois plus vite que ffmpeg.wasm. En cas d'échec, app.js repasse par ffmpeg.

const FPS = 30;
const RATE = 44100;
const MB_URL = './vendor/mediabunny/mediabunny.min.mjs';

// Zone de l'image source vue après le zoom (même calcul que zoomFilter) : { x, y, w, h } en pixels.
export function zoomRect(zoom, t, sw, sh) {
  if (!zoom) return { x: 0, y: 0, w: sw, h: sh };
  const span = Math.max(0.1, zoom.t1 - zoom.t0);
  const p = Math.min(1, Math.max(0, (t - zoom.t0) / span));
  const s = p * p * (3 - 2 * p);
  const z = 1 + (zoom.max - 1) * s;
  const cx = 0.5 + ((zoom.hx ?? 0.5) - 0.5) * s;
  const cy = 0.5 + ((zoom.hy ?? 0.5) - 0.5) * s;
  const w = sw / z, h = sh / z;
  const x = Math.min(sw - w, Math.max(0, cx * sw - w / 2));
  const y = Math.min(sh - h, Math.max(0, cy * sh - h / 2));
  return { x, y, w, h };
}

// Recadrage vertical : bande de la zone r qui remplit W×H, placée selon cropX (0 à 1).
export function cropRect(r, W, H, cropX = 0.5) {
  const vw = Math.min(r.w, W * (r.h / H));
  const x = r.x + (r.w - vw) * Math.min(1, Math.max(0, cropX));
  return { x, y: r.y, w: vw, h: r.h };
}

// Plein cadre : hauteur de la vidéo affichée sur toute la largeur, centrée.
export function fullFrameHeight(r, W) {
  return r.h * (W / r.w);
}

export function frameCount(dur) {
  return Math.max(1, Math.round(dur * FPS));
}

let mbPromise = null;
function loadMediabunny() {
  mbPromise ??= import(MB_URL);
  return mbPromise;
}

// Vrai si le navigateur a WebCodecs (Chrome, Edge, Safari récents ; Firefox selon la version).
export function fastRenderAvailable() {
  return typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined' &&
    typeof VideoDecoder !== 'undefined' && typeof OfflineAudioContext !== 'undefined';
}

// file : la vidéo d'origine (File) ; clips : [{ start, dur, cropX, zoom }] ;
// overlay : image (canvas) posée sur les extraits ou null ; outro : { image, dur } ou null.
// Renvoie un Blob MP4. Lance une erreur si ce navigateur ne sait pas faire (app.js passe alors à ffmpeg).
export async function renderShortFast({ file, clips, layout, width: W, height: H, overlay = null, outro = null, maxKbps = null, onProgress = () => {} }) {
  if (!fastRenderAvailable()) throw new Error('WebCodecs absent');
  const MB = await loadMediabunny();
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
  try {
    const vTrack = await input.getPrimaryVideoTrack();
    if (!vTrack || !(await vTrack.canDecode())) throw new Error('vidéo illisible par WebCodecs');
    let aTrack = await input.getPrimaryAudioTrack();
    if (aTrack && !(await aTrack.canDecode())) throw new Error('son illisible par WebCodecs');

    const videoQuality = new MB.Quality({ bitrate: Math.round((maxKbps || 8000) * 1000) });
    const audioQuality = new MB.Quality({ bitrate: 128000 });
    if (!(await MB.canEncodeVideo('avc', { width: W, height: H, quality: videoQuality, frameRate: FPS }))) throw new Error('encodage H.264 indisponible');
    if (aTrack && !(await MB.canEncodeAudio('aac', { numberOfChannels: 2, sampleRate: RATE, quality: audioQuality }))) throw new Error('encodage AAC indisponible');

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    // Fond flou : petite image (1/8) floutée puis agrandie, comme le filtre ffmpeg.
    const small = document.createElement('canvas');
    small.width = Math.max(2, Math.round(W / 8));
    small.height = Math.max(2, Math.round(H / 8));
    const sctx = small.getContext('2d');
    const canBlur = 'filter' in sctx;

    const videoSource = new MB.CanvasSource(canvas, { codec: 'avc', quality: videoQuality });
    output.addVideoTrack(videoSource, { frameRate: FPS });
    const audioSource = aTrack ? new MB.AudioBufferSource({ codec: 'aac', quality: audioQuality }) : null;
    if (audioSource) output.addAudioTrack(audioSource);
    await output.start();

    const sink = new MB.CanvasSink(vTrack, { poolSize: 3 });
    const audioSink = aTrack ? new MB.AudioBufferSink(aTrack) : null;
    const total = clips.reduce((s, c) => s + frameCount(c.dur), 0) / FPS + (outro ? outro.dur : 0);
    let t = 0;

    for (const c of clips) {
      const n = frameCount(c.dur);
      const dur = n / FPS;
      // Le son de l'extrait d'abord (durée exacte des images), pour garder les deux pistes alignées.
      if (audioSource) await audioSource.add(await clipAudio(audioSink, c.start, dur));
      const times = Array.from({ length: n }, (_, k) => c.start + k / FPS);
      let k = 0, last = null;
      for await (const wrapped of sink.canvasesAtTimestamps(times)) {
        const src = wrapped?.canvas ?? last;
        if (src) {
          last = src;
          drawFrame(ctx, src, W, H, layout, c, k / FPS, sctx, small, canBlur);
        }
        if (overlay) ctx.drawImage(overlay, 0, 0, W, H);
        await videoSource.add(t + k / FPS, 1 / FPS);
        k++;
        if (k % 15 === 0) onProgress((t + k / FPS) / total);
      }
      // Si le décodeur a rendu moins d'images que prévu, on répète la dernière.
      for (; k < n; k++) await videoSource.add(t + k / FPS, 1 / FPS);
      t += dur;
    }

    if (outro) {
      const n = frameCount(outro.dur);
      if (audioSource) await audioSource.add(new AudioBuffer({ length: Math.round(n / FPS * RATE), numberOfChannels: 2, sampleRate: RATE }));
      for (let k = 0; k < n; k++) {
        ctx.drawImage(outro.image, 0, 0, W, H);
        fadeFromBlack(ctx, W, H, k / FPS, 0.3);
        await videoSource.add(t + k / FPS, 1 / FPS);
      }
      t += n / FPS;
    }

    onProgress(1);
    videoSource.close();
    audioSource?.close();
    await output.finalize();
    return new Blob([output.target.buffer], { type: 'video/mp4' });
  } catch (err) {
    try { await output.cancel(); } catch { /* déjà arrêté */ }
    throw err;
  } finally {
    input.dispose?.();
  }
}

function drawFrame(ctx, src, W, H, layout, clip, local, sctx, small, canBlur) {
  const r = zoomRect(clip.zoom, local, src.width, src.height);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (layout === 'crop') {
    const cr = cropRect(r, W, H, clip.cropX ?? 0.5);
    const dw = cr.w * (H / cr.h);
    ctx.drawImage(src, cr.x, cr.y, cr.w, cr.h, (W - dw) / 2, 0, dw, H);
  } else {
    // Fond : la même image en « cover », floutée et un peu assombrie.
    const sw = small.width, sh = small.height;
    const k = Math.max(sw / r.w, sh / r.h);
    const bw = sw / k, bh = sh / k;
    if (canBlur) sctx.filter = 'blur(1.5px)';
    sctx.drawImage(src, r.x + (r.w - bw) / 2, r.y + (r.h - bh) / 2, bw, bh, 0, 0, sw, sh);
    if (canBlur) sctx.filter = 'none';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, 0, W, H);
    const fh = fullFrameHeight(r, W);
    ctx.drawImage(src, r.x, r.y, r.w, r.h, 0, (H - fh) / 2, W, fh);
  }
  fadeFromBlack(ctx, W, H, local, 0.15);
}

function fadeFromBlack(ctx, W, H, t, d) {
  if (t >= d) return;
  ctx.fillStyle = `rgba(0,0,0,${(1 - t / d).toFixed(3)})`;
  ctx.fillRect(0, 0, W, H);
}

// Son d'un extrait : stéréo 44,1 kHz, longueur exacte, fondu d'entrée 0,1 s et de sortie 0,2 s.
async function clipAudio(sink, start, dur) {
  const length = Math.max(1, Math.round(dur * RATE));
  const oac = new OfflineAudioContext(2, length, RATE);
  const gain = oac.createGain();
  gain.connect(oac.destination);
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(1, Math.min(0.1, dur / 2));
  gain.gain.setValueAtTime(1, Math.max(0, dur - 0.2));
  gain.gain.linearRampToValueAtTime(0, dur);
  for await (const { buffer, timestamp } of sink.buffers(start, start + dur)) {
    const node = oac.createBufferSource();
    node.buffer = buffer;
    node.connect(gain);
    const at = timestamp - start;
    if (at >= 0) node.start(at);
    else if (-at < buffer.duration) node.start(0, -at);
  }
  return oac.startRendering();
}
