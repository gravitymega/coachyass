// Le labo du Dr Harley : node --test jeu-darija/labo.test.mjs
// Ce test est aussi le VALIDEUR : une mission mal écrite le fait échouer, et elle ne doit pas être publiée.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPITRES } from './labo-missions.js';
import { validateMission, missionsState, recordMission, newLabo, gradeOf, enLettres, robotRun, robotSolution, bulletin, addDays, ESPACEMENT } from './labo-core.js';

const toutes = CHAPITRES.flatMap((c) => c.missions);

test('valideur : chaque mission respecte le format, ids uniques, chapitres de 7 missions', () => {
  for (const m of toutes) assert.deepEqual(validateMission(m), [], m.id);
  assert.equal(new Set(toutes.map((m) => m.id)).size, toutes.length);
  for (const c of CHAPITRES) {
    assert.equal(c.missions.length, 7, c.id);
    assert.equal(c.missions.at(-1).domaine, 'defi', `${c.id} : le 7e jour est le défi du chapitre`);
  }
  assert.ok(validateMission({ id: 'x', domaine: 'maths', etapes: [{ moteur: 'robot', consigne: 'a', largeur: 2, hauteur: 1, depart: [0, 0], but: [1, 0], murs: [[1, 0]] }] }).length >= 3);
});

test('nombres en lettres', () => {
  assert.deepEqual([0, 1, 13, 17, 21, 30, 71, 75, 80, 81, 99, 100].map(enLettres),
    ['zéro', 'un', 'treize', 'dix-sept', 'vingt-et-un', 'trente', 'soixante-et-onze', 'soixante-quinze', 'quatre-vingts', 'quatre-vingt-un', 'quatre-vingt-dix-neuf', 'cent']);
});

test('Bip : suite de flèches, murs, plus court chemin', () => {
  const s = { largeur: 4, hauteur: 3, depart: [0, 1], but: [2, 1], murs: [[1, 1]] };
  assert.equal(robotRun(s, ['→']).bloque, true);
  assert.equal(robotRun(s, ['↑', '→', '→', '↓']).gagne, true);
  assert.equal(robotSolution(s).length, 4);
});

test('une seule nouvelle mission par jour, on peut rejouer les anciennes', () => {
  const ms = CHAPITRES[0].missions, labo = newLabo(), j1 = '2026-11-10';
  let st = missionsState(ms, labo, j1);
  assert.deepEqual(st.slice(0, 3).map((x) => x.etat), ['ouverte', 'fermee', 'fermee']);
  recordMission(labo, ms[0], { ok: true, essais: 1, indices: 0, ms: 60000 }, j1);
  st = missionsState(ms, labo, j1);
  assert.deepEqual(st.slice(0, 3).map((x) => x.etat), ['faite', 'demain', 'fermee']);
  recordMission(labo, ms[0], { ok: true, essais: 1, indices: 0 }, j1); // rejouer : toujours permis, ne débloque rien
  assert.equal(missionsState(ms, labo, j1)[1].etat, 'demain');
  assert.equal(missionsState(ms, labo, addDays(j1, 1))[1].etat, 'ouverte');
  assert.equal(missionsState(ms, labo, j1, { libre: true })[1].etat, 'ouverte'); // réglage parents
  // Ali ne joue pas pendant des jours : la mission suivante l'attend, rien n'est perdu.
  assert.equal(missionsState(ms, labo, addDays(j1, 9))[1].etat, 'ouverte');
});

test('révisions : difficile → revient demain en plus doux ; réussi → 1, 3, 7… jours ; 3 réussites = acquise', () => {
  const m = CHAPITRES[0].missions[0], labo = newLabo();
  let j = '2026-11-10';
  recordMission(labo, m, { ok: false, essais: 3, indices: 1, solution: true }, j);
  assert.equal(labo.revues['compter-15'].due, addDays(j, 1));
  assert.equal(labo.revues['compter-15'].doux, true);
  j = addDays(j, 1);
  recordMission(labo, m, { ok: true, essais: 2, indices: 0 }, j);
  assert.equal(labo.revues['compter-15'].due, addDays(j, ESPACEMENT[1]));
  assert.equal(missionsState(CHAPITRES[0].missions, labo, addDays(j, 3))[0].revue, true);
  j = addDays(j, 3); recordMission(labo, m, { ok: true, essais: 1, indices: 0 }, j);
  assert.ok(!labo.revues['compter-15'].acquise);
  assert.equal(labo.revues['compter-15'].due, addDays(j, ESPACEMENT[3])); // réussi vite : on saute une marche
  j = labo.revues['compter-15'].due; recordMission(labo, m, { ok: true, essais: 1, indices: 0 }, j);
  assert.equal(labo.revues['compter-15'].acquise, true);
});

test('grades et bulletin du dimanche', () => {
  const labo = newLabo();
  assert.equal(gradeOf(CHAPITRES, labo).nom, 'Visiteur du labo');
  CHAPITRES[0].missions.forEach((m, i) => recordMission(labo, m, { ok: i !== 1, essais: i === 1 ? 4 : 1, indices: 0, solution: i === 1 }, addDays('2026-11-09', i)));
  assert.equal(gradeOf(CHAPITRES, labo).nom, 'Apprenti du labo');
  const b = bulletin(CHAPITRES, labo, '2026-11-15');
  assert.equal(b.length, 4);
  assert.match(b[0], /Les bulles de la fiole/);
  assert.match(b[1], /Bip et la pièce cachée/);
  assert.match(b[3], /premier coup/);
});

test('un seul labo : fusion des progrès de deux appareils, sans rien perdre', async () => {
  const { mergeLabo } = await import('./labo-core.js');
  const ms = CHAPITRES[0].missions;
  const tablette = newLabo(), serveur = newLabo();
  recordMission(tablette, ms[0], { ok: true, essais: 1, indices: 0, ms: 1000 }, '2026-11-10');
  recordMission(serveur, ms[0], { ok: true, essais: 2, indices: 0, ms: 2000 }, '2026-11-11');
  recordMission(serveur, ms[1], { ok: true, essais: 1, indices: 0, ms: 3000 }, '2026-11-11');
  const m = mergeLabo(tablette, serveur);
  assert.equal(m.faits['c1-m1'].premier, '2026-11-10');
  assert.equal(m.faits['c1-m1'].dernier, '2026-11-11');
  assert.ok(m.faits['c1-m2']);
  assert.equal(m.essais.length, 3);
  assert.deepEqual(mergeLabo(m, m).essais.length, 3); // fusionner deux fois ne double rien
  assert.equal(missionsState(ms, m, '2026-11-11')[2].etat, 'demain'); // la règle « une par jour » vaut sur tous les appareils
  assert.deepEqual(mergeLabo(null, tablette).faits, tablette.faits);
});
