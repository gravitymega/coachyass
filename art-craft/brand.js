// Kit de marque Gravity : couleurs, coordonnées et cartes d'intro/outro,
// proposés par défaut dans tous les modules d'Art craft.

export const BRAND = {
  name: 'Gravity Basketball',
  city: 'Montréal',
  site: 'gravity.osmm-mtl.site',
  instagram: '@gravitybasketball_mtl',
  orange: '#e8672e',
  magenta: '#d81e5b',
  dark: '#0d0b12',
};

// Carte plein écran aux couleurs Gravity (intro, outro, visuel).
// kicker : petite étiquette au-dessus du titre ; footer : ligne en bas.
export async function drawBrandCard(ctx, W, H, logo, { kicker = '', title = '', sub = '', footer = '' } = {}) {
  try { await document.fonts.load(`700 ${Math.round(Math.min(W, H) * 0.1)}px Oswald`); } catch { /* police de secours */ }
  const base = Math.min(W, H);
  ctx.fillStyle = BRAND.dark;
  ctx.fillRect(0, 0, W, H);
  // Halos orange et magenta.
  [[0.15, 0.1, BRAND.orange], [0.9, 0.85, BRAND.magenta]].forEach(([x, y, c]) => {
    const g = ctx.createRadialGradient(W * x, H * y, 0, W * x, H * y, Math.max(W, H) * 0.7);
    g.addColorStop(0, c + '88');
    g.addColorStop(1, c + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  });
  // Lignes diagonales discrètes (texture « parquet »).
  ctx.strokeStyle = 'rgba(255,255,255,.05)';
  ctx.lineWidth = base * 0.004;
  for (let x = -H; x < W; x += base * 0.08) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + H, 0);
    ctx.stroke();
  }
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, BRAND.orange);
  grad.addColorStop(1, BRAND.magenta);

  const cx = W / 2;
  const hasText = kicker || title || sub;
  const logoSize = base * (hasText ? 0.34 : 0.5);
  let y = hasText ? H * 0.5 - logoSize * 0.9 : (H - logoSize) / 2;
  if (logo) {
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = base * 0.04;
    ctx.drawImage(logo, cx - logoSize / 2, y, logoSize, logoSize);
    ctx.shadowBlur = 0;
  }
  y += logoSize + base * 0.08;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const fit = (text, size, font) => {
    ctx.font = `${font.replace('{s}', size)}`;
    while (ctx.measureText(text).width > W * 0.86 && size > 10) {
      size -= 2;
      ctx.font = `${font.replace('{s}', size)}`;
    }
    return size;
  };
  if (kicker) {
    const s = fit(kicker.toUpperCase(), base * 0.04, '700 {s}px Inter, sans-serif');
    const tw = ctx.measureText(kicker.toUpperCase()).width;
    ctx.fillStyle = grad;
    ctx.fillRect(cx - tw / 2 - s * 0.7, y - s * 1.25, tw + s * 1.4, s * 1.75);
    ctx.fillStyle = '#fff';
    ctx.fillText(kicker.toUpperCase(), cx, y);
    y += s * 1.9;
  }
  if (title) {
    const s = fit(title.toUpperCase(), base * 0.1, '700 {s}px Oswald, Impact, sans-serif');
    y += s * 0.75;
    ctx.fillStyle = '#fff';
    ctx.fillText(title.toUpperCase(), cx, y);
    y += s * 0.45;
  }
  if (sub) {
    const s = fit(sub, base * 0.045, '600 {s}px Inter, sans-serif');
    y += s * 1.2;
    ctx.fillStyle = '#ff8a4c';
    ctx.fillText(sub, cx, y);
  }
  if (footer) {
    const s = fit(footer, base * 0.034, '500 {s}px Inter, sans-serif');
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    ctx.fillText(footer, cx, H - base * 0.08);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - base * 0.12, H - base * 0.08 - s * 1.6, base * 0.24, base * 0.008);
  }
}

// Carte de fin standard : invite à suivre Gravity.
export const OUTRO = { kicker: 'Suis-nous', title: BRAND.instagram, sub: BRAND.name + ' · ' + BRAND.city, footer: BRAND.site };

export async function brandCardPNG(W, H, logo, text) {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  await drawBrandCard(cv.getContext('2d'), W, H, logo, text);
  const blob = await new Promise(res => cv.toBlob(res, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}
