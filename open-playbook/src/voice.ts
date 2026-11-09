// Explication audio.
// 1. Clips MP3 pré-générés avec une voix naturelle (scripts/tts.py), publiés avec le site, joués par Web Audio.
// 2. Sinon, synthèse vocale du navigateur (Web Speech API), avec la meilleure voix disponible.
import type { Lang } from "./engine";

export const voiceSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

// ---------------------------------------------------------------- voix du navigateur
// Les voix « améliorées », « naturelles » ou en ligne sonnent beaucoup moins robotiques.
const GOOD = /(premium|enhanced|améliorée|natural|neural|online|google|siri|wavenet)/i;
const BAD = /\b(compact|espeak|eloquence|novelty|whisper|albert|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|zarvox|grandma|grandpa|rocko|shelley|flo|reed|sandy|eddy)\b/i;

// Voix d'homme demandées : noms courants des voix d'homme (macOS, Windows, Edge, Android) et de femme.
const MALE = /\b(male|homme|thomas|daniel|alex|fred|aaron|arthur|paul|henri|guy|david|mark|george|james|ryan|eric|christopher|roger|andrew|brian|jacques|antoine|claude|nicolas|jean|gilles|liam|william)\b/i;
const FEMALE = /\b(female|femme|am[ée]lie|audrey|aur[ée]lie|marie|julie|hortense|denise|ariane|sylvie|chantal|virginie|elsa|eloise|vivienne|brigitte|celeste|josephine|samantha|zira|karen|moira|tessa|victoria|allison|ava|susan|jenny|aria|sonia|libby|emma|michelle|serena|kate|fiona|nicky|catherine|joanna|salli|kimberly|ivy|ruth)\b/i;

function score(v: SpeechSynthesisVoice, lang: Lang) {
  const tag = v.lang.toLowerCase().replace("_", "-");
  if (!tag.startsWith(lang)) return -1;
  let s = 0;
  if (GOOD.test(v.name)) s += 10;
  if (BAD.test(v.name)) s -= 10;
  if (MALE.test(v.name)) s += 15;
  if (FEMALE.test(v.name)) s -= 15;
  if (!v.localService) s += 3; // voix en ligne (Chrome, Edge) : meilleure qualité
  if (lang === "fr" ? tag === "fr-ca" || tag === "fr-fr" : tag === "en-us" || tag === "en-ca") s += 2;
  if (v.default) s += 1;
  return s;
}

function pickVoice(lang: Lang) {
  let best: SpeechSynthesisVoice | undefined, bestScore = -1;
  for (const v of window.speechSynthesis.getVoices()) {
    const s = score(v, lang);
    if (s > bestScore) (best = v), (bestScore = s);
  }
  return best;
}

if (voiceSupported()) {
  // Certaines plateformes chargent la liste des voix plus tard.
  window.speechSynthesis.getVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", () => window.speechSynthesis.getVoices());
}

/** Coupe en phrases : Chrome arrête une phrase trop longue après une quinzaine de secondes. */
function sentences(text: string) {
  return text.match(/[^.!?;:]+[.!?;:]*\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];
}

function speakOne(text: string, lang: Lang): Promise<void> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "fr" ? "fr-FR" : "en-US";
    const v = pickVoice(lang);
    if (v) (u.voice = v), (u.lang = v.lang);
    u.rate = 0.98;
    u.pitch = 1;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    // Secours si le navigateur ne signale pas la fin : environ 0,45 s par mot + 4 s.
    const timer = window.setTimeout(finish, (text.split(/\s+/).length * 0.45 + 4) * 1000);
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
  });
}

/** Lit un texte avec la voix du navigateur ; se résout à la fin. */
export async function speak(text: string, lang: Lang, alive: () => boolean = () => true) {
  if (!voiceSupported() || !text.trim()) return;
  for (const s of sentences(text)) {
    if (!alive()) return;
    await speakOne(s, lang);
  }
}

