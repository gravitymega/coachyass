// Séances d'entraînement générées à partir des fiches (data/seances.json, `npm run seances`).
// Le fichier ne garde que la structure (niveau, thème, durée, blocs et fiches) ; les textes FR/EN
// sont reconstruits ici, à partir des noms et des points clés des fiches, pour garder le site léger.
import type { Lang, Library, Plan, PlanLevel, Tactic, Text } from "./engine";

export type BlockKind = "ech" | "phys" | "tech" | "tech2" | "sit" | "sit2" | "opp" | "match" | "calme";
export interface SeanceBlock {
  k: BlockKind;
  min: number;
  ids?: string[];
}
export interface Seance {
  id: string;
  level: PlanLevel;
  theme: string;
  duration: number;
  n: number; // numéro de la variante pour ce niveau, ce thème et cette durée
  blocks: SeanceBlock[];
}
export interface SeancesFile {
  version: 1;
  plans: Seance[];
}

type Side = "att" | "def";
export interface Theme {
  id: string;
  name: Text;
  side: Side;
  /** Familles d'exercices pour la technique. */
  drills: string[];
  /** Fiches pour la mise en place : [catégorie, famille]. */
  sit: [string, string][];
  /** Familles d'exercices pour le jeu à thème. */
  opp: string[];
  /** Règle du jeu à thème et du match dirigé. */
  rule: Text;
  ruleYouth?: Text; // règle adaptée aux jeunes (pas de ligne à 3 points en mini-basket)
  youth?: boolean; // proposé aux jeunes
  gameDay?: boolean; // proposé la veille d'un match
}

