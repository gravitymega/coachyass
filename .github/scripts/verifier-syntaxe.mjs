// Vérifie la syntaxe de tous les scripts du dépôt (tous les sites), sans rien installer :
// .js / .mjs / .cjs avec `node --check`, .ts / .mts après retrait des types (module.stripTypeScriptTypes),
// et les fichiers .json avec JSON.parse. Lancé par .github/workflows/node.js.yml à chaque PR.
// Usage : node .github/scripts/verifier-syntaxe.mjs [dossier]
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';

const root = process.argv[2] || '.';
// Dossiers à ne pas lire : dépendances, copies de bibliothèques, sorties de build, fichiers privés.
const SKIP = new Set(['.git', 'node_modules', 'vendor', 'dist', '.netlify', '.wrangler', 'documentaire', 'voix-locale']);
const tmp = mkdtempSync(join(tmpdir(), 'syntaxe-'));
const errors = [];
let count = 0;

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile()) check(p);
  }
}

function nodeCheck(file) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

function check(file) {
  const ext = extname(file);
  const rel = relative(root, file);
  try {
    if (['.js', '.mjs', '.cjs'].includes(ext)) {
      if (/\.min\.js$/.test(file)) return;
      nodeCheck(file);
    } else if (['.ts', '.mts'].includes(ext)) {
      if (file.endsWith('.d.ts')) return;
      const code = readFileSync(file, 'utf8');
      let js;
      try { js = stripTypeScriptTypes(code); } catch { js = stripTypeScriptTypes(code, { mode: 'transform' }); }
      const out = join(tmp, `f${count}.mjs`);
      writeFileSync(out, js);
      nodeCheck(out);
    } else if (ext === '.json') {
      JSON.parse(readFileSync(file, 'utf8'));
    } else return;
    count++;
  } catch (err) {
    const msg = String((err.stderr && err.stderr.toString()) || err.message).split('\n').filter(Boolean).slice(0, 6).join('\n  ');
    errors.push(`${rel}\n  ${msg}`);
  }
}

walk(root);
rmSync(tmp, { recursive: true, force: true });
if (errors.length) {
  console.error(`${errors.length} fichier(s) avec une erreur de syntaxe :\n\n${errors.join('\n\n')}`);
  process.exit(1);
}
console.log(`Syntaxe OK : ${count} fichiers vérifiés.`);
