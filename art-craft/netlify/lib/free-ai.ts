// IA gratuites d'Art craft (règle « aucun frais » : pas de clé API facturée à l'usage).
//   1. Google Gemini, plan gratuit (clé GEMINI_API_KEY créée sur aistudio.google.com, sans carte) ;
//   2. OpenRouter, modèles « :free » (clé OPENROUTER_API_KEY, sans carte ; ~50 à 200 demandes/jour) ;
//   3. Groq, plan gratuit (clé GROQ_API_KEY, sans carte ; Llama 4 Scout, 5 images par demande) ;
//   4. en dernier secours, Cloudflare Workers AI (liaison « AI » du Worker, 10 000 neurones gratuits par jour ;
//      sur le plan gratuit de Cloudflare, rien n'est facturé : les appels s'arrêtent au quota).
// On ne passe au suivant que si le précédent est épuisé (429), en panne (5xx) ou absent.
// Les deux reçoivent la même demande que Claude (consigne, images, schéma JSON) et renvoient
// le texte de la réponse. Module sans dépendance : marche sur Netlify et sur Cloudflare.
// (Rangé hors de netlify/functions/ : Netlify y ferait sinon une fonction à part.)

type Block = { type: string; text?: string; source?: { data: string; media_type?: string }; url?: string; start?: number; end?: number };
type Part = { text?: string; image?: string; mime?: string; youtube?: { url: string; start: number; end: number } };
export type FreeRequest = { system: string; content: Block[]; schema?: unknown; live?: boolean };
export type WorkersAi = { run: (model: string, input: unknown) => Promise<unknown> };

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
export const GEMINI_MODEL = "gemini-3.8-flash";
// Commentaire en direct : une phrase, il faut répondre vite.
export const GEMINI_LIVE_MODEL = "gemini-3.1-flash-lite";
export const WORKERS_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
// « openrouter/free » choisit lui-même un modèle gratuit qui sait lire les images envoyées.
export const OPENROUTER_MODEL = "openrouter/free";
export const GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
const OPENROUTER_MAX_IMAGES = 16;
const GROQ_MAX_IMAGES = 5; // limite de Groq par demande
// Le modèle de secours lit moins bien beaucoup d'images à la fois, et chaque image coûte du quota.
const WORKERS_MAX_IMAGES = 8;

export class AiError extends Error {
  status: number;
  retry: boolean;
  constructor(message: string, { status = 0, retry = false } = {}) {
    super(message);
    this.status = status;
    this.retry = retry; // vrai si l'IA de secours peut prendre le relais
  }
}

// Contenu au format Claude ({type:"text"} / {type:"image", source:{data}}) → morceaux simples.
const parts = (content: Block[]): Part[] =>
  content.map((b) =>
    b.type === "youtube" && b.url ? { youtube: { url: b.url, start: b.start ?? 0, end: b.end ?? 0 } }
      : b.type === "image" && b.source ? { image: b.source.data, mime: b.source.media_type } : { text: b.text ?? "" });

// Vrai si la demande contient un lien YouTube : seul Gemini sait regarder une vidéo YouTube.
export const hasYoutube = (request: FreeRequest) => request.content.some((b) => b.type === "youtube");

