// Stockage local : réglages et progrès (localStorage), voix enregistrées (IndexedDB).
// Rien ne quitte la tablette, sauf la sauvegarde que le parent télécharge lui-même.
import { newProgress } from './core.js';

const LS = 'hbibiti-';
export function load(key, def) {
  try { const v = localStorage.getItem(LS + key); return v ? JSON.parse(v) : def; } catch { return def; }
}
export function save(key, val) {
  try { localStorage.setItem(LS + key, JSON.stringify(val)); } catch { /* stockage plein ou bloqué */ }
}

export const DEFAULT_SETTINGS = {
  gm: 'Hbibiti',
  kids: [
    { id: 'ali', name: 'Ali', avatar: '👦', older: true },
    { id: 'asma', name: 'Asma', avatar: '👧', older: false },
  ],
  dialects: ['ma', 'dz'],
  arabic: false,
  sfx: true,
  music: 'perc', // 'off' | 'perc' (percussions seulement) | 'full' (percussions + mélodie)
  limit: 0,
  unlockAll: false,
};
export const settings = { ...DEFAULT_SETTINGS, ...load('settings', {}) };
export const saveSettings = () => save('settings', settings);

export const progressOf = (k) => ({ ...newProgress(), ...load('p-' + k.id, {}) });
export const saveProgressOf = (k, p) => save('p-' + k.id, p);

// --- Voix (IndexedDB) ---
const db = new Promise((resolve) => {
  try {
    const req = indexedDB.open('hbibiti', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('voices');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  } catch { resolve(null); }
});
async function idb(mode, fn) {
  const d = await db;
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const tx = d.transaction('voices', mode);
      const req = fn(tx.objectStore('voices'));
      tx.oncomplete = () => resolve(req?.result ?? null);
      tx.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}
export const getRec = (key) => idb('readonly', (s) => s.get(key));
export const putRec = (key, blob) => idb('readwrite', (s) => s.put(blob, key));
export const delRec = (key) => idb('readwrite', (s) => s.delete(key));
export const recKeys = async () => (await idb('readonly', (s) => s.getAllKeys())) || [];

const toDataURL = (blob) => new Promise((resolve) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });

// Sauvegarde complète (voix + réglages + progrès) dans un seul fichier, pour une autre tablette.
export async function exportBackup() {
  const voices = {};
  for (const k of await recKeys()) { const b = await getRec(k); if (b) voices[k] = await toDataURL(b); }
  const progress = {};
  for (const k of settings.kids) progress[k.id] = progressOf(k);
  return new Blob([JSON.stringify({ app: 'hbibiti', version: 1, settings, progress, voices })], { type: 'application/json' });
}
export async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'hbibiti') throw new Error('Ce fichier n’est pas une sauvegarde du jeu.');
  let n = 0;
  for (const [k, url] of Object.entries(data.voices || {})) {
    const blob = await (await fetch(url)).blob();
    await putRec(k, blob);
    n++;
  }
  if (data.settings) { Object.assign(settings, data.settings); saveSettings(); }
  for (const [id, p] of Object.entries(data.progress || {})) save('p-' + id, p);
  return n;
}
