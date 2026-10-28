// Moteur commun au site, à l'éditeur et au validateur.
// La timeline est la même que celle de render.py : data/timeline.json.
import timelineJson from "../data/timeline.json";

export type Lang = "fr" | "en";
export type Text = Record<Lang, string>;
export type Point = [number, number];
export type MoveType = "c" | "d" | "s" | "m";
export type Move = [number, number, MoveType];
export type PlayerId = "1" | "2" | "3" | "4" | "5" | "x1" | "x2" | "x3" | "x4" | "x5";
export type Age = "U11" | "U13" | "U15" | "U17" | "seniors" | "pro";

export interface Step {
  m?: Partial<Record<PlayerId, Move>>;
  p?: string;
  c: Text;
}

export interface Start extends Partial<Record<PlayerId, Point>> {
  b?: string;
}

export interface Tactic {
  id: string;
  cat: string;
  family?: string;
  lvl: 1 | 2 | 3;
  review?: "pending" | "approved";
  name: Text;
  sum: Text;
  why: Text;
  counter: Text;
  used: Text;
  keys: Record<Lang, string[]>;
  start?: Start;
  steps?: Step[];
  // Exercices
  duration?: number;
  equipment?: Text;
  players?: string;
  age?: Age[];
  variants?: Record<Lang, string[]>;
}

export interface Category {
  id: string;
  fr: string;
  en: string;
}

/** [terme fr, terme en, définition fr, définition en] */
export type GlossaryEntry = [string, string, string, string];

export interface PlanBlock {
  min: number;
  title: Text;
  desc: Text;
  ids?: string[];
}

export interface Plan {
  id?: string;
  name: Text;
  duration: number;
  blocks: PlanBlock[];
}

export interface Library {
  cats: Category[];
  glossary: GlossaryEntry[];
  plan: Plan;
  tactics: Tactic[];
}

export const PLAYER_IDS: PlayerId[] = ["1", "2", "3", "4", "5", "x1", "x2", "x3", "x4", "x5"];

/** Catégories où une fiche dessinée est un « système » (au moins 2 étapes). */
export const SYSTEM_CATS = ["attaque", "zone_att", "transition", "remises", "defense"];

// Terrain (pieds) : ligne de fond en haut, panier en (25, 5.25).
export const COURT = {
  width: 50,
  depth: 47,
  basket: [25, 5.25] as Point,
  bounds: { xMin: -3, xMax: 53, yMin: -5, yMax: 47 },
};

export const COLORS = {
  offense: "#1F5FD1",
  defense: "#D7263D",
  ball: "#F08A24",
  court: "#E9C89B",
  plank: "#DDB886",
  paint: "#C98E5A",
};

export const TIMELINE = timelineJson as {
  move: number;
  pass: number;
  readMin: number;
  readPerWord: number;
};

export const isDefender = (id: string) => id.startsWith("x");

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

/** Temps de lecture : le plus grand de 2,2 s et 0,13 s × mots FR+EN. */
export function readTime(c?: Text): number {
  if (!c) return TIMELINE.readMin;
  return Math.max(TIMELINE.readMin, TIMELINE.readPerWord * (words(c.fr) + words(c.en)));
}

export interface StepTiming {
  start: number;
  move: number;
  pass: number;
  read: number;
  end: number;
}

export function stepTimings(steps: Step[]): StepTiming[] {
  let t = 0;
  return steps.map((s) => {
    const move = s.m && Object.keys(s.m).length ? TIMELINE.move : 0;
    const pass = s.p ? TIMELINE.pass : 0;
    const read = readTime(s.c);
    const timing = { start: t, move, pass, read, end: t + move + pass + read };
    t = timing.end;
    return timing;
  });
}

export const totalDuration = (t: Tactic) => {
  const tm = stepTimings(t.steps ?? []);
  return tm.length ? tm[tm.length - 1].end : 0;
};

export interface BoardState {
  pos: Partial<Record<PlayerId, Point>>;
  ball?: string;
}

/** États figés : index 0 = départ, index k = après l'étape k. */
export function frames(t: Tactic): BoardState[] {
  if (!t.start) return [];
  const pos: Partial<Record<PlayerId, Point>> = {};
  for (const id of PLAYER_IDS) {
    const p = t.start[id];
    if (p) pos[id] = [p[0], p[1]];
  }
  let ball = t.start.b;
  const out: BoardState[] = [{ pos: { ...pos }, ball }];
  for (const s of t.steps ?? []) {
    for (const [id, mv] of Object.entries(s.m ?? {}) as [PlayerId, Move][]) {
      pos[id] = [mv[0], mv[1]];
    }
    if (s.p) ball = s.p;
    out.push({ pos: { ...pos }, ball });
  }
  return out;
}

/** Pour la recherche : minuscules, sans accents. */
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
