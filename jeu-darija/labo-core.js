// Le labo du Dr Harley (« Dr Ali ») : logique pure, testable avec Node (labo.test.mjs).
// Le plan complet est dans docs/contexte/dr-ali.md. Les missions sont des DONNÉES (labo-missions.js) qui utilisent
// des MOTEURS déjà prêts (act-labo.js). Une seule nouvelle mission par jour ; on peut rejouer les anciennes.

export const ENGINES = ['compter', 'robot', 'ranger', 'secret', 'maison', 'quiz', 'sons'];
export const DOMAINES = {
  maths: { e: '🔢', nom: 'Maths' }, code: { e: '🤖', nom: 'Code' }, ordi: { e: '🐧', nom: 'L’ordinateur' },
  sciences: { e: '🔬', nom: 'Sciences' }, enigme: { e: '🧩', nom: 'Énigme' }, maison: { e: '🏠', nom: 'Avec Papa ou Maman' },
  defi: { e: '🏆', nom: 'Défi du chapitre' },
};
// Les grades : nombre de chapitres finis (le dernier demande aussi le grand défi et le projet d'Ali).
export const GRADES = [
  { min: 0, nom: 'Visiteur du labo', e: '👋' },
  { min: 1, nom: 'Apprenti du labo', e: '🧪' },
  { min: 4, nom: 'Assistant de labo', e: '🥼' },
  { min: 8, nom: 'Technicien', e: '🔧' },
  { min: 12, nom: 'Ingénieur', e: '⚙️' },
  { min: 16, nom: 'Inventeur', e: '💡' },
  { min: 24, nom: 'Dr Ali, génie du labo', e: '🎓' },
];
// Répétition espacée : une notion revient 1, 3, 7, 14 puis 30 jours après.
export const ESPACEMENT = [1, 3, 7, 14, 30];

// ----- Dates (clé AAAA-MM-JJ, heure locale) -----
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (key, n) => { const [y, m, d] = key.split('-').map(Number); return dayKey(new Date(y, m - 1, d + n)); };

// ----- Les nombres en lettres (le docteur dit tout à voix haute) -----
const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
const D = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };
export function enLettres(n) {
  if (n < 0 || n > 100 || !Number.isInteger(n)) return String(n);
  if (n <= 16) return U[n];
  if (n < 20) return 'dix-' + U[n - 10];
  if (n === 100) return 'cent';
  if (n >= 80) return n === 80 ? 'quatre-vingts' : 'quatre-vingt-' + enLettres(n - 80);
  if (n >= 70) return n === 71 ? 'soixante-et-onze' : 'soixante-' + enLettres(n - 60);
  const d = Math.floor(n / 10), u = n % 10;
  return D[d] + (u === 0 ? '' : u === 1 ? '-et-un' : '-' + U[u]);
}

