// La ville de Hbibiti : un monde en blocs où l'on court, saute et parle aux habitants pour recevoir des missions.
// Ce fichier est pur (plan de la ville, habitants, missions) : testable avec Node. Le dessin et les commandes sont dans ville.js.
import { WORDS, wordsFor, makeQuestion, rng, shuffle } from './core.js';

export const H = 14; // hauteur du monde en blocs
export const GROUND = 10; // ligne du sol (le haut de l'herbe)
export const W = 468; // largeur du monde en blocs (très grande ville : 18 quartiers)

// Les blocs solides (on marche dessus) et le décor (derrière le personnage).
export const T = { AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, PLANK: 4, BRICK: 5, LEAVES: 6, LOG: 7, WHITE: 8, GLASS: 9, SAND: 10, ROOF: 11, GREEN: 12, GOLD: 13, CARPET: 14, LANTERN: 15, ZELLIGE: 16, PALM: 17, FROND: 18, WATER: 19, ARCH: 20, DOOR: 21, OCRE: 22, DUNE: 23 };

// Les quartiers, de gauche à droite. room : la salle de mots dont viennent les questions de l'habitant.
export const NPCS = [
  { id: 'maman', name: 'Maman', x: 9, room: 'maison', look: 'maman' },
  { id: 'papa', name: 'Papa', x: 15, room: 'vetements', look: 'papa' },
  { id: 'fifi', name: 'Fifi', x: 33, room: 'sport', look: 'fifi' },
  { id: 'hbibiti', name: 'Hbibiti', x: 48, room: 'cuisine', look: 'hbibiti' },
  { id: 'boulanger', name: 'Le boulanger', x: 56, room: 'marche', look: 'boulanger' },
  { id: 'maitresse', name: 'La maîtresse', x: 72, room: 'ecole', look: 'maitresse' },
  { id: 'imam', name: 'L’imam', x: 92, room: 'jardin', look: 'imam' },
  { id: 'fermier', name: 'Le fermier', x: 111, room: 'animaux', look: 'fermier' },
  { id: 'medecin', name: 'La docteure', x: 131, room: 'corps', look: 'medecin' },
  { id: 'assad', name: 'Assad', x: 152, room: 'stade', look: 'assad' },
  // La grande ville : les nouveaux quartiers et leurs habitants
  { id: 'chefgare', name: 'Le chef de gare', x: 180, room: 'appel', look: 'chefgare' },
  { id: 'pecheur', name: 'Le pêcheur', x: 210, room: 'animaux', look: 'pecheur' },
  { id: 'gardien', name: 'Le gardien de la kasbah', x: 228, room: 'hall', look: 'gardien' },
  { id: 'hammam', name: 'La dame du hammam', x: 252, room: 'corps', look: 'hammam' },
  { id: 'berger', name: 'Le berger', x: 277, room: 'ciel', look: 'berger' },
  { id: 'chamelier', name: 'Le chamelier', x: 314, room: 'gym', look: 'chamelier' },
  { id: 'gnawa', name: 'Le musicien gnaoua', x: 351, room: 'musique', look: 'gnawa' },
  { id: 'nageur', name: 'Le maître-nageur', x: 378, room: 'sport', look: 'nageur' },
  { id: 'berbere', name: 'Le grand-père du village', x: 409, room: 'fete', look: 'berbere' },
  { id: 'astronome', name: 'L’astronome', x: 449, room: 'emotions', look: 'astronome' },
];

export const ZONES = [
  { x: 2, w: 18, name: 'La maison' }, { x: 24, w: 16, name: 'Le parc' }, { x: 42, w: 20, name: 'Le souk' },
  { x: 64, w: 16, name: 'L’école' }, { x: 84, w: 18, name: 'La mosquée' }, { x: 104, w: 18, name: 'La ferme' },
  { x: 124, w: 16, name: 'Le dispensaire' }, { x: 144, w: 22, name: 'Le stade' },
  { x: 170, w: 18, name: 'La gare' }, { x: 190, w: 26, name: 'Le port' }, { x: 218, w: 24, name: 'La kasbah' },
  { x: 244, w: 16, name: 'Le hammam' }, { x: 262, w: 40, name: 'La forêt de l’Atlas' }, { x: 304, w: 38, name: 'Le désert' },
  { x: 344, w: 18, name: 'L’oasis' }, { x: 364, w: 30, name: 'La plage' }, { x: 396, w: 36, name: 'Le village' },
  { x: 434, w: 32, name: 'La colline aux étoiles' },
];

