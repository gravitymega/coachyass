// Vidéo IA d'Art craft : courte vidéo générée à partir d'un texte par un Space Hugging Face
// gratuit (ZeroGPU), appelé depuis le serveur par l'API HTTP de Gradio
// (POST /gradio_api/call/<api> → event_id, puis GET du flux SSE jusqu'à « complete » ou « error »).
// Règle « aucun frais » : seuls le quota gratuit ZeroGPU et un token HF_TOKEN gratuit en lecture
// seule servent. Sans token, le Space est appelé sans compte (quota plus petit).
// Module sans dépendance (Node, Netlify, Cloudflare) ; la partie pure est testée avec Node.

export type Format = "16:9" | "9:16";
export type Quality = "rapide" | "hd";
export type Job = { prompt: string; format: Format; quality: Quality; duration: number; enhance: boolean };

type SpaceDef = {
  id: string;
  label: string;
  host: string;
  api: string;
  // Largeur × hauteur en 16:9 (inversées en 9:16), sur la grille demandée par le Space.
  dims: Record<Quality, [number, number]>;
  maxDuration: number;
  args: (job: Job, width: number, height: number) => unknown[];
};

const NEGATIVE = "worst quality, inconsistent motion, blurry, jittery, distorted, text, watermark, logo";

// Vérifiés le 24 octobre 2026 (page /gradio_api/info de chaque Space) :
//  1. LTX-2.5 officiel de Lightricks, mis à jour le 11 octobre 2026 : vidéo avec son, 1 à 5 s ;
//  2. en secours, LTX-Video 0.9.8 distillé (le Space vidéo le plus utilisé de Lightricks) : plus
//     ancien, sans son, mais plus léger, donc il passe parfois quand il reste peu de quota.
export const SPACES: SpaceDef[] = [
  {
    id: "Lightricks/LTX-2.5",
    label: "LTX-2.5 (Lightricks)",
    host: "https://lightricks-ltx-2-5.hf.space",
    api: "run",
    dims: { rapide: [1024, 576], hd: [1472, 832] },
    maxDuration: 5,
    // prompt, image (aucune → texte-vers-vidéo), hauteur, largeur, durée, graine, décodeur,
    // durée auto, graine au hasard, amélioration du prompt par le Space (Gemma).
    args: (j, w, h) => [j.prompt, null, h, w, j.duration, 42, "conv", false, true, j.enhance],
  },
  {
    id: "Lightricks/ltx-video-distilled",
    label: "LTX-Video 0.9.8 (Lightricks)",
    host: "https://lightricks-ltx-video-distilled.hf.space",
    api: "text_to_video",
    dims: { rapide: [832, 480], hd: [1248, 704] },
    maxDuration: 5,
    // prompt, prompt négatif, image, vidéo, hauteur, largeur, tâche, durée, images de la vidéo
    // d'entrée, graine, graine au hasard, guidance, texture améliorée.
    args: (j, w, h) => [j.prompt, NEGATIVE, null, null, h, w, "text-to-video", j.duration, 9, 42, true, 1, true],
  },
];

export const ALLOWED_HOSTS = new Set(SPACES.map((s) => new URL(s.host).host));

export function dimsFor(space: SpaceDef, format: Format, quality: Quality) {
  const [w, h] = space.dims[quality] ?? space.dims.rapide;
  return format === "9:16" ? { width: h, height: w } : { width: w, height: h };
}

// Demande du navigateur → travail vérifié (valeurs bornées).
export function normalizeJob(body: Record<string, unknown>): Job | { error: string } {
  const prompt = String(body.prompt ?? "").trim().slice(0, 2000);
  if (prompt.length < 5) return { error: "Décris la scène en quelques mots." };
  const format: Format = body.format === "16:9" ? "16:9" : "9:16";
  const quality: Quality = body.quality === "hd" ? "hd" : "rapide";
  const d = Number(body.duration);
  const duration = Number.isFinite(d) ? Math.min(5, Math.max(1, Math.round(d))) : 3;
  return { prompt, format, quality, duration, enhance: Boolean(body.enhance) };
}

// Lit un flux SSE (texte) : renvoie les événements complets et le reste à compléter.
export function parseSse(buffer: string) {
  const events: { event: string; data: string }[] = [];
  const blocks = buffer.replace(/\r\n/g, "\n").split("\n\n");
  const rest = blocks.pop() ?? "";
  for (const block of blocks) {
    let event = "message";
    const data: string[] = [];
    for (const l of block.split("\n")) {
      if (l.startsWith("event:")) event = l.slice(6).trim();
      else if (l.startsWith("data:")) data.push(l.slice(5).replace(/^ /, ""));
    }
    if (data.length || event !== "message") events.push({ event, data: data.join("\n") });
  }
  return { events, rest };
}

