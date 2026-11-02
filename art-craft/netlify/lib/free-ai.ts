// IA gratuites d'Art craft (règle « aucun frais » : pas de clé API facturée à l'usage).
//   1. Google Gemini, plan gratuit (clé GEMINI_API_KEY créée sur aistudio.google.com, sans carte) ;
//   1 bis. Mistral (plan gratuit « Experiment », clé MISTRAL_API_KEY, sans carte ; lit les images) ;
//   1 ter. NVIDIA NIM (programme développeur gratuit, clé NVIDIA_API_KEY ; 40 demandes/min, 10 000/jour) ;
//   2. en secours, OpenRouter, modèles gratuits « :free » seulement (clé OPENROUTER_API_KEY ; compte sans
//      crédit acheté : rien ne peut être facturé, les appels s'arrêtent au quota gratuit du jour) ;
//   3. Groq, plan gratuit (clé GROQ_API_KEY, sans carte ; Qwen 3.8 27B, 3 images au plus par demande) ;
//   4. en dernier recours, Cloudflare Workers AI (liaison « AI » du Worker, 10 000 neurones gratuits par jour ;
//      sur le plan gratuit de Cloudflare, rien n'est facturé : les appels s'arrêtent au quota).
// Tous reçoivent la même demande que Claude (consigne, images, schéma JSON) et renvoient
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
// OpenRouter : modèles gratuits qui lisent les images, essayés dans l'ordre par OpenRouter lui-même
// (paramètre « models »). Seuls des modèles gratuits sont permis : voir isFreeModel.
export const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Liste précise, sans le routeur « openrouter/free » : il peut tomber sur un modèle qui ne sait pas
// répondre (ex. nemotron-3.5-content-safety, qui ne fait que classer un message « sûr » ou non).
export const OPENROUTER_MODELS = ["nvidia/nemotron-3.5-super-vl:free", "google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free"];
export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Llama 4 Scout a été retiré par Groq le 17 juillet 2026 : les modèles Qwen lisent les images.
// Essayés dans l'ordre (un modèle retiré ou inconnu passe au suivant) ; GROQ_MODEL en tête s'il est défini.
export const GROQ_MODELS = ["qwen/qwen3.8-27b", "qwen/qwen3.6-27b"];
const GROQ_MAX_IMAGES = 3; // limite de Groq par demande pour les modèles Qwen
export const WORKERS_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
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

