import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, WORDS } from './core.js';
import { recordDay, weekReport, reportText } from './carnet.js';

test('le carnet compte seulement ce qui a été appris cette semaine', () => {
  const p = newProgress();
  const [a, b] = WORDS;
  p.words[a.id] = { box: 3 }; p.stars = 10; p.levels = 2;
  recordDay(p, '2026-10-01'); // il y a longtemps
  p.words[b.id] = { box: 2 }; p.words['en:' + b.id] = { box: 2 }; p.stars = 25; p.levels = 4; p.tales = { t1: true };
  recordDay(p, '2026-10-26');
  const r = weekReport(p, '2026-10-27');
  assert.deepEqual(r.words.map((w) => w.id), [b.id]);
  assert.equal(r.english, 1);
  assert.equal(r.stars, 15);
  assert.equal(r.levels, 2);
  assert.equal(r.tales, 1);
  assert.equal(r.days, 1);
  assert.equal(r.totalWords, 2);
  assert.match(reportText('Ali', r), /Ali.*\n.*1 nouveau mot/);
});

test('on garde au plus 60 jours', () => {
  const p = newProgress();
  for (let i = 1; i <= 70; i++) recordDay(p, `2026-${String(Math.ceil(i / 28)).padStart(2, '0')}-${String(((i - 1) % 28) + 1).padStart(2, '0')}`);
  assert.equal(Object.keys(p.days).length, 60);
});
