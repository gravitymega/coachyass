// Texte lu à voix haute pour une fiche : partagé par le site (lecture) et scripts/narration-jobs.ts (fichiers audio).
// Un clip audio par segment : présentation, chaque étape, puis « pourquoi ça marche ».
import type { Lang, Tactic, Text } from "./engine";

/** Changer la version d'une langue régénère tous ses clips (nouvelle voix, nouveaux réglages).
 * fr v2 : Piper upmc « pierre » ; en v3 : Kokoro am_michael (voix d'homme réaliste). */
export const AUDIO_VERSIONS: Record<Lang, string> = { fr: "v2", en: "v3" };

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

/** Accroche du début (vidéos en anglais) : le type de séquence, puis le nom du système. */
export const HOOKS: Record<string, string> = {
  attaque: "Film room",
  zone_att: "Zone offense film room",
  transition: "Transition film room",
  remises: "Set play breakdown",
  defense: "Defensive breakdown",
  exercices: "Drill breakdown",
  principes: "Coaching principle",
};

const sentence = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

/** Anglais (vidéos et lecture du site), version courte : accroche + nom au début,
 * le point clé à la fin. */
function englishSegments(t: Tactic) {
  const hook = HOOKS[t.cat] ?? "Breakdown";
  const intro = `${hook}: ${t.name.en}.`;
  const lower = (k: string) => (/^[A-Z][a-z]/.test(k) ? k[0].toLowerCase() + k.slice(1) : k);
  const key = t.keys.en[0] ? `The key: ${lower(t.keys.en[0].replace(/[.;]$/, ""))}.` : "";
  // Version très courte (demande du 3 nov. 2026) : seulement le point clé à la fin.
  const end = key || sentence(t.why.en);
  return [intro, ...(t.steps ?? []).map((s) => s.c.en), end].map((x) => speakable(x, "en"));
}

/** Segments à lire, dans l'ordre : [présentation, étape 1, …, étape n, conclusion]. */
export function narrationSegments(t: Tactic, lang: Lang, against?: Text, nba?: NbaTeam[]) {
  if (lang === "en") return englishSegments(t);
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
  return `audio/${AUDIO_VERSIONS[lang]}/${lang}/${hex.slice(0, 16)}.mp3`;
}
