import { defineConfig } from "vite";

// Chemins relatifs : le site marche sur GitHub Pages (/coachyass/) comme en local.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    target: "es2022",
    chunkSizeWarningLimit: 1500,
    // Aperçu en une seule page (npm run build:single) : polices intégrées en data URI.
    assetsInlineLimit: process.env.OP_INLINE ? 1e8 : 4096,
  },
});
