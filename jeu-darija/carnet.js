// Le carnet de fierté : ce que l'enfant a appris cette semaine, à montrer aux grands-parents.
// Chaque jour joué, on garde une photo des compteurs (progress.days) ; la semaine = aujourd'hui moins il y a 7 jours.
// Logique pure, testable avec Node.
import { WORDS, today } from './core.js';

const KNOWN = 2; // boîte à partir de laquelle un mot est « bien su »
const KEEP = 60; // jours gardés

export function snapshot(progress) {
  const known = Object.entries(progress.words || {}).filter(([, w]) => (w.box || 0) >= KNOWN).map(([id]) => id);
  return {
    stars: progress.stars || 0, levels: progress.levels || 0, gold: progress.gold || 0,
    tales: Object.keys(progress.tales || {}).length, ville: progress.ville || 0, known,
  };
}

export function recordDay(progress, date = today()) {
  const days = progress.days || (progress.days = {});
  days[date] = snapshot(progress);
  const keys = Object.keys(days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete days[k];
}

const shift = (date, n) => { const d = new Date(date + 'T12:00:00'); d.setDate(d.getDate() + n); return today(d); };

export function weekReport(progress, date = today()) {
  const days = progress.days || {};
  const start = shift(date, -6);
  const before = Object.keys(days).filter((k) => k < start).sort().pop();
  const base = before ? days[before] : { stars: 0, levels: 0, gold: 0, tales: 0, ville: 0, known: [] };
  const cur = snapshot(progress);
  const had = new Set(base.known);
  const fresh = cur.known.filter((id) => !had.has(id));
  const played = Object.keys(days).filter((k) => k >= start && k <= date).sort();
  let prev = base;
  const active = played.filter((k) => { const d = days[k]; const moved = d.stars !== prev.stars || d.levels !== prev.levels; prev = d; return moved; });
  return {
    from: start, to: date, days: active.length,
    stars: cur.stars - base.stars, levels: cur.levels - base.levels, missions: cur.gold - base.gold,
    tales: cur.tales - base.tales, ville: cur.ville - base.ville,
    words: fresh.map((id) => WORDS.find((w) => w.id === id)).filter(Boolean),
    english: fresh.filter((id) => id.startsWith('en:')).length,
    skills: fresh.filter((id) => id.startsWith('x:')).length,
    totalWords: cur.known.filter((id) => WORDS.some((w) => w.id === id)).length,
  };
}

// Le message à envoyer aux grands-parents (WhatsApp, SMS…).
export function reportText(name, r, dialects = ['ma', 'dz']) {
  const lines = [`🏆 Le carnet de fierté de ${name} (${r.days} jour${r.days > 1 ? 's' : ''} de jeu cette semaine)`];
  if (r.words.length) {
    lines.push(`📚 ${r.words.length} nouveau${r.words.length > 1 ? 'x' : ''} mot${r.words.length > 1 ? 's' : ''} en darija :`);
    for (const w of r.words.slice(0, 12)) lines.push(`  ${w.emoji || '•'} ${w.fr} : ${[...new Set(dialects.map((d) => w[d]?.lat).filter(Boolean))].join(' / ')}`);
    if (r.words.length > 12) lines.push(`  … et ${r.words.length - 12} autres`);
  }
  if (r.english) lines.push(`🇬🇧 ${r.english} mot(s) en anglais`);
  if (r.skills) lines.push(`🧮 ${r.skills} compétence(s) d'école (maths, lecture, lettres arabes)`);
  if (r.tales) lines.push(`📖 ${r.tales} histoire(s) écoutée(s)`);
  if (r.missions) lines.push(`🏅 ${r.missions} mission(s) de Papa et Maman réussie(s)`);
  if (r.ville) lines.push(`🏙️ ${r.ville} habitant(s) aidé(s) en ville`);
  lines.push(`⭐ ${r.stars} étoile(s) · ${r.totalWords} mots de darija bien sus en tout. Machallah !`);
  return lines.join('\n');
}
