// Fonction Netlify du module « Analyse tactique » d'Art craft.
// Reçoit des images clés d'une séquence de match (extraites dans le navigateur),
// les fait analyser par Claude (vision) et renvoie l'analyse au fil de l'eau
// (flux NDJSON : {"d": "morceau de JSON"} … puis {"end": {...}} ou {"error": "..."}).
// La réponse est en flux pour rester sous la limite de 60 s des fonctions et
// montrer la progression ; le JSON final suit ANALYSIS_SCHEMA (sorties structurées).
//
// Variables du site (Netlify ou Cloudflare) :
//   ART_CRAFT_PASSWORD  — facultatif : sans lui, l'accès aux IA gratuites est libre (choix de l'utilisateur) ;
//                         Claude (payant) n'est jamais utilisé sans mot de passe
//   GEMINI_API_KEY      — clé gratuite Google Gemini (aistudio.google.com), jamais exposée au navigateur
//   ANTHROPIC_API_KEY   — facultative et PAYANTE (Claude) : à ne mettre que si l'utilisateur l'accepte.
// Sans clé Anthropic, les IA gratuites de ../lib/free-ai.ts répondent : Gemini, puis Cloudflare Workers AI
// en secours (liaison « AI » du Worker) si le quota gratuit de Gemini est épuisé.
//
// Modes (champ « mode ») : analyse tactique (défaut), « track » (suivi image par image),
// « stats » (actions et numéros d'une portion de match), « devoirs » (exercices d'un joueur,
// sans image), « live » (une phrase du commentateur en direct, Claude Haiku) et « photo »
// (Retouche photo : réglages proposés, légendes, fonds SVG ; la consigne vient de la page).
import Anthropic from "@anthropic-ai/sdk";
import { askFree, cleanJson, AiError, type FreeRequest, type WorkersAi } from "../lib/free-ai.ts";

// Lien d'une vidéo YouTube publique (watch, youtu.be, shorts, live) → adresse « watch » normalisée.
export function youtubeUrl(raw: unknown) {
  const m = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#/].*)?$/.exec(String(raw ?? "").trim());
  return m ? `https://www.youtube.com/watch?v=${m[1]}` : null;
}

const MODEL = "claude-opus-5-5";
// Commentaire en direct : réponse rapide et peu chère (une phrase toutes les 10 à 20 s).
const LIVE_MODEL = "claude-haiku-5-5";
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

// Suivi image par image d'une action (2e passe) : positions réelles des joueurs à chaque instant.
const TRACK_SCHEMA = {
  type: "object",
  properties: {
    images: {
      type: "array",
      items: {
        type: "object",
        properties: {
          t: { type: "number" },
          ballon: { type: "string", enum: [...POS, ""] },
          joueurs: { type: "array", items: point },
          defenseurs: {
            type: "array",
            items: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"], additionalProperties: false },
          },
        },
        required: ["t", "ballon", "joueurs", "defenseurs"],
        additionalProperties: false,
      },
    },
  },
  required: ["images"],
  additionalProperties: false,
};

const TRACK_TASK = `Suivi image par image : pour CHAQUE image reçue (même instant « t »), place les joueurs sur le tableau du coach, exactement comme ils sont à cet instant précis dans la vidéo.
- Le point d'un joueur = ses pieds au sol, reporté sur le demi-terrain vu de dessus (corrige la perspective de la caméra : sers-toi des lignes du terrain, de la raquette, de la ligne à 3 points et du panier comme repères ; si la caméra bouge, recale-toi sur ces lignes à chaque image).
- Garde les MÊMES postes (PG, SG, SF, PF, C) pour les mêmes joueurs d'une image à l'autre : suis chaque joueur (numéro, couleur, taille), ne les échange jamais.
- « ballon » : qui a le ballon sur cette image ("" s'il est en l'air : passe, tir, ballon perdu).
- « defenseurs » : les défenseurs visibles, à leur position réelle.
- Un joueur hors champ : garde sa dernière position connue (ou la plus logique).
- Ne lisse pas et n'invente pas de trajectoire : rapporte ce que tu vois, image par image.`;

