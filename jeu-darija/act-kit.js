// Outils partagés par les activités : écran, questions à choix, micro.

export function screen(ctx, title, pill = '') {
  const { $ } = ctx;
  $('#act-title').textContent = title;
  $('#act-pill').textContent = pill;
  $('#act-pill').hidden = !pill;
  const body = $('#act-body');
  body.innerHTML = '';
  body.scrollTop = 0;
  ctx.show('act');
  return body;
}

export const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// Une question à choix : 2 essais, puis la bonne réponse est montrée. Renvoie true si c'est réussi du premier coup.
export function choose(ctx, box, choices, { onRight, onWrong } = {}) {
  box.innerHTML = choices.map((c, i) => `<button class="act-choice" data-i="${i}">${c.html}</button>`).join('');
  let misses = 0;
  return new Promise((resolve) => {
    box.querySelectorAll('.act-choice').forEach((b) => b.addEventListener('click', async () => {
      if (b.disabled) return;
      const c = choices[+b.dataset.i];
      const all = box.querySelectorAll('.act-choice');
      if (c.correct) {
        all.forEach((x) => { x.disabled = true; });
        b.classList.add('won'); ctx.sfx('ok'); ctx.confetti(24);
        await onRight?.(c, misses === 0);
        return resolve(misses === 0);
      }
      misses++; b.disabled = true; b.classList.add('tried'); ctx.sfx('miss');
      if (misses >= 2) {
        all.forEach((x) => { x.disabled = true; });
        all[choices.findIndex((x) => x.correct)].classList.add('reveal');
        await onWrong?.(c);
        return resolve(false);
      }
      await ctx.say('Presque ! Essaie encore.');
    }));
  });
}

// Micro : maintenir le bouton pour enregistrer, relâcher pour arrêter. Renvoie le son enregistré.
export function holdToRecord(button, onBlob) {
  let rec = null, stream = null, chunks = [];
  const start = async (e) => {
    e.preventDefault();
    if (rec) return;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { button.textContent = '🎤 Micro refusé'; return; }
    chunks = [];
    rec = new MediaRecorder(stream);
    rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); rec = null; button.classList.remove('rec'); if (blob.size) onBlob(blob); };
    rec.start(); button.classList.add('rec');
  };
  const stop = (e) => { e.preventDefault(); if (rec && rec.state === 'recording') rec.stop(); };
  button.addEventListener('pointerdown', start);
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointerleave', stop);
  button.addEventListener('pointercancel', stop);
}

export function playBlob(blob) {
  return new Promise((resolve) => {
    if (!blob) return resolve();
    const url = URL.createObjectURL(blob);
    const a = new Audio(url);
    a.onended = a.onerror = () => { URL.revokeObjectURL(url); resolve(); };
    a.play().catch(() => resolve());
  });
}

export const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const shuffled = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// Une question de darija sur un mot du jeu (image ou traduction), avec la voix. Renvoie true si réussi du premier coup.
import { WORDS, makeQuestion, wordsFor, grade } from './core.js';
export async function askWord(ctx, promptEl, box, { kid = ctx.P(), dialects = ctx.settings.dialects } = {}) {
  const older = kid.kid.older;
  const pool = WORDS.filter((w) => !w.phrase && w.emoji && (older || !w.older));
  const seen = pool.filter((w) => kid.progress.words[w.id]?.seen);
  const w0 = pickOne(seen.length > 8 ? seen : pool);
  const d = pickOne(dialects);
  const q = makeQuestion(w0, wordsFor(w0.room, older).filter((x) => !x.phrase && x.emoji), { older, dialect: d, dialects: [d] });
  const w = q.word;
  let label;
  if (q.type === 'listen') { promptEl.textContent = '🔊 Écoute et trouve la bonne image !'; ctx.say('Écoute bien.', { word: w, d }); label = (c) => `<span style="font-size:40px">${c.word.emoji}</span>`; }
  else { promptEl.textContent = `Comment on dit « ${w.fr} » ${ctx.DIALECT_NAME[d]} ${ctx.FLAG[d]} ?`; ctx.say(`Comment on dit ${w.fr}, ${ctx.DIALECT_NAME[d]} ?`); label = (c) => ctx.esc(c.word[d].lat); }
  const ok = await choose(ctx, box, q.choices.map((c) => ({ html: label(c), correct: c.correct })),
    { onRight: () => ctx.say(ctx.praise(), { word: w, d }), onWrong: () => ctx.say("C'était celui-là !", { word: w, d }) });
  grade(kid.progress, w.id, ok); ctx.saveAll();
  return ok;
}
