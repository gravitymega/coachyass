import test from 'node:test';
import assert from 'node:assert/strict';
import { WORDS, ROOMS, buildLevel, newProgress, grade, mastery, wordsFor, isCousin, rng, makeQuestion, speakable, STICKERS } from './core.js';

test('20 mots, ids uniques, chaque mot dans une salle jouable', () => {
  assert.equal(WORDS.length, 20);
  assert.equal(new Set(WORDS.map((w) => w.id)).size, 20);
  const playable = ROOMS.filter((r) => !r.soon).map((r) => r.id);
  for (const w of WORDS) { assert.ok(playable.includes(w.room)); assert.ok(w.ma.lat && w.dz.lat && w.ma.ar && w.dz.ar && w.emoji); }
  assert.ok(STICKERS.length >= 20);
});

test('profil petit : pas de mots abstraits, seulement « listen »', () => {
  for (let s = 1; s < 40; s++) {
    const p = newProgress();
    const lv = buildLevel('stade', p, { older: false, r: rng(s) });
    assert.equal(lv.learn.length, 2);
    assert.equal(lv.questions.length, 5);
    for (const q of lv.questions) {
      assert.equal(q.type, 'listen');
      assert.ok(!q.word.older);
      assert.equal(q.choices.length, 3);
      assert.equal(q.choices.filter((c) => c.correct).length, 1);
      assert.equal(new Set(q.choices.map((c) => c.word.emoji)).size, 3);
    }
  }
});

test('profil grand : choix toujours distincts pour ce qui est affiché', () => {
  for (let s = 1; s < 200; s++) {
    const p = newProgress();
    for (const room of ['hall', 'stade']) {
      const lv = buildLevel(room, p, { older: true, r: rng(s) });
      assert.equal(lv.learn.length, 3);
      for (const q of lv.questions) {
        assert.equal(q.choices.filter((c) => c.correct).length, 1);
        const key = q.type === 'listen' ? (w) => w.emoji : q.type === 'fr2dz' ? (w) => w[q.dialect].lat.toLowerCase() : (w) => w[q.other].lat.toLowerCase();
        assert.equal(new Set(q.choices.map((c) => key(c.word))).size, q.choices.length, `${q.type} ${q.word.id}`);
        if (q.type === 'cousin') assert.ok(!isCousin(q.word));
      }
    }
  }
});

test('un seul dialecte : jamais de question « cousin »', () => {
  for (let s = 1; s < 60; s++) {
    const lv = buildLevel('hall', newProgress(), { older: true, dialects: ['dz'], r: rng(s) });
    for (const q of lv.questions) { assert.notEqual(q.type, 'cousin'); assert.equal(q.dialect, 'dz'); }
  }
});

test('Leitner : monte, redescend, borné', () => {
  const p = newProgress();
  for (let i = 0; i < 9; i++) grade(p, 'papa', true);
  assert.equal(p.words.papa.box, 4);
  grade(p, 'papa', false);
  assert.equal(p.words.papa.box, 3);
  for (let i = 0; i < 9; i++) grade(p, 'papa', false);
  assert.equal(p.words.papa.box, 0);
});

test('les mots déjà vus sont révisés, les mal sus plus souvent', () => {
  const p = newProgress();
  for (const w of wordsFor('stade', true)) { grade(p, w.id, true); grade(p, w.id, true); grade(p, w.id, true); grade(p, w.id, true); }
  grade(p, 'maman', false); grade(p, 'maman', false); grade(p, 'maman', false); grade(p, 'maman', false);
  let maman = 0, total = 0;
  for (let s = 1; s < 300; s++) {
    const lv = buildLevel('stade', p, { older: true, r: rng(s) });
    assert.equal(lv.learn.length, 0);
    for (const q of lv.questions) { total++; if (q.word.id === 'maman') maman++; }
  }
  assert.ok(maman / total > 1 / 8 * 1.8, `maman ${maman}/${total}`);
});

test('maîtrise et brouillard', () => {
  const p = newProgress();
  const ws = wordsFor('hall', true);
  assert.equal(mastery(p, ws), 0);
  grade(p, ws[0].id, true); grade(p, ws[0].id, true);
  assert.equal(mastery(p, ws), 2 / (4 * ws.length));
  for (const w of ws) for (let i = 0; i < 5; i++) grade(p, w.id, true);
  assert.equal(mastery(p, ws), 1);
});

test('voix française : chiffres darija lisibles', () => {
  assert.equal(speakable('3ammi'), 'aammi');
});

test('question cousin : la bonne réponse est l’autre dialecte', () => {
  const w = WORDS.find((x) => x.id === 'maintenant');
  for (let s = 1; s < 30; s++) {
    const q = makeQuestion(w, wordsFor('hall', true), { older: true, dialect: 'ma', r: rng(s) });
    if (q.type === 'cousin') { assert.equal(q.other, 'dz'); assert.equal(q.choices.find((c) => c.correct).word.dz.lat, 'Dorka'); }
  }
});
