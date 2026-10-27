// Activités « pour la famille » : photos de la famille (« Qui c'est ? ») et messages vocaux des grands-parents.
// Les photos et les sons restent sur la tablette (IndexedDB), comme les voix enregistrées.
import { WORDS } from './core.js';
import { screen, el, choose, playBlob, pickOne, shuffled } from './act-kit.js';

const FAMILLE = () => WORDS.filter((w) => w.room === 'stade');
const fam = (id) => WORDS.find((w) => w.id === id);

// Réduit une photo (max 900 px) pour ne pas remplir la tablette.
function shrink(file) {
  return new Promise((resolve) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b || file), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
const parentOk = (what) => confirm(`Espace parents : ${what} ?`);

// ---------- 📸 Qui c'est ? ----------
export async function photos(ctx) {
  const list = ctx.settings.photos = ctx.settings.photos || [];
  const body = screen(ctx, '📸 Qui c’est ?', `${list.length} photo${list.length > 1 ? 's' : ''}`);
  const card = el(`<div class="act-card" style="text-align:center">
    <p class="act-big" id="ph-q"></p><div class="ph-frame"><img id="ph-img" alt=""></div><div class="act-choices" id="ph-box"></div>
    <div class="act-row"><button class="go small alt" id="ph-add">👨‍👩 Parents : ajouter une photo</button><button class="go small alt" id="ph-manage">🗂 Gérer</button></div>
    <input type="file" id="ph-file" accept="image/*" hidden></div>`);
  body.append(card);
  const fileIn = card.querySelector('#ph-file');
  card.querySelector('#ph-add').onclick = () => { if (parentOk('ajouter une photo de la famille')) fileIn.click(); };
  fileIn.onchange = async () => {
    const f = fileIn.files[0]; if (!f) return;
    const who = await pickWho(ctx, card);
    if (!who) return;
    const key = 'photo:' + Date.now();
    await ctx.putRec(key, await shrink(f));
    list.push({ key, who }); ctx.saveSettings(); ctx.sfx('chime');
    photos(ctx);
  };
  card.querySelector('#ph-manage').onclick = () => { if (parentOk('gérer les photos')) manage(ctx); };
  if (!list.length) {
    card.querySelector('#ph-q').textContent = 'Pas encore de photo.';
    card.querySelector('.ph-frame').hidden = true;
    return ctx.say('Demande à Papa ou Maman d’ajouter des photos de la famille : Jeddi, Jedda, tes oncles et tes tantes !');
  }
  const d = pickOne(ctx.settings.dialects);
  let good = 0;
  const round = shuffled(list).slice(0, 6);
  for (const ph of round) {
    const w = fam(ph.who); if (!w) continue;
    const blob = await ctx.getRec(ph.key); if (!blob) continue;
    const img = card.querySelector('#ph-img'); const url = URL.createObjectURL(blob); img.src = url;
    card.querySelector('#ph-q').textContent = `Qui c'est ? ${ctx.FLAG[d]}`;
    ctx.say(`Qui c'est ? Dis-le ${ctx.DIALECT_NAME[d]}.`);
    const others = shuffled(FAMILLE().filter((x) => x.id !== w.id && x[d].lat !== w[d].lat)).slice(0, 2);
    const ok = await choose(ctx, card.querySelector('#ph-box'), shuffled([w, ...others]).map((x) => ({ html: `${x.emoji} ${ctx.esc(x[d].lat)}`, correct: x === w })),
      { onRight: () => ctx.say(ctx.praise(), { word: w, d }), onWrong: () => ctx.say("C'était :", { word: w, d }) });
    if (ok) good++;
    await new Promise((r) => setTimeout(r, 800));
    URL.revokeObjectURL(url);
  }
  ctx.stars(good >= round.length - 1 ? 3 : 1); ctx.confetti(80); ctx.sfx('win');
  card.querySelector('#ph-q').textContent = `Bravo ! ${good} sur ${round.length}. Tu connais bien ta famille !`;
  ctx.say('Bravo ! Tu connais bien ta famille. Machallah !');
  card.querySelector('#ph-box').innerHTML = '<button class="go" data-again>Encore ➜</button>';
  card.querySelector('[data-again]').onclick = () => photos(ctx);
}
function pickWho(ctx, card) {
  return new Promise((resolve) => {
    const d = ctx.settings.dialects[0];
    const box = el(`<div class="act-card"><p class="act-big">Qui est sur la photo ?</p><div class="act-choices">${FAMILLE().map((w) => `<button class="act-choice" data-w="${w.id}" style="font-size:16px">${w.emoji} ${ctx.esc(w.fr)}<br><small>${ctx.esc(w[d].lat)}</small></button>`).join('')}</div><button class="go small alt" data-cancel>Annuler</button></div>`);
    card.after(box);
    box.onclick = (e) => {
      const b = e.target.closest('[data-w]');
      if (b || e.target.closest('[data-cancel]')) { box.remove(); resolve(b ? b.dataset.w : null); }
    };
  });
}
async function manage(ctx) {
  const list = ctx.settings.photos || [];
  const body = screen(ctx, '🗂 Les photos');
  const grid = el('<div class="act-grid"></div>');
  body.append(grid);
  for (const [i, ph] of list.entries()) {
    const b = await ctx.getRec(ph.key);
    const w = fam(ph.who);
    grid.insertAdjacentHTML('beforeend', `<div class="act-tile"><img src="${b ? URL.createObjectURL(b) : ''}" style="width:100%;border-radius:10px"><small>${w ? ctx.esc(w.fr) : ''}</small><br><button class="go small danger" data-del="${i}">Supprimer</button></div>`);
  }
  grid.onclick = async (e) => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    const [ph] = list.splice(+b.dataset.del, 1); await ctx.delRec(ph.key); ctx.saveSettings(); manage(ctx);
  };
  body.append(el('<button class="go" data-back>Retour ➜</button>'));
  body.querySelector('[data-back]').onclick = () => photos(ctx);
}

