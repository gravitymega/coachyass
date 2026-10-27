// Tests de la ville : node --test jeu-darija/ville.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, isSolid, NPCS, newQuests, askQuestion, fetchQuest, coinSpots, nextGiver, W, H } from './ville-core.js';

const world = makeWorld();

test('chaque habitant est debout sur le sol, avec de la place pour la tête', () => {
  for (const n of NPCS) {
    const y = world.ground[Math.floor(n.x)];
    assert.ok(y > 3 && y < H, n.id);
    assert.ok(!isSolid(world, n.x, y - 1) && !isSolid(world, n.x, y - 2), `${n.id} coincé`);
  }
});

test('on ne monte jamais de plus de 2 blocs d’un coup en marchant sur le sol', () => {
  for (let x = 1; x < W - 2; x++) assert.ok(Math.abs(world.ground[x + 1] - world.ground[x]) <= 2, 'marche trop haute en ' + x);
});

test('missions : une question avec une seule bonne réponse, 3 objets loin de l’habitant', () => {
  const qs = newQuests(42);
  for (const n of NPCS) for (const older of [true, false]) {
    const q = askQuestion(n, qs[n.id], { older });
    assert.equal(q.choices.filter((c) => c.correct).length, 1, n.id);
    const f = fetchQuest(n, qs[n.id], world, { older });
    assert.equal(f.items.length, 3, n.id);
    assert.ok(f.word.emoji, n.id);
    for (const it of f.items) assert.ok(Math.abs(it.x - n.x) > 12 && !isSolid(world, it.x, it.y), `${n.id} objet mal placé`);
  }
  assert.ok(coinSpots(world, 3).length >= 30);
  assert.equal(nextGiver(qs, 0).id, 'maman');
});

import { canPlace, applyBuild, T as TT, GROUND as G } from './ville-core.js';
test('construire : on pose un bloc collé à un autre, jamais sur un habitant', () => {
  const w = makeWorld();
  assert.equal(canPlace(w, 20, G - 1), true); // posé sur l'herbe
  assert.equal(canPlace(w, 20, G - 4), false); // en l'air, rien à côté
  assert.equal(canPlace(w, 9, G - 1), false); // Maman est là
  assert.equal(canPlace(w, 20, G), false); // déjà plein
  applyBuild(w, { [`20,${G - 1}`]: TT.BRICK });
  assert.equal(w.solid[G - 1][20], TT.BRICK);
  assert.equal(canPlace(w, 20, G - 2), true); // on empile
});