export const THEMES: Theme[] = [
  { id: "tir", name: { fr: "Tir", en: "Shooting" }, side: "att", drills: ["tir"], sit: [["attaque", "ecrans-sans-ballon"], ["zone_att", "attaque-zone-2-3"]], opp: ["surnombre", "tir"], rule: { fr: "un panier à 3 points compte 4 points", en: "a three-pointer is worth 4 points" }, ruleYouth: { fr: "un panier marqué juste après une passe compte double", en: "a basket scored straight off a pass counts double" }, youth: true, gameDay: true },
  { id: "dribble", name: { fr: "Dribble", en: "Ball handling" }, side: "att", drills: ["dribble"], sit: [["attaque", "main-a-main"], ["attaque", "pick-and-roll"]], opp: ["un-contre-un", "jeux-jeunes"], rule: { fr: "chaque pénétration jusqu'à la raquette rapporte 1 point bonus", en: "every drive into the paint earns a bonus point" }, youth: true },
  { id: "finition", name: { fr: "Finition", en: "Finishing" }, side: "att", drills: ["finition"], sit: [["attaque", "pick-and-roll"], ["attaque", "poste"]], opp: ["surnombre", "un-contre-un"], rule: { fr: "un panier dans la raquette compte 3 points", en: "a basket in the paint is worth 3 points" }, youth: true },
  { id: "passes", name: { fr: "Passes", en: "Passing" }, side: "att", drills: ["passes"], sit: [["attaque", "motion"], ["principes", "principes-attaque"]], opp: ["surnombre", "un-contre-un"], rule: { fr: "un panier ne compte qu'après au moins 3 passes", en: "a basket only counts after at least 3 passes" }, youth: true },
  { id: "un-contre-un", name: { fr: "1 contre 1", en: "1-on-1" }, side: "att", drills: ["un-contre-un"], sit: [["attaque", "main-a-main"], ["principes", "principes-attaque"]], opp: ["un-contre-un"], rule: { fr: "les attaquants sans ballon dégagent le côté pour laisser le 1 contre 1", en: "off-ball players clear the side to leave room for the 1-on-1" }, youth: true },
  { id: "jeu-sans-ballon", name: { fr: "Jeu sans ballon", en: "Off-ball movement" }, side: "att", drills: ["passes", "tir"], sit: [["attaque", "ecrans-sans-ballon"], ["attaque", "motion"]], opp: ["surnombre"], rule: { fr: "un panier après une coupe ou un écran sans ballon compte double", en: "a basket off a cut or an off-ball screen counts double" }, youth: true },
  { id: "defense-individuelle", name: { fr: "Défense individuelle", en: "On-ball defense" }, side: "def", drills: ["defense-individuelle"], sit: [["defense", "homme-a-homme"], ["principes", "principes-defense"]], opp: ["un-contre-un", "defense-individuelle"], rule: { fr: "chaque arrêt défensif rapporte 1 point à la défense", en: "every defensive stop earns the defense a point" }, youth: true },
  { id: "defense-collective", name: { fr: "Défense collective", en: "Team defense" }, side: "def", drills: ["defense-collective"], sit: [["defense", "rotations"], ["defense", "homme-a-homme"]], opp: ["defense-collective", "surnombre"], rule: { fr: "3 arrêts défensifs de suite rapportent 2 points bonus", en: "3 stops in a row earn 2 bonus points" }, youth: true, gameDay: true },
  { id: "rebond", name: { fr: "Rebond", en: "Rebounding" }, side: "def", drills: ["rebond"], sit: [["defense", "homme-a-homme"], ["principes", "principes-defense"]], opp: ["rebond", "surnombre"], rule: { fr: "chaque rebond offensif ou défensif capté rapporte 1 point", en: "every offensive or defensive rebound secured earns a point" }, youth: true },
  { id: "transition", name: { fr: "Transition", en: "Transition" }, side: "att", drills: ["transition-exercices", "surnombre"], sit: [["transition", "contre-attaque"], ["transition", "attaque-rapide"], ["transition", "defense-transition"]], opp: ["surnombre", "transition-exercices"], rule: { fr: "un panier marqué en moins de 8 secondes compte 3 points", en: "a basket scored within 8 seconds is worth 3 points" }, youth: true, gameDay: true },
  { id: "attaque-placee", name: { fr: "Attaque placée", en: "Half-court offense" }, side: "att", drills: ["passes", "tir"], sit: [["attaque", "systemes"], ["attaque", "horns"], ["attaque", "motion"]], opp: ["surnombre"], rule: { fr: "le système du jour doit être joué avant de tirer", en: "the set of the day must be run before any shot" }, youth: true, gameDay: true },
  { id: "pick-and-roll", name: { fr: "Pick-and-roll", en: "Pick-and-roll" }, side: "att", drills: ["dribble", "finition"], sit: [["attaque", "pick-and-roll"], ["defense", "defense-pick-and-roll"]], opp: ["un-contre-un", "surnombre"], rule: { fr: "chaque possession commence par un pick-and-roll", en: "every possession starts with a pick-and-roll" }, gameDay: true },
  { id: "attaque-zone", name: { fr: "Attaque de zone", en: "Zone offense" }, side: "att", drills: ["tir", "passes"], sit: [["zone_att", "attaque-zone-2-3"], ["zone_att", "attaque-zone-3-2"], ["zone_att", "attaque-zone-1-3-1"]], opp: ["surnombre"], rule: { fr: "la défense joue en zone sur toute la séquence", en: "the defense plays zone the whole time" }, gameDay: true },
  { id: "defense-zone", name: { fr: "Défense de zone", en: "Zone defense" }, side: "def", drills: ["defense-collective"], sit: [["defense", "zones"], ["defense", "rotations"]], opp: ["defense-collective", "surnombre"], rule: { fr: "la défense joue la zone du jour ; un tir contesté vaut 1 point pour elle", en: "the defense plays the zone of the day; a contested shot earns it a point" }, gameDay: true },
  { id: "presse", name: { fr: "Presse et contre-presse", en: "Press and press break" }, side: "def", drills: ["passes", "physique"], sit: [["defense", "presses"], ["transition", "contre-presse"]], opp: ["surnombre"], rule: { fr: "chaque panier encaissé est suivi d'une presse tout terrain", en: "every made basket is followed by a full-court press" } },
  { id: "remises", name: { fr: "Remises en jeu", en: "Inbound plays" }, side: "att", drills: ["passes", "tir"], sit: [["remises", "remise-ligne-de-fond"], ["remises", "remise-ligne-de-touche"]], opp: ["surnombre"], rule: { fr: "chaque possession commence par une remise en jeu", en: "every possession starts with an inbound" }, youth: true, gameDay: true },
  { id: "fin-de-match", name: { fr: "Fin de match", en: "Late-game situations" }, side: "att", drills: ["tir", "seance-pro"], sit: [["remises", "fin-de-match"], ["defense", "fin-de-match-defense"]], opp: ["surnombre", "seance-pro"], rule: { fr: "score et chrono affichés : 2 points d'écart, 1 minute à jouer", en: "score and clock shown: 2-point game, 1 minute to play" }, gameDay: true },
];
export const themeById = new Map(THEMES.map((t) => [t.id, t]));

