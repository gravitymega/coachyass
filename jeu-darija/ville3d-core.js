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
  // Meubles des intérieurs
  SOFA: 18, TABLE: 19, TV: 20, LAMP: 21, OVEN: 22, BREAD: 23, BOARD: 24, DESK: 25, BOOK: 26, SACK: 27, RUG: 28, TILE: 29,
};

// La médina en labyrinthe : une grille de 8 x 8 carrefours reliés par des rues (2 blocs) et des ruelles (1 bloc),
// creusée dans un bloc de maisons. Toujours le même plan (graine fixe) : on apprend à s'y repérer.
const SEED = 1448;
const NODES = 8;
export const nodeX = (k) => 2 + 4 * k; // première case (sur 2) du carrefour k
const RESERVED = (i, j) => (i >= 3 && i <= 4 && j >= 3 && j <= 4) /* place */ || (i <= 1 && j >= 6) /* terrain */ || (i >= 5 && i <= 6 && j <= 1) /* mosquée */;
function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function makeWorld3d() {
  const cells = new Uint8Array(N * HMAX * N);
  const idx = (x, y, z) => (y * N + z) * N + x;
  const set = (x, y, z, t) => { if (x >= 0 && x < N && z >= 0 && z < N && y >= 0 && y < HMAX) cells[idx(x, y, z)] = t; };
  const get = (x, y, z) => cells[idx(x, y, z)];
  const box = (x0, y0, z0, w, h, d, t) => { for (let y = y0; y < y0 + h; y++) for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) set(x, y, z, t); };
  const r = rngOf(SEED);
  // 1. Tout est d'abord un bloc de maisons (blanches ou ocre, 3 ou 4 étages), sur un sol en sable.
  box(0, 0, 0, N, 1, N, B.SAND);
  for (let bz = 0; bz < N; bz += 2) for (let bx = 0; bx < N; bx += 2) {
    const t = r() < 0.65 ? B.WHITE : B.OCRE, h = r() < 0.7 ? 3 : 4;
    box(bx, 1, bz, 2, h, 2, t);
  }
  const carve = (x0, z0, w, d) => box(x0, 1, z0, w, HMAX - 1, d, B.AIR);
  // 2. Le labyrinthe : on relie tous les carrefours (parcours en profondeur), puis on ouvre quelques passages en plus.
  const visited = new Set(), key = (i, j) => i * NODES + j;
  const links = [];
  const stack = [[3, 3]];
  for (let i = 0; i < NODES; i++) for (let j = 0; j < NODES; j++) if (RESERVED(i, j)) visited.add(key(i, j));
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const next = dirs.map(([di, dj]) => [i + di, j + dj]).filter(([a, b]) => a >= 0 && b >= 0 && a < NODES && b < NODES && !visited.has(key(a, b)));
    if (!next.length) { stack.pop(); continue; }
    const [a, b] = next[Math.floor(r() * next.length)];
    visited.add(key(a, b)); links.push([i, j, a, b]); stack.push([a, b]);
  }
  for (let i = 0; i < NODES; i++) for (let j = 0; j < NODES; j++) for (const [di, dj] of [[1, 0], [0, 1]]) {
    const a = i + di, b = j + dj;
    if (a < NODES && b < NODES && !RESERVED(i, j) && !RESERVED(a, b) && r() < 0.12) links.push([i, j, a, b]);
  }
  // Les grandes rues : une rue est-ouest et une rue nord-sud qui traversent toute la médina (4 blocs de large).
  for (let k = 0; k < NODES - 1; k++) { links.push([k, 4, k + 1, 4]); links.push([4, k, 4, k + 1]); }
  for (let i = 0; i < NODES; i++) for (let j = 0; j < NODES; j++) if (!RESERVED(i, j) || (i >= 3 && i <= 4 && j >= 3 && j <= 4)) carve(nodeX(i), nodeX(j), 2, 2);
  const lanes = [];
  for (const [i, j, a, b] of links) {
    const narrow = r() < 0.4 && i !== 4 && a !== 4 && j !== 4 && b !== 4; // ruelle d'un seul bloc
    if (a !== i) { const x = nodeX(Math.min(i, a)) + 2; carve(x, nodeX(j) + (narrow ? Math.floor(r() * 2) : 0), 2, narrow ? 1 : 2); }
    else { const z = nodeX(Math.min(j, b)) + 2; carve(nodeX(i) + (narrow ? Math.floor(r() * 2) : 0), z, narrow ? 1 : 2, 2); }
    if (narrow) lanes.push([i, j, a, b]);
  }
  carve(2, nodeX(4) - 2, N - 4, 2); carve(nodeX(4) - 2, 2, 2, N - 4); // élargir les grandes rues
  // 3. La place centrale avec sa fontaine en zellige et ses palmiers.
  carve(nodeX(3) - 2, nodeX(3) - 2, 12, 12);
  for (let z = nodeX(3) - 2; z < nodeX(3) + 10; z++) for (let x = nodeX(3) - 2; x < nodeX(3) + 10; x++) set(x, 0, z, (x + z) % 2 ? B.ZELLIGE : B.WHITE);
  box(16, 1, 16, 4, 1, 4, B.ZELLIGE); box(17, 1, 17, 2, 1, 2, B.WATER);
  const palm = (x, z) => { box(x, 1, z, 1, 4, 1, B.PALM); box(x - 1, 5, z - 1, 3, 1, 3, B.FROND); for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) set(x + dx, 4, z + dz, B.FROND); };
  palm(13, 13); palm(22, 13); palm(13, 22); palm(22, 22);
  // 4. La mosquée (en haut à droite) : murs blancs, bandeau de zellige, coupole verte, minaret et porte sur une rue.
  carve(nodeX(5) - 1, 1, 10, 9);
  box(nodeX(5) - 1, 1, 1, 9, 4, 8, B.WHITE); box(nodeX(5) - 1, 1, 1, 9, 1, 8, B.ZELLIGE);
  box(24, 5, 3, 5, 1, 4, B.GREEN); box(25, 6, 4, 3, 1, 2, B.GREEN); set(26, 7, 4, B.GOLD); set(26, 7, 5, B.GOLD);
  box(30, 1, 1, 1, 9, 1, B.WHITE); set(30, 10, 1, B.GREEN); set(30, 11, 1, B.GOLD);
  carve(nodeX(5), 9, 2, 1); box(nodeX(5), 1, 8, 2, 2, 1, B.DOOR);
  // 5. Le terrain de foot d'Assad (en bas à gauche) avec ses buts.
  carve(1, nodeX(6) - 1, nodeX(2) - 1, N - nodeX(6));
  for (let z = nodeX(6) - 1; z < N - 1; z++) for (let x = 1; x < nodeX(2) - 1; x++) set(x, 0, z, B.GRASS);
  for (const z of [nodeX(6) - 1, N - 2]) { set(3, 1, z, B.STONE); set(7, 1, z, B.STONE); box(3, 2, z, 5, 1, 1, B.STONE); }
  // 6. Le souk dans la grande rue est-ouest (côté est) : tapis au sol et toiles rayées au-dessus.
  for (let x = 23; x < N - 2; x++) for (let z = nodeX(4) - 2; z < nodeX(4) + 2; z++) {
    if ((x + z) % 3 === 0) set(x, 0, z, B.CARPET);
    if (x % 2 === 0 && get(x, 4, z) === B.AIR) set(x, 4, z, B.TENT);
  }
  const doors = [{ x: nodeX(5), z: 8, type: 'mosquee' }, { x: nodeX(5) + 1, z: 8, type: 'mosquee' }];
  // 7. Des portes bleues ou en bois sur les murs des ruelles, et des caisses pour grimper sur les toits (raccourcis !).
  for (let z = 1; z < N - 1; z++) for (let x = 1; x < N - 1; x++) {
    const wall = get(x, 1, z) === B.WHITE || get(x, 1, z) === B.OCRE;
    if (!wall || r() > 0.06) continue;
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => get(x + dx, 1, z + dz) === B.AIR);
    if (open) { set(x, 1, z, r() < 0.5 ? B.BLUE : B.DOOR); set(x, 2, z, get(x, 1, z)); doors.push({ x, z }); }
  }
  // Passages secrets : un trou d'un seul bloc de haut dans un mur épais, entre deux rues. On y passe en rampant !
  const tunnels = [];
  for (let z = 3; z < N - 3 && tunnels.length < 7; z += 3) for (let x = 2; x < N - 5; x++) {
    const air = (xx) => get(xx, 1, z) === B.AIR && get(xx, 2, z) === B.AIR;
    const wall = (xx) => [B.WHITE, B.OCRE].includes(get(xx, 1, z)) && [B.WHITE, B.OCRE].includes(get(xx, 2, z));
    if (air(x) && wall(x + 1) && wall(x + 2) && air(x + 3) && !tunnels.some((t) => Math.abs(t.z - z) < 4)) {
      set(x + 1, 1, z, B.AIR); set(x + 2, 1, z, B.AIR); tunnels.push({ x: x + 1, z }); break;
    }
  }
  for (const [x, z] of [[nodeX(1) + 1, nodeX(0)], [nodeX(6), nodeX(6) + 1], [nodeX(2), nodeX(2) + 1], [nodeX(7) + 1, nodeX(2)], [nodeX(1), nodeX(4) + 2]]) {
    // Deux caisses en escalier contre un mur : on monte d'un bloc à la fois.
    if (get(x, 1, z) !== B.AIR) continue;
    set(x, 1, z, B.PLANK);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (get(x + dx, 1, z + dz) === B.AIR && get(x + dx, 2, z + dz) === B.AIR) { set(x + dx, 1, z + dz, B.PLANK); set(x + dx, 2, z + dz, B.PLANK); break; }
  }
  // 8. Les remparts de la kasbah tout autour, avec des créneaux.
  for (let i = 0; i < N; i++) for (const [x, z] of [[i, 0], [i, N - 1], [0, i], [N - 1, i]]) {
    box(x, 1, z, 1, 4, 1, B.WALL);
    if (i % 2 === 0) set(x, 5, z, B.WALL); else set(x, 5, z, B.AIR);
  }
  // Chaque porte mène à un intérieur : boulangerie au souk, sinon une maison ou une école.
  doors.forEach((d, i) => { if (!d.type) d.type = d.x > 22 && d.z >= 14 && d.z <= 21 ? 'boulangerie' : i % 3 === 2 ? 'ecole' : 'maison'; });
  return { cells, lanes, doors, tunnels, get: (x, y, z) => (x < 0 || x >= N || z < 0 || z >= N || y < 0 ? B.STONE : y >= HMAX ? B.AIR : cells[idx(x, y, z)]) };
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
export const SPAWN = [20.5, 17.5]; // sur la place, à côté de la fontaine
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

