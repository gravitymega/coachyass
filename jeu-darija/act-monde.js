// Activités « le monde » : voyage au bled, cuisine, 99 noms d'Allah, marché au souk, heures de prière.
import { WORDS } from './core.js';
import { VILLES, RECETTES, NOMS, PRODUITS } from './act-data.js';
import { METHODS, PRAYERS, nextPrayer, hhmm } from './calendrier.js';
import { screen, el, choose, pickOne, shuffled, todayKey } from './act-kit.js';

const word = (id) => WORDS.find((w) => w.id === id);
const COUNTRY = { ma: '🇲🇦 Maroc', dz: '🇩🇿 Algérie' };

// ---------- 🗺️ Le voyage au Maroc et en Algérie ----------
export function voyage(ctx) {
  const prog = ctx.P().progress;
  prog.passport = prog.passport || {};
  const body = screen(ctx, '🗺️ Voyage au bled', `🛂 ${Object.keys(prog.passport).length} / ${VILLES.length}`);
  for (const pays of ['ma', 'dz']) {
    const card = el(`<div class="act-card"><p class="act-big">${COUNTRY[pays]}</p><div class="act-grid"></div></div>`);
    card.querySelector('.act-grid').innerHTML = VILLES.filter((v) => v.pays === pays).map((v) => `<button class="act-tile" data-v="${v.id}"><span class="e">${prog.passport[v.id] ? '🛂' : v.e}</span><b>${v.name}</b><br><small>${prog.passport[v.id] ? 'Tampon gagné !' : 'À visiter'}</small></button>`).join('');
    body.append(card);
  }
  body.onclick = (e) => { const b = e.target.closest('[data-v]'); if (b) { body.onclick = null; ctx.sfx('tap'); ville(ctx, VILLES.find((v) => v.id === b.dataset.v)); } };
  ctx.say('Choisis une ville. On part en voyage au Maroc et en Algérie !');
}
async function ville(ctx, v) {
  const prog = ctx.P().progress;
  const body = screen(ctx, `${v.e} ${v.name}`, COUNTRY[v.pays]);
  const card = el(`<div class="act-card" style="text-align:center">
    <div style="font-size:70px">${v.monument.e}</div><p class="act-big">${ctx.esc(v.monument.name)}</p><p>${ctx.esc(v.monument.fact)}</p>
    <p class="act-big">${v.plat.e} ${ctx.esc(v.plat.name)}</p>
    <p class="act-big">💬 « ${ctx.esc(v.mot.lat)} » : ${ctx.esc(v.mot.fr)}</p>
    <button class="go" id="vy-go">C'est parti pour le quiz ! ➜</button></div>`);
  body.append(card);
  await ctx.say(`Bienvenue à ${v.name} ! Voici ${v.monument.name}. ${v.monument.fact} Ici, on mange ${v.plat.name.toLowerCase()}. Et on dit ${v.mot.lat} : ${v.mot.fr}.`);
  card.querySelector('#vy-go').onclick = async () => {
    const others = VILLES.filter((o) => o !== v);
    const qs = [
      { q: `Quel monument as-tu vu à ${v.name} ?`, right: `${v.monument.e} ${v.monument.name}`, wrong: others.map((o) => `${o.monument.e} ${o.monument.name}`) },
      { q: `Qu'est-ce qu'on mange à ${v.name} ?`, right: `${v.plat.e} ${v.plat.name}`, wrong: others.map((o) => `${o.plat.e} ${o.plat.name}`) },
      { q: `Que veut dire « ${v.mot.lat} » ?`, right: v.mot.fr, wrong: others.map((o) => o.mot.fr) },
    ];
    let all = true;
    const quiz = el('<div class="act-card"><p class="act-big" id="vy-q"></p><div class="act-choices" id="vy-box"></div></div>');
    body.innerHTML = ''; body.append(quiz);
    for (const x of qs) {
      quiz.querySelector('#vy-q').textContent = x.q; ctx.say(x.q);
      const opts = shuffled([{ html: ctx.esc(x.right), correct: true }, ...shuffled(x.wrong).slice(0, 2).map((w) => ({ html: ctx.esc(w), correct: false }))]);
      all = (await choose(ctx, quiz.querySelector('#vy-box'), opts, { onRight: () => ctx.say(ctx.praise()) })) && all;
    }
    const first = !prog.passport[v.id];
    prog.passport[v.id] = true;
    ctx.stars(first ? 3 : 1);
    ctx.sfx('win'); ctx.confetti(80);
    quiz.innerHTML = `<p class="act-big">🛂 Tampon de ${ctx.esc(v.name)} dans ton passeport !</p><button class="go" data-back>Autre ville ➜</button>`;
    ctx.say(`Bravo ! Tu as gagné le tampon de ${v.name} dans ton passeport.`);
    quiz.querySelector('[data-back]').onclick = () => voyage(ctx);
  };
}