// ---------- 📞 Les messages des grands-parents ----------
export const unheardMessages = (settings) => (settings.gpMsgs || []).filter((m) => !m.heard);
export async function messages(ctx, { surprise = false } = {}) {
  const list = ctx.settings.gpMsgs = ctx.settings.gpMsgs || [];
  const body = screen(ctx, '📞 Les messages', `${unheardMessages(ctx.settings).length} nouveau(x)`);
  const card = el(`<div class="act-card"><p class="act-big">${surprise ? '🎁 Surprise ! Un message pour toi !' : '📬 La boîte aux lettres'}</p>
    <div class="act-grid" id="ms-list"></div>
    <div class="act-row"><button class="go small alt" id="ms-add">👨‍👩 Parents : ajouter un message vocal</button></div>
    <p class="act-note">Parents : enregistrez dans WhatsApp le message vocal des grands-parents (Partager › Enregistrer dans Fichiers), puis ajoutez-le ici. Il reste sur la tablette.</p>
    <input type="file" id="ms-file" accept="audio/*,video/mp4,.opus,.ogg,.m4a" hidden></div>`);
  body.append(card);
  const render = () => {
    card.querySelector('#ms-list').innerHTML = list.length ? list.map((m, i) => { const w = fam(m.from); return `<button class="act-tile" data-m="${i}"><span class="e">${m.heard ? '📭' : '💌'}</span><b>${w ? w.emoji + ' ' + ctx.esc(w[ctx.settings.dialects[0]].lat) : ctx.esc(m.from)}</b><br><small>${m.date}</small></button>`; }).join('')
      : '<p class="act-note">Pas encore de message.</p>';
  };
  render();
  card.querySelector('#ms-list').onclick = async (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    const m = list[+b.dataset.m]; const blob = await ctx.getRec(m.key);
    ctx.stopVoice(); ctx.sfx('chime'); ctx.confetti(40);
    if (!m.heard) { m.heard = true; ctx.saveSettings(); ctx.stars(1); render(); }
    await playBlob(blob);
  };
  const fileIn = card.querySelector('#ms-file');
  card.querySelector('#ms-add').onclick = () => { if (parentOk('ajouter un message vocal des grands-parents')) fileIn.click(); };
  fileIn.onchange = async () => {
    const f = fileIn.files[0]; if (!f) return;
    const from = await pickWho(ctx, card); if (!from) return;
    const key = 'gp:' + Date.now();
    await ctx.putRec(key, f);
    const dt = new Date();
    list.unshift({ key, from, date: `${dt.getDate()}/${dt.getMonth() + 1}`, heard: false });
    ctx.saveSettings(); ctx.sfx('chime'); render();
  };
  ctx.say(surprise ? 'Surprise ! Quelqu’un t’a envoyé un message. Touche l’enveloppe !' : 'Touche une enveloppe pour écouter le message.');
}