// Retire un éventuel bloc de code autour du JSON.
export function cleanJson(text: string) {
  return String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

const schemaHint = (schema: unknown) =>
  `\nRéponds uniquement avec un objet JSON valide (sans bloc de code) qui respecte ce schéma JSON :\n${JSON.stringify(schema)}`;

async function geminiCall(key: string, model: string, request: FreeRequest, withSchema: boolean) {
  // Lien YouTube public : Gemini regarde lui-même la vidéo, seulement de start à end (videoMetadata).
  const userParts = parts(request.content).map((p) =>
    p.youtube
      ? {
        fileData: { fileUri: p.youtube.url },
        videoMetadata: { startOffset: `${Math.floor(p.youtube.start)}s`, endOffset: `${Math.ceil(p.youtube.end)}s` },
      }
      : p.image ? { inlineData: { mimeType: p.mime || "image/jpeg", data: p.image } } : { text: p.text });
  const generationConfig: Record<string, unknown> = { maxOutputTokens: request.live ? 1024 : 32768 };
  if (request.schema && withSchema) {
    generationConfig.responseFormat = { text: { mimeType: "APPLICATION_JSON", schema: request.schema } };
  } else if (request.schema) {
    userParts.push({ text: schemaHint(request.schema) } as (typeof userParts)[number]);
  }
  const res = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: request.system }] },
      contents: [{ role: "user", parts: userParts }],
      generationConfig,
    }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    if (res.status === 400 && withSchema && request.schema) return null; // schéma refusé : on réessaie sans
    if (res.status === 400 || res.status === 403) {
      if (/api key|API_KEY/i.test(msg)) throw new AiError("Clé GEMINI_API_KEY refusée par Google", { status: res.status });
      throw new AiError(`Requête refusée par Gemini : ${msg}`, { status: res.status });
    }
    // 429 = quota gratuit épuisé ; 5xx = Gemini surchargé : l'IA de secours prend le relais.
    throw new AiError(res.status === 429 ? "Quota gratuit de Gemini épuisé pour le moment" : `Gemini indisponible (${res.status})`,
      { status: res.status, retry: res.status === 429 || res.status >= 500 });
  }
  if (data.promptFeedback?.blockReason) throw new AiError("Gemini a refusé d'analyser ces images.");
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p: { thought?: boolean; text?: unknown }) => !p.thought && typeof p.text === "string").map((p: { text: string }) => p.text).join("");
  if (cand?.finishReason === "MAX_TOKENS") throw new AiError("Réponse trop longue, coupée : réessaie avec une séquence plus courte.");
  if (!text) throw new AiError(cand?.finishReason && cand.finishReason !== "STOP" ? "Gemini a refusé d'analyser ces images." : "Réponse vide de Gemini", { retry: true });
  return { text, model };
}

export async function askGemini(key: string, request: FreeRequest) {
  const model = request.live ? GEMINI_LIVE_MODEL : GEMINI_MODEL;
  // Schéma refusé (trop complexe pour Gemini) : on le donne dans la consigne à la place.
  const out = (await geminiCall(key, model, request, true)) ?? (await geminiCall(key, model, request, false));
  if (!out) throw new AiError("Réponse vide de Gemini", { retry: true });
  return out;
}

// Garde au plus n images, réparties sur toute la séquence (avec le texte qui précède chacune).
function thinImages(list: Part[], n: number) {
  const idx = list.map((p, i) => (p.image ? i : -1)).filter((i) => i >= 0);
  if (idx.length <= n) return list;
  const keep = new Set(Array.from({ length: n }, (_, k) => idx[Math.round((k * (idx.length - 1)) / (n - 1))]));
  return list.filter((p, i) => !p.image || keep.has(i));
}

// Contenu au format « chat » d'OpenAI (OpenRouter, Groq, Workers AI), au plus n images.
function chatContent(request: FreeRequest, n: number) {
  const content = thinImages(parts(request.content), n).map((p) =>
    p.image ? { type: "image_url", image_url: { url: `data:${p.mime || "image/jpeg"};base64,${p.image}` } } : { type: "text", text: p.text });
  if (request.schema) content.push({ type: "text", text: schemaHint(request.schema) });
  return content;
}

