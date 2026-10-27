// Activités « pour jouer » : championnat d'Assad, basket de Fifi, studio de musique, animal à soigner.
import { WORDS } from './core.js';
import { screen, el, choose, askWord, pickOne, shuffled, todayKey } from './act-kit.js';

// ---------- ⚽ Le championnat d'Assad ----------
const TEAMS = [
  { id: 'raja', name: 'Raja', flag: '🇲🇦', color: '#0a8a3a', level: 1 },
  { id: 'mca', name: 'MCA', flag: '🇩🇿', color: '#c8102e', level: 1 },
  { id: 'wydad', name: 'Wydad', flag: '🇲🇦', color: '#d62828', level: 2 },
  { id: 'jsk', name: 'JSK', flag: '🇩🇿', color: '#f6c445', level: 2 },
];
export function foot(ctx) {
  const prog = ctx.P().progress;
  const lg = prog.league = prog.league || { games: {}, titles: 0 };
  const body = screen(ctx, '⚽ Le championnat d’Assad', `🏆 ${lg.titles}`);
  const pts = (r) => (r ? (r.us > r.them ? 3 : r.us === r.them ? 1 : 0) : 0);
  const total = TEAMS.reduce((a, t) => a + pts(lg.games[t.id]), 0);
  const card = el(`<div class="act-card"><p class="act-big">🦁 Les Lions d’Assad : ${total} points</p>
    <div class="league">${TEAMS.map((t) => { const r = lg.games[t.id]; return `<button class="league-row" data-t="${t.id}" ${r ? 'disabled' : ''}><span class="kit" style="background:${t.color}"></span><b>${t.flag} ${t.name}</b><span>${r ? `${r.us} - ${r.them} ${r.us > r.them ? '✅' : r.us === r.them ? '🤝' : '❌'}` : 'Jouer ➜'}</span></button>`; }).join('')}</div>
    <p class="act-note">Chaque bonne réponse, c'est un tir au but ! Gagne tous tes matchs pour soulever la coupe.</p></div>`);
  body.append(card);
  if (TEAMS.every((t) => lg.games[t.id])) {
    const champion = total >= 9;
    if (champion) { lg.titles++; ctx.stars(5); ctx.confetti(150); ctx.sfx('win'); }
    card.insertAdjacentHTML('beforeend', `<p class="act-big">${champion ? '🏆 Champions ! Machallah !' : 'Fin de la saison ! On recommence ?'}</p><button class="go" data-new>Nouvelle saison ➜</button>`);
    ctx.say(champion ? 'Les Lions d’Assad sont champions ! Bravo !' : 'La saison est finie. On recommence pour gagner la coupe ?');
    card.querySelector('[data-new]').onclick = () => { lg.games = {}; ctx.saveAll(); foot(ctx); };
  } else ctx.say('Choisis ton adversaire. Assad compte sur toi !');
  card.querySelector('.league').onclick = (e) => { const b = e.target.closest('[data-t]'); if (b && !b.disabled) { ctx.sfx('whistle'); match(ctx, TEAMS.find((t) => t.id === b.dataset.t)); } };
}
async function match(ctx, team) {
  const prog = ctx.P().progress;
  const body = screen(ctx, `🦁 Lions d’Assad contre ${team.flag} ${team.name}`);
  const card = el(`<div class="act-card"><div class="pitch"><div class="goal-net"></div><span class="ball" id="ft-ball">⚽</span><span class="keeper" id="ft-keeper" style="background:${team.color}">🧤</span></div>
    <p class="act-big" id="ft-score">0 - 0</p><p class="act-big" id="ft-q" style="font-size:20px"></p><div class="act-choices" id="ft-box"></div></div>`);
  body.append(card);
  let us = 0, them = 0;
  const ball = card.querySelector('#ft-ball'), keeper = card.querySelector('#ft-keeper');
  for (let k = 0; k < 5; k++) {
    ball.className = 'ball'; keeper.className = 'keeper';
    const ok = await askWord(ctx, card.querySelector('#ft-q'), card.querySelector('#ft-box'));
    ball.className = `ball ${ok ? 'shoot-in' : 'shoot-out'}`; keeper.className = `keeper ${ok ? 'dive-miss' : 'dive-save'}`;
    await new Promise((r) => setTimeout(r, 700));
    if (ok) { us++; ctx.sfx('win'); ctx.confetti(40); ctx.say('Buuut !'); } else ctx.sfx('miss');
    // L'adversaire attaque aussi, un peu plus fort au 2e tour.
    if (Math.random() < 0.15 + 0.1 * team.level) them++;
    card.querySelector('#ft-score').textContent = `${us} - ${them}`;
    await new Promise((r) => setTimeout(r, 900));
  }
  prog.league.games[team.id] = { us, them };
  ctx.stars(us > them ? 3 : 1);
  ctx.sfx('whistle');
  const msg = us > them ? `Victoire ${us} à ${them} ! Bravo !` : us === them ? `Match nul, ${us} partout !` : `Défaite ${us} à ${them}. On fera mieux au prochain match !`;
  card.querySelector('#ft-q').textContent = msg; ctx.say(msg);
  card.querySelector('#ft-box').innerHTML = '<button class="go" data-back>Voir le classement ➜</button>';
  card.querySelector('[data-back]').onclick = () => foot(ctx);
}

