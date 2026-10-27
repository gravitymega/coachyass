// Données des activités : node --test jeu-darija/act.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS } from './core.js';
import { SOURATES, VILLES, RECETTES, NOMS, PRODUITS } from './act-data.js';

test('les 99 noms : 99 noms différents, chacun avec arabe, lecture et sens', () => {
  assert.equal(NOMS.length, 99);
  assert.equal(new Set(NOMS.map((n) => n.lat)).size, 99);
  for (const n of NOMS) assert.ok(n.ar && n.lat && n.fr, JSON.stringify(n));
});

test('les sourates ont le bon nombre de lignes', () => {
  const lines = Object.fromEntries(SOURATES.map((s) => [s.id, s.verses.length]));
  assert.deepEqual(lines, { fatiha: 7, ikhlas: 4, kawthar: 3, falaq: 5, nas: 6 });
  for (const s of SOURATES) for (const v of s.verses) assert.match(v.ar, /[؀-ۿ]/);
});

test('voyage, cuisine et marché : réponses distinctes et mots du jeu existants', () => {
  assert.equal(VILLES.length, 6);
  for (const k of ['monument', 'plat']) assert.equal(new Set(VILLES.map((v) => v[k].name)).size, 6);
  assert.equal(new Set(VILLES.map((v) => v.mot.fr)).size, 6);
  const ids = new Set(WORDS.map((w) => w.id));
  for (const r of RECETTES) {
    assert.equal(new Set(r.ing.map((i) => i.e)).size, r.ing.length, r.id); // un emoji par ingrédient (on les touche)
    for (const i of r.ing) if (i.word) assert.ok(ids.has(i.word), i.word);
  }
  for (const p of PRODUITS) if (p.word) assert.ok(ids.has(p.word), p.word);
});