// Stats automatiques (module « Stats auto ») : actions de jeu vues dans une fenêtre de la vidéo.
const EVENT_TYPES = [
  "panier_2", "panier_3", "lf_reussi", "tir_rate_2", "tir_rate_3", "lf_rate",
  "rebond_off", "rebond_def", "passe_decisive", "interception", "contre", "perte", "faute",
];
const STATS_SCHEMA = {
  type: "object",
  properties: {
    evenements: {
      type: "array",
      items: {
        type: "object",
        properties: {
          t: { type: "number" },
          type: { type: "string", enum: EVENT_TYPES },
          equipe: { type: "string", enum: ["nous", "adversaire"] },
          numero: { type: "integer" },
          confiance: { type: "string", enum: ["haute", "moyenne", "basse"] },
          detail: { type: "string" },
        },
        required: ["t", "type", "equipe", "numero", "confiance", "detail"],
        additionalProperties: false,
      },
    },
  },
  required: ["evenements"],
  additionalProperties: false,
};

const STATS_SYSTEM = `Tu es un statisticien de basketball (feuille de match FIBA) qui travaille pour Gravity Basketball (Montréal).
Tu reçois, dans l'ordre, des images d'une courte portion de match (chacune avec son instant en secondes), puis des vignettes agrandies des joueurs détectés automatiquement (pour lire les numéros sur les maillots), avec la couleur moyenne de leur maillot.
Ton travail : noter chaque action de jeu que tu VOIS dans cette portion, comme sur une feuille de stats.

Types d'actions :
- panier_2, panier_3 (le ballon entre dans le panier : 3 pts si le tireur est derrière la ligne à 3 points), lf_reussi (lancer franc réussi) ;
- tir_rate_2, tir_rate_3, lf_rate (tir raté) ;
- rebond_off (l'équipe qui a tiré récupère), rebond_def (l'autre équipe récupère) ;
- passe_decisive (la passe juste avant un panier), interception, contre, perte (perte de balle : marcher, sortie, mauvaise passe…), faute.

Règles :
- « equipe » : « nous » = l'équipe suivie (décrite dans la demande), « adversaire » = l'autre équipe.
- « numero » : le numéro sur le maillot du joueur qui fait l'action ; -1 si tu ne peux pas le lire avec une certitude raisonnable. N'invente JAMAIS un numéro : mieux vaut -1 qu'un faux numéro. Les numéros de l'effectif connu sont donnés quand on les a.
- « t » : l'instant de l'action (le tir, la passe, le rebond), en secondes, d'après les images.
- « confiance » : haute (on voit clairement l'action et le numéro), moyenne, basse (déduit).
- « detail » : 100 caractères maximum, ex. « tir en suspension à mi-distance, côté gauche ».
- Un panier se voit au ballon dans le filet, à la réaction des joueurs (repli en défense, remise en jeu depuis la ligne de fond) ou au tableau d'affichage s'il est visible. Si tu n'es pas sûr qu'un tir est rentré, note un tir raté avec confiance basse plutôt qu'un panier.
- Ce sont des images fixes : déduis l'action en comparant les images, et ne note rien qui ne se voit pas. Une portion sans action claire = liste vide.
- Ne note pas deux fois la même action.`;

// Devoirs et exercices personnalisés (après un match), d'après les stats du joueur.
const DEVOIRS_SCHEMA = {
  type: "object",
  properties: {
    points_forts: strings,
    points_faibles: strings,
    message: { type: "string" },
    devoirs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titre: { type: "string" },
          categorie: { type: "string", enum: ["tir", "dribble", "passe", "defense", "rebond", "physique", "video", "mental"] },
          description: { type: "string" },
          repetitions: { type: "string" },
          duree_min: { type: "integer" },
        },
        required: ["titre", "categorie", "description", "repetitions", "duree_min"],
        additionalProperties: false,
      },
    },
  },
  required: ["points_forts", "points_faibles", "message", "devoirs"],
  additionalProperties: false,
};

const DEVOIRS_SYSTEM = `Tu es l'entraîneur de développement individuel de Gravity Basketball (Montréal) : tu prépares, après chaque match, les devoirs d'un joueur, en français québécois, en le tutoyant.
Tu reçois sa fiche (poste, catégorie d'âge), ses stats du match, la liste de ses actions et ses matchs précédents.
- « points_forts » et « points_faibles » : 1 à 4 éléments chacun, courts, appuyés sur les chiffres (ex. « 1 sur 6 à 3 points »). Avec peu de données, dis-le plutôt que d'inventer.
- « devoirs » : 3 à 5 exercices concrets à faire avant le prochain entraînement, adaptés à son âge et à son poste, qui travaillent d'abord ses points faibles ; au moins un devoir « video » (revoir ses clips dans l'Espace Joueurs avec une consigne précise). « repetitions » ex. « 5 séries de 10 tirs », « duree_min » réaliste (5 à 30).
- « message » : 2 phrases d'encouragement, positives et honnêtes, sans émojis.
- Jamais de jugement sur la personne : on parle du jeu.`;

