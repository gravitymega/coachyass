// Fonction Netlify du module « Analyse tactique » d'Art craft.
// Reçoit des images clés d'une séquence de match (extraites dans le navigateur),
// les fait analyser par Claude (vision) et renvoie l'analyse au fil de l'eau
// (flux NDJSON : {"d": "morceau de JSON"} … puis {"end": {...}} ou {"error": "..."}).
// La réponse est en flux pour rester sous la limite de 60 s des fonctions et
// montrer la progression ; le JSON final suit ANALYSIS_SCHEMA (sorties structurées).
//
// Variables Netlify (site art-craft-gravity) :
//   ANTHROPIC_API_KEY   — clé API Anthropic (console.anthropic.com), jamais exposée au navigateur
//   ART_CRAFT_PASSWORD  — même mot de passe que le Studio voix (chaque analyse coûte des crédits)
import Anthropic from "@anthropic-ai/sdk";
import crypto from "node:crypto";

const MODEL = "claude-opus-5-5";
const MAX_FRAMES = 40;
const MAX_FRAME_B64 = 400_000; // ~300 Ko par image JPEG

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    resume: { type: "string" },
    attaque: { type: "array", items: { type: "string" } },
    defense: { type: "array", items: { type: "string" } },
    transitions: { type: "array", items: { type: "string" } },
    systemes: {
      type: "array",
      items: {
        type: "object",
        properties: { nom: { type: "string" }, description: { type: "string" } },
        required: ["nom", "description"],
        additionalProperties: false,
      },
    },
    points_forts: { type: "array", items: { type: "string" } },
    points_faibles: { type: "array", items: { type: "string" } },
    conseils: { type: "array", items: { type: "string" } },
    moments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          t: { type: "number" },
          titre: { type: "string" },
          explication: { type: "string" },
        },
        required: ["t", "titre", "explication"],
        additionalProperties: false,
      },
    },
    commentaire: { type: "string" },
  },
  required: [
    "resume", "attaque", "defense", "transitions", "systemes",
    "points_forts", "points_faibles", "conseils", "moments", "commentaire",
  ],
  additionalProperties: false,
};

const SYSTEM = `Tu es un analyste vidéo et entraîneur de basketball expérimenté qui travaille pour Gravity Basketball (Montréal).
Tu reçois des images fixes tirées d'une séquence de match, dans l'ordre, chacune avec son instant (en secondes depuis le début de la vidéo).
Ton travail : expliquer le jeu et les tactiques à des joueurs et à leur coach, en français québécois clair et concret.

Ce que tu regardes : placement et espacement en attaque (spacing, coins, poste haut/bas), écrans et pick-and-roll, coupes, isolations, jeu au poste ;
défense (homme à homme ou zone, et laquelle : 2-3, 3-2, 1-3-1…), aide, rotations, pression sur le porteur, retour défensif ;
transitions et contre-attaques, rebonds, organisation après un temps mort ou une remise en jeu.

Règles :
- Ce sont des images, pas une vidéo continue : déduis le mouvement en comparant les images successives et dis « on dirait », « probablement » quand tu déduis.
- N'invente rien qu'on ne peut pas voir : pas de score, pas de noms de joueurs, pas de statistiques. Désigne les joueurs par leur position, leur numéro s'il est lisible ou leur couleur de maillot.
- Sois utile pour l'entraînement : chaque point faible doit pouvoir mener à un conseil ou à un exercice précis.
- « moments » : 3 à 8 moments clés. « t » est exactement l'instant d'une des images reçues. « titre » : 40 caractères maximum. « explication » : 140 caractères maximum (elle s'affiche à l'écran).
- « commentaire » : le texte de la voix off qui accompagne la vidéo, parlé, naturel, sans listes, sans émojis, sans hashtags, sans abréviations. Suis l'ordre chronologique et appuie-toi sur les moments clés.
- Listes : phrases courtes, une idée par élément, 2 à 6 éléments par liste (liste vide si rien n'est visible).`;

function samePassword(given: string, expected: string) {
  const a = Buffer.from(given || "");
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Frame = { t: number; data: string };

export default async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "Méthode non autorisée" });
  const password = Netlify.env.get("ART_CRAFT_PASSWORD");
  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!password) return json(500, { error: "ART_CRAFT_PASSWORD manquant dans les variables Netlify du site art-craft." });
  if (!samePassword(req.headers.get("x-art-password") || "", password)) return json(401, { error: "Mot de passe incorrect" });
  if (!apiKey) return json(500, { error: "ANTHROPIC_API_KEY manquant dans les variables Netlify du site art-craft." });

  let body: { frames?: Frame[]; team?: string; context?: string; start?: number; dur?: number; words?: number };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Requête illisible" });
  }
  const frames = Array.isArray(body.frames) ? body.frames : [];
  if (frames.length < 2 || frames.length > MAX_FRAMES) return json(400, { error: `Il faut entre 2 et ${MAX_FRAMES} images.` });
  if (frames.some((f) => !Number.isFinite(f.t) || typeof f.data !== "string" || f.data.length > MAX_FRAME_B64)) {
    return json(400, { error: "Image invalide ou trop lourde" });
  }
  const team = String(body.team || "").slice(0, 120);
  const context = String(body.context || "").slice(0, 1500);
  const words = Math.max(60, Math.min(450, Math.round(Number(body.words) || 200)));

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  frames.forEach((f) => {
    content.push({ type: "text", text: `Image à t = ${f.t.toFixed(1)} s` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } });
  });
  content.push({
    type: "text",
    text: [
      `Séquence : de ${Number(body.start || 0).toFixed(0)} s à ${(Number(body.start || 0) + Number(body.dur || 0)).toFixed(0)} s de la vidéo, ${frames.length} images.`,
      team ? `Équipe à analyser en priorité : ${team}.` : "Analyse les deux équipes.",
      context ? `Contexte donné par le coach : ${context}` : "",
      `Le « commentaire » doit faire environ ${words} mots.`,
      "Fais l'analyse tactique complète.",
    ].filter(Boolean).join("\n"),
  });

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();
  const line = (o: unknown) => encoder.encode(JSON.stringify(o) + "\n");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const run = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 12000,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low", format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
          system: SYSTEM,
          messages: [{ role: "user", content }],
        } as Anthropic.Beta.MessageCreateParamsStreaming);
        for await (const event of run) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(line({ d: event.delta.text }));
          }
        }
        const final = await run.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(line({ error: "L'IA a refusé d'analyser ces images." }));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(line({ error: "Analyse trop longue, coupée : réessaie avec une séquence plus courte." }));
        } else {
          controller.enqueue(line({ end: { model: final.model, output_tokens: final.usage.output_tokens } }));
        }
      } catch (err) {
        let msg = "Analyse impossible";
        if (err instanceof Anthropic.AuthenticationError) msg = "Clé ANTHROPIC_API_KEY refusée par Anthropic";
        else if (err instanceof Anthropic.RateLimitError) msg = "Trop de demandes : réessaie dans une minute";
        else if (err instanceof Anthropic.BadRequestError) msg = `Requête refusée par l'IA : ${err.message}`;
        else if (err instanceof Anthropic.APIError) msg = `Erreur de l'IA (${err.status}) : ${err.message}`;
        else if (err instanceof Error) msg = err.message;
        console.error("coach:", err);
        controller.enqueue(line({ error: msg }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
};
