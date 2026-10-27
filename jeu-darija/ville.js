// La ville de Hbibiti : le monde en blocs (dessin, course, saut, habitants, objets à ramasser).
// La logique pure (plan, missions) est dans ville-core.js ; app.js fournit les joueurs, la voix et les récompenses.
import { H, W, GROUND, T, NPCS, ZONES, SHOP, makeWorld, isSolid, newQuests, askQuestion, fetchQuest, coinSpots, nextGiver, canPlace, applyBuild } from './ville-core.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Textures des blocs (petits dessins en pixels, agrandis sans flou) ----------
const PAL = {
  [T.GRASS]: ['#5cbf3a', '#4aa52c', '#7a5230', '#6a4527'], [T.DIRT]: ['#8a5a32', '#7a4e2a', '#9b6a3e', '#6a4527'],
  [T.STONE]: ['#8f939b', '#7c8089', '#a3a7ae', '#6d7178'], [T.PLANK]: ['#c8914f', '#b37e42', '#d9a463', '#8f6232'],
  [T.BRICK]: ['#b9563d', '#a64a33', '#d8c7b0', '#8f3d2a'], [T.LEAVES]: ['#3f9b3a', '#2f8530', '#58b14b', '#2a6e2a'],
  [T.LOG]: ['#7a5230', '#6a4527', '#8f6232', '#5a3a20'], [T.WHITE]: ['#f4efe4', '#e6dfd0', '#ffffff', '#d8cfbd'],
  [T.GLASS]: ['#8fd3f4', '#6fc1ea', '#c7ecff', '#4fa3d1'], [T.SAND]: ['#e94f4f', '#f6c445', '#f4efe4', '#3b7dd8'],
  [T.ROOF]: ['#c0392b', '#a93226', '#d35445', '#7f2a20'], [T.GREEN]: ['#2bb673', '#239a61', '#45c98a', '#1c7d4f'],
  [T.GOLD]: ['#ffc93c', '#f0b52a', '#ffe08a', '#c98f12'],
  [T.CARPET]: ['#b22234', '#8e1b2a', '#f6c445', '#1f4e9a'], [T.LANTERN]: ['#ffc93c', '#f0a020', '#fff3a8', '#7a4e2a'],
};
function makeTexture(t, seed) {
  const c = document.createElement('canvas'); c.width = 16; c.height = 16;
  const g = c.getContext('2d'); const [a, b, hi, lo] = PAL[t];
  let s = seed * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let col = r() < 0.5 ? a : b;
    if (t === T.GRASS) col = y < 4 + (r() < 0.3 ? 1 : 0) ? (r() < 0.5 ? a : b) : (r() < 0.6 ? hi : lo);
    if (t === T.BRICK) col = (y % 8 === 7 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 0) ? hi : (r() < 0.7 ? a : b);
    if (t === T.PLANK) col = y % 4 === 3 ? lo : (r() < 0.8 ? a : b);
    if (t === T.LOG) col = x % 5 === 0 ? lo : (r() < 0.7 ? a : b);
    if (t === T.GLASS) col = (x === y || x === y + 1) ? hi : (x === 0 || y === 0 || x === 15 || y === 15) ? lo : a;
    if (t === T.SAND) col = [a, hi, b, hi][Math.floor(x / 4) % 4];
    if (t === T.ROOF) col = (x + y) % 6 === 0 ? lo : (r() < 0.7 ? a : b);
    if (t === T.WHITE) col = r() < 0.85 ? a : b;
    if (t === T.CARPET) col = (x === 0 || x === 15 || y === 0 || y === 15) ? hi : ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) ? lo : a;
    if (t === T.LANTERN) col = (y < 2 || y > 13) ? lo : (x < 3 || x > 12) ? lo : (x + y) % 4 === 0 ? hi : (y % 4 === 0 ? b : hi);
    g.fillStyle = col; g.fillRect(x, y, 1, 1);
  }
  return c;
}

