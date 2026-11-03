// La ville en 3D : node --test jeu-darija/ville3d.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld3d, NPCS3D, spawnItems, coinSpots3d, topOf, walkable, pathTo, nodeX, SPAWN, B, N } from './ville3d-core.js';

const reachable = walkable;
test('les habitants sont debout sur le sol, avec de la place, et on peut tous les rejoindre', () => {
  const w = makeWorld3d(), ok = reachable(w);
  for (const n of NPCS3D) {
    const x = Math.floor(n.x), z = Math.floor(n.z);
    assert.equal(w.get(x, 1, z), B.AIR, n.id); assert.equal(w.get(x, 2, z), B.AIR, n.id);
    assert.ok(ok.has(`${x},${z},1`), `${n.id} inaccessible`);
  }
});

test('les objets cachés : 3, loin de l’habitant, dont un en hauteur, tous atteignables', () => {
  const w = makeWorld3d(), ok = reachable(w);
  for (const n of NPCS3D) for (let k = 0; k < 5; k++) {
    const items = spawnItems(w, n);
    assert.equal(items.length, 3, n.id);
    assert.ok(items.some((i) => i.high), `${n.id} : aucun objet en hauteur`);
    for (const i of items) {
      assert.ok(Math.hypot(i.x - n.x, i.z - n.z) >= 8);
      assert.ok(ok.has(`${Math.floor(i.x)},${Math.floor(i.z)},${i.y}`), `objet inaccessible ${JSON.stringify(i)}`);
    }
  }
  assert.ok(coinSpots3d(w).length >= 15);
  assert.equal(topOf(w, 26, 4), 8); // la coupole de la mosquée
  assert.equal(N, 36);
});

test('la médina est un vrai labyrinthe : tous les carrefours reliés, des ruelles, et un chemin vers chaque habitant', () => {
  const w = makeWorld3d(), ok = walkable(w);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const x = nodeX(i), z = nodeX(j);
    if (w.get(x, 1, z) === B.AIR && w.get(x, 0, z) !== B.WATER) assert.ok(ok.has(`${x},${z},1`) || ok.has(`${x + 1},${z},1`), `carrefour ${i},${j}`);
  }
  assert.ok(w.lanes.length >= 5, 'pas assez de ruelles');
  for (const n of NPCS3D) {
    const path = pathTo(w, SPAWN[0], SPAWN[1], 1, Math.floor(n.x), Math.floor(n.z));
    assert.ok(path && path.length > 1, `pas de chemin vers ${n.id}`);
  }
  // Il faut tourner : le chemin vers Maman est plus long que la ligne droite.
  const m = NPCS3D.find((n) => n.id === 'maman');
  assert.ok(pathTo(w, SPAWN[0], SPAWN[1], 1, Math.floor(m.x), Math.floor(m.z)).length > Math.hypot(m.x - SPAWN[0], m.z - SPAWN[1]) * 1.2);
});