// Adresse de la vidéo dans la réponse « complete » (FileData ou VideoData { video: FileData }).
export function videoUrl(output: unknown, host: string): string | null {
  const first = Array.isArray(output) ? output[0] : output;
  const file = first && typeof first === "object" && "video" in first ? (first as { video: unknown }).video : first;
  if (!file || typeof file !== "object") return typeof file === "string" && /^https?:/.test(file) ? file : null;
  const f = file as { url?: string; path?: string };
  if (f.url) return f.url;
  if (f.path) return `${host}/gradio_api/file=${f.path}`;
  return null;
}

export type FailKind = "quota" | "auth" | "sleep" | "busy" | "other";

// Message d'erreur du Space (ou statut HTTP) → explication en français simple.
export function explain(raw: string, status: number, label: string, hasToken: boolean) {
  const msg = String(raw || "");
  const left = /vs\.?\s*(\d+)\s*s\s*left/i.exec(msg);
  if (/quota|exceeded your|GPU task aborted/i.test(msg)) {
    const more = hasToken
      ? "Avec un compte gratuit, Hugging Face donne environ 5 minutes de calcul par jour."
      : "Sans token, Hugging Face ne donne que 2 minutes de calcul par jour (souvent partagées) : ajoute un HF_TOKEN gratuit pour en avoir 5.";
    return {
      kind: "quota" as FailKind,
      // S'il reste encore quelques secondes, le Space de secours (plus léger) peut passer.
      leftSeconds: left ? Number(left[1]) : 0,
      message: `Quota gratuit de Hugging Face épuisé pour aujourd'hui. ${more} Il revient 24 h après ta première vidéo de la journée.`,
    };
  }
  if (status === 401 || status === 403 || /invalid (user )?token|unauthorized|authenticat/i.test(msg)) {
    return { kind: "auth" as FailKind, leftSeconds: 0, message: "HF_TOKEN refusé par Hugging Face : vérifie qu'il est bien de type « Read », puis recopie-le dans .dev.vars (ou dans les secrets Cloudflare)." };
  }
  if (status === 502 || status === 503 || status === 504 || /sleep|starting|building|paused|not running/i.test(msg)) {
    return { kind: "sleep" as FailKind, leftSeconds: 0, message: `Le Space ${label} est en veille ou en train de démarrer : réessaie dans 1 à 2 minutes.` };
  }
  if (status === 429 || /queue is full|too many/i.test(msg)) {
    return { kind: "busy" as FailKind, leftSeconds: 0, message: `Le Space ${label} est surchargé (trop de monde en file d'attente) : réessaie dans quelques minutes.` };
  }
  return { kind: "other" as FailKind, leftSeconds: 0, message: `Le Space ${label} n'a pas pu créer la vidéo${msg ? ` : ${msg.slice(0, 300)}` : "."}` };
}

export class SpaceError extends Error {
  kind: FailKind;
  leftSeconds: number;
  constructor(info: { kind: FailKind; leftSeconds: number; message: string }) {
    super(info.message);
    this.kind = info.kind;
    this.leftSeconds = info.leftSeconds;
  }
}

// ---------- Réseau ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const authHeaders = (token?: string): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

// État du Space d'après l'API du Hub (RUNNING, SLEEPING, PAUSED, BUILDING, RUNTIME_ERROR…).
async function spaceStage(space: SpaceDef, token?: string) {
  try {
    const res = await fetch(`https://huggingface.co/api/spaces/${space.id}`, { headers: authHeaders(token) });
    if (!res.ok) return res.status === 404 ? "GONE" : "UNKNOWN";
    const data: any = await res.json();
    return String(data?.runtime?.stage || "UNKNOWN");
  } catch {
    return "UNKNOWN";
  }
}

const WAKE_TRIES = 8; // ~3 min pour un Space qui se réveille
const MAX_WAIT_MS = 9 * 60_000;

