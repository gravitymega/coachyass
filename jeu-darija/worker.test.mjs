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
