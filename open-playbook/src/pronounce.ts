// Prononciation de la narration : texte envoyé à la synthèse vocale (scripts/tts.py).
// - Français : les termes anglais du basket (pick-and-roll, Horns, close-out, équipes NBA…) sont
//   entourés de ⟦…⟧ pour être prononcés à l'anglaise, avec la même voix.
// - Les deux langues : sigles épelés, fractions et décimales dites en toutes lettres, symboles retirés.
// Partagé par le site (nom des clips) et scripts/narration-jobs.ts : changer ce fichier change le nom
// des clips concernés, qui sont alors refaits automatiquement.
import type { Lang } from "./engine";

/** Termes anglais certains (minuscules). Un mot composé s'écrit avec ses tirets. */
const CORE = new Set(
  `pick-and-roll pick-and-pop horns hedge drop roll lay-up lay-ups close-out close-outs flare flares match-up match-ups
  stagger staggers floppy floppy-pick drive kick slot drag spain shuffle screen screens floater floaters zipper stunt
  split sink pin-down pin-in fill trailer stack snake shake scramble duck-in curl chin catch-and-shoot pistol ice hammer
  wheel weave veer switch step-up step-back seal runner rim reject re-screen re-post re-drag pump outlet loop lift ghost
  flat fake euro-step elbow brush box-out blocker-mover blind baseline x-out twist swing shell rub punch chase amoeba
  elevator corner corners spurs warriors jazz bulls lakers heat bucks raptors celtics rockets suns kings mavericks wizards
  knicks nets pistons pacers hawks hornets magic cavaliers cavs thunder nuggets clippers grizzlies pelicans timberwolves
  blazers trail sixers 76ers golden state san antonio utah sacramento detroit milwaukee phoenix houston dallas chicago
  boston miami denver memphis indiana orlando cleveland toronto brooklyn atlanta charlotte portland seattle oklahoma
  washington philadelphia minnesota angeles los mikan hail mary princeton dribble-drive handoff hand-off backdoor
  back-door iso spacing spain shooter shooters post-up post-ups high-low hi-lo bounce bump deny contest show
  delay over under keep pitch slides diamond wave weak level pack man get run jump box`.split(/\s+/).filter(Boolean),
);

/** Petits mots anglais : anglais seulement collés à un terme anglais (« Horns Down », « run and jump »). */
const WEAK = new Set(
  `and at the of to out down away through home line open back high low ball three read react world break short cross
  pad pig drill one two up off left right side strong quick fist stack screener cut pass shot game guard big small play
  early late fast`.split(/\s+/),
);

/** Mots qui ressemblent à de l'anglais mais sont français dans nos textes : jamais en anglais. */
const FRENCH = new Set("but plot plots rate replace use pivot sans zone zones a on long point double triple isolation".split(" "));

/** Sigles épelés : à l'anglaise dans les deux langues (comme dans le basket au Québec). */
const SPELL: Record<string, string> = { NBA: "N B A", DHO: "D H O", UCLA: "U C L A", ATO: "A T O", LA: "L A" };
/** Sigles lus comme des mots. */
const WORDS: Record<string, string> = { BLOB: "blob", SLOB: "slob", ICE: "ice" };

const FRACTIONS: Record<Lang, Record<string, string>> = {
  fr: { "1/2": "un demi", "1/4": "un quart", "3/4": "trois quarts", "1/3": "un tiers", "2/3": "deux tiers" },
  en: { "1/2": "one half", "1/4": "one quarter", "3/4": "three quarters", "1/3": "one third", "2/3": "two thirds" },
};

