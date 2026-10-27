// Tests des histoires : node --test jeu-darija/tales.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TALES, TALE_CATS, speakTale, nextTale } from './tales.js';
import { POPPY, makeExercise } from './exercises.js';
import { rng } from './core.js';

test('chaque histoire est complète', () => {
  const ids = new Set();
  for (const t of TALES) {
    assert.ok(!ids.has(t.id), 'id en double : ' + t.id); ids.add(t.id);
    assert.ok(TALE_CATS[t.cat], t.id);
    assert.ok(t.title && t.e, t.id);
    assert.ok(t.pages.length >= 4, t.id);
    for (const p of t.pages) assert.ok(p.e && p.t.length > 30 && p.t.length < 360, `${t.id} : page trop courte ou trop longue`);
    assert.equal(t.quiz.length, 2, t.id);
    for (const q of t.quiz) {
      assert.equal(q.a.length, 3, t.id);
      assert.equal(new Set(q.a.map((a) => a[1])).size, 3, `${t.id} : choix en double`);
    }
  }
  for (const c of Object.keys(TALE_CATS)) assert.ok(TALES.some((t) => t.cat === c), 'catégorie vide : ' + c);
});

test('la salutation sur le Prophète est dite en entier', () => {
  assert.equal(speakTale('Le Prophète ﷺ dit.'), 'Le Prophète, salla Allahou alayhi wa sallam, dit.');
  assert.ok(!speakTale('Mohammed ﷺ, Al-Amine').includes(',,'));
});

test('histoire proposée : la première pas encore écoutée', () => {
  assert.equal(nextTale({}).id, TALES[0].id);
  assert.equal(nextTale({ [TALES[0].id]: true }).id, TALES[1].id);
  const maths = TALES.filter((t) => t.cat === 'maths');
  assert.equal(nextTale({ [maths[0].id]: true }, 'maths').id, maths[1].id);
  assert.equal(nextTale(Object.fromEntries(TALES.map((t) => [t.id, true]))).id, TALES[0].id);
});

test('Poppy Playtime : un indice ne désigne qu’un seul personnage parmi les choix', () => {
  const r = rng(7);
  for (let i = 0; i < 400; i++) {
    const q = makeExercise('p-who', { r });
    const good = q.choices.filter((c) => c.correct);
    assert.equal(good.length, 1);
    const clue = q.say[1];
    const owners = POPPY.filter((x) => x.clues.map((c) => c.replaceAll('de {joueur}', 'du joueur').replaceAll('{joueur}', 'le joueur')).includes(clue)).map((x) => x.id);
    assert.deepEqual(owners, [good[0].key]);
  }
});
