// Activités pour apprendre : tracer les lettres, petites sourates, miroir des mots, duel en famille.
import { WORDS, makeQuestion, wordsFor } from './core.js';
import { ALIF } from './exercises.js';
import { SOURATES, verseKey } from './act-data.js';
import { screen, el, choose, holdToRecord, playBlob, pickOne, shuffled } from './act-kit.js';

// ---------- ✍️ Tracer les lettres arabes au doigt ----------
export function tracer(ctx) {
  const prog = ctx.P().progress;
  prog.trace = prog.trace || {};
  const letters = ctx.P().kid.older ? ALIF : ALIF.slice(0, 10);
  let i = Math.max(0, letters.findIndex((l) => !prog.trace[l.l]));
  const body = screen(ctx, '✍️ Tracer les lettres', `${Object.keys(prog.trace).length} / ${letters.length}`);
  const card = el(`<div class="act-card trace-card">
    <p class="act-big" id="tr-name"></p>
    <div class="trace-wrap"><canvas id="tr-canvas"></canvas></div>
    <div class="act-row"><button class="go small alt" id="tr-clear">↺ Effacer</button><button class="go small alt" id="tr-hear">🔊 Écouter</button><button class="go small" id="tr-next">Lettre suivante ➜</button></div>
    <div class="act-row trace-list" id="tr-list"></div>
  </div>`);
  body.append(card);
  const cv = card.querySelector('#tr-canvas'), g = cv.getContext('2d');
  const size = Math.min(window.innerWidth - 60, window.innerHeight - 330, 460);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.style.width = cv.style.height = size + 'px';
  cv.width = cv.height = Math.round(size * dpr);
  const W = cv.width, font = (f) => `${Math.round(W * 0.62)}px ${f}`;
  const FONT = '"Noto Naskh Arabic","Geeza Pro","Amiri","Arial",serif';
  let targets = [], halo = null, ink = null, drawing = false, last = null, done = false;
  const mask = (draw) => { const c = document.createElement('canvas'); c.width = c.height = W; const m = c.getContext('2d'); m.textAlign = 'center'; m.textBaseline = 'middle'; m.font = font(FONT); draw(m); return m; };
  function setup() {
    const L = letters[i]; done = false;
    card.querySelector('#tr-name').textContent = `${L.name} · ${L.l}`;
    const letterMask = mask((m) => m.fillText(L.l, W / 2, W * 0.52));
    halo = mask((m) => { m.lineWidth = W * 0.07; m.lineJoin = 'round'; m.strokeText(L.l, W / 2, W * 0.52); m.fillText(L.l, W / 2, W * 0.52); });
    ink = mask(() => {});
    const data = letterMask.getImageData(0, 0, W, W).data, step = Math.round(W / 60);
    targets = [];
    for (let y = 0; y < W; y += step) for (let x = 0; x < W; x += step) if (data[(y * W + x) * 4 + 3] > 128) targets.push([x, y]);
    paint();
    card.querySelector('#tr-list').innerHTML = letters.map((l, k) => `<span class="trace-chip ${prog.trace[l.l] ? 'ok' : ''} ${k === i ? 'cur' : ''}">${l.l}</span>`).join('');
    ctx.say(`Trace la lettre ${L.say}. Commence au point vert.`);
  }
  function paint(win = false) {
    const L = letters[i];
    g.clearRect(0, 0, W, W);
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, W, W);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = font(FONT);
    if (win) { g.globalAlpha = 0.35; g.drawImage(ink.canvas, 0, 0); g.globalAlpha = 1; g.shadowColor = '#ffb000'; g.shadowBlur = W * 0.04; g.fillStyle = '#ffc93c'; g.fillText(L.l, W / 2, W * 0.52); g.shadowBlur = 0; return; }
    g.fillStyle = 'rgba(43,33,64,.08)'; g.fillText(L.l, W / 2, W * 0.52);
    if (!win) { g.setLineDash([W * 0.018, W * 0.018]); g.lineWidth = W * 0.008; g.strokeStyle = 'rgba(43,33,64,.55)'; g.strokeText(L.l, W / 2, W * 0.52); g.setLineDash([]); }
    g.drawImage(ink.canvas, 0, 0);
    if (!win && targets.length) {
      // Point de départ : en haut à droite (l'arabe s'écrit de droite à gauche), avec une flèche vers la gauche.
      const s = targets.reduce((a, b) => (b[1] < a[1] - W * 0.03 || (Math.abs(b[1] - a[1]) <= W * 0.03 && b[0] > a[0]) ? b : a));
      g.fillStyle = '#2bb673'; g.beginPath(); g.arc(s[0], s[1], W * 0.03, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#2bb673'; g.lineWidth = W * 0.012; g.beginPath(); g.moveTo(s[0] + W * 0.12, s[1] - W * 0.06); g.lineTo(s[0] + W * 0.05, s[1] - W * 0.06); g.stroke();
      g.beginPath(); g.moveTo(s[0] + W * 0.07, s[1] - W * 0.085); g.lineTo(s[0] + W * 0.045, s[1] - W * 0.06); g.lineTo(s[0] + W * 0.07, s[1] - W * 0.035); g.stroke();
    }
  }
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (W / r.height)]; };
  cv.addEventListener('pointerdown', (e) => { if (done) return; drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pos(e); const m = ink;
    m.strokeStyle = '#7a48b8'; m.lineWidth = W * 0.06; m.lineCap = m.lineJoin = 'round';
    m.beginPath(); m.moveTo(...last); m.lineTo(...p); m.stroke(); last = p; paint();
  });
  cv.addEventListener('pointerup', () => { if (!drawing) return; drawing = false; check(); });
  function check() {
    const id = ink.getImageData(0, 0, W, W).data, hd = halo.getImageData(0, 0, W, W).data;
    const covered = targets.filter(([x, y]) => id[(y * W + x) * 4 + 3] > 0).length / Math.max(1, targets.length);
    let out = 0, all = 0; const step = Math.round(W / 50);
    for (let y = 0; y < W; y += step) for (let x = 0; x < W; x += step) if (id[(y * W + x) * 4 + 3] > 0) { all++; if (hd[(y * W + x) * 4 + 3] < 50) out++; }
    if (all && out / all > 0.4) { ctx.sfx('miss'); ctx.say('Oups, reste bien sur la lettre ! On recommence.'); ink = mask(() => {}); return paint(); }
    if (covered >= 0.72) {
      done = true; const L = letters[i];
      const first = !prog.trace[L.l]; prog.trace[L.l] = true; if (first) ctx.stars(1); else ctx.saveAll();
      paint(true); ctx.sfx('win'); ctx.confetti(60);
      ctx.say(`${ctx.praise()} Tu as écrit la lettre ${L.say}, comme dans ${L.fr}.`);
      ctx.$('#act-pill').textContent = `${Object.keys(prog.trace).length} / ${letters.length}`;
      card.querySelector('#tr-list').innerHTML = letters.map((l, k) => `<span class="trace-chip ${prog.trace[l.l] ? 'ok' : ''} ${k === i ? 'cur' : ''}">${l.l}</span>`).join('');
    }
  }
  card.querySelector('#tr-clear').onclick = () => { ctx.sfx('tap'); ink = mask(() => {}); done = false; paint(); };
  card.querySelector('#tr-hear').onclick = () => ctx.say(`La lettre ${letters[i].say}.`);
  card.querySelector('#tr-next').onclick = () => { ctx.sfx('tap'); i = (i + 1) % letters.length; setup(); };
  card.querySelector('#tr-list').onclick = (e) => { const c = e.target.closest('.trace-chip'); if (!c) return; i = [...c.parentNode.children].indexOf(c); setup(); };
  setup();
}

