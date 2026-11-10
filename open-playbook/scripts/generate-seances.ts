// npm run seances : écrit data/seances.json (1000 séances générées à partir des fiches).
// La génération est déterministe : relancer le script donne le même fichier tant que les fiches ne changent pas.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Library } from "../src/engine.ts";
import { generateSeances, type SeancesFile } from "../src/seances.ts";

const COUNT = 1000;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lib = JSON.parse(readFileSync(join(root, "data/tactics.json"), "utf8")) as Library;
const plans = generateSeances(lib, COUNT);
if (plans.length < COUNT) throw new Error(`seulement ${plans.length} séances distinctes (au lieu de ${COUNT})`);
const out: SeancesFile = { version: 1, plans };
// Une séance par ligne : fichier compact et diff lisible.
writeFileSync(join(root, "data/seances.json"), `{"version":1,"plans":[\n${out.plans.map((p) => JSON.stringify(p)).join(",\n")}\n]}\n`);
console.log(`✓ ${plans.length} séances écrites dans data/seances.json`);
