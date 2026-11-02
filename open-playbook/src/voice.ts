// Explication audio.
// 1. Clips MP3 pré-générés avec une voix naturelle (Piper, scripts/tts.py), publiés avec le site.
// 2. Sinon, synthèse vocale du navigateur (Web Speech API), avec la meilleure voix disponible.
import type { Lang } from "./engine";

export const voiceSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

// ---------------------------------------------------------------- voix du navigateur
// Les voix « améliorées », « naturelles » ou en ligne sonnent beaucoup moins robotiques.
const GOOD = /(premium|enhanced|améliorée|natural|neural|online|google|siri|wavenet)/i;
const BAD = /\b(compact|espeak|eloquence|novelty|whisper|albert|bad news|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|zarvox|grandma|grandpa|rocko|shelley|flo|reed|sandy|eddy)\b/i;

function score(v: SpeechSynthesisVoice, lang: Lang) {
  const tag = v.lang.toLowerCase().replace("_", "-");
  if (!tag.startsWith(lang)) return -1;
  let s = 0;
  if (GOOD.test(v.name)) s += 10;
  if (BAD.test(v.name)) s -= 10;
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
// Un seul élément audio pour tout le site : une fois débloqué par un toucher (iPhone), il peut enchaîner les clips.
let player: HTMLAudioElement | null = null;
const audio = () => (player ??= Object.assign(new Audio(), { preload: "auto" }));
const clipOk = new Map<string, Promise<boolean>>();

/** Vérifie (une fois) que les clips de cette version sont publiés : absents en local et dans l'aperçu en une page. */
export function clipsAvailable(url: string) {
  if (!clipOk.has(url)) {
    clipOk.set(
      url,
      fetch(url, { method: "HEAD" })
        .then((r) => r.ok && /audio|mpeg|octet/.test(r.headers.get("content-type") ?? "audio"))
        .catch(() => false),
    );
  }
  return clipOk.get(url)!;
}

/**
 * Joue un clip. À appeler sans « await » préalable dans le gestionnaire de clic pour le premier clip,
 * sinon le navigateur peut bloquer le son. Rejette si la lecture est refusée.
 */
export function playClip(url: string, alive: () => boolean = () => true): Promise<void> {
  const a = audio();
  a.pause();
  a.src = url;
  return new Promise((resolve, reject) => {
    let done = false;
    const end = (ok: boolean, e?: unknown) => {
      if (done) return;
      done = true;
      a.onended = a.onerror = null;
      clearInterval(watch);
      ok ? resolve() : reject(e);
    };
    a.onended = () => end(true);
    a.onerror = () => end(false, new Error("clip"));
    // Arrêt demandé (nouvelle fiche, pause) : on libère l'attente.
    const watch = window.setInterval(() => !alive() && end(true), 200);
    a.play().catch((e) => end(false, e));
  });
}

export function stopSpeaking() {
  if (voiceSupported()) window.speechSynthesis.cancel();
  player?.pause();
}