const isEn = (w: string) => {
  const k = w.toLowerCase().replace(/[’']s$/, "");
  if (FRENCH.has(k)) return 0;
  if (CORE.has(k) || (k.length > 4 && CORE.has(k.replace(/s$/, "")))) return 2;
  return WEAK.has(k) ? 1 : 0;
};

/** Entoure de ⟦…⟧ les suites de mots anglais d'un texte français. */
function markEnglish(text: string) {
  // Jetons : mots (avec tirets et apostrophes internes), chiffres, puis le reste (espaces, ponctuation).
  const toks = text.match(/[A-Za-zÀ-ÿ0-9]+(?:[-’'][A-Za-zÀ-ÿ0-9]+)*|\s+|[^\sA-Za-zÀ-ÿ0-9]+/g) ?? [];
  const kind = toks.map((t) => (/^[A-Za-zÀ-ÿ]/.test(t) && !/[À-ÿ]/.test(t) ? isEn(t) : /^\d+$/.test(t) ? -1 : 0));
  // Une parenthèse entièrement anglaise (« (screen the zone) », « (over) ») passe en anglais.
  for (let i = 0; i < toks.length; i++) {
    if (toks[i] !== "(" && !toks[i].endsWith("(")) continue;
    let j = i + 1, words = 0, ok = true;
    for (; j < toks.length && !toks[j].startsWith(")"); j++) {
      if (/^\s+$/.test(toks[j]) || toks[j] === "-") continue;
      if (kind[j] > 0) words++;
      else if (kind[j] !== -1) ok = false;
    }
    if (ok && words && j < toks.length) for (let k = i + 1; k < j; k++) if (kind[k] === 1) kind[k] = 2;
  }
  // Un petit mot est anglais s'il touche (à un espace ou un tiret près) un mot anglais certain, de proche en proche.
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < toks.length; i++) {
      if (kind[i] !== 1) continue;
      const near = (d: number) => {
        let k = i + d;
        while (k >= 0 && k < toks.length && /^[\s-]+$/.test(toks[k])) k += d;
        return k >= 0 && k < toks.length && (kind[k] === 2 || (kind[k] === -1 && kind[k + d] === 2));
      };
      if (near(-1) || near(1)) (kind[i] = 2), (changed = true);
    }
  }
  let out = "", open = false;
  for (let i = 0; i < toks.length; i++) {
    const en = kind[i] === 2;
    // Les espaces et tirets entre deux mots anglais restent dans le même passage anglais.
    let next = i + 1;
    while (next < toks.length && /^[\s-]+$/.test(toks[next])) next++;
    const glue = /^[\s-]+$/.test(toks[i]) && open && kind[next] === 2;
    if (en && !open) (out += "⟦"), (open = true);
    if (!en && !glue && open) (out += "⟧"), (open = false);
    out += toks[i];
  }
  return open ? out + "⟧" : out;
}

// Numéros de joueurs dits comme un coach : « 1 passe à 4 » → « Le 1 passe au 4 », « le défenseur de 1 » → « du 1 ».
// Pas quand le chiffre est une quantité (3 points, 5 contre 5, 2 secondes…).
const QTY = "(?!\\s*(?:points?|contre|secondes?|mètres?|pieds?|joueurs?|fois|passes|dribbles|pas|minutes?|ou|et|à)(?=[\\s,.;:!?]|$)|\\s*[0-9])";
function coachFr(t: string) {
  return t
    .replace(new RegExp(`(^|[.;:!?]\\s+)([1-5])(?=\\s+[a-zéèêàâîôûç])${QTY}`, "g"), (_, pre: string, n) => `${pre}${/[;:]\s*$/.test(pre) ? "le" : "Le"} ${n}`)
    .replace(new RegExp(`(^|\\s)à ([1-5])\\b${QTY}`, "g"), "$1au $2")
    .replace(new RegExp(`\\bde ([1-5])\\b${QTY}`, "g"), "du $1");
}

/** Texte final envoyé à la synthèse vocale pour un segment déjà « prononçable » (speakable). */
export function ttsText(text: string, lang: Lang) {
  let t = text
    .replace(/\b(\d)\/(\d)\b/g, (m) => FRACTIONS[lang][m] ?? m)
    .replace(/\b0[,.](\d)\b/g, (_, d) => (lang === "fr" ? `zéro virgule ${d}` : `zero point ${d}`))
    .replace(/\s*=\s*/g, lang === "fr" ? " égale " : " equals ")
    .replace(/\s+\/\s+/g, ", ")
    .replace(/…/g, "... ")
    .replace(/\b[A-Z]{2,5}\b/g, (m) => SPELL[m] ?? WORDS[m] ?? m)
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (lang === "fr") t = coachFr(t);
  if (lang === "fr") t = markEnglish(t).replace(/\b([A-Z](?: [A-Z]){1,4})\b/g, (m, _x, i, all) => (all[i - 1] === "⟦" ? m : `⟦${m}⟧`));
  // Parenthèses lues comme une incise : une virgule de chaque côté (sinon la voix enchaîne sans pause).
  t = t
    .replace(/\s*\(([^()]*)\)\s*([.,;:!?])?/g, (_, inner, punct) => `, ${inner}${punct ?? ","} `)
    .replace(/,\s*([.,;:!?])/g, "$1")
    .replace(/^,\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  return t.replace(/⟧(\s*)⟦/g, "$1");
}

/** Texte sans les marques ⟦…⟧ (voix du navigateur, affichage). */
export const plainText = (t: string) => t.replace(/[⟦⟧]/g, "");
