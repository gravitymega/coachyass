// 🔬 Le labo du Dr Harley (« Dr Ali ») : l'école secrète où Dr Harley forme Ali pour devenir un savant.
// Plan : docs/contexte/dr-ali.md. Données : labo-missions.js. Logique pure : labo-core.js (testée par labo.test.mjs).
// Règles : une nouvelle mission par jour, tout est dit à voix haute, indice après 2 essais ratés, solution après 3
// puis une nouvelle chance, on félicite l'effort, les notions reviennent (1, 3, 7, 14, 30 jours).
import { screen, el, shuffled, pickOne } from './act-kit.js';
import { CHAPITRES } from './labo-missions.js';
import { DOMAINES, dayKey, enLettres, missionsState, recordMission, newLabo, gradeOf, chapitresFinis, bulletin, robotRun, robotSolution, mergeLabo } from './labo-core.js';
import { encouragement } from './ville3d-dialogues.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MISSIONS = CHAPITRES.flatMap((c) => c.missions.map((m) => ({ ...m, chapitre: c })));

// Dr Harley, dessiné pour le jeu : blouse blanche, lunettes rondes, cheveux en bataille, nœud papillon.
export const harleySVG = (mood = 'happy') => `<svg class="harley" viewBox="0 0 120 140" aria-label="Dr Harley">
  <path d="M22 140 Q24 92 60 88 Q96 92 98 140Z" fill="#f4f6fb" stroke="#c9cfdc" stroke-width="2"/>
  <path d="M52 92 L60 112 L68 92Z" fill="#7aa7ff"/><path d="M50 96 L60 102 L50 108Z M70 96 L60 102 L70 108Z" fill="#e5484d"/>
  <rect x="80" y="108" width="10" height="16" rx="2" fill="#7fd1ae"/><circle cx="85" cy="106" r="3" fill="#a6e3c9"/>
  <circle cx="60" cy="56" r="30" fill="#f2c9a0"/>
  <path d="M30 50 Q26 20 46 22 Q50 8 64 16 Q78 8 84 24 Q98 26 90 50 Q86 34 74 32 Q62 38 50 32 Q36 34 30 50Z" fill="#b8bcc6"/>
  <g fill="none" stroke="#2b2140" stroke-width="3"><circle cx="48" cy="56" r="9" fill="#fff" fill-opacity=".5"/><circle cx="72" cy="56" r="9" fill="#fff" fill-opacity=".5"/><path d="M57 56 L63 56"/></g>
  <circle cx="48" cy="57" r="3.2" fill="#2b2140"/><circle cx="72" cy="57" r="3.2" fill="#2b2140"/>
  <circle cx="40" cy="70" r="4" fill="#f5a3a3" opacity=".6"/><circle cx="80" cy="70" r="4" fill="#f5a3a3" opacity=".6"/>
  ${mood === 'cheer' ? '<path d="M48 72 Q60 86 72 72Z" fill="#7a2e2e"/>' : mood === 'talk' ? '<ellipse cx="60" cy="75" rx="6" ry="4" fill="#7a2e2e"/>' : '<path d="M49 73 Q60 81 71 73" fill="none" stroke="#7a2e2e" stroke-width="3" stroke-linecap="round"/>'}
</svg>`;

function laboOf(p) { p.progress.labo = { ...newLabo(), ...(p.progress.labo || {}) }; return p.progress.labo; }

// Un seul labo sur tous les appareils (tablette, harley-lab) : le Worker garde les progrès (KV), protégés par le code famille.
// Un seul appel PUT envoie le labo local et reçoit la fusion des deux. Sans Internet ou sans code : on joue quand même.
let lastSync = '';
export async function syncLabo(ctx, p = ctx.P()) {
  const code = ctx.settings.laboCode;
  if (!code || navigator.onLine === false) return { ok: false, raison: code ? 'hors ligne' : 'pas de code famille' };
  try {
    const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await window.fetch(`api/labo?enfant=${encodeURIComponent(p.kid.id)}`, { method: 'PUT', signal: ctrl.signal,
      headers: { 'content-type': 'application/json', 'x-famille': code }, body: JSON.stringify({ labo: laboOf(p) }) });
    clearTimeout(timer);
    if (!r.ok) return { ok: false, raison: r.status === 401 ? 'code famille incorrect' : 'serveur indisponible' };
    const { labo: merged } = await r.json();
    const changed = JSON.stringify(merged) !== JSON.stringify(p.progress.labo);
    p.progress.labo = mergeLabo(p.progress.labo, merged);
    ctx.saveAll();
    lastSync = new Date().toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });
    return { ok: true, changed };
  } catch { return { ok: false, raison: 'hors ligne' }; }
}