// Gemini surchargé (503, « model overloaded ») : ça arrive souvent aux heures de pointe et ça passe
// en quelques secondes. On réessaie le même modèle après une courte pause, puis un 2e modèle Gemini
// gratuit (Flash-Lite, qui lit aussi les vidéos YouTube), avant de passer aux autres IA.
// Chaque modèle a sa propre capacité chez Google : quand l'un est surchargé, un autre répond souvent.
// Tous gratuits et tous capables de regarder une vidéo YouTube. Un nom inconnu (404) est sauté.
export const GEMINI_FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-2.5-flash", "gemini-3.1-flash-lite"];
export const GEMINI_RETRY_WAITS_MS = [2500, 6000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function geminiOnce(key: string, model: string, request: FreeRequest) {
  // Schéma refusé (trop complexe pour Gemini) : on le donne dans la consigne à la place.
  const out = (await geminiCall(key, model, request, true)) ?? (await geminiCall(key, model, request, false));
  if (!out) throw new AiError("Réponse vide de Gemini", { retry: true });
  return out;
}

export async function askGemini(key: string, request: FreeRequest, { waits = GEMINI_RETRY_WAITS_MS } = {}) {
  const models = request.live ? [GEMINI_LIVE_MODEL] : [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS];
  let last: unknown;
  for (let m = 0; m < models.length; m++) {
    // Le modèle principal a droit à des nouveaux essais ; le modèle de secours, à un seul.
    const tries = m === 0 && !request.live ? waits.length + 1 : 1; // commentaire en direct : pas le temps d'attendre
    for (let i = 0; i < tries; i++) {
      try {
        return await geminiOnce(key, models[m], request);
      } catch (err) {
        last = err;
        const status = err instanceof AiError ? err.status : 0;
        // Quota du jour de ce modèle épuisé (429 : chaque modèle Gemini a son propre quota gratuit),
        // ou modèle de secours inconnu ou retiré (404) : on passe au modèle suivant.
        if (status === 429 || (m > 0 && status === 404)) break;
        // Seule une surcharge (5xx) vaut un nouvel essai : quota épuisé ou requête refusée, non.
        if (status < 500) throw err;
        if (i < tries - 1) await sleep(waits[i]);
      }
    }
  }
  if (last instanceof AiError && last.status === 429) {
    last.message = "Quota gratuit de Gemini épuisé pour le moment, sur tous les modèles gratuits"
      + (hasYoutube(request) ? " : réessaie plus tard, ou dépose le fichier vidéo (d'autres IA gratuites prennent alors le relais)." : ".");
  } else if (last instanceof AiError) {
    last.message = "Gemini est surchargé en ce moment (erreur 503 de Google), même après plusieurs essais. Réessaie dans quelques minutes"
      + (hasYoutube(request) ? ", ou dépose le fichier vidéo : d'autres IA gratuites prennent alors le relais." : ".");
  }
  throw last;
}

// Garde-fou « aucun frais » : un modèle OpenRouter payant ne doit jamais être appelé.
export const isFreeModel = (model: string) => model.endsWith(":free");

async function openRouterCall(key: string, request: FreeRequest, withFormat: boolean) {
  const models = OPENROUTER_MODELS.filter(isFreeModel);
  const content = parts(request.content).map((p) =>
    p.image ? { type: "image_url", image_url: { url: `data:${p.mime || "image/jpeg"};base64,${p.image}` } } : { type: "text", text: p.text });
  if (request.schema) content.push({ type: "text", text: schemaHint(request.schema) });
  const body: Record<string, unknown> = {
    model: models[0],
    models,
    messages: [{ role: "system", content: request.system }, { role: "user", content }],
    max_tokens: request.live ? 1024 : 16000,
  };
  if (request.schema && withFormat) body.response_format = { type: "json_schema", json_schema: { name: "reponse", strict: false, schema: request.schema } };
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "X-Title": "Art craft" },
    body: JSON.stringify(body),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 400 && withFormat && request.schema) return null; // format JSON refusé : on réessaie sans
    const msg = data?.error?.message || `HTTP ${res.status}`;
    throw new AiError(res.status === 401 ? "Clé OPENROUTER_API_KEY refusée par OpenRouter"
      : res.status === 429 ? "Quota gratuit d'OpenRouter épuisé pour le moment" : `OpenRouter indisponible : ${msg}`, { status: res.status });
  }
  const choice = data.choices?.[0];
  if (choice?.error) throw new AiError(`OpenRouter indisponible : ${choice.error.message || "erreur"}`);
  const text = typeof choice?.message?.content === "string" ? choice.message.content : "";
  if (!text) throw new AiError("Réponse vide d'OpenRouter");
  return { text, model: String(data.model || models[0]) };
}

export async function askOpenRouter(key: string, request: FreeRequest) {
  const out = (await openRouterCall(key, request, true)) ?? (await openRouterCall(key, request, false));
  if (!out) throw new AiError("Réponse vide d'OpenRouter");
  return out;
}

// Groq (plan gratuit) : même API « chat completions » qu'OpenAI, schéma JSON donné dans la consigne.
// model : GROQ_MODEL (facultatif) à essayer avant la liste GROQ_MODELS.
export async function askGroq(key: string, request: FreeRequest, model?: string) {
  const content = thinImages(parts(request.content), GROQ_MAX_IMAGES).map((p) =>
    p.image ? { type: "image_url", image_url: { url: `data:${p.mime || "image/jpeg"};base64,${p.image}` } } : { type: "text", text: p.text });
  if (request.schema) content.push({ type: "text", text: schemaHint(request.schema) });
  const models = [...new Set([model, ...GROQ_MODELS].filter(Boolean) as string[])];
  let last = "";
  for (const m of models) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: m,
        messages: [{ role: "system", content: request.system }, { role: "user", content }],
        max_tokens: request.live ? 300 : 8000,
        reasoning_effort: "none", // mode « instruct » : réponse directe, sans réflexion qui mange les jetons
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `HTTP ${res.status}`;
      // Modèle retiré, inconnu ou qui ne lit pas les images : on essaie le suivant.
      if (res.status === 404 || /does not exist|decommissioned|not found|not supported|image/i.test(msg)) { last = `${m} : ${msg}`; continue; }
      throw new AiError(res.status === 401 ? "Clé GROQ_API_KEY refusée par Groq"
        : res.status === 429 ? "Quota gratuit de Groq épuisé pour le moment" : `Groq indisponible : ${msg}`, { status: res.status });
    }
    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text) throw new AiError("Réponse vide de Groq");
    return { text, model: String(data.model || m) };
  }
  throw new AiError(`Aucun modèle Groq disponible (${last}) : mets le nom d'un modèle qui lit les images dans GROQ_MODEL.`);
}

