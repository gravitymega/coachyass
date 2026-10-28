import { defineConfig } from "vite";

// Chemins relatifs : le site marche sur GitHub Pages (/coachyass/) comme en local.
export default defineConfig({
  base: "./",
  build: { outDir: "dist", target: "es2022" },
});
