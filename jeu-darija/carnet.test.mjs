import test from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, WORDS } from './core.js';
import { recordDay, weekReport, reportText, streak, logGame, gameLine } from './carnet.js';

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

test('série de jours : compte les jours joués de suite', () => {
  const p = newProgress();
  assert.equal(streak(p, '2026-11-03'), 0);
  for (const d of ['2026-10-30', '2026-11-01', '2026-11-02']) recordDay(p, d);
  assert.equal(streak(p, '2026-11-03'), 2); // pas encore joué aujourd'hui : la série d'hier tient
  recordDay(p, '2026-11-03');
  assert.equal(streak(p, '2026-11-03'), 3);
  assert.equal(streak(p, '2026-11-05'), 0);
});

test('historique : chaque partie reste dans le profil, 300 max', () => {
  const p = newProgress();
  logGame(p, { kind: 'salle', name: 'Stade', score: 4, total: 5, stars: 4, with: 'Asma' }, 1);
  assert.equal(p.history.length, 1);
  assert.equal(gameLine(p.history[0]), '🏭 Stade · 4/5 ✔ · +4 ⭐ · avec Asma');
  for (let i = 0; i < 400; i++) logGame(p, { kind: 'act', icon: '⚽', name: 'Foot', stars: 1 }, i + 2);
  assert.equal(p.history.length, 300);
  assert.equal(p.history.at(-1).t, 401);
});
