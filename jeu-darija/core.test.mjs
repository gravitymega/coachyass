import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORDS, ROOMS, SEQUENCES, STICKERS, MISSIONS, buildLevel, buildCoop, newProgress, grade, mastery, wordsFor, EN, englishWords,
  isCousin, rng, makeQuestion, speakable, sequenceChoices, missionOfWeek, roomUnlocked,
} from './core.js';

test('vocabulaire complet et cohérent', () => {
  assert.ok(WORDS.length >= 75, `${WORDS.length} mots`);
  assert.equal(new Set(WORDS.map((w) => w.id)).size, WORDS.length);
  const rooms = ROOMS.filter((r) => !r.school).map((r) => r.id);
  for (const w of WORDS) {
    assert.ok(rooms.includes(w.room), w.id);
    assert.ok(w.ma.lat && w.dz.lat && w.ma.ar && w.dz.ar && w.emoji && w.fr, w.id);
  }
  for (const r of ROOMS.filter((x) => !x.school)) {
    for (const older of [true, false]) {
      const ws = wordsFor(r.id, older);
      assert.ok(ws.length >= 5, `${r.id} ${older}`);
      assert.equal(new Set(ws.map((w) => w.emoji)).size, ws.length, `emojis uniques dans ${r.id}`);
    }
  }
  assert.ok(STICKERS.length >= 30 && MISSIONS.length >= 12);
});

for (const r of ROOMS.filter((x) => !x.school)) {
  test(`salle ${r.id} : questions valides pour les deux profils`, () => {
    for (let s = 1; s < 120; s++) {
      for (const older of [true, false]) {
        const p = newProgress();
        // deux niveaux de suite : nouveaux mots puis révision
        for (let k = 0; k < 2; k++) {
          const lv = buildLevel(r.id, p, { older, r: rng(s * 7 + k) });
          assert.equal(lv.questions.length, 5);
          for (const q of lv.questions) {
            if (q.type === 'sequence') { assert.equal(r.id, 'jardin'); continue; }
            if (!older) assert.equal(q.type, 'listen');
            assert.ok(older || !q.word.older);
            assert.equal(q.choices.length, 3);
            assert.equal(q.choices.filter((c) => c.correct).length, 1);
            const key = q.type === 'listen' ? (w) => w.emoji : q.type === 'fr2dz' ? (w) => w[q.dialect].lat.toLowerCase() : (w) => w[q.other].lat.toLowerCase();
            assert.equal(new Set(q.choices.map((c) => key(c.word))).size, 3, `${q.type} ${q.word.id}`);
            if (q.type === 'cousin') assert.ok(!isCousin(q.word));
            grade(p, q.word.id, true);
          }
          for (const w of lv.learn) p.words[w.id].seen = true;
        }
      }
    }
  });
}

test('jardin : toujours une suite à remettre dans l’ordre en dernier', () => {
  for (let s = 0; s < 6; s++) {
    const lv = buildLevel('jardin', newProgress(), { older: true, seqIndex: s });
    assert.equal(lv.questions.at(-1).type, 'sequence');
    assert.equal(lv.questions.at(-1).seq, SEQUENCES[s % 3]);
  }
});

test('suite : la bonne étape est toujours proposée, jamais une étape déjà placée', () => {
  for (const seq of SEQUENCES) {
    for (let done = 0; done < seq.steps.length; done++) {
      for (let s = 1; s < 20; s++) {
        const cs = sequenceChoices(seq, done, 4, rng(s));
        assert.equal(cs.filter((c) => c.correct).length, 1);
        assert.equal(cs.find((c) => c.correct).step, seq.steps[done]);
        for (const c of cs) assert.ok(seq.steps.indexOf(c.step) >= done);
        assert.equal(cs.length, Math.min(4, seq.steps.length - done));
      }
    }
    assert.deepEqual(sequenceChoices(seq, seq.steps.length, 3), []);
  }
});

test('un seul dialecte : jamais de question « cousin »', () => {
  for (let s = 1; s < 60; s++) {
    const lv = buildLevel('hall', newProgress(), { older: true, dialects: ['dz'], r: rng(s) });
    for (const q of lv.questions) { assert.notEqual(q.type, 'cousin'); assert.equal(q.dialect, 'dz'); }
  }
});