// ---------- 🍲 La cuisine de Hbibiti ----------
export function cuisine(ctx) {
  const body = screen(ctx, '🍲 La cuisine de Hbibiti');
  const grid = el('<div class="act-grid"></div>');
  grid.innerHTML = RECETTES.map((r) => `<button class="act-tile" data-r="${r.id}"><span class="e">${r.e}</span><b>${ctx.esc(r.name)}</b></button>`).join('');
  body.append(grid);
  grid.onclick = (e) => { const b = e.target.closest('[data-r]'); if (b) { ctx.sfx('tap'); recette(ctx, RECETTES.find((r) => r.id === b.dataset.r)); } };
  ctx.say(`Qu'est-ce qu'on prépare aujourd'hui avec ${ctx.settings.gm} ?`);
}
async function recette(ctx, r) {
  const d = ctx.settings.dialects[0];
  const body = screen(ctx, `${r.e} ${r.name}`);
  const card = el(`<div class="act-card" style="text-align:center"><p class="act-big" id="cu-ask"></p><div class="cu-bowl" id="cu-bowl"></div><div class="act-row" id="cu-shelf"></div></div>`);
  body.append(card);
  // 1. Rassembler les ingrédients, en comptant.
  for (const ing of r.ing) {
    const w = ing.word && word(ing.word);
    const name = w ? `${ing.fr} (${w[d].lat})` : ing.fr;
    card.querySelector('#cu-ask').textContent = `Jib ${ing.n} ${ing.unit ? ing.unit + ' de ' : ''}${name} ! Touche ${ing.n} fois.`;
    await ctx.say(`Apporte-moi ${ing.n} ${ing.unit ? ing.unit + ' de ' : ''}${ing.fr}.`, ...(w ? [`${ctx.cap(ctx.DIALECT_NAME[d])}, on dit :`, { word: w, d }] : []));
    const shelf = card.querySelector('#cu-shelf');
    const decoys = shuffled(r.ing.filter((x) => x !== ing)).slice(0, 2);
    shelf.innerHTML = shuffled([ing, ...decoys]).map((x) => `<button class="act-choice" data-e="${x.e}" style="font-size:44px">${x.e}</button>`).join('');
    let n = 0;
    await new Promise((resolve) => {
      shelf.onclick = (e) => {
        const b = e.target.closest('[data-e]');
        if (!b) return;
        if (b.dataset.e !== ing.e) { ctx.sfx('miss'); return ctx.say(`Non, ça c'est autre chose. Il faut : ${ing.fr}.`); }
        n++; ctx.sfx('pop');
        card.querySelector('#cu-bowl').insertAdjacentHTML('beforeend', `<span>${ing.e}</span>`);
        ctx.say(String(n));
        if (n === ing.n) { ctx.sfx('ok'); shelf.onclick = null; setTimeout(resolve, 600); }
      };
    });
  }
  // 2. Les étapes dans l'ordre.
  const list = el('<ol class="cu-steps"></ol>');
  card.querySelector('#cu-shelf').replaceWith(list);
  const box = el('<div class="act-choices"></div>');
  card.append(box);
  for (let k = 0; k < r.steps.length; k++) {
    card.querySelector('#cu-ask').textContent = k ? 'Et après ?' : 'Par quoi on commence ?';
    await ctx.say(k ? 'Et après ?' : 'Par quoi on commence ?');
    const left = r.steps.slice(k);
    await choose(ctx, box, shuffled([left[0], ...shuffled(left.slice(1)).slice(0, 2)]).map((s) => ({ html: `<span style="font-size:16px">${ctx.esc(s)}</span>`, correct: s === left[0] })));
    list.insertAdjacentHTML('beforeend', `<li>${ctx.esc(r.steps[k])}</li>`);
  }
  ctx.stars(3); ctx.sfx('win'); ctx.confetti(90);
  card.querySelector('#cu-ask').textContent = `${r.e} Bssaha ! ${r.name} est prêt${r.name.startsWith('La') ? 'e' : ''} !`;
  ctx.say(`Bssaha ! C'est prêt. ${ctx.settings.gm} est fière de toi !`);
  box.innerHTML = '<button class="go" data-back>Une autre recette ➜</button>';
  box.querySelector('[data-back]').onclick = () => cuisine(ctx);
}

