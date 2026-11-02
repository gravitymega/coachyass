// Site Playbook Ouvert : bibliothèque, fiche animée (#id), mode vidéo (#video-id), glossaire, plan de séance.
import "@fontsource/barlow/latin-400.css";
import "@fontsource/barlow/latin-600.css";
import "@fontsource/barlow-condensed/latin-600.css";
import "@fontsource/barlow-condensed/latin-700.css";
import "./style.css";
import library from "../data/tactics.json";
import familiesJson from "../data/families.json";
import { Board } from "./board";
import type { Board3D } from "./board3d";
import { Editor } from "./editor";
import coachingJson from "../data/coaching.json";
import { normalize, shotKind, type Lang, type Library, type ShotKind, type Tactic, type Text } from "./engine";
import nbaJson from "../data/nba.json";
import reelsJson from "../data/reels.json";
import { clipPath, narrationSegments, type NbaTeam } from "./narration";
import { clipsAvailable, playClip, speak, stopSpeaking } from "./voice";

const lib = library as Library;
const families = familiesJson as Record<string, Text>;
const coaching = coachingJson as { against: Record<string, Text>; practice: Record<string, Record<Lang, string[]>> };
const nba = (nbaJson as { teams: Record<string, NbaTeam[]> }).teams;
const byId = new Map(lib.tactics.map((t) => [t.id, t]));
// Vidéos MP4 publiées en « releases » GitHub (workflow open-playbook-videos.yml), une release par format.
const VIDEO_BASE = "https://github.com/gravitymega/coachyass/releases/download/op-videos-";
const FORMATS: [string, Text][] = [
  ["vertical", { fr: "Verticale 9:16", en: "Vertical 9:16" }],
  ["square", { fr: "Carrée 1:1", en: "Square 1:1" }],
  ["horizontal", { fr: "Horizontale 16:9", en: "Landscape 16:9" }],
];
const videoUrl = (id: string, f: string) => `${VIDEO_BASE}${f}/${id}-${f}.mp4`;
const coverUrl = (id: string, f = "vertical") => `${VIDEO_BASE}${f}/${id}-${f}.png`;
const CHANNEL = "Playbook Ouvert · Open Playbook";
const PAGE = 48;

// ---------------------------------------------------------------- préférences
const store = {
  get(k: string) {
    try {
      return localStorage.getItem("op-" + k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem("op-" + k, v);
    } catch {
      /* stockage indisponible : on garde l'état en mémoire */
    }
  },
};

const state = {
  lang: (store.get("lang") === "en" ? "en" : "fr") as Lang,
  theme: store.get("theme") ?? "auto",
  pending: store.get("pending") !== "0",
  view3d: store.get("view3d") === "1",
  sound: store.get("sound") !== "0",
  nba: false,
  q: "",
  cat: "",
  family: "",
  lvl: "",
  shown: PAGE,
};
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const other = (l: Lang): Lang => (l === "fr" ? "en" : "fr");
const tr = (fr: string, en: string) => (state.lang === "fr" ? fr : en);
const txt = (t: Text | undefined) => (t ? t[state.lang] : "");
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const catName = (id: string) => {
  const c = lib.cats.find((x) => x.id === id);
  return c ? c[state.lang] : id;
};
const famName = (id?: string) => (id && families[id] ? families[id][state.lang] : id ?? "");
const LEVELS: Record<number, Text> = {
  1: { fr: "Débutant", en: "Beginner" },
  2: { fr: "Intermédiaire", en: "Intermediate" },
  3: { fr: "Avancé", en: "Advanced" },
};

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === "auto") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", state.theme);
  root.lang = state.lang;
}

// --------------------------------------------------------------------- shell
const app = document.querySelector<HTMLElement>("#app")!;
let board: Board | null = null;
let board3d: Board3D | null = null;
let editor: Editor | null = null;
let montage: { destroy(): void } | null = null;
let heroBoard: Board | null = null;
let hero3d: Board3D | null = null;
let cleanup: (() => void) | null = null;

function header(active: string) {
  const nav = [
    ["", tr("Bibliothèque", "Library")],
    ["glossaire", tr("Glossaire", "Glossary")],
    ["plans", tr("Plans de séance", "Session plans")],
    ["videos", tr("Vidéos", "Videos")],
    ["editeur", tr("Éditeur", "Editor")],
  ];
  const themeLabel = { auto: tr("Thème : auto", "Theme: auto"), light: tr("Thème : clair", "Theme: light"), dark: tr("Thème : sombre", "Theme: dark") }[state.theme];
  return `
  <header class="top">
    <div class="wrap top-row">
      <a class="brand" href="#"><span class="brand-mark" aria-hidden="true"></span><span>Playbook Ouvert<small>Open Playbook</small></span></a>
      <nav aria-label="${tr("Navigation principale", "Main navigation")}">
        ${nav.map(([h, l]) => `<a href="#${h}"${active === h ? ' aria-current="page"' : ""}>${l}</a>`).join("")}
      </nav>
      <div class="prefs">
        <button type="button" id="lang-btn" class="chip" aria-label="${tr("Changer de langue : passer en anglais", "Change language: switch to French")}">${state.lang === "fr" ? "FR · <span>EN</span>" : "EN · <span>FR</span>"}</button>
        <button type="button" id="theme-btn" class="chip">${themeLabel}</button>
      </div>
    </div>
  </header>`;
}

function bindHeader() {
  document.getElementById("lang-btn")?.addEventListener("click", () => {
    state.lang = other(state.lang);
    store.set("lang", state.lang);
    applyTheme();
    route();
  });
  document.getElementById("theme-btn")?.addEventListener("click", () => {
    state.theme = { auto: "light", light: "dark", dark: "auto" }[state.theme] ?? "auto";
    store.set("theme", state.theme);
    applyTheme();
    route();
  });
}