// Commentateur en direct (Mode direct) : une phrase courte à dire maintenant.
const LIVE_SCHEMA = {
  type: "object",
  properties: { phrase: { type: "string" } },
  required: ["phrase"],
  additionalProperties: false,
};

const LIVE_SYSTEM = `Tu es le commentateur en direct des matchs de Gravity Basketball (Montréal), en français québécois, avec l'énergie d'un commentateur de télé.
Tu reçois le score, le temps, les dernières actions notées par le coach et parfois une image de la caméra.
Réponds par UNE phrase à dire tout de suite au micro : 6 à 22 mots, naturelle à l'oral, sans émojis ni hashtags, sans répéter les phrases précédentes.
Appuie-toi sur les faits reçus (numéros, score, actions) ; sur l'image, décris seulement ce qui se voit. Pas de noms de joueurs inventés : dis « le numéro 12 ».
Reste positif et respectueux envers les deux équipes et les arbitres : ce sont souvent des jeunes joueurs.`;

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

// Comparaison en temps constant, sans module Node (marche aussi sur Cloudflare).
function samePassword(given: string, expected: string) {
  const a = new TextEncoder().encode(given || "");
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

const PHOTO_SYSTEM = `Tu es l'assistant photo d'Art craft, l'outil de création de Gravity Basketball Montréal (club de basketball).
Tu aides à retoucher des photos de sport, à écrire des légendes de publication et à dessiner des fonds d'affiche.
Suis exactement le format de réponse demandé. Tu écris en français, en tutoyant.`;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Frame = { t: number; data: string; label?: string };

type Body = {
  ping?: boolean; mode?: string; frames?: Frame[]; crops?: Frame[]; team?: string; context?: string;
  start?: number; dur?: number; moment?: Record<string, unknown>; roster?: unknown; player?: unknown;
  facts?: unknown; prompt?: string; json?: boolean; youtube?: string;
};

const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);
const validImages = (list: Frame[]) =>
  list.every((f) => Number.isFinite(f.t) && typeof f.data === "string" && f.data.length <= MAX_FRAME_B64);

function imageBlocks(frames: Frame[], label = (f: Frame) => `Image à t = ${f.t.toFixed(2)} s`) {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  frames.forEach((f) => {
    content.push({ type: "text", text: label(f) });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } });
  });
  return content;
}

