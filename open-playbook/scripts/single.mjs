// Construit dist-single/index.html : une seule page sans fichier externe (JS, CSS et polices intégrés),
// pour un aperçu partageable. Usage : npm run build:single
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

execSync("npx vite build --outDir dist-single --emptyOutDir", { stdio: "inherit", env: { ...process.env, OP_INLINE: "1" } });
const dir = "dist-single/assets/";
const files = readdirSync(dir);
const js = files.filter((f) => f.endsWith(".js")).map((f) => readFileSync(dir + f, "utf8")).join("\n");
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(dir + f, "utf8")).join("\n");
const page = `<title>Playbook Ouvert</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Bibliothèque libre de tactiques de basket animées, en français et en anglais.">
<style>${css}</style>
<div id="app"><p style="padding:2rem">Chargement… · Loading…</p></div>
<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>
`;
mkdirSync("dist-single", { recursive: true });
writeFileSync("dist-single/index.html", page);
console.log(`dist-single/index.html : ${(page.length / 1e6).toFixed(2)} Mo`);
