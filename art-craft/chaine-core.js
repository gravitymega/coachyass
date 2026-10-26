// Gardien de la chaîne YouTube Gravity Basketball : logique pure, testable avec Node.
// Tous les 2 jours, le Worker Cloudflare relit les vidéos de la chaîne :
// - corrige seul la description (bloc Gravity + hashtags ajoutés à la fin, texte existant gardé)
//   et les tags (mots-clés manquants ajoutés) ;
// - ne renomme JAMAIS un titre : les titres à revoir vont dans le rapport, avec une proposition ;
// - signale les vidéos sans miniature Gravity (préparée et envoyée depuis la page « Ma chaîne »).

export const BLOCK_START = '— Gravity Basketball (Art craft) —';
export const BLOCK_END = '— fin Gravity —';
export const DESCRIPTION_MAX = 5000;
export const TITLE_MAX = 100;     // limite YouTube
export const TITLE_SHOWN = 70;    // au-delà, le titre est coupé dans les résultats de recherche
export const TAGS_MAX = 500;      // limite YouTube (caractères, guillemets compris)
export const HASHTAGS_MAX = 15;   // au-delà, YouTube ignore tous les hashtags de la vidéo

export const DEFAULT_CONFIG = {
  enabled: true,
  footer: [
    '🏀 Programmes, équipes et inscriptions : https://gravity.osmm-mtl.site',
    '📸 Instagram : https://www.instagram.com/gravitybasketball_mtl',
    '',
    '#GravityBasketball #BasketballMontreal #Montreal',
  ].join('\n'),
  tags: ['Gravity Basketball', 'basketball Montréal', 'basketball', 'Montréal', 'Gravity'],
};

// Config enregistrée (ou rien) → config complète et propre.
export function normalizeConfig(c = {}) {
  const footer = typeof c.footer === 'string' ? c.footer.replace(/\r/g, '').trim().slice(0, 1500) : DEFAULT_CONFIG.footer;
  const tags = Array.isArray(c.tags)
    ? [...new Set(c.tags.map(t => String(t).replace(/[<>,]/g, '').trim()).filter(Boolean))].slice(0, 30)
    : DEFAULT_CONFIG.tags;
  return { enabled: c.enabled !== false, footer, tags };
}