// Ce que demande chaque mode : consigne, schéma de sortie, contenu du message, modèle.
function buildRequest(body: Body) {
  const mode = body.mode || "analyse";
  const frames = Array.isArray(body.frames) ? body.frames : [];
  const team = clip(body.team, 120);
  const context = clip(body.context, 1500);

  if (mode === "devoirs") {
    return {
      model: MODEL, system: DEVOIRS_SYSTEM, schema: DEVOIRS_SCHEMA, maxTokens: 4000, minFrames: 0,
      content: [{ type: "text", text: `Joueur et match (JSON) :\n${clip(JSON.stringify(body.player ?? {}), 12000)}\nPrépare ses devoirs.` }] as Anthropic.Beta.BetaContentBlockParam[],
    };
  }
  if (mode === "live") {
    return {
      model: LIVE_MODEL, system: LIVE_SYSTEM, schema: LIVE_SCHEMA, maxTokens: 600, minFrames: 0, maxFrames: 3, live: true,
      content: [
        ...imageBlocks(frames, () => "Image de la caméra, maintenant"),
        { type: "text", text: `Situation (JSON) :\n${clip(JSON.stringify(body.facts ?? {}), 4000)}` },
      ] as Anthropic.Beta.BetaContentBlockParam[],
    };
  }
  if (mode === "photo") {
    // Une photo au plus ; la réponse est du texte libre (JSON ou SVG selon la demande).
    const prompt = clip(body.prompt, 8000);
    if (!prompt.trim()) return { error: "Demande vide" };
    return {
      model: MODEL, system: PHOTO_SYSTEM, maxTokens: 16000, minFrames: 0, maxFrames: 1,
      content: [
        ...imageBlocks(frames, () => "Photo (aperçu actuel)"),
        { type: "text", text: prompt + (body.json ? "\nRéponds uniquement avec le JSON demandé, sans bloc de code." : "") },
      ] as Anthropic.Beta.BetaContentBlockParam[],
    };
  }
  if (mode === "stats") {
    const crops = Array.isArray(body.crops) ? body.crops.slice(0, 12) : [];
    if (!validImages(crops)) return { error: "Vignette invalide ou trop lourde" };
    return {
      model: MODEL, system: STATS_SYSTEM, schema: STATS_SCHEMA, maxTokens: 6000, minFrames: 2,
      content: [
        ...imageBlocks(frames),
        ...imageBlocks(crops, (f) => `Vignette ${clip(f.label, 160)} (image à t = ${f.t.toFixed(2)} s)`),
        {
          type: "text",
          text: [
            `Portion de match : de ${Number(body.start || 0).toFixed(1)} s à ${(Number(body.start || 0) + Number(body.dur || 0)).toFixed(1)} s.`,
            team ? `Équipe suivie (« nous ») : ${team}.` : "Équipe suivie (« nous ») : celle qui est décrite par le coach ; sinon, l'équipe en maillots foncés.",
            body.roster ? `Numéros de l'effectif de l'équipe suivie : ${clip(JSON.stringify(body.roster), 600)}.` : "",
            context ? `Précisions du coach : ${context}` : "",
            "Note toutes les actions de jeu visibles dans cette portion.",
          ].filter(Boolean).join("\n"),
        },
      ] as Anthropic.Beta.BetaContentBlockParam[],
    };
  }

  const track = mode === "track";
  const content = imageBlocks(frames);
  if (track) {
    // Le moment repéré à la 1re passe : postes déjà attribués, pour garder les mêmes noms que la narration.
    const m = body.moment && typeof body.moment === "object" ? body.moment : {};
    content.push({
      type: "text",
      text: [
        TRACK_TASK,
        team ? `Équipe en attaque à suivre : ${team}.` : "",
        `Action : ${clip(m.titre, 120)} — ${clip(m.explication, 300)}`,
        m.narration ? `Ce que dit le coach : ${clip(m.narration, 600)}` : "",
        m.joueurs ? `Postes attribués au début de l'action (garde ces noms) : ${clip(JSON.stringify(m.joueurs), 600)} ; ballon : ${clip(m.ballon, 4)}.` : "",
        `${frames.length} images, à rendre dans le même ordre avec le même « t ».`,
      ].filter(Boolean).join("\n"),
    });
  } else {
    const yt = youtubeUrl(body.youtube);
    const start = Math.max(0, Number(body.start) || 0);
    const end = start + Math.min(600, Math.max(10, Number(body.dur) || 60));
    // Lien YouTube : la vidéo elle-même (pas d'images), regardée par Gemini de start à end.
    if (yt) content.unshift({ type: "youtube", url: yt, start, end } as unknown as Anthropic.Beta.BetaContentBlockParam);
    content.push({
      type: "text",
      text: [
        yt
          ? `Séquence : la vidéo YouTube ci-dessus, de ${start.toFixed(0)} s à ${end.toFixed(0)} s. Donne tous les instants (t, debut, fin) en secondes depuis le début de la vidéo YouTube entière, entre ${start.toFixed(0)} et ${end.toFixed(0)}.`
          : `Séquence : de ${Number(body.start || 0).toFixed(0)} s à ${(Number(body.start || 0) + Number(body.dur || 0)).toFixed(0)} s de la vidéo, ${frames.length} images.`,
        team ? `Équipe à analyser en priorité : ${team}.` : "Analyse les deux équipes.",
        context ? `Contexte donné par le coach : ${context}` : "",
        "Fais l'analyse tactique complète, comme en séance vidéo avec l'équipe.",
      ].filter(Boolean).join("\n"),
    });
  }
  return { model: MODEL, system: SYSTEM, schema: track ? TRACK_SCHEMA : ANALYSIS_SCHEMA, maxTokens: 16000, minFrames: !track && youtubeUrl(body.youtube) ? 0 : 2, content };
}

