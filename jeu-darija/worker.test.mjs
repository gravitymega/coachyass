// Le serveur du jeu (worker/index.js) : node --test jeu-darija/worker.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker/index.js';

const post = (body) => new Request('https://jeu.example/api/parler', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('la discussion libre : réponse nettoyée (pas de lien), consignes pour enfants envoyées à l’IA', async () => {
  let seen;
  const env = { AI: { run: async (model, input) => { seen = { model, input }; return { response: 'Salam ! **Labas** https://exemple.com zwin' }; } }, ASSETS: { fetch: () => new Response('fichier') } };
  const r = await worker.fetch(post({ name: 'Maman', persona: 'Je suis Maman.', question: 'Ça va ?', history: [{ q: 'Salut', a: 'Salam' }] }), env);
  const { reponse } = await r.json();
  assert.equal(r.status, 200);
  assert.ok(!reponse.includes('http') && !reponse.includes('*'), reponse);
  assert.match(seen.input.messages[0].content, /enfant/);
  assert.match(seen.input.messages[0].content, /informations personnelles/);
  assert.equal(seen.input.messages.at(-1).content, 'Ça va ?');
  assert.equal(seen.input.messages.length, 4); // consignes + 1 échange + la question
});

test('le serveur sert les fichiers du jeu et refuse les mauvaises demandes', async () => {
  const env = { AI: { run: async () => { throw new Error('quota'); } }, ASSETS: { fetch: () => new Response('fichier') } };
  assert.equal(await (await worker.fetch(new Request('https://jeu.example/index.html'), env)).text(), 'fichier');
  assert.equal((await worker.fetch(post({ question: '' }), env)).status, 400);
  assert.equal((await worker.fetch(post({ question: 'Bonjour' }), env)).status, 503); // IA indisponible : le jeu répond tout seul
  assert.equal((await worker.fetch(new Request('https://jeu.example/api/parler'), env)).status, 405);
});

test('Ali : l’IA connaît ses sports et doit l’encourager', async () => {
  let seen;
  const env = { AI: { run: async (model, input) => { seen = input; return { response: 'Bravo champion !' }; } }, ASSETS: { fetch: () => new Response('') } };
  await worker.fetch(post({ name: 'Papa', persona: 'Je suis Papa.', question: 'Salut', about: 'Ali fait du soccer tous les mardis.' }), env);
  assert.match(seen.messages[0].content, /soccer tous les mardis/);
  assert.match(seen.messages[0].content, /encourage/);
  await worker.fetch(post({ name: 'Papa', persona: 'Je suis Papa.', question: 'Salut' }), env);
  assert.doesNotMatch(seen.messages[0].content, /encourage-le/);
});

test('le labo partagé : code famille obligatoire, progrès fusionnés et gardés', async () => {
  const kv = new Map();
  const env = { LABO_CODE: 'famille-123', LABO: { get: async (k) => (kv.has(k) ? JSON.parse(kv.get(k)) : null), put: async (k, v) => kv.set(k, v) }, ASSETS: { fetch: () => new Response('') } };
  const req = (method, body, code = 'famille-123') => new Request('https://jeu.example/api/labo?enfant=Ali', { method, headers: { 'x-famille': code }, body: body && JSON.stringify(body) });
  assert.equal((await worker.fetch(req('GET', null, 'mauvais'), env)).status, 401);
  assert.equal((await worker.fetch(req('GET', null, 'mauvais'), { ASSETS: env.ASSETS })).status, 503);
  assert.equal((await (await worker.fetch(req('GET'), env)).json()).labo, null);
  const a = { faits: { 'c1-m1': { premier: '2026-11-10', fois: 1, dernier: '2026-11-10', ok: true } }, essais: [{ id: 'c1-m1', jour: '2026-11-10', ok: true, essais: 1, indices: 0, ms: 5 }], revues: {} };
  const b = { faits: { 'c1-m2': { premier: '2026-11-11', fois: 1, dernier: '2026-11-11', ok: true } }, essais: [{ id: 'c1-m2', jour: '2026-11-11', ok: true, essais: 1, indices: 0, ms: 7 }], revues: {} };
  await worker.fetch(req('PUT', { labo: a }), env);
  const out = await (await worker.fetch(req('PUT', { labo: b }), env)).json();
  assert.deepEqual(Object.keys(out.labo.faits).sort(), ['c1-m1', 'c1-m2']);
  assert.ok(kv.has('labo:ali'));
  assert.equal((await worker.fetch(req('PUT', { pas: 1 }), env)).status, 400);
});