// Le docteur parle : bulle de texte + voix.
function docSays(ctx, box, ...lines) {
  box.querySelector('.lb-bubble').textContent = lines.join(' ');
  box.querySelector('.harley-wrap').innerHTML = harleySVG('talk');
  return ctx.say(...lines).finally(() => { box.querySelector('.harley-wrap').innerHTML = harleySVG('happy'); });
}

// ---------- La carte du labo ----------
export function labo(ctx, { synced = false } = {}) {
  const p = ctx.P(), kid = p.kid, lb = laboOf(p), today = dayKey();
  // Récupère les progrès faits sur l'autre appareil, puis réaffiche si quelque chose a changé.
  if (!synced) syncLabo(ctx, p).then((r) => { if (r.changed && document.querySelector('.lb-chap')) labo(ctx, { synced: true }); });
  const libre = !!ctx.settings.laboLibre;
  const grade = gradeOf(CHAPITRES, lb);
  const body = screen(ctx, '🔬 Le labo du Dr Harley', `${grade.e} ${grade.nom}`);
  const enc = encouragement(kid, new Date(), 3);
  const head = el(`<div class="act-card lb-head"><div class="harley-wrap">${harleySVG()}</div><p class="lb-bubble"></p></div>`);
  body.append(head);
  // Un seul fil de missions pour tous les chapitres : le chapitre suivant s'ouvre après le défi du précédent,
  // et la règle « une nouvelle mission par jour » vaut pour tout le labo.
  const tout = missionsState(MISSIONS, lb, today, { libre });
  for (const c of CHAPITRES) {
    const st = tout.filter((x) => x.m.chapitre === c);
    const pieces = c.missions.map((m) => `<span class="lb-piece ${lb.faits[m.id] ? 'got' : ''}" title="${ctx.esc(m.piece.nom)}">${lb.faits[m.id] ? m.piece.e : '❔'}</span>`).join('');
    const card = el(`<div class="act-card lb-chap"><h3>Chapitre ${c.id.slice(1)} : ${ctx.esc(c.titre)} <span class="lb-pingo" title="Pingo">🐧</span></h3>
      <div class="lb-pieces">${pieces}</div><div class="act-grid lb-missions"></div></div>`);
    card.querySelector('.lb-missions').innerHTML = st.map(({ m, etat, revue }, i) => {
      const d = DOMAINES[m.domaine];
      const tag = etat === 'faite' ? (revue ? '🔁 À revoir aujourd’hui' : '✅ Rejouer') : etat === 'ouverte' ? '⭐ Nouvelle mission !' : etat === 'demain' ? '🌙 Demain matin' : '🔒';
      return `<button class="act-tile lb-tile ${etat}" data-m="${m.id}" ${etat === 'fermee' || etat === 'demain' ? 'disabled' : ''}>
        <span class="e">${d.e}</span><b>${i + 1}. ${ctx.esc(m.titre)}</b><br><small>${tag}</small></button>`;
    }).join('');
    card.querySelector('.lb-missions').onclick = (e) => { const b = e.target.closest('[data-m]'); if (b && !b.disabled) { ctx.sfx('tap'); mission(ctx, MISSIONS.find((m) => m.id === b.dataset.m)); } };
    body.append(card);
  }
  const foot = el(`<div class="act-card"><div class="act-row"><button class="go small alt" data-par>🔒 Parents : bulletin et réglages</button></div></div>`);
  foot.querySelector('[data-par]').onclick = () => ctx.openGate(() => parents(ctx));
  body.append(foot);
  const next = MISSIONS.find((m) => !lb.faits[m.id]);
  const first = !Object.keys(lb.faits).length;
  const lines = first
    ? [`Bonjour ${kid.name} ! Je suis le docteur Harley.`, 'Bienvenue dans mon labo secret.', `${kid.name}, veux-tu devenir mon assistant ? Commence par la première mission !`]
    : !next ? [`Re-bonjour ${kid.name} !`, 'Tu as fini toutes les missions. Bravo ! Je prépare le prochain chapitre, et tu peux rejouer les missions.']
    : tout.find((x) => x.m.id === next.id)?.etat === 'ouverte'
      ? [`Re-bonjour ${kid.name} !`, 'Une nouvelle mission t’attend aujourd’hui.']
      : [`Re-bonjour ${kid.name} !`, 'Ta mission du jour est faite. Bravo ! La prochaine arrive demain matin.'];
  if (enc) lines.push(enc);
  docSays(ctx, head, ...lines);
}