// ----- Valideur du format d'une mission (lancé par les tests avant chaque mise en ligne) -----
export function validateMission(m) {
  const err = [];
  if (!/^c\d+-m\d+$/.test(m.id || '')) err.push('id au format c1-m1');
  if (!DOMAINES[m.domaine]) err.push('domaine inconnu : ' + m.domaine);
  if (!m.titre) err.push('titre manquant');
  if (!Array.isArray(m.histoire) || !m.histoire.length) err.push('histoire : 1 à 3 phrases');
  if (!Array.isArray(m.notions) || !m.notions.length) err.push('notions manquantes');
  if (!Array.isArray(m.etapes) || !m.etapes.length) err.push('etapes manquantes');
  for (const [i, s] of (m.etapes || []).entries()) {
    if (!ENGINES.includes(s.moteur)) { err.push(`étape ${i} : moteur inconnu ${s.moteur}`); continue; }
    if (!s.consigne) err.push(`étape ${i} : consigne manquante`);
    if (s.moteur === 'compter' && !(s.min >= 1 && s.max >= s.min && s.max <= 100)) err.push(`étape ${i} : compter de min à max (1 à 100)`);
    if (s.moteur === 'robot') {
      const ok = robotSolution(s);
      if (!ok) err.push(`étape ${i} : robot sans solution`);
      else if (s.maxFleches && ok.length > s.maxFleches) err.push(`étape ${i} : la solution demande ${ok.length} flèches`);
    }
    if (s.moteur === 'ranger' && (!s.boites?.length || !s.objets?.every((o) => s.boites.some((b) => b.id === o.boite)))) err.push(`étape ${i} : chaque objet va dans une boîte qui existe`);
    if (s.moteur === 'secret' && !(s.mot && [...s.mot].every((l) => s.code?.[l]))) err.push(`étape ${i} : chaque lettre du mot a son dessin`);
    if ((s.moteur === 'quiz' || s.moteur === 'maison') && (s.questions || []).some((q) => (q.choix || []).filter((c) => c.bon).length !== 1)) err.push(`étape ${i} : une seule bonne réponse par question`);
    if (s.moteur === 'sons' && !(s.longueur >= 2 && s.longueur <= 6)) err.push(`étape ${i} : longueur des sons de 2 à 6`);
  }
  return err;
}

// ----- Bip, le robot sur la grille : où il arrive avec une suite de flèches -----
const DIR = { '↑': [0, -1], '↓': [0, 1], '←': [-1, 0], '→': [1, 0] };
const wall = (s, x, y) => x < 0 || y < 0 || x >= s.largeur || y >= s.hauteur || (s.murs || []).some(([a, b]) => a === x && b === y);
export function robotRun(s, fleches) {
  let [x, y] = s.depart; const chemin = [[x, y]];
  for (const f of fleches) {
    const [dx, dy] = DIR[f] || [0, 0];
    if (wall(s, x + dx, y + dy)) return { x, y, chemin, bloque: true };
    x += dx; y += dy; chemin.push([x, y]);
  }
  return { x, y, chemin, bloque: false, gagne: x === s.but[0] && y === s.but[1] };
}
// Le plus court chemin (pour l'indice et la solution montrée).
export function robotSolution(s) {
  const key = (x, y) => x + ',' + y, seen = new Map([[key(...s.depart), []]]), q = [s.depart];
  while (q.length) {
    const [x, y] = q.shift(), path = seen.get(key(x, y));
    if (x === s.but[0] && y === s.but[1]) return path;
    for (const [f, [dx, dy]] of Object.entries(DIR)) {
      const nx = x + dx, ny = y + dy;
      if (!wall(s, nx, ny) && !seen.has(key(nx, ny))) { seen.set(key(nx, ny), [...path, f]); q.push([nx, ny]); }
    }
  }
  return null;
}

// ----- L'état du labo d'un enfant (dans progress.labo) -----
export const newLabo = () => ({ faits: {}, essais: [], revues: {} });
// faits[id] = { premier: jour de la 1re réussite ou du 1er passage, fois, ok, essais, indices, solution, ms }
// revues[notion] = { niveau: 0..ESPACEMENT.length, due: jour, acquise }

// Une seule nouvelle mission par jour : la suivante s'ouvre si la précédente est faite, et pas déjà une nouvelle aujourd'hui.
export function missionsState(missions, labo, today, { libre = false } = {}) {
  const nouvAujourdhui = missions.some((m) => labo.faits[m.id]?.premier === today);
  let ouverte = true;
  return missions.map((m, i) => {
    const fait = !!labo.faits[m.id];
    let etat;
    if (fait) etat = 'faite';
    else if (ouverte && (i === 0 || labo.faits[missions[i - 1].id]) && (libre || !nouvAujourdhui)) etat = 'ouverte';
    else if (ouverte && (i === 0 || labo.faits[missions[i - 1].id])) etat = 'demain';
    else etat = 'fermee';
    if (!fait) ouverte = false;
    const revue = fait && m.notions.some((n) => labo.revues[n] && !labo.revues[n].acquise && labo.revues[n].due <= today);
    return { m, etat, revue };
  });
}