/** Niveau de difficulté maximal des fiches pour chaque niveau de séance. */
const MAX_LVL: Record<PlanLevel, number> = { jeunes: 1, general: 2, amateurs: 2, "pre-saison": 3, pro: 3, "veille-de-match": 3 };
/** Plan des blocs (type et minutes) selon le niveau et la durée. */
const LAYOUT: Record<string, [BlockKind, number][]> = {
  "45": [["ech", 8], ["tech", 12], ["sit", 12], ["opp", 10], ["calme", 3]],
  "60": [["ech", 10], ["tech", 15], ["sit", 15], ["opp", 15], ["calme", 5]],
  "75": [["ech", 10], ["tech", 15], ["tech2", 10], ["sit", 15], ["opp", 20], ["calme", 5]],
  "90": [["ech", 12], ["tech", 15], ["tech2", 12], ["sit", 18], ["opp", 15], ["match", 13], ["calme", 5]],
  "120": [["ech", 15], ["tech", 15], ["tech2", 15], ["sit", 20], ["sit2", 15], ["opp", 15], ["match", 20], ["calme", 5]],
  "pre-saison-75": [["ech", 10], ["phys", 15], ["tech", 15], ["sit", 15], ["opp", 15], ["calme", 5]],
  "pre-saison-90": [["ech", 10], ["phys", 15], ["tech", 15], ["tech2", 10], ["sit", 15], ["opp", 20], ["calme", 5]],
  "pre-saison-120": [["ech", 12], ["phys", 18], ["tech", 15], ["tech2", 12], ["sit", 20], ["opp", 18], ["match", 20], ["calme", 5]],
  "veille-de-match-45": [["ech", 10], ["tech", 8], ["sit", 15], ["match", 8], ["calme", 4]],
  "veille-de-match-60": [["ech", 10], ["tech", 10], ["sit", 20], ["match", 15], ["calme", 5]],
  "veille-de-match-75": [["ech", 12], ["tech", 10], ["sit", 20], ["sit2", 15], ["match", 12], ["calme", 6]],
};
const DURATIONS: Record<PlanLevel, number[]> = {
  jeunes: [45, 60, 75, 90],
  general: [45, 60, 75, 90, 120],
  amateurs: [45, 60, 75, 90, 120],
  pro: [45, 60, 75, 90, 120],
  "pre-saison": [75, 90, 120],
  "veille-de-match": [45, 60, 75],
};
export const SEANCE_LEVELS: PlanLevel[] = ["jeunes", "general", "amateurs", "pro", "pre-saison", "veille-de-match"];
export const SEANCE_DURATIONS = [45, 60, 75, 90, 120];

const layout = (level: PlanLevel, d: number) => LAYOUT[`${level}-${d}`] ?? LAYOUT[String(d)];
export const themesFor = (level: PlanLevel) =>
  THEMES.filter((t) => (level === "jeunes" ? t.youth : level === "veille-de-match" ? t.gameDay : true));

// --------------------------------------------------------------- génération
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19));
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Crée `count` séances : toutes les combinaisons niveau × thème × durée en variante 1, puis en variante 2, etc.
 * Une variante identique à une précédente (mêmes fiches) est écartée.
 */