// ---------- Personnages en blocs ----------
const LOOKS = {
  ali: { skin: '#e2b48c', hair: '#2b1b12', shirt: '#e5484d', pants: '#2b4a8a', num: '10' },
  asma: { skin: '#f0c4a0', hair: '#3a2212', shirt: '#ff6fae', pants: '#7c4dcc', long: true },
  maman: { skin: '#f0c4a0', hair: '#3a2212', shirt: '#2bb673', pants: '#ffffff', scarf: '#2bb673' },
  papa: { skin: '#e2b48c', hair: '#2b1b12', shirt: '#c8323a', pants: '#2b2140', beard: true },
  hbibiti: { skin: '#f6cfaa', hair: '#d23a3f', shirt: '#7a48b8', pants: '#7a48b8', scarf: '#d23a3f', glasses: true },
  boulanger: { skin: '#d9a77e', hair: '#2b1b12', shirt: '#ffffff', pants: '#5a3a20', hat: '#ffffff' },
  maitresse: { skin: '#f0c4a0', hair: '#6b3a1a', shirt: '#3b7dd8', pants: '#2b2140', long: true, glasses: true },
  imam: { skin: '#d9a77e', hair: '#ffffff', shirt: '#ffffff', pants: '#ffffff', hat: '#ffffff', beard: true, robe: true },
  fermier: { skin: '#d9a77e', hair: '#5a3a20', shirt: '#2bb673', pants: '#3b5a9a', hat: '#e7c873' },
  medecin: { skin: '#f0c4a0', hair: '#2b1b12', shirt: '#ffffff', pants: '#5ec4ff', scarf: '#5ec4ff', cross: true },
  fifi: { emoji: '🦊', shirt: '#00843d', pants: '#ffffff', num: '10' },
  assad: { emoji: '🦁', shirt: '#c8323a', pants: '#2b2140' },
};
function drawPerson(g, look, x, y, s, t, facing = 1, moving = false) {
  // x, y : bas-centre en pixels ; s : taille d'un bloc ; t : temps (animation des jambes).
  const L = LOOKS[look] || LOOKS.ali;
  const u = s / 10; const swing = moving ? Math.sin(t * 14) * 2.2 * u : 0;
  const px = (dx, dy, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x + dx * u), Math.round(y + dy * u), Math.ceil(w * u), Math.ceil(h * u)); };
  // Jambes
  g.save(); g.translate(x - 1.5 * u, y - 6 * u); g.rotate(swing / s); g.fillStyle = L.pants; g.fillRect(-1.5 * u, 0, 3 * u, 6 * u); g.restore();
  g.save(); g.translate(x + 1.5 * u, y - 6 * u); g.rotate(-swing / s); g.fillStyle = L.pants; g.fillRect(-1.5 * u, 0, 3 * u, 6 * u); g.restore();
  // Corps et bras
  px(-3, L.robe ? -12 : -12, 6, L.robe ? 12 : 6.5, L.shirt);
  g.save(); g.translate(x + facing * 3.6 * u, y - 11.5 * u); g.rotate(-swing / s); g.fillStyle = L.shirt; g.fillRect(-1 * u, 0, 2 * u, 5 * u); g.fillStyle = L.skin || '#f0c4a0'; g.fillRect(-1 * u, 5 * u, 2 * u, 1.3 * u); g.restore();
  if (L.num) { g.fillStyle = '#fff'; g.font = `bold ${3 * u}px sans-serif`; g.textAlign = 'center'; g.fillText(L.num, x, y - 7.6 * u); }
  if (L.cross) { px(-0.5, -11, 1, 3, '#e5484d'); px(-1.5, -10, 3, 1, '#e5484d'); }
  // Tête
  if (L.emoji) {
    g.font = `${9 * u}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText(L.emoji, x, y - 11.5 * u); return;
  }
  if (L.scarf) px(-4.4, -20.4, 8.8, 9.2, L.scarf);
  else { px(-4, -20, 8, 3, L.hair); if (L.long) { px(-4.4, -19, 1.6, 7, L.hair); px(2.8, -19, 1.6, 7, L.hair); } }
  px(-3.5, L.scarf ? -18.8 : -18, 7, L.scarf ? 6.8 : 6.5, L.skin);
  if (L.hat) px(-4.2, -21.5, 8.4, 2.6, L.hat);
  const ex = facing > 0 ? 0.6 : -0.6;
  px(-2 + ex, -15.8, 1.3, 1.6, '#2b2140'); px(1 + ex, -15.8, 1.3, 1.6, '#2b2140');
  if (L.glasses) { g.strokeStyle = '#6b4423'; g.lineWidth = 0.5 * u; g.strokeRect(x + (-2.6 + ex) * u, y - 16.4 * u, 2.6 * u, 2.6 * u); g.strokeRect(x + (0.4 + ex) * u, y - 16.4 * u, 2.6 * u, 2.6 * u); }
  if (L.beard) px(-3.5, -13.2, 7, 1.8, L.hair === '#ffffff' ? '#dddddd' : L.hair);
  px(-1 + ex, -13.4, 2, 0.6, '#b0574a');
}

// ---------- Le jeu ----------
export function createVille(api) {
  // api : { players, older, dialects, kidLook, kidLook2, say, sfx, onCorrect(word, firstTry), onMiss(word), onQuestDone(npc, kind), onCoins(n), scarf }
  const world = makeWorld();
  const build = api.build || { blocks: {} };
  applyBuild(world, build.blocks);
  world.spots = world.spots.filter((sp) => !world.solid[Math.floor(sp.y)]?.[Math.floor(sp.x)]);
  const canvas = $('#ville-canvas');
  const g = canvas.getContext('2d');
  const tex = {};
  for (const t of Object.values(T)) if (PAL[t]) tex[t] = [0, 1, 2].map((k) => makeTexture(t, t * 7 + k));
  const quests = newQuests(Math.floor(Date.now() / 86400000));
  const coins = coinSpots(world, Math.floor(Date.now() / 86400000));
  let fetch = null; // { npc, word, items }
  const p = { x: 6, y: GROUND, vx: 0, vy: 0, onGround: true, facing: 1, coyote: 0 };
  const buddy = { x: 4.5, y: GROUND, facing: 1 };
  const keys = { left: false, right: false, jump: false };
  let jumpQueued = 0, raf = 0, last = 0, t = 0, near = null, dialog = false, coinCount = 0;
  let building = false, pick = SHOP[0], view = { camX: 0, camY: 0, s: 1 };
  if (api.scarf === false) LOOKS.maman.scarf = undefined;

  function resize() {
    const r = canvas.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
  }
  // ----- Commandes : boutons tactiles et clavier -----
  const hold = (el, k) => {
    const on = (e) => { e.preventDefault(); keys[k] = true; if (k === 'jump') jumpQueued = 0.15; };
    const off = (e) => { e.preventDefault(); keys[k] = false; };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
  };
  hold($('#v-left'), 'left'); hold($('#v-right'), 'right'); hold($('#v-jump'), 'jump');
  const onKey = (down) => (e) => {
    if (dialog) return;
    const k = { ArrowLeft: 'left', a: 'left', q: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'jump', ' ': 'jump', w: 'jump', z: 'jump' }[e.key];
    if (k) { keys[k] = down; if (k === 'jump' && down) jumpQueued = 0.15; e.preventDefault(); }
    if (down && (e.key === 'Enter' || e.key === 'e') && near) talk(near);
  };
  const kd = onKey(true), ku = onKey(false);
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('resize', resize);
  $('#v-talk').onclick = () => near && talk(near);

  // ----- Physique -----
  const PW = 0.7, PH = 1.75, GRAV = 40, JUMP = 14.6, SPEED = 6.5;
  const hit = (x, y) => isSolid(world, x, y);
  function step(dt) {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    p.vx = dir * SPEED; if (dir) p.facing = dir;
    p.coyote = p.onGround ? 0.1 : Math.max(0, p.coyote - dt);
    jumpQueued = Math.max(0, jumpQueued - dt);
    if (jumpQueued > 0 && p.coyote > 0) { p.vy = -JUMP; p.onGround = false; p.coyote = 0; jumpQueued = 0; api.sfx('boing'); }
    p.vy = Math.min(p.vy + GRAV * dt, 25);
    // Horizontal
    let nx = p.x + p.vx * dt;
    const top = p.y - PH + 0.05, bot = p.y - 0.05;
    if (p.vx > 0 && (hit(nx + PW / 2, top) || hit(nx + PW / 2, bot) || hit(nx + PW / 2, p.y - PH / 2))) nx = Math.floor(nx + PW / 2) - PW / 2 - 0.001;
    if (p.vx < 0 && (hit(nx - PW / 2, top) || hit(nx - PW / 2, bot) || hit(nx - PW / 2, p.y - PH / 2))) nx = Math.floor(nx - PW / 2) + 1 + PW / 2 + 0.001;
    p.x = nx;
    // Vertical
    let ny = p.y + p.vy * dt;
    p.onGround = false;
    if (p.vy >= 0 && (hit(p.x - PW / 2 + 0.05, ny) || hit(p.x + PW / 2 - 0.05, ny))) { ny = Math.floor(ny); p.vy = 0; p.onGround = true; }
    if (p.vy < 0 && (hit(p.x - PW / 2 + 0.05, ny - PH) || hit(p.x + PW / 2 - 0.05, ny - PH))) { ny = Math.floor(ny - PH) + 1 + PH; p.vy = 0; }
    p.y = ny;
    // Le frère ou la sœur suit (mode Ensemble).
    const target = p.x - p.facing * 1.4;
    buddy.x += (target - buddy.x) * Math.min(1, dt * 4); buddy.y += (p.y - buddy.y) * Math.min(1, dt * 6); buddy.facing = p.facing;
    // Ramasser pièces et objets
    for (const c of coins) if (!c.taken && Math.abs(c.x - p.x) < 0.7 && c.y > p.y - PH - 0.3 && c.y < p.y + 0.3) {
      c.taken = true; coinCount++; api.sfx('pop'); api.earn?.(1);
      if (coinCount % 10 === 0) api.onCoins(1);
    }
    if (fetch) for (const it of fetch.items) if (!it.taken && Math.abs(it.x - p.x) < 0.8 && it.y > p.y - PH - 0.4 && it.y < p.y + 0.4) {
      it.taken = true; api.sfx('chime');
      const left = fetch.items.filter((i) => !i.taken).length;
      api.say(left ? `Encore ${left} !` : `Tu as tout trouvé ! Retourne voir ${fetch.npc.name}.`);
    }
    near = NPCS.find((n) => Math.abs(n.x - p.x) < 1.6 && Math.abs(npcY(n) - p.y) < 1.5) || null;
    $('#v-talk').hidden = !near;
    if (near) $('#v-talk').textContent = `💬 ${near.name}`;
  }
  const npcY = (n) => world.ground[Math.floor(n.x)];

  // ----- Dessin -----
  function glow(x, y, r) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,214,120,.55)'); gr.addColorStop(1, 'rgba(255,214,120,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function draw() {
    const cw = canvas.width, ch = canvas.height;
    const s = ch / 12; // taille d'un bloc à l'écran
    const viewW = cw / s;
    const camX = Math.max(0, Math.min(W - viewW, p.x - viewW / 2));
    const camY = H - 12;
    g.imageSmoothingEnabled = false;
    // Ciel et soleil, nuages qui défilent doucement.
    view = { camX, camY, s };
    const night = !!api.night;
    const sky = g.createLinearGradient(0, 0, 0, ch);
    sky.addColorStop(0, night ? '#0b1640' : '#6ec6ff'); sky.addColorStop(1, night ? '#2a2f6b' : '#c9ecff');
    g.fillStyle = sky; g.fillRect(0, 0, cw, ch);
    if (night) {
      g.fillStyle = '#fff';
      for (let i = 0; i < 60; i++) { const sx = ((i * 97.3 - camX * s * 0.1) % cw + cw) % cw, sy = (i * 53.1) % (ch * 0.55); g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + i); g.fillRect(sx, sy, 2, 2); }
      g.globalAlpha = 1;
      // Le croissant de lune du Ramadan
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(cw * 0.84, ch * 0.14, s * 0.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0f1a48'; g.beginPath(); g.arc(cw * 0.84 + s * 0.35, ch * 0.14 - s * 0.15, s * 0.7, 0, Math.PI * 2); g.fill();
    } else { g.fillStyle = '#fff3a8'; g.fillRect(cw * 0.82, ch * 0.08, s * 1.4, s * 1.4); }
    g.fillStyle = night ? 'rgba(255,255,255,0)' : 'rgba(255,255,255,.9)';
    for (let i = 0; i < 8; i++) { const cx = ((i * 23 - camX * 0.3 + t * 0.4) % (viewW + 10) + viewW + 10) % (viewW + 10) - 5; g.fillRect(cx * s, (1 + (i % 3)) * s, s * 3, s * 0.8); g.fillRect((cx + 0.6) * s, (0.6 + (i % 3)) * s, s * 1.6, s * 0.6); }
    const x0 = Math.floor(camX), x1 = Math.min(W - 1, Math.ceil(camX + viewW));
    for (let y = 0; y < H; y++) for (let x = x0; x <= x1; x++) {
      const sx = (x - camX) * s, sy = (y - camY) * s;
      const d = world.deco[y][x];
      if (d && !world.solid[y][x]) { g.drawImage(tex[d][(x * 7 + y) % 3], sx, sy, s + 1, s + 1); g.fillStyle = 'rgba(0,0,30,.12)'; g.fillRect(sx, sy, s + 1, s + 1); }
      const b = world.solid[y][x];
      if (b) g.drawImage(tex[b][(x * 3 + y * 5) % 3], sx, sy, s + 1, s + 1);
    }
    if (night) {
      g.fillStyle = 'rgba(10,12,50,.42)'; g.fillRect(0, 0, cw, ch);
      // Guirlandes de lanternes entre les maisons, et lumière des lanternes posées par les enfants.
      for (let x = x0; x <= x1; x++) {
        if (x % 4 === 0) { const lx = (x - camX + 0.5) * s, ly = (GROUND - 6.4 - camY + Math.sin(x) * 0.3) * s; glow(lx, ly, s * 0.9); g.fillStyle = ['#ffc93c', '#ff6f6f', '#7ee0a1'][x % 3]; g.fillRect(lx - s * 0.12, ly - s * 0.18, s * 0.24, s * 0.36); }
        for (let y = 0; y < H; y++) if (world.solid[y][x] === T.LANTERN) glow((x - camX + 0.5) * s, (y - camY + 0.5) * s, s * 1.8);
      }
    }
    if (building) {
      g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
      for (let x = x0; x <= x1; x++) for (let y = 0; y < H; y++) if (canPlace(world, x, y, p)) g.strokeRect((x - camX) * s + 2, (y - camY) * s + 2, s - 4, s - 4);
    }
    // Panneaux des quartiers
    g.font = `bold ${s * 0.42}px ${getComputedStyle(document.body).fontFamily}`; g.textAlign = 'center';
    for (const z of ZONES) {
      const zx = (z.x + 1.5 - camX) * s, zy = (GROUND - 1.7 - camY) * s;
      if (zx < -4 * s || zx > cw + 4 * s) continue;
      g.fillStyle = '#7d4a1e'; g.fillRect(zx - 0.06 * s, zy, 0.12 * s, 1.7 * s);
      const tw = g.measureText(z.name).width + s * 0.4;
      g.fillStyle = '#c8914f'; g.fillRect(zx - tw / 2, zy - 0.55 * s, tw, 0.65 * s);
      g.fillStyle = '#2b2140'; g.fillText(z.name, zx, zy - 0.08 * s);
    }
    // Pièces (étoiles qui tournent) et objets recherchés
    const emo = (e, x, y, size, bob = 0) => { g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.fillText(e, (x - camX) * s, (y - camY) * s + Math.sin(t * 3 + bob) * s * 0.08); };
    for (const c of coins) if (!c.taken && c.x > camX - 1 && c.x < camX + viewW + 1) {
      g.save(); g.translate((c.x - camX) * s, (c.y - camY - 0.2) * s); g.scale(Math.abs(Math.cos(t * 3 + c.id)), 1);
      g.fillStyle = '#ffc93c'; g.beginPath(); g.arc(0, 0, s * 0.22, 0, Math.PI * 2); g.fill(); g.fillStyle = '#f0a020'; g.fillRect(-s * 0.05, -s * 0.13, s * 0.1, s * 0.26); g.restore();
    }
    if (fetch) for (const it of fetch.items) if (!it.taken) {
      const ix = (it.x - camX) * s, iy = (it.y - camY - 0.2) * s;
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(ix, iy - s * 0.15, s * 0.45, 0, Math.PI * 2); g.fill();
      emo(fetch.word.emoji, it.x, it.y, s * 0.7, it.id);
    }
    // Habitants, avec « ! » quand ils ont une mission
    for (const n of NPCS) {
      if (n.x < camX - 2 || n.x > camX + viewW + 2) continue;
      const ny = npcY(n);
      drawPerson(g, n.look, (n.x - camX) * s, (ny - camY) * s, s, t * 0.2, p.x < n.x ? -1 : 1, false);
      const q = quests[n.id];
      const mark = fetch?.npc === n ? (fetch.items.every((i) => i.taken) ? '✅' : '⏳') : q.step < 2 ? '❗' : '';
      if (mark) emo(mark, n.x, ny - 2.6, s * 0.6, n.x);
      g.fillStyle = 'rgba(43,33,64,.75)'; g.font = `bold ${s * 0.3}px sans-serif`; g.textAlign = 'center';
      g.fillText(n.name, (n.x - camX) * s, (ny - camY + 0.45) * s);
    }
    // Le frère ou la sœur, puis l'enfant qui joue
    const moving = Math.abs(p.vx) > 0.1 && p.onGround;
    if (api.kidLook2) drawPerson(g, api.kidLook2, (buddy.x - camX) * s, (buddy.y - camY) * s, s * 0.92, t, buddy.facing, moving);
    drawPerson(g, api.kidLook, (p.x - camX) * s, (p.y - camY) * s, s, t, p.facing, moving || !p.onGround);
    // Flèche vers l'objectif
    const goal = objective();
    $('#v-goal').innerHTML = goal.text;
    if (goal.x != null) {
      const dx = goal.x - p.x;
      $('#v-arrow').textContent = Math.abs(dx) < 1.5 ? '⬇️' : dx > 0 ? '➡️' : '⬅️';
    } else $('#v-arrow').textContent = '';
    $('#v-coins').textContent = `🪙 ${api.wallet ? api.wallet() : coinCount}`;
  }
  function objective() {
    if (fetch) {
      const left = fetch.items.filter((i) => !i.taken);
      if (left.length) {
        const nearest = left.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
        return { text: `Trouve ${left.length} ${fetch.word.emoji} pour ${esc(fetch.npc.name)}`, x: nearest.x };
      }
      return { text: `Rapporte les ${fetch.word.emoji} à ${esc(fetch.npc.name)}`, x: fetch.npc.x };
    }
    const n = nextGiver(quests, p.x);
    return n ? { text: `Va voir ${esc(n.name)} ❗`, x: n.x } : { text: 'Bravo ! Toute la ville est contente 🎉', x: null };
  }

  // ----- Parler aux habitants -----
  async function talk(npc) {
    if (dialog) return;
    keys.left = keys.right = false;
    const q = quests[npc.id];
    if (fetch?.npc === npc) {
      if (fetch.items.every((i) => i.taken)) {
        const w = fetch.word; fetch = null; q.step = 2;
        api.sfx('win'); api.onFetchDone(npc, w);
        await openDialog(npc, `Merci beaucoup ! ${w.emoji} En darija, on dit :`, null, w);
        return;
      }
      return openDialog(npc, `Il me manque encore ${fetch.items.filter((i) => !i.taken).length} ${fetch.word.emoji}. Cherche bien, même en hauteur !`);
    }
    if (q.step === 0) {
      const question = askQuestion(npc, q, { older: api.older(), dialects: api.dialects });
      return openDialog(npc, `Salam ! J'ai une question pour toi.`, question);
    }
    if (q.step === 1) {
      if (fetch) return openDialog(npc, `Finis d'abord la mission de ${fetch.npc.name}, puis reviens me voir !`);
      const f = fetchQuest(npc, q, world, { older: api.older(), room: api.night ? 'fete' : undefined });
      fetch = { npc, ...f };
      api.say(`Peux-tu me trouver 3 fois : ${f.word.fr} ? Ils sont cachés dans la ville.`);
      return openDialog(npc, `Peux-tu me trouver 3 ${f.word.emoji} ? Ils sont cachés dans la ville, parfois tout en haut !`, null, null, true);
    }
    return openDialog(npc, 'Merci pour ton aide ! Va voir les autres habitants.');
  }

  function openDialog(npc, text, question = null, teach = null, silent = false) {
    dialog = true;
    const box = $('#v-dialog');
    box.hidden = false;
    $('#v-who').textContent = npc.name;
    $('#v-text').textContent = text;
    $('#v-choices').innerHTML = '';
    $('#v-ok').hidden = !!question;
    if (!question && !teach && !silent) api.say(text);
    if (teach) api.say(text.replace(/\p{Extended_Pictographic}/gu, '').trim(), ...api.dialects.map((d) => ({ word: teach, d })));
    if (teach) $('#v-choices').innerHTML = api.dialects.map((d) => `<span class="v-teach">${d === 'ma' ? '🇲🇦' : '🇩🇿'} ${esc(teach[d].lat)}</span>`).join('');
    return new Promise((resolve) => {
      const close = () => { box.hidden = true; dialog = false; api.stop(); resolve(); };
      $('#v-ok').onclick = () => { api.sfx('tap'); close(); };
      if (!question) return;
      api.ask(question, $('#v-choices'), $('#v-text')).then((firstTry) => {
        quests[npc.id].step = 1;
        api.onAskDone(npc, question.word, firstTry);
        $('#v-ok').hidden = false;
        $('#v-ok').textContent = 'Merci ! ➜';
      });
    });
  }

  // ----- Construire : choisir un bloc, toucher une case pour le poser ou enlever un bloc qu'on a posé -----
  const palette = $('#v-palette');
  function renderPalette() {
    palette.innerHTML = SHOP.map((b, i) => `<button class="v-block ${b === pick ? 'on' : ''}" data-i="${i}" title="${esc(b.name)}"><canvas width="16" height="16"></canvas><small>${b.price}🪙</small></button>`).join('');
    palette.querySelectorAll('canvas').forEach((c, i) => c.getContext('2d').drawImage(tex[SHOP[i].t][0], 0, 0));
  }
  palette.onclick = (e) => { const b = e.target.closest('[data-i]'); if (b) { pick = SHOP[+b.dataset.i]; api.sfx('tap'); renderPalette(); } };
  $('#v-build').onclick = () => {
    building = !building; api.sfx('tap');
    $('#v-build').classList.toggle('on', building); palette.hidden = !building;
    if (building) { renderPalette(); api.say('Choisis un bloc, puis touche une case pour construire. Touche ton bloc pour l’enlever.'); }
  };
  palette.hidden = true; $('#v-build').classList.remove('on');
  if (api.startBuild) setTimeout(() => $('#v-build').click(), 300);
  const onTap = (e) => {
    if (!building || dialog) return;
    const r = canvas.getBoundingClientRect(); const k = canvas.width / r.width;
    const x = Math.floor((e.clientX - r.left) * k / view.s + view.camX), y = Math.floor((e.clientY - r.top) * k / view.s + view.camY);
    const key = `${x},${y}`;
    if (build.blocks[key] && world.solid[y]?.[x] === build.blocks[key]) {
      const b = SHOP.find((o) => o.t === build.blocks[key]);
      world.solid[y][x] = T.AIR; delete build.blocks[key]; api.refund(b ? b.price : 1); api.sfx('pop'); api.saveBuild(); return;
    }
    if (!canPlace(world, x, y, p)) return api.sfx('miss');
    if (!api.spend(pick.price)) { api.sfx('miss'); return api.say('Il te manque des pièces ! Ramasse les pièces de la ville ou réussis un niveau.'); }
    world.solid[y][x] = pick.t; build.blocks[key] = pick.t; api.sfx('ok'); api.saveBuild();
  };
  canvas.addEventListener('pointerdown', onTap);
  $('#v-night').hidden = !api.ramadan;
  $('#v-night').textContent = api.night ? '☀️' : '🌙';
  $('#v-night').onclick = () => { api.night = !api.night; $('#v-night').textContent = api.night ? '☀️' : '🌙'; api.sfx('chime'); if (api.night) api.say('Ramadan mbarek ! La ville est illuminée. Les habitants préparent la fête.'); };

  // ----- Boucle -----
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000 || 0); last = now; t += dt;
    if (!dialog) step(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }
  resize();
  raf = requestAnimationFrame((n) => { last = n; loop(n); });
  return {
    stop() { cancelAnimationFrame(raf); canvas.removeEventListener('pointerdown', onTap); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('resize', resize); },
    get state() { return { p: { ...p }, quests, fetch, coins: coinCount }; },
    tap(x, y) { const r = canvas.getBoundingClientRect(), k = canvas.width / r.width; onTap({ clientX: r.left + ((x - view.camX + 0.5) * view.s) / k, clientY: r.top + ((y - view.camY + 0.5) * view.s) / k }); },
    teleport(x, y) { p.x = x; p.y = y ?? world.ground[Math.floor(x)]; p.vy = 0; },
  };
}