// Enregistre une mission jouée : résultat, essais, indices, temps ; met à jour les révisions (règles 6 et 7).
export function recordMission(labo, m, r, today) {
  const premiere = !labo.faits[m.id];
  const f = labo.faits[m.id] || { premier: today, fois: 0 };
  Object.assign(f, { fois: f.fois + 1, dernier: today, ok: r.ok, essais: r.essais, indices: r.indices, solution: !!r.solution, ms: r.ms });
  labo.faits[m.id] = f;
  labo.essais.push({ id: m.id, jour: today, ok: r.ok, essais: r.essais, indices: r.indices, solution: !!r.solution, ms: r.ms });
  if (labo.essais.length > 400) labo.essais.splice(0, labo.essais.length - 400);
  const difficile = !r.ok || r.solution || r.essais >= 3;
  const facile = r.ok && r.essais <= 1 && !r.indices;
  for (const n of m.notions) {
    const rv = labo.revues[n] || { niveau: 0, reussites: 0 };
    if (difficile) { rv.niveau = 0; rv.reussites = 0; rv.due = addDays(today, 1); rv.doux = true; }
    else {
      rv.reussites = (rv.reussites || 0) + (premiere || rv.due <= today ? 1 : 0);
      rv.niveau = Math.min(ESPACEMENT.length - 1, (premiere ? 0 : rv.niveau + 1) + (facile && !premiere ? 1 : 0));
      rv.due = addDays(today, ESPACEMENT[rv.niveau]);
      rv.doux = false; rv.monter = facile;
      if (rv.reussites >= 3) rv.acquise = true; // réussie 3 fois, espacées : elle ne revient plus que dans les défis
    }
    labo.revues[n] = rv;
  }
  return { premiere, difficile, facile };
}

export function chapitresFinis(chapitres, labo) {
  return chapitres.filter((c) => c.missions.length && c.missions.every((m) => labo.faits[m.id])).length;
}
export function gradeOf(chapitres, labo) {
  const n = chapitresFinis(chapitres, labo);
  return GRADES.filter((g) => n >= g.min).at(-1);
}

// Le bulletin du dimanche pour les parents : ce qu'Ali a appris, ce qui a été difficile, la mission en vrai qui vient, et une fierté.
export function bulletin(chapitres, labo, today, nom = 'Ali') {
  const debut = addDays(today, -6);
  const semaine = labo.essais.filter((e) => e.jour >= debut && e.jour <= today);
  const toutes = chapitres.flatMap((c) => c.missions);
  const titre = (id) => toutes.find((m) => m.id === id)?.titre || id;
  const reussies = [...new Set(semaine.filter((e) => e.ok && !e.solution).map((e) => e.id))].map(titre);
  const dures = [...new Set(semaine.filter((e) => !e.ok || e.solution || e.essais >= 3).map((e) => e.id))].map(titre);
  const prochaine = toutes.find((m) => m.domaine === 'maison' && !labo.faits[m.id]);
  const premierCoup = semaine.filter((e) => e.ok && e.essais <= 1).length;
  return [
    `Appris : ${reussies.length ? reussies.join(', ') : 'pas de mission cette semaine (aucun souci, on reprend doucement)'}.`,
    `Difficile : ${dures.length ? dures.join(', ') + ' (ça revient bientôt, en plus doux)' : 'rien de spécial'}.`,
    `Avec Papa ou Maman la semaine prochaine : ${prochaine ? prochaine.titre : 'à venir'}.`,
    `Fierté : ${premierCoup ? `${premierCoup} mission${premierCoup > 1 ? 's' : ''} réussie${premierCoup > 1 ? 's' : ''} du premier coup` : `${nom} a continué à essayer`}.`,
  ];
}
