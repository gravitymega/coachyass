// Bibliothèque de musique libre de droits du Studio beat.
// Source : Openverse (moteur de recherche Creative Commons, qui regroupe
// Freesound, Jamendo, ccMixter, Wikimedia…). Seules les licences qui
// permettent l'usage commercial ET la modification sont gardées.
// Module pur (aucun accès au DOM) : testable avec Node.

export const OPENVERSE = 'https://api.openverse.org/v1/audio/';

// cc0 / pdm : aucune condition. by : citer l'auteur.
// (by-sa est écarté : il obligerait à republier la vidéo sous la même licence.)
export const LICENSES = {
  cc0: { label: 'CC0', credit: false, text: 'Domaine public : aucune condition.' },
  pdm: { label: 'Domaine public', credit: false, text: 'Domaine public : aucune condition.' },
  by: { label: 'CC BY', credit: true, text: 'Libre, à condition de citer l\'auteur (crédit ci-dessous).' },
};

export const LICENSE_FILTERS = {
  credit: 'cc0,pdm,by',
  free: 'cc0,pdm',
};

// Thèmes proposés : un clic = une recherche prête.
export const THEMES = [
  { key: 'trap', label: 'Trap', q: 'trap beat' },
  { key: 'drill', label: 'Drill', q: 'drill beat' },
  { key: 'hiphop', label: 'Hip-hop / boom bap', q: 'hip hop beat' },
  { key: 'afro', label: 'Afro / amapiano', q: 'afrobeat' },
  { key: 'lofi', label: 'Lo-fi', q: 'lofi hip hop' },
  { key: 'epic', label: 'Épique / sport', q: 'epic sport' },
  { key: 'motivation', label: 'Motivation', q: 'motivational' },
  { key: 'edm', label: 'Électro / EDM', q: 'edm electronic' },
  { key: 'funk', label: 'Funk / groove', q: 'funk groove' },
  { key: 'chill', label: 'Chill / ambiance', q: 'chill ambient' },
  { key: 'rnb', label: 'R&B / soul', q: 'rnb soul' },
  { key: 'rock', label: 'Rock', q: 'rock instrumental' },
];

export function searchParams({ q, license = 'credit', page = 1, pageSize = 20 }) {
  const p = new URLSearchParams({
    q: String(q || '').trim().slice(0, 200),
    license: LICENSE_FILTERS[license] || LICENSE_FILTERS.credit,
    page: String(Math.max(1, Math.min(20, page | 0 || 1))),
    page_size: String(pageSize),
    mature: 'false',
  });
  return p.toString();
}

// Ne garde que les résultats exploitables (licence permise, fichier audio présent).
export function normalizeResults(json, license = 'credit') {
  const allowed = (LICENSE_FILTERS[license] || LICENSE_FILTERS.credit).split(',');
  return (json && Array.isArray(json.results) ? json.results : [])
    .filter(r => r && r.url && allowed.includes(String(r.license).toLowerCase()))
    .map(r => {
      const lic = String(r.license).toLowerCase();
      return {
        id: r.id,
        title: (r.title || 'Sans titre').trim(),
        creator: (r.creator || 'Auteur inconnu').trim(),
        license: lic,
        licenseLabel: LICENSES[lic].label + (r.license_version && lic === 'by' ? ' ' + r.license_version : ''),
        licenseUrl: r.license_url || '',
        needsCredit: LICENSES[lic].credit,
        source: r.source || r.provider || '',
        page: r.foreign_landing_url || '',
        url: r.url,
        duration: r.duration ? r.duration / 1000 : null,
        attribution: r.attribution || '',
      };
    });
}

// Texte de crédit à coller dans la description de la vidéo.
export function creditLine(track) {
  if (!track) return '';
  const lic = track.licenseLabel + (track.licenseUrl ? ` (${track.licenseUrl})` : '');
  const where = track.page ? ` — ${track.page}` : '';
  return `Musique : « ${track.title} » par ${track.creator}, ${lic}${where}. Modifiée avec Art craft.`;
}

// Hôtes d'où la fonction serveur accepte de télécharger un morceau.
export const AUDIO_HOSTS = [
  'cdn.freesound.org', 'freesound.org', 'ccmixter.org', 'upload.wikimedia.org',
  'jamendo.com', 'archive.org',
];