// ---------- Une mission ----------
async function mission(ctx, m) {
  const p = ctx.P(), lb = laboOf(p), kid = p.kid, today = dayKey();
  const rv = m.notions.map((n) => lb.revues[n]).filter(Boolean);
  const niveau = rv.some((r) => r.doux) ? 'doux' : rv.length && rv.every((r) => r.monter) ? 'monter' : 'normal';
  const d = DOMAINES[m.domaine];
  const body = screen(ctx, `${d.e} ${m.titre}`, `Pièce : ${m.piece.e}`);
  const head = el(`<div class="act-card lb-head"><div class="harley-wrap">${harleySVG()}</div><p class="lb-bubble"></p></div>`);
  let zone = el('<div class="act-card lb-zone"></div>');
  body.append(head, zone);
  let leave = false;
  document.addEventListener('act-leave', () => { leave = true; }, { once: true });
  const t0 = Date.now();
  const res = { ok: true, essais: 0, indices: 0, solution: false };
  zone.innerHTML = '<div class="act-row"><button class="go" data-lbgo>C’est parti ! ➜</button></div>';
  const story = docSays(ctx, head, ...m.histoire);
  await Promise.race([story, new Promise((r) => { zone.querySelector('[data-lbgo]').onclick = r; })]);
  ctx.stopVoice(); ctx.sfx('tap');
  for (const step of m.etapes) {
    if (leave) return;
    const fresh = el('<div class="act-card lb-zone"></div>'); zone.replaceWith(fresh); zone = fresh; // une zone neuve par étape (pas d'anciens écouteurs)
    const r = await ENGINES[step.moteur](ctx, zone, head, step, { niveau, kid });
    if (r === null || leave) return; // mission « en vrai » remise à plus tard
    res.essais = Math.max(res.essais, r.essais); res.indices += r.indices; res.solution ||= r.solution; res.ok &&= r.ok;
  }
  res.ms = Date.now() - t0;
  const { premiere } = recordMission(lb, m, res, today);
  syncLabo(ctx, p); // partagé tout de suite avec l'autre appareil
  if (premiere) ctx.stars(m.domaine === 'defi' ? 5 : 2); else ctx.saveAll();
  // Récompense : la pièce, et des félicitations pour l'EFFORT (pas « tu es un génie »).
  const effort = res.solution ? 'Tu n’as pas abandonné : c’est comme ça qu’on devient savant !'
    : res.essais > 1 ? 'Tu as essayé une autre façon, bravo !' : 'Tu as bien réfléchi avant de répondre, bravo !';
  const chapFini = m.domaine === 'defi' && m.chapitre.missions.every((x) => lb.faits[x.id]);
  const grade = gradeOf(CHAPITRES, lb);
  zone.innerHTML = `<div class="lb-reward"><div class="lb-big">${m.piece.e}</div>
    <p class="act-big">${chapFini ? `Badge : ${ctx.esc(m.chapitre.badge.nom)} !` : `Tu as retrouvé ${ctx.esc(m.piece.nom)} !`}</p>
    ${chapFini ? `<p class="lb-machine">${ctx.esc(m.chapitre.fin || '⚡ Bravo ! ⚡')}</p><p>Ton grade : ${grade.e} <b>${ctx.esc(grade.nom)}</b></p>` : ''}
    <div class="act-row"><button class="go" data-back>Retour au labo ➜</button></div></div>`;
  ctx.sfx('win'); ctx.confetti(chapFini ? 120 : 60);
  zone.querySelector('[data-back]').onclick = () => { ctx.stopVoice(); labo(ctx); };
  const enc = encouragement(kid, new Date(), MISSIONS.indexOf(m));
  head.querySelector('.harley-wrap').innerHTML = harleySVG('cheer');
  await ctx.say(effort, chapFini ? `Tu es maintenant ${grade.nom} ! Je suis très fier de toi, ${kid.name}.` : `Merci ${kid.name}, tu m’as rendu ${m.piece.nom}.`, ...(enc ? [enc] : []));
  head.querySelector('.lb-bubble').textContent = effort + (enc ? ' ' + enc : '');
}