// Cœur de la fonction, commun à Netlify (ci-dessous) et à Cloudflare Pages (functions/api/coach.ts).
// env(nom) lit une variable d'environnement de l'hébergeur.
// ai : liaison Workers AI (Cloudflare Workers seulement), IA gratuite de secours.
export async function handleCoach(req: Request, env: (name: string) => string | undefined, ai?: WorkersAi) {
  if (req.method !== "POST") return json(405, { error: "Méthode non autorisée" });
  const password = env("ART_CRAFT_PASSWORD");
  // Sans mot de passe, l'accès est libre mais limité aux IA gratuites : une clé Claude (payante)
  // ne sert que derrière un mot de passe, pour que personne ne puisse la faire payer.
  const apiKey = password ? env("ANTHROPIC_API_KEY") : undefined;
  if (password && !samePassword(req.headers.get("x-art-password") || "", password)) return json(401, { error: "Mot de passe incorrect" });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Requête illisible" });
  }
  // Vérification du mot de passe à la connexion (aucun appel à l'IA).
  const geminiKey = env("GEMINI_API_KEY");
  if (body.ping) {
    return json(200, { ok: true, open: !password, ai: Boolean(apiKey || geminiKey || ai), provider: apiKey ? "claude" : geminiKey ? "gemini" : ai ? "workers-ai" : null });
  }
  if (!apiKey && !geminiKey && !ai) {
    return json(500, { error: "Aucune IA branchée : ajoute GEMINI_API_KEY (clé gratuite, aistudio.google.com) dans les variables du site Art craft." });
  }

  const request = buildRequest(body);
  if ("error" in request) return json(400, { error: request.error });
  const frames = Array.isArray(body.frames) ? body.frames : [];
  const maxFrames = request.maxFrames ?? MAX_FRAMES;
  if (frames.length < request.minFrames || frames.length > maxFrames) {
    return json(400, { error: `Il faut entre ${request.minFrames} et ${maxFrames} images.` });
  }
  if (!validImages(frames)) return json(400, { error: "Image invalide ou trop lourde" });

  const encoder = new TextEncoder();
  const line = (o: unknown) => encoder.encode(JSON.stringify(o) + "\n");
  // Un lien YouTube ne peut être regardé que par Gemini (Claude et Workers AI ne lisent pas YouTube).
  if (!apiKey || youtubeUrl(body.youtube)) return freeResponse(request as unknown as FreeRequest, { geminiKey, ai }, line);

  const client = new Anthropic({ apiKey });

  const params: Record<string, unknown> = {
    model: request.model,
    max_tokens: request.maxTokens,
    output_config: request.schema ? { effort: "low", format: { type: "json_schema", schema: request.schema } } : { effort: "low" },
    system: request.system,
    messages: [{ role: "user", content: request.content }],
  };
  if (request.live) {
    // Une phrase à dire tout de suite : pas de réflexion (Haiku n'a pas de modèle de repli).
    params.thinking = { type: "disabled" };
  } else {
    params.betas = ["server-side-fallback-2026-07-01"];
    params.fallbacks = "default";
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const run = client.beta.messages.stream(params as unknown as Anthropic.Beta.MessageCreateParamsStreaming);
        for await (const event of run) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(line({ d: event.delta.text }));
          }
        }
        const final = await run.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(line({ error: "L'IA a refusé d'analyser ces images." }));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(line({ error: "Réponse trop longue, coupée : réessaie avec une séquence plus courte." }));
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

// IA gratuites (Gemini, puis Workers AI) : même flux NDJSON que Claude, en un seul morceau.
function freeResponse(
  request: FreeRequest,
  providers: { geminiKey?: string; ai?: WorkersAi },
  line: (o: unknown) => Uint8Array,
) {
  const stream = new ReadableStream({
    async start(controller) {
      // Un premier message tout de suite, pour que le navigateur voie que la demande est partie.
      controller.enqueue(line({ wait: true }));
      try {
        const out = await askFree(providers, request);
        let text = out.text;
        if (request.schema) {
          text = cleanJson(text);
          try {
            JSON.parse(text);
          } catch {
            throw new AiError("Réponse illisible de l'IA : réessaie.");
          }
        }
        controller.enqueue(line({ d: text }));
        controller.enqueue(line({ end: { model: out.model } }));
      } catch (err) {
        console.error("coach (IA gratuite):", err);
        controller.enqueue(line({ error: err instanceof Error ? err.message : "Analyse impossible" }));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}

export default (req: Request) => handleCoach(req, (name) => Netlify.env.get(name));
