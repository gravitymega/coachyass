// Terrain SVG animé : mêmes positions, couleurs et timeline que render.py.
import {
  COLORS,
  frames,
  isDefender,
  stepTimings,
  type BoardState,
  type Move,
  type PlayerId,
  type Point,
  type StepTiming,
  type Tactic,
  viewOf,
} from "./engine";

const NS = "http://www.w3.org/2000/svg";
const INK = "#1b2333";

export function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => `${(cx + r * Math.cos(a)).toFixed(3)} ${(cy + r * Math.sin(a)).toFixed(3)}`;
  const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
  return `M ${p(a0)} A ${r} ${r} 0 ${large} 1 ${p(a1)}`;
};

/** Demi-terrain en pieds : ligne de fond en haut, panier en (25, 5.25). Avec full, le terrain entier (jusqu'à y = 94). */
export function drawCourt(svg: SVGSVGElement, full = false) {
  const VIEW = viewOf({ court: full ? "full" : undefined });
  const g = el("g", { "aria-hidden": "true" }, svg);
  el("rect", { x: VIEW.x, y: VIEW.y, width: VIEW.w, height: VIEW.h, rx: 1.2, fill: COLORS.court }, g);
  for (let x = VIEW.x + 1; x < VIEW.x + VIEW.w; x += 4) el("rect", { x, y: VIEW.y, width: 2, height: VIEW.h, fill: COLORS.plank }, g);
  const halves = full ? [el("g", {}, g), el("g", { transform: "translate(0 94) scale(1 -1)" }, g)] : [g];
  for (const h of halves) half(h);
  if (full) {
    const lines = el("g", { fill: "none", stroke: INK, "stroke-width": 0.18 }, g);
    el("rect", { x: 0, y: 0, width: 50, height: 94 }, lines);
    el("line", { x1: 0, y1: 47, x2: 50, y2: 47 }, lines);
  }
}

/** Une moitié de terrain (panier en haut). */
function half(g: SVGGElement) {
  el("rect", { x: 17, y: 0, width: 16, height: 19, fill: COLORS.paint, "fill-opacity": 0.55 }, g);
  const lines = el("g", { fill: "none", stroke: INK, "stroke-width": 0.18, "stroke-linejoin": "round" }, g);
  el("rect", { x: 0, y: 0, width: 50, height: 47 }, lines);
  el("rect", { x: 17, y: 0, width: 16, height: 19 }, lines);
  el("path", { d: arc(25, 19, 6, 0, Math.PI) }, lines);
  el("path", { d: arc(25, 19, 6, Math.PI, 2 * Math.PI), "stroke-dasharray": "0.8 0.8" }, lines);
  el("path", { d: arc(25, 5.25, 4, 0, Math.PI) }, lines);
  const a = Math.asin(22 / 23.75);
  const yc = 5.25 + 23.75 * Math.cos(a);
  el("path", { d: `M 3 0 L 3 ${yc} M 47 0 L 47 ${yc}` }, lines);
  el("path", { d: arc(25, 5.25, 23.75, Math.PI / 2 - a, Math.PI / 2 + a) }, lines);
  el("path", { d: arc(25, 47, 6, Math.PI, 2 * Math.PI) }, lines);
  el("line", { x1: 22, y1: 4, x2: 28, y2: 4, "stroke-width": 0.3 }, lines);
  el("circle", { cx: 25, cy: 5.25, r: 0.75, stroke: COLORS.ball, "stroke-width": 0.22 }, lines);
}