// ---------- 🕌 Les 99 noms d'Allah : un nouveau chaque jour ----------
export function noms(ctx) {
  const prog = ctx.P().progress;
  const st = prog.noms = prog.noms || { count: 0, last: '' };
  const today = todayKey();
  let fresh = false;
  if (st.last !== today && st.count < NOMS.length) { st.count++; st.last = today; fresh = true; ctx.stars(1); }
  const cur = NOMS[Math.max(0, st.count - 1)];
  const body = screen(ctx, '🕌 Les 99 noms d’Allah', `${st.count} / 99`);
  body.append(el(`<div class="act-card noms-card" style="text-align:center">
    <p class="act-note">${fresh ? 'Le nom du jour' : 'Le nom du jour (reviens demain pour le suivant !)'}</p>
    <p class="act-ar">${cur.ar}</p><p class="act-big">${ctx.esc(cur.lat)}</p><p class="act-big" style="font-size:20px">${ctx.esc(cur.fr)}</p>
    <button class="go alt" id="nm-hear">🔊 Écouter</button></div>`));
  const grid = el('<div class="act-grid"></div>');
  grid.innerHTML = NOMS.map((n, i) => i < st.count ? `<button class="act-tile" data-n="${i}"><span class="act-ar" style="font-size:24px;display:block">${n.ar}</span><small>${ctx.esc(n.lat)}</small></button>` : `<div class="act-tile locked"><span class="e">🔒</span><small>${i + 1}</small></div>`).join('');
  body.append(grid);
  const speak = (n) => ctx.say(`${n.lat} : ${n.fr}.`);
  body.querySelector('#nm-hear').onclick = () => speak(cur);
  grid.onclick = (e) => { const b = e.target.closest('[data-n]'); if (b) speak(NOMS[+b.dataset.n]); };
  speak(cur);
}

