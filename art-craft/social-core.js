// Publication d'un highlight sur Instagram / Facebook : légende, hashtags, débit.
// Module pur (aucun accès au DOM ni au réseau) : testable avec Node.

// Limites Instagram : 2 200 caractères et 30 hashtags par légende.
export const MAX_CAPTION = 2200;
export const MAX_TAGS = 30;

export const DEFAULT_TAGS = [
  'GravityBasketball', 'basketball', 'Montreal', 'MTL', 'highlights',
  'hoops', 'basketballmontreal', 'ballislife',
];

// « #Gravity, basket mtl #MTL » → ['Gravity', 'basket', 'mtl'] (sans doublon,
// insensible à la casse, lettres accentuées, chiffres et _ seulement).
export function normalizeTags(text) {
  const seen = new Set();
  const out = [];
  String(text || '').split(/[\s,;#]+/).forEach(raw => {
    const tag = raw.replace(/[^\p{L}\p{N}_]/gu, '');
    const key = tag.toLowerCase();
    if (!tag || seen.has(key) || out.length >= MAX_TAGS) return;
    seen.add(key);
    out.push(tag);
  });
  return out;
}

export function buildCaption({ title = '', subtitle = '', text = '', tags = [] } = {}) {
  const head = [title.trim(), subtitle.trim()].filter(Boolean).join(' · ');
  const blocks = [head, text.trim(), tags.map(t => '#' + t).join(' ')].filter(Boolean);
  return blocks.join('\n\n').slice(0, MAX_CAPTION);
}

// Plafond de débit vidéo (kb/s) pour que le fichier reste sous ~90 Mo (limite
// de 100 Mo du stockage Supabase qui sert de relais vers Meta) et à un débit
// que les réseaux sociaux ne réduiront pas beaucoup.
export function uploadKbps(totalS, width, { maxBytes = 90e6, audioKbps = 160 } = {}) {
  const cap = width >= 1080 ? 8000 : 5000;
  const fit = (maxBytes * 8) / Math.max(1, totalS) / 1000 - audioKbps;
  return Math.max(1500, Math.min(cap, Math.floor(fit)));
}
