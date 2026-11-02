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
import { speak, stopSpeaking, voiceSupported } from "./voice";

const lib = library as Library;
const families = familiesJson as Record<string, Text>;
const coaching = coachingJson as { against: Record<string, Text>; practice: Record<string, Record<Lang, string[]>> };
const byId = new Map(lib.tactics.map((t) => [t.id, t]));
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
let heroBoard: Board | null = null;
let hero3d: Board3D | null = null;
let cleanup: (() => void) | null = null;

function header(active: string) {
  const nav = [
    ["", tr("Bibliothèque", "Library")],
    ["glossaire", tr("Glossaire", "Glossary")],
    ["plans", tr("Plans de séance", "Session plans")],
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
    if (!q) return true;
    const hay = normalize([t.name.fr, t.name.en, t.sum.fr, t.sum.en, famName(t.family), t.id].join(" "));
    return q.split(/\s+/).every((w) => hay.includes(w));
  });
}

function card(t: Tactic) {
  const n = t.steps?.length ?? 0;
  return `<li><a class="card" href="#${t.id}">
    <span class="card-meta">${esc(catName(t.cat))} · ${esc(famName(t.family))}</span>
    <strong>${esc(txt(t.name))}</strong>
    <span class="card-alt" lang="${other(state.lang)}">${esc(t.name[other(state.lang)])}</span>
    <span class="card-foot"><span class="lvl lvl-${t.lvl}" title="${txt(LEVELS[t.lvl])}">${"●".repeat(t.lvl)}${"○".repeat(3 - t.lvl)}<span class="sr">${txt(LEVELS[t.lvl])}</span></span><span>${n} ${tr(n > 1 ? "étapes" : "étape", n > 1 ? "steps" : "step")}</span>${t.review === "pending" ? `<span class="tag-pending">${tr("À relire", "Awaiting review")}</span>` : ""}</span>
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
        <input id="f-q" type="search" value="${esc(state.q)}" placeholder="${tr("ex. horns, zone 2-3, rebond…", "e.g. horns, 2-3 zone, rebounding…")}" autocomplete="off" /></label>
      <label><span>${tr("Catégorie", "Category")}</span>
        <select id="f-cat"><option value="">${tr("Toutes", "All")}</option>${lib.cats.map((c) => `<option value="${c.id}"${state.cat === c.id ? " selected" : ""}>${esc(c[state.lang])}</option>`).join("")}</select></label>
      <label><span>${tr("Famille", "Family")}</span><select id="f-family"></select></label>
      <label><span>${tr("Niveau", "Level")}</span>
        <select id="f-lvl"><option value="">${tr("Tous", "All")}</option>${[1, 2, 3].map((l) => `<option value="${l}"${state.lvl === String(l) ? " selected" : ""}>${txt(LEVELS[l])}</option>`).join("")}</select></label>
      <label class="f-check"><input id="f-pending" type="checkbox"${state.pending ? " checked" : ""} /> <span>${tr("Inclure les fiches à relire", "Include cards awaiting review")}</span></label>
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

function ficheView(t: Tactic) {
  const drill = t.duration != null;
  const sameCat = lib.tactics.filter((x) => x.cat === t.cat);
  const i = sameCat.indexOf(t);
  const prevT = sameCat[i - 1], nextT = sameCat[i + 1];
  const against = t.family ? coaching.against[t.family] : undefined;
  const shot = OFFENSE_CATS.includes(t.cat) ? shotKind(t) : null;
  const practice = coaching.practice[t.cat]?.[state.lang] ?? [];
  const nSteps = t.steps?.length ?? 0;
  app.innerHTML = `${header("x")}
  <main class="wrap fiche" id="main">
    <p class="crumbs"><a href="#">← ${tr("Bibliothèque", "Library")}</a> · ${esc(catName(t.cat))} · ${esc(famName(t.family))}</p>
    <h1>${esc(txt(t.name))}</h1>
    <p class="alt-title" lang="${other(state.lang)}">${esc(t.name[other(state.lang)])}</p>
    <p class="badges"><span class="badge">${txt(LEVELS[t.lvl])}</span>${t.review === "pending" ? `<span class="badge badge-pending">${tr("À relire par un entraîneur", "Awaiting coach review")}</span>` : ""}<a class="badge badge-link" href="#video-${t.id}">▶ ${tr("Mode vidéo", "Video mode")}</a></p>
    <div class="fiche-grid">
      <section class="player" aria-label="${tr("Schéma animé", "Animated diagram")}">
        <div id="board-host" class="board-host"></div>
        <div id="board3d-host" class="board-host board3d-host" hidden></div>
        <div class="controls" role="group" aria-label="${tr("Contrôles de l'animation", "Animation controls")}">
          <button type="button" class="ctl" id="b-prev" aria-label="${tr("Étape précédente", "Previous step")}">⏮</button>
          <button type="button" class="ctl ctl-main" id="b-play" aria-label="${tr("Lecture", "Play")}">▶</button>
          <button type="button" class="ctl" id="b-next" aria-label="${tr("Étape suivante", "Next step")}">⏭</button>
          <span class="step-label" id="step-label"></span>
          <button type="button" class="chip view-toggle" id="b-3d" aria-pressed="false">${tr("Vue 3D", "3D view")}</button>
        </div>
        ${voiceSupported() ? `<button type="button" class="btn voice-btn" id="b-voice" aria-pressed="false"><span aria-hidden="true">🔊</span> ${tr("Écouter l'explication", "Listen to the explanation")}</button>` : ""}
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
  board = new Board(document.getElementById("board-host")!, t, { onStep: setStep, onPlayState: (p) => !narrating && showPlaying(p) }, txt(t.name));
  setStep(-1);
  const b = board;

  // ---- explication audio : anime chaque étape et lit sa légende, puis pourquoi ça marche
  let narrating = false;
  let token = 0;
  const voiceBtn = document.getElementById("b-voice");
  const setVoiceUi = (on: boolean) => {
    if (!voiceBtn) return;
    voiceBtn.setAttribute("aria-pressed", String(on));
    voiceBtn.innerHTML = on ? `<span aria-hidden="true">■</span> ${tr("Arrêter l'audio", "Stop audio")}` : `<span aria-hidden="true">🔊</span> ${tr("Écouter l'explication", "Listen to the explanation")}`;
  };
  const stopNarration = () => {
    token++;
    narrating = false;
    stopSpeaking();
    setVoiceUi(false);
    showPlaying(false);
  };
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const narrate = async () => {
    const my = ++token;
    narrating = true;
    setVoiceUi(true);
    showPlaying(true);
    const L = state.lang;
    const alive = () => my === token && board === b;
    b.goTo(-1, true);
    await speak(`${t.name[L]}. ${t.sum[L]}`, L);
    for (let k = 0; k < nSteps && alive(); k++) {
      b.goTo(k, reduceMotion());
      await Promise.all([speak(t.steps![k].c[L], L), wait(2400)]);
    }
    if (alive()) {
      const extra = against ? ` ${L === "fr" ? "Contre quelle défense ça marche" : "Which defense it beats"} : ${against[L]}` : "";
      await speak(`${L === "fr" ? "Pourquoi ça marche" : "Why it works"} : ${t.why[L]}${extra}`, L);
    }
    if (my === token) {
      narrating = false;
      setVoiceUi(false);
      showPlaying(false);
    }
  };
  voiceBtn?.addEventListener("click", () => (narrating ? stopNarration() : narrate()));
  playBtn.addEventListener("click", () => {
    if (narrating) return stopNarration();
    b.playing ? b.pause() : reduceMotion() ? b.playStatic() : b.play();
  });
  document.getElementById("b-prev")!.addEventListener("click", () => {
    if (narrating) stopNarration();
    b.prev(reduceMotion());
  });
  document.getElementById("b-next")!.addEventListener("click", () => {
    if (narrating) stopNarration();
    b.next(reduceMotion());
  });
  cleanup = stopNarration;

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
      <button type="button" class="chip" id="v-full">${tr("Plein écran", "Fullscreen")}</button>
    </div>
  </main>`;
  const setStep = (k: number) => {
    const c = captionFor(t, k);
    document.getElementById("step-label")!.textContent = k < 0 ? "" : `${tr("ÉTAPE", "STEP")} ${k + 1}/${t.steps!.length}`;
    document.getElementById("cap-main")!.textContent = c.main;
    document.getElementById("cap-alt")!.textContent = c.alt;
  };
  const vp = document.getElementById("v-play")!;
  board = new Board(document.getElementById("board-host")!, t, {
    onStep: setStep,
    onPlayState: (p) => (vp.textContent = p ? `⏸ ${tr("Pause", "Pause")}` : `▶ ${tr("Lecture", "Play")}`),
  }, txt(t.name));
  board.loop = true;
  setStep(-1);
  const b = board;
  const start = () => (reduceMotion() ? b.playStatic() : b.play());
  window.setTimeout(() => board === b && start(), 1200);
  vp.addEventListener("click", () => (b.playing ? b.pause() : start()));
  document.getElementById("v-full")!.addEventListener("click", () => {
    document.getElementById("video-frame")!.requestFullscreen?.().catch(() => {});
  });
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
    board.playing ? board.pause() : reduceMotion() ? board.playStatic() : board.play();
  } else if (e.key === "ArrowRight") board.next(reduceMotion());
  else if (e.key === "ArrowLeft") board.prev(reduceMotion());
});

applyTheme();
window.addEventListener("hashchange", route);
route();
