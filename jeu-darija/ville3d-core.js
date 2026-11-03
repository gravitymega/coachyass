// La ville en 3D (façon Minecraft) : plan du monde en blocs, collisions, habitants et objets à trouver.
// Logique pure, testable avec Node. Le dessin (Three.js) et les commandes sont dans ville3d.js.
import { wordsFor } from './core.js';
import { NPCS } from './ville-core.js';

export const N = 36; // taille du monde (x et z)
export const HMAX = 14; // hauteur maximale
// Types de blocs (la couleur et la texture sont dans ville3d.js)
export const B = {
  AIR: 0, GRASS: 1, SAND: 2, WHITE: 3, OCRE: 4, ZELLIGE: 5, GREEN: 6, GOLD: 7, DOOR: 8, PLANK: 9,
  TENT: 10, PALM: 11, FROND: 12, WATER: 13, WALL: 14, STONE: 15, BLUE: 16, CARPET: 17,
};

export function makeWorld3d() {
  const cells = new Uint8Array(N * HMAX * N);
  const idx = (x, y, z) => (y * N + z) * N + x;
  const set = (x, y, z, t) => { if (x >= 0 && x < N && z >= 0 && z < N && y >= 0 && y < HMAX) cells[idx(x, y, z)] = t; };
  const box = (x0, y0, z0, w, h, d, t) => { for (let y = y0; y < y0 + h; y++) for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) set(x, y, z, t); };
  // Le sol : herbe, rues en sable et place centrale.
  box(0, 0, 0, N, 1, N, B.GRASS);
  box(0, 0, 16, N, 1, 4, B.SAND); box(16, 0, 0, 4, 1, N, B.SAND);
  // Les remparts de la kasbah, avec des créneaux.
  for (let i = 0; i < N; i++) for (const [x, z] of [[i, 0], [i, N - 1], [0, i], [N - 1, i]]) {
    box(x, 1, z, 1, 3, 1, B.WALL);
    if (i % 2 === 0) set(x, 4, z, B.WALL);
  }
  // Fontaine en zellige au milieu de la place.
  box(16, 1, 16, 4, 1, 4, B.ZELLIGE); box(17, 1, 17, 2, 1, 2, B.WATER);
  // La mosquée : murs blancs, bandeau de zellige, porte, coupole verte et minaret.
  box(22, 1, 3, 9, 4, 9, B.WHITE); box(22, 1, 3, 9, 1, 9, B.ZELLIGE);
  box(26, 1, 11, 1, 2, 1, B.DOOR);
  box(24, 5, 5, 5, 1, 5, B.GREEN); box(25, 6, 6, 3, 1, 3, B.GREEN); set(26, 7, 7, B.GOLD);
  box(30, 1, 12, 1, 9, 1, B.WHITE); set(30, 10, 12, B.GREEN); set(30, 11, 12, B.GOLD);
  // Maisons blanches et ocre avec porte bleue, toits plats où l'on peut monter.
  const house = (x, z, w, d, h, t, door) => {
    box(x, 1, z, w, h, d, t);
    for (let i = 0; i < w; i++) { set(x + i, h + 1, z, t); set(x + i, h + 1, z + d - 1, t); }
    for (let i = 0; i < d; i++) { set(x, h + 1, z + i, t); set(x + w - 1, h + 1, z + i, t); }
    box(door[0], 1, door[1], 1, 2, 1, B.BLUE);
  };
  house(3, 4, 5, 5, 3, B.WHITE, [5, 8]);
  house(10, 6, 5, 5, 2, B.OCRE, [12, 10]);
  house(3, 23, 6, 5, 3, B.WHITE, [5, 23]);
  house(10, 25, 4, 4, 2, B.OCRE, [11, 25]);
  // Caisses en bois pour grimper sur les toits (on saute d'un bloc).
  set(8, 1, 9, B.PLANK); set(8, 1, 10, B.PLANK); set(8, 2, 10, B.PLANK);
  set(9, 1, 27, B.PLANK); set(9, 2, 27, B.PLANK); set(9, 1, 26, B.PLANK);
  set(15, 1, 11, B.PLANK); set(15, 1, 10, B.PLANK);
  // Le souk : étals avec des toiles rayées et des tapis.
  for (const [x, z] of [[22, 22], [27, 22], [22, 28], [27, 28]]) {
    box(x, 1, z, 1, 2, 1, B.PLANK); box(x + 3, 1, z, 1, 2, 1, B.PLANK);
    box(x, 3, z - 1, 4, 1, 3, B.TENT); box(x + 1, 1, z, 2, 1, 1, B.CARPET);
  }
  // Palmiers.
  const palm = (x, z) => { box(x, 1, z, 1, 4, 1, B.PALM); box(x - 1, 5, z - 1, 3, 1, 3, B.FROND); for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) set(x + dx, 4, z + dz, B.FROND); };
  palm(14, 14); palm(21, 14); palm(14, 21); palm(21, 21); palm(9, 15); palm(32, 18); palm(4, 13); palm(32, 31);
  // Un petit terrain de foot avec ses buts (pour Assad).
  for (const z of [27, 33]) { box(18, 1, z, 1, 2, 1, B.STONE); box(21, 1, z, 1, 2, 1, B.STONE); box(18, 3, z, 4, 1, 1, B.STONE); }
  return { cells, get: (x, y, z) => (x < 0 || x >= N || z < 0 || z >= N || y < 0 ? B.STONE : y >= HMAX ? B.AIR : cells[idx(x, y, z)]) };
}

