// Migration du 2 nov. 2026 : un défenseur face à chaque attaquant dans les situations de jeu.
// npx tsx scripts/add-defenders.ts          (écrit data/tactics.json)
// npx tsx scripts/add-defenders.ts --dry    (affiche seulement le nombre de fiches touchées)
//
// Règles (choix de l'utilisateur : « situations de jeu ») :
// - catégories attaque, attaque de zone, remises en jeu, transition, défense, principes ; pas les exercices ;
// - contre-attaques et fiches de transition qui ont déjà des défenseurs : surnombre voulu, on n'y touche pas ;
// - on n'ajoute « xN » que si l'attaquant N existe, que xN manque et qu'il y a moins de défenseurs que d'attaquants ;
// - placement homme à homme : entre l'attaquant et le panier (3 pieds), décalé vers le ballon pour les joueurs sans ballon ;
// - à chaque étape où quelqu'un bouge, le défenseur ajouté suit son joueur (déplacement « m ») ;
//   une étape qui n'est qu'une passe ne reçoit pas de déplacement (le défenseur suit à l'étape suivante, timing inchangé) ;
// - les défenseurs déjà écrits à la main ne changent pas ; les fiches modifiées repassent en review « pending ».
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Library, Move, Point, Tactic } from "../src/engine.ts";

type Step = NonNullable<Tactic["steps"]>[number];

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "data/tactics.json");
const lib = JSON.parse(readFileSync(file, "utf8")) as Library;
const dry = process.argv.includes("--dry");

const CATS = new Set(["attaque", "zone_att", "remises", "transition", "defense", "principes"]);
const ATT = ["1", "2", "3", "4", "5"] as const;
const BASKET: Point = [25, 5.25];
const GAP = 1.6;

const r1 = (n: number) => Math.round(n * 10) / 10;
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function inside([x, y]: Point, full: boolean): Point {
  return [Math.min(49.5, Math.max(0.5, x)), Math.min(full ? 93.5 : 46.5, Math.max(0.5, y))];
}

/** Place du défenseur de l'attaquant `a` : vers le panier, et vers le ballon s'il ne l'a pas. */
function spot(a: Point, ball: Point | undefined, hasBall: boolean, full: boolean): Point {
  const dx = BASKET[0] - a[0], dy = BASKET[1] - a[1];
  const d = Math.hypot(dx, dy) || 1;
  const k = Math.min(3, d * 0.5);
  let x = a[0] + (dx / d) * k, y = a[1] + (dy / d) * k;
  if (!hasBall && ball) {
    const bx = ball[0] - a[0], by = ball[1] - a[1];
    const bd = Math.hypot(bx, by);
    const sag = Math.min(5, bd * 0.25);
    if (bd > 0.1) {
      x += (bx / bd) * sag;
      y += (by / bd) * sag;
    }
  }
  return inside([x, y], full);
}

/** Écarte le point des autres joueurs (au moins GAP pieds). */
function free(p: Point, others: Point[], full: boolean): Point {
  let q: Point = [p[0], p[1]];
  for (let n = 0; n < 24; n++) {
    const hit = others.find((o) => dist(o, q) < GAP);
    if (!hit) break;
    const ang = (n * 137.5 * Math.PI) / 180;
    const rad = GAP * (1 + n / 6);
    q = inside([p[0] + Math.cos(ang) * rad, p[1] + Math.sin(ang) * rad], full);
  }
  return [r1(q[0]), r1(q[1])];
}

function wanted(t: Tactic): string[] {
  if (!CATS.has(t.cat) || !t.start || !t.steps?.length) return [];
  const s = t.start as Record<string, unknown>;
  const attackers = ATT.filter((a) => s[a]);
  const defenders = Object.keys(s).filter((k) => /^x[1-5]$/.test(k));
  if (t.family === "contre-attaque" || (t.cat === "transition" && defenders.length)) return [];
  if (defenders.length >= attackers.length) return [];
  return attackers.filter((a) => !s[`x${a}`]);
}

let touched = 0, added = 0;
for (const t of lib.tactics) {
  const missing = wanted(t);
  if (!missing.length) continue;
  const full = t.court === "full";
  const start = t.start as Record<string, Point | string>;
  const pos: Record<string, Point> = {};
  for (const [k, v] of Object.entries(start)) if (Array.isArray(v)) pos[k] = [v[0], v[1]];
  let ball = start.b as string | undefined;

  const place = (a: string) => {
    const others = Object.entries(pos).filter(([k]) => k !== `x${a}`).map(([, p]) => p);
    return free(spot(pos[a], ball ? pos[ball] : undefined, ball === a, full), others, full);
  };
  for (const a of missing) {
    const p = place(a);
    pos[`x${a}`] = p;
    start[`x${a}`] = p;
  }
  for (const step of t.steps!) {
    const moves = (step.m ?? {}) as Record<string, Move>;
    for (const [k, mv] of Object.entries(moves)) pos[k] = [mv[0], mv[1]];
    if (Object.keys(moves).length) {
      for (const a of missing) {
        const p = place(a);
        if (dist(p, pos[`x${a}`]) > 0.6) {
          moves[`x${a}`] = [p[0], p[1], "m"];
          pos[`x${a}`] = p;
        }
      }
      step.m = moves as Step["m"];
    }
    if (step.p) ball = step.p;
  }
  t.review = "pending";
  touched++;
  added += missing.length;
}

console.log(`${touched} fiches, ${added} défenseurs ajoutés${dry ? " (essai, rien d'écrit)" : ""}`);
if (!dry) writeFileSync(file, JSON.stringify(lib, null, 2) + "\n");