// ---------- 🏀 Le basket de Fifi : lancers francs ----------
export function basket(ctx) {
  const kid = ctx.P().kid;
  const body = screen(ctx, '🏀 Le basket de Fifi');
  const card = el(`<div class="act-card" style="text-align:center"><p class="act-big" id="bk-score">Paniers : 0</p>
    <canvas id="bk-cv" class="bk-cv"></canvas><p class="act-big" id="bk-q" style="font-size:20px"></p><div class="act-choices" id="bk-box"></div>
    <p class="act-note">Réponds juste pour avoir le ballon, puis tire ton doigt vers l’arrière et lâche, comme un lance-pierre !</p></div>`);
  body.append(card);
  const cv = card.querySelector('#bk-cv'), g = cv.getContext('2d');
  const w = Math.min(window.innerWidth - 60, 640), h = Math.round(w * 0.62), dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.style.width = w + 'px'; cv.style.height = h + 'px'; cv.width = w * dpr; cv.height = h * dpr; g.scale(dpr, dpr);
  const hoop = { x: w * 0.8, y: h * 0.32, r: w * 0.05 };
  const home = { x: w * 0.16, y: h * 0.8 };
  let ball = { ...home, vx: 0, vy: 0, fly: false }, drag = null, ready = false, score = 0, shots = 0, scored = false, raf = 0;
  function drawScene() {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffe8c2'; g.fillRect(0, 0, w, h); g.fillStyle = '#d99a5b'; g.fillRect(0, h * 0.88, w, h * 0.12);
    g.fillStyle = '#fff'; g.fillRect(hoop.x + hoop.r, hoop.y - h * 0.2, 6, h * 0.25); g.fillRect(hoop.x + hoop.r - 2, hoop.y - h * 0.16, 8, h * 0.16);
    g.strokeStyle = '#e5484d'; g.lineWidth = 5; g.beginPath(); g.moveTo(hoop.x - hoop.r, hoop.y); g.lineTo(hoop.x + hoop.r, hoop.y); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(hoop.x - hoop.r + (i * hoop.r) / 2, hoop.y); g.lineTo(hoop.x - hoop.r * 0.6 + (i * hoop.r * 0.6) / 2, hoop.y + hoop.r * 1.3); g.stroke(); }
    g.font = `${w * 0.09}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('🦊', home.x - w * 0.08, home.y - h * 0.02);
    if (drag) { g.strokeStyle = 'rgba(43,33,64,.4)'; g.setLineDash([6, 6]); g.beginPath(); g.moveTo(ball.x, ball.y); g.lineTo(ball.x + (ball.x - drag.x), ball.y + (ball.y - drag.y)); g.stroke(); g.setLineDash([]); }
    g.globalAlpha = ready || ball.fly ? 1 : 0.35;
    g.font = `${w * 0.06}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.fillText('🏀', ball.x, ball.y); g.globalAlpha = 1;
  }
  const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (w / r.width), y: (e.clientY - r.top) * (h / r.height) }; };
  cv.addEventListener('pointerdown', (e) => { if (!ready || ball.fly) return; drag = pos(e); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (drag) { drag = pos(e); drawScene(); } });
  cv.addEventListener('pointerup', () => {
    if (!drag) return;
    const k = 4.5; ball.vx = (ball.x - drag.x) * k; ball.vy = (ball.y - drag.y) * k; drag = null;
    if (Math.hypot(ball.vx, ball.vy) < 60) return drawScene();
    ball.fly = true; ready = false; scored = false; shots++; ctx.sfx('boing'); fly(performance.now());
  });
  function fly(t0) {
    let last = t0;
    const stepFn = (t) => {
      const dt = Math.min(0.03, (t - last) / 1000); last = t;
      const py = ball.y;
      ball.vy += h * 1.6 * dt; ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (!scored && py < hoop.y && ball.y >= hoop.y && Math.abs(ball.x - hoop.x) < hoop.r * 0.85 && ball.vy > 0) {
        scored = true; score++; ctx.sfx('win'); ctx.confetti(50); ctx.say(pickOne(['Panier !', 'Swish !', 'Bravo !']));
        card.querySelector('#bk-score').textContent = `Paniers : ${score}`;
      }
      drawScene();
      if (ball.y > h + 40 || ball.x > w + 40 || ball.x < -40) { ball = { ...home, vx: 0, vy: 0, fly: false }; drawScene(); if (!scored) ctx.sfx('miss'); setTimeout(round, 500); return; }
      raf = requestAnimationFrame(stepFn);
    };
    raf = requestAnimationFrame(stepFn);
  }
  async function round() {
    if (shots >= 6) {
      ctx.stars(Math.min(3, score)); ctx.sfx('win');
      card.querySelector('#bk-q').textContent = `Fin du match : ${score} panier${score > 1 ? 's' : ''} sur 6 !`;
      ctx.say(`Bravo ! ${score} paniers. Fifi est contente !`);
      card.querySelector('#bk-box').innerHTML = '<button class="go" data-again>Rejouer ➜</button>';
      card.querySelector('[data-again]').onclick = () => basket(ctx);
      return;
    }
    // Question de maths pour gagner le ballon.
    const a = kid.older ? 2 + Math.floor(Math.random() * 9) : 1 + Math.floor(Math.random() * 3);
    const b = kid.older ? 1 + Math.floor(Math.random() * 9) : 1 + Math.floor(Math.random() * 2);
    const sub = kid.older && Math.random() < 0.4 && a > b;
    const res = sub ? a - b : a + b;
    const q = kid.older ? `${a} ${sub ? '−' : '+'} ${b} = ?` : `${'🏀'.repeat(a)} + ${'🏀'.repeat(b)} = ?`;
    card.querySelector('#bk-q').textContent = q;
    ctx.say(kid.older ? `${a} ${sub ? 'moins' : 'plus'} ${b}, ça fait combien ?` : `Compte les ballons : ${a} plus ${b}.`);
    const opts = shuffled([res, ...shuffled([res - 1, res + 1, res + 2].filter((x) => x >= 0)).slice(0, 2)]);
    const ok = await choose(ctx, card.querySelector('#bk-box'), opts.map((x) => ({ html: String(x), correct: x === res })), { onRight: () => ctx.say(`${ctx.praise()} À toi de tirer !`) });
    card.querySelector('#bk-box').innerHTML = '';
    if (ok || !kid.older) { ready = true; card.querySelector('#bk-q').textContent = '🏀 Tire vers l’arrière et lâche !'; drawScene(); }
    else { shots++; ctx.say('Pas de ballon cette fois. Question suivante !'); setTimeout(round, 800); }
  }
  document.addEventListener('act-leave', () => cancelAnimationFrame(raf), { once: true });
  drawScene(); round();
}