// Le chemin le plus court à pied (mêmes règles que walkable) : liste de cases [x, z, y] jusqu'à la colonne (tx, tz).
export function pathTo(world, fx, fz, fy, tx, tz) {
  const key = (x, z, y) => `${x},${z},${y}`;
  const stand = (x, z, y) => world.get(x, y, z) === B.AIR && world.get(x, y + 1, z) === B.AIR && ![B.AIR, B.WATER].includes(world.get(x, y - 1, z));
  const start = [Math.floor(fx), Math.floor(fz), Math.round(fy)];
  const prev = new Map([[key(...start), null]]);
  const todo = [start];
  for (let k = 0; k < todo.length; k++) {
    const [x, z, y] = todo[k];
    if (x === tx && z === tz) {
      const out = []; let c = key(x, z, y);
      while (c) { out.unshift(c.split(',').map(Number)); c = prev.get(c); }
      return out;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      for (let ny = y + 1; ny >= 1; ny--) {
        if (ny === y + 1 && world.get(x, y + 2, z) !== B.AIR) continue;
        if (stand(nx, nz, ny)) { const kk = key(nx, nz, ny); if (!prev.has(kk)) { prev.set(kk, key(x, z, y)); todo.push([nx, nz, ny]); } break; }
        if (world.get(nx, ny, nz) !== B.AIR && ny <= y) break;
      }
    }
  }
  return null;
}

