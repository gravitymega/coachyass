// Tests des missions de Papa et Maman : node --test jeu-darija/missions.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAILY, dailyMissions, dailyState, autoComplete } from './missions.js';
import { newProgress } from './core.js';

const ali = { id: 'ali', older: true }, asma = { id: 'asma', older: false };

test('3 missions par jour : une en vrai, une pour aider ou bouger, une dans le jeu', () => {
  for (let d = 1; d <= 28; d++) for (const kid of [ali, asma]) {
    const ms = dailyMissions(kid, `2026-11-${String(d).padStart(2, '0')}`, { sibling: 'Asma', levels: 5 });
    assert.equal(ms.length, 3);
    assert.ok(['darija', 'deen'].includes(ms[0].cat));
    assert.ok(['maison', 'famille', 'sport', 'ecole'].includes(ms[1].cat));
    assert.equal(ms[2].cat, 'jeu');
    for (const m of ms) {
      assert.ok(m.who === 'all' || (m.who === 'older') === kid.older, m.id);
      assert.ok(!m.t.includes('{frere}'));
    }
  }
});

test('mêmes missions toute la journée, différentes d’un jour à l’autre', () => {
  const a = dailyMissions(ali, '2026-11-02').map((m) => m.id).join();
  assert.equal(dailyMissions(ali, '2026-11-02').map((m) => m.id).join(), a);
  const days = new Set(Array.from({ length: 14 }, (_, i) => dailyMissions(ali, `2026-11-${10 + i}`).map((m) => m.id).join()));
  assert.ok(days.size > 7);
});

test('sans frère ou sœur, sans coin Poppy, sans niveau : missions retirées', () => {
  for (let d = 1; d <= 28; d++) {
    const ms = dailyMissions(ali, `2026-12-${String(d).padStart(2, '0')}`, { sibling: null, poppy: false, levels: 0 });
    assert.ok(ms.every((m) => !m.id.startsWith('f-frere') && m.id !== 'f-gentil' && m.id !== 'j-poppy' && m.id !== 'j-defi'));
  }
});

test('les missions de jeu se valident toutes seules', () => {
  const p = newProgress();
  const ms = [DAILY.find((m) => m.id === 'j-histoire'), DAILY.find((m) => m.id === 'j-niveau'), DAILY.find((m) => m.id === 'd-sbah')];
  assert.deepEqual(autoComplete(p, ms, '2026-11-02', { kind: 'room' }).map((m) => m.id), ['j-niveau']);
  assert.deepEqual(autoComplete(p, ms, '2026-11-02', { kind: 'tale' }).map((m) => m.id), ['j-histoire']);
  assert.deepEqual(autoComplete(p, ms, '2026-11-02', { kind: 'room' }), []);
  assert.equal(Object.keys(dailyState(p, '2026-11-03').done).length, 0); // nouveau jour
  const school = [DAILY.find((m) => m.id === 'j-ecole')];
  assert.equal(autoComplete(p, school, '2026-11-03', { kind: 'room', school: false }).length, 0);
  assert.equal(autoComplete(p, school, '2026-11-03', { kind: 'room', school: true }).length, 1);
});
