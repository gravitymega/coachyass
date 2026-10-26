// Fonction du module « Vidéo IA » d'Art craft (/api/video).
//   POST { ping: true }                       → { ok, open, gemini, hf } (aucun appel aux IA)
//   POST { action: "prompt", text, format }   → { prompt, titre, source } : Gemini traduit la
//        description française en prompt anglais au style Gravity (repli simple sans Gemini)
//   POST { action: "generate", prompt, … }    → flux NDJSON : {status} / {wait} … puis {done} ou {error}
//   GET  ?file=<adresse de la vidéo sur le Space> → relais de la vidéo (hôtes des Spaces seulement)
//
// Variables du site (Cloudflare, ou .dev.vars en local) :
//   HF_TOKEN            — facultatif : token Hugging Face gratuit de type « Read » (plus de quota ZeroGPU)
//   GEMINI_API_KEY      — facultative : clé gratuite Google Gemini (sinon le Space améliore lui-même le prompt)
//   ART_CRAFT_PASSWORD  — facultatif, comme pour /api/coach
import { askGemini, cleanJson } from "../lib/free-ai.ts";
import { ALLOWED_HOSTS, SpaceError, generateVideo, normalizeJob } from "../lib/hf-video.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// Comparaison en temps constant (même idée que dans coach.mts, sans node:crypto).
function samePassword(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const STYLE = "Gravity Basketball Montreal look: black and orange color palette, deep blacks with glowing orange accents, dramatic arena lighting, energetic and cinematic";

const PROMPT_SYSTEM = `Tu écris des prompts pour un modèle de génération vidéo (LTX-Video) pour Gravity Basketball, un club de basketball de Montréal.
On te donne une description de scène en français. Écris UN prompt en anglais, de 60 à 120 mots, en un seul paragraphe :
- le sujet et l'action précise, au présent, dans l'ordre où elle se passe (une seule scène continue de quelques secondes) ;
- le décor, puis le mouvement de caméra (ex. slow push-in, tracking shot, low angle) ;
- la lumière et l'ambiance au style de la marque : ${STYLE} ;
- réaliste et cinématographique, sauf si la description demande un autre style.
Pas de texte, de lettres, de logos ni de chiffres à l'écran (le modèle les dessine mal), pas de nom de personne réelle, rien de violent ni de sexuel.
Le format est {FORMAT}. Donne aussi un titre court en français (3 à 6 mots) pour le nom du fichier.`;

const PROMPT_SCHEMA = {
  type: "object",
  properties: { prompt: { type: "string" }, titre: { type: "string" } },
  required: ["prompt", "titre"],
  additionalProperties: false,
};

// Sans Gemini : la description telle quelle + le style Gravity ; le Space l'améliore ensuite lui-même.
const simplePrompt = (text: string) => `${text.trim().replace(/[.\s]+$/, "")}. Basketball scene, ${STYLE}, realistic, smooth camera motion, high detail.`;

async function relayFile(url: URL, token?: string) {
  const raw = url.searchParams.get("file") || "";
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return json(400, { error: "Adresse de vidéo invalide" });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.host) || !target.pathname.includes("/file=")) {
    return json(400, { error: "Adresse de vidéo refusée" });
  }
  const res = await fetch(target, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok || !res.body) return json(502, { error: `La vidéo n'est plus disponible sur le Space (${res.status}) : relance la génération.` });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "video/mp4",
      ...(res.headers.get("content-length") ? { "Content-Length": res.headers.get("content-length") as string } : {}),
      "Cache-Control": "no-store",
    },
  });
}

export async function handleVideo(req: Request, env: (name: string) => string | undefined) {
  const token = env("HF_TOKEN") || undefined;
  const url = new URL(req.url);
  if (req.method === "GET" && url.searchParams.has("file")) return relayFile(url, token);
  if (req.method !== "POST") return json(405, { error: "Méthode non autorisée" });

  const password = env("ART_CRAFT_PASSWORD");
  if (password && !samePassword(req.headers.get("x-art-password") || "", password)) return json(401, { error: "Mot de passe incorrect" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Requête illisible" });
  }
  const geminiKey = env("GEMINI_API_KEY");
  if (body.ping) return json(200, { ok: true, open: !password, gemini: Boolean(geminiKey), hf: Boolean(token) });

  if (body.action === "prompt") {
    const text = String(body.text ?? "").trim().slice(0, 1500);
    if (text.length < 3) return json(400, { error: "Décris la scène en quelques mots." });
    if (!geminiKey) return json(200, { prompt: simplePrompt(text), titre: text.slice(0, 40), source: "simple" });
    const format = body.format === "16:9" ? "horizontal 16:9" : "vertical 9:16 (pour Instagram et TikTok : sujet centré)";
    try {
      const out = await askGemini(geminiKey, {
        system: PROMPT_SYSTEM.replace("{FORMAT}", format),
        content: [{ type: "text", text: `Description de la scène : ${text}` }],
        schema: PROMPT_SCHEMA,
      });
      const parsed = JSON.parse(cleanJson(out.text));
      if (!parsed?.prompt) throw new Error("réponse vide");
      return json(200, { prompt: String(parsed.prompt), titre: String(parsed.titre || ""), source: "gemini" });
    } catch (err) {
      // Gemini indisponible : on continue quand même, le Space améliorera le prompt.
      console.error("video (prompt):", err);
      return json(200, { prompt: simplePrompt(text), titre: text.slice(0, 40), source: "simple", warning: `Gemini n'a pas répondu (${err instanceof Error ? err.message : err}) : prompt simple utilisé.` });
    }
  }

  if (body.action !== "generate") return json(400, { error: "Action inconnue" });
  const job = normalizeJob(body);
  if ("error" in job) return json(400, { error: job.error });

  const encoder = new TextEncoder();
  const line = (o: unknown) => encoder.encode(JSON.stringify(o) + "\n");
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => { try { controller.enqueue(line(o)); } catch { /* flux déjà fermé */ } };
      send({ wait: true, hf: Boolean(token) });
      // Signe de vie toutes les 10 s : la file d'attente ZeroGPU peut durer plusieurs minutes,
      // et Safari coupe une connexion restée muette 60 s.
      const alive = setInterval(() => send({ wait: true }), 10_000);
      try {
        const out = await generateVideo(job, token, (status) => send({ status }));
        send({ done: { ...out, video: `/api/video?file=${encodeURIComponent(out.url)}` } });
      } catch (err) {
        console.error("video (generate):", err);
        send({ error: err instanceof Error ? err.message : "Génération impossible", kind: err instanceof SpaceError ? err.kind : "other" });
      } finally {
        clearInterval(alive);
        try { controller.close(); } catch { /* déjà fermé */ }
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

export default (req: Request) => handleVideo(req, (name) => Netlify.env.get(name));