export function arrow(g: SVGGElement, a: Point, b: Point, kind: Move[2] | "p", defender: boolean) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const dist = Math.hypot(dx, dy);
  if (dist < 1.2) return;
  const ux = dx / dist, uy = dy / dist, nx = -uy, ny = ux;
  const color = defender ? COLORS.defense : INK;
  const end: Point = [b[0] - ux * 1.5, b[1] - uy * 1.5];
  const common = { fill: "none", stroke: color, "stroke-width": 0.22, "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.9 };
  if (kind === "d") {
    const pts = [`${a[0]} ${a[1]}`];
    const n = Math.max(3, Math.floor(dist / 1.1));
    for (let i = 1; i < n; i++) {
      const k = i / n, off = (i % 2 ? 1 : -1) * 0.45;
      pts.push(`${a[0] + (end[0] - a[0]) * k + nx * off} ${a[1] + (end[1] - a[1]) * k + ny * off}`);
    }
    pts.push(`${end[0]} ${end[1]}`);
    el("polyline", { ...common, points: pts.join(" ") }, g);
  } else {
    el("line", { ...common, x1: a[0], y1: a[1], x2: end[0], y2: end[1], ...(kind === "p" ? { "stroke-dasharray": "0.5 0.6" } : {}) }, g);
  }
  if (kind === "s") {
    el("line", { ...common, "stroke-width": 0.35, x1: end[0] + nx * 1.1, y1: end[1] + ny * 1.1, x2: end[0] - nx * 1.1, y2: end[1] - ny * 1.1 }, g);
  } else {
    const h = 1;
    el("path", { d: `M ${end[0] + ux * h * 0.2} ${end[1] + uy * h * 0.2} L ${end[0] - ux * h + nx * h * 0.55} ${end[1] - uy * h + ny * h * 0.55} L ${end[0] - ux * h - nx * h * 0.55} ${end[1] - uy * h - ny * h * 0.55} Z`, fill: color, stroke: "none" }, g);
  }
}

const lerp = (p: Point, q: Point, k: number): Point => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

export type FrameListener = (pos: Partial<Record<PlayerId, Point>>, ball: Point | undefined, flight: number | null) => void;

export interface BoardEvents {
  onStep?: (index: number) => void; // -1 = placement de départ
  onPlayState?: (playing: boolean) => void;
}

export class Board {
  readonly svg: SVGSVGElement;
  private arrows: SVGGElement;
  private players = new Map<string, SVGGElement>();
  private ball: SVGCircleElement;
  private states: BoardState[];
  private timing: StepTiming[];
  private total: number;
  private t = 0;
  private step = -2;
  private raf = 0;
  private last = 0;
  private stopAt: number | null = null;
  /** Vitesse de l'animation : 1 = normale ; goTo(k, false, secondes) l'ajuste pour suivre la voix. */
  private rate = 1;
  playing = false;
  loop = false;
  private frameListeners: FrameListener[] = [];
  private stepListeners: ((k: number) => void)[] = [];
  private last3d: Parameters<FrameListener> | null = null;

  constructor(parent: HTMLElement, private tactic: Tactic, private events: BoardEvents = {}, label = "") {
    const VIEW = viewOf(tactic);
    this.svg = el("svg", { viewBox: `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`, role: "img", "aria-label": label, class: `board${tactic.court === "full" ? " board-full" : ""}` }) as SVGSVGElement;
    parent.appendChild(this.svg);
    drawCourt(this.svg, tactic.court === "full");
    this.arrows = el("g", {}, this.svg);
    this.states = frames(tactic);
    this.timing = stepTimings(tactic.steps ?? []);
    this.total = this.timing.length ? this.timing[this.timing.length - 1].end : 0;
    const layer = el("g", { class: "players" }, this.svg);
    const start = this.states[0];
    for (const id of Object.keys(start?.pos ?? {})) {
      const g = el("g", {}, layer);
      if (isDefender(id)) {
        el("path", { d: "M -1 -1 L 1 1 M 1 -1 L -1 1", stroke: COLORS.defense, "stroke-width": 0.42, "stroke-linecap": "round", fill: "none" }, g);
        const t = el("text", { x: 1.15, y: 1.25, "font-size": 0.95, fill: COLORS.defense, "font-weight": 700, class: "pid" }, g);
        t.textContent = id.slice(1);
      } else {
        el("circle", { r: 1.3, fill: COLORS.offense, stroke: "#ffffff", "stroke-width": 0.18 }, g);
        const t = el("text", { y: 0.55, "text-anchor": "middle", "font-size": 1.55, fill: "#ffffff", "font-weight": 700, class: "pid" }, g);
        t.textContent = id;
      }
      this.players.set(id, g);
    }
    this.ball = el("circle", { r: 0.6, fill: COLORS.ball, stroke: INK, "stroke-width": 0.1 }, layer) as SVGCircleElement;
    this.render();
  }

