// Éditeur de fiches (#editeur) : glisser-déposer des joueurs, étapes, types de flèches, légendes FR/EN,
// aperçu animé en direct, import et export JSON vérifiés avec les mêmes règles que `npm run validate`.
import { Board, arrow, drawCourt, el } from "./board";
import { checkShape, checkTactic, type CheckResult } from "./checks";
import {
  COLORS,
  COURT,
  PLAYER_IDS,
  frames,
  isDefender,
  type Lang,
  type Library,
  type Move,
  type MoveType,
  type PlayerId,
  type Point,
  type Step,
  type Tactic,
} from "./engine";

type Tr = (fr: string, en: string) => string;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const DRAFT_KEY = "op-editor-draft";

function blank(): Tactic {
  return {
    id: "ma-tactique",
    cat: "attaque",
    family: "systemes",
    lvl: 1,
    review: "pending",
    name: { fr: "Ma tactique", en: "My play" },
    sum: { fr: "", en: "" },
    why: { fr: "", en: "" },
    counter: { fr: "", en: "" },
    used: { fr: "", en: "" },
    keys: { fr: [""], en: [""] },
    start: { "1": [25, 31], "2": [44, 24], "3": [6, 24], "4": [17, 19.5], "5": [33, 19.5], b: "1" },
    steps: [{ m: { "1": [25, 22, "d"] }, c: { fr: "1 attaque le panier.", en: "1 drives to the basket." } }],
  };
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const round = (n: number) => Math.round(n * 2) / 2;

export class Editor {
  private t: Tactic;
  private edit = -1; // -1 = placement de départ, k = étape k
  private selected: PlayerId | null = null;
  private svg!: SVGSVGElement;
  private layer!: SVGGElement;
  private preview: Board | null = null;
  private previewTimer = 0;

  constructor(
    private root: HTMLElement,
    private lib: Library,
    private families: Record<string, { fr: string; en: string }>,
    private lang: Lang,
    private tr: Tr,
  ) {
    let draft: Tactic | null = null;
    try {
      draft = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
    } catch {
      draft = null;
    }
    this.t = draft && typeof draft === "object" && draft.start ? draft : blank();
    this.render();
  }

  destroy() {
    this.preview?.destroy();
    clearTimeout(this.previewTimer);
  }

  // ------------------------------------------------------------------ état
  private save() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(this.t));
    } catch {
      /* brouillon non sauvegardé : stockage indisponible */
    }
  }

  private changed(full = false) {
    this.save();
    if (full) this.render();
    else {
      this.drawBoard();
      this.renderSteps();
      this.renderChecks();
      this.schedulePreview();
    }
  }

  private posBefore(k: number) {
    return frames(this.t)[k + 1 > 0 ? k : 0];
  }

  // ---------------------------------------------------------------- rendu
  private render() {
    const tr = this.tr, t = this.t, L = this.lang;
    const famOpts = Object.entries(this.families)
      .sort((a, b) => a[1][L].localeCompare(b[1][L], L))
      .map(([k, v]) => `<option value="${k}"${t.family === k ? " selected" : ""}>${esc(v[L])}</option>`)
      .join("");
    const text = (key: "name" | "sum" | "why" | "counter" | "used", label: string, area = false) =>
      `<fieldset class="ed-pair"><legend>${label}</legend>${(["fr", "en"] as Lang[])
        .map((l) => {
          const v = esc((t[key] as Record<Lang, string>)?.[l] ?? "");
          return `<label><span>${l.toUpperCase()}</span>${area ? `<textarea id="ed-${key}-${l}" data-text="${key}" data-lang="${l}" rows="2">${v}</textarea>` : `<input id="ed-${key}-${l}" data-text="${key}" data-lang="${l}" value="${v}" />`}</label>`;
        })
        .join("")}</fieldset>`;
    this.root.innerHTML = `
    <section class="intro"><h1>${tr("Éditeur de fiches", "Card editor")}</h1>
      <p>${tr(
        "Place les joueurs, ajoute des étapes, puis exporte le JSON pour l'ajouter à data/tactics.json. Ton brouillon reste dans ce navigateur.",
        "Place the players, add steps, then export the JSON to add it to data/tactics.json. Your draft stays in this browser.",
      )}</p></section>
    <div class="ed-grid">
      <section class="ed-board" aria-label="${tr("Terrain de l'éditeur", "Editor court")}">
        <div class="ed-toolbar">
          <span class="ed-mode" id="ed-mode"></span>
          <label class="ed-inline"><span>${tr("Ballon", "Ball")}</span><select id="ed-ball"></select></label>
        </div>
        <div id="ed-svg" class="board-host"></div>
        <p class="hint3d">${tr(
          "Glisse un joueur pour le placer. À une étape, le glisser crée son déplacement. Clavier : Tab pour choisir un joueur, flèches pour le déplacer.",
          "Drag a player to place it. On a step, dragging creates its move. Keyboard: Tab to pick a player, arrow keys to move it.",
        )}</p>
        <fieldset class="ed-roster"><legend>${tr("Joueurs sur le terrain", "Players on court")}</legend>
          ${PLAYER_IDS.map((id) => `<label class="ed-check"><input type="checkbox" id="ed-p-${id}" data-player="${id}"${t.start?.[id] ? " checked" : ""} /> ${id}</label>`).join("")}
        </fieldset>
        <div id="ed-steps"></div>
      </section>
      <section class="ed-side">
        <h2>${tr("Aperçu animé", "Live preview")}</h2>
        <div id="ed-preview" class="board-host"></div>
        <div class="controls"><button type="button" class="ctl ctl-main" id="ed-play" aria-label="${tr("Lecture de l'aperçu", "Play preview")}">▶</button><span class="step-label" id="ed-prev-label"></span></div>
        <div id="ed-checks" class="ed-checks" aria-live="polite"></div>
        <h2>${tr("Fiche", "Card")}</h2>
        <div class="ed-meta">
          <label><span>id</span><input id="ed-id" value="${esc(t.id)}" /></label>
          <label><span>${tr("Catégorie", "Category")}</span><select id="ed-cat">${this.lib.cats.map((c) => `<option value="${c.id}"${t.cat === c.id ? " selected" : ""}>${esc(c[L])}</option>`).join("")}</select></label>
          <label><span>${tr("Famille", "Family")}</span><select id="ed-family">${famOpts}</select></label>
          <label><span>${tr("Niveau", "Level")}</span><select id="ed-lvl">${[1, 2, 3].map((n) => `<option${t.lvl === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>
        </div>
        ${text("name", tr("Nom", "Name"))}
        ${text("sum", tr("Résumé", "Summary"), true)}
        ${text("why", tr("Pourquoi ça marche", "Why it works"), true)}
        ${text("counter", tr("Comment la défendre", "How to defend it"), true)}
        ${text("used", tr("Qui l'utilise", "Who uses it"), true)}
        <fieldset class="ed-pair"><legend>${tr("Points clés (un par ligne)", "Key points (one per line)")}</legend>
          ${(["fr", "en"] as Lang[]).map((l) => `<label><span>${l.toUpperCase()}</span><textarea id="ed-keys-${l}" data-keys="${l}" rows="4">${esc(t.keys[l].join("\n"))}</textarea></label>`).join("")}
        </fieldset>
        <h2>${tr("Importer et exporter", "Import and export")}</h2>
        <div class="ed-io">
          <label><span>${tr("Partir d'une fiche existante", "Start from an existing card")}</span>
            <select id="ed-load"><option value="">${tr("Choisir…", "Choose…")}</option>${this.lib.tactics.map((x) => `<option value="${x.id}">${esc(x.name[L])}</option>`).join("")}</select></label>
          <div class="ed-buttons">
            <button type="button" class="btn" id="ed-copy">${tr("Copier le JSON", "Copy JSON")}</button>
            <button type="button" class="chip" id="ed-download">${tr("Télécharger .json", "Download .json")}</button>
            <button type="button" class="chip" id="ed-new">${tr("Nouvelle fiche", "New card")}</button>
          </div>
          <label><span>${tr("JSON de la fiche (colle un JSON ici pour l'importer)", "Card JSON (paste JSON here to import it)")}</span>
            <textarea id="ed-json" rows="8" spellcheck="false"></textarea></label>
          <div class="ed-buttons">
            <button type="button" class="chip" id="ed-import">${tr("Importer ce JSON", "Import this JSON")}</button>
            <label class="chip ed-file">${tr("Ouvrir un fichier…", "Open a file…")}<input type="file" id="ed-file" accept=".json,application/json" /></label>
          </div>
          <p id="ed-io-msg" class="ed-msg" role="status"></p>
        </div>
      </section>
    </div>`;
    this.svg = el("svg", { viewBox: "-3 -4 56 52", class: "board ed-svg", role: "application", "aria-label": tr("Terrain : glisse les joueurs", "Court: drag the players") }) as SVGSVGElement;
    this.root.querySelector("#ed-svg")!.appendChild(this.svg);
    drawCourt(this.svg);
    this.layer = el("g", {}, this.svg);
    this.bind();
    this.drawBoard();
    this.renderSteps();
    this.renderChecks();
    this.schedulePreview(0);
  }

  private drawBoard() {
    const tr = this.tr;
    const k = this.edit;
    const before = this.posBefore(k);
    const states = frames(this.t);
    const after = states[k + 1] ?? before;
    this.layer.replaceChildren();
    const arrows = el("g", {}, this.layer);
    if (k >= 0) {
      const step = this.t.steps![k];
      for (const [id, mv] of Object.entries(step.m ?? {}) as [PlayerId, Move][]) {
        const from = before.pos[id];
        if (from) arrow(arrows, from, [mv[0], mv[1]], mv[2], isDefender(id));
      }
      if (step.p && before.ball) {
        const a = after.pos[before.ball as PlayerId], b = after.pos[step.p as PlayerId];
        if (a && b) arrow(arrows, a, b, "p", false);
      }
      // Fantômes : positions avant l'étape des joueurs qui bougent.
      for (const id of Object.keys(step.m ?? {}) as PlayerId[]) {
        const p = before.pos[id];
        if (p) el("circle", { cx: p[0], cy: p[1], r: 1, fill: "none", stroke: isDefender(id) ? COLORS.defense : COLORS.offense, "stroke-dasharray": "0.4 0.3", "stroke-width": 0.15, opacity: 0.7 }, arrows);
      }
    }
    const pos = k >= 0 ? after.pos : before.pos;
    for (const [id, p] of Object.entries(pos) as [PlayerId, Point][]) {
      const g = el("g", { transform: `translate(${p[0]} ${p[1]})`, tabindex: 0, role: "button", class: "ed-player", "data-id": id, "aria-label": `${id} (${p[0]}, ${p[1]})` }, this.layer);
      el("circle", { r: 2.2, fill: "transparent" }, g);
      if (isDefender(id)) {
        el("path", { d: "M -1 -1 L 1 1 M 1 -1 L -1 1", stroke: COLORS.defense, "stroke-width": 0.42, "stroke-linecap": "round", fill: "none" }, g);
        el("text", { x: 1.15, y: 1.25, "font-size": 0.95, fill: COLORS.defense, "font-weight": 700, class: "pid" }, g).textContent = id.slice(1);
      } else {
        el("circle", { r: 1.3, fill: COLORS.offense, stroke: "#ffffff", "stroke-width": 0.18 }, g);
        el("text", { y: 0.55, "text-anchor": "middle", "font-size": 1.55, fill: "#ffffff", "font-weight": 700, class: "pid" }, g).textContent = id;
      }
      if (this.selected === id) el("circle", { r: 1.9, fill: "none", stroke: COLORS.ball, "stroke-width": 0.25 }, g);
    }
    const holder = (k >= 0 ? after : before).ball;
    const hp = holder ? pos[holder as PlayerId] : undefined;
    if (hp) el("circle", { cx: hp[0] + 0.95, cy: hp[1] - 0.95, r: 0.6, fill: COLORS.ball, stroke: "#1b2333", "stroke-width": 0.1, "pointer-events": "none" }, this.layer);
    this.root.querySelector("#ed-mode")!.textContent = k < 0 ? tr("Placement de départ", "Starting positions") : `${tr("Étape", "Step")} ${k + 1}/${this.t.steps!.length}`;
    const ballSel = this.root.querySelector<HTMLSelectElement>("#ed-ball")!;
    const ids = Object.keys(this.t.start ?? {}).filter((x) => x !== "b" && !isDefender(x));
    ballSel.innerHTML = `<option value="">${tr("Personne", "Nobody")}</option>` + ids.map((x) => `<option${this.t.start?.b === x ? " selected" : ""}>${x}</option>`).join("");
    ballSel.disabled = k >= 0;
  }

  private renderSteps() {
    const tr = this.tr, L = this.lang;
    const host = this.root.querySelector("#ed-steps")!;
    const states = frames(this.t);
    const steps = this.t.steps ?? [];
    host.innerHTML = `<div class="ed-steplist" role="tablist" aria-label="${tr("Étapes", "Steps")}">
      <button type="button" role="tab" class="ed-tab" data-edit="-1" aria-selected="${this.edit === -1}">${tr("Départ", "Start")}</button>
      ${steps.map((_, k) => `<button type="button" role="tab" class="ed-tab" data-edit="${k}" aria-selected="${this.edit === k}">${k + 1}</button>`).join("")}
      <button type="button" class="ed-tab ed-add" id="ed-add-step">+ ${tr("Étape", "Step")}</button>
    </div>
    ${
      this.edit >= 0
        ? (() => {
            const k = this.edit, s = steps[k], before = states[k];
            const others = Object.keys(before.pos).filter((x) => !isDefender(x) && x !== before.ball);
            const moves = Object.entries(s.m ?? {}) as [PlayerId, Move][];
            const typeName: Record<MoveType, string> = { c: tr("course", "cut"), d: tr("dribble", "dribble"), s: tr("écran", "screen"), m: tr("défense", "defense") };
            return `<div class="ed-step">
            <div class="ed-moves">${
              moves.length
                ? moves
                    .map(
                      ([id, mv]) => `<div class="ed-move"><strong>${id}</strong>
                  <select data-move-type="${id}" aria-label="${tr("Type de flèche de", "Arrow type for")} ${id}">${(isDefender(id) ? ["m"] : ["c", "d", "s"]).map((ty) => `<option value="${ty}"${mv[2] === ty ? " selected" : ""}>${typeName[ty as MoveType]}</option>`).join("")}</select>
                  <button type="button" class="chip" data-move-del="${id}">${tr("Retirer", "Remove")}</button></div>`,
                    )
                    .join("")
                : `<p class="hint3d">${tr("Glisse un joueur sur le terrain pour créer son déplacement.", "Drag a player on the court to create its move.")}</p>`
            }</div>
            <label class="ed-inline"><span>${tr("Passe à", "Pass to")}</span><select id="ed-pass"><option value="">${tr("Pas de passe", "No pass")}</option>${others.map((x) => `<option${s.p === x ? " selected" : ""}>${x}</option>`).join("")}</select></label>
            <fieldset class="ed-pair"><legend>${tr("Légende", "Caption")}</legend>
              ${(["fr", "en"] as Lang[]).map((l) => `<label><span>${l.toUpperCase()}</span><input id="ed-cap-${l}" data-cap="${l}" value="${esc(s.c[l])}" /></label>`).join("")}
            </fieldset>
            <div class="ed-buttons">
              <button type="button" class="chip" id="ed-step-up"${k === 0 ? " disabled" : ""}>↑ ${tr("Avancer", "Move earlier")}</button>
              <button type="button" class="chip" id="ed-step-del">${tr("Supprimer l'étape", "Delete step")}</button>
            </div>
          </div>`;
          })()
        : ""
    }`;
    void L;
  }

  private result(): CheckResult {
    const r: CheckResult = { errors: [], warnings: [] };
    if (checkShape(this.t, r)) checkTactic(this.t, new Set(this.lib.cats.map((c) => c.id)), r);
    if (this.lib.tactics.some((x) => x.id === this.t.id)) r.warnings.push(this.tr(`l'id « ${this.t.id} » existe déjà : l'export remplacera cette fiche`, `the id "${this.t.id}" already exists: the export will replace that card`));
    return r;
  }

  private renderChecks() {
    const r = this.result();
    const tr = this.tr;
    const box = this.root.querySelector("#ed-checks")!;
    box.className = "ed-checks " + (r.errors.length ? "is-bad" : "is-ok");
    box.innerHTML = r.errors.length
      ? `<strong>${r.errors.length} ${tr("problème(s) à corriger avant l'export", "issue(s) to fix before export")}</strong><ul>${r.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`
      : `<strong>${tr("Fiche valide : prête à exporter.", "Valid card: ready to export.")}</strong>`;
    if (r.warnings.length) box.innerHTML += `<ul class="ed-warn">${r.warnings.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
    const json = this.root.querySelector<HTMLTextAreaElement>("#ed-json");
    if (json && document.activeElement !== json) json.value = JSON.stringify(this.t, null, 2);
  }

  private schedulePreview(delay = 400) {
    clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => this.buildPreview(), delay);
  }

  private buildPreview() {
    this.preview?.destroy();
    this.preview = null;
    const host = this.root.querySelector<HTMLElement>("#ed-preview");
    if (!host || !this.t.start || !this.t.steps?.length) return;
    const label = this.root.querySelector("#ed-prev-label")!;
    const btn = this.root.querySelector("#ed-play")!;
    try {
      this.preview = new Board(host, clone(this.t), {
        onStep: (k) => (label.textContent = k < 0 ? this.tr("Départ", "Start") : `${this.tr("Étape", "Step")} ${k + 1}/${this.t.steps!.length}`),
        onPlayState: (p) => (btn.textContent = p ? "⏸" : "▶"),
      });
    } catch {
      label.textContent = this.tr("Aperçu impossible : corrige les erreurs.", "Preview unavailable: fix the errors.");
    }
  }

  // ---------------------------------------------------------- interactions
  private toSvg(e: PointerEvent): Point {
    const pt = this.svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(this.svg.getScreenCTM()!.inverse());
    const b = COURT.bounds;
    return [round(Math.min(b.xMax, Math.max(b.xMin, p.x))), round(Math.min(b.yMax, Math.max(b.yMin, p.y)))];
  }

  private placePlayer(id: PlayerId, p: Point) {
    const k = this.edit;
    if (k < 0) {
      this.t.start![id] = p;
    } else {
      const step = this.t.steps![k];
      const before = this.posBefore(k).pos[id];
      step.m ??= {};
      if (before && Math.hypot(before[0] - p[0], before[1] - p[1]) < 0.5) delete step.m[id];
      else {
        const prev = step.m[id]?.[2];
        const type: MoveType = isDefender(id) ? "m" : prev ?? (this.posBefore(k).ball === id ? "d" : "c");
        step.m[id] = [p[0], p[1], type];
      }
      if (!Object.keys(step.m).length) delete step.m;
    }
  }

  private bind() {
    const r = this.root;
    // Glisser-déposer
    let drag: PlayerId | null = null;
    this.svg.addEventListener("pointerdown", (e) => {
      const g = (e.target as Element).closest<SVGGElement>(".ed-player");
      if (!g) return;
      drag = g.dataset.id as PlayerId;
      this.selected = drag;
      this.svg.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    this.svg.addEventListener("pointermove", (e) => {
      if (!drag) return;
      this.placePlayer(drag, this.toSvg(e));
      this.drawBoard();
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      this.changed();
    };
    this.svg.addEventListener("pointerup", end);
    this.svg.addEventListener("pointercancel", end);
    // Clavier : flèches sur le joueur sélectionné
    this.svg.addEventListener("keydown", (e) => {
      const g = (e.target as Element).closest<SVGGElement>(".ed-player");
      if (!g) return;
      const id = g.dataset.id as PlayerId;
      const d: Record<string, Point> = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] };
      if (!d[e.key]) return;
      e.preventDefault();
      const states = frames(this.t);
      const cur = (this.edit >= 0 ? states[this.edit + 1] : states[0]).pos[id]!;
      const step = e.shiftKey ? 4 : 1;
      this.selected = id;
      this.placePlayer(id, [round(cur[0] + d[e.key][0] * step), round(cur[1] + d[e.key][1] * step)]);
      this.changed();
      (this.svg.querySelector(`[data-id="${id}"]`) as SVGGElement | null)?.focus();
    });
    // Joueurs présents
    r.querySelectorAll<HTMLInputElement>("[data-player]").forEach((cb) =>
      cb.addEventListener("change", () => {
        const id = cb.dataset.player as PlayerId;
        if (cb.checked) {
          const used = Object.values(this.t.start ?? {}).filter(Array.isArray) as Point[];
          let p: Point = isDefender(id) ? [25, 14] : [25, 34];
          while (used.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 2)) p = [p[0] + 3, p[1]];
          this.t.start![id] = p;
        } else {
          delete this.t.start![id];
          if (this.t.start!.b === id) delete this.t.start!.b;
          for (const s of this.t.steps ?? []) {
            if (s.m) delete s.m[id];
            if (s.p === id) delete s.p;
          }
        }
        this.changed();
      }),
    );
    r.querySelector("#ed-ball")!.addEventListener("change", (e) => {
      const v = (e.target as HTMLSelectElement).value;
      if (v) this.t.start!.b = v;
      else delete this.t.start!.b;
      this.changed();
    });
    // Étapes (délégation : la liste est redessinée)
    r.querySelector("#ed-steps")!.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const tab = target.closest<HTMLElement>("[data-edit]");
      if (tab) {
        this.edit = Number(tab.dataset.edit);
        this.selected = null;
        this.drawBoard();
        this.renderSteps();
        return;
      }
      if (target.id === "ed-add-step") {
        const s: Step = { c: { fr: "", en: "" } };
        this.t.steps = [...(this.t.steps ?? []), s];
        this.edit = this.t.steps.length - 1;
        this.changed();
      } else if (target.id === "ed-step-del" && this.edit >= 0) {
        this.t.steps!.splice(this.edit, 1);
        this.edit = Math.min(this.edit, this.t.steps!.length - 1);
        this.changed();
      } else if (target.id === "ed-step-up" && this.edit > 0) {
        const s = this.t.steps!;
        [s[this.edit - 1], s[this.edit]] = [s[this.edit], s[this.edit - 1]];
        this.edit--;
        this.changed();
      } else if (target.dataset.moveDel) {
        delete this.t.steps![this.edit].m?.[target.dataset.moveDel as PlayerId];
        this.changed();
      }
    });
    r.querySelector("#ed-steps")!.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      const s = this.t.steps?.[this.edit];
      if (!s) return;
      if (target.dataset.moveType) {
        const mv = s.m?.[target.dataset.moveType as PlayerId];
        if (mv) mv[2] = target.value as MoveType;
        this.changed();
      } else if (target.id === "ed-pass") {
        if (target.value) s.p = target.value;
        else delete s.p;
        this.changed();
      }
    });
    r.querySelector("#ed-steps")!.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      const s = this.t.steps?.[this.edit];
      if (s && target.dataset.cap) {
        s.c[target.dataset.cap as Lang] = target.value;
        this.save();
        this.renderChecks();
        this.schedulePreview();
      }
    });
    // Métadonnées
    const meta = (id: string, fn: (v: string) => void) =>
      r.querySelector(id)!.addEventListener("input", (e) => {
        fn((e.target as HTMLInputElement).value);
        this.save();
        this.renderChecks();
      });
    meta("#ed-id", (v) => (this.t.id = v.trim()));
    meta("#ed-cat", (v) => (this.t.cat = v));
    meta("#ed-family", (v) => (this.t.family = v));
    meta("#ed-lvl", (v) => (this.t.lvl = Number(v) as 1 | 2 | 3));
    r.querySelectorAll<HTMLInputElement>("[data-text]").forEach((inp) =>
      inp.addEventListener("input", () => {
        (this.t[inp.dataset.text as "name"] as Record<Lang, string>)[inp.dataset.lang as Lang] = inp.value;
        this.save();
        this.renderChecks();
      }),
    );
    r.querySelectorAll<HTMLTextAreaElement>("[data-keys]").forEach((ta) =>
      ta.addEventListener("input", () => {
        this.t.keys[ta.dataset.keys as Lang] = ta.value.split("\n").map((s) => s.trim()).filter(Boolean);
        this.save();
        this.renderChecks();
      }),
    );
    // Aperçu
    r.querySelector("#ed-play")!.addEventListener("click", () => {
      if (!this.preview) return;
      this.preview.playing ? this.preview.pause() : this.preview.play();
    });
    // Import / export
    const msg = (s: string, bad = false) => {
      const m = r.querySelector("#ed-io-msg")!;
      m.textContent = s;
      m.classList.toggle("is-bad", bad);
    };
    const exportText = () => JSON.stringify(this.t, null, 2);
    const canExport = () => {
      const res = this.result();
      if (res.errors.length) {
        msg(this.tr("Export bloqué : corrige d'abord les problèmes listés sous l'aperçu.", "Export blocked: first fix the issues listed under the preview."), true);
        return false;
      }
      return true;
    };
    r.querySelector("#ed-copy")!.addEventListener("click", () => {
      if (!canExport()) return;
      const ta = r.querySelector<HTMLTextAreaElement>("#ed-json")!;
      ta.value = exportText();
      navigator.clipboard?.writeText(ta.value).then(
        () => msg(this.tr("JSON copié.", "JSON copied.")),
        () => {
          ta.select();
          msg(this.tr("Copie automatique refusée : le JSON est sélectionné, copie-le avec Ctrl+C.", "Automatic copy refused: the JSON is selected, copy it with Ctrl+C."));
        },
      ) ?? (ta.select(), msg(this.tr("JSON sélectionné : copie-le avec Ctrl+C.", "JSON selected: copy it with Ctrl+C.")));
    });
    r.querySelector("#ed-download")!.addEventListener("click", () => {
      if (!canExport()) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([exportText() + "\n"], { type: "application/json" }));
      a.download = `${this.t.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      msg(this.tr(`Fichier ${this.t.id}.json créé. Si rien ne se passe, utilise « Copier le JSON ».`, `File ${this.t.id}.json created. If nothing happens, use “Copy JSON”.`));
    });
    const load = (data: unknown, source: string) => {
      const cand = (data && typeof data === "object" && "tactics" in (data as object) ? (data as Library).tactics[0] : data) as Tactic;
      const res: CheckResult = { errors: [], warnings: [] };
      if (!checkShape(cand, res) || !cand.start || !cand.steps?.length) {
        msg(`${this.tr("Import refusé", "Import refused")} (${source}) : ${res.errors[0] ?? this.tr("placement de départ ou étapes manquants", "starting positions or steps missing")}`, true);
        return;
      }
      checkTactic(cand, new Set(this.lib.cats.map((c) => c.id)), res);
      this.t = clone(cand);
      this.edit = -1;
      this.selected = null;
      this.save();
      this.render();
      const m2 = this.root.querySelector("#ed-io-msg")!;
      m2.textContent = res.errors.length
        ? this.tr(`Importé avec ${res.errors.length} problème(s) à corriger.`, `Imported with ${res.errors.length} issue(s) to fix.`)
        : this.tr("Fiche importée et valide.", "Card imported and valid.");
    };
    r.querySelector("#ed-import")!.addEventListener("click", () => {
      try {
        load(JSON.parse(r.querySelector<HTMLTextAreaElement>("#ed-json")!.value), "JSON");
      } catch (e) {
        msg(`${this.tr("JSON illisible", "Unreadable JSON")} : ${(e as Error).message}`, true);
      }
    });
    r.querySelector("#ed-file")!.addEventListener("change", (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      f.text().then(
        (s) => {
          try {
            load(JSON.parse(s), f.name);
          } catch (err) {
            msg(`${this.tr("JSON illisible", "Unreadable JSON")} : ${(err as Error).message}`, true);
          }
        },
        () => msg(this.tr("Fichier illisible.", "Could not read the file."), true),
      );
    });
    r.querySelector("#ed-load")!.addEventListener("change", (e) => {
      const id = (e.target as HTMLSelectElement).value;
      const found = this.lib.tactics.find((x) => x.id === id);
      if (found) load(clone(found), id);
    });
    r.querySelector("#ed-new")!.addEventListener("click", () => {
      this.t = blank();
      this.edit = -1;
      this.save();
      this.render();
    });
  }
}