// Le plan de la ville (toujours le même : on apprend à s'y repérer).
export function makeWorld() {
  const solid = Array.from({ length: H }, () => new Array(W).fill(T.AIR));
  const deco = Array.from({ length: H }, () => new Array(W).fill(T.AIR));
  const ground = new Array(W).fill(GROUND);
  // Petites collines (1 ou 2 blocs), en escaliers pour qu'on puisse toujours monter.
  const hills = [[26, 30, 1], [27, 29, 2], [44, 46, 1], [100, 103, 1], [118, 121, 1], [119, 120, 2], [140, 142, 1],
    // la forêt de l'Atlas (on monte jusqu'à 3 blocs, une marche à la fois), les dunes du désert, la colline aux étoiles
    [264, 290, 1], [269, 285, 2], [274, 280, 3], [306, 312, 1], [309, 311, 2], [318, 326, 1], [320, 324, 2], [332, 336, 1],
    [436, 461, 1], [441, 457, 2], [446, 452, 3]];
  for (const [x0, x1, h] of hills) for (let x = x0; x <= x1; x++) ground[x] = Math.min(ground[x], GROUND - h);
  // Le sol : herbe, quai en pierre au port, sable du désert jusqu'à la plage.
  const surf = (x) => (x >= 302 && x <= 393 ? T.DUNE : x >= 190 && x <= 215 ? T.STONE : T.GRASS);
  for (let x = 0; x < W; x++) {
    const g = ground[x], top = surf(x);
    for (let y = g; y < H; y++) solid[y][x] = y === g ? top : top === T.DUNE && y < g + 3 ? T.DUNE : y < GROUND + 3 ? T.DIRT : T.STONE;
  }
  // Murs aux deux bouts.
  for (let y = 0; y < H; y++) { solid[y][0] = T.STONE; solid[y][W - 1] = T.STONE; }
  const fill = (grid, x, y, w, h, t) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (grid[j] && i > 0 && i < W - 1) grid[j][i] = t; };
  // Palmier : un tronc et des palmes qui retombent.
  const palm = (x) => {
    const g = ground[x];
    fill(deco, x, g - 4, 1, 4, T.PALM);
    fill(deco, x - 2, g - 5, 5, 1, T.FROND); fill(deco, x - 1, g - 6, 3, 1, T.FROND);
    fill(deco, x - 3, g - 4, 1, 1, T.FROND); fill(deco, x + 3, g - 4, 1, 1, T.FROND);
  };
  // Porte en arc outrepassé (comme dans les médinas) : l'arc en haut, la porte en bois en dessous.
  const door = (x, top) => { fill(deco, x, top, 1, 1, T.ARCH); fill(deco, x, top + 1, 1, GROUND - top - 1, T.DOOR); };
  const tree = (x) => { fill(deco, x, ground[x] - 3, 1, 3, T.LOG); fill(deco, x - 1, ground[x] - 5, 3, 2, T.LEAVES); fill(deco, x, ground[x] - 6, 1, 1, T.LEAVES); };
  // Maison : murs en briques, fenêtres, toit ; on peut sauter sur le toit (plateforme).
  fill(deco, 4, GROUND - 4, 9, 4, T.BRICK); fill(deco, 6, GROUND - 3, 2, 2, T.GLASS); fill(deco, 10, GROUND - 3, 2, 2, T.GLASS);
  fill(solid, 3, GROUND - 5, 11, 1, T.ROOF);
  door(8, GROUND - 3); palm(18); tree(23);
  // Parc : arbres et plateformes de bois pour sauter.
  tree(25); palm(39);
  fill(solid, 32, GROUND - 3, 3, 1, T.PLANK); fill(solid, 36, GROUND - 5, 3, 1, T.PLANK);
  // Souk : étals avec toiles colorées.
  for (const x of [43, 50, 58]) { fill(deco, x, GROUND - 3, 4, 3, T.PLANK); fill(solid, x - 1, GROUND - 4, 6, 1, T.SAND); }
  fill(solid, 40, GROUND - 2, 1, 1, T.PLANK);
  fill(deco, 53, GROUND - 3, 2, 2, T.ZELLIGE); fill(deco, 53, GROUND - 1, 2, 1, T.WATER); palm(61);
  // École.
  fill(deco, 65, GROUND - 5, 13, 5, T.WHITE); fill(deco, 67, GROUND - 4, 2, 2, T.GLASS); fill(deco, 71, GROUND - 4, 2, 2, T.GLASS); fill(deco, 75, GROUND - 4, 2, 2, T.GLASS);
  fill(solid, 64, GROUND - 6, 15, 1, T.ROOF);
  fill(deco, 65, GROUND - 1, 13, 1, T.ZELLIGE); door(73, GROUND - 3);
  // Mosquée : murs blancs, coupole verte, minaret.
  fill(deco, 86, GROUND - 5, 13, 5, T.WHITE); fill(deco, 89, GROUND - 7, 7, 2, T.GREEN); fill(deco, 90, GROUND - 8, 5, 1, T.GREEN);
  fill(deco, 92, GROUND - 9, 1, 1, T.GOLD); fill(deco, 99, GROUND - 9, 2, 9, T.WHITE); fill(deco, 99, GROUND - 10, 2, 1, T.GREEN);
  fill(deco, 88, GROUND - 3, 1, 2, T.GLASS); fill(deco, 96, GROUND - 3, 1, 2, T.GLASS);
  fill(deco, 86, GROUND - 1, 13, 1, T.ZELLIGE); door(90, GROUND - 3); door(94, GROUND - 3); palm(84); palm(102);
  // Ferme : grange, clôture (plateformes basses).
  fill(deco, 106, GROUND - 4, 7, 4, T.PLANK); fill(solid, 105, GROUND - 5, 9, 1, T.ROOF); tree(116);
  fill(solid, 114, GROUND - 2, 3, 1, T.PLANK);
  // Dispensaire.
  fill(deco, 125, GROUND - 4, 11, 4, T.WHITE); fill(deco, 129, GROUND - 3, 3, 3, T.GLASS); fill(solid, 124, GROUND - 5, 13, 1, T.ROOF);
  door(127, GROUND - 3);
  // Stade : tribunes en escaliers, buts.
  // Tribunes en pyramide : on monte et on redescend des deux côtés.
  for (let i = 0; i < 4; i++) fill(solid, 145 + i, GROUND - 1 - i, 1, 1 + i, T.STONE);
  for (let i = 0; i < 3; i++) fill(solid, 149 + i, GROUND - 3 + i, 1, 3 - i, T.STONE);
  fill(deco, 156, GROUND - 3, 1, 3, T.WHITE); fill(deco, 162, GROUND - 3, 1, 3, T.WHITE); fill(deco, 156, GROUND - 3, 7, 1, T.WHITE);
  // ---------- La grande ville ----------
  // La gare : grand bâtiment blanc, horloge dorée, toit où l'on peut monter.
  fill(deco, 172, GROUND - 4, 13, 4, T.WHITE); for (const x of [174, 177, 181]) fill(deco, x, GROUND - 3, 2, 2, T.GLASS);
  fill(deco, 178, GROUND - 6, 1, 1, T.GOLD); fill(solid, 171, GROUND - 5, 15, 1, T.ROOF);
  fill(solid, 168, GROUND - 2, 1, 1, T.PLANK); fill(solid, 170, GROUND - 4, 1, 1, T.PLANK);
  // Le port : la mer derrière le quai, des barques avec leur voile, un phare, des caisses.
  fill(deco, 190, GROUND - 3, 26, 3, T.WATER);
  for (const x of [194, 204]) { fill(deco, x, GROUND - 2, 4, 1, T.PLANK); fill(deco, x + 1, GROUND - 5, 1, 3, T.WHITE); fill(deco, x + 2, GROUND - 4, 1, 2, T.WHITE); }
  fill(deco, 214, GROUND - 7, 1, 7, T.WHITE); fill(deco, 214, GROUND - 8, 1, 1, T.ROOF); fill(deco, 214, GROUND - 9, 1, 1, T.GOLD);
  fill(solid, 199, GROUND - 1, 1, 1, T.PLANK); fill(solid, 200, GROUND - 2, 1, 2, T.PLANK);
  // La kasbah : remparts ocre avec deux tours crénelées, grande porte, chemin de ronde où l'on peut marcher.
  fill(deco, 219, GROUND - 5, 21, 5, T.OCRE); fill(deco, 219, GROUND - 7, 3, 2, T.OCRE); fill(deco, 237, GROUND - 7, 3, 2, T.OCRE);
  for (const x of [219, 221, 237, 239]) fill(deco, x, GROUND - 8, 1, 1, T.OCRE);
  fill(deco, 229, GROUND - 3, 1, 1, T.ARCH); fill(deco, 229, GROUND - 2, 1, 2, T.DOOR);
  fill(solid, 216, GROUND - 2, 1, 1, T.PLANK); fill(solid, 218, GROUND - 4, 1, 1, T.PLANK); fill(solid, 220, GROUND - 5, 1, 1, T.OCRE);
  fill(solid, 221, GROUND - 6, 18, 1, T.OCRE);
  // Le hammam : bâtiment blanc à coupoles, bandeau de zellige.
  fill(deco, 245, GROUND - 4, 13, 4, T.WHITE); fill(deco, 245, GROUND - 1, 13, 1, T.ZELLIGE);
  fill(deco, 248, GROUND - 5, 3, 1, T.WHITE); fill(deco, 249, GROUND - 6, 1, 1, T.WHITE); fill(deco, 253, GROUND - 5, 3, 1, T.WHITE); fill(deco, 254, GROUND - 6, 1, 1, T.WHITE);
  door(250, GROUND - 3);
  // La forêt de l'Atlas : des cèdres sur les collines.
  for (const x of [263, 268, 272, 277, 283, 288, 295, 299]) tree(x);
  // Le désert et l'oasis : palmiers, bassin, tente rayée.
  palm(316); palm(329); palm(340);
  fill(deco, 348, GROUND - 1, 7, 1, T.WATER); palm(346); palm(357);
  fill(deco, 350, GROUND - 4, 4, 1, T.SAND); fill(deco, 350, GROUND - 3, 1, 3, T.PLANK); fill(deco, 353, GROUND - 3, 1, 3, T.PLANK);
  // La plage : la mer, des parasols, un château de sable.
  fill(deco, 366, GROUND - 3, 27, 3, T.WATER);
  for (const x of [370, 385]) { fill(deco, x, GROUND - 3, 1, 3, T.WHITE); fill(deco, x - 1, GROUND - 4, 3, 1, T.SAND); }
  fill(deco, 375, GROUND - 1, 3, 1, T.DUNE); fill(deco, 376, GROUND - 2, 1, 1, T.DUNE);
  // Le village berbère : maisons ocre aux toits plats, et une grande porte (bab).
  fill(deco, 398, GROUND - 4, 8, 4, T.OCRE); door(401, GROUND - 3); fill(solid, 397, GROUND - 5, 10, 1, T.OCRE);
  fill(solid, 394, GROUND - 2, 1, 1, T.PLANK); fill(solid, 396, GROUND - 4, 1, 1, T.PLANK);
  fill(deco, 413, GROUND - 3, 7, 3, T.OCRE); door(416, GROUND - 2);
  fill(deco, 424, GROUND - 5, 1, 5, T.OCRE); fill(deco, 428, GROUND - 5, 1, 5, T.OCRE); fill(deco, 424, GROUND - 6, 5, 1, T.OCRE); fill(deco, 426, GROUND - 5, 1, 1, T.ARCH);
  // La colline aux étoiles : un petit observatoire tout en haut.
  fill(deco, 448, ground[448] - 2, 3, 2, T.WHITE); fill(deco, 449, ground[449] - 3, 1, 1, T.WHITE); fill(deco, 451, ground[451] - 3, 1, 1, T.STONE);
  tree(438); palm(459);

  // Marches pour monter sur les toits (on saute au plus de 2 blocs).
  fill(solid, 1, GROUND - 3, 2, 1, T.PLANK); fill(solid, 63, GROUND - 5, 1, 1, T.PLANK);
  fill(solid, 117, GROUND - 4, 2, 1, T.PLANK); fill(solid, 122, GROUND - 4, 2, 1, T.PLANK);
  // Endroits où l'on peut cacher des objets (au sol et sur les plateformes), et des pièces.
  const spots = [];
  for (let x = 2; x < W - 2; x++) {
    let top = 0; while (top < H && !solid[top][x]) top++;
    if (top > 2 && !NPCS.some((n) => Math.abs(n.x - x) < 2)) spots.push({ x: x + 0.5, y: top - 0.6, high: top < ground[x] });
  }
  return { solid, deco, ground, spots };
}

