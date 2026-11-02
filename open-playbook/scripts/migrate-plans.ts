// Migration du format (2 nov. 2026) : `plan` (une seule séance) devient `plans` (une liste),
// et chaque séance reçoit un `id` et un `level`. Sans effet si le fichier est déjà migré.
// Usage : npx tsx scripts/migrate-plans.ts
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "data/tactics.json");
const lib = JSON.parse(readFileSync(file, "utf8"));

if (lib.plans) {
  console.log("Déjà migré : tactics.json contient « plans ».");
} else {
  const { plan, tactics, ...rest } = lib;
  const migrated = { ...rest, plans: [{ id: plan.id ?? "seance-type-90", level: "general", ...plan }], tactics };
  writeFileSync(file, JSON.stringify(migrated, null, 2) + "\n");
  console.log(`Migré : 1 séance déplacée dans « plans » (${migrated.plans[0].id}).`);
}