export const hashtagsIn = text => [...new Set((String(text || '').match(/#[\p{L}\p{N}_]+/gu) || []).map(h => h.toLowerCase()))];

export const brandBlock = cfg => `${BLOCK_START}\n${normalizeConfig(cfg).footer}\n${BLOCK_END}`;

// Description sans le bloc Gravity (s'il y est).
export function stripBlock(description) {
  let d = String(description || '');
  const i = d.indexOf(BLOCK_START);
  if (i < 0) return d;
  const j = d.indexOf(BLOCK_END, i);
  d = d.slice(0, i) + (j >= 0 ? d.slice(j + BLOCK_END.length) : '');
  return d.replace(/\n{3,}/g, '\n\n');
}

// Ajoute (ou remplace) le bloc Gravity à la fin de la description ; le reste du texte est gardé.
export function withBrandBlock(description, cfg) {
  const block = brandBlock(cfg);
  const base = stripBlock(description).trimEnd();
  const room = DESCRIPTION_MAX - block.length - 2;
  return (base ? base.slice(0, Math.max(0, room)).trimEnd() + '\n\n' : '') + block;
}

// Longueur des tags comptée comme YouTube : virgules, et guillemets autour des tags avec espace.
export const tagsLength = tags => tags.reduce((n, t, i) => n + t.length + (/\s/.test(t) ? 2 : 0) + (i ? 1 : 0), 0);

// Ajoute les mots-clés Gravity manquants, tant que la limite de 500 caractères le permet.
export function mergeTags(tags = [], wanted = []) {
  const out = [...tags];
  const have = new Set(out.map(t => t.toLowerCase()));
  for (const t of wanted) {
    if (have.has(t.toLowerCase())) continue;
    if (tagsLength([...out, t]) > TAGS_MAX) continue;
    out.push(t);
    have.add(t.toLowerCase());
  }
  return out;
}

// Problèmes d'un titre (jamais corrigés seuls) + proposition.
export function titleReview(title, { date } = {}) {
  const t = String(title || '');
  const issues = [];
  let suggestion = t.replace(/\s+/g, ' ').trim();
  if (/^(img|vid|mov|pxl|dsc|gopr|mvi)[_-]?\d+|^(untitled|sans titre|new video|nouvelle vidéo)\b/i.test(suggestion) || !suggestion) {
    issues.push('titre automatique (nom de fichier)');
    suggestion = `Gravity Basketball — ${date ? new Date(date).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' }) : 'match'}`;
  }
  const letters = suggestion.replace(/[^\p{L}]/gu, '');
  if (letters.length > 10 && letters === letters.toUpperCase()) {
    issues.push('tout en majuscules');
    suggestion = suggestion.charAt(0) + suggestion.slice(1).toLowerCase();
  }
  if (t !== t.replace(/\s+/g, ' ').trim()) issues.push('espaces en trop');
  if (!/gravity/i.test(suggestion)) {
    issues.push('ne mentionne pas Gravity');
    const withBrand = `${suggestion} | Gravity Basketball`;
    if (withBrand.length <= TITLE_MAX) suggestion = withBrand;
  }
  if (suggestion.length > TITLE_SHOWN) issues.push(`${suggestion.length} caractères (coupé après ${TITLE_SHOWN} dans la recherche)`);
  return { issues, suggestion: suggestion === t ? '' : suggestion.slice(0, TITLE_MAX) };
}

/**
 * Vérifie une vidéo (objet de l'API YouTube : id, snippet). thumbs = vidéos dont la miniature
 * Gravity est faite (ou jugée bonne). Renvoie la nouvelle snippet à envoyer (ou null) et les remarques.
 */
export function auditVideo(video, cfg, thumbs = {}) {
  const c = normalizeConfig(cfg);
  const sn = video.snippet || {};
  const out = { id: video.id, title: sn.title || '', fixes: [], titleIssues: [], titleSuggestion: '', hashtagIssue: '', needsThumb: false, snippet: null };
  if (sn.liveBroadcastContent && sn.liveBroadcastContent !== 'none') return { ...out, skipped: 'live en cours ou programmé' };

  const description = withBrandBlock(sn.description, c);
  if (description !== (sn.description || '')) out.fixes.push(String(sn.description || '').includes(BLOCK_START) ? 'bloc Gravity mis à jour' : 'bloc Gravity + hashtags ajoutés');
  const tags = mergeTags(sn.tags || [], c.tags);
  if (tags.length !== (sn.tags || []).length) out.fixes.push(`${tags.length - (sn.tags || []).length} mot(s)-clé(s) ajouté(s)`);
  if (out.fixes.length) {
    out.snippet = { title: sn.title, categoryId: sn.categoryId, description, tags };
    ['defaultLanguage', 'defaultAudioLanguage'].forEach(k => { if (sn[k]) out.snippet[k] = sn[k]; });
  }

  const n = hashtagsIn(`${sn.title || ''}\n${description}`).length;
  if (n > HASHTAGS_MAX) out.hashtagIssue = `${n} hashtags : au-delà de ${HASHTAGS_MAX}, YouTube les ignore tous (enlève-en dans ton texte)`;
  const tr = titleReview(sn.title, { date: sn.publishedAt });
  out.titleIssues = tr.issues;
  out.titleSuggestion = tr.suggestion;
  out.needsThumb = !thumbs[video.id];
  return out;
}

// Rapport en texte (courriel).
export function reportText(r) {
  const lines = [`Gardien de chaîne — ${r.channel || 'YouTube'} — ${new Date(r.at).toLocaleString('fr-CA', { timeZone: 'America/Toronto' })}`, ''];
  lines.push(`${r.checked} vidéo(s) vérifiée(s), ${r.updated.length} corrigée(s) automatiquement.`);
  if (r.pending) lines.push(`${r.pending} autre(s) à corriger au prochain passage (limite de quota YouTube).`);
  r.updated.forEach(v => lines.push(`  ✔ ${v.title} — ${v.fixes.join(', ')}`));
  if (r.titles.length) {
    lines.push('', 'Titres à revoir (jamais changés sans toi) :');
    r.titles.forEach(v => lines.push(`  • ${v.title} — ${v.issues.join(', ')}${v.suggestion ? `\n    proposé : ${v.suggestion}` : ''}`));
  }
  if (r.hashtags.length) {
    lines.push('', 'Hashtags :');
    r.hashtags.forEach(v => lines.push(`  • ${v.title} — ${v.issue}`));
  }
  if (r.thumbs.length) lines.push('', `${r.thumbs.length} vidéo(s) sans miniature Gravity : prépare-les dans Art craft → Ma chaîne.`);
  if (r.errors.length) lines.push('', 'Erreurs :', ...r.errors.map(e => `  ! ${e}`));
  return lines.join('\n');
}
