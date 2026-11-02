// npm run validate : vérifie data/tactics.json et data/catalogue_500.json.
// Sortie : une ligne par erreur, du type « horns-flare › étape 3 › x2 : hors terrain (x = 54) ».
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv from "ajv";
import type { Library } from "../src/engine.ts";
import { checkTactic } from "../src/checks.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));

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

// --- tactics.json -----------------------------------------------------------
const lib = readJson("data/tactics.json") as Library;
schemaErrors("tactics.json", validateLibrary(lib) as boolean, validateLibrary.errors, lib);

const cats = new Set(lib.cats.map((c) => c.id));
const seen = new Set<string>();
for (const t of lib.tactics) {
  if (seen.has(t.id)) err(t.id, "id en double");
  seen.add(t.id);
  if (t.name && t.keys) {
    const r = checkTactic(t, cats);
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
}
const planIds = new Set<string>();
for (const plan of lib.plans) {
  const where = `plan ${plan.id}`;
  if (planIds.has(plan.id)) err(where, "id en double");
  planIds.add(plan.id);
  for (const b of plan.blocks) {
    for (const ref of b.ids ?? []) if (!seen.has(ref)) err(`${where} › ${b.title.fr}`, `fiche inconnue « ${ref} »`);
  }
  const planMin = plan.blocks.reduce((n, b) => n + b.min, 0);
  if (planMin !== plan.duration) err(where, `les blocs durent ${planMin} min au lieu de ${plan.duration}`);
}
const familyNames = readJson("data/families.json") as Record<string, unknown>;
for (const f of new Set(lib.tactics.map((t) => t.family).filter(Boolean))) {
  if (!familyNames[f!]) err("families.json", `famille sans nom FR/EN « ${f} »`);
}
const coaching = readJson("data/coaching.json") as { against: Record<string, unknown>; practice: Record<string, unknown> };
for (const f of new Set(lib.tactics.map((t) => t.family).filter(Boolean))) {
  if (!coaching.against[f!]) err("coaching.json", `famille sans « contre quelle défense » : « ${f} »`);
}
for (const c of cats) if (!coaching.practice[c]) err("coaching.json", `catégorie sans progression d'entraînement : « ${c} »`);
// Équipes NBA : fiche existante, nom d'équipe et période FR/EN.
const nbaTeams = (readJson("data/nba.json") as { teams: Record<string, { team?: string; when?: { fr?: string; en?: string } }[]> }).teams;
for (const [id, list] of Object.entries(nbaTeams)) {
  if (!lib.tactics.some((t) => t.id === id)) err("nba.json", `fiche inconnue « ${id} »`);
  if (!Array.isArray(list) || !list.length) err(`nba.json › ${id}`, "liste d'équipes vide");
  for (const x of list ?? []) {
    if (!x.team?.trim()) err(`nba.json › ${id}`, "équipe sans nom");
    if (!x.when?.fr?.trim() || !x.when?.en?.trim()) err(`nba.json › ${id}`, `période FR/EN manquante pour ${x.team}`);
  }
}
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
  `✓ ${lib.tactics.length} fiches valides (${animated} animées), ${lib.glossary.length} termes, ${lib.plans.length} plans de séance, ${lib.cats.length} catégories${catalogueInfo}.`,
);
