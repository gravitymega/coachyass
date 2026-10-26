// Construction pour Cloudflare Pages : copie le site statique dans dist/ (sans node_modules,
// fonctions serveur ni fichiers de configuration). Les fonctions de functions/ sont
// assemblées à part par Cloudflare, avec les dépendances installées par npm.
import { cpSync, rmSync, readdirSync } from 'node:fs';

const SKIP = new Set(['dist', 'node_modules', 'functions', 'netlify', 'scripts', 'worker', 'package.json', 'package-lock.json', 'netlify.toml', 'wrangler.toml']);
rmSync('dist', { recursive: true, force: true });
for (const name of readdirSync('.')) {
  if (SKIP.has(name) || name.startsWith('.')) continue;
  cpSync(name, `dist/${name}`, { recursive: true });
}
console.log('dist/ prêt');