async function runOnSpace(space: SpaceDef, job: Job, token: string | undefined, say: (status: string) => void) {
  const { width, height } = dimsFor(space, job.format, job.quality);
  const job2 = { ...job, duration: Math.min(job.duration, space.maxDuration) };
  const stage = await spaceStage(space, token);
  if (stage === "GONE") throw new SpaceError({ kind: "other", leftSeconds: 0, message: `Le Space ${space.label} n'existe plus.` });
  if (/PAUSED|ERROR|DISABLED/.test(stage)) throw new SpaceError({ kind: "sleep", leftSeconds: 0, message: `Le Space ${space.label} est arrêté par son auteur (${stage}).` });
  if (/SLEEPING|BUILDING|STARTING/.test(stage)) say(`Le Space ${space.label} se réveille (jusqu'à 2 ou 3 minutes)…`);

  // Envoi de la demande (réessayé tant que le Space se réveille : 502/503).
  let eventId = "";
  for (let i = 0; ; i++) {
    let res: Response;
    try {
      res = await fetch(`${space.host}/gradio_api/call/${space.api}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify({ data: space.args(job2, width, height) }),
      });
    } catch (err) {
      if (i < WAKE_TRIES) { await sleep(20_000); continue; }
      throw new SpaceError({ kind: "sleep", leftSeconds: 0, message: `Space ${space.label} injoignable : ${err instanceof Error ? err.message : err}` });
    }
    if (res.ok) {
      const data: any = await res.json().catch(() => ({}));
      eventId = String(data?.event_id || "");
      if (!eventId) throw new SpaceError(explain("réponse inattendue du Space", 0, space.label, Boolean(token)));
      break;
    }
    const text = await res.text().catch(() => "");
    const info = explain(text, res.status, space.label, Boolean(token));
    if (info.kind === "sleep" && i < WAKE_TRIES) {
      if (i === 0) say(`Le Space ${space.label} se réveille (jusqu'à 2 ou 3 minutes)…`);
      await sleep(20_000);
      continue;
    }
    throw new SpaceError(info);
  }

  say(`En file d'attente sur ${space.label}, puis génération…`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), MAX_WAIT_MS);
  try {
    const res = await fetch(`${space.host}/gradio_api/call/${space.api}/${eventId}`, { headers: authHeaders(token), signal: ctrl.signal });
    if (!res.ok || !res.body) throw new SpaceError(explain(await res.text().catch(() => ""), res.status, space.label, Boolean(token)));
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = parseSse(buffer);
      buffer = rest;
      for (const ev of events) {
        if (ev.event === "complete") {
          const output = JSON.parse(ev.data);
          const url = videoUrl(output, space.host);
          if (!url) throw new SpaceError(explain("pas de vidéo dans la réponse", 0, space.label, Boolean(token)));
          return { url, space: space.label, width, height, duration: job2.duration, prompt: Array.isArray(output) && typeof output[1] === "string" ? output[1] : job.prompt };
        }
        if (ev.event === "error") {
          let m = ev.data;
          try { const parsed = JSON.parse(ev.data); m = typeof parsed === "string" ? parsed : parsed?.error || parsed?.message || ""; } catch { /* texte brut */ }
          throw new SpaceError(explain(m || "", 0, space.label, Boolean(token)));
        }
      }
    }
    throw new SpaceError(explain("connexion avec le Space coupée avant la fin", 0, space.label, Boolean(token)));
  } catch (err) {
    if (err instanceof SpaceError) throw err;
    if (ctrl.signal.aborted) throw new SpaceError({ kind: "busy", leftSeconds: 0, message: `Le Space ${space.label} n'a pas répondu en 9 minutes (file d'attente trop longue) : réessaie plus tard.` });
    throw new SpaceError(explain(err instanceof Error ? err.message : String(err), 0, space.label, Boolean(token)));
  } finally {
    clearTimeout(timer);
  }
}

// Space principal, puis Space de secours si le premier dort, plante ou n'a plus assez de quota.
// Un token refusé ou un quota à zéro arrête tout : l'autre Space aurait le même problème.
export async function generateVideo(job: Job, token: string | undefined, say: (status: string) => void) {
  let first: SpaceError | null = null;
  for (const [i, space] of SPACES.entries()) {
    try {
      return await runOnSpace(space, job, token, say);
    } catch (err) {
      const e = err instanceof SpaceError ? err : new SpaceError({ kind: "other", leftSeconds: 0, message: String(err) });
      if (e.kind === "auth" || (e.kind === "quota" && e.leftSeconds <= 0)) throw e;
      if (i === SPACES.length - 1) {
        if (first) e.message = `${first.message} Secours : ${e.message}`;
        throw e;
      }
      first ??= e;
      say(`${e.message} On essaie le Space de secours…`);
    }
  }
  throw new SpaceError({ kind: "other", leftSeconds: 0, message: "Aucun Space disponible." });
}