export function generateSeances(lib: Library, count: number): Seance[] {
  const ex = lib.tactics.filter((t) => t.cat === "exercices");
  const pool = (fams: string[], max: number, cats?: [string, string][]) => {
    const src = cats ? lib.tactics.filter((t) => cats.some(([c, f]) => t.cat === c && t.family === f)) : ex.filter((t) => fams.includes(t.family!));
    const ok = src.filter((t) => t.lvl <= max);
    return ok.length ? ok : src.filter((t) => t.lvl <= max + 1).length ? src.filter((t) => t.lvl <= max + 1) : src;
  };
  const combos: [PlanLevel, Theme, number][] = [];
  for (const level of SEANCE_LEVELS) for (const theme of themesFor(level)) for (const d of DURATIONS[level]) combos.push([level, theme, d]);
  const usedByCombo = new Map<string, Map<string, number>>();
  const seenSig = new Set<string>();
  const out: Seance[] = [];
  for (let v = 1; v <= 8 && out.length < count; v++) {
    for (const [level, theme, d] of combos) {
      if (out.length >= count) break;
      const key = `${level}-${theme.id}-${d}`;
      const used = usedByCombo.get(key) ?? new Map<string, number>();
      const rand = rng(`${key}-${v}`);
      const inPlan = new Set<string>();
      /** Choisit n fiches : d'abord celles pas encore prises dans ce plan, puis les moins utilisées par les variantes précédentes. */
      const take = (list: Tactic[], n: number) => {
        const scored = list.filter((t) => !inPlan.has(t.id)).map((t) => [used.get(t.id) ?? 0, rand(), t] as const);
        scored.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const picked = scored.slice(0, n).map((x) => x[2].id);
        picked.forEach((id) => inPlan.add(id));
        return picked;
      };
      const max = MAX_LVL[level];
      const warm = level === "jeunes" ? ["jeux-jeunes", "dribble", "passes"] : ["dribble", "passes", "finition"];
      const blocks: SeanceBlock[] = layout(level, d).map(([k, min]) => {
        let ids: string[] = [];
        if (k === "ech") ids = take(pool(warm, Math.min(max, 1)), 1);
        else if (k === "phys") ids = take(pool(["physique"], 3), 1);
        else if (k === "tech") ids = take(pool(theme.drills, max), min >= 15 ? 2 : 1);
        else if (k === "tech2") ids = take(pool(theme.drills, max), 1);
        else if (k === "sit" || k === "sit2") {
          // Pas de défense de zone chez les jeunes : on garde les fiches homme à homme et les principes.
          const sit = level === "jeunes" ? theme.sit.filter(([c, f]) => c !== "zone_att" && f !== "zones") : theme.sit;
          ids = take(pool([], max, sit), 1);
        }
        else if (k === "opp") ids = take(pool(theme.opp, max).filter((t) => !/lancers? francs?|free throw/i.test(t.name.fr + t.name.en)), 1);
        else if (k === "match") ids = [...inPlan].filter((id) => lib.tactics.find((t) => t.id === id)?.cat !== "exercices").slice(0, 1);
        // Petit réservoir (jeunes) : on élargit aux exercices proches plutôt que de laisser le bloc sans fiche.
        if (!ids.length && k !== "match" && k !== "calme") ids = take(pool([...theme.drills, ...theme.opp, "jeux-jeunes", "surnombre"], max + 1), 1);
        return ids.length ? { k, min, ids } : { k, min };
      });
      const sig = `${key}|${blocks.map((b) => (b.ids ?? []).join(",")).join("|")}`;
      if (seenSig.has(sig)) continue;
      seenSig.add(sig);
      for (const id of inPlan) used.set(id, (used.get(id) ?? 0) + 1);
      usedByCombo.set(key, used);
      const n = out.filter((s) => s.level === level && s.theme === theme.id && s.duration === d).length + 1;
      out.push({ id: `s-${key}-${n}`, level, theme: theme.id, duration: d, n, blocks });
    }
  }
  return out;
}

// ---------------------------------------------------------------- textes FR/EN
const LEVEL_NAME: Record<PlanLevel, Text> = {
  general: { fr: "tous niveaux", en: "all levels" },
  jeunes: { fr: "jeunes", en: "youth" },
  amateurs: { fr: "amateurs", en: "amateur" },
  pro: { fr: "pro", en: "pro" },
  "pre-saison": { fr: "pré-saison", en: "preseason" },
  "veille-de-match": { fr: "veille de match", en: "day before a game" },
};

const both = (f: (l: Lang) => string): Text => ({ fr: f("fr"), en: f("en") });
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const clean = (s: string) => s.replace(/[.\s]+$/, "");

