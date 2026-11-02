// Montage : la vidéo de l'utilisateur (Short, Reel, extrait de match) en haut, le schéma animé du coach en bas,
// la voix qui explique chaque étape, puis un MP4 à télécharger. Tout se passe dans le navigateur (canvas + MediaRecorder).
import { Board } from "./board";
import type { Lang, Tactic } from "./engine";

const W = 1080, H = 1920;
const COVER = 3; // secondes de miniature au début, comme les vidéos de la bibliothèque
const TOP = 860; // hauteur de la vidéo de l'utilisateur
const ORANGE = "#F08A24", RED = "#B31A1F", NIGHT = "#0B1220", MUTED = "#B8C2D6";

export interface MontageText {
  title: string; // nom de la fiche
  category: string;
  captions: string[]; // une légende par étape
  why: string;
  channel: string;
  labels: { start: string; step: (k: number, n: number) => string; why: string };
}

export interface MontageOptions {
  tactic: Tactic;
  lang: Lang;
  text: MontageText;
  /** Clips audio de la narration ([présentation, étapes…, conclusion]) ou null sans voix. */
  clips: () => Promise<string[] | null>;
  tr: (fr: string, en: string) => string;
}

function splitTitle(name: string): [string, string] {
  for (const sep of [" : ", ": ", " contre ", " vs ", " against "]) {
    const i = name.indexOf(sep);
    if (i > 0) return [name.slice(0, i), sep.includes(":") ? name.slice(i + sep.length) : name.slice(i + 1)];
  }
  const w = name.split(" ");
  if (w.length < 2) return [name, ""];
  let best = 1e9, cut = 1;
  for (let i = 1; i < w.length; i++) {
    const d = Math.abs(w.slice(0, i).join(" ").length - w.slice(i).join(" ").length);
    if (d < best) (best = d), (cut = i);
  }
  return [w.slice(0, cut).join(" "), w.slice(cut).join(" ")];
}

