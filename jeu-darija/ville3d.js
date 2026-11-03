// La ville en 3D (façon Minecraft), dessinée avec Three.js (licence MIT, copié dans lib/ : marche hors ligne).
// On marche avec le joystick, on tourne la caméra en glissant le doigt, on saute, et on aide les habitants.
import { N, HMAX, B, SPAWN, makeWorld3d, solid, groundBelow, NPCS3D, spawnItems, questWord, coinSpots3d } from './ville3d-core.js';
import { askQuestion } from './ville-core.js';
import { screen, el, choose } from './act-kit.js';

// Couleurs des blocs : [couleur 1, couleur 2, détail]
const COL = {
  [B.GRASS]: ['#5cbf3a', '#4aa52c', '#7ad34f'], [B.SAND]: ['#e6c27a', '#d9ae62', '#f1d59a'], [B.WHITE]: ['#f4efe4', '#e6dfd0', '#ffffff'],
  [B.OCRE]: ['#e3a86b', '#d39456', '#efbd85'], [B.ZELLIGE]: ['#f4efe4', '#1f8a5b', '#2b5fb3'], [B.GREEN]: ['#2bb673', '#239a61', '#45c98a'],
  [B.GOLD]: ['#ffc93c', '#f0b52a', '#fff3a8'], [B.DOOR]: ['#6b4423', '#5a3a20', '#c8914f'], [B.PLANK]: ['#c8914f', '#b37e42', '#8f6232'],
  [B.TENT]: ['#e94f4f', '#f6c445', '#f4efe4'], [B.PALM]: ['#9a6b3c', '#86592f', '#6a4527'], [B.FROND]: ['#3c9a3f', '#2e7f33', '#6cc24a'],
  [B.WATER]: ['#3aa0e0', '#2b86c8', '#bfe9ff'], [B.WALL]: ['#c9824e', '#b8733f', '#d99560'], [B.STONE]: ['#e8e8e8', '#d0d0d0', '#ffffff'],
  [B.BLUE]: ['#2b5fb3', '#244f96', '#5a8fe0'], [B.CARPET]: ['#b22234', '#8e1b2a', '#f6c445'],
};
const LOOKS = {
  ali: { skin: '#e2b48c', hair: '#2b1b12', shirt: '#e5484d', pants: '#2b4a8a' },
  asma: { skin: '#f0c4a0', hair: '#3a2212', shirt: '#ff6fae', pants: '#7c4dcc' },
  maman: { skin: '#f0c4a0', hair: '#2bb673', shirt: '#2bb673', pants: '#ffffff' },
  papa: { skin: '#e2b48c', hair: '#2b1b12', shirt: '#c8323a', pants: '#2b2140' },
  hbibiti: { skin: '#f6cfaa', hair: '#d23a3f', shirt: '#7a48b8', pants: '#7a48b8' },
  boulanger: { skin: '#d9a77e', hair: '#ffffff', shirt: '#ffffff', pants: '#5a3a20' },
  maitresse: { skin: '#f0c4a0', hair: '#6b3a1a', shirt: '#3b7dd8', pants: '#2b2140' },
  imam: { skin: '#d9a77e', hair: '#ffffff', shirt: '#ffffff', pants: '#ffffff' },
  fifi: { skin: '#f4a259', hair: '#f4a259', shirt: '#00843d', pants: '#ffffff', emoji: '🦊' },
  assad: { skin: '#e0a43a', hair: '#b5651d', shirt: '#c8323a', pants: '#2b2140', emoji: '🦁' },
};

