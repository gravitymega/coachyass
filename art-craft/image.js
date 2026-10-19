import { $, showError, loadImage, slugify } from './common.js';
import { drawBrandCard } from './brand.js';

const FORMATS = {
  youtube: { label: 'Miniature YouTube 1280 × 720', w: 1280, h: 720 },
  post: { label: 'Post Instagram 1080 × 1350', w: 1080, h: 1350 },
  square: { label: 'Carré 1080 × 1080', w: 1080, h: 1080 },
  story: { label: 'Story / Reel 1080 × 1920', w: 1080, h: 1920 },
  poster: { label: 'Affiche 1414 × 2000', w: 1414, h: 2000 },
};

const PALETTES = [
  { name: 'Gravity', a: '#e8672e', b: '#d81e5b' },
  { name: 'Feu', a: '#ffb000', b: '#e8432e' },
  { name: 'Nuit', a: '#5b6cff', b: '#9b2fd8' },
  { name: 'Glace', a: '#2ed3e8', b: '#2e6be8' },
  { name: 'Noir & blanc', a: '#ffffff', b: '#8a8a8a' },
];

const state = {
  photo: null,       // Image ou canvas
  panX: 0, panY: 0,  // décalage de la photo, en fraction de la largeur/hauteur
  palette: PALETTES[0],
  logo: null,
};

const cv = $('design');
const formatSel = $('format');
Object.entries(FORMATS).forEach(([k, f]) => formatSel.add(new Option(f.label, k)));

const sw = $('swatches');
PALETTES.forEach((p, i) => {
  const b = document.createElement('button');
  b.title = p.name;
  b.style.background = `linear-gradient(135deg, ${p.a}, ${p.b})`;
  if (!i) b.classList.add('on');
  b.onclick = () => {
    state.palette = p;
    sw.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    draw();
  };
  sw.appendChild(b);
});

loadImage('assets/logo.png').then(img => { state.logo = img; draw(); }).catch(() => {});
document.fonts.load('700 40px Oswald').then(draw).catch(() => {});

// ---------- Photo ----------
$('photo').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  showError('');
  const url = URL.createObjectURL(f);
  if (f.type.startsWith('video/') || /\.mov$/i.test(f.name)) {
    const v = $('frame-video');
    v.src = url;
    $('frame-picker').hidden = false;
    v.onloadedmetadata = () => { $('frame-time').max = v.duration.toFixed(2); v.currentTime = Math.min(1, v.duration / 2); };
    v.onerror = () => showError('Ce format de vidéo ne s\'affiche pas dans ton navigateur : fais une capture d\'écran et importe-la comme photo.');
    v.onseeked = () => grabFrame(v);
  } else {
    try {
      state.photo = await loadImage(url);
      state.panX = state.panY = 0;
      $('frame-picker').hidden = true;
      draw();
    } catch {
      showError('Photo illisible (les fichiers RAW comme .CR2 ne sont pas pris en charge : utilise le JPG).');
    }
  }
});
$('frame-time').addEventListener('input', e => { $('frame-video').currentTime = +e.target.value; });
$('btn-frame').onclick = () => { grabFrame($('frame-video')); $('frame-picker').hidden = true; };

function grabFrame(v) {
  if (!v.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = v.videoWidth;
  c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  state.photo = c;
  state.panX = state.panY = 0;
  draw();
}

// Glisser dans l'aperçu pour recadrer la photo.
let drag = null;
cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, px: state.panX, py: state.panY }; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const r = cv.getBoundingClientRect();
  state.panX = drag.px + (e.clientX - drag.x) / r.width;
  state.panY = drag.py + (e.clientY - drag.y) / r.height;
  draw();
});
cv.addEventListener('pointerup', () => { drag = null; });