// OpenRouter et Groq : même API « chat completions » qu'OpenAI.
async function chatCall(name: string, url: string, key: string, model: string, maxImages: number, request: FreeRequest) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: request.system }, { role: "user", content: chatContent(request, maxImages) }],
        max_tokens: request.live ? 300 : 8000,
      }),
    });
  } catch (err) {
    throw new AiError(`${name} injoignable`, { retry: true });
  }
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new AiError(`Clé ${name} refusée`, { status: res.status, retry: true });
    throw new AiError(res.status === 429 ? `Quota gratuit de ${name} épuisé pour le moment` : `${name} indisponible (${res.status}) : ${msg}`,
      { status: res.status, retry: res.status === 429 || res.status === 402 || res.status >= 500 || res.status === 400 });
  }
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) throw new AiError(`Réponse vide de ${name}`, { retry: true });
  return { text, model: data.model || model };
}

export const askOpenRouter = (key: string, request: FreeRequest) =>
  chatCall("OpenRouter", "https://openrouter.ai/api/v1/chat/completions", key, OPENROUTER_MODEL, OPENROUTER_MAX_IMAGES, request);
export const askGroq = (key: string, request: FreeRequest) =>
  chatCall("Groq", "https://api.groq.com/openai/v1/chat/completions", key, GROQ_MODEL, GROQ_MAX_IMAGES, request);

export async function askWorkersAi(ai: WorkersAi, request: FreeRequest) {
  const content = chatContent(request, WORKERS_MAX_IMAGES);
  const input: Record<string, unknown> = {
    messages: [{ role: "system", content: request.system }, { role: "user", content }],
    max_tokens: request.live ? 300 : 8000,
  };
  if (request.schema) input.response_format = { type: "json_schema", json_schema: request.schema };
  let out: { response?: unknown } | undefined;
  try {
    out = (await ai.run(WORKERS_MODEL, input)) as { response?: unknown };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AiError(/limit|quota|neuron|4006/i.test(msg)
      ? "Quota gratuit du jour épuisé (Gemini et Cloudflare) : réessaie demain."
      : `IA de secours (Cloudflare) indisponible : ${msg}`);
  }
  const r = out?.response;
  const text = typeof r === "string" ? r : r && typeof r === "object" ? JSON.stringify(r) : "";
  if (!text) throw new AiError("Réponse vide de l'IA de secours (Cloudflare)");
  return { text, model: WORKERS_MODEL };
}

export type FreeProviders = { geminiKey?: string; openrouterKey?: string; groqKey?: string; ai?: WorkersAi };

// Gemini d'abord, puis OpenRouter, Groq et Workers AI si le précédent est épuisé, en panne ou absent.
export async function askFree({ geminiKey, openrouterKey, groqKey, ai }: FreeProviders, request: FreeRequest) {
  // Un lien YouTube ne peut être regardé que par Gemini.
  if (hasYoutube(request)) {
    if (!geminiKey) throw new AiError("L'analyse d'un lien YouTube demande la clé GEMINI_API_KEY dans les variables du site Art craft.");
    return askGemini(geminiKey, request);
  }
  const chain: [string, () => Promise<{ text: string; model: string }>][] = [];
  if (geminiKey) chain.push(["Gemini", () => askGemini(geminiKey, request)]);
  if (openrouterKey) chain.push(["OpenRouter", () => askOpenRouter(openrouterKey, request)]);
  if (groqKey) chain.push(["Groq", () => askGroq(groqKey, request)]);
  if (ai) chain.push(["Cloudflare", () => askWorkersAi(ai, request)]);
  if (!chain.length) throw new AiError("Aucune IA branchée : ajoute GEMINI_API_KEY dans les variables du site Art craft.");
  const errors: string[] = [];
  for (let i = 0; i < chain.length; i++) {
    try {
      return await chain[i][1]();
    } catch (err) {
      const last = i === chain.length - 1;
      // Erreur définitive (mauvaise clé Gemini, images refusées) ou dernier recours : on s'arrête.
      if (!(err instanceof AiError) || !err.retry || last) {
        if (err instanceof AiError && errors.length && !/Quota gratuit du jour/.test(err.message)) err.message = `${errors.join(" ; ")} ; ${err.message}`;
        throw err;
      }
      errors.push(err.message);
    }
  }
  throw new AiError("Aucune IA disponible");
}