test('mode frère-sœur : alternance, chacun à son niveau', () => {
  for (let s = 1; s < 50; s++) {
    for (const room of ['stade', 'jardin']) {
      const lv = buildCoop(room, [{ progress: newProgress(), older: true }, { progress: newProgress(), older: false }], { r: rng(s) });
      assert.equal(lv.questions.length, 6);
      lv.questions.forEach((q, i) => assert.equal(q.player, i % 2));
      for (const q of lv.questions.filter((x) => x.player === 1)) { assert.equal(q.type, 'listen'); assert.ok(!q.word.older); }
      assert.ok(lv.learn.length <= 3);
    }
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

test('les mots mal sus reviennent plus souvent', () => {
  const p = newProgress();
  const ws = wordsFor('stade', true);
  for (const w of ws) for (let i = 0; i < 4; i++) grade(p, w.id, true);
  for (let i = 0; i < 4; i++) grade(p, 'maman', false);
  let maman = 0, total = 0;
  for (let s = 1; s < 300; s++) {
    const lv = buildLevel('stade', p, { older: true, r: rng(s) });
    assert.equal(lv.learn.length, 0);
    for (const q of lv.questions) { total++; if (q.word.id === 'maman') maman++; }
  }
  assert.ok(maman / total > (1 / ws.length) * 1.8, `maman ${maman}/${total}`);
});

test('maîtrise, salles verrouillées, mission de la semaine', () => {
  const p = newProgress();
  const ws = wordsFor('hall', true);
  assert.equal(mastery(p, ws), 0);
  grade(p, ws[0].id, true); grade(p, ws[0].id, true);
  assert.equal(mastery(p, ws), 2 / (4 * ws.length));
  for (const w of ws) for (let i = 0; i < 5; i++) grade(p, w.id, true);
  assert.equal(mastery(p, ws), 1);
  const gym = ROOMS.find((r) => r.id === 'gym');
  assert.equal(roomUnlocked(gym, newProgress()), false);
  assert.equal(roomUnlocked(gym, { ...newProgress(), levels: 2 }), true);
  assert.equal(roomUnlocked(gym, newProgress(), true), true);
  const m1 = missionOfWeek(new Date(2026, 9, 26)), m2 = missionOfWeek(new Date(2026, 10, 1)), m3 = missionOfWeek(new Date(2026, 10, 2));
  assert.equal(m1.key, m2.key); // lundi 26 → dimanche 1er : même semaine
  assert.notEqual(m2.key, m3.key);
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

test('dans chaque salle, images et mots sont tous différents (choix jamais ambigus)', () => {
  for (const r of ROOMS) {
    const ws = WORDS.filter((w) => w.room === r.id);
    for (const key of [(w) => w.emoji, (w) => w.fr, (w) => w.ma.lat, (w) => w.dz.lat]) {
      const vals = ws.map(key);
      assert.equal(new Set(vals).size, vals.length, `${r.id} : doublon dans ${vals.join(', ')}`);
    }
  }
});

test('mode anglais : chaque mot anglais est unique dans sa salle, suivi à part', () => {
  for (const r of ROOMS) {
    const ws = englishWords(r.id, true);
    const vals = ws.map((w) => w.en.lat);
    assert.equal(new Set(vals).size, vals.length, `${r.id} : doublon anglais dans ${vals.join(', ')}`);
  }
  for (const id of Object.keys(EN)) assert.ok(WORDS.some((w) => w.id === id), 'EN inconnu : ' + id);
  const lv = buildLevel('animaux', newProgress(), { older: true, lang: 'en', r: rng(3) });
  assert.ok(lv.learn.every((w) => w.id.startsWith('en:') && w.en.lat));
  for (const q of lv.questions) {
    assert.equal(q.dialect, 'en');
    assert.notEqual(q.type, 'cousin');
    assert.equal(q.choices.filter((c) => c.correct).length, 1);
  }
  assert.ok(!buildLevel('jardin', newProgress(), { older: true, lang: 'en' }).questions.some((q) => q.type === 'sequence'));
});