// ---------------------------------------------------------------- clips audio
const clipOk = new Map<string, Promise<boolean>>();

/** Vérifie (une fois) que les clips de cette version sont publiés : absents en local et dans l'aperçu en une page. */
export function clipsAvailable(url: string) {
  if (!clipOk.has(url)) {
    clipOk.set(
      url,
      fetch(url, { method: "HEAD" })
        // Certains hébergeurs refusent HEAD : on réessaie avec une vraie requête.
        .then((r) => (r.ok ? r : fetch(url)))
        .then((r) => r.ok && /audio|mpeg|octet/.test(r.headers.get("content-type") ?? "audio"))
        .catch(() => false),
    );
  }
  return clipOk.get(url)!;
}

// ---------------------------------------------------------------- Web Audio (synchronisation exacte)
// Les clips d'une fiche sont téléchargés et décodés dès l'ouverture : au moment de jouer une étape,
// le son part sans délai réseau et sa durée exacte est connue, ce qui cale l'animation sur la voix.
type Ctx = AudioContext & { outputLatency?: number };
let ctx: Ctx | null = null;
let current: AudioBufferSourceNode | null = null;

function audioCtx(): Ctx | null {
  if (ctx) return ctx;
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return C ? (ctx = new C() as Ctx) : null;
}

/** À appeler dans le geste de l'utilisateur (clic) : débloque le son sur iPhone et Safari. */
export function unlockAudio() {
  const c = audioCtx();
  if (!c) return;
  if (c.state !== "running") void c.resume().catch(() => {});
  // Un son vide joué dans le geste suffit à iOS pour autoriser les suivants.
  const s = c.createBufferSource();
  s.buffer = c.createBuffer(1, 1, 22050);
  s.connect(c.destination);
  s.start(0);
}

/** Le son est-il autorisé ? (false tant que le navigateur bloque la lecture sans geste.) */
export async function audioRunning(timeoutMs = 400) {
  const c = audioCtx();
  if (!c) return false;
  if (c.state === "running") return true;
  await Promise.race([c.resume().catch(() => {}), new Promise((r) => setTimeout(r, timeoutMs))]);
  return (c.state as string) === "running";
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();
/** Télécharge et décode un clip (une seule fois). null si absent ou illisible. */
export function loadClip(url: string): Promise<AudioBuffer | null> {
  const c = audioCtx();
  if (!c) return Promise.resolve(null);
  if (!buffers.has(url)) {
    buffers.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        // Forme à rappels : compatible avec les anciens Safari.
        .then((data) => new Promise<AudioBuffer>((ok, ko) => c.decodeAudioData(data, ok, ko)))
        .catch(() => {
          buffers.delete(url);
          return null;
        }),
    );
  }
  return buffers.get(url)!;
}

/** Délai entre le départ du son et le moment où on l'entend (haut-parleur, Bluetooth), en secondes. */
export function outputDelay() {
  const c = audioCtx();
  return c ? Math.min(0.5, Math.max(0, c.outputLatency ?? c.baseLatency ?? 0)) : 0;
}

/** Joue un clip décodé tout de suite ; se résout à la fin du clip (ou à l'arrêt). */
export function playBuffer(buf: AudioBuffer, alive: () => boolean = () => true): Promise<void> {
  const c = audioCtx()!;
  current?.stop();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  current = src;
  return new Promise((resolve) => {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      clearInterval(watch);
      if (current === src) current = null;
      resolve();
    };
    src.onended = end;
    const watch = window.setInterval(() => {
      if (!alive()) {
        try {
          src.stop();
        } catch {
          /* déjà arrêté */
        }
        end();
      }
    }, 100);
    src.start(0);
  });
}

export function stopSpeaking() {
  try {
    current?.stop();
  } catch {
    /* déjà arrêté */
  }
  current = null;
  if (voiceSupported()) window.speechSynthesis.cancel();
}