// Les essais ratés : indice après 2, solution après 3 puis une nouvelle chance.
function tries(ctx, head, step, { showHint, showSolution }) {
  const r = { ok: true, essais: 1, indices: 0, solution: false };
  let rates = 0;
  return {
    r,
    async miss() {
      rates++; r.essais++; ctx.sfx('miss');
      if (rates === 2) { r.indices++; showHint?.(); await docSays(ctx, head, 'Un indice :', step.indice || 'Prends ton temps et regarde bien.'); }
      else if (rates >= 3) { r.solution = true; rates = 0; await showSolution?.(); }
      else await docSays(ctx, head, pickOne(['Presque ! Essaie encore.', 'Pas tout à fait. Encore un essai !', 'Ce n’est pas grave, on essaie encore.']));
    },
  };
}

// ---------- Les moteurs ----------
const ENGINES = {
  // 🔢 Compter des objets (on peut toucher chaque objet pour le marquer en comptant).
  async compter(ctx, zone, head, step, { niveau }) {
    const lo = niveau === 'doux' ? step.min : niveau === 'monter' ? Math.ceil((step.min + step.max) / 2) : step.min;
    const hi = niveau === 'doux' ? Math.ceil((step.min + step.max) / 2) : step.max;
    const draw = () => lo + Math.floor(Math.random() * (hi - lo + 1));
    let n = draw();
    const t = tries(ctx, head, step, {
      showHint: () => zone.querySelector('.lb-fiole')?.classList.add('hint'),
      async showSolution() {
        const items = [...zone.querySelectorAll('.lb-obj')];
        for (const [i, it] of items.entries()) { it.classList.add('on'); it.dataset.n = i + 1; ctx.say(enLettres(i + 1)); await wait(450); }
        await docSays(ctx, head, `Il y en avait ${enLettres(n)}. À toi, avec une nouvelle fiole !`);
        n = draw(); render();
      },
    });
    const render = () => {
      zone.innerHTML = `<p class="act-big lb-q">${ctx.esc(step.consigne)}</p><div class="lb-fiole">${Array.from({ length: n }, () => `<button class="lb-obj">${step.objet}</button>`).join('')}</div><div class="act-row lb-choices"></div>`;
      zone.querySelector('.lb-fiole').onclick = (e) => { const o = e.target.closest('.lb-obj'); if (o) { o.classList.toggle('on'); ctx.sfx('pop'); } };
      const opts = shuffled([...new Set([n, n + 1, n - 1, n + 2].filter((x) => x > 0))].slice(0, 3));
      zone.querySelector('.lb-choices').innerHTML = opts.map((x) => `<button class="act-choice" data-n="${x}">${x}</button>`).join('');
    };
    render();
    docSays(ctx, head, step.consigne);
    return new Promise((resolve) => {
      zone.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-n]'); if (!b || b.disabled) return;
        ctx.stopVoice();
        if (+b.dataset.n === n) { b.classList.add('won'); ctx.sfx('ok'); ctx.confetti(24); await ctx.say(`Oui ! ${enLettres(n)} !`); resolve(t.r); }
        else { b.disabled = true; b.classList.add('tried'); await t.miss(); }
      });
    });
  },

  // 🤖 Programmer Bip avec des flèches, puis Go.
  async robot(ctx, zone, head, step) {
    const max = step.maxFleches || 6, sol = robotSolution(step);
    let prog = [], busy = false;
    zone.innerHTML = `<p class="act-big lb-q">${ctx.esc(step.consigne)}</p>
      <div class="lb-grid" style="grid-template-columns:repeat(${step.largeur},1fr)"></div>
      <div class="lb-prog" aria-label="Le programme de Bip"></div>
      <div class="act-row lb-arrows">${['←', '↑', '↓', '→'].map((f) => `<button class="act-choice lb-arrow" data-f="${f}">${f}</button>`).join('')}
        <button class="act-choice" data-del aria-label="Effacer">⌫</button><button class="go" data-run>▶ Go</button></div>`;
    const grid = zone.querySelector('.lb-grid');
    const drawGrid = (bip = step.depart, trace = []) => {
      grid.innerHTML = '';
      for (let y = 0; y < step.hauteur; y++) for (let x = 0; x < step.largeur; x++) {
        const mur = (step.murs || []).some(([a, b]) => a === x && b === y);
        const here = bip[0] === x && bip[1] === y, goal = step.but[0] === x && step.but[1] === y;
        const tr = trace.some(([a, b]) => a === x && b === y);
        grid.insertAdjacentHTML('beforeend', `<div class="lb-cell ${mur ? 'mur' : ''} ${tr ? 'trace' : ''}">${mur ? '🧱' : here ? '🤖' : goal ? step.objet || '🪙' : ''}</div>`);
      }
    };
    const drawProg = (hint = '') => {
      zone.querySelector('.lb-prog').innerHTML = (prog.length ? prog.map((f, i) => `<span class="lb-chip" data-i="${i}">${f}</span>`).join('') : '<small>Touche les flèches pour écrire le programme de Bip</small>')
        + (hint ? `<span class="lb-chip hint">${hint} ?</span>` : '') + `<small class="lb-count">${prog.length} / ${max}</small>`;
    };
    drawGrid(); drawProg();
    const animate = async (fl) => {
      const run = robotRun(step, fl);
      for (let i = 1; i < run.chemin.length; i++) { drawGrid(run.chemin[i], run.chemin.slice(0, i)); ctx.sfx('beep'); await wait(380); }
      if (run.bloque) { ctx.sfx('boing'); grid.classList.add('shake'); await wait(400); grid.classList.remove('shake'); }
      return run;
    };
    const t = tries(ctx, head, step, {
      showHint: () => drawProg(sol[0]),
      async showSolution() {
        await docSays(ctx, head, 'Regarde le chemin de Bip.');
        prog = sol.slice(); drawProg(); await animate(sol);
        await docSays(ctx, head, 'À toi maintenant !');
        prog = []; drawGrid(); drawProg();
      },
    });
    docSays(ctx, head, step.consigne);
    return new Promise((resolve) => {
      zone.addEventListener('click', async (e) => {
        if (busy) return;
        const f = e.target.closest('[data-f]'), chip = e.target.closest('.lb-chip[data-i]');
        if (f && prog.length < max) { prog.push(f.dataset.f); ctx.sfx('tap'); drawProg(); }
        else if (chip) { prog.splice(+chip.dataset.i, 1); drawProg(); }
        else if (e.target.closest('[data-del]')) { prog.pop(); drawProg(); }
        else if (e.target.closest('[data-run]') && prog.length) {
          busy = true; ctx.stopVoice();
          const run = await animate(prog);
          if (run.gagne) { ctx.sfx('ok'); ctx.confetti(40); await ctx.say('Bip a réussi ! Ton programme marche.'); busy = false; return resolve(t.r); }
          await docSays(ctx, head, run.bloque ? 'Bip s’est cogné ! Change une flèche.' : 'Bip n’est pas arrivé au bon endroit.');
          await t.miss(); prog = []; drawGrid(); drawProg(); busy = false;
        }
      });
    });
  },

  // 🐧 Glisser chaque objet dans la bonne boîte (ou toucher l'objet, puis la boîte).
  async ranger(ctx, zone, head, step) {
    const left = shuffled(step.objets.map((o, i) => ({ ...o, i })));
    let pick = null;
    zone.innerHTML = `<p class="act-big lb-q">${ctx.esc(step.consigne)}</p><div class="lb-tray"></div>
      <div class="lb-boxes">${step.boites.map((b) => `<div class="lb-box" data-b="${b.id}"><div class="lb-box-h">${b.e} ${ctx.esc(b.nom)}</div><div class="lb-box-in"></div></div>`).join('')}</div>`;
    const tray = zone.querySelector('.lb-tray');
    const drawTray = () => { tray.innerHTML = left.map((o) => `<button class="lb-item ${pick === o.i ? 'picked' : ''}" data-o="${o.i}" aria-label="${ctx.esc(o.nom)}">${o.e}</button>`).join(''); };
    drawTray();
    let resolveAll;
    const done = new Promise((r) => { resolveAll = r; });
    const t = tries(ctx, head, step, {
      showHint: () => zone.querySelectorAll('.lb-box').forEach((b) => b.classList.add('hint')),
      async showSolution() {
        const o = left[0];
        await docSays(ctx, head, `Regarde : ${o.nom} va dans la boîte ${step.boites.find((b) => b.id === o.boite).nom}.`);
        await place(o, o.boite, true);
      },
    });
    async function place(o, boxId, auto = false) {
      if (o.boite !== boxId) { pick = null; drawTray(); return t.miss(); }
      left.splice(left.indexOf(o), 1); pick = null; drawTray();
      zone.querySelector(`[data-b="${boxId}"] .lb-box-in`).insertAdjacentHTML('beforeend', `<span>${o.e}</span>`);
      if (!auto) { ctx.sfx('ok'); ctx.say(pickOne(['Oui !', 'Bien rangé !', 'Bravo !'])); }
      if (!left.length) { ctx.confetti(40); await ctx.say('Tout est rangé ! Comme dans les dossiers d’un ordinateur.'); resolveAll(t.r); }
    }
    // Glisser avec le doigt ou la souris
    let drag = null;
    tray.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('[data-o]'); if (!b) return;
      const o = left.find((x) => x.i === +b.dataset.o);
      drag = { o, x: e.clientX, y: e.clientY, ghost: null, moved: false };
      tray.setPointerCapture?.(e.pointerId);
    });
    tray.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
      if (!drag.ghost) { drag.moved = true; drag.ghost = el(`<div class="lb-ghost">${drag.o.e}</div>`); document.body.append(drag.ghost); }
      drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
    });
    tray.addEventListener('pointerup', (e) => {
      if (!drag) return;
      const d = drag; drag = null; d.ghost?.remove();
      if (!d.moved) { pick = d.o.i; ctx.sfx('tap'); drawTray(); return; } // toucher : l'objet est choisi, on touche ensuite la boîte
      const box = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-b]');
      if (box) place(d.o, box.dataset.b);
    });
    zone.querySelector('.lb-boxes').addEventListener('click', (e) => {
      const box = e.target.closest('[data-b]'); if (!box || pick === null) return;
      place(left.find((x) => x.i === pick), box.dataset.b);
    });
    docSays(ctx, head, step.consigne);
    return done;
  },

  // 🧩 Le message secret : chaque dessin est une lettre.
  async secret(ctx, zone, head, step) {
    const word = [...step.mot], found = [];
    const legend = Object.entries(step.code);
    zone.innerHTML = `<p class="act-big lb-q">${ctx.esc(step.consigne)}</p>
      <div class="lb-legend">${legend.map(([l, d]) => `<span data-l="${l}">${d} = <b>${l}</b></span>`).join('')}</div>
      <div class="lb-word"></div><div class="act-row lb-keys">${shuffled(legend.map(([l]) => l)).map((l) => `<button class="act-choice" data-k="${l}">${l}</button>`).join('')}</div>`;
    const drawWord = () => {
      zone.querySelector('.lb-word').innerHTML = word.map((l, i) => `<span class="lb-letter ${i === found.length ? 'cur' : ''}"><i>${step.code[l]}</i><b>${found[i] || '_'}</b></span>`).join('');
      zone.querySelectorAll('.lb-legend [data-l]').forEach((x) => x.classList.remove('hint'));
    };
    drawWord();
    const t = tries(ctx, head, step, {
      showHint: () => zone.querySelector(`.lb-legend [data-l="${word[found.length]}"]`)?.classList.add('hint'),
      async showSolution() { const l = word[found.length]; await docSays(ctx, head, `Ce dessin, c’est la lettre ${l}.`); found.push(l); drawWord(); },
    });
    docSays(ctx, head, step.consigne);
    return new Promise((resolve) => {
      zone.querySelector('.lb-keys').addEventListener('click', async (e) => {
        const k = e.target.closest('[data-k]'); if (!k || found.length >= word.length) return;
        ctx.stopVoice();
        if (k.dataset.k === word[found.length]) { found.push(k.dataset.k); ctx.sfx('ok'); drawWord(); }
        else await t.miss();
        if (found.length === word.length) { ctx.confetti(50); await ctx.say(`Le mot caché est : ${step.mot.split('').join(', ')}. ${step.mot.charAt(0) + step.mot.slice(1).toLowerCase()} !`); resolve(t.r); }
      });
    });
  },

  // 🏠 Une mission en vrai, avec Papa ou Maman (confirmée par un parent), puis des questions.
  async maison(ctx, zone, head, step, o) {
    zone.innerHTML = `<p class="act-big lb-q">🏠 ${ctx.esc(step.consigne)}</p><p class="lb-todo">${ctx.esc(step.aFaire || '')}</p>
      <div class="act-row"><button class="go" data-ok>✅ C’est fait (un parent confirme)</button><button class="go alt" data-later>Plus tard</button></div>`;
    docSays(ctx, head, step.consigne);
    const ok = await new Promise((resolve) => {
      zone.querySelector('[data-later]').onclick = () => { ctx.stopVoice(); resolve(false); };
      zone.querySelector('[data-ok]').onclick = () => ctx.openGate(() => resolve(true));
    });
    if (!ok) { await ctx.say('D’accord ! La mission t’attend. Fais-la avec Papa ou Maman, puis reviens.'); labo(ctx); return null; }
    ctx.sfx('win');
    return step.questions?.length ? ENGINES.quiz(ctx, zone, head, { ...step, consigne: 'Deux petites questions sur ta mission.' }, o) : { ok: true, essais: 1, indices: 0, solution: false };
  },

  // Questions à choix (le docteur lit la question et les réponses).
  async quiz(ctx, zone, head, step) {
    const total = { ok: true, essais: 1, indices: 0, solution: false };
    if (step.consigne) await docSays(ctx, head, step.consigne);
    for (const q of step.questions) {
      zone.innerHTML = `<p class="act-big lb-q">${ctx.esc(q.q)}</p><div class="act-choices lb-choices">${q.choix.map((c, i) => `<button class="act-choice" data-i="${i}">${ctx.esc(c.t)}</button>`).join('')}</div>`;
      const t = tries(ctx, head, { indice: q.indice || 'Écoute encore la question.' }, {
        showHint: () => {},
        async showSolution() { const i = q.choix.findIndex((c) => c.bon); zone.querySelectorAll('.act-choice')[i].classList.add('reveal'); await docSays(ctx, head, `La réponse, c’est : ${q.choix[i].t.replace(/^\P{L}+/u, '')}.`); },
      });
      docSays(ctx, head, q.dit || q.q);
      await new Promise((resolve) => {
        zone.querySelector('.lb-choices').addEventListener('click', async (e) => {
          const b = e.target.closest('[data-i]'); if (!b || b.disabled) return;
          ctx.stopVoice();
          if (q.choix[+b.dataset.i].bon) { b.classList.add('won'); ctx.sfx('ok'); ctx.confetti(24); await ctx.say('Oui, bravo !'); resolve(); }
          else { b.disabled = true; b.classList.add('tried'); await t.miss(); if (t.r.solution) { zone.querySelectorAll('.act-choice').forEach((x) => { x.disabled = false; x.classList.remove('tried'); }); } }
        });
      });
      total.essais = Math.max(total.essais, t.r.essais); total.indices += t.r.indices; total.solution ||= t.r.solution;
    }
    return total;
  },

  // 🎵 Répéter les sons de la machine dans le bon ordre (mémoire).
  async sons(ctx, zone, head, step, { niveau }) {
    const L = Math.max(2, step.longueur + (niveau === 'doux' ? -1 : niveau === 'monter' ? 1 : 0));
    const PADS = [{ c: '#e5484d', f: 262, n: 'rouge' }, { c: '#2bb673', f: 330, n: 'vert' }, { c: '#2b5fb3', f: 392, n: 'bleu' }, { c: '#ffc93c', f: 523, n: 'jaune' }];
    const newSeq = () => Array.from({ length: L }, () => Math.floor(Math.random() * 4));
    let seq = newSeq(), pos = 0, busy = true;
    zone.innerHTML = `<p class="act-big lb-q">${ctx.esc(step.consigne)}</p><div class="lb-pads">${PADS.map((p, i) => `<button class="lb-pad" data-p="${i}" style="background:${p.c}" aria-label="${p.n}"></button>`).join('')}</div>
      <div class="act-row"><button class="go small alt" data-again>🔁 Réécouter</button></div>`;
    const beep = (i, dur = 0.35) => {
      try { const ac = ctx.audio(), o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = PADS[i].f; g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur + 0.05); } catch { /* pas de son */ }
      const pad = zone.querySelector(`[data-p="${i}"]`); pad?.classList.add('lit'); setTimeout(() => pad?.classList.remove('lit'), dur * 900);
    };
    const play = async (slow = 1) => { busy = true; pos = 0; if (/e2e/.test(location.search)) window.__laboSeq = seq; await wait(400); for (const i of seq) { beep(i, 0.35 * slow); await wait(650 * slow); } busy = false; };
    const t = tries(ctx, head, step, {
      showHint: () => {},
      async showSolution() { await docSays(ctx, head, 'Écoute bien : ' + seq.map((i) => PADS[i].n).join(', ') + '.'); await play(1.4); await docSays(ctx, head, 'Nouvelle chance, avec de nouveaux sons !'); seq = newSeq(); },
    });
    await docSays(ctx, head, step.consigne);
    await play();
    return new Promise((resolve) => {
      zone.addEventListener('click', async (e) => {
        if (e.target.closest('[data-again]')) { if (!busy) play(); return; }
        const b = e.target.closest('[data-p]'); if (!b || busy) return;
        const i = +b.dataset.p; beep(i);
        if (i !== seq[pos]) { busy = true; await wait(300); await t.miss(); await play(t.r.indices ? 1.4 : 1); return; }
        pos++;
        if (pos === seq.length) { busy = true; ctx.sfx('win'); ctx.confetti(50); await ctx.say('Bravo ! Tu as répété tous les sons de la machine.'); resolve(t.r); }
      });
    });
  },
};