// Les habitants : position dans la ville en 3D (les autres réglages viennent de la ville en 2D).
const C = (i, j) => [nodeX(i) + 0.5, nodeX(j) + 0.5]; // au milieu d'un carrefour
const PLACES = { maman: C(1, 1), papa: C(2, 5), hbibiti: [26, 16], boulanger: [31, 19], imam: [nodeX(5), nodeX(2)], fifi: [14, 14], assad: [5, 30], maitresse: C(1, 3) };
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

// ---------- Les intérieurs (une petite pièce en blocs par sorte de bâtiment) ----------
// La porte de sortie est au milieu du mur du bas (z = D - 1). Chaque intérieur a son habitant.
export const IW = 11, ID = 10, IH = 5;
export const INTERIORS = {
  maison: { name: 'La maison', npc: { id: 'tante', name: 'La tante', look: 'maman', room: 'maison' } },
  mosquee: { name: 'La mosquée', npc: { id: 'muezzin', name: 'Le muezzin', look: 'imam', room: 'jardin' } },
  boulangerie: { name: 'La boulangerie', npc: { id: 'boulangere', name: 'La boulangère', look: 'hbibiti', room: 'cuisine' } },
  ecole: { name: 'L’école', npc: { id: 'maitre', name: 'Le maître', look: 'papa', room: 'ecole' } },
};
export function makeInterior(type) {
  const cells = new Uint8Array(IW * IH * ID);
  const idx = (x, y, z) => (y * ID + z) * IW + x;
  const set = (x, y, z, t) => { if (x >= 0 && x < IW && z >= 0 && z < ID && y >= 0 && y < IH) cells[idx(x, y, z)] = t; };
  const box = (x0, y0, z0, w, h, d, t) => { for (let y = y0; y < y0 + h; y++) for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) set(x, y, z, t); };
  const wall = type === 'mosquee' ? B.WHITE : type === 'boulangerie' ? B.OCRE : B.WHITE;
  box(0, 0, 0, IW, 1, ID, type === 'boulangerie' ? B.TILE : type === 'ecole' ? B.PLANK : B.TILE);
  // Le mur de devant est bas (1 bloc) : on voit l'intérieur de haut, comme une maison de poupée.
  for (let x = 0; x < IW; x++) for (let z = 0; z < ID; z++) if (x === 0 || z === 0 || x === IW - 1 || z === ID - 1) box(x, 1, z, 1, z === ID - 1 ? 1 : IH - 1, 1, wall);
  box(0, 1, 0, IW, 1, 1, B.ZELLIGE); box(0, 1, 0, 1, 1, ID, B.ZELLIGE); box(IW - 1, 1, 0, 1, 1, ID, B.ZELLIGE);
  const exit = { x: Math.floor(IW / 2), z: ID - 1 };
  box(exit.x, 1, exit.z, 1, 2, 1, B.DOOR);
  if (type === 'maison') {
    // Salon marocain : sedari tout autour, table basse avec la théière, tapis, télévision, lanternes.
    box(1, 1, 1, IW - 2, 1, 1, B.SOFA); box(1, 1, 2, 1, 1, 5, B.SOFA); box(IW - 2, 1, 2, 1, 1, 5, B.SOFA);
    box(3, 0, 3, 5, 1, 4, B.RUG); box(4, 1, 4, 3, 1, 2, B.TABLE); set(5, 2, 4, B.GOLD);
    box(1, 2, 3, 1, 2, 2, B.TV); set(2, 4, 2, B.LAMP); set(IW - 3, 4, 2, B.LAMP);
  } else if (type === 'mosquee') {
    // Salle de prière : rangées de tapis, mihrab vert et doré, minbar (escalier), lustres, étagère de Corans.
    for (let z = 2; z < ID - 2; z += 2) box(1, 0, z, IW - 2, 1, 1, B.RUG);
    box(4, 1, 0, 3, 3, 1, B.GREEN); set(5, 2, 0, B.GOLD); set(5, 3, 0, B.GOLD);
    set(8, 1, 1, B.PLANK); set(8, 1, 2, B.PLANK); set(8, 2, 1, B.PLANK);
    box(1, 1, 1, 1, 3, 2, B.BOOK); set(3, 4, 4, B.LAMP); set(7, 4, 4, B.LAMP); set(5, 4, 6, B.LAMP);
    box(IW - 3, 1, ID - 3, 2, 1, 2, B.ZELLIGE); set(IW - 2, 1, ID - 2, B.WATER);
  } else if (type === 'boulangerie') {
    // Le four à pain, le comptoir avec les pains, les sacs de farine.
    box(1, 1, 1, 4, 3, 2, B.OVEN); box(6, 1, 4, 4, 1, 1, B.TABLE); for (const x of [6, 7, 8, 9]) set(x, 2, 4, B.BREAD);
    box(1, 1, 6, 2, 1, 2, B.SACK); set(1, 2, 6, B.SACK); set(IW - 2, 1, 1, B.SACK);
  } else {
    // La classe : le tableau, les pupitres en rangées, le bureau du maître, les livres.
    box(2, 2, 0, 7, 2, 1, B.BOARD); box(4, 1, 2, 3, 1, 1, B.DESK);
    for (const z of [4, 6]) for (const x of [2, 5, 8]) set(x, 1, z, B.DESK);
    box(1, 1, ID - 3, 1, 2, 2, B.BOOK);
  }
  return { cells, type, exit, w: IW, d: ID, spawn: [exit.x + 0.5, exit.z - 1.2], npcAt: type === 'mosquee' ? [5.5, 2.5] : type === 'boulangerie' ? [7.5, 3.2] : type === 'ecole' ? [5.5, 1.6] : [5.5, 2.4],
    get: (x, y, z) => (x < 0 || x >= IW || z < 0 || z >= ID || y < 0 ? B.STONE : y >= IH ? B.AIR : cells[idx(x, y, z)]) };
}