// ---------- 📖 Les petites sourates, verset par verset ----------
export function sourates(ctx) {
  const prog = ctx.P().progress;
  prog.sourates = prog.sourates || {};
  const body = screen(ctx, '📖 Les petites sourates');
  body.append(el(`<p class="act-note">Les versets sont récités par Papa ou Maman : enregistrez-les une fois avec le bouton « 🎙 Parents ». La voix du jeu ne récite pas le Coran.</p>`));
  const list = el('<div class="act-grid"></div>');
  list.innerHTML = SOURATES.map((s) => `<button class="act-tile" data-s="${s.id}"><span class="e">${prog.sourates[s.id]?.ordered ? '🌟' : '📖'}</span><b>${s.name}</b><br><small>${s.fr} · ${s.verses.length} lignes</small></button>`).join('');
  body.append(list);
  list.onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) { ctx.sfx('tap'); sourate(ctx, SOURATES.find((s) => s.id === b.dataset.s)); } };
  ctx.say('Choisis une sourate. On l’apprend ligne par ligne.');
}
function sourate(ctx, s) {
  const prog = ctx.P().progress;
  let i = 0;
  const body = screen(ctx, `📖 ${s.name}`, s.fr);
  const card = el(`<div class="act-card">
    <p class="act-note" id="q-num"></p>
    <p class="act-ar" id="q-ar"></p>
    <p class="act-big" id="q-lat" style="font-size:20px"></p>
    <p class="act-note" id="q-fr" style="font-size:16px"></p>
    <div class="act-row">
      <button class="go small alt" id="q-prev">⬅</button>
      <button class="go" id="q-play">🔊 Écouter</button>
      <button class="go alt" id="q-rec">🎤 Maintiens pour répéter</button>
      <button class="go small alt" id="q-next">➜</button>
    </div>
    <div class="act-row"><button class="go small" id="q-me" hidden>👂 Écoute-toi</button><button class="go small alt" id="q-parent">🎙 Parents : enregistrer ce verset</button></div>
    <div class="act-row"><button class="go" id="q-order">🧩 Remettre les versets dans l'ordre</button></div>
  </div>`);
  body.append(card);
  let mine = null;
  const has = async () => !!(await ctx.getRec(verseKey(s.id, i)));
  async function showVerse() {
    const v = s.verses[i];
    card.querySelector('#q-num').textContent = `Ligne ${i + 1} / ${s.verses.length}`;
    card.querySelector('#q-ar').textContent = v.ar;
    card.querySelector('#q-lat').textContent = v.lat;
    card.querySelector('#q-fr').textContent = v.fr;
    card.querySelector('#q-me').hidden = true; mine = null;
    card.querySelector('#q-play').textContent = (await has()) ? '🔊 Écouter' : '🔊 Pas encore enregistré';
  }
  card.querySelector('#q-play').onclick = async () => {
    const b = await ctx.getRec(verseKey(s.id, i));
    if (!b) return ctx.say('Demande à Papa ou à Maman de réciter ce verset, puis de l’enregistrer avec le bouton Parents.');
    ctx.stopVoice(); await playBlob(b);
    const st = prog.sourates[s.id] = prog.sourates[s.id] || { heard: [] };
    if (!st.heard.includes(i)) { st.heard.push(i); ctx.saveAll(); }
  };
  holdToRecord(card.querySelector('#q-rec'), (blob) => { mine = blob; card.querySelector('#q-me').hidden = false; ctx.sfx('chime'); });
  card.querySelector('#q-me').onclick = async () => { const b = await ctx.getRec(verseKey(s.id, i)); if (b) await playBlob(b); await playBlob(mine); };
  let parentMode = false;
  card.querySelector('#q-parent').onclick = () => {
    if (parentMode || !confirm('Parents : enregistrer votre récitation de ce verset ? (Maintenez ensuite le bouton rouge pendant que vous récitez.)')) return;
    parentMode = true;
    const b = card.querySelector('#q-parent'); b.textContent = '🔴 Maintenir pour réciter'; b.classList.add('danger');
    holdToRecord(b, async (blob) => { await ctx.putRec(verseKey(s.id, i), blob); ctx.sfx('win'); b.textContent = '✅ Enregistré ! (maintenir pour refaire)'; showVerse(); });
  };
  card.querySelector('#q-prev').onclick = () => { i = (i - 1 + s.verses.length) % s.verses.length; showVerse(); };
  card.querySelector('#q-next').onclick = () => { i = (i + 1) % s.verses.length; showVerse(); };
  card.querySelector('#q-order').onclick = () => order(ctx, s);
  showVerse();
}
async function order(ctx, s) {
  const prog = ctx.P().progress;
  const body = screen(ctx, `🧩 ${s.name}`, 'Dans l’ordre');
  const card = el(`<div class="act-card"><p class="act-big" id="o-ask"></p><div id="o-done"></div><div class="act-choices" id="o-box"></div></div>`);
  body.append(card);
  let firstTry = true;
  for (let k = 0; k < s.verses.length; k++) {
    card.querySelector('#o-ask').textContent = k ? 'Et ensuite ?' : 'Quelle ligne vient en premier ?';
    const left = s.verses.slice(k);
    const opts = shuffled([left[0], ...shuffled(left.slice(1)).slice(0, ctx.P().kid.older ? 3 : 2)]);
    const ok = await choose(ctx, card.querySelector('#o-box'), opts.map((v) => ({ html: `<span class="act-ar" style="font-size:26px">${v.ar}</span><br><small>${ctx.esc(v.lat)}</small>`, correct: v === left[0] })));
    firstTry = firstTry && ok;
    const b = await ctx.getRec(verseKey(s.id, k)); if (b) await playBlob(b);
    card.querySelector('#o-done').insertAdjacentHTML('beforeend', `<p class="act-ar" style="font-size:24px;margin:0">${s.verses[k].ar}</p>`);
  }
  prog.sourates[s.id] = { ...(prog.sourates[s.id] || {}), ordered: true };
  ctx.stars(firstTry ? 3 : 1); ctx.confetti(90); ctx.sfx('win');
  ctx.say(`Machallah ! Tu connais l’ordre de la sourate ${s.name}.`);
  card.querySelector('#o-box').innerHTML = '<button class="go" data-again>Choisir une autre sourate ➜</button>';
  card.querySelector('[data-again]').onclick = () => sourates(ctx);
}