// ---------- 🧮 Le marché au souk ----------
export function marche(ctx) {
  const kid = ctx.P().kid;
  const body = screen(ctx, '🧮 Le marché au souk');
  const card = el(`<div class="act-card" style="text-align:center"><p class="act-big" id="mk-who"></p><div style="font-size:80px" id="mk-item"></div><p class="act-big" id="mk-ask"></p>
    <div class="mk-paid" id="mk-paid"></div><div class="act-row" id="mk-coins"></div><div class="act-choices" id="mk-box"></div><p class="act-note" id="mk-score"></p></div>`);
  body.append(card);
  let round = 0, good = 0;
  const num = (n) => word('n' + n);
  async function next() {
    if (round >= 5) {
      ctx.stars(good >= 4 ? 3 : 1); ctx.sfx('win'); ctx.confetti(80);
      card.querySelector('#mk-ask').textContent = `Bravo ! ${good} achats réussis sur 5.`;
      ctx.say(`Bravo ! Tu sais faire les courses au souk.`);
      card.querySelector('#mk-coins').innerHTML = '<button class="go" data-again>Encore ➜</button>';
      card.querySelector('[data-again]').onclick = () => marche(ctx);
      return;
    }
    round++;
    const d = ctx.settings.dialects[round % ctx.settings.dialects.length];
    const money = d === 'ma' ? 'dirhams' : 'dinars';
    const it = pickOne(PRODUITS);
    card.querySelector('#mk-who').textContent = d === 'ma' ? '🇲🇦 Le marchand de Fès' : '🇩🇿 Le marchand d’Alger';
    card.querySelector('#mk-item').textContent = it.e;
    card.querySelector('#mk-paid').innerHTML = ''; card.querySelector('#mk-box').innerHTML = ''; card.querySelector('#mk-coins').innerHTML = '';
    card.querySelector('#mk-score').textContent = `Achat ${round} / 5`;
    const change = kid.older && round % 2 === 0;
    if (!change) {
      // Payer le bon prix avec des pièces de 1, 2 et 5.
      const price = kid.older ? 3 + Math.floor(Math.random() * 7) : 1 + Math.floor(Math.random() * 5);
      const n = num(price);
      card.querySelector('#mk-ask').textContent = `${it.fr} : ${price} ${money}${n ? ` (« ${n[d].lat} »)` : ''}. Paie avec les pièces !`;
      await ctx.say(`${ctx.cap(it.fr)}, ça fait ${price} ${money}.`, ...(n ? [`${ctx.cap(ctx.DIALECT_NAME[d])}, on dit :`, { word: n, d }] : []));
      let paid = 0;
      const coins = kid.older ? [1, 2, 5] : [1];
      card.querySelector('#mk-coins').innerHTML = coins.map((c) => `<button class="act-choice mk-coin" data-c="${c}">🪙 ${c}</button>`).join('') + '<button class="go small alt" data-undo>↺</button>';
      await new Promise((resolve) => {
        card.querySelector('#mk-coins').onclick = (e) => {
          if (e.target.closest('[data-undo]')) { paid = 0; card.querySelector('#mk-paid').innerHTML = ''; return; }
          const b = e.target.closest('[data-c]'); if (!b) return;
          paid += +b.dataset.c; ctx.sfx('pop');
          card.querySelector('#mk-paid').insertAdjacentHTML('beforeend', `<span>🪙${b.dataset.c}</span>`);
          if (paid === price) { good++; ctx.sfx('ok'); ctx.confetti(30); ctx.say(`${ctx.praise()} Le compte est bon !`); card.querySelector('#mk-coins').onclick = null; setTimeout(resolve, 1200); }
          else if (paid > price) { ctx.sfx('miss'); ctx.say(`Oh, c'est trop ! Il faut ${price}. On recommence.`); paid = 0; setTimeout(() => { card.querySelector('#mk-paid').innerHTML = ''; }, 600); }
        };
      });
    } else {
      // Rendre la monnaie.
      const price = 2 + Math.floor(Math.random() * 7), given = price < 5 ? 5 : 10, back = given - price;
      card.querySelector('#mk-ask').textContent = `${it.fr} coûte ${price} ${money}. Tu donnes ${given}. Combien le marchand te rend ?`;
      await ctx.say(`${ctx.cap(it.fr)} coûte ${price} ${money}. Tu donnes ${given}. Combien le marchand te rend ?`);
      const opts = shuffled([back, ...shuffled([back - 1, back + 1, back + 2].filter((x) => x >= 0 && x !== back)).slice(0, 2)]);
      if (await choose(ctx, card.querySelector('#mk-box'), opts.map((x) => ({ html: `🪙 ${x}`, correct: x === back })), { onRight: () => ctx.say(`${ctx.praise()} ${given} moins ${price}, ça fait ${back}.`) })) good++;
      await new Promise((r) => setTimeout(r, 900));
    }
    next();
  }
  ctx.say('Bienvenue au souk ! Achète, paie et compte bien.').then(next);
}

// ---------- ⏰ Les heures de prière ----------
export function priere(ctx) {
  const method = ctx.settings.prayerMethod || 'isna';
  const now = new Date();
  const np = nextPrayer(now, { method });
  const body = screen(ctx, '⏰ Les heures de prière', 'Montréal');
  const card = el(`<div class="act-card" style="text-align:center">
    <div class="lantern ${np.current ? 'on' : ''}">🏮</div>
    <p class="act-big">${np.current ? `C'est l'heure de ${np.current.name} !` : `Prochaine prière : ${np.next.name} à ${hhmm(np.at)}`}</p>
    <div class="prayer-list">${PRAYERS.map((p) => `<div class="${p === np.next ? 'next' : ''}"><b>${p.name}</b><span>${hhmm(np.times[p.id])}</span></div>`).join('')}</div>
    <p class="act-note">Lever du soleil : ${hhmm(np.times.sunrise)} · Calcul fait sur la tablette, pour Montréal.</p>
    <label class="field">Méthode de calcul (comme votre mosquée)
      <select id="pr-method">${Object.entries(METHODS).map(([k, m]) => `<option value="${k}" ${k === method ? 'selected' : ''}>${m.name}</option>`).join('')}</select></label>
  </div>`);
  body.append(card);
  card.querySelector('#pr-method').onchange = (e) => { ctx.settings.prayerMethod = e.target.value; ctx.saveSettings(); priere(ctx); };
  ctx.say(np.current ? `C'est l'heure de la prière ${np.current.name}. Allons faire les ablutions !` : `La prochaine prière, c'est ${np.next.name}, à ${hhmm(np.at).replace(':', ' heures ')}.`);
}
export function nextPrayerLabel(settings) {
  const np = nextPrayer(new Date(), { method: settings.prayerMethod || 'isna' });
  return np.current ? `🏮 C'est l'heure de ${np.current.name} !` : `Prochaine : ${np.next.name} à ${hhmm(np.at)}`;
}
