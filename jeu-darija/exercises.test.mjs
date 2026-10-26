import test from 'node:test';
import assert from 'node:assert/strict';
import { rng, newProgress, grade, ROOMS, buildCoop, WORDS } from './core.js';
import { SKILLS, makeExercise, skillsFor, buildExerciseLevel, buildChallenge, itemsFor, MOTS, isExerciseRoom } from './exercises.js';

const strip = (h) => String(h).replace(/<[^>]+>/g, '').trim();
const numOf = (c) => Number(c.key);

test('chaque compétence : 3 choix différents, une seule bonne réponse, textes présents', () => {
  for (const skill of Object.keys(SKILLS)) {
    for (let s = 1; s <= 400; s++) {
      for (const dialect of ['ma', 'dz']) {
        const q = makeExercise(skill, { r: rng(s * 31 + skill.length), dialect });
        assert.equal(q.type, 'gen');
        assert.equal(q.word.id, 'x:' + skill);
        assert.equal(q.choices.length, 3, skill);
        assert.equal(new Set(q.choices.map((c) => c.key)).size, 3, `${skill} doublon ${q.choices.map((c) => c.key)}`);
        assert.equal(q.choices.filter((c) => c.correct).length, 1, skill);
        assert.ok(q.text && q.say.length && q.answer.text && q.answer.say.length, skill);
        for (const c of q.choices) assert.ok(c.html, skill);
        if (q.choices.every((c) => /^-?\d+$/.test(c.key))) for (const c of q.choices) assert.ok(numOf(c) >= 0, `${skill} négatif`);
      }
    }
  }
});

test('les calculs sont justes', () => {
  for (let s = 1; s < 500; s++) {
    const r = rng(s);
    for (const skill of ['m-add10', 'm-add20', 'm-sub10', 'm-sub20']) {
      const q = makeExercise(skill, { r });
      const [a, op, b] = strip(q.text).replace(' = ?', '').split(' ');
      const v = op === '+' ? +a + +b : +a - +b;
      assert.equal(numOf(q.choices.find((c) => c.correct)), v, q.text);
      assert.ok(v >= 0 && v <= 20);
      if (skill.endsWith('10')) assert.ok(+a <= 10 && v <= 10, q.text);
    }
    const d = makeExercise('m-double', { r });
    assert.equal(numOf(d.choices.find((c) => c.correct)), 2 * Number(strip(d.text).match(/\d+/)[0]));
    const c = makeExercise('m-compare', { r });
    const [x, , y] = strip(c.text).split(' ');
    const sign = +x < +y ? '<' : +x > +y ? '>' : '=';
    assert.equal(c.choices.find((k) => k.correct).key, sign);
  }
});

test('calcul en darija : la réponse est le bon nombre dans le bon dialecte', () => {
  for (let s = 1; s < 200; s++) {
    for (const d of ['ma', 'dz']) {
      const q = makeExercise('m-darija', { r: rng(s), dialect: d });
      const right = q.choices.find((c) => c.correct);
      const sum = Number(q.answer.text.match(/= (\d+)/)[1]);
      assert.equal(right.say.word.id, 'n' + sum);
      assert.equal(right.say.d, d);
      assert.ok(sum >= 2 && sum <= 10);
    }
  }
});

test('profils : rien d’écrit à lire pour le profil qui ne lit pas', () => {
  for (const room of ['maths', 'lecture', 'formes']) {
    const young = skillsFor(room, false);
    assert.ok(young.length >= 2, room);
    for (const s of young) assert.ok(SKILLS[s].young, s);
    for (const s of ['l-read', 'l-write', 'l-sentence', 'm-problem', 'f-clock']) assert.ok(!young.includes(s));
    assert.ok(skillsFor(room, true).length >= 3);
  }
});

test('compétences difficiles débloquées au fil des niveaux', () => {
  assert.ok(!skillsFor('maths', true, 0).includes('m-tens'));
  assert.ok(skillsFor('maths', true, 3).includes('m-tens'));
});

test('niveau d’exercices : 5 questions, nouvelle compétence d’abord, révision pondérée', () => {
  const p = newProgress();
  const lv = buildExerciseLevel('maths', p, { older: true, r: rng(3) });
  assert.equal(lv.questions.length, 5);
  assert.equal(lv.questions[0].skill, skillsFor('maths', true, 0)[0]);
  for (const s of skillsFor('maths', true, 0)) for (let i = 0; i < 4; i++) grade(p, 'x:' + s, true);
  for (let i = 0; i < 4; i++) grade(p, 'x:m-sub10', false);
  let sub = 0, tot = 0;
  for (let s = 1; s < 200; s++) for (const q of buildExerciseLevel('maths', p, { older: true, r: rng(s) }).questions) { tot++; if (q.skill === 'm-sub10') sub++; }
  assert.ok(sub / tot > 0.3, `${sub}/${tot}`);
});

test('mode Ensemble avec exercices', () => {
  const lv = buildCoop('lecture', [{ progress: newProgress(), older: true }, { progress: newProgress(), older: false }], { build: buildExerciseLevel, r: rng(5) });
  assert.equal(lv.questions.length, 6);
  for (const q of lv.questions.filter((x) => x.player === 1)) assert.ok(SKILLS[q.skill].young);
});

test('défi éclair : 10 questions mêlées, chacune avec sa scène', () => {
  const p = newProgress();
  for (const w of WORDS.filter((x) => x.room === 'hall')) p.words[w.id] = { box: 1, seen: true };
  const games = Object.fromEntries(ROOMS.map((r) => [r.id, r.game]));
  const lv = buildChallenge(p, { older: true, rooms: ['hall', 'maths', 'lecture'], games, r: rng(9) });
  assert.equal(lv.questions.length, 10);
  for (const q of lv.questions) assert.ok(q.game);
  assert.ok(lv.questions.some((q) => q.type === 'gen') && lv.questions.some((q) => q.type !== 'gen'));
});

test('items de maîtrise et mots illustrés', () => {
  assert.ok(itemsFor('maths', true).every((i) => i.id.startsWith('x:')));
  assert.ok(itemsFor('hall', true).every((i) => !i.id.startsWith('x:')));
  assert.ok(isExerciseRoom('formes') && !isExerciseRoom('stade'));
  assert.equal(new Set(MOTS.map((m) => m.mot)).size, MOTS.length);
  assert.equal(new Set(MOTS.map((m) => m.e)).size, MOTS.length);
});