// ---------- Pour les parents : bulletin du dimanche, progrès pour Dr Harley, réglage ----------
function parents(ctx) {
  const p = ctx.P(), lb = laboOf(p), today = dayKey();
  const body = screen(ctx, '🔬 Le labo : espace parents');
  const b = bulletin(CHAPITRES, lb, today, p.kid.name);
  const card = el(`<div class="act-card"><h3>Bulletin de la semaine (${ctx.esc(p.kid.name)})</h3><ul>${b.map((x) => `<li>${ctx.esc(x)}</li>`).join('')}</ul>
    <p>Chapitres finis : ${chapitresFinis(CHAPITRES, lb)} · Grade : ${ctx.esc(gradeOf(CHAPITRES, lb).nom)} · Missions jouées : ${lb.essais.length}</p>
    <h3>Un seul labo sur la tablette et harley-lab</h3>
    <label class="field">Code famille (le même sur chaque appareil, au moins 6 caractères)
      <input type="password" data-code autocomplete="off" value="${ctx.esc(ctx.settings.laboCode || '')}"></label>
    <div class="act-row"><button class="go small" data-sync>🔄 Synchroniser maintenant</button><span data-state>${lastSync ? `Dernière synchronisation : ${lastSync}` : ''}</span></div>
    <label class="check"><input type="checkbox" data-libre ${ctx.settings.laboLibre ? 'checked' : ''}> Ouvrir toutes les missions (sinon : une nouvelle par jour)</label>
    <div class="act-row"><button class="go small" data-dl>📤 Télécharger les progrès pour Dr Harley</button><button class="go small alt" data-back>Retour au labo</button></div>
    <p class="act-note">Avec le code famille, les progrès sont partagés tout seuls entre la tablette et harley-lab (et Dr Harley les lit pour adapter les missions). Le fichier est une copie de secours.</p></div>`);
  card.querySelector('[data-libre]').onchange = (e) => { ctx.settings.laboLibre = e.target.checked; ctx.saveSettings(); };
  card.querySelector('[data-back]').onclick = () => labo(ctx);
  card.querySelector('[data-code]').onchange = (e) => { ctx.settings.laboCode = e.target.value.trim(); ctx.saveSettings(); };
  card.querySelector('[data-sync]').onclick = async () => {
    ctx.settings.laboCode = card.querySelector('[data-code]').value.trim(); ctx.saveSettings();
    const st = card.querySelector('[data-state]'); st.textContent = '…';
    const r = await syncLabo(ctx, p);
    st.textContent = r.ok ? `✅ Synchronisé (${lastSync})` : `⚠️ ${r.raison}`;
    if (r.ok) ctx.sfx('ok');
  };
  card.querySelector('[data-dl]').onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'hbibiti-labo', version: 1, enfant: p.kid.name, jour: today, grade: gradeOf(CHAPITRES, lb).nom, bulletin: b, labo: lb }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `dr-ali-progres-${today}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  body.append(card);
}
