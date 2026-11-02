// Vue 3D (three.js) : suit la même animation que le terrain SVG.
// Le sol est le dessin SVG du terrain et des flèches de l'étape ; les joueurs et le ballon sont en volume.
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { COLORS, isDefender, viewOf, type PlayerId, type Point } from "./engine";
import type { Board } from "./board";

const BALL_H = 3.4;

function label(text: string, color: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = color;
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.font = "700 70px 'Barlow Condensed', 'Arial Narrow', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
  s.scale.set(2.2, 2.2, 1);
  s.renderOrder = 10;
  return s;
}

function player(id: string) {
  const defender = isDefender(id);
  const color = defender ? COLORS.defense : COLORS.offense;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.05, 4.2, 24), mat);
  body.position.y = 2.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 20, 16), mat);
  head.position.y = 4.95;
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  const tag = label(defender ? id.slice(1) : id, color);
  tag.position.y = 6.7;
  g.add(shadow, body, head, tag);
  for (const m of [body, head]) m.castShadow = true;
  return g;
}

export class Board3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private floorMat: THREE.MeshStandardMaterial;
  private players = new Map<string, THREE.Group>();
  private ball: THREE.Mesh;
  private unsubscribe!: () => void;
  private resize!: ResizeObserver;
  private raf = 0;
  private floorToken = 0;

  constructor(private host: HTMLElement, private board: Board, ids: string[], opts: { autoRotate?: boolean } = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.classList.add("board3d-canvas");

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
    const full = board.full;
    const VIEW = viewOf({ court: full ? "full" : undefined });
    // Terrain entier : caméra plus haute et plus loin, sur le côté de la ligne médiane.
    if (full) this.camera.position.set(25, 140, 115);
    else this.camera.position.set(25, 44, 66);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(25, 0, full ? 47 : 19);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 20;
    this.controls.maxDistance = full ? 240 : 110;
    this.controls.autoRotate = !!opts.autoRotate;
    this.controls.autoRotateSpeed = 0.7;
    this.controls.addEventListener("start", () => (this.controls.autoRotate = false));
    this.controls.update();

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a45, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(10, 60, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, full ? { left: -70, right: 70, top: 70, bottom: -70 } : { left: -40, right: 40, top: 40, bottom: -40 });
    sun.target.position.set(25, 0, full ? 47 : 20);
    this.scene.add(sun, sun.target);

    // Sol : le plan couvre exactement la vue du SVG (x de -3 à 53, y de -4 à 48).
    this.floorMat = new THREE.MeshStandardMaterial({ color: COLORS.court, roughness: 0.8 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(VIEW.w, VIEW.h), this.floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(VIEW.x + VIEW.w / 2, 0, VIEW.y + VIEW.h / 2);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Panier(s) : poteau, planche, cercle. Le second panier (terrain entier) est le symétrique en y = 94.
    for (const mirror of full ? [false, true] : [false]) this.scene.add(this.hoop(mirror));

    for (const id of ids) {
      const p = player(id);
      this.players.set(id, p);
      this.scene.add(p);
    }
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 16), new THREE.MeshStandardMaterial({ color: COLORS.ball, roughness: 0.6 }));
    this.ball.castShadow = true;
    this.scene.add(this.ball);
    this.start(host, board);
  }

  private hoop(mirror: boolean) {
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const board3 = new THREE.Mesh(new THREE.BoxGeometry(6, 3.5, 0.15), white);
    board3.position.set(25, 11.5, 4);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.07, 10, 32), new THREE.MeshStandardMaterial({ color: COLORS.ball }));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(25, 10, 5.25);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 11.5, 12), new THREE.MeshStandardMaterial({ color: 0x3a4459 }));
    pole.position.set(25, 5.75, -2.5);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 6.5), pole.material);
    arm.position.set(25, 11.3, 0.75);
    g.add(board3, rim, pole, arm);
    if (mirror) {
      // Demi-tour autour de l'axe vertical : (x, z) → (50 - x, 94 - z).
      g.rotation.y = Math.PI;
      g.position.set(50, 0, 94);
    }
    return g;
  }

  private start(host: HTMLElement, board: Board) {
    this.resize = new ResizeObserver(() => this.fit());
    this.resize.observe(host);
    this.fit();
    this.unsubscribe = board.subscribe(
      (pos, ball, flight) => this.place(pos, ball, flight),
      () => this.refreshFloor(),
    );
    const loop = () => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  private fit() {
    const w = this.host.clientWidth || 600;
    const h = Math.round(w * (this.board.full ? 1.15 : 0.78)); // terrain entier : cadre plus haut
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "auto";
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private place(pos: Partial<Record<PlayerId, Point>>, ball: Point | undefined, flight: number | null) {
    for (const [id, g] of this.players) {
      const p = pos[id as PlayerId];
      g.visible = !!p;
      if (p) g.position.set(p[0], 0, p[1]);
    }
    this.ball.visible = !!ball;
    if (ball) {
      const lift = flight === null ? 0 : Math.sin(Math.PI * flight) * 3;
      const off = flight === null ? 1 : 0;
      this.ball.position.set(ball[0] + off, BALL_H + lift, ball[1] - off * 0.2 + (flight === null ? 0.9 : 0));
    }
  }

  /** Redessine le sol à partir du SVG (terrain + flèches de l'étape). */
  private refreshFloor() {
    const token = ++this.floorToken;
    const img = new Image();
    img.onload = () => {
      if (token !== this.floorToken) return;
      const c = document.createElement("canvas");
      c.width = 2240;
      c.height = 2080;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      this.floorMat.map?.dispose();
      this.floorMat.map = tex;
      this.floorMat.color.set(0xffffff);
      this.floorMat.needsUpdate = true;
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(this.board.floorSvg());
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.unsubscribe();
    this.resize.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
        (x as THREE.MeshStandardMaterial).map?.dispose();
        x.dispose();
      });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