// ---------- 🎤 Le miroir des mots ----------
export function miroir(ctx) {
  const kid = ctx.P();
  const pool = WORDS.filter((w) => !w.phrase && w.emoji && (kid.kid.older || !w.older) && (kid.progress.words[w.id]?.seen || Math.random() < 0.15));
  const body = screen(ctx, '🎤 Le miroir des mots');
  const card = el(`<div class="act-card" style="text-align:center">
    <div style="font-size:90px" id="m-emoji"></div>
    <p class="act-big" id="m-word"></p>
    <p class="act-note" id="m-help">1. Écoute le modèle · 2. Maintiens le micro et dis le mot · 3. Compare !</p>
    <div class="act-row"><button class="go alt" id="m-model">🔊 Le modèle</button><button class="go" id="m-rec">🎤 Maintiens et parle</button><button class="go alt" id="m-cmp" disabled>👂 Comparer</button></div>
    <div class="act-row"><button class="go small" id="m-good">😀 C'était pareil !</button><button class="go small alt" id="m-next">Un autre mot ➜</button></div>
  </div>`);
  body.append(card);
  let w, d, mine = null, n = 0;
  function next() {
    w = pickOne(pool.length ? pool : WORDS.filter((x) => x.emoji && !x.phrase));
    d = ctx.settings.dialects[n++ % ctx.settings.dialects.length];
    mine = null; card.querySelector('#m-cmp').disabled = true;
    card.querySelector('#m-emoji').textContent = w.emoji;
    card.querySelector('#m-word').textContent = `${ctx.FLAG[d]} ${w[d].lat}`;
    ctx.say(`${w.fr}, ${ctx.DIALECT_NAME[d]}, on dit :`, { word: w, d });
  }
  card.querySelector('#m-model').onclick = () => ctx.playWord(w, d);
  holdToRecord(card.querySelector('#m-rec'), (blob) => { mine = blob; card.querySelector('#m-cmp').disabled = false; ctx.sfx('chime'); compare(); });
  async function compare() { await ctx.playWord(w, d); await new Promise((r) => setTimeout(r, 300)); await playBlob(mine); }
  card.querySelector('#m-cmp').onclick = compare;
  card.querySelector('#m-good').onclick = () => { if (!mine) return ctx.say('Maintiens d’abord le micro et dis le mot !'); ctx.stars(1); ctx.confetti(40); ctx.say(ctx.praise()); setTimeout(next, 1200); };
  card.querySelector('#m-next').onclick = () => { ctx.sfx('tap'); next(); };
  next();
}

