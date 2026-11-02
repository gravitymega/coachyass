// Explication audio : synthèse vocale du navigateur (Web Speech API), gratuite, sans serveur.
import type { Lang } from "./engine";

export const voiceSupported = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

function pickVoice(lang: Lang) {
  const voices = window.speechSynthesis.getVoices();
  const want = lang === "fr" ? ["fr-CA", "fr-FR", "fr"] : ["en-US", "en-CA", "en-GB", "en"];
  for (const w of want) {
    const v = voices.find((x) => x.lang.toLowerCase().startsWith(w.toLowerCase()));
    if (v) return v;
  }
  return undefined;
}

/** Lit un texte ; se résout à la fin de la phrase (ou après un délai de secours si le navigateur ne prévient pas). */
export function speak(text: string, lang: Lang): Promise<void> {
  return new Promise((resolve) => {
    if (!voiceSupported() || !text.trim()) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === "fr" ? "fr-FR" : "en-US";
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = 1;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve();
    };
    // Secours : environ 0,45 s par mot + 1,5 s.
    const timer = window.setTimeout(finish, (text.split(/\s+/).length * 0.45 + 1.5) * 1000 + 4000);
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (voiceSupported()) window.speechSynthesis.cancel();
}
