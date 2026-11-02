// Règles de validation d'une fiche, communes à `npm run validate` et à l'éditeur du site.
import { COURT, PLAYER_IDS, SYSTEM_CATS, frames, isDefender, type PlayerId, type Point, type Tactic } from "./engine";

/** Distance minimale entre deux joueurs (pieds). */
export const MIN_GAP = 1;

export interface CheckResult {
  errors: string[];
  warnings: string[];
}

export const inBounds = ([x, y]: Point) =>
  x >= COURT.bounds.xMin && x <= COURT.bounds.xMax && y >= COURT.bounds.yMin && y <= COURT.bounds.yMax;

const fmt = (n: number) => String(Math.round(n * 100) / 100);

function checkPositions(r: CheckResult, where: string, pos: Partial<Record<PlayerId, Point>>, moved?: Set<string>) {
  const ids = Object.keys(pos) as PlayerId[];
  // Hors terrain : signalé seulement à l'étape où le joueur y va.
  for (const id of ids.filter((i) => !moved || moved.has(i))) {
    const p = pos[id]!;
    if (!inBounds(p)) r.errors.push(`${where} › ${id} : hors terrain (x = ${fmt(p[0])}, y = ${fmt(p[1])})`);
  }
  // Même endroit : signalé seulement quand l'un des deux vient de bouger (ou au départ).
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (moved && !moved.has(ids[i]) && !moved.has(ids[j])) continue;
      const a = pos[ids[i]]!, b = pos[ids[j]]!;
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (d < MIN_GAP) r.errors.push(`${where} : ${ids[i]} et ${ids[j]} au même endroit (${fmt(d)} pied d'écart)`);
    }
  }
}

const hasText = (t: unknown) =>
  !!t && typeof t === "object" && ["fr", "en"].every((l) => typeof (t as Record<string, unknown>)[l] === "string" && /\S/.test((t as Record<string, string>)[l]));

/** Structure minimale (le schéma JSON complet reste vérifié par `npm run validate`). */
export function checkShape(t: Tactic, r: CheckResult) {
  const id = t?.id || "fiche";
  if (!t || typeof t !== "object") {
    r.errors.push("le JSON doit être un objet fiche");
    return false;
  }
  if (!/^[a-z0-9-]+$/.test(t.id ?? "")) r.errors.push(`${id} : id manquant ou invalide (minuscules, chiffres et tirets)`);
  if (![1, 2, 3].includes(t.lvl)) r.errors.push(`${id} : niveau (lvl) 1, 2 ou 3`);
  for (const k of ["name", "sum", "why", "counter", "used"] as const) if (!hasText(t[k])) r.errors.push(`${id} : texte « ${k} » manquant en français ou en anglais`);
  if (!t.keys || !Array.isArray(t.keys.fr) || !Array.isArray(t.keys.en) || !t.keys.fr.length || !t.keys.en.length) r.errors.push(`${id} : points clés (keys) FR et EN obligatoires`);
  (t.steps ?? []).forEach((s, k) => {
    if (!hasText(s.c)) r.errors.push(`${id} › étape ${k + 1} : légende FR et EN obligatoire`);
  });
  return r.errors.length === 0;
}

export function checkTactic(t: Tactic, cats: Set<string>, r: CheckResult = { errors: [], warnings: [] }): CheckResult {
  const id = t.id;
  const err = (where: string, msg: string) => r.errors.push(`${where} : ${msg}`);
  if (!cats.has(t.cat)) err(id, `catégorie inconnue « ${t.cat} »`);
  if (t.keys.fr.length !== t.keys.en.length) r.warnings.push(`${id} : ${t.keys.fr.length} points clés FR pour ${t.keys.en.length} EN`);
  if (t.variants && t.variants.fr.length !== t.variants.en.length) r.warnings.push(`${id} : variantes FR et EN en nombre différent`);
  // Objectif du projet : toutes les fiches sont animées.
  if (!t.start || !t.steps?.length) {
    err(id, "fiche non animée (placement de départ et étapes obligatoires)");
    return r;
  }
  const s = t.start;
  if (s.b !== undefined && !s[s.b as PlayerId]) err(id, `le porteur du ballon « ${s.b} » n'est pas sur le terrain`);
  if (SYSTEM_CATS.includes(t.cat) && t.steps.length < 2) err(id, `un système doit avoir au moins 2 étapes (${t.steps.length})`);
  checkPositions(r, `${id} › départ`, Object.fromEntries(PLAYER_IDS.filter((p) => s[p]).map((p) => [p, s[p]])));

  const states = frames(t);
  t.steps.forEach((step, k) => {
    const where = `${id} › étape ${k + 1}`;
    const before = states[k];
    for (const [pid, mv] of Object.entries(step.m ?? {})) {
      if (!before.pos[pid as PlayerId]) err(where, `${pid} se déplace mais n'est pas dans le placement de départ`);
      const type = mv[2];
      if (type === "m" && !isDefender(pid)) r.warnings.push(`${where} : ${pid} (attaquant) utilise le type « m » réservé à la défense`);
      if (type !== "m" && isDefender(pid)) err(where, `${pid} (défenseur) doit utiliser le type « m »`);
      if (type === "d" && before.ball !== pid) err(where, `${pid} dribble sans avoir le ballon`);
    }
    if (step.p !== undefined) {
      if (!before.pos[step.p as PlayerId]) err(where, `le receveur de la passe « ${step.p} » n'existe pas`);
      else if (!before.ball) err(where, "passe sans porteur du ballon (ajoute « b » au départ)");
      else if (before.ball === step.p) err(where, `${step.p} se passe le ballon à lui-même`);
    }
    checkPositions(r, where, states[k + 1].pos, new Set(Object.keys(step.m ?? {})));
  });
  return r;
}