// ---------- 🎵 Le studio de musique ----------
const INSTR = [
  { id: 'doum', name: 'Darbouka « doum »', e: '🥁' },
  { id: 'tek', name: 'Darbouka « tek »', e: '🪘' },
  { id: 'bendir', name: 'Bendir', e: '⭕' },
  { id: 'qraqeb', name: 'Qraqeb', e: '🔔' },
];
export function studio(ctx) {
  const prog = ctx.P().progress;
  prog.rhythms = prog.rhythms || [];
  const STEPS = 8;
  let grid = INSTR.map((_, k) => Array.from({ length: STEPS }, (__, s) => (k === 0 && s % 4 === 0) || (k === 1 && s % 4 === 2)));
  let tempo = 110, playing = false, timer = 0, stepI = 0, ac = null;
  const body = screen(ctx, '🎵 Le studio de musique');
  const card = el(`<div class="act-card"><div class="seq" id="st-grid"></div>
    <div class="act-row"><button class="go" id="st-play">▶ Jouer</button><label>Vitesse <input type="range" id="st-tempo" min="70" max="160" value="110"></label>
    <button class="go small alt" id="st-clear">↺ Effacer</button><button class="go small" id="st-save">💾 Garder mon rythme</button></div>
    <div class="act-row" id="st-saved"></div></div>`);
  body.append(card);
  function render() {
    card.querySelector('#st-grid').innerHTML = INSTR.map((ins, k) => `<div class="seq-row"><span class="seq-name">${ins.e} ${ins.name}</span>${grid[k].map((on, s) => `<button class="seq-cell ${on ? 'on' : ''} ${s % 4 === 0 ? 'beat' : ''}" data-k="${k}" data-s="${s}"></button>`).join('')}</div>`).join('');
    card.querySelector('#st-saved').innerHTML = prog.rhythms.map((r, i) => `<button class="go small alt" data-load="${i}">🎶 Rythme ${i + 1}</button>`).join('');
  }
  const sound = (id, t) => {
    ac = ac || ctx.audio();
    const out = ac.createGain(); out.connect(ac.destination);
    const noise = (dur, f, q = 1) => { const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ac.createBufferSource(); s.buffer = b; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; s.connect(bp); bp.connect(out); s.start(t); };
    const thump = (f0, f1, dur, vol) => { const o = ac.createOscillator(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); o.connect(out); o.start(t); o.stop(t + dur); out.gain.setValueAtTime(vol, t); out.gain.exponentialRampToValueAtTime(0.001, t + dur); };
    if (id === 'doum') thump(140, 55, 0.35, 0.9);
    if (id === 'tek') { noise(0.08, 3200, 2); out.gain.setValueAtTime(0.5, t); out.gain.exponentialRampToValueAtTime(0.001, t + 0.09); }
    if (id === 'bendir') { thump(90, 60, 0.4, 0.6); noise(0.25, 900, 0.7); }
    if (id === 'qraqeb') { noise(0.05, 6000, 4); noise(0.05, 6500, 4); out.gain.setValueAtTime(0.35, t); out.gain.exponentialRampToValueAtTime(0.001, t + 0.12); }
  };
  function tick() {
    ac = ac || ctx.audio();
    const t = ac.currentTime + 0.02;
    INSTR.forEach((ins, k) => { if (grid[k][stepI]) sound(ins.id, t); });
    card.querySelectorAll('.seq-cell').forEach((c) => c.classList.toggle('now', +c.dataset.s === stepI));
    stepI = (stepI + 1) % STEPS;
    timer = setTimeout(tick, 60000 / tempo / 2);
  }
  const stop = () => { playing = false; clearTimeout(timer); card.querySelector('#st-play').textContent = '▶ Jouer'; card.querySelectorAll('.seq-cell').forEach((c) => c.classList.remove('now')); };
  card.querySelector('#st-grid').onclick = (e) => { const c = e.target.closest('.seq-cell'); if (!c) return; const k = +c.dataset.k, s = +c.dataset.s; grid[k][s] = !grid[k][s]; c.classList.toggle('on', grid[k][s]); if (grid[k][s]) { ac = ac || ctx.audio(); sound(INSTR[k].id, ac.currentTime); } };
  card.querySelector('#st-play').onclick = () => { if (playing) return stop(); ctx.stopVoice(); playing = true; stepI = 0; card.querySelector('#st-play').textContent = '⏸ Stop'; tick(); };
  card.querySelector('#st-tempo').oninput = (e) => { tempo = +e.target.value; };
  card.querySelector('#st-clear').onclick = () => { grid = grid.map((r) => r.map(() => false)); render(); };
  card.querySelector('#st-save').onclick = () => { prog.rhythms = [{ grid, tempo }, ...prog.rhythms].slice(0, 3); if (prog.rhythms.length === 1) ctx.stars(1); else ctx.saveAll(); ctx.sfx('chime'); ctx.say('Ton rythme est gardé ! Fais-le écouter à Papa et Maman.'); render(); };
  card.querySelector('#st-saved').onclick = (e) => { const b = e.target.closest('[data-load]'); if (!b) return; const r = prog.rhythms[+b.dataset.load]; grid = r.grid.map((x) => x.slice()); tempo = r.tempo; card.querySelector('#st-tempo').value = tempo; render(); };
  document.addEventListener('act-leave', stop, { once: true });
  render();
  ctx.say('Touche les cases pour créer ton rythme, puis appuie sur Jouer. Doum, tek, tek !');
}