  /** Suit chaque image (vue 3D) et chaque changement d'étape. Renvoie une fonction pour se désabonner. */
  subscribe(onFrame: FrameListener, onStep: (k: number) => void) {
    this.frameListeners.push(onFrame);
    this.stepListeners.push(onStep);
    if (this.last3d) onFrame(...this.last3d);
    onStep(this.step);
    return () => {
      this.frameListeners = this.frameListeners.filter((f) => f !== onFrame);
      this.stepListeners = this.stepListeners.filter((f) => f !== onStep);
    };
  }

  /** Copie du terrain et des flèches de l'étape, sans les joueurs (texture du sol en 3D). */
  /** Image complète du terrain (joueurs compris), pour la dessiner dans un canvas. */
  snapshotSvg(width = 1080): string {
    const clone = this.svg.cloneNode(true) as SVGSVGElement;
    const v = viewOf(this.tactic);
    clone.setAttribute("xmlns", NS);
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(Math.round((width * v.h) / v.w)));
    // Polices : le canvas ne voit pas les @font-face de la page, on garde une police système proche.
    clone.querySelectorAll("text").forEach((t) => t.setAttribute("font-family", "Arial Narrow, Arial, sans-serif"));
    return new XMLSerializer().serializeToString(clone);
  }

  floorSvg(): string {
    const clone = this.svg.cloneNode(true) as SVGSVGElement;
    clone.querySelector(".players")?.remove();
    clone.setAttribute("xmlns", NS);
    clone.setAttribute("width", "2240");
    clone.setAttribute("height", String(Math.round((2240 * viewOf(this.tactic).h) / 56)));
    return new XMLSerializer().serializeToString(clone);
  }

  /** Terrain entier ? */
  get full() {
    return this.tactic.court === "full";
  }

  get stepCount() {
    return this.timing.length;
  }

  /** Index de l'étape affichée à l'instant t (-1 avant la première). */
  private stepAt(t: number) {
    if (!this.timing.length || t <= 0) return -1;
    for (let i = this.timing.length - 1; i >= 0; i--) if (t >= this.timing[i].start) return i;
    return -1;
  }

  private render() {
    const k = this.stepAt(this.t);
    const before = this.states[k + 1 > 0 ? k : 0];
    const after = this.states[k + 1] ?? before;
    let pos = before.pos;
    let ballPos: Point | undefined;
    let inFlight = false;
    let flight: number | null = null;
    const holder = (s: BoardState, p: BoardState["pos"]) => (s.ball ? p[s.ball as PlayerId] : undefined);
    if (k >= 0) {
      const tm = this.timing[k];
      const local = this.t - tm.start;
      const km = tm.move ? Math.min(1, local / tm.move) : 1;
      const e = ease(km);
      pos = {};
      for (const id of Object.keys(after.pos) as PlayerId[]) pos[id] = lerp(before.pos[id] ?? after.pos[id]!, after.pos[id]!, e);
      const step = this.tactic.steps![k];
      const passer = holder(before, pos);
      if (step.p && passer) {
        const kp = tm.pass ? Math.max(0, Math.min(1, (local - tm.move) / tm.pass)) : km >= 1 ? 1 : 0;
        const receiver = pos[step.p as PlayerId];
        ballPos = receiver && kp > 0 ? lerp(passer, receiver, ease(kp)) : passer;
        inFlight = kp > 0 && kp < 1;
        if (inFlight) flight = kp;
      } else {
        ballPos = holder(after, pos);
      }
    } else {
      ballPos = holder(before, pos);
    }
    for (const [id, g] of this.players) {
      const p = pos[id as PlayerId];
      if (p) g.setAttribute("transform", `translate(${p[0]} ${p[1]})`);
    }
    if (ballPos) {
      const off = inFlight ? 0 : 0.95;
      this.ball.setAttribute("cx", String(ballPos[0] + off));
      this.ball.setAttribute("cy", String(ballPos[1] - off));
      this.ball.style.display = "";
    } else this.ball.style.display = "none";
    if (k !== this.step) {
      this.step = k;
      this.drawArrows(k);
      this.events.onStep?.(k);
      for (const f of this.stepListeners) f(k);
    }
    this.last3d = [pos, ballPos, flight];
    for (const f of this.frameListeners) f(pos, ballPos, flight);
  }

  private drawArrows(k: number) {
    this.arrows.replaceChildren();
    if (k < 0) return;
    const step = this.tactic.steps![k];
    const before = this.states[k], after = this.states[k + 1];
    for (const [id, mv] of Object.entries(step.m ?? {}) as [PlayerId, Move][]) {
      const from = before.pos[id];
      if (from) arrow(this.arrows, from, [mv[0], mv[1]], mv[2], isDefender(id));
    }
    if (step.p && before.ball) {
      const a = after.pos[before.ball as PlayerId], b = after.pos[step.p as PlayerId];
      if (a && b) arrow(this.arrows, a, b, "p", false);
    }
  }

  private tick = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.t += dt * this.rate;
    if (this.stopAt !== null && this.t >= this.stopAt) {
      this.t = this.stopAt;
      this.stopAt = null;
      this.render();
      this.pause();
      return;
    }
    if (this.t >= this.total) {
      if (this.loop) this.t = 0;
      else {
        this.t = this.total;
        this.render();
        this.pause();
        return;
      }
    }
    this.render();
    this.raf = requestAnimationFrame(this.tick);
  };

  play() {
    if (!this.timing.length) return;
    this.rate = 1;
    if (this.t >= this.total) this.t = 0;
    this.stopAt = null;
    this.run();
  }

  private run() {
    cancelAnimationFrame(this.raf);
    this.playing = true;
    this.events.onPlayState?.(true);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  pause() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.raf);
    this.stopAt = null;
    if (this.playing) {
      this.playing = false;
      this.events.onPlayState?.(false);
    }
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  /** Durée normale du mouvement de l'étape k (déplacements puis passe), en secondes. */
  motionOf(k: number) {
    const tm = this.timing[k];
    return tm ? tm.move + tm.pass : 0;
  }

  /**
   * Va à l'étape k (-1 = départ). Anime le déplacement sauf si reduce.
   * seconds : durée voulue du mouvement (pour qu'il se déroule pendant que la voix décrit l'étape).
   */
  goTo(k: number, reduce: boolean, seconds?: number) {
    const n = this.timing.length;
    k = Math.max(-1, Math.min(n - 1, k));
    this.pause();
    if (k < 0) {
      this.t = 0;
      this.render();
      return;
    }
    const tm = this.timing[k];
    const settled = tm.start + tm.move + tm.pass + 0.001;
    this.rate = seconds && seconds > 0 && tm.move + tm.pass > 0 ? (tm.move + tm.pass) / seconds : 1;
    if (reduce) {
      this.t = settled;
      this.render();
    } else {
      this.t = tm.start + 0.0001;
      this.render();
      this.stopAt = settled;
      this.run();
    }
  }

  next(reduce: boolean) {
    this.goTo(this.step + 1, reduce);
  }

  prev(reduce: boolean) {
    this.goTo(this.step - 1, reduce);
  }

  /** Lecture sans mouvement (prefers-reduced-motion) : une étape par temps de lecture. */
  playStatic(onDone?: () => void) {
    this.pause();
    let k = this.step;
    const advance = () => {
      if (k >= this.timing.length - 1) {
        if (this.loop) k = -2;
        else {
          this.playing = false;
          this.events.onPlayState?.(false);
          onDone?.();
          return;
        }
      }
      k++;
      this.goTo(k, true);
      this.playing = true;
      this.events.onPlayState?.(true);
      const wait = k < 0 ? 2.5 : this.timing[k].read;
      this.raf = window.setTimeout(advance, wait * 1000) as unknown as number;
    };
    this.playing = true;
    this.events.onPlayState?.(true);
    advance();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.raf);
    this.svg.remove();
  }
}
