// Le serveur du jeu sur Cloudflare (Worker « jeu-hbibiti ») : il sert les fichiers du jeu, et répond à /api/parler
// avec l'IA gratuite de Cloudflare (Workers AI, inclus dans le plan gratuit, aucun frais ni clé à payer).
// Les habitants de la ville en 3D répondent comme dans la vraie vie, avec des réponses courtes et adaptées aux enfants.
const MODELS = ['@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/meta/llama-3.1-8b-instruct'];
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const clean = (t, max) => String(t || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

function system(name, persona, older) {
  return [
    `Tu joues le rôle de ${name}, un habitant gentil de la médina dans un jeu éducatif pour un enfant de ${older ? '7' : '5'} ans qui apprend la darija (Maroc et Algérie).`,
    `Ton personnage : ${persona}`,
    'Réponds TOUJOURS en français très simple, en 1 ou 2 phrases courtes (25 mots au plus), avec chaleur et bonne humeur, comme dans une vraie conversation.',
    'Ajoute parfois un mot de darija écrit en lettres latines (par exemple : labas, saha, zwin, bezzaf, choukran, yallah) quand c’est naturel.',
    'Règles absolues : jamais de violence, de peur, de contenu pour adultes, de mots grossiers, de marques, de liens ou d’adresses.',
    'Ne demande jamais d’informations personnelles (nom de famille, adresse, école, téléphone, photos).',
    'Si la question n’est pas adaptée à un enfant ou si tu ne sais pas, dis gentiment de demander à Papa ou à Maman.',
    'Tu peux parler de l’islam avec respect et simplicité. Ne dis jamais que tu es une IA ou un programme : reste ton personnage.',
  ].join('\n');
}

async function parler(request, env) {
  if (request.method !== 'POST') return json({ erreur: 'POST seulement' }, 405);
  if (!env.AI) return json({ erreur: 'IA non configurée' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ erreur: 'JSON invalide' }, 400); }
  const name = clean(body.name, 40) || 'Un habitant';
  const persona = clean(body.persona, 400);
  const question = clean(body.question, 200);
  if (!question) return json({ erreur: 'question vide' }, 400);
  const messages = [{ role: 'system', content: system(name, persona, !!body.older) }];
  for (const h of (Array.isArray(body.history) ? body.history : []).slice(-6)) {
    messages.push({ role: 'user', content: clean(h.q, 200) }, { role: 'assistant', content: clean(h.a, 300) });
  }
  messages.push({ role: 'user', content: question });
  for (const model of MODELS) {
    try {
      const out = await env.AI.run(model, { messages, max_tokens: 90, temperature: 0.6 });
      let reponse = clean(out?.response, 320).replace(/https?:\/\/\S+/g, '').replace(/[*_#`]/g, '');
      if (reponse) return json({ reponse });
    } catch { /* modèle indisponible : on essaie le suivant */ }
  }
  return json({ erreur: 'IA indisponible' }, 503);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/api/parler')) return parler(request, env);
    return env.ASSETS.fetch(request);
  },
};
