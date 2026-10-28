// npm run validate : vérifie data/tactics.json et data/catalogue_500.json.
// Sortie : une ligne par erreur, du type « horns-flare › étape 3 › x2 : hors terrain (x = 54) ».
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv from "ajv";
import {
  COURT,
  PLAYER_IDS,
  SYSTEM_CATS,
  frames,
  isDefender,
  type Library,
  type PlayerId,
  type Point,
  type Tactic,
} from "../src/engine.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));

/** Distance minimale entre deux joueurs (pieds). */
const MIN_GAP = 1;

const errors: string[] = [];
const warnings: string[] = [];
const err = (where: string, msg: string) => errors.push(`${where} : ${msg}`);

const ajv = new Ajv({ allErrors: true, strict: false });
ajv.addSchema(readJson("schema/tactic.schema.json"));
const validateLibrary = ajv.compile(readJson("schema/library.schema.json"));
const validateCatalogue = ajv.compile(readJson("schema/catalogue.schema.json"));

function schemaErrors(file: string, ok: boolean, list: typeof validateLibrary.errors, data: unknown) {
  if (ok || !list) return;
  for (const e of list) {
    // Retrouve l'id de la fiche concernée pour un message lisible.
    const m = e.instancePath.match(/^\/(?:tactics\/)?(\d+)/);
    const arr = Array.isArray(data) ? data : (data as Library).tactics;
    const id = m && arr?.[Number(m[1])]?.id;
    err(id ? `${file} › ${id}` : file, `${e.instancePath || "/"} ${e.message}`);
  }
}

const inBounds = ([x, y]: Point) =>
  x >= COURT.bounds.xMin && x <= COURT.bounds.xMax && y >= COURT.bounds.yMin && y <= COURT.bounds.yMax;

const fmt = (n: number) => String(Math.round(n * 100) / 100);

function checkPositions(where: string, pos: Partial<Record<PlayerId, Point>>, moved?: Set<string>) {
  const ids = Object.keys(pos) as PlayerId[];
  // Hors terrain : signalé seulement à l'étape où le joueur y va.
  for (const id of ids.filter((i) => !moved || moved.has(i))) {
    const p = pos[id]!;
    if (!inBounds(p)) err(`${where} › ${id}`, `hors terrain (x = ${fmt(p[0])}, y = ${fmt(p[1])})`);
  }
  // Même endroit : signalé seulement quand l'un des deux vient de bouger (ou au départ).
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (moved && !moved.has(ids[i]) && !moved.has(ids[j])) continue;
      const a = pos[ids[i]]!;
      const b = pos[ids[j]]!;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d < MIN_GAP) err(where, `${ids[i]} et ${ids[j]} au même endroit (${fmt(d)} pied d'écart)`);
    }
  }
}