// ---------- 👨‍👧 Duel en famille ----------
export function duel(ctx) {
  const body = screen(ctx, '👨‍👧 Duel en famille');
  const kid = ctx.P().kid;
  body.append(el(`<div class="act-card" style="text-align:center"><p class="act-big">Qui joue contre ${ctx.esc(kid.name)} ?</p>
    <div class="act-row"><button class="go" data-who="papa">👨 Papa 🇲🇦</button><button class="go" data-who="maman">👩 Maman 🇩🇿</button></div>
    <p class="act-note">10 questions, chacun son tour. Papa répond en darija du Maroc, Maman en darija d'Algérie !</p></div>`));
  body.onclick = (e) => { const b = e.target.closest('[data-who]'); if (b) { body.onclick = null; ctx.sfx('tap'); play(ctx, b.dataset.who); } };
}
async function play(ctx, who) {
  const kid = ctx.P().kid;
  const adult = { id: who, name: who === 'papa' ? 'Papa' : 'Maman', avatar: who === 'papa' ? '👨' : '👩', d: who === 'papa' ? 'ma' : 'dz' };
  const body = screen(ctx, `${adult.avatar} ${adult.name} contre ${kid.avatar} ${kid.name}`);
  const card = el(`<div class="act-card"><div class="duel-score" id="d-score"></div><p class="act-big" id="d-q"></p><div class="act-choices" id="d-box"></div></div>`);
  body.append(card);
  const score = { kid: 0, adult: 0 };
  const showScore = (turn) => { card.querySelector('#d-score').innerHTML = `<span class="${turn === 'kid' ? 'on' : ''}">${kid.avatar} ${ctx.esc(kid.name)} <b>${score.kid}</b></span><span class="${turn === 'adult' ? 'on' : ''}">${adult.avatar} ${adult.name} <b>${score.adult}</b></span>`; };
  const all = WORDS.filter((w) => !w.phrase && w.emoji);
  for (let k = 0; k < 10; k++) {
    const turn = k % 2 ? 'adult' : 'kid';
    showScore(turn);
    const older = turn === 'adult' || kid.older;
    const ds = turn === 'adult' ? [adult.d] : ctx.settings.dialects;
    const d = pickOne(ds);
    const pool = all.filter((w) => older || !w.older);
    const w0 = pickOne(pool);
    const q = makeQuestion(w0, wordsFor(w0.room, older).filter((x) => !x.phrase && x.emoji), { older, dialect: d, dialects: [d] });
    const w = q.word;
    const name = turn === 'kid' ? kid.name : adult.name;
    let label;
    if (q.type === 'listen') { card.querySelector('#d-q').textContent = `${name} : écoute et trouve l'image !`; await ctx.say(`À toi, ${name} !`, 'Écoute bien.', { word: w, d }); label = (c) => `<span style="font-size:40px">${c.word.emoji}</span>`; }
    else { card.querySelector('#d-q').textContent = `${name} : comment on dit « ${w.fr} » ${ctx.DIALECT_NAME[d]} ${ctx.FLAG[d]} ?`; await ctx.say(`À toi, ${name} !`, `Comment on dit ${w.fr}, ${ctx.DIALECT_NAME[d]} ?`); label = (c) => ctx.esc(c.word[d].lat); }
    const ok = await choose(ctx, card.querySelector('#d-box'), q.choices.map((c) => ({ html: label(c), correct: c.correct })),
      { onRight: async () => { await ctx.say(ctx.praise(), { word: w, d }); }, onWrong: async () => { await ctx.say("C'était celui-là !", { word: w, d }); } });
    if (ok) score[turn]++;
  }
  showScore('');
  const kidWins = score.kid >= score.adult;
  ctx.stars(kidWins ? 3 : 1); ctx.confetti(kidWins ? 100 : 40); ctx.sfx('win');
  const msg = score.kid === score.adult ? 'Égalité ! Bravo à tous les deux !' : kidWins ? `${kid.name} a gagné ! Machallah !` : `${adult.name} a gagné cette fois. Revanche ?`;
  card.querySelector('#d-q').textContent = msg; ctx.say(msg);
  card.querySelector('#d-box').innerHTML = '<button class="go" data-again>Revanche ! ➜</button>';
  card.querySelector('[data-again]').onclick = () => duel(ctx);
}