// Bloc solide (on ne traverse pas l'eau du bassin, mais on ne s'y tient pas debout non plus : elle compte comme solide).
export const solid = (world, x, y, z) => world.get(Math.floor(x), Math.floor(y), Math.floor(z)) !== B.AIR;
// Hauteur où l'on se tient debout au-dessus de (x, z) en partant de y.
export function groundBelow(world, x, z, y) {
  for (let yy = Math.floor(y); yy >= 0; yy--) if (solid(world, x, yy, z)) return yy + 1;
  return 1;
}
// Le haut de la colonne (x, z) : la première case d'air en partant d'en haut.
export function topOf(world, x, z) {
  for (let y = HMAX - 1; y >= 0; y--) if (world.get(x, y, z) !== B.AIR) return y + 1;
  return 1;
}

// Toutes les cases où l'on peut aller à pied depuis le départ, en montant d'un bloc au plus (2 blocs d'air pour la tête).
export const SPAWN = [18.5, 12.5];
export function walkable(world) {
  const key = (x, z, y) => `${x},${z},${y}`;
  const stand = (x, z, y) => world.get(x, y, z) === B.AIR && world.get(x, y + 1, z) === B.AIR && ![B.AIR, B.WATER].includes(world.get(x, y - 1, z));
  const sx = Math.floor(SPAWN[0]), sz = Math.floor(SPAWN[1]);
  const seen = new Set([key(sx, sz, 1)]), todo = [[sx, sz, 1]];
  while (todo.length) {
    const [x, z, y] = todo.pop();
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      for (let ny = y + 1; ny >= 1; ny--) {
        if (ny === y + 1 && world.get(x, y + 2, z) !== B.AIR) continue;
        if (stand(nx, nz, ny)) { const k = key(nx, nz, ny); if (!seen.has(k)) { seen.add(k); todo.push([nx, nz, ny]); } break; }
        if (world.get(nx, ny, nz) !== B.AIR && ny <= y) break;
      }
    }
  }
  return seen;
}

// Les habitants : position dans la ville en 3D (les autres réglages viennent de la ville en 2D).
const PLACES = { maman: [6, 10], papa: [12, 12], hbibiti: [25, 25], boulanger: [30, 25], imam: [26, 13], fifi: [18, 14], assad: [20, 30], maitresse: [7, 21] };
export const NPCS3D = NPCS.filter((n) => PLACES[n.id]).map((n) => ({ ...n, x: PLACES[n.id][0] + 0.5, z: PLACES[n.id][1] + 0.5 }));

// Objets à trouver : 3 exemplaires loin de l'habitant, au moins un en hauteur (sur un toit).
export function spawnItems(world, npc, r = Math.random, count = 3) {
  const spots = [];
  const ok = world.walk || (world.walk = walkable(world));
  for (let z = 2; z < N - 2; z++) for (let x = 2; x < N - 2; x++) {
    const y = topOf(world, x, z), t = world.get(x, y - 1, z);
    if ([B.WATER, B.FROND, B.TENT, B.GOLD, B.GREEN, B.WALL].includes(t) || !ok.has(`${x},${z},${y}`)) continue;
    if (Math.hypot(x + 0.5 - npc.x, z + 0.5 - npc.z) < 8) continue;
    if (NPCS3D.some((n) => Math.hypot(x + 0.5 - n.x, z + 0.5 - n.z) < 1.5)) continue;
    spots.push({ x: x + 0.5, y, z: z + 0.5, high: y >= 3 });
  }
  const pick = (arr) => arr.splice(Math.floor(r() * arr.length), 1)[0];
  const high = spots.filter((s) => s.high), low = spots.filter((s) => !s.high);
  const out = [];
  if (high.length) out.push(pick(high));
  while (out.length < count && low.length) {
    const s = pick(low);
    if (out.every((o) => Math.hypot(o.x - s.x, o.z - s.z) > 5)) out.push(s);
  }
  return out.map((s, i) => ({ ...s, id: i, taken: false }));
}

export function questWord(npc, older, r = Math.random) {
  const room = npc.room === 'jardin' ? 'cuisine' : npc.room;
  const pool = wordsFor(room, older).filter((w) => w.emoji && !w.phrase);
  return pool[Math.floor(r() * pool.length)];
}

export function coinSpots3d(world, r = Math.random, count = 24) {
  const out = [];
  const ok = world.walk || (world.walk = walkable(world));
  let guard = 0;
  while (out.length < count && guard++ < 2000) {
    const x = 2 + Math.floor(r() * (N - 4)), z = 2 + Math.floor(r() * (N - 4));
    const y = topOf(world, x, z), t = world.get(x, y - 1, z);
    if (!ok.has(`${x},${z},${y}`) || [B.WATER, B.FROND, B.TENT, B.GOLD, B.GREEN].includes(t)) continue;
    if (out.some((o) => Math.abs(o.x - x - 0.5) < 2 && Math.abs(o.z - z - 0.5) < 2)) continue;
    out.push({ x: x + 0.5, y: y + 0.5, z: z + 0.5, taken: false });
  }
  return out;
}