// API « chat completions » compatible OpenAI (Mistral, NVIDIA NIM) : images en data URL, schéma JSON
// dans la consigne (format le plus largement accepté), modèles essayés dans l'ordre.
type Compatible = { name: string; keyName: string; url: string; models: string[]; maxImages: number };
export const MISTRAL: Compatible = {
  name: "Mistral", keyName: "MISTRAL_API_KEY", url: "https://api.mistral.ai/v1/chat/completions",
  // Alias stables de Mistral (Medium 3.5 puis Small 4, tous deux lisent les images).
  models: ["mistral-medium-latest", "mistral-small-latest"], maxImages: 8,
};
export const NVIDIA: Compatible = {
  name: "NVIDIA", keyName: "NVIDIA_API_KEY", url: "https://integrate.api.nvidia.com/v1/chat/completions",
  models: ["google/gemma-4-31b-it", "nvidia/nemotron-3.5-super-vl"], maxImages: 8,
};

export async function askCompatible(p: Compatible, key: string, request: FreeRequest) {
  const content = thinImages(parts(request.content), p.maxImages).map((x) =>
    x.image ? { type: "image_url", image_url: { url: `data:${x.mime || "image/jpeg"};base64,${x.image}` } } : { type: "text", text: x.text });
  if (request.schema) content.push({ type: "text", text: schemaHint(request.schema) });
  let last = "";
  for (const m of p.models) {
    const res = await fetch(p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: m,
        messages: [{ role: "system", content: request.system }, { role: "user", content }],
        max_tokens: request.live ? 300 : 8000,
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || data?.message || data?.detail || `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) throw new AiError(`Clé ${p.keyName} refusée par ${p.name}`, { status: res.status, retry: true });
      // Modèle inconnu, retiré, surchargé ou quota de ce modèle épuisé : on essaie le suivant.
      if ([404, 422, 429].includes(res.status) || res.status >= 500 || /model|not found|image/i.test(String(msg))) { last = `${m} : ${msg}`; continue; }
      throw new AiError(`${p.name} indisponible : ${msg}`, { status: res.status, retry: true });
    }
    const raw = data.choices?.[0]?.message?.content;
    const text = typeof raw === "string" ? raw : Array.isArray(raw) ? raw.map((c: { text?: string }) => c?.text || "").join("") : "";
    if (!text) { last = `${m} : réponse vide`; continue; }
    return { text, model: `${p.name.toLowerCase()}/${String(data.model || m)}` };
  }
  throw new AiError(`${p.name} indisponible (${last})`, { retry: true });
}

// Garde au plus n images, réparties sur toute la séquence (avec le texte qui précède chacune).
function thinImages(list: Part[], n: number) {
  const idx = list.map((p, i) => (p.image ? i : -1)).filter((i) => i >= 0);
  if (idx.length <= n) return list;
  const keep = new Set(Array.from({ length: n }, (_, k) => idx[Math.round((k * (idx.length - 1)) / (n - 1))]));
  return list.filter((p, i) => !p.image || keep.has(i));
}

export async function askWorkersAi(ai: WorkersAi, request: FreeRequest) {
  const content = thinImages(parts(request.content), WORKERS_MAX_IMAGES).map((p) =>
    p.image ? { type: "image_url", image_url: { url: `data:${p.mime || "image/jpeg"};base64,${p.image}` } } : { type: "text", text: p.text });
  if (request.schema) content.push({ type: "text", text: schemaHint(request.schema) });
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
      ? "Quota gratuit du jour épuisé (toutes les IA gratuites branchées, Cloudflare compris) : réessaie demain."
      : `IA de secours (Cloudflare) indisponible : ${msg}`);
  }
  const r = out?.response;
  const text = typeof r === "string" ? r : r && typeof r === "object" ? JSON.stringify(r) : "";
  if (!text) throw new AiError("Réponse vide de l'IA de secours (Cloudflare)");
  return { text, model: WORKERS_MODEL };
}

export type FreeProviders = {
  geminiKey?: string; mistralKey?: string; nvidiaKey?: string; openRouterKey?: string; groqKey?: string; groqModel?: string; ai?: WorkersAi;
};

// Vrai si au moins une IA gratuite est branchée.
export const anyFreeProvider = (p: FreeProviders) =>
  Boolean(p.geminiKey || p.mistralKey || p.nvidiaKey || p.openRouterKey || p.groqKey || p.ai);

// Ordre : Gemini (plusieurs modèles), Mistral, NVIDIA, OpenRouter, Groq, puis Workers AI.
// Chacun prend le relais quand le précédent est épuisé, en panne ou absent.
// Un lien YouTube ne peut être regardé que par Gemini.
export async function askFree(p: FreeProviders, request: FreeRequest) {
  const errors: AiError[] = [];
  const chain: [unknown, () => Promise<{ text: string; model: string }>][] = [
    [p.geminiKey, () => askGemini(p.geminiKey!, request)],
    [p.mistralKey, () => askCompatible(MISTRAL, p.mistralKey!, request)],
    [p.nvidiaKey, () => askCompatible(NVIDIA, p.nvidiaKey!, request)],
    [p.openRouterKey, () => askOpenRouter(p.openRouterKey!, request)],
    [p.groqKey, () => askGroq(p.groqKey!, request, p.groqModel)],
    [p.ai, () => askWorkersAi(p.ai!, request)],
  ];
  const ready = chain.filter(([on]) => on);
  if (hasYoutube(request)) {
    if (!p.geminiKey) throw new AiError("L'analyse d'un lien YouTube demande la clé GEMINI_API_KEY dans les variables du site Art craft.");
    return askGemini(p.geminiKey, request);
  }
  if (!ready.length) throw new AiError("Aucune IA branchée : ajoute GEMINI_API_KEY dans les variables du site Art craft.");
  for (let k = 0; k < ready.length; k++) {
    try {
      return await ready[k][1]();
    } catch (err) {
      const isLast = k === ready.length - 1;
      // Gemini : seule une surcharge ou un quota passe la main ; les autres secours passent toujours la main.
      const pass = err instanceof AiError && (ready[k][0] !== p.geminiKey || err.retry);
      if (!pass || isLast) {
        if (isLast && errors.length && err instanceof AiError && !/Quota gratuit du jour/.test(err.message)) {
          err.message = [...errors.map((e) => e.message), err.message].join(" ; ");
        }
        throw err;
      }
      errors.push(err as AiError);
    }
  }
  throw new AiError("Aucune IA disponible");
}

// Diagnostic (/api/coach?test) : une question très courte à chaque IA gratuite, séparément,
// pour vérifier les clés sans lancer d'analyse. Ne montre jamais les clés.
export async function testFree({ geminiKey, mistralKey, nvidiaKey, openRouterKey, groqKey, groqModel, ai }: FreeProviders) {
  const request: FreeRequest = { system: "Réponds en un seul mot.", content: [{ type: "text", text: "Dis OK." }], live: true };
  const run = async (ready: unknown, ask: () => Promise<{ text: string; model: string }>) => {
    if (!ready) return "non branchée";
    const t = Date.now();
    try {
      const out = await ask();
      return `OK (${out.model}, ${Date.now() - t} ms) : ${out.text.trim().slice(0, 40)}`;
    } catch (err) {
      return `erreur : ${err instanceof Error ? err.message : String(err)}`;
    }
  };
  const [gemini, mistral, nvidia, openrouter, groq, workersAi] = await Promise.all([
    run(geminiKey, () => askGemini(geminiKey!, request)),
    run(mistralKey, () => askCompatible(MISTRAL, mistralKey!, request)),
    run(nvidiaKey, () => askCompatible(NVIDIA, nvidiaKey!, request)),
    run(openRouterKey, () => askOpenRouter(openRouterKey!, request)),
    run(groqKey, () => askGroq(groqKey!, request, groqModel)),
    run(ai, () => askWorkersAi(ai!, request)),
  ]);
  return { gemini, mistral, nvidia, openrouter, groq, workersAi };
}