// ---------- Dessin ----------
function fitText(ctx, text, maxW, size, weight = 700, family = 'Oswald, Impact, sans-serif') {
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxW && size > 10) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function wrapLines(ctx, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach(w => {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

function drawPhoto(ctx, W, H) {
  const p = state.photo;
  if (!p) {
    const g = ctx.createRadialGradient(W * 0.7, H * 0.3, 0, W * 0.5, H * 0.5, Math.max(W, H));
    g.addColorStop(0, '#2a1f33');
    g.addColorStop(1, '#0d0b12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  const pw = p.naturalWidth || p.width, ph = p.naturalHeight || p.height;
  const scale = Math.max(W / pw, H / ph) * +$('zoom').value;
  const dw = pw * scale, dh = ph * scale;
  const maxX = Math.max(0, (dw - W) / 2), maxY = Math.max(0, (dh - H) / 2);
  state.panX = Math.max(-maxX / W, Math.min(maxX / W, state.panX));
  state.panY = Math.max(-maxY / H, Math.min(maxY / H, state.panY));
  ctx.filter = `brightness(${$('bright').value}) contrast(${$('contrast').value}) saturate(${$('sat').value})`;
  ctx.drawImage(p, (W - dw) / 2 + state.panX * W, (H - dh) / 2 + state.panY * H, dw, dh);
  ctx.filter = 'none';
}

function draw() {
  const f = FORMATS[formatSel.value];
  const W = f.w, H = f.h;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const ctx = cv.getContext('2d');
  const { a, b } = state.palette;
  const base = Math.min(W, H);
  const tpl = $('template').value;
  const badge = $('t-badge').value.trim().toUpperCase();
  const title = $('t-title').value.trim().toUpperCase();
  const sub = $('t-sub').value.trim();
  const detail = $('t-detail').value.trim();
  const pad = base * 0.07;
  const landscape = W > H;

  if (tpl === 'brand') {
    // Modèle de marque Gravity : fond, halos et logo officiels (la photo n'est pas utilisée).
    drawBrandCard(ctx, W, H, $('show-logo').checked ? state.logo : null, { kicker: badge, title, sub, footer: detail })
      .then(updateLinks);
    return;
  }

  drawPhoto(ctx, W, H);

  // Assombrissement en dégradé, plus fort du côté du texte.
  const shade = +$('shade').value;
  const sg = landscape ? ctx.createLinearGradient(0, 0, W, 0) : ctx.createLinearGradient(0, H, 0, 0);
  sg.addColorStop(0, `rgba(13,11,18,${Math.min(1, shade + 0.35)})`);
  sg.addColorStop(0.6, `rgba(13,11,18,${shade * 0.6})`);
  sg.addColorStop(1, `rgba(13,11,18,${shade * 0.15})`);
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, W, H);

  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, a);
  grad.addColorStop(1, b);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  const textW = landscape ? W * 0.58 : W - pad * 2;

  if (tpl === 'highlight') {
    // Texte géant incliné + bande de couleur.
    ctx.save();
    ctx.translate(pad, landscape ? H * 0.62 : H * 0.72);
    ctx.rotate(-0.06);
    ctx.font = `700 ${base * 0.2}px Oswald, Impact, sans-serif`;
    const lines = wrapLines(ctx, title || 'HIGHLIGHTS', textW);
    let size = base * 0.2;
    if (lines.length > 2) size = fitText(ctx, lines[0], textW, size * 0.8);
    ctx.font = `700 ${size}px Oswald, Impact, sans-serif`;
    const shown = wrapLines(ctx, title || 'HIGHLIGHTS', textW).slice(0, 3);
    shown.forEach((l, i) => {
      const y = (i - shown.length + 1) * size * 1.02;
      ctx.fillStyle = i === shown.length - 1 ? grad : '#fff';
      ctx.shadowBlur = base * 0.02;
      ctx.fillText(l, 0, y);
    });
    ctx.shadowBlur = 0;
    if (sub) {
      const s = fitText(ctx, sub.toUpperCase(), textW, base * 0.055, 600, 'Inter, sans-serif');
      ctx.fillStyle = grad;
      ctx.fillRect(0, size * 0.25, ctx.measureText(sub.toUpperCase()).width + s, s * 1.6);
      ctx.fillStyle = '#fff';
      ctx.fillText(sub.toUpperCase(), s / 2, size * 0.25 + s * 1.15);
    }
    ctx.restore();
  } else {
    // Bloc de texte mesuré d'abord (dry), puis placé pour tenir dans l'image :
    // centré verticalement en paysage, calé en bas en portrait.
    const block = (y, dry) => {
      const y0 = y;
      if (badge && tpl !== 'announce') {
        const s = base * 0.045;
        ctx.font = `700 ${s}px Inter, sans-serif`;
        const bw = ctx.measureText(badge).width + s * 1.4;
        if (!dry) {
          ctx.fillStyle = grad;
          ctx.fillRect(pad, y - s * 1.3, bw, s * 1.8);
          ctx.fillStyle = '#fff';
          ctx.fillText(badge, pad + s * 0.7, y);
        }
        y += s * 1.6;
      }
      const tSize = tpl === 'player' ? base * 0.14 : base * 0.11;
      ctx.font = `700 ${tSize}px Oswald, Impact, sans-serif`;
      let lines = wrapLines(ctx, title, textW);
      let size = tSize;
      while (lines.length > 3 && size > 20) {
        size -= 4;
        ctx.font = `700 ${size}px Oswald, Impact, sans-serif`;
        lines = wrapLines(ctx, title, textW);
      }
      ctx.shadowBlur = base * 0.015;
      lines.forEach((l, i) => {
        y += size * (i ? 1 : 1.05);
        if (!dry) {
          ctx.fillStyle = tpl === 'player' && i === lines.length - 1 ? grad : '#fff';
          ctx.fillText(l, pad, y);
        }
      });
      ctx.shadowBlur = 0;
      // Filet de couleur sous le titre.
      y += size * 0.3;
      if (!dry) {
        ctx.fillStyle = grad;
        ctx.fillRect(pad, y, Math.min(textW, base * 0.3), base * 0.012);
      }
      y += base * 0.02;
      if (sub) {
        const s = fitText(ctx, sub, textW, base * 0.05, 600, 'Inter, sans-serif');
        y += s * 1.4;
        if (!dry) {
          ctx.fillStyle = '#fff';
          ctx.fillText(sub, pad, y);
        }
      }
      if (detail) {
        ctx.font = `400 ${base * 0.034}px Inter, sans-serif`;
        wrapLines(ctx, detail, textW).slice(0, 3).forEach(l => {
          y += base * 0.05;
          if (!dry) {
            ctx.fillStyle = 'rgba(255,255,255,.8)';
            ctx.fillText(l, pad, y);
          }
        });
      }
      return y - y0;
    };
    const height = block(0, true);
    const top = landscape ? (H - height) / 2 : H - pad * 1.3 - height;
    block(Math.max(pad * 1.5, top), false);
  }

  // Bande de couleur en bas.
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - base * 0.014, W, base * 0.014);

  if ($('show-logo').checked && state.logo) {
    const s = base * (landscape ? 0.2 : 0.17);
    ctx.shadowBlur = base * 0.02;
    ctx.drawImage(state.logo, W - s - pad * 0.6, pad * 0.6, s, s);
    ctx.shadowBlur = 0;
  }
  updateLinks();
}

document.querySelectorAll('input, select').forEach(el => {
  if (el.type !== 'file') el.addEventListener('input', draw);
});

// ---------- Export ----------
let linkTimer = null;
function updateLinks() {
  clearTimeout(linkTimer);
  linkTimer = setTimeout(() => {
    const name = slugify($('t-title').value, 'gravity-visuel');
    [['btn-png', 'image/png', 'png'], ['btn-jpg', 'image/jpeg', 'jpg']].forEach(([id, type, ext]) => {
      cv.toBlob(blob => {
        const a = $(id);
        if (a.href && a.href.startsWith('blob:')) URL.revokeObjectURL(a.href);
        a.href = URL.createObjectURL(blob);
        a.download = `${name}.${ext}`;
        if (ext === 'png') {
          const file = new File([blob], a.download, { type });
          const share = $('btn-share');
          share.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
          share.onclick = () => navigator.share({ files: [file] }).catch(() => {});
        }
      }, type, 0.92);
    });
  }, 250);
}

draw();
