// npm run audio:jobs : liste des clips audio à générer (un par segment de narration et par langue).
// Sortie : audio-jobs.json [{ lang, text, path }], lu par scripts/tts.py.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Lang, Library, Text } from "../src/engine.ts";
import { clipPath, narrationSegments, type NbaTeam } from "../src/narration.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => JSON.parse(readFileSync(join(root, p), "utf8"));
const lib = read("data/tactics.json") as Library;
const coaching = read("data/coaching.json") as { against: Record<string, Text> };
const nba = (read("data/nba.json") as { teams: Record<string, NbaTeam[]> }).teams;

const jobs = new Map<string, { lang: Lang; text: string; path: string }>();
for (const t of lib.tactics) {
  if (!t.steps?.length) continue;
  for (const lang of ["fr", "en"] as Lang[]) {
    for (const text of narrationSegments(t, lang, t.family ? coaching.against[t.family] : undefined, nba[t.id])) {
      const path = await clipPath(text, lang);
      jobs.set(path, { lang, text, path });
    }
  }
}
const out = join(root, "audio-jobs.json");
writeFileSync(out, JSON.stringify([...jobs.values()], null, 1));
const words = [...jobs.values()].reduce((n, j) => n + j.text.split(/\s+/).length, 0);
console.log(`${jobs.size} clips, ${words} mots → ${out}`);
