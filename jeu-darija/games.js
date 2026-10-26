// Les mini-jeux : chacun dessine sa scène et anime la réponse choisie.
// build(q, label) → HTML ; anim(scene, i, good, ctx) → Promise (fin de l'animation).
import { assad, fifi, grappo, dada, lantern, tajine, hoop, mosque, hbibiti } from './art.js';
import { sfx } from './audio.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s, el) => el.querySelector(s);
const $$ = (s, el) => [...el.querySelectorAll(s)];
const center = (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const anim = (el, frames, opts) => el.animate(frames, { fill: 'forwards', ...opts }).finished.catch(() => {});

const TOYS = ['🧸', '🤖', '🦄', '🐻', '🪀', '🎈', '🚂', '🪁', '🐢', '🦖', '🐰', '🦒'];

export const GAMES = {
  // Les portes de l'usine : Grappo tire le levier de la bonne porte.
  doors: {
    build(q, label) {
      const toys = [...TOYS].sort(() => Math.random() - 0.5);
      return `
        <div class="door-row">${q.choices.map((c, i) => `
          <button class="choice door" data-i="${i}" aria-label="Choix ${i + 1}">
            <span class="toy">${toys[i]}</span>
            <span class="door-leaf"><span class="door-label">${label(c)}</span><span class="lever"></span></span>
          </button>`).join('')}
        </div>
        <div class="grappo-dock"><span class="cable"></span><span class="grappo-hand">${grappo()}</span></div>`;
    },
    async anim(scene, i, good) {
      const door = $$('.door', scene)[i];
      const hand = $('.grappo-hand', scene), cable = $('.cable', scene);
      const h = center(hand), l = center($('.lever', door));
      const dx = l.x - h.x, dy = l.y - h.y;
      cable.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
      sfx('pop');
      await Promise.all([
        anim(hand, [{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px,${dy}px) scale(.6)` }], { duration: 380, easing: 'cubic-bezier(.3,.8,.3,1)' }),
        anim(cable, [{ width: '0px' }, { width: Math.hypot(dx, dy) + 'px' }], { duration: 380, easing: 'cubic-bezier(.3,.8,.3,1)' }),
      ]);
      door.classList.add(good ? 'open' : 'shake');
      if (good) sfx('door');
      await wait(250);
      await Promise.all([
        anim(hand, [{ transform: `translate(${dx}px,${dy}px) scale(.6)` }, { transform: 'translate(0,0)' }], { duration: 300 }),
        anim(cable, [{ width: Math.hypot(dx, dy) + 'px' }, { width: '0px' }], { duration: 300 }),
      ]);
      await wait(good ? 350 : 100);
      door.classList.remove('shake');
    },
  },

  // Tirs au but contre Assad.
  penalty: {
    build(q, label) {
      return `
        <div class="pitch">
          <div class="goal"><div class="net"></div>
            <div class="spot s0"></div><div class="spot s1"></div><div class="spot s2"></div>
            <div class="keeper">${assad()}</div>
            <div class="big-text">BUT !</div>
          </div>
          <div class="ball-row">${q.choices.map((c, i) => `
            <button class="choice ball-btn" data-i="${i}" aria-label="Choix ${i + 1}"><span class="ball">⚽</span><span class="label">${label(c)}</span></button>`).join('')}
          </div>
        </div>`;
    },
    async anim(scene, i, good) {
      const ball = $$('.ball', scene)[i];
      const keeper = $('.keeper', scene);
      const b = center(ball), s = center($('.spot.s' + i, scene));
      const dx = s.x - b.x, dy = s.y - b.y;
      sfx('kick');
      const side = good ? (i === 0 ? 2 : i === 2 ? 0 : Math.random() < 0.5 ? 0 : 2) : i;
      keeper.className = 'keeper dive' + side;
      await anim(ball, [
        { transform: 'translate(0,0) scale(1) rotate(0)' },
        { transform: `translate(${dx * 0.5}px,${dy * 0.6}px) scale(.85) rotate(300deg)`, offset: 0.5 },
        { transform: `translate(${dx}px,${dy}px) scale(.6) rotate(600deg)` },
      ], { duration: 520, easing: 'ease-out' });
      if (good) { $('.goal', scene).classList.add('scored'); sfx('cheer'); await wait(800); }
      else { keeper.classList.add('catch'); sfx('bounce'); await wait(500); }
      ball.getAnimations().forEach((a) => a.cancel());
      if (!good) keeper.className = 'keeper';
    },
  },

  // Paniers avec Fifi : la série de bonnes réponses fait reculer jusqu'à 3 points.
  basket: {
    build(q, label, ctx) {
      const pts = ctx.streak >= 2 ? 3 : 2;
      return `
        <div class="court">
          <div class="score-board"><span>🏀 ${ctx.score}</span><small>${pts === 3 ? 'Tir à 3 points !' : 'Tir à 2 points'}</small></div>
          <div class="hoop-wrap">${hoop()}<div class="big-text">${pts} PTS !</div></div>
          <div class="fifi-side">${fifi()}</div>
          <div class="ball-row">${q.choices.map((c, i) => `
            <button class="choice ball-btn" data-i="${i}" aria-label="Choix ${i + 1}"><span class="ball">🏀</span><span class="label">${label(c)}</span></button>`).join('')}
          </div>
        </div>`;
    },
    async anim(scene, i, good, ctx) {
      const ball = $$('.ball', scene)[i];
      const rim = $('.hoop-wrap', scene).getBoundingClientRect();
      const b = center(ball);
      const tx = rim.left + rim.width / 2 - b.x, ty = rim.top + rim.height * 0.45 - b.y;
      const peak = Math.min(ty, 0) - 120;
      const frames = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        const x = tx * t + (good ? 0 : (i === 0 ? -1 : 1) * 30 * t);
        const y = (1 - t) * (1 - t) * 0 + 2 * (1 - t) * t * peak + t * t * ty;
        frames.push({ transform: `translate(${x}px,${y}px) scale(${1 - 0.35 * t}) rotate(${t * 360}deg)` });
      }
      await anim(ball, frames, { duration: 650, easing: 'linear' });
      if (good) {
        sfx('swish');
        await anim(ball, [frames.at(-1), { transform: `translate(${tx}px,${ty + 70}px) scale(.6)`, opacity: 0 }], { duration: 300 });
        ctx.streak++;
        ctx.score += ctx.streak >= 3 ? 3 : 2;
        $('.hoop-wrap', scene).classList.add('scored');
        sfx('cheer');
        await wait(600);
      } else {
        ctx.streak = 0;
        sfx('bounce');
        await anim(ball, [frames.at(-1), { transform: `translate(${tx + (i === 0 ? -160 : 160)}px,${ty + 260}px) scale(.7) rotate(500deg)` }], { duration: 500, easing: 'ease-in' });
      }
      ball.getAnimations().forEach((a) => a.cancel());
    },
  },

  // La cuisine : Hbibiti demande un ingrédient, on le met dans le tajine.
  kitchen: {
    build(q, label) {
      return `
        <div class="kitchen">
          <div class="cook"><div class="cook-gm">${hbibiti('talk')}</div><div class="pot">${tajine()}</div></div>
          <div class="ingredients">${q.choices.map((c, i) => `
            <button class="choice ingredient" data-i="${i}" aria-label="Choix ${i + 1}">${label(c)}</button>`).join('')}
          </div>
        </div>`;
    },
    async anim(scene, i, good) {
      const card = $$('.ingredient', scene)[i];
      const pot = $('.pot', scene);
      const c = center(card), p = center(pot);
      if (good) {
        sfx('pop');
        await anim(card, [{ transform: 'translate(0,0)' }, { transform: `translate(${(p.x - c.x) / 2}px,${p.y - c.y - 120}px) scale(.8)`, offset: 0.5 }, { transform: `translate(${p.x - c.x}px,${p.y - c.y}px) scale(.2)`, opacity: 0 }], { duration: 600, easing: 'ease-in-out' });
        pot.classList.add('bubble');
        sfx('chime');
        await wait(500);
      } else {
        await anim(card, [{ transform: 'translateX(0)' }, { transform: 'translateX(-10px) rotate(-6deg)' }, { transform: 'translateX(10px) rotate(6deg)' }, { transform: 'translateX(0)' }], { duration: 350 });
        card.getAnimations().forEach((a) => a.cancel());
      }
    },
  },

  // La salle de la musique : on tape sur la bonne darbouka.
  drums: {
    build(q, label) {
      return `
        <div class="stage">
          <div class="dada">${dada()}</div>
          <div class="drum-row">${q.choices.map((c, i) => `
            <button class="choice drum" data-i="${i}" aria-label="Choix ${i + 1}"><span class="drum-head"></span><span class="label">${label(c)}</span></button>`).join('')}
          </div>
        </div>`;
    },
    async anim(scene, i, good) {
      const drum = $$('.drum', scene)[i];
      sfx(good ? 'doum' : 'tek');
      await anim($('.drum-head', drum), [{ transform: 'scaleY(1)' }, { transform: 'scaleY(.7)' }, { transform: 'scaleY(1)' }], { duration: 200 });
      if (good) {
        const notes = ['🎵', '🎶', '🎵'];
        const c = center(drum);
        await Promise.all(notes.map(async (n, k) => {
          const s = document.createElement('span');
          s.className = 'flying-note'; s.textContent = n;
          s.style.left = c.x + 'px'; s.style.top = c.y + 'px';
          document.body.appendChild(s);
          await anim(s, [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${(k - 1) * 60}px,-160px) rotate(${(k - 1) * 30}deg)`, opacity: 0 }], { duration: 900, delay: k * 120 });
          s.remove();
        }));
        $('.dada', scene).classList.add('dance');
        setTimeout(() => sfx('doum'), 0); setTimeout(() => sfx('tek'), 150); setTimeout(() => sfx('tek'), 300);
      } else {
        drum.classList.add('shake');
        await wait(350);
        drum.classList.remove('shake');
      }
    },
  },

  // Le jardin de la mosquée : la bonne lanterne s'allume.
  garden: {
    build(q, label) {
      return `
        <div class="garden">
          <div class="mosque-back">${mosque()}</div>
          <div class="lantern-row">${q.choices.map((c, i) => `
            <button class="choice lantern-btn" data-i="${i}" aria-label="Choix ${i + 1}" style="--swing:${(i - 1) * 2}deg">${lantern(['#ffc93c', '#2bb673', '#3b7dd8'][i])}<span class="label">${label(c)}</span></button>`).join('')}
          </div>
        </div>`;
    },
    async anim(scene, i, good) {
      const l = $$('.lantern-btn', scene)[i];
      if (good) { l.classList.add('lit'); sfx('chime'); await wait(900); }
      else { l.classList.add('flicker'); sfx('miss'); await wait(400); l.classList.remove('flicker'); }
    },
  },
};