export const isSolid = (world, x, y) => {
  if (x < 0 || x >= W) return true;
  if (y < 0) return false;
  if (y >= H) return true;
  return world.solid[Math.floor(y)][Math.floor(x)] !== T.AIR;
};

// ---------- Construire (comme dans Minecraft) ----------
// Les blocs qu'on achète avec les pièces gagnées. Les constructions des enfants sont gardées à part (clé "x,y").
export const SHOP = [
  { t: T.PLANK, name: 'Bois', price: 1 }, { t: T.STONE, name: 'Pierre', price: 1 }, { t: T.BRICK, name: 'Brique', price: 2 },
  { t: T.WHITE, name: 'Mur blanc', price: 2 }, { t: T.GLASS, name: 'Verre', price: 2 }, { t: T.ROOF, name: 'Toit', price: 2 },
  { t: T.CARPET, name: 'Tapis', price: 3 }, { t: T.GREEN, name: 'Coupole', price: 3 }, { t: T.LANTERN, name: 'Lanterne', price: 4 },
  { t: T.GOLD, name: 'Or', price: 5 },
];
// On peut poser un bloc dans le vide, pas sur un habitant ni sur l'enfant, et collé à un autre bloc (comme dans Minecraft).
export function canPlace(world, x, y, { px = -9, py = -9 } = {}) {
  if (x < 1 || x >= W - 1 || y < 1 || y >= H) return false;
  if (world.solid[y][x] !== T.AIR) return false;
  if (NPCS.some((n) => Math.floor(n.x) === x && y >= world.ground[x] - 2)) return false;
  if (Math.floor(px) === x && y >= Math.floor(py - 1.75) && y < py) return false;
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => world.solid[y + dy]?.[x + dx]);
}
export function applyBuild(world, blocks) {
  for (const [k, t] of Object.entries(blocks || {})) {
    const [x, y] = k.split(',').map(Number);
    if (world.solid[y]?.[x] === T.AIR && x > 0 && x < W - 1) world.solid[y][x] = t;
  }
}