function checkTactic(t: Tactic, cats: Set<string>) {
  const id = t.id;
  if (!cats.has(t.cat)) err(id, `catégorie inconnue « ${t.cat} »`);
  if (t.keys.fr.length !== t.keys.en.length) warnings.push(`${id} : ${t.keys.fr.length} points clés FR pour ${t.keys.en.length} EN`);
  if (t.variants && t.variants.fr.length !== t.variants.en.length) warnings.push(`${id} : variantes FR et EN en nombre différent`);
  // Objectif du projet : toutes les fiches sont animées.
  if (!t.start || !t.steps?.length) {
    err(id, "fiche non animée (placement de départ et étapes obligatoires)");
    return;
  }
  const s = t.start;
  if (s.b !== undefined && !s[s.b as PlayerId]) err(id, `le porteur du ballon « ${s.b} » n'est pas sur le terrain`);
  if (SYSTEM_CATS.includes(t.cat) && t.steps.length < 2) {
    err(id, `un système doit avoir au moins 2 étapes (${t.steps.length})`);
  }
  checkPositions(`${id} › départ`, Object.fromEntries(PLAYER_IDS.filter((p) => s[p]).map((p) => [p, s[p]])));

  const states = frames(t);
  (t.steps ?? []).forEach((step, k) => {
    const where = `${id} › étape ${k + 1}`;
    const before = states[k];
    for (const [pid, mv] of Object.entries(step.m ?? {})) {
      if (!before.pos[pid as PlayerId]) err(where, `${pid} se déplace mais n'est pas dans le placement de départ`);
      const type = mv[2];
      if (type === "m" && !isDefender(pid)) warnings.push(`${where} : ${pid} (attaquant) utilise le type « m » réservé à la défense`);
      if (type !== "m" && isDefender(pid)) err(where, `${pid} (défenseur) doit utiliser le type « m »`);
      if (type === "d" && before.ball !== pid) err(where, `${pid} dribble sans avoir le ballon`);
    }
    if (step.p !== undefined) {
      if (!before.pos[step.p as PlayerId]) err(where, `le receveur de la passe « ${step.p} » n'existe pas`);
      else if (!before.ball) err(where, "passe sans porteur du ballon (ajoute « b » au départ)");
      else if (before.ball === step.p) err(where, `${step.p} se passe le ballon à lui-même`);
    }
    checkPositions(where, states[k + 1].pos, new Set(Object.keys(step.m ?? {})));
  });
}

// --- tactics.json -----------------------------------------------------------
const lib = readJson("data/tactics.json") as Library;
schemaErrors("tactics.json", validateLibrary(lib) as boolean, validateLibrary.errors, lib);

const cats = new Set(lib.cats.map((c) => c.id));
const seen = new Set<string>();
for (const t of lib.tactics) {
  if (seen.has(t.id)) err(t.id, "id en double");
  seen.add(t.id);
  if (t.name && t.keys) checkTactic(t, cats);
}
for (const b of lib.plan.blocks) {
  for (const ref of b.ids ?? []) if (!seen.has(ref)) err(`séance type › ${b.title.fr}`, `fiche inconnue « ${ref} »`);
}
const planMin = lib.plan.blocks.reduce((n, b) => n + b.min, 0);
if (planMin !== lib.plan.duration) err("séance type", `les blocs durent ${planMin} min au lieu de ${lib.plan.duration}`);
const terms = new Set<string>();
for (const g of lib.glossary) {
  if (terms.has(g[0])) err("glossaire", `terme en double « ${g[0]} »`);
  terms.add(g[0]);
}

// --- catalogue_500.json -----------------------------------------------------
let catalogueInfo = "";
if (existsSync(join(root, "data/catalogue_500.json"))) {
  const cat = readJson("data/catalogue_500.json") as { id: string; cat: string; status: string }[];
  schemaErrors("catalogue_500.json", validateCatalogue(cat) as boolean, validateCatalogue.errors, cat);
  const ids = new Set<string>();
  for (const e of cat) {
    const where = `catalogue › ${e.id}`;
    if (ids.has(e.id)) err(where, "id en double");
    ids.add(e.id);
    if (!cats.has(e.cat)) err(where, `catégorie inconnue « ${e.cat} »`);
    if (e.status === "done" && !seen.has(e.id)) err(where, "marquée « done » mais absente de tactics.json");
    if (e.status === "todo" && seen.has(e.id)) warnings.push(`${where} : la fiche existe déjà, passe-la en « done »`);
  }
  const done = cat.filter((e) => e.status === "done").length;
  catalogueInfo = `, catalogue ${done}/${cat.length} terminées`;
}

// --- Bilan ------------------------------------------------------------------
const animated = lib.tactics.filter((t) => t.steps?.length).length;
for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} erreur(s) / error(s).`);
  process.exit(1);
}
console.log(
  `✓ ${lib.tactics.length} fiches valides (${animated} animées), ${lib.glossary.length} termes, ${lib.cats.length} catégories${catalogueInfo}.`,
);