const footer = () => `
  <footer class="foot"><div class="wrap">
    <p>${tr(
      "Bibliothèque libre : code sous licence MIT, contenu sous licence CC BY 4.0. Les fiches marquées « à relire » attendent la relecture d'un entraîneur.",
      "Free library: code under the MIT licence, content under CC BY 4.0. Cards marked “awaiting review” have not yet been checked by a coach.",
    )}</p>
  </div></footer>`;

// --------------------------------------------------------------- bibliothèque
function filtered(): Tactic[] {
  const q = normalize(state.q.trim());
  return lib.tactics.filter((t) => {
    if (!state.pending && t.review === "pending") return false;
    if (state.cat && t.cat !== state.cat) return false;
    if (state.family && t.family !== state.family) return false;
    if (state.lvl && String(t.lvl) !== state.lvl) return false;
    if (state.nba && !nba[t.id]) return false;
    if (!q) return true;
    const hay = normalize([t.name.fr, t.name.en, t.sum.fr, t.sum.en, famName(t.family), t.id, ...(nba[t.id] ?? []).map((x) => x.team)].join(" "));
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
}

function card(t: Tactic) {
  const n = t.steps?.length ?? 0;
  return `<li><a class="card" href="#${t.id}">
    <span class="card-meta">${esc(catName(t.cat))} · ${esc(famName(t.family))}</span>
    <strong>${esc(txt(t.name))}</strong>
    <span class="card-alt" lang="${other(state.lang)}">${esc(t.name[other(state.lang)])}</span>
    <span class="card-foot"><span class="lvl lvl-${t.lvl}" title="${txt(LEVELS[t.lvl])}">${"●".repeat(t.lvl)}${"○".repeat(3 - t.lvl)}<span class="sr">${txt(LEVELS[t.lvl])}</span></span><span>${n} ${tr(n > 1 ? "étapes" : "étape", n > 1 ? "steps" : "step")}</span>${nba[t.id] ? `<span class="tag-nba">NBA</span>` : ""}${t.review === "pending" ? `<span class="tag-pending">${tr("À relire", "Awaiting review")}</span>` : ""}</span>
  </a></li>`;
}

const FEATURED = ["horns-flare", "spain-pick-and-roll", "pick-and-roll-central", "floppy", "hammer", "fast-break-3-lanes", "princeton-backdoor"];

function heroHtml(t: Tactic) {
  return `<section class="hero" aria-label="${tr("Tactique à la une", "Featured play")}">
    <div class="hero-text">
      <h1>${tr("Tactiques de basket, dessinées et animées", "Basketball plays, drawn and animated")}</h1>
      <p>${tr(
        `${lib.tactics.length} fiches libres : systèmes, défenses, remises en jeu, exercices et principes. Chaque fiche s'anime étape par étape, en 2D ou en 3D, avec une explication audio en français ou en anglais.`,
        `${lib.tactics.length} free cards: sets, defenses, inbounds, drills and principles. Every card animates step by step, in 2D or 3D, with an audio explanation in French or English.`,
      )}</p>
      <p class="hero-feat"><span class="card-meta">${tr("À la une", "Featured")} · ${esc(catName(t.cat))}</span><strong>${esc(txt(t.name))}</strong><span class="hero-cap" id="hero-cap" aria-live="off"></span></p>
      <p class="hero-actions"><a class="btn" href="#${t.id}">${tr("Ouvrir la fiche", "Open the card")}</a><a class="chip hero-chip" href="#video-${t.id}">${tr("Mode vidéo", "Video mode")}</a></p>
    </div>
    <div class="hero-stage">
      <div id="hero-3d" class="hero-3d"></div>
      <div id="hero-2d" class="board-host" hidden></div>
      <p class="hint3d">${tr("Vue 3D (three.js) : glisse pour tourner autour du terrain.", "3D view (three.js): drag to orbit the court.")}</p>
    </div>
  </section>`;
}

function startHero(t: Tactic) {
  const h2 = document.getElementById("hero-2d")!, h3 = document.getElementById("hero-3d")!;
  const cap = document.getElementById("hero-cap")!;
  heroBoard = new Board(h2, t, { onStep: (k) => (cap.textContent = captionFor(t, k).main) }, txt(t.name));
  heroBoard.loop = true;
  const hb = heroBoard;
  const reduce = reduceMotion();
  const fallback = () => {
    h3.hidden = true;
    h2.hidden = false;
  };
  import("./board3d")
    .then(({ Board3D }) => {
      if (heroBoard !== hb) return;
      hero3d = new Board3D(h3, hb, Object.keys(t.start ?? {}).filter((k) => k !== "b"), { autoRotate: !reduce });
    })
    .catch(fallback);
  window.setTimeout(() => heroBoard === hb && (reduce ? hb.playStatic() : hb.play()), 900);
}

function libraryView() {
  const today = Math.floor(Date.now() / 86400000);
  const featured = byId.get(FEATURED[today % FEATURED.length]) ?? lib.tactics[0];
  app.innerHTML = `${header("")}
  <main class="wrap" id="main">
    ${heroHtml(featured)}
    <form class="filters" id="filters" role="search">
      <label class="f-search"><span>${tr("Rechercher", "Search")}</span>
        <input id="f-q" type="search" value="${esc(state.q)}" placeholder="${tr("ex. horns, zone 2-3, Spurs…", "e.g. horns, 2-3 zone, Spurs…")}" autocomplete="off" /></label>
      <label><span>${tr("Catégorie", "Category")}</span>
        <select id="f-cat"><option value="">${tr("Toutes", "All")}</option>${lib.cats.map((c) => `<option value="${c.id}"${state.cat === c.id ? " selected" : ""}>${esc(c[state.lang])}</option>`).join("")}</select></label>
      <label><span>${tr("Famille", "Family")}</span><select id="f-family"></select></label>
      <label><span>${tr("Niveau", "Level")}</span>
        <select id="f-lvl"><option value="">${tr("Tous", "All")}</option>${[1, 2, 3].map((l) => `<option value="${l}"${state.lvl === String(l) ? " selected" : ""}>${txt(LEVELS[l])}</option>`).join("")}</select></label>
      <label class="f-check"><input id="f-pending" type="checkbox"${state.pending ? " checked" : ""} /> <span>${tr("Inclure les fiches à relire", "Include cards awaiting review")}</span></label>
      <label class="f-check"><input id="f-nba" type="checkbox"${state.nba ? " checked" : ""} /> <span>${tr("Utilisées en NBA", "Used in the NBA")}</span></label>
    </form>
    <div id="results"></div>
  </main>${footer()}`;
  bindHeader();
  startHero(featured);
  renderResults();
  document.getElementById("f-q")!.addEventListener("input", (e) => {
    state.q = (e.target as HTMLInputElement).value;
    state.shown = PAGE;
    renderResults();
  });
  const bindSelect = (id: string, key: "cat" | "family" | "lvl") =>
    document.getElementById(id)!.addEventListener("change", (e) => {
      state[key] = (e.target as HTMLSelectElement).value;
      state.shown = PAGE;
      renderResults();
    });
  bindSelect("f-cat", "cat");
  bindSelect("f-family", "family");
  bindSelect("f-lvl", "lvl");
  document.getElementById("f-pending")!.addEventListener("change", (e) => {
    state.pending = (e.target as HTMLInputElement).checked;
    store.set("pending", state.pending ? "1" : "0");
    renderResults();
  });
  document.getElementById("f-nba")!.addEventListener("change", (e) => {
    state.nba = (e.target as HTMLInputElement).checked;
    state.shown = PAGE;
    renderResults();
  });
  document.getElementById("filters")!.addEventListener("submit", (e) => e.preventDefault());
  document.getElementById("results")!.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id !== "more") return;
    state.shown += PAGE;
    renderResults();
    document.getElementById("more")?.focus();
  });
}

/** Met à jour la liste et le filtre « famille » sans toucher au reste de la page (la 3D d'accueil continue). */
function renderResults() {
  const famsForCat = [...new Set(lib.tactics.filter((t) => !state.cat || t.cat === state.cat).map((t) => t.family!))].sort((a, b) =>
    famName(a).localeCompare(famName(b), state.lang),
  );
  if (state.family && !famsForCat.includes(state.family)) state.family = "";
  document.getElementById("f-family")!.innerHTML =
    `<option value="">${tr("Toutes", "All")}</option>` + famsForCat.map((f) => `<option value="${f}"${state.family === f ? " selected" : ""}>${esc(famName(f))}</option>`).join("");
  const list = filtered();
  document.getElementById("results")!.innerHTML = `
    <p class="count" aria-live="polite">${list.length} ${tr(list.length > 1 ? "fiches" : "fiche", list.length > 1 ? "cards" : "card")}</p>
    ${list.length ? `<ul class="grid">${list.slice(0, state.shown).map(card).join("")}</ul>` : `<p class="empty">${state.pending ? tr("Aucune fiche ne correspond. Essaie un autre mot ou retire un filtre.", "No card matches. Try another word or remove a filter.") : tr("Aucune fiche relue pour l'instant. Coche « Inclure les fiches à relire » pour tout voir.", "No reviewed card yet. Tick “Include cards awaiting review” to see them all.")}</p>`}
    ${list.length > state.shown ? `<p class="more"><button type="button" id="more" class="btn">${tr("Afficher plus", "Show more")} (${list.length - state.shown})</button></p>` : ""}`;
}

// ----------------------------------------------------------------------- fiche
function captionFor(t: Tactic, k: number) {
  const n = t.steps?.length ?? 0;
  if (k < 0) return { label: tr("Placement de départ", "Starting positions"), main: tr("Placement de départ", "Starting positions"), alt: state.lang === "fr" ? "Starting positions" : "Placement de départ" };
  const c = t.steps![k].c;
  return { label: `${tr("Étape", "Step")} ${k + 1}/${n}`, main: c[state.lang], alt: c[other(state.lang)] };
}

function list(items: string[]) {
  return `<ul class="bullets">${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

const OFFENSE_CATS = ["attaque", "zone_att", "transition", "remises"];
const SHOTS: Record<ShotKind, Text> = {
  rim: { fr: "Tir près du cercle (lay-up, dunk ou tir dans la raquette)", en: "Shot at the rim (layup, dunk or paint shot)" },
  mid: { fr: "Tir à mi-distance", en: "Mid-range shot" },
  three: { fr: "Tir à 3 points", en: "Three-point shot" },
};

/** Explication affichée pendant la lecture : le principe, un point clé par étape, puis pourquoi ça marche. */
function coachText(t: Tactic, k: number) {
  const n = t.steps?.length ?? 0;
  if (k < 0) return `<strong>${tr("Le principe", "The idea")}</strong> ${esc(txt(t.sum))}`;
  const key = t.keys[state.lang][k];
  const parts = [];
  if (key) parts.push(`<strong>${tr("Point clé", "Key point")}</strong> ${esc(key)}`);
  if (k === n - 1) parts.push(`<strong>${tr("Pourquoi ça marche", "Why it works")}</strong> ${esc(txt(t.why))}`);
  return parts.join("<br>");
}

// ------------------------------------------------------------ narration audio
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const againstFor = (t: Tactic) => (t.family ? coaching.against[t.family] : undefined);

/**
 * Lecture avec la voix : anime chaque étape pendant que sa légende est lue.
 * Clips à voix naturelle s'ils sont publiés, sinon voix du navigateur.
 */
function makeNarrator(t: Tactic, b: Board, hooks: { onState: (on: boolean) => void; onBlocked?: () => void; loop?: boolean }) {
  const L = state.lang;
  const n = t.steps?.length ?? 0;
  const segs = narrationSegments(t, L, againstFor(t), nba[t.id]);
  let urls: string[] | null = null;
  Promise.all(segs.map((x) => clipPath(x, L)))
    .then(async (u) => (await clipsAvailable(u[0])) && (urls = u))
    .catch(() => {});
  let token = 0;
  let on = false;
  let blocked = false;
  // Pas d'« await » avant le premier clip : il doit partir dans le geste de l'utilisateur (iPhone).
  const say = async (i: number, alive: () => boolean) => {
    if (blocked) return;
    if (urls) {
      try {
        return await playClip(urls[i], alive);
      } catch (e) {
        if ((e as DOMException)?.name === "NotAllowedError") {
          blocked = true;
          hooks.onBlocked?.();
          return;
        }
      }
    }
    return speak(segs[i], L, alive);
  };
  const run = async () => {
    const my = ++token;
    blocked = false;
    on = true;
    hooks.onState(true);
    const alive = () => my === token && board === b;
    do {
      b.goTo(-1, true);
      await say(0, alive);
      for (let k = 0; k < n && alive(); k++) {
        b.goTo(k, reduceMotion());
        await Promise.all([say(k + 1, alive), wait(2400)]);
      }
      if (alive()) await say(n + 1, alive);
      if (hooks.loop && alive()) await wait(1800);
    } while (hooks.loop && alive());
    if (my === token) {
      on = false;
      hooks.onState(false);
    }
  };
  const stop = () => {
    token++;
    stopSpeaking();
    if (on) {
      on = false;
      hooks.onState(false);
    }
  };
  return {
    run,
    stop,
    get on() {
      return on;
    },
  };
}

const soundLabel = () => (state.sound ? `🔊 ${tr("Son activé", "Sound on")}` : `🔇 ${tr("Son coupé", "Sound off")}`);

function downloadLinks(id: string) {
  return FORMATS.map(([f, label]) => `<a class="chip" href="${videoUrl(id, f)}" download>⬇ ${esc(txt(label))}</a>`).join("");
}

function ficheView(t: Tactic) {
  const drill = t.duration != null;
  const sameCat = lib.tactics.filter((x) => x.cat === t.cat);
  const i = sameCat.indexOf(t);
  const prevT = sameCat[i - 1], nextT = sameCat[i + 1];
  const against = againstFor(t);
  const teams = nba[t.id];
  const shot = OFFENSE_CATS.includes(t.cat) ? shotKind(t) : null;
  const practice = coaching.practice[t.cat]?.[state.lang] ?? [];
  const nSteps = t.steps?.length ?? 0;
  app.innerHTML = `${header("x")}
  <main class="wrap fiche" id="main">
    <p class="crumbs"><a href="#">← ${tr("Bibliothèque", "Library")}</a> · ${esc(catName(t.cat))} · ${esc(famName(t.family))}</p>
    <h1>${esc(txt(t.name))}</h1>
    <p class="alt-title" lang="${other(state.lang)}">${esc(t.name[other(state.lang)])}</p>
    <p class="badges"><span class="badge">${txt(LEVELS[t.lvl])}</span>${t.review === "pending" ? `<span class="badge badge-pending">${tr("À relire par un entraîneur", "Awaiting coach review")}</span>` : ""}<a class="badge badge-link" href="#video-${t.id}">▶ ${tr("Mode vidéo", "Video mode")}</a>${t.steps?.length ? `<a class="badge badge-link" href="#montage-${t.id}">🎬 ${tr("Monter avec ta vidéo", "Edit with your video")}</a>` : ""}</p>
    <div class="fiche-grid">
      <section class="player" aria-label="${tr("Schéma animé", "Animated diagram")}">
        <div id="board-host" class="board-host"></div>
        <div id="board3d-host" class="board-host board3d-host" hidden></div>
        <div class="controls" role="group" aria-label="${tr("Contrôles de l'animation", "Animation controls")}">
          <button type="button" class="ctl" id="b-prev" aria-label="${tr("Étape précédente", "Previous step")}">⏮</button>
          <button type="button" class="ctl ctl-main" id="b-play" aria-label="${tr("Lecture", "Play")}">▶</button>
          <button type="button" class="ctl" id="b-next" aria-label="${tr("Étape suivante", "Next step")}">⏭</button>
          <span class="step-label" id="step-label"></span>
          <button type="button" class="chip sound-toggle" id="b-sound" aria-pressed="${state.sound}">${soundLabel()}</button>
          <button type="button" class="chip view-toggle" id="b-3d" aria-pressed="false">${tr("Vue 3D", "3D view")}</button>
        </div>
        <p class="sound-hint">${tr("▶ lance l'animation avec l'explication audio, étape par étape.", "▶ plays the animation with the audio explanation, step by step.")}</p>
        <p class="hint3d" id="hint3d" hidden>${tr("Glisse pour tourner autour du terrain, pince ou molette pour zoomer.", "Drag to orbit the court, pinch or scroll to zoom.")}</p>
        <div class="caption" aria-live="polite"><p id="cap-main"></p><p id="cap-alt" class="cap-alt" lang="${other(state.lang)}"></p></div>
        <p class="coach" id="coach"></p>
        <p class="legend"><span><i class="lg-o"></i>${tr("Attaque", "Offense")}</span><span><i class="lg-x"></i>${tr("Défense", "Defense")}</span><span><i class="lg-b"></i>${tr("Ballon", "Ball")}</span><span>${tr("Zigzag : dribble · pointillé : passe · barre : écran", "Zigzag: dribble · dotted: pass · bar: screen")}</span></p>
      </section>
      <article class="sections">
        <p class="lead">${esc(txt(t.sum))}</p>
        ${drill ? `<dl class="drill"><div><dt>${tr("Durée", "Duration")}</dt><dd>${t.duration} min</dd></div><div><dt>${tr("Joueurs", "Players")}</dt><dd>${esc(t.players ?? "")}</dd></div><div><dt>${tr("Matériel", "Equipment")}</dt><dd>${esc(txt(t.equipment))}</dd></div><div><dt>${tr("Âge", "Age")}</dt><dd>${(t.age ?? []).join(", ")}</dd></div></dl>` : ""}
        <h2>${tr("Pourquoi ça marche", "Why it works")}</h2><p>${esc(txt(t.why))}</p>
        ${against || shot ? `<div class="facts">${against ? `<div><h3>${tr(OFFENSE_CATS.includes(t.cat) ? "Contre quelle défense ça marche" : "Efficace contre", OFFENSE_CATS.includes(t.cat) ? "Which defense it beats" : "Effective against")}</h3><p>${esc(txt(against))}</p></div>` : ""}${shot ? `<div><h3>${tr("Tir obtenu", "Shot created")}</h3><p>${esc(txt(SHOTS[shot]))}</p></div>` : ""}</div>` : ""}
        <h2>${tr("Points clés", "Key points")}</h2>${list(t.keys[state.lang])}
        <h2>${tr("Comment l'entraîner", "How to practice it")}</h2>
        <ol class="practice">${practice.map((x) => `<li>${esc(x.replace("{n}", String(nSteps)))}</li>`).join("")}</ol>
        ${t.variants ? `<h2>${tr("Variantes", "Variations")}</h2>${list(t.variants[state.lang])}` : ""}
        <h2>${tr("Comment la défendre", "How to defend it")}</h2><p>${esc(txt(t.counter))}</p>
        <h2>${tr("Qui l'utilise", "Who uses it")}</h2><p>${esc(txt(t.used))}</p>
        ${teams ? `<h2>${tr("Équipes NBA qui l'utilisent", "NBA teams that use it")}</h2><ul class="nba">${teams.map((x) => `<li><strong>${esc(x.team)}</strong> · ${esc(txt(x.when))}</li>`).join("")}</ul>` : ""}
        ${t.steps?.length ? `<h2>${tr("Télécharger la vidéo", "Download the video")}</h2><p class="downloads">${downloadLinks(t.id)}</p>` : ""}
      </article>
    </div>
    <nav class="pager" aria-label="${tr("Fiches voisines", "Nearby cards")}">
      ${prevT ? `<a href="#${prevT.id}">← ${esc(txt(prevT.name))}</a>` : "<span></span>"}
      ${nextT ? `<a href="#${nextT.id}">${esc(txt(nextT.name))} →</a>` : ""}
    </nav>
  </main>${footer()}`;
  bindHeader();
  const playBtn = document.getElementById("b-play")!;
  const setStep = (k: number) => {
    const c = captionFor(t, k);
    document.getElementById("step-label")!.textContent = c.label;
    document.getElementById("cap-main")!.textContent = c.main;
    document.getElementById("cap-alt")!.textContent = c.alt;
    document.getElementById("coach")!.innerHTML = coachText(t, k);
  };
  const showPlaying = (p: boolean) => {
    playBtn.textContent = p ? "⏸" : "▶";
    playBtn.setAttribute("aria-label", p ? tr("Pause", "Pause") : tr("Lecture", "Play"));
  };
  board = new Board(document.getElementById("board-host")!, t, { onStep: setStep, onPlayState: (p) => !nar.on && showPlaying(p) }, txt(t.name));
  setStep(-1);
  const b = board;

  // ---- lecture : avec le son, chaque étape s'anime pendant que sa légende est lue
  const nar = makeNarrator(t, b, { onState: showPlaying });
  const playSilent = () => (reduceMotion() ? b.playStatic() : b.play());
  playBtn.addEventListener("click", () => {
    if (nar.on) return nar.stop();
    if (b.playing) return b.pause();
    state.sound ? nar.run() : playSilent();
  });
  const soundBtn = document.getElementById("b-sound")!;
  soundBtn.addEventListener("click", () => {
    state.sound = !state.sound;
    store.set("sound", state.sound ? "1" : "0");
    soundBtn.textContent = soundLabel();
    soundBtn.setAttribute("aria-pressed", String(state.sound));
    if (!state.sound && nar.on) {
      nar.stop();
      playSilent();
    } else if (state.sound && b.playing) {
      b.pause();
      nar.run();
    }
  });
  document.getElementById("b-prev")!.addEventListener("click", () => {
    nar.stop();
    b.prev(reduceMotion());
  });
  document.getElementById("b-next")!.addEventListener("click", () => {
    nar.stop();
    b.next(reduceMotion());
  });
  cleanup = nar.stop;

  const btn3d = document.getElementById("b-3d")!;
  const set3d = async (on: boolean) => {
    const h2 = document.getElementById("board-host")!, h3 = document.getElementById("board3d-host")!;
    if (on && !board3d) {
      try {
        const { Board3D } = await import("./board3d");
        if (board !== b) return;
        board3d = new Board3D(h3, b, Object.keys(t.start ?? {}).filter((k) => k !== "b"));
      } catch {
        btn3d.textContent = tr("3D indisponible sur cet appareil", "3D not available on this device");
        (btn3d as HTMLButtonElement).disabled = true;
        return;
      }
    }
    h3.hidden = !on;
    h2.hidden = on;
    document.getElementById("hint3d")!.hidden = !on;
    btn3d.setAttribute("aria-pressed", String(on));
    btn3d.textContent = on ? tr("Vue 2D", "2D view") : tr("Vue 3D", "3D view");
    state.view3d = on;
    store.set("view3d", on ? "1" : "0");
  };
  btn3d.addEventListener("click", () => set3d(!state.view3d));
  if (state.view3d) set3d(true);
}

// ------------------------------------------------------------------ mode vidéo
function videoView(t: Tactic) {
  app.innerHTML = `<main class="video" id="main">
    <div class="video-frame" id="video-frame">
      <p class="v-cat">${esc(catName(t.cat).toUpperCase())}</p>
      <h1>${esc(txt(t.name))}</h1>
      <p class="v-alt" lang="${other(state.lang)}">${esc(t.name[other(state.lang)])}</p>
      <div id="board-host" class="board-host"></div>
      <p class="v-step" id="step-label"></p>
      <div class="v-caption" aria-live="polite"><p id="cap-main"></p><p id="cap-alt" class="cap-alt" lang="${other(state.lang)}"></p></div>
      <p class="v-channel">${CHANNEL}</p>
    </div>
    <div class="video-bar">
      <a class="chip" href="#${t.id}">← ${tr("Retour à la fiche", "Back to the card")}</a>
      <button type="button" class="chip" id="v-play">⏸ ${tr("Pause", "Pause")}</button>
      <button type="button" class="chip" id="v-sound" aria-pressed="${state.sound}">${soundLabel()}</button>
      <button type="button" class="chip" id="v-full">${tr("Plein écran", "Fullscreen")}</button>
      <a class="chip" href="${videoUrl(t.id, "vertical")}" download>⬇ ${tr("Télécharger", "Download")}</a>
    </div>
    <p class="v-unmute" id="v-unmute" hidden><button type="button" class="btn" id="v-unmute-btn">🔊 ${tr("Touche pour activer le son", "Tap to turn the sound on")}</button></p>
  </main>`;
  const setStep = (k: number) => {
    const c = captionFor(t, k);
    document.getElementById("step-label")!.textContent = k < 0 ? "" : `${tr("ÉTAPE", "STEP")} ${k + 1}/${t.steps!.length}`;
    document.getElementById("cap-main")!.textContent = c.main;
    document.getElementById("cap-alt")!.textContent = c.alt;
  };
  const vp = document.getElementById("v-play")!;
  const showPlaying = (p: boolean) => (vp.textContent = p ? `⏸ ${tr("Pause", "Pause")}` : `▶ ${tr("Lecture", "Play")}`);
  board = new Board(document.getElementById("board-host")!, t, { onStep: setStep, onPlayState: (p) => !nar.on && showPlaying(p) }, txt(t.name));
  board.loop = true;
  setStep(-1);
  const b = board;
  const unmute = document.getElementById("v-unmute")!;
  // La lecture démarre seule : si le navigateur bloque le son, l'animation continue et un bouton propose de l'activer.
  const nar = makeNarrator(t, b, { onState: showPlaying, loop: true, onBlocked: () => (unmute.hidden = false) });
  const playSilent = () => (reduceMotion() ? b.playStatic() : b.play());
  const start = () => (state.sound ? nar.run() : playSilent());
  window.setTimeout(() => board === b && start(), 1200);
  vp.addEventListener("click", () => {
    if (nar.on) return nar.stop();
    b.playing ? b.pause() : start();
  });
  document.getElementById("v-unmute-btn")!.addEventListener("click", () => {
    unmute.hidden = true;
    nar.stop();
    nar.run();
  });
  const sb = document.getElementById("v-sound")!;
  sb.addEventListener("click", () => {
    state.sound = !state.sound;
    store.set("sound", state.sound ? "1" : "0");
    sb.textContent = soundLabel();
    sb.setAttribute("aria-pressed", String(state.sound));
    unmute.hidden = true;
    nar.stop();
    b.pause();
    start();
  });
  document.getElementById("v-full")!.addEventListener("click", () => {
    document.getElementById("video-frame")!.requestFullscreen?.().catch(() => {});
  });
  cleanup = nar.stop;
}

// -------------------------------------------------------------- vidéos à télécharger
function videosView() {
  const anim = lib.tactics.filter((t) => t.steps?.length);
  app.innerHTML = `${header("videos")}
  <main class="wrap" id="main">
    <section class="intro"><h1>${tr("Vidéos à télécharger", "Videos to download")}</h1>
    <p>${tr(
      `Les ${anim.length} fiches animées en MP4, avec l'explication à voix haute (piste française, et piste anglaise en second) : verticale (Reels, TikTok, Shorts), carrée ou horizontale (YouTube, télé). Libres sous licence CC BY 4.0 : cite « Playbook Ouvert ».`,
      `All ${anim.length} animated cards as MP4, with the spoken explanation (French track, English as a second track): vertical (Reels, TikTok, Shorts), square or landscape (YouTube, TV). Free under CC BY 4.0: credit “Open Playbook”.`,
    )}</p></section>
    <form class="filters" role="search" id="v-filters"><label class="f-search"><span>${tr("Rechercher", "Search")}</span>
      <input id="v-q" type="search" placeholder="${tr("ex. hammer, zone 2-3…", "e.g. hammer, 2-3 zone…")}" autocomplete="off" /></label></form>
    <p class="count" id="v-count" aria-live="polite"></p>
    <ul class="video-list" id="v-list"></ul>
  </main>${footer()}`;
  bindHeader();
  const render = (q: string) => {
    const words = normalize(q.trim()).split(/\s+/).filter(Boolean);
    const rows = anim.filter((t) => {
      const hay = normalize([t.name.fr, t.name.en, famName(t.family), t.id, ...(nba[t.id] ?? []).map((x) => x.team)].join(" "));
      return words.every((w) => hay.includes(w));
    });
    document.getElementById("v-count")!.textContent = `${rows.length} ${tr(rows.length > 1 ? "vidéos" : "vidéo", rows.length > 1 ? "videos" : "video")}`;
    document.getElementById("v-list")!.innerHTML = rows
      .slice(0, 200)
      .map(
        (t) => `<li><img class="cover" src="${coverUrl(t.id)}" alt="" loading="lazy" width="54" height="96" onerror="this.remove()" /><div><a href="#${t.id}"><strong>${esc(txt(t.name))}</strong></a><span class="card-meta">${esc(catName(t.cat))} · ${esc(famName(t.family))}</span></div><p class="downloads">${downloadLinks(t.id)}</p></li>`,
      )
      .join("") + (rows.length > 200 ? `<li class="more-hint">${tr("Affine la recherche pour voir les autres vidéos.", "Refine the search to see the other videos.")} (${rows.length - 200})</li>` : "");
  };
  render("");
  document.getElementById("v-q")!.addEventListener("input", (e) => render((e.target as HTMLInputElement).value));
  document.getElementById("v-filters")!.addEventListener("submit", (e) => e.preventDefault());
}

// ------------------------------------------------------------------- glossaire
function glossaryView() {
  app.innerHTML = `${header("glossaire")}
  <main class="wrap" id="main">
    <section class="intro"><h1>${tr("Glossaire", "Glossary")}</h1>
    <p>${tr("Les mots du basket utilisés dans les fiches, avec leur équivalent anglais.", "The basketball terms used in the cards, with their French equivalent.")}</p></section>
    <dl class="glossary">${[...lib.glossary]
      .sort((a, b) => (state.lang === "fr" ? a[0].localeCompare(b[0], "fr") : a[1].localeCompare(b[1], "en")))
      .map(([fr, en, dfr, den]) => `<div><dt>${esc(state.lang === "fr" ? fr : en)} <span lang="${other(state.lang)}">${esc(state.lang === "fr" ? en : fr)}</span></dt><dd>${esc(state.lang === "fr" ? dfr : den)}</dd></div>`)
      .join("")}</dl>
  </main>${footer()}`;
  bindHeader();
}

// ---------------------------------------------------------------------- plans
const PLAN_LEVELS: Record<string, Text> = {
  general: { fr: "Général", en: "General" },
  jeunes: { fr: "Jeunes", en: "Youth" },
  amateurs: { fr: "Amateurs", en: "Amateur" },
  pro: { fr: "Pro", en: "Pro" },
  "pre-saison": { fr: "Pré-saison", en: "Preseason" },
  "veille-de-match": { fr: "Veille de match", en: "Day before a game" },
};

function plansView() {
  app.innerHTML = `${header("plans")}
  <main class="wrap" id="main">
    <section class="intro"><h1>${tr("Plans de séance", "Session plans")}</h1>
    <p>${tr("Des séances complètes par niveau, construites avec les fiches de la bibliothèque.", "Complete practices by level, built from the library's cards.")}</p></section>
    <ul class="plan-list">${lib.plans
      .map(
        (p) => `<li><a class="card" href="#plan-${p.id}">
        <span class="card-meta">${esc(txt(PLAN_LEVELS[p.level]))}</span>
        <strong>${esc(txt(p.name))}</strong>
        <span class="card-foot"><span>${p.duration} min</span><span>${p.blocks.length} ${tr("blocs", "blocks")}</span></span>
      </a></li>`,
      )
      .join("")}</ul>
  </main>${footer()}`;
  bindHeader();
}

function planView(p: Library["plans"][number]) {
  let t0 = 0;
  app.innerHTML = `${header("plans")}
  <main class="wrap" id="main">
    <p class="crumbs"><a href="#plans">← ${tr("Plans de séance", "Session plans")}</a> · ${esc(txt(PLAN_LEVELS[p.level]))}</p>
    <section class="intro"><h1>${esc(txt(p.name))}</h1>
    <p class="alt-title" lang="${other(state.lang)}">${esc(p.name[other(state.lang)])}</p></section>
    <ol class="plan">${p.blocks
      .map((b) => {
        const from = t0;
        t0 += b.min;
        return `<li><span class="plan-time">${from}–${t0} min</span><div><h2>${esc(txt(b.title))}</h2><p>${esc(txt(b.desc))}</p>${
          b.ids?.length ? `<p class="plan-links">${b.ids.filter((id) => byId.has(id)).map((id) => `<a href="#${id}">${esc(txt(byId.get(id)!.name))}</a>`).join("")}</p>` : ""
        }</div></li>`;
      })
      .join("")}</ol>
  </main>${footer()}`;
  bindHeader();
}

// ---------------------------------------------------------------------- route
// ------------------------------------------------------------------ montage
const REELS = (reelsJson as { videos: Record<string, { title: string; url: string }[]> }).videos;

/** Vidéos publiques trouvées pour cette fiche (data/reels.json) : liens à ouvrir, enregistrer, puis ajouter au montage. */
function reelsSection(t: Tactic) {
  const list = REELS[t.id];
  const site = (u: string) => (/instagram\./.test(u) ? "Instagram" : /facebook\.|fb\.watch/.test(u) ? "Facebook" : "YouTube");
  const search = encodeURIComponent(`${t.name.en} basketball`);
  return `<section class="reels"><h2>${tr("Vidéos à monter avec cette tactique", "Videos to edit with this play")}</h2>
    ${list?.length ? `<ul>${list.map((v) => `<li><a href="${esc(v.url)}" target="_blank" rel="noopener">${esc(v.title)}</a> <span class="reel-site">${site(v.url)}</span></li>`).join("")}</ul>` : `<p>${tr("Pas encore de vidéo choisie pour cette fiche.", "No video picked for this play yet.")}</p>`}
    <p class="reel-search">${tr("Chercher d'autres vidéos :", "Find more videos:")} <a href="https://www.youtube.com/results?search_query=${search}" target="_blank" rel="noopener">YouTube</a> · <a href="https://www.instagram.com/explore/search/keyword/?q=${search}" target="_blank" rel="noopener">Instagram</a> · <a href="https://www.facebook.com/search/videos/?q=${search}" target="_blank" rel="noopener">Facebook</a></p>
    <p class="m-help">${tr(
      "Ouvre la vidéo, enregistre l'extrait sur ton appareil, puis ajoute-le ci-dessous avec le @compte de l'auteur. Regarde-la avant : la liste vient d'une recherche.",
      "Open the video, save the clip on your device, then add it below with the author's @handle. Watch it first: the list comes from a search.",
    )}</p></section>`;
}

function montageView(t: Tactic) {
  app.innerHTML = `${header("")}
  <main class="wrap" id="main">
    <p class="crumbs"><a href="#${t.id}">← ${esc(txt(t.name))}</a></p>
    <section class="intro"><h1>${tr("Montage : ta vidéo + le schéma du coach", "Edit: your video + the coach's diagram")}</h1>
    <p>${tr(
      "Ajoute un Short, un Reel ou un extrait de match : on crée une vidéo verticale avec la miniature de la tactique, ta vidéo en haut, le schéma animé en bas et l'explication à voix haute.",
      "Add a Short, a Reel or a game clip: we build a vertical video with the play's cover, your video on top, the animated diagram below and the spoken explanation.",
    )}</p></section>
    ${reelsSection(t)}
    <div id="montage-root"><p class="m-status">${tr("Chargement…", "Loading…")}</p></div>
  </main>${footer()}`;
  bindHeader();
  const L = state.lang;
  const n = t.steps?.length ?? 0;
  import("./montage").then(({ Montage }) => {
    if (location.hash.slice(1) !== `montage-${t.id}`) return;
    montage = new Montage(document.getElementById("montage-root")!, {
      tactic: t,
      lang: L,
      tr,
      text: {
        title: t.name[L],
        category: catName(t.cat),
        captions: (t.steps ?? []).map((s) => s.c[L]),
        why: t.why[L],
        channel: CHANNEL,
        labels: { start: tr("Placement de départ", "Starting positions"), step: (k) => `${tr("ÉTAPE", "STEP")} ${k}/${n}`, why: tr("POURQUOI ÇA MARCHE", "WHY IT WORKS") },
      },
      clips: async () => {
        const urls = await Promise.all(narrationSegments(t, L, againstFor(t), nba[t.id]).map((x) => clipPath(x, L)));
        return (await clipsAvailable(urls[0])) ? urls : null;
      },
    });
  });
}

function editorView() {
  app.innerHTML = `${header("editeur")}<main class="wrap editor" id="main"><div id="editor-root"></div></main>${footer()}`;
  bindHeader();
  editor = new Editor(document.getElementById("editor-root")!, lib, families, state.lang, tr);
}

function route() {
  cleanup?.();
  cleanup = null;
  hero3d?.destroy();
  hero3d = null;
  heroBoard?.destroy();
  heroBoard = null;
  editor?.destroy();
  montage?.destroy();
  montage = null;
  editor = null;
  board3d?.destroy();
  board3d = null;
  board?.destroy();
  board = null;
  const h = decodeURIComponent(location.hash.slice(1));
  document.body.classList.toggle("is-video", h.startsWith("video-"));
  const keepScroll = !h && app.dataset.view === "library";
  if (h.startsWith("video-") && byId.has(h.slice(6))) {
    app.dataset.view = "video";
    videoView(byId.get(h.slice(6))!);
  } else if (byId.has(h)) {
    app.dataset.view = "fiche";
    ficheView(byId.get(h)!);
    document.title = `${txt(byId.get(h)!.name)} · Playbook Ouvert`;
  } else if (h === "glossaire") {
    app.dataset.view = "glossaire";
    glossaryView();
  } else if (h === "editeur") {
    app.dataset.view = "editeur";
    editorView();
  } else if (h.startsWith("montage-") && byId.get(h.slice(8))?.steps?.length) {
    app.dataset.view = "montage";
    montageView(byId.get(h.slice(8))!);
  } else if (h === "videos") {
    app.dataset.view = "videos";
    videosView();
  } else if (h === "plans") {
    app.dataset.view = "plans";
    plansView();
  } else if (h.startsWith("plan-") && lib.plans.some((p) => p.id === h.slice(5))) {
    app.dataset.view = "plan";
    planView(lib.plans.find((p) => p.id === h.slice(5))!);
  } else {
    app.dataset.view = "library";
    libraryView();
  }
  if (!byId.has(h)) document.title = "Playbook Ouvert · Open Playbook";
  if (!keepScroll) window.scrollTo(0, 0);
}

document.addEventListener("keydown", (e) => {
  if (!board || (e.target as HTMLElement).closest("input, select, textarea")) return;
  if (e.key === " " && !(e.target as HTMLElement).closest("button, a")) {
    e.preventDefault();
    (document.getElementById("b-play") ?? document.getElementById("v-play"))?.click();
  } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
    const btn = document.getElementById(e.key === "ArrowRight" ? "b-next" : "b-prev");
    if (btn) btn.click();
    else e.key === "ArrowRight" ? board.next(reduceMotion()) : board.prev(reduceMotion());
  }
});

applyTheme();
window.addEventListener("hashchange", route);
route();