// ---------- Missions des habitants ----------
// Chaque habitant donne d'abord une question (un mot de sa salle), puis une mission « ramène-moi 3 … » :
// les objets sont cachés en ville, souvent en hauteur (il faut sauter !). On recommence avec d'autres mots.
const withEmoji = (room, older) => wordsFor(room, older).filter((w) => w.emoji && !w.phrase);

export function newQuests(seed = Date.now()) {
  return Object.fromEntries(NPCS.map((n, i) => [n.id, { step: 0, round: 0, seed: seed + i * 97 }]));
}

export function askQuestion(npc, state, { older, dialects = ['ma', 'dz'] } = {}) {
  const r = rng(state.seed + state.round * 13 + 1);
  const pool = npc.room === 'jardin' ? wordsFor('jardin', older) : wordsFor(npc.room, older);
  const word = pool[Math.floor(r() * pool.length)];
  const dialect = dialects[Math.floor(r() * dialects.length)];
  return makeQuestion(word, pool, { older, dialect, dialects, r });
}

// Mission de recherche : un objet de la salle de l'habitant, 3 exemplaires cachés à des endroits différents.
export function fetchQuest(npc, state, world, { older, count = 3, room: only } = {}) {
  const r = rng(state.seed + state.round * 31 + 7);
  const room = only || (npc.room === 'jardin' ? 'cuisine' : npc.room);
  const pool = withEmoji(room, older);
  const word = pool[Math.floor(r() * pool.length)];
  // Au moins un objet en hauteur, les autres loin de l'habitant pour obliger à se balader.
  const far = world.spots.filter((s) => Math.abs(s.x - npc.x) > 12);
  const high = shuffle(far.filter((s) => s.high), r);
  const low = shuffle(far.filter((s) => !s.high), r);
  const picks = [...high.slice(0, 1), ...low].filter((s, i, a) => a.findIndex((o) => Math.abs(o.x - s.x) < 6) === i).slice(0, count);
  return { word, items: picks.map((s, i) => ({ id: i, x: s.x, y: s.y, taken: false })) };
}

// Les pièces à ramasser en se baladant (une partie sur les hauteurs).
export function coinSpots(world, seed = 1, count = 110) {
  const r = rng(seed);
  return shuffle(world.spots, r).filter((s, i, a) => a.findIndex((o) => Math.abs(o.x - s.x) < 2.5) === i).slice(0, count)
    .map((s, i) => ({ id: i, x: s.x, y: s.y - (s.high ? 0 : 0.4), taken: false }));
}

// L'habitant le plus proche qui a encore quelque chose à demander.
export function nextGiver(quests, x) {
  return NPCS.filter((n) => quests[n.id].step < 2).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0] || null;
}

export const wordById = (id) => WORDS.find((w) => w.id === id);
