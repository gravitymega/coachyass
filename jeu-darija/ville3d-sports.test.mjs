// Les encouragements d'Ali pour ses sports : node --test jeu-darija/ville3d-sports.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { encouragement, aboutKid } from './ville3d-dialogues.js';

const ali = { id: 'ali', name: 'Ali', older: true }, asma = { id: 'asma', name: 'Asma' };
const day = (d) => new Date(2026, 10, 8 + d); // 8 nov. 2026 = dimanche

test('Ali est encouragé selon le jour : basket le dimanche, soccer le mardi, course avec Maman', () => {
  for (let n = 0; n < 4; n++) {
    assert.match(encouragement(ali, day(0), n), /basket/);
    assert.match(encouragement(ali, day(2), n), /soccer/);
    assert.match(encouragement(ali, day(1), n), /soccer/);
    assert.match(encouragement(ali, day(6), n), /basket/);
    assert.match(encouragement(ali, day(4), n), /course|cours/i);
    assert.equal(encouragement(ali, day(0), -1).length > 0, true);
  }
  assert.equal(encouragement(asma, day(2)), '');
  assert.match(aboutKid(ali, day(2)), /soccer.*mardis.*basket.*dimanches.*course.*maman.*mardi\./s);
  assert.equal(aboutKid(asma), '');
});