export function allowedAudioUrl(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'https:') return false;
  const h = u.hostname.toLowerCase();
  return AUDIO_HOSTS.some(a => h === a || h.endsWith('.' + a));
}

// ---------- Tempo ----------
// Estimation du tempo (BPM) d'un morceau : force des attaques (montée d'énergie
// par fenêtre de 10 ms), puis autocorrélation sur les tempos 70 à 180 BPM.
// samples : Float32Array mono ; rate : fréquence d'échantillonnage.
export function detectBpm(samples, rate, { min = 70, max = 180 } = {}) {
  const hop = Math.max(1, Math.round(rate * 0.01));
  const frames = Math.floor(samples.length / hop);
  if (frames < 400) return null;
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0;
    const off = f * hop;
    for (let i = 0; i < hop; i++) { const x = samples[off + i]; s += x * x; }
    energy[f] = Math.log(1e-9 + s / hop);
  }
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) onset[f] = Math.max(0, energy[f] - energy[f - 1]);
  let mean = 0;
  for (let f = 0; f < frames; f++) mean += onset[f];
  mean /= frames;
  for (let f = 0; f < frames; f++) onset[f] -= mean;
  const fps = rate / hop;
  const lagMin = Math.floor((60 / max) * fps), lagMax = Math.ceil((60 / min) * fps);
  const ac = lag => {
    let s = 0;
    for (let f = lag; f < frames; f++) s += onset[f] * onset[f - lag];
    return s / (frames - lag);
  };
  let best = 0, bestScore = -Infinity;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    // Les multiples du temps renforcent le bon tempo plutôt que sa moitié ou son double.
    // Légère préférence pour les tempos courants (autour de 110 BPM) contre les erreurs d'octave.
    const bpm = (60 * fps) / lag;
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 110) / 0.7) ** 2);
    const score = (ac(lag) + 0.5 * ac(2 * lag) + 0.25 * ac(4 * lag)) * prior;
    if (score > bestScore) { bestScore = score; best = lag; }
  }
  if (!best || !(bestScore > 0)) return null;
  // Affinage entre deux pas de 10 ms (interpolation parabolique).
  const a = ac(best - 1), b = ac(best), c = ac(best + 1);
  const d = a - 2 * b + c;
  const lag = best + (d ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / d)) : 0);
  return Math.round((60 * fps / lag) * 10) / 10;
}

// ---------- Filtres de transformation ----------
// Chaînes de filtres Web Audio (BiquadFilterNode), appliquées dans l'ordre.
export const FILTERS = {
  none: { label: 'Aucun', nodes: [] },
  lofi: { label: 'Lo-fi (chaud, étouffé)', nodes: [{ type: 'highpass', f: 110 }, { type: 'lowpass', f: 3200, Q: 0.7 }], drive: true },
  wall: { label: 'Derrière un mur (club d\'à côté)', nodes: [{ type: 'lowpass', f: 550, Q: 0.9 }] },
  radio: { label: 'Radio / téléphone', nodes: [{ type: 'highpass', f: 450 }, { type: 'peaking', f: 1600, gain: 6, Q: 1 }, { type: 'lowpass', f: 3800 }] },
  bass: { label: 'Basses renforcées', nodes: [{ type: 'lowshelf', f: 120, gain: 7 }] },
  bright: { label: 'Plus brillant', nodes: [{ type: 'highshelf', f: 5000, gain: 5 }] },
};

// Tempo de batterie (70 à 170 BPM, bornes du Studio beat) qui suit la musique
// jouée à la vitesse choisie : on double ou divise par deux pour rester dans les bornes.
export function syncTempo(musicBpm, speed, { min = 70, max = 170 } = {}) {
  if (!(musicBpm > 0) || !(speed > 0)) return null;
  let bpm = musicBpm * speed;
  while (bpm < min) bpm *= 2;
  while (bpm > max) bpm /= 2;
  bpm = Math.round(bpm * 10) / 10;
  // 4 mesures de 4 temps, en secondes de musique d'origine.
  return { bpm, loopSource: (16 * 60 / bpm) * speed };
}
