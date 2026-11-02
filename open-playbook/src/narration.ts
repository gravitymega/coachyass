// Texte lu à voix haute pour une fiche : partagé par le site (lecture) et scripts/narration-jobs.ts (fichiers audio).
// Un clip audio par segment : présentation, chaque étape, puis « pourquoi ça marche ».
import type { Lang, Tactic, Text } from "./engine";

/** Changer cette version régénère tous les clips (nouvelle voix, nouveaux réglages). */
export const AUDIO_VERSION = "v1";

export interface NbaTeam {
  team: string;
  when: Text;
}

/** Rend le texte prononçable : « x2 » → « défenseur 2 », « 2-3 » → « 2 3 », « 45° » → « 45 degrés ». */
export function speakable(text: string, lang: Lang) {
  const fr = lang === "fr";
  return text
    .replace(/\bx([1-5])('s)?\b/g, (_, n, s) => (fr ? `défenseur ${n}` : `defender ${n}${s ?? ""}`))
    .replace(/(\d)-(?=\d)/g, "$1 ")
    .replace(/(\d)\s*°/g, fr ? "$1 degrés" : "$1 degrees")
    .replace(/−(\d)/g, fr ? "moins $1" : "minus $1")
    .replace(/[«»"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function nbaSentence(teams: NbaTeam[] | undefined, lang: Lang) {
  if (!teams?.length) return "";
  const names = [...new Set(teams.map((t) => t.team))];
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} ${lang === "fr" ? "et" : "and"} ${names.at(-1)}` : names[0];
  return lang === "fr" ? `En NBA, utilisé notamment par : ${list}.` : `In the NBA, used notably by: ${list}.`;
}

/** Segments à lire, dans l'ordre : [présentation, étape 1, …, étape n, conclusion]. */
export function narrationSegments(t: Tactic, lang: Lang, against?: Text, nba?: NbaTeam[]) {
  const colon = lang === "fr" ? " :" : ":";
  const why = lang === "fr" ? "Pourquoi ça marche" : "Why it works";
  const vs = against ? ` ${lang === "fr" ? "Contre quelle défense ça marche" : "Which defense it beats"}${colon} ${against[lang]}` : "";
  const end = `${why}${colon} ${t.why[lang]}${vs}${nba?.length ? ` ${nbaSentence(nba, lang)}` : ""}`;
  return [`${t.name[lang]}. ${t.sum[lang]}`, ...(t.steps ?? []).map((s) => s.c[lang]), end].map((x) => speakable(x, lang));
}

/** Nom du fichier d'un clip : empreinte SHA-1 de la langue et du texte (écrite dans audio-jobs.json pour scripts/tts.py). */
export async function clipPath(text: string, lang: Lang) {
  const data = new TextEncoder().encode(`${lang}|${text}`);
  const digest = await crypto.subtle.digest("SHA-1", data);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `audio/${AUDIO_VERSION}/${lang}/${hex.slice(0, 16)}.mp3`;
}
