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

const POS = ["PG", "SG", "SF", "PF", "C"];
const point = {
  type: "object",
  properties: { p: { type: "string", enum: POS }, x: { type: "number" }, y: { type: "number" } },
  required: ["p", "x", "y"],
  additionalProperties: false,
};
const strings = { type: "array", items: { type: "string" } };

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    resume: { type: "string" },
    attaque: strings,
    defense: strings,
    transitions: strings,
    systemes: {
      type: "array",
      items: {
        type: "object",
        properties: { nom: { type: "string" }, description: { type: "string" } },
        required: ["nom", "description"],
        additionalProperties: false,
      },
    },
    points_forts: strings,
    points_faibles: strings,
    conseils: strings,
    intro: { type: "string" },
    moments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          t: { type: "number" },
          debut: { type: "number" },
          fin: { type: "number" },
          titre: { type: "string" },
          explication: { type: "string" },
          narration: { type: "string" },
          ballon: { type: "string", enum: POS },
          joueurs: { type: "array", items: point },
          defenseurs: {
            type: "array",
            items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false },
          },
          trajets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                p: { type: "string", enum: POS },
                type: { type: "string", enum: ["coupe", "dribble", "ecran", "passe"] },
                x: { type: "number" },
                y: { type: "number" },
                vers: { type: "string", enum: [...POS, ""] },
              },
              required: ["p", "type", "x", "y", "vers"],
              additionalProperties: false,
            },
          },
        },
        required: ["t", "debut", "fin", "titre", "explication", "narration", "ballon", "joueurs", "defenseurs", "trajets"],
        additionalProperties: false,
      },
    },
    conclusion: { type: "string" },
  },
  required: [
    "resume", "attaque", "defense", "transitions", "systemes",
    "points_forts", "points_faibles", "conseils", "intro", "moments", "conclusion",
  ],
  additionalProperties: false,
};

const SYSTEM = `Tu es un entraîneur de basketball expert (niveau élite : 20 ans de coaching, analyse vidéo pour des équipes U15 à universitaires et professionnelles) qui travaille pour Gravity Basketball (Montréal).
Tu reçois des images fixes tirées d'une séquence de match, dans l'ordre, chacune avec son instant (en secondes depuis le début de la vidéo).
Ton travail : décortiquer le jeu comme un coach le ferait en séance vidéo avec ses joueurs, en français québécois clair, concret et précis, avec le vocabulaire du coaching (spacing, pick-and-roll, slip, pop, flare, back-door, aide côté faible, closeout, ice, hedge, switch, box-out…).

Ce que tu regardes : placement et espacement en attaque (coins, ailes, poste haut/bas), écrans et pick-and-roll, coupes, isolations, jeu au poste ;
défense (homme à homme ou zone, et laquelle : 2-3, 3-2, 1-3-1…), aide, rotations, pression sur le porteur, retour défensif ;
transitions et contre-attaques, rebonds, organisation après un temps mort ou une remise en jeu.

Le tableau du coach : chaque moment clé est dessiné sur une demi-terrain vue de dessus, panier en haut.
- Repère : x de 0 (ligne de côté à gauche) à 1 (ligne de côté à droite), vu depuis le milieu du terrain en regardant le panier ; y de 0 (ligne de fond, sous le panier) à 1 (ligne médiane).
- Points utiles : panier (0.5, 0.11) ; raquette de x 0.34 à 0.66 et de y 0 à 0.41 ; ligne des lancers francs y = 0.41 ; sommet de la ligne à 3 points (0.5, 0.59) ; ailes (0.15, 0.42) et (0.85, 0.42) ; coins (0.05, 0.08) et (0.95, 0.08) ; poste bas (0.3, 0.2) et (0.7, 0.2) ; coudes (0.36, 0.41) et (0.64, 0.41).
- « joueurs » : les 5 attaquants de l'équipe analysée (ou de l'équipe qui a le ballon), au DÉBUT de l'action, nommés par poste : PG (meneur), SG (arrière), SF (ailier), PF (ailier fort), C (pivot). Exactement 5, un par poste. « ballon » : qui a le ballon au début.
- « defenseurs » : les 5 défenseurs au début de l'action (liste vide si on ne les distingue pas).
- « trajets », dans l'ordre où ils se passent : « coupe » (course sans ballon), « dribble » (le porteur avance en dribblant), « ecran » (le joueur va poser un écran : x, y = l'endroit de l'écran), avec x, y = point d'arrivée et vers = "" ; « passe » : p = passeur, vers = receveur, x, y = position du receveur.
- Les positions se déduisent de ce que tu vois dans les images (perspective de la caméra comprise) : place-les au mieux, c'est un schéma de coach.

Règles :
- Ce sont des images, pas une vidéo continue : déduis le mouvement en comparant les images successives et dis « on dirait », « probablement » quand tu déduis.
- N'invente rien qu'on ne peut pas voir : pas de score, pas de noms de joueurs, pas de statistiques.
- « moments » : 3 à 6 moments clés, dans l'ordre. « t » = l'instant d'une des images reçues ; « debut » et « fin » = début et fin de l'action (entre 2 et 8 secondes, t compris dedans). « titre » : 40 caractères maximum. « explication » : 160 caractères maximum (elle s'affiche sur le tableau).
- « narration » : ce que tu dis pendant le ralenti de ce moment, 15 à 40 mots, parlé, au présent, en suivant l'ordre des trajets et en nommant les joueurs EXACTEMENT par leur poste (PG, SG, SF, PF, C) comme sur le tableau, pour que la voix et les pions bougent ensemble.
- « intro » : 15 à 35 mots, la situation avant la première action. « conclusion » : 20 à 50 mots, la leçon principale et ce qu'on travaille à l'entraînement.
- Narration, intro et conclusion : texte parlé naturel, sans listes, sans émojis, sans hashtags.
- Sois utile pour l'entraînement : chaque point faible doit mener à un conseil ou à un exercice précis.
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

  let body: { ping?: boolean; frames?: Frame[]; team?: string; context?: string; start?: number; dur?: number };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Requête illisible" });
  }
  // Vérification du mot de passe à la connexion (aucun appel à l'IA).
  if (body.ping) return json(200, { ok: true, ai: Boolean(apiKey) });
  if (!apiKey) return json(500, { error: "ANTHROPIC_API_KEY manquant dans les variables Netlify du site art-craft." });
  const frames = Array.isArray(body.frames) ? body.frames : [];
  if (frames.length < 2 || frames.length > MAX_FRAMES) return json(400, { error: `Il faut entre 2 et ${MAX_FRAMES} images.` });
  if (frames.some((f) => !Number.isFinite(f.t) || typeof f.data !== "string" || f.data.length > MAX_FRAME_B64)) {
    return json(400, { error: "Image invalide ou trop lourde" });
  }
  const team = String(body.team || "").slice(0, 120);
  const context = String(body.context || "").slice(0, 1500);

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
      "Fais l'analyse tactique complète, comme en séance vidéo avec l'équipe.",
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
          max_tokens: 16000,
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