/** Transforme une séance compacte en plan affichable (même format que les plans écrits à la main). */
export function expandSeance(s: Seance, byId: Map<string, Tactic>): Plan & { theme: string } {
  const theme = themeById.get(s.theme)!;
  const youth = s.level === "jeunes";
  // Guillemets autour du nom, sauf s'il en contient déjà (« Jeu du « 21 » »).
  const nm = (id: string | undefined, l: Lang) => {
    const n = id && byId.get(id)?.name[l];
    if (!n) return "";
    if (/[«»“”"]/.test(n)) return n;
    return l === "fr" ? `« ${n} »` : `“${n}”`;
  };
  let bi = 0; // index du bloc : fait tourner les points clés pour éviter la même phrase d'un bloc à l'autre
  const key = (id: string | undefined, l: Lang) => {
    const ks = (id && byId.get(id)?.keys?.[l]) || [];
    const k = ks.length ? ks[bi % ks.length] : "";
    return k ? (l === "fr" ? ` Point clé : ${lower(clean(k))}.` : ` Key point: ${lower(clean(k))}.`) : "";
  };
  const rule = (l: Lang) => (youth && theme.ruleYouth ? theme.ruleYouth[l] : theme.rule[l]);
  const blocks = s.blocks.map((b, i) => {
    bi = i;
    const [a, c] = b.ids ?? [];
    const sitDef = a && ["defense"].includes(byId.get(a)?.cat ?? "") || (a && byId.get(a)?.family === "principes-defense");
    let title: Text;
    let desc: Text;
    switch (b.k) {
      case "ech":
        title = { fr: "Échauffement", en: "Warm-up" };
        desc = both((l) => (l === "fr" ? `Activation avec ${nm(a, l)}, intensité progressive.` : `Get going with ${nm(a, l)}, building up the intensity.`) + key(a, l));
        break;
      case "phys":
        title = { fr: "Préparation physique", en: "Conditioning" };
        desc = both((l) => (l === "fr" ? `${nm(a, l)} en séries courtes, récupération active entre les séries.` : `${nm(a, l)} in short sets, with active recovery between sets.`) + key(a, l));
        break;
      case "tech":
        title = both((l) => (l === "fr" ? `Technique : ${lower(theme.name.fr)}` : `Skills: ${lower(theme.name.en)}`));
        desc = both((l) =>
          (c
            ? l === "fr" ? `${nm(a, l)}, puis ${nm(c, l)}.` : `${nm(a, l)}, then ${nm(c, l)}.`
            : l === "fr" ? `${nm(a, l)} en séries courtes, en changeant de côté.` : `${nm(a, l)} in short sets, switching sides.`) + key(a, l),
        );
        break;
      case "tech2":
        title = { fr: "Répétitions sous pression", en: "Reps under pressure" };
        desc = both((l) => (l === "fr" ? `${nm(a, l)} avec un chrono ou un défenseur qui monte en intensité.` : `${nm(a, l)} against the clock or with a defender who steps up the intensity.`) + key(a, l));
        break;
      case "sit":
      case "sit2":
        title = b.k === "sit" ? { fr: "Mise en place", en: "Team concept" } : { fr: "Variante tactique", en: "Tactical variation" };
        desc = both((l) => {
          if (sitDef)
            return (l === "fr"
              ? `Travailler ${nm(a, l)} : placement à vitesse lente, puis contre une attaque qui varie.`
              : `Work on ${nm(a, l)}: walk through the positions, then play against an offense that keeps changing.`) + key(a, l);
          if (youth)
            return (l === "fr" ? `Découvrir ${nm(a, l)} en marchant, puis en jeu à vitesse réelle.` : `Learn ${nm(a, l)} at walking pace, then at game speed.`) + key(a, l);
          return (l === "fr"
            ? `Mettre en place ${nm(a, l)} : à 5 contre 0, puis contre une défense passive, puis en opposition réelle.`
            : `Install ${nm(a, l)}: 5-on-0, then against a passive defense, then live.`) + key(a, l);
        });
        break;
      case "opp":
        title = { fr: "Jeu à thème", en: "Themed game" };
        desc = both((l) => (l === "fr" ? `${nm(a, l)} en version compétitive. Règle du jour : ${rule(l)}.` : `${nm(a, l)} as a competition. Rule of the day: ${rule(l)}.`));
        break;
      case "match":
        title = youth ? { fr: "Petits matchs", en: "Small-sided games" } : { fr: "Match dirigé", en: "Controlled scrimmage" };
        desc = both((l) =>
          youth
            ? l === "fr" ? `3 contre 3 sur demi-terrain, équipes changées toutes les 3 minutes. Règle du jour : ${rule(l)}.` : `3-on-3 half court, new teams every 3 minutes. Rule of the day: ${rule(l)}.`
            : l === "fr"
              ? `5 contre 5${a ? ` en jouant ${nm(a, l)}` : ""}. Règle du jour : ${rule(l)}. Arrêter le jeu pour corriger sur le thème.`
              : `5-on-5${a ? `, running ${nm(a, l)}` : ""}. Rule of the day: ${rule(l)}. Stop play to coach the theme.`,
        );
        break;
      default:
        title = { fr: "Retour au calme", en: "Cool-down" };
        desc = both((l) =>
          s.level === "veille-de-match"
            ? l === "fr" ? "Lancers francs par deux, puis rappel des consignes du match." : "Free throws in pairs, then a reminder of the game plan."
            : l === "fr" ? `Lancers francs par deux (2 séries de 10), étirements, puis bilan de 2 minutes sur ${lower(theme.name.fr)}.` : `Free throws in pairs (2 sets of 10), stretching, then a 2-minute review of ${lower(theme.name.en)}.`,
        );
    }
    return b.ids?.length ? { min: b.min, title, desc, ids: b.ids } : { min: b.min, title, desc };
  });
  return {
    id: s.id,
    level: s.level,
    theme: s.theme,
    duration: s.duration,
    name: {
      fr: `${theme.name.fr} — ${LEVEL_NAME[s.level].fr}, ${s.duration} min (séance ${s.n})`,
      en: `${theme.name.en} — ${LEVEL_NAME[s.level].en}, ${s.duration} min (session ${s.n})`,
    },
    blocks,
  };
}