// ---------- 🧸 Mon animal ----------
const ACCESS = [{ e: '🎀', name: 'le nœud', price: 2 }, { e: '🧣', name: 'l’écharpe', price: 3 }, { e: '🎩', name: 'le chapeau', price: 3 }, { e: '🕶️', name: 'les lunettes', price: 4 }, { e: '👑', name: 'la couronne', price: 10 }];
export function animal(ctx) {
  const prog = ctx.P().progress;
  const pet = prog.pet;
  if (!pet) return choosePet(ctx);
  // La faim augmente doucement avec le temps (sans jamais rendre l'animal malade).
  const hours = (Date.now() - (pet.fedAt || Date.now())) / 3600000;
  const hunger = Math.min(100, Math.round(hours * 5));
  const w = WORDS.find((x) => x.id === pet.kind);
  const lvl = Math.min(5, 1 + Math.floor((pet.fed || 0) / 5));
  const d = ctx.settings.dialects[0];
  const body = screen(ctx, `🧸 ${pet.name}`, `⭐ ${prog.stars}`);
  const card = el(`<div class="act-card" style="text-align:center">
    <div class="pet" id="pt-pet" style="font-size:${60 + lvl * 18}px">${w.emoji}<span class="pet-wear">${(pet.wear || []).join('')}</span></div>
    <p class="act-big">${ctx.esc(pet.name)} · niveau ${lvl} ${lvl === 5 ? '(adulte !)' : ''}</p>
    <div class="pet-bars"><span>🍽️ Faim <i style="width:${hunger}%"></i></span><span>😊 Joie <i style="width:${Math.max(10, 100 - hunger)}%"></i></span></div>
    <div class="act-row"><button class="go" id="pt-feed">🍖 Donner à manger (1⭐)</button><button class="go alt" id="pt-pet-btn">🤗 Câlin</button></div>
    <p class="act-big" style="font-size:18px">Habiller ${ctx.esc(pet.name)} :</p>
    <div class="act-row" id="pt-shop">${ACCESS.map((a) => `<button class="act-choice" data-a="${a.e}" style="font-size:16px">${a.e} ${(pet.owned || []).includes(a.e) ? ((pet.wear || []).includes(a.e) ? '✅' : 'Mettre') : a.price + '⭐'}</button>`).join('')}</div>
    <p class="act-note">En darija, ${w.fr.toLowerCase()} se dit « ${ctx.esc(w[d].lat)} ». Gagne des étoiles dans le jeu pour bien t’occuper de ${ctx.esc(pet.name)} !</p></div>`);
  body.append(card);
  const greet = hunger > 50 ? `${pet.name} a faim ! Donne-lui à manger.` : `${pet.name} est content de te voir !`;
  ctx.say(greet);
  card.querySelector('#pt-feed').onclick = () => {
    if (prog.stars < 1) return ctx.say('Il te faut une étoile. Joue dans l’usine pour en gagner !');
    prog.stars -= 1; pet.fed = (pet.fed || 0) + 1; pet.fedAt = Date.now(); ctx.saveAll(); ctx.sfx('pop');
    const grew = Math.min(5, 1 + Math.floor(pet.fed / 5)) > lvl;
    ctx.say(grew ? `Waouh ! ${pet.name} a grandi !` : 'Miam miam ! Bssaha !'); if (grew) ctx.confetti(80);
    setTimeout(() => animal(ctx), 900);
  };
  card.querySelector('#pt-pet-btn').onclick = () => { const p = card.querySelector('#pt-pet'); p.classList.remove('hop'); void p.offsetWidth; p.classList.add('hop'); ctx.sfx('boing'); ctx.playWord(w, d); };
  card.querySelector('#pt-shop').onclick = (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = ACCESS.find((x) => x.e === b.dataset.a);
    pet.owned = pet.owned || []; pet.wear = pet.wear || [];
    if (!pet.owned.includes(a.e)) {
      if (prog.stars < a.price) return ctx.say(`Il te faut ${a.price} étoiles pour ${a.name}.`);
      prog.stars -= a.price; pet.owned.push(a.e);
    }
    pet.wear = pet.wear.includes(a.e) ? pet.wear.filter((x) => x !== a.e) : [...pet.wear, a.e];
    ctx.saveAll(); ctx.sfx('chime'); animal(ctx);
  };
}
function choosePet(ctx) {
  const body = screen(ctx, '🧸 Choisis ton animal');
  const d = ctx.settings.dialects[0];
  const opts = ['chat', 'chameau'].map((id) => WORDS.find((w) => w.id === id));
  body.append(el(`<div class="act-card" style="text-align:center"><p class="act-big">Quel animal veux-tu adopter ?</p>
    <div class="act-row">${opts.map((w) => `<button class="act-choice" data-k="${w.id}" style="font-size:70px">${w.emoji}<br><small style="font-size:16px">${ctx.esc(w[d].lat)}</small></button>`).join('')}</div>
    <label class="field">Son prénom <input id="pt-name" maxlength="14" value="Mimi"></label></div>`));
  ctx.say('Choisis ton animal et donne-lui un prénom.');
  body.onclick = (e) => {
    const b = e.target.closest('[data-k]'); if (!b) return;
    body.onclick = null;
    ctx.P().progress.pet = { kind: b.dataset.k, name: body.querySelector('#pt-name').value.trim() || 'Mimi', fed: 0, fedAt: Date.now(), born: todayKey() };
    ctx.stars(1); ctx.confetti(60); animal(ctx);
  };
}
