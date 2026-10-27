// Les personnages prennent vie : regard qui suit le doigt, réactions quand on les touche,
// petites animations spontanées, bouche qui bouge quand une voix parle, joie et encouragements.
import { say, sfx } from './audio.js';

// Ce que chacun dit quand un enfant le touche (lu par la voix française).
export const PHRASES = {
  hbibiti: ['Ya galbi, je t’aime fort !', 'Hihihi, ça chatouille !', 'Tu veux un verre de thé à la menthe ?', 'Machallah, tu apprends si vite !', 'Bisou de Hbibiti !'],
  assad: ['Grrr ! Je suis Assad, le lion de l’Atlas !', 'Yallah, on joue au foot ?', 'Hihi, arrête, ça chatouille ma crinière !', 'Tu ne marqueras pas… enfin, peut-être !', 'Dima Maghrib !'],
  fifi: ['Salam ! Regarde mes grandes oreilles !', 'Saha ! On fait un panier ?', 'Je suis Fifi, la fennec du désert !', 'Boing, boing, boing !', 'Hihi, mes oreilles bougent toutes seules !'],
  grappo: ['Tape m’en cinq !', 'Bip bip ! Grappo est prêt !', 'J’attrape tout, même les mots !', 'Bip ! Ça chatouille mes circuits !'],
  papa: ['Je suis tellement fier de toi !', 'Kanbghik bezzaf !', 'On fait un match de foot après ?', 'Tu es une vraie star !'],
  maman: ['Ya galbi, tu es formidable !', 'Nhabek bezzaf !', 'Un câlin de maman !', 'Machallah, comme tu grandis !'],
  dada: ['Doum tek tek, doum tek !', 'On danse ensemble ?', 'Je suis Darbouka Dada !', 'Tape dans tes mains avec moi !'],
};
const SOUND = { papa: 'giggle', maman: 'giggle', hbibiti: 'giggle', assad: 'roar', fifi: 'boing', grappo: 'beep', dada: 'drum' };
export const INTRO = {
  papa: 'Salam ! C’est papa. On joue ensemble, ya galbi ?',
  maman: 'Salam ya galbi ! Maman est avec toi.',
  hbibiti: 'Salam ya galbi ! Viens, on apprend ensemble.',
  assad: 'Salam ! Moi c’est Assad. Prêt à marquer des buts ?',
  fifi: 'Salam ! C’est Fifi ! On joue ensemble ?',
  grappo: 'Bip bip ! Grappo à ton service !',
  dada: 'Doum tek ! Darbouka Dada est là !',
};

const timers = new WeakMap();
const mood = (el) => el?.dataset.mood || 'happy';

export function setMood(el, m, ms = 0) {
  if (!el) return;
  clearTimeout(timers.get(el));
  el.dataset.mood = m;
  if (m === 'cheer') sparkle(el);
  if (ms) timers.set(el, setTimeout(() => { el.dataset.mood = 'happy'; }, ms));
}
// Réaction à une réponse : joie si c'est juste, petite moue puis encouragement sinon.
export function react(el, good) {
  if (!el) return;
  if (good) setMood(el, 'cheer', 1500);
  else { setMood(el, 'sad', 900); }
}
export function charIn(container) { return container?.querySelector('.char'); }

// Place un personnage dans un conteneur. speaker : sa bouche bouge quand la voix parle ; pokable : réagit au toucher.
export function mount(container, html, { speaker = false, pokable = true } = {}) {
  if (!container) return null;
  container.innerHTML = html;
  const c = charIn(container);
  if (c) { c.classList.toggle('speaker', speaker); c.classList.toggle('pokable', pokable); }
  return c;
}

function sparkle(el) {
  const bits = ['✨', '⭐', '💛', '✨'];
  for (let k = 0; k < 5; k++) {
    const s = document.createElement('span');
    s.className = 'char-spark';
    s.textContent = bits[k % bits.length];
    s.style.left = 10 + Math.random() * 80 + '%';
    s.style.top = 5 + Math.random() * 40 + '%';
    s.style.animationDelay = k * 0.08 + 's';
    el.appendChild(s);
    setTimeout(() => s.remove(), 1200);
  }
}

function act(el, ms = 1400) {
  if (!el || el.classList.contains('act')) return;
  el.classList.add('act');
  setTimeout(() => el.classList.remove('act'), ms);
}

const visible = () => [...document.querySelectorAll('.screen.active .char, .modal:not([hidden]) .char')];

// --- Regard : les pupilles suivent le dernier toucher, puis reviennent au centre ---
let pointer = null, lastMove = 0, dirty = true;
function onPointer(e) { pointer = { x: e.clientX, y: e.clientY }; lastMove = performance.now(); dirty = true; }
function tick(now) {
  const idle = now - lastMove > 2500;
  if (dirty || idle) {
    for (const c of visible()) {
      const r = c.getBoundingClientRect();
      if (!r.width) continue;
      let dx = 0, dy = 0;
      if (pointer && !idle) {
        const cx = r.left + r.width / 2, cy = r.top + r.height * 0.42;
        const vx = pointer.x - cx, vy = pointer.y - cy;
        const d = Math.hypot(vx, vy) || 1;
        const k = Math.min(1, d / 220);
        dx = (vx / d) * 3.4 * k; dy = (vy / d) * 2.8 * k;
      } else if (c._glance) { [dx, dy] = c._glance; }
      for (const p of c.querySelectorAll('.pupil')) p.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`;
    }
    dirty = false;
  }
  requestAnimationFrame(tick);
}

// --- Petites vies spontanées : un regard de côté, un salut, une oreille qui bouge ---
function idleLife() {
  const cs = visible().filter((c) => mood(c) === 'happy');
  if (!cs.length) return;
  const c = cs[Math.floor(Math.random() * cs.length)];
  if (Math.random() < 0.5) {
    c._glance = [(Math.random() * 2 - 1) * 3.2, (Math.random() * 2 - 1) * 1.6];
    dirty = true;
    setTimeout(() => { c._glance = null; dirty = true; }, 1600);
  } else act(c);
}

// --- Toucher un personnage ---
let pokeLock = 0;
function onPoke(e) {
  const c = e.target.closest('.char.pokable');
  if (!c || e.target.closest('.choice')) return;
  const now = Date.now();
  if (now - pokeLock < 700) return;
  pokeLock = now;
  const name = c.dataset.char;
  sfx(SOUND[name] || 'pop');
  act(c, 1200);
  setMood(c, 'cheer', 1600);
  const list = PHRASES[name] || [];
  if (list.length) say(list[Math.floor(Math.random() * list.length)]);
}

// --- La bouche bouge quand une voix parle ---
function onSpeaking(e) {
  for (const c of document.querySelectorAll('.char.speaker')) c.dataset.talk = e.detail ? '1' : '0';
}

export function initCharacters() {
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('pointerdown', onPointer, { passive: true });
  document.addEventListener('click', onPoke);
  window.addEventListener('hbibiti-speaking', onSpeaking);
  setInterval(idleLife, 2600);
  requestAnimationFrame(tick);
}