function fit(ctx: CanvasRenderingContext2D, s: string, width: number, size: number, weight = 700) {
  while (size > 24) {
    ctx.font = `${weight} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    if (ctx.measureText(s).width <= width) break;
    size -= 4;
  }
  return size;
}

function wrap(ctx: CanvasRenderingContext2D, s: string, width: number) {
  const lines: string[] = [];
  let cur = "";
  for (const word of s.split(/\s+/)) {
    const trial = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(trial).width > width && cur) (lines.push(cur), (cur = word));
    else cur = trial;
  }
  if (cur) lines.push(cur);
  return lines;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Montage {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private video: HTMLVideoElement;
  private boardHost: HTMLDivElement;
  private board: Board;
  private boardImg: HTMLImageElement | null = null;
  private pendingImg = false;
  private raf = 0;
  private t0 = 0;
  private step = -1;
  private credit = "";
  private fileUrl = "";
  private running = false;
  private alive = true;
  private audioCtx: AudioContext | null = null;
  private mix: { dest: MediaStreamAudioDestinationNode; voice: HTMLAudioElement; gain: GainNode } | null = null;

  constructor(private root: HTMLElement, private o: MontageOptions) {
    const tr = o.tr;
    root.innerHTML = `
      <div class="montage">
        <div class="montage-form">
          <label class="m-file"><span>${tr("1. Ta vidéo (Short, Reel, extrait de match)", "1. Your video (Short, Reel, game clip)")}</span>
            <input type="file" id="m-file" accept="video/*" /></label>
          <label><span>${tr("2. Auteur de la vidéo (obligatoire si ce n'est pas la tienne)", "2. Video author (required if it isn't yours)")}</span>
            <input type="text" id="m-credit" placeholder="@compte" autocomplete="off" maxlength="60" /></label>
          <label><span>${tr("3. Début de l'extrait (secondes)", "3. Clip start (seconds)")}</span>
            <input type="number" id="m-start" min="0" step="0.5" value="0" inputmode="decimal" /></label>
          <label class="f-check"><input type="checkbox" id="m-sound" checked /> <span>${tr("Garder le son de la vidéo (sous la voix)", "Keep the video's sound (under the voice)")}</span></label>
          <p class="m-actions"><button type="button" class="btn" id="m-go" disabled>🎬 ${tr("Créer le Short", "Make the Short")}</button></p>
          <p class="m-status" id="m-status" aria-live="polite">${tr("Choisis une vidéo pour commencer.", "Pick a video to start.")}</p>
          <p class="m-download" id="m-download" hidden></p>
          <p class="m-note">${tr(
            "Mentionne toujours l'auteur d'une vidéo qui n'est pas la tienne. Le montage se fait sur ton appareil : la vidéo n'est envoyée nulle part.",
            "Always credit the author of a video that isn't yours. Editing happens on your device: the video is not uploaded anywhere.",
          )}</p>
        </div>
        <div class="montage-preview"><canvas id="m-canvas" width="${W}" height="${H}" aria-label="${tr("Aperçu du Short", "Short preview")}"></canvas></div>
      </div>`;
    this.canvas = root.querySelector("#m-canvas")!;
    this.ctx = this.canvas.getContext("2d")!;
    this.video = Object.assign(document.createElement("video"), { playsInline: true, muted: true, loop: true, preload: "auto", crossOrigin: "anonymous" });
    this.video.setAttribute("playsinline", "");
    this.boardHost = Object.assign(document.createElement("div"), { className: "montage-board" });
    root.appendChild(this.boardHost);
    this.board = new Board(this.boardHost, o.tactic, { onStep: (k) => (this.step = k) }, o.text.title);
    this.board.subscribe(() => this.refreshBoard(), () => this.refreshBoard());
    this.refreshBoard();

    const file = root.querySelector<HTMLInputElement>("#m-file")!;
    const go = root.querySelector<HTMLButtonElement>("#m-go")!;
    const credit = root.querySelector<HTMLInputElement>("#m-credit")!;
    file.addEventListener("change", () => {
      const f = file.files?.[0];
      if (!f) return;
      if (this.fileUrl) URL.revokeObjectURL(this.fileUrl);
      this.fileUrl = URL.createObjectURL(f);
      this.video.src = this.fileUrl;
      this.video.play().catch(() => {});
      go.disabled = false;
      this.status(tr("Vidéo prête. Ajoute l'auteur, puis « Créer le Short ».", "Video ready. Add the author, then “Make the Short”."));
    });
    credit.addEventListener("input", () => (this.credit = credit.value.trim()));
    go.addEventListener("click", () => this.record());
    document.fonts?.load('700 40px "Barlow Condensed"').catch(() => {});
    const loop = () => {
      if (!this.alive) return;
      this.draw(this.running ? (performance.now() - this.t0) / 1000 : COVER + 0.5);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  private status(s: string) {
    this.root.querySelector("#m-status")!.textContent = s;
  }

  /** Le schéma SVG est redessiné en image à chaque changement (au plus une image en cours de décodage). */
  private refreshBoard() {
    if (this.pendingImg) return;
    this.pendingImg = true;
    const img = new Image();
    img.onload = () => {
      this.boardImg = img;
      this.pendingImg = false;
    };
    img.onerror = () => (this.pendingImg = false);
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(this.board.snapshotSvg(1000));
  }

  private drawCover(c: CanvasRenderingContext2D) {
    c.fillStyle = "#E9C89B";
    c.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 76) (c.fillStyle = "#DDB886"), c.fillRect(x, 0, 38, H);
    if (this.boardImg) c.drawImage(this.boardImg, 40, 280, 1000, (1000 * this.boardImg.height) / this.boardImg.width);
    c.fillStyle = "rgba(0,0,0,.18)";
    c.fillRect(0, 0, W, H);
    c.fillStyle = RED;
    c.fillRect(0, 0, W, 120);
    c.fillStyle = "#fff";
    c.textAlign = "center";
    c.font = `700 52px "Barlow Condensed", "Arial Narrow", sans-serif`;
    c.fillText(this.o.text.channel.toUpperCase(), W / 2, 80);
    const [l1, l2] = splitTitle(this.o.text.title);
    const bh = 0.36 * H;
    c.save();
    c.translate(W / 2, H * 0.52);
    c.rotate(-0.1);
    c.fillStyle = RED;
    c.fillRect(-W, -bh / 2 - 14, 2 * W, bh + 28);
    c.fillStyle = "#0A0A0D";
    c.fillRect(-W, -bh / 2, 2 * W, bh);
    const s1 = fit(c, l1.toUpperCase(), W * 0.86, bh * (l2 ? 0.42 : 0.6));
    const s2 = l2 ? fit(c, l2.toUpperCase(), W * 0.86, bh * 0.36) : 0;
    const total = s1 * 0.8 + (l2 ? s2 * 0.8 + bh * 0.06 : 0);
    let y = -total / 2 + s1 * 0.8;
    c.font = `700 ${s1}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    c.fillStyle = ORANGE;
    c.fillText(l1.toUpperCase(), 0, y);
    if (l2) {
      y += bh * 0.06 + s2 * 0.8;
      c.font = `700 ${s2}px "Barlow Condensed", "Arial Narrow", sans-serif`;
      c.fillStyle = "#fff";
      c.fillText(l2.toUpperCase(), 0, y);
    }
    c.restore();
  }

  private draw(t: number) {
    const c = this.ctx;
    if (t < COVER) return this.drawCover(c);
    c.fillStyle = NIGHT;
    c.fillRect(0, 0, W, H);
    // Haut : la vidéo de l'utilisateur, recadrée pour remplir la zone.
    const v = this.video;
    if (v.readyState >= 2 && v.videoWidth) {
      const k = Math.max(W / v.videoWidth, TOP / v.videoHeight);
      const dw = v.videoWidth * k, dh = v.videoHeight * k;
      c.save();
      c.beginPath();
      c.rect(0, 0, W, TOP);
      c.clip();
      c.drawImage(v, (W - dw) / 2, (TOP - dh) / 2, dw, dh);
      c.restore();
    } else {
      c.fillStyle = "#1A2438";
      c.fillRect(0, 0, W, TOP);
    }
    // Bandeau titre par-dessus la vidéo, crédit en bas à gauche.
    const g = c.createLinearGradient(0, 0, 0, 170);
    g.addColorStop(0, "rgba(0,0,0,.75)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, W, 170);
    c.textAlign = "center";
    c.fillStyle = ORANGE;
    c.font = `700 36px "Barlow Condensed", "Arial Narrow", sans-serif`;
    c.fillText(this.o.text.category.toUpperCase(), W / 2, 56);
    c.fillStyle = "#fff";
    const ts = fit(c, this.o.text.title.toUpperCase(), W - 80, 72);
    c.font = `700 ${ts}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    c.fillText(this.o.text.title.toUpperCase(), W / 2, 56 + ts);
    if (this.credit) {
      c.font = `600 34px "Barlow", Arial, sans-serif`;
      const label = `🎥 ${this.credit}`;
      const w = c.measureText(label).width + 36;
      c.fillStyle = "rgba(0,0,0,.6)";
      c.fillRect(24, TOP - 70, w, 52);
      c.fillStyle = "#fff";
      c.textAlign = "left";
      c.fillText(label, 42, TOP - 32);
    }
    // Milieu : étape et légende.
    c.fillStyle = "#121B2E";
    c.fillRect(0, TOP, W, 200);
    const n = this.o.text.captions.length;
    const k = this.step;
    const end = this.running && k >= n - 1 && this.ending;
    c.textAlign = "center";
    c.fillStyle = ORANGE;
    c.font = `700 40px "Barlow Condensed", "Arial Narrow", sans-serif`;
    c.fillText(end ? this.o.text.labels.why : k < 0 ? this.o.text.labels.start : this.o.text.labels.step(k + 1, n), W / 2, TOP + 54);
    c.fillStyle = "#fff";
    c.font = `600 40px "Barlow", Arial, sans-serif`;
    const lines = wrap(c, end ? this.o.text.why : k < 0 ? "" : this.o.text.captions[k], W - 100).slice(0, 3);
    lines.forEach((line, i) => c.fillText(line, W / 2, TOP + 108 + i * 46));
    // Bas : le schéma du coach.
    if (this.boardImg) {
      const bw = 980, bh = (bw * this.boardImg.height) / this.boardImg.width;
      const room = H - TOP - 200 - 110;
      const s = Math.min(1, room / bh);
      c.drawImage(this.boardImg, (W - bw * s) / 2, TOP + 210, bw * s, bh * s);
    }
    c.fillStyle = MUTED;
    c.font = `700 34px "Barlow Condensed", "Arial Narrow", sans-serif`;
    c.fillText(this.o.text.channel.toUpperCase(), W / 2, H - 40);
  }

  private ending = false;

  private async record() {
    if (this.running) return;
    const tr = this.o.tr;
    const go = this.root.querySelector<HTMLButtonElement>("#m-go")!;
    const dl = this.root.querySelector<HTMLElement>("#m-download")!;
    if (typeof MediaRecorder === "undefined" || !this.canvas.captureStream) {
      this.status(tr("Ton navigateur ne peut pas enregistrer de vidéo. Essaie avec Chrome ou Safari à jour.", "Your browser can't record video. Try an up-to-date Chrome or Safari."));
      return;
    }
    go.disabled = true;
    dl.hidden = true;
    this.status(tr("Préparation…", "Preparing…"));
    const clips = await this.o.clips().catch(() => null);
    // Son : voix (clips) + son de la vidéo, mélangés dans un flux audio enregistré avec l'image.
    // Un élément audio ou vidéo ne peut être branché qu'une fois : le mélangeur est créé au premier montage.
    const ac = (this.audioCtx ??= new AudioContext());
    await ac.resume().catch(() => {});
    if (!this.mix) {
      const dest = ac.createMediaStreamDestination();
      const voice = Object.assign(new Audio(), { crossOrigin: "anonymous" });
      const vSrc = ac.createMediaElementSource(voice);
      vSrc.connect(dest);
      vSrc.connect(ac.destination);
      const gain = ac.createGain();
      const clipSrc = ac.createMediaElementSource(this.video);
      clipSrc.connect(gain);
      gain.connect(dest);
      gain.connect(ac.destination);
      this.mix = { dest, voice, gain };
    }
    const { dest, voice, gain } = this.mix;
    gain.gain.value = this.root.querySelector<HTMLInputElement>("#m-sound")!.checked ? 0.35 : 0;
    this.video.muted = false;

    const stream = this.canvas.captureStream(30);
    dest.stream.getAudioTracks().forEach((tk) => stream.addTrack(tk));
    const mime = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((r) => (rec.onstop = () => r()));

    const say = (i: number) =>
      new Promise<void>((resolve) => {
        if (!clips?.[i]) return resolve();
        voice.src = clips[i];
        voice.onended = () => resolve();
        voice.onerror = () => resolve();
        voice.play().catch(() => resolve());
      });

    this.board.goTo(-1, true);
    // La vidéo est placée au début de l'extrait pendant la miniature, puis démarre juste après.
    this.video.pause();
    const start = Number(this.root.querySelector<HTMLInputElement>("#m-start")!.value) || 0;
    this.video.currentTime = Math.min(start, Math.max(0, (this.video.duration || 0) - 0.5));
    // L'enregistreur met un moment à démarrer : le chrono (et donc la miniature) part quand il tourne vraiment.
    this.running = true;
    this.ending = false;
    this.t0 = performance.now();
    const started = new Promise<void>((r) => (rec.onstart = () => r()));
    rec.start(1000);
    await started;
    this.t0 = performance.now();
    this.status(tr("Enregistrement en cours… garde cette page ouverte.", "Recording… keep this page open."));
    await wait(COVER * 1000);
    await this.video.play().catch(() => {});
    await Promise.all([say(0), wait(clips ? 0 : 3000)]);
    const n = this.o.text.captions.length;
    for (let k = 0; k < n && this.alive; k++) {
      this.board.goTo(k, false);
      await Promise.all([say(k + 1), wait(2600)]);
    }
    this.ending = true;
    await Promise.all([say(n + 1), wait(clips ? 0 : 4000)]);
    await wait(800);
    rec.stop();
    await done;
    this.running = false;
    this.video.pause();
    this.video.muted = true;
    const type = rec.mimeType || mime || "video/webm";
    const ext = type.includes("mp4") ? "mp4" : "webm";
    const url = URL.createObjectURL(new Blob(chunks, { type }));
    dl.hidden = false;
    dl.innerHTML = `<a class="btn" href="${url}" download="${this.o.tactic.id}-montage.${ext}">⬇ ${tr("Télécharger le Short", "Download the Short")} (${ext.toUpperCase()})</a>`;
    this.status(tr("C'est prêt !", "It's ready!"));
    go.disabled = false;
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.video.pause();
    if (this.fileUrl) URL.revokeObjectURL(this.fileUrl);
    this.board.destroy();
    this.audioCtx?.close().catch(() => {});
  }
}