export async function ville3d(ctx) {
  const body = screen(ctx, '🧊 La ville en 3D', `🪙 ${ctx.P().progress.coins || 0}`);
  body.classList.add('v3-body');
  const wrap = el(`<div class="v3-wrap"><canvas class="v3-canvas"></canvas>
    <div class="v3-goal"><span class="v3-arrow">⬆️</span> <span class="v3-text">Chargement…</span></div>
    <div class="v3-stick"><div class="v3-knob"></div></div>
    <button class="v-btn v3-jump">⤴</button>
    <button class="go v3-talk" hidden>💬</button>
    <div class="v3-dialog act-card" hidden><p class="act-big v3-who"></p><p class="v3-say"></p><div class="act-choices v3-choices"></div><button class="go v3-ok">D'accord ➜</button></div>
  </div>`);
  body.append(wrap);
  let THREE;
  try { THREE = await import('./lib/three.module.min.js'); } catch { wrap.querySelector('.v3-text').textContent = 'La 3D ne marche pas sur cette tablette.'; return; }
  const canvas = wrap.querySelector('.v3-canvas');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' }); } catch { wrap.querySelector('.v3-text').textContent = 'La 3D ne marche pas sur cette tablette (WebGL).'; return; }
  renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#8fd3ff');
  scene.fog = new THREE.Fog('#8fd3ff', 30, 70);
  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight('#ffffff', '#6b8f4a', 1.1));
  const sun = new THREE.DirectionalLight('#fff2d6', 1.4); sun.position.set(20, 40, 10); scene.add(sun);

  // ----- Textures pixel (16 x 16, sans flou, comme Minecraft) -----
  const tex = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 16; draw(c.getContext('2d')); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const blockTex = (t) => tex((g) => {
    const [a, b2, hi] = COL[t];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = Math.random() < 0.5 ? a : b2;
      if (t === B.ZELLIGE) { const d = Math.abs((x % 8) - 3.5) + Math.abs((y % 8) - 3.5); c = d < 2 ? '#f6c445' : d < 3 ? b2 : d < 4 ? hi : a; }
      if (t === B.TENT) c = [a, hi, b2, hi][Math.floor(x / 4)];
      if (t === B.PLANK) c = y % 4 === 3 ? hi : c;
      if (t === B.DOOR || t === B.BLUE) c = (x === 0 || x === 15 || x === 7) ? COL[t][1] : (y % 5 === 2 && x % 7 === 3) ? hi : a;
      if (t === B.WATER) c = (y % 5 === 1 && (x + y) % 4 < 2) ? hi : c;
      if (t === B.CARPET) c = (x + y) % 6 === 0 || (x - y + 16) % 6 === 0 ? hi : a;
      if (t === B.WALL) c = (y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 0) ? b2 : a;
      g.fillStyle = c; g.fillRect(x, y, 1, 1);
    }
  });

  // ----- Le monde : un seul objet 3D par sorte de bloc, seulement les blocs visibles -----
  const world = makeWorld3d();
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const visible = (x, y, z) => [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => { const n = world.get(x + dx, y + dy, z + dz); return n === B.AIR || n === B.WATER || n === B.FROND; });
  const groups = {};
  for (let y = 0; y < HMAX; y++) for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const t = world.get(x, y, z);
    if (t !== B.AIR && (t === B.WATER || visible(x, y, z))) (groups[t] = groups[t] || []).push([x, y, z]);
  }
  const m4 = new THREE.Matrix4();
  for (const [t, list] of Object.entries(groups)) {
    const mat = new THREE.MeshLambertMaterial({ map: blockTex(+t), transparent: +t === B.WATER, opacity: +t === B.WATER ? 0.8 : 1 });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z], i) => { m4.makeTranslation(x + 0.5, y + (+t === B.WATER ? 0.35 : 0.5), z + 0.5); if (+t === B.WATER) m4.scale(new THREE.Vector3(1, 0.7, 1)); mesh.setMatrixAt(i, m4); });
    scene.add(mesh);
  }
  // Les montagnes de l'Atlas au loin, avec de la neige en haut.
  const mount = new THREE.MeshLambertMaterial({ color: '#a99ad6', flatShading: true });
  const snow = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, d = 60 + (i % 3) * 8, h = 14 + (i * 7) % 10;
    const m = new THREE.Mesh(new THREE.ConeGeometry(12, h, 5), mount); m.position.set(N / 2 + Math.cos(a) * d, h / 2 - 1, N / 2 + Math.sin(a) * d); scene.add(m);
    const s = new THREE.Mesh(new THREE.ConeGeometry(12 * 0.3, h * 0.3, 5), snow); s.position.set(m.position.x, h - h * 0.15 - 1, m.position.z); scene.add(s);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshLambertMaterial({ color: '#e6c27a' }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01; scene.add(ground);

  // ----- Personnages en blocs -----
  const emojiTex = (e, size = 128) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); g.font = `${size * 0.8}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, size / 2, size * 0.55); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const label = (text) => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.fillStyle = 'rgba(43,33,64,.75)'; g.beginPath(); g.roundRect(8, 8, 240, 48, 20); g.fill(); g.fillStyle = '#fff'; g.font = 'bold 28px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 33); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(1.6, 0.4, 1); return s; };
  const part = (w, h, d, color) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
  function person(look) {
    const L = LOOKS[look] || LOOKS.ali, g = new THREE.Group();
    const legL = part(0.22, 0.7, 0.22, L.pants), legR = part(0.22, 0.7, 0.22, L.pants);
    legL.geometry.translate(0, -0.35, 0); legR.geometry.translate(0, -0.35, 0);
    legL.position.set(-0.13, 0.7, 0); legR.position.set(0.13, 0.7, 0);
    const torso = part(0.55, 0.65, 0.3, L.shirt); torso.position.y = 1.02;
    const armL = part(0.18, 0.62, 0.2, L.shirt), armR = part(0.18, 0.62, 0.2, L.shirt);
    armL.geometry.translate(0, -0.28, 0); armR.geometry.translate(0, -0.28, 0);
    armL.position.set(-0.37, 1.3, 0); armR.position.set(0.37, 1.3, 0);
    g.add(legL, legR, torso, armL, armR);
    if (L.emoji) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(L.emoji) })); s.scale.set(0.8, 0.8, 1); s.position.y = 1.7; g.add(s); }
    else {
      const head = part(0.45, 0.45, 0.45, L.skin); head.position.y = 1.6;
      const hair = part(0.48, 0.14, 0.48, L.hair); hair.position.y = 1.86;
      const eye = (x) => { const e = part(0.07, 0.08, 0.02, '#2b2140'); e.position.set(x, 1.64, 0.23); return e; };
      g.add(head, hair, eye(-0.1), eye(0.1));
    }
    g.userData = { legL, legR, armL, armR };
    return g;
  }
  const kid = ctx.P().kid;
  const hero = person(kid.older ? 'ali' : 'asma'); scene.add(hero);
  const npcs = NPCS3D.map((n) => {
    const m = person(n.look); m.position.set(n.x, 1, n.z); m.rotation.y = Math.atan2(SPAWN[0] - n.x, SPAWN[1] - n.z); scene.add(m);
    const tag = label(n.name); tag.position.set(n.x, 3.1, n.z); scene.add(tag);
    const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex('❗') })); mark.scale.set(0.6, 0.6, 1); mark.position.set(n.x, 3.6, n.z); scene.add(mark);
    return { ...n, mesh: m, mark, step: 0, seed: Math.floor(Math.random() * 1e6), round: 0 };
  });

  // ----- Pièces et objets à trouver -----
  const coinMat = new THREE.MeshLambertMaterial({ color: '#ffc93c', emissive: '#7a5a00' });
  const coins = coinSpots3d(world).map((c) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 12), coinMat); m.rotation.z = Math.PI / 2; m.position.set(c.x, c.y, c.z); scene.add(m); return { ...c, mesh: m }; });
  let fetch = null; // { npc, word, items: [{x,y,z,mesh,taken}] }

  // ----- Joueur : position, physique, caméra -----
  const p = { x: SPAWN[0], y: 1, z: SPAWN[1], vy: 0, onGround: true, yaw: 0, pitch: 0.35, walk: 0 };
  const keys = {};
  const stick = { x: 0, y: 0, id: null, cx: 0, cy: 0 }, look = { id: null, x: 0, y: 0 };
  let jumpQueued = false, dialog = false, near = null, raf = 0, last = performance.now(), t = 0, leaving = false;
  const R = 0.3, H = 1.7, SPEED = 4.2, GRAV = 22, JUMP = 7.6;
  const hitAt = (x, y, z) => [[-R, -R], [R, -R], [-R, R], [R, R]].some(([dx, dz]) => solid(world, x + dx, y + 0.05, z + dz) || solid(world, x + dx, y + 0.9, z + dz) || solid(world, x + dx, y + H - 0.05, z + dz));
  function physics(dt) {
    let mx = (keys.d ? 1 : 0) - (keys.a ? 1 : 0) + stick.x, mz = (keys.s ? 1 : 0) - (keys.w ? 1 : 0) + stick.y;
    const len = Math.hypot(mx, mz); if (len > 1) { mx /= len; mz /= len; }
    const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
    const vx = (-mz * sin - mx * cos) * SPEED, vz = (-mz * cos + mx * sin) * SPEED; // devant = là où regarde la caméra
    if (len > 0.1) { hero.rotation.y = Math.atan2(vx, vz); p.walk += dt * 10; } else p.walk = 0;
    const nx = p.x + vx * dt; if (!hitAt(nx, p.y, p.z)) p.x = nx;
    const nz = p.z + vz * dt; if (!hitAt(p.x, p.y, nz)) p.z = nz;
    if ((jumpQueued || keys[' ']) && p.onGround) { p.vy = JUMP; p.onGround = false; ctx.sfx('boing'); }
    jumpQueued = false;
    p.vy -= GRAV * dt;
    let ny = p.y + p.vy * dt;
    if (p.vy > 0 && hitAt(p.x, ny, p.z)) { p.vy = 0; ny = p.y; }
    const floor = Math.max(...[[-R, -R], [R, -R], [-R, R], [R, R]].map(([dx, dz]) => groundBelow(world, p.x + dx, p.z + dz, p.y + 0.4)));
    if (ny <= floor) { ny = floor; p.vy = 0; p.onGround = true; } else p.onGround = false;
    p.y = ny;
  }
  function placeCamera() {
    const d = 5.5, h = 1.4;
    const cx = p.x - Math.sin(p.yaw) * Math.cos(p.pitch) * d, cz = p.z - Math.cos(p.yaw) * Math.cos(p.pitch) * d, cy = p.y + h + Math.sin(p.pitch) * d;
    // La caméra ne traverse pas les murs : on la rapproche d'Ali jusqu'au premier bloc.
    const hx = p.x, hy = p.y + 1.4, hz = p.z;
    let k = 1;
    for (let f = 0.1; f <= 1; f += 0.05) if (solid(world, hx + (cx - hx) * f, hy + (cy - hy) * f, hz + (cz - hz) * f)) { k = Math.max(0.12, f - 0.08); break; }
    camera.position.set(hx + (cx - hx) * k, Math.max(hy + (cy - hy) * k, 1.2), hz + (cz - hz) * k); camera.lookAt(p.x, p.y + 1.3, p.z);
  }

  // ----- Commandes tactiles : joystick à gauche, glisser à droite pour tourner, bouton saut -----
  const stickEl = wrap.querySelector('.v3-stick'), knob = wrap.querySelector('.v3-knob');
  stickEl.addEventListener('pointerdown', (e) => { stick.id = e.pointerId; const r = stickEl.getBoundingClientRect(); stick.cx = r.left + r.width / 2; stick.cy = r.top + r.height / 2; stickEl.setPointerCapture(e.pointerId); moveStick(e); });
  const moveStick = (e) => { if (e.pointerId !== stick.id) return; const dx = e.clientX - stick.cx, dy = e.clientY - stick.cy, m = 50, l = Math.min(m, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); stick.x = (Math.cos(a) * l) / m; stick.y = (Math.sin(a) * l) / m; knob.style.transform = `translate(${stick.x * 40}px, ${stick.y * 40}px)`; };
  const endStick = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  stickEl.addEventListener('pointermove', moveStick); stickEl.addEventListener('pointerup', endStick); stickEl.addEventListener('pointercancel', endStick);
  canvas.addEventListener('pointerdown', (e) => { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (e.pointerId !== look.id) return; p.yaw -= (e.clientX - look.x) * 0.008; p.pitch = Math.max(0.05, Math.min(1.2, p.pitch + (e.clientY - look.y) * 0.005)); look.x = e.clientX; look.y = e.clientY; });
  const endLook = (e) => { if (e.pointerId === look.id) look.id = null; };
  canvas.addEventListener('pointerup', endLook); canvas.addEventListener('pointercancel', endLook);
  wrap.querySelector('.v3-jump').addEventListener('pointerdown', (e) => { e.preventDefault(); jumpQueued = true; });
  const kmap = { ArrowUp: 'w', z: 'w', w: 'w', ArrowDown: 's', s: 's', ArrowLeft: 'a', q: 'a', a: 'a', ArrowRight: 'd', d: 'd', ' ': ' ' };
  const kd = (e) => { if (dialog) return; const k = kmap[e.key]; if (k) { keys[k] = true; e.preventDefault(); } if ((e.key === 'Enter' || e.key === 'e') && near) talk(near); };
  const ku = (e) => { const k = kmap[e.key]; if (k) keys[k] = false; };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  const talkBtn = wrap.querySelector('.v3-talk');
  talkBtn.onclick = () => near && talk(near);

  // ----- Les habitants : une question de darija, puis « trouve-moi 3 … » -----
  const dlg = wrap.querySelector('.v3-dialog');
  function openDialog(npc, text, sayIt = true) {
    dialog = true; dlg.hidden = false; keys.w = keys.a = keys.s = keys.d = false; stick.x = stick.y = 0;
    dlg.querySelector('.v3-who').textContent = npc.name; dlg.querySelector('.v3-say').textContent = text;
    dlg.querySelector('.v3-choices').innerHTML = ''; dlg.querySelector('.v3-ok').hidden = false;
    if (sayIt) ctx.say(text);
    return new Promise((res) => { dlg.querySelector('.v3-ok').onclick = () => { ctx.sfx('tap'); dlg.hidden = true; dialog = false; ctx.stopVoice(); res(); }; });
  }
  async function talk(npc) {
    if (dialog) return;
    p.yaw = Math.atan2(npc.x - p.x, npc.z - p.z); // Ali se tourne vers l'habitant
    hero.rotation.y = p.yaw;
    if (fetch?.npc === npc) {
      if (fetch.items.every((i) => i.taken)) {
        const w = fetch.word; fetch = null; npc.step = 2; npc.mark.visible = false;
        ctx.stars(2); ctx.sfx('win'); ctx.confetti(60);
        const ds = ctx.settings.dialects;
        const pr = openDialog(npc, `Merci beaucoup ! ${w.emoji} En darija, on dit : ${ds.map((d) => w[d].lat).join(' / ')}`, false);
        ctx.say('Merci beaucoup ! En darija, on dit :', ...ds.map((d) => ({ word: w, d })));
        return pr;
      }
      return openDialog(npc, `Il me manque encore ${fetch.items.filter((i) => !i.taken).length} ${fetch.word.emoji}. Cherche bien, même sur les toits !`);
    }
    if (npc.step === 0) {
      const q = askQuestion(npc, npc, { older: kid.older, dialects: ctx.settings.dialects });
      dialog = true; dlg.hidden = false; dlg.querySelector('.v3-who').textContent = npc.name; dlg.querySelector('.v3-ok').hidden = true;
      const w = q.word, d = q.dialect;
      let label2;
      if (q.type === 'listen') { dlg.querySelector('.v3-say').textContent = '🔊 Écoute bien et trouve la bonne image !'; ctx.say("Salam ! J'ai une question pour toi.", 'Écoute bien.', { word: w, d }); label2 = (c) => `<span style="font-size:38px">${c.word.emoji}</span>`; }
      else if (q.type === 'fr2dz') { dlg.querySelector('.v3-say').textContent = `Comment on dit « ${w.fr} » ${ctx.DIALECT_NAME[d]} ${ctx.FLAG[d]} ?`; ctx.say("Salam ! J'ai une question pour toi.", `Comment on dit ${w.fr}, ${ctx.DIALECT_NAME[d]} ?`); label2 = (c) => ctx.esc(c.word[d].lat); }
      else { const o = q.other; dlg.querySelector('.v3-say').textContent = `${ctx.FLAG[d]} On dit « ${w[d].lat} ». Et ${ctx.DIALECT_NAME[o]} ${ctx.FLAG[o]} ?`; ctx.say(`${ctx.cap(ctx.DIALECT_NAME[d])}, on dit :`, { word: w, d }, `Et ${ctx.DIALECT_NAME[o]} ?`); label2 = (c) => ctx.esc(c.word[o].lat); }
      const ok = await choose(ctx, dlg.querySelector('.v3-choices'), q.choices.map((c) => ({ html: label2(c), correct: c.correct })),
        { onRight: () => ctx.say(ctx.praise(), { word: w, d: q.type === 'cousin' ? q.other : d }), onWrong: () => ctx.say("C'était celui-là !", { word: w, d: q.type === 'cousin' ? q.other : d }) });
      if (ok) ctx.stars(1);
      npc.step = 1; dlg.querySelector('.v3-ok').hidden = false; dlg.querySelector('.v3-ok').textContent = 'Merci ! ➜';
      return new Promise((res) => { dlg.querySelector('.v3-ok').onclick = () => { dlg.hidden = true; dialog = false; dlg.querySelector('.v3-ok').textContent = "D'accord ➜"; res(); }; });
    }
    if (npc.step === 1) {
      if (fetch) return openDialog(npc, `Finis d'abord la mission de ${fetch.npc.name}, puis reviens me voir !`);
      const word = questWord(npc, kid.older);
      const spots = spawnItems(world, npc);
      const mat = new THREE.SpriteMaterial({ map: emojiTex(word.emoji) });
      fetch = { npc, word, items: spots.map((s) => { const m = new THREE.Sprite(mat); m.scale.set(0.9, 0.9, 1); m.position.set(s.x, s.y + 0.6, s.z); scene.add(m); return { ...s, mesh: m }; }) };
      ctx.say(`Peux-tu me trouver 3 fois : ${word.fr} ? Ils sont cachés dans la ville.`);
      return openDialog(npc, `Peux-tu me trouver 3 ${word.emoji} ? Ils sont cachés dans la ville, parfois sur un toit !`, false);
    }
    return openDialog(npc, 'Merci pour ton aide ! Va voir les autres habitants.');
  }

  // ----- Objectif et flèche -----
  function goal() {
    if (fetch) {
      const left = fetch.items.filter((i) => !i.taken);
      if (left.length) { const n = left.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0]; return { text: `Trouve ${left.length} ${fetch.word.emoji} pour ${fetch.npc.name}`, x: n.x, z: n.z }; }
      return { text: `Rapporte les ${fetch.word.emoji} à ${fetch.npc.name}`, x: fetch.npc.x, z: fetch.npc.z };
    }
    const n = npcs.filter((m) => m.step < 2).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    return n ? { text: `Va voir ${n.name} ❗`, x: n.x, z: n.z } : { text: 'Bravo ! Toute la ville est contente 🎉', x: null };
  }
  const arrowEl = wrap.querySelector('.v3-arrow'), textEl = wrap.querySelector('.v3-text');

  // ----- Boucle -----
  function resize() { const r = wrap.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize);
  function loop(now) {
    if (leaving) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (!dialog) physics(dt);
    hero.position.set(p.x, p.y, p.z);
    const sw = Math.sin(p.walk) * 0.6, u = hero.userData;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw; u.armL.rotation.x = -sw; u.armR.rotation.x = sw;
    for (const c of coins) if (!c.taken) {
      c.mesh.rotation.y += dt * 3;
      if (Math.hypot(c.x - p.x, c.z - p.z) < 0.7 && Math.abs(c.y - (p.y + 0.6)) < 1) {
        c.taken = true; scene.remove(c.mesh); ctx.sfx('pop');
        const pr = ctx.P().progress; pr.coins = (pr.coins || 0) + 1; ctx.saveAll(); ctx.$('#act-pill').textContent = `🪙 ${pr.coins}`;
      }
    }
    if (fetch) for (const it of fetch.items) if (!it.taken) {
      it.mesh.position.y = it.y + 0.6 + Math.sin(t * 3 + it.id) * 0.15;
      if (Math.hypot(it.x - p.x, it.z - p.z) < 0.8 && Math.abs(it.y - p.y) < 1.2) {
        it.taken = true; scene.remove(it.mesh); ctx.sfx('chime');
        const left = fetch.items.filter((i) => !i.taken).length;
        ctx.say(left ? `Encore ${left} !` : `Tu as tout trouvé ! Retourne voir ${fetch.npc.name}.`);
      }
    }
    for (const n of npcs) n.mark.position.y = 3.6 + Math.sin(t * 3 + n.x) * 0.1;
    near = npcs.find((n) => Math.hypot(n.x - p.x, n.z - p.z) < 1.8) || null;
    talkBtn.hidden = !near || dialog; if (near) talkBtn.textContent = `💬 ${near.name}`;
    const g = goal(); textEl.textContent = g.text;
    if (g.x != null) { const a = Math.atan2(g.x - p.x, g.z - p.z) - p.yaw; arrowEl.style.transform = `rotate(${-a * 180 / Math.PI}deg)`; arrowEl.style.opacity = 1; } else arrowEl.style.opacity = 0;
    placeCamera();
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  resize();
  raf = requestAnimationFrame(loop);
  ctx.say(`Bienvenue dans la ville en 3D ! Glisse le doigt pour tourner, et utilise le rond pour marcher.`);
  document.addEventListener('act-leave', () => {
    leaving = true; cancelAnimationFrame(raf);
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize);
    renderer.dispose(); body.classList.remove('v3-body');
  }, { once: true });
  if (new URLSearchParams(location.search).has('e2e')) window.__v3 = { p, npcs, get fetch() { return fetch; }, talk, teleport: (x, z) => { p.x = x; p.z = z; p.y = groundBelow(world, x, z, HMAX); } };
}
