// Site Playbook Ouvert : bibliothèque, fiche animée (#id), mode vidéo (#video-id), glossaire, plan de séance.
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/600.css";
import "@fontsource/barlow-condensed/700.css";
import "./style.css";
import library from "../data/tactics.json";
import familiesJson from "../data/families.json";
import { Board } from "./board";
import { normalize, type Lang, type Library, type Tactic, type Text } from "./engine";

const lib = library as Library;
const families = familiesJson as Record<string, Text>;
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

function header(active: string) {
  const nav = [
    ["", tr("Bibliothèque", "Library")],
    ["glossaire", tr("Glossaire", "Glossary")],
    ["plans", tr("Plans de séance", "Session plans")],
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

function libraryView() {
  const famsForCat = [...new Set(lib.tactics.filter((t) => !state.cat || t.cat === state.cat).map((t) => t.family!))].sort((a, b) =>
    famName(a).localeCompare(famName(b), state.lang),
  );
  if (state.family && !famsForCat.includes(state.family)) state.family = "";
  const list = filtered();
  app.innerHTML = `${header("")}
  <main class="wrap" id="main">
    <section class="intro">
      <h1>${tr("Tactiques de basket, dessinées et animées", "Basketball plays, drawn and animated")}</h1>
      <p>${tr(
        `${lib.tactics.length} fiches libres : systèmes, défenses, remises en jeu, exercices et principes. Chaque fiche s'anime étape par étape, en français et en anglais.`,
        `${lib.tactics.length} free cards: sets, defenses, inbounds, drills and principles. Every card animates step by step, in French and English.`,
      )}</p>
    </section>
    <form class="filters" id="filters" role="search">
      <label class="f-search"><span>${tr("Rechercher", "Search")}</span>
        <input id="f-q" type="search" value="${esc(state.q)}" placeholder="${tr("ex. horns, zone 2-3, rebond…", "e.g. horns, 2-3 zone, rebounding…")}" autocomplete="off" /></label>
      <label><span>${tr("Catégorie", "Category")}</span>
        <select id="f-cat"><option value="">${tr("Toutes", "All")}</option>${lib.cats.map((c) => `<option value="${c.id}"${state.cat === c.id ? " selected" : ""}>${esc(c[state.lang])}</option>`).join("")}</select></label>
      <label><span>${tr("Famille", "Family")}</span>
        <select id="f-family"><option value="">${tr("Toutes", "All")}</option>${famsForCat.map((f) => `<option value="${f}"${state.family === f ? " selected" : ""}>${esc(famName(f))}</option>`).join("")}</select></label>
      <label><span>${tr("Niveau", "Level")}</span>
        <select id="f-lvl"><option value="">${tr("Tous", "All")}</option>${[1, 2, 3].map((l) => `<option value="${l}"${state.lvl === String(l) ? " selected" : ""}>${txt(LEVELS[l])}</option>`).join("")}</select></label>
      <label class="f-check"><input id="f-pending" type="checkbox"${state.pending ? " checked" : ""} /> <span>${tr("Inclure les fiches à relire", "Include cards awaiting review")}</span></label>
    </form>
    <p class="count" aria-live="polite">${list.length} ${tr(list.length > 1 ? "fiches" : "fiche", list.length > 1 ? "cards" : "card")}</p>
    ${list.length ? `<ul class="grid">${list.slice(0, state.shown).map(card).join("")}</ul>` : `<p class="empty">${state.pending ? tr("Aucune fiche ne correspond. Essaie un autre mot ou retire un filtre.", "No card matches. Try another word or remove a filter.") : tr("Aucune fiche relue pour l'instant. Coche « Inclure les fiches à relire » pour tout voir.", "No reviewed card yet. Tick “Include cards awaiting review” to see them all.")}</p>`}
    ${list.length > state.shown ? `<p class="more"><button type="button" id="more" class="btn">${tr("Afficher plus", "Show more")} (${list.length - state.shown})</button></p>` : ""}
  </main>${footer()}`;
  bindHeader();
  const q = document.getElementById("f-q") as HTMLInputElement;
  q.addEventListener("input", () => {
    state.q = q.value;
    state.shown = PAGE;
    const pos = q.selectionStart;
    libraryView();
    const nq = document.getElementById("f-q") as HTMLInputElement;
    nq.focus();
    nq.setSelectionRange(pos, pos);
  });
  const bindSelect = (id: string, key: "cat" | "family" | "lvl") =>
    document.getElementById(id)!.addEventListener("change", (e) => {
      state[key] = (e.target as HTMLSelectElement).value;
      state.shown = PAGE;
      libraryView();
      document.getElementById(id)?.focus();
    });
  bindSelect("f-cat", "cat");
  bindSelect("f-family", "family");
  bindSelect("f-lvl", "lvl");
  document.getElementById("f-pending")!.addEventListener("change", (e) => {
    state.pending = (e.target as HTMLInputElement).checked;
    store.set("pending", state.pending ? "1" : "0");
    libraryView();
    document.getElementById("f-pending")?.focus();
  });
  document.getElementById("filters")!.addEventListener("submit", (e) => e.preventDefault());
  document.getElementById("more")?.addEventListener("click", () => {
    state.shown += PAGE;
    libraryView();
    document.getElementById("more")?.focus();
  });
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

function ficheView(t: Tactic) {
  const drill = t.duration != null;
  const sameCat = lib.tactics.filter((x) => x.cat === t.cat);
  const i = sameCat.indexOf(t);
  const prevT = sameCat[i - 1], nextT = sameCat[i + 1];
  app.innerHTML = `${header("x")}
  <main class="wrap fiche" id="main">
    <p class="crumbs"><a href="#">← ${tr("Bibliothèque", "Library")}</a> · ${esc(catName(t.cat))} · ${esc(famName(t.family))}</p>
    <h1>${esc(txt(t.name))}</h1>
    <p class="alt-title" lang="${other(state.lang)}">${esc(t.name[other(state.lang)])}</p>
    <p class="badges"><span class="badge">${txt(LEVELS[t.lvl])}</span>${t.review === "pending" ? `<span class="badge badge-pending">${tr("À relire par un entraîneur", "Awaiting coach review")}</span>` : ""}<a class="badge badge-link" href="#video-${t.id}">▶ ${tr("Mode vidéo", "Video mode")}</a></p>
    <div class="fiche-grid">
      <section class="player" aria-label="${tr("Schéma animé", "Animated diagram")}">
        <div id="board-host" class="board-host"></div>
        <div class="controls" role="group" aria-label="${tr("Contrôles de l'animation", "Animation controls")}">
          <button type="button" class="ctl" id="b-prev" aria-label="${tr("Étape précédente", "Previous step")}">⏮</button>
          <button type="button" class="ctl ctl-main" id="b-play" aria-label="${tr("Lecture", "Play")}">▶</button>
          <button type="button" class="ctl" id="b-next" aria-label="${tr("Étape suivante", "Next step")}">⏭</button>
          <span class="step-label" id="step-label"></span>
        </div>
        <div class="caption" aria-live="polite"><p id="cap-main"></p><p id="cap-alt" class="cap-alt" lang="${other(state.lang)}"></p></div>
        <p class="legend"><span><i class="lg-o"></i>${tr("Attaque", "Offense")}</span><span><i class="lg-x"></i>${tr("Défense", "Defense")}</span><span><i class="lg-b"></i>${tr("Ballon", "Ball")}</span><span>${tr("Zigzag : dribble · pointillé : passe · barre : écran", "Zigzag: dribble · dotted: pass · bar: screen")}</span></p>
      </section>
      <article class="sections">
        <p class="lead">${esc(txt(t.sum))}</p>
        ${drill ? `<dl class="drill"><div><dt>${tr("Durée", "Duration")}</dt><dd>${t.duration} min</dd></div><div><dt>${tr("Joueurs", "Players")}</dt><dd>${esc(t.players ?? "")}</dd></div><div><dt>${tr("Matériel", "Equipment")}</dt><dd>${esc(txt(t.equipment))}</dd></div><div><dt>${tr("Âge", "Age")}</dt><dd>${(t.age ?? []).join(", ")}</dd></div></dl>` : ""}
        <h2>${tr("Pourquoi ça marche", "Why it works")}</h2><p>${esc(txt(t.why))}</p>
        <h2>${tr("Points clés", "Key points")}</h2>${list(t.keys[state.lang])}
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
  };
  board = new Board(document.getElementById("board-host")!, t, {
    onStep: setStep,
    onPlayState: (p) => {
      playBtn.textContent = p ? "⏸" : "▶";
      playBtn.setAttribute("aria-label", p ? tr("Pause", "Pause") : tr("Lecture", "Play"));
    },
  }, txt(t.name));
  setStep(-1);
  const b = board;
  playBtn.addEventListener("click", () => (b.playing ? b.pause() : reduceMotion() ? b.playStatic() : b.play()));
  document.getElementById("b-prev")!.addEventListener("click", () => b.prev(reduceMotion()));
  document.getElementById("b-next")!.addEventListener("click", () => b.next(reduceMotion()));
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
function plansView() {
  const p = lib.plan;
  let t0 = 0;
  app.innerHTML = `${header("plans")}
  <main class="wrap" id="main">
    <section class="intro"><h1>${esc(txt(p.name))}</h1>
    <p>${tr(`Une séance complète de ${p.duration} minutes, construite avec les fiches de la bibliothèque.`, `A complete ${p.duration}-minute practice built from the library's cards.`)}</p></section>
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
function route() {
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
  } else if (h === "plans") {
    app.dataset.view = "plans";
    plansView();
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
