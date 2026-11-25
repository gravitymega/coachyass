// Page publique d'un match (créée par Art craft, module « Stats auto ») : score, highlights
// des joueurs, feuille de match et actions en vidéo. Les fichiers sont dans le bucket public
// Supabase « match-pages », dans le dossier <id>/ ; l'id (UUID aléatoire) vient du lien.
const BASE = 'https://aevoulzotvmnrnclfuek.supabase.co/storage/v1/object/public/match-pages/';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (Number.isFinite(+v) ? +v : 0);

const id = (new URLSearchParams(location.search).get('id') || '').toLowerCase();
const fileUrl = f => BASE + id + '/' + f.split('/').map(encodeURIComponent).join('/');
// Chemin d'un fichier dans le dossier de la page : lettres, chiffres, tirets, points, barres seulement.
const safeFile = f => (typeof f === 'string' && /^[a-z0-9_./-]+\.mp4$/i.test(f) && !f.includes('..') ? f : null);

function fail(msg) {
  $('state').textContent = msg;
  $('state').hidden = false;
  $('page').hidden = true;
}

function fmtDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return '';
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const pct = ([m, a] = [0, 0]) => (num(a) ? `${num(m)}/${num(a)}` : '—');
function boxRow(label, l, cls = '') {
  if (!l) return '';
  return `<tr class="${cls}"><td>${label}</td><td><b>${num(l.pts)}</b></td><td>${num(l.oreb) + num(l.dreb)}</td><td>${num(l.ast)}</td><td>${num(l.stl)}</td><td>${num(l.blk)}</td><td>${pct(l.fg2)}</td><td>${pct(l.fg3)}</td><td>${pct(l.ft)}</td><td>${num(l.tov)}</td><td>${num(l.pf)}</td></tr>`;
}

function renderMomentum(pts) {
  if (!Array.isArray(pts) || pts.length < 3) return;
  const W = 600, H = 160, pad = 10;
  const tMax = Math.max(...pts.map(p => num(p[0])), 1);
  const dMax = Math.max(4, ...pts.map(p => Math.abs(num(p[1]))));
  const x = t => pad + (W - 2 * pad) * num(t) / tMax;
  const y = d => H / 2 - (H / 2 - pad) * num(d) / dMax;
  let path = `M${x(0)},${y(0)}`;
  pts.forEach(([t, d], i) => { if (i) path += `H${x(t).toFixed(1)}V${y(d).toFixed(1)}`; });
  path += `H${W - pad}`;
  $('mom').innerHTML = `<line x1="${pad}" x2="${W - pad}" y1="${H / 2}" y2="${H / 2}" stroke="#2a2536" stroke-width="2"/>
    <path d="${path}" fill="none" stroke="#ff8a4c" stroke-width="3" stroke-linejoin="round"/>
    <text x="${pad + 4}" y="${pad + 12}" fill="#a8a8a8" font-size="12">+${dMax}</text>
    <text x="${pad + 4}" y="${H - pad - 2}" fill="#a8a8a8" font-size="12">−${dMax}</text>`;
  $('mom-sec').hidden = false;
}

function render(d) {
  const players = (Array.isArray(d.players) ? d.players : []).filter(p => p && Number.isFinite(+p.numero));
  const nameOf = new Map(players.map(p => [+p.numero, String(p.nom || `#${p.numero}`)]));
  const us = num(d.score && d.score.nous), them = num(d.score && d.score.adversaire);
  document.title = `${d.team} ${us}–${them} ${d.opponent} | Gravity Basketball`;
  $('team').textContent = d.team || 'Gravity';
  $('opp').textContent = d.opponent || 'Adversaire';
  $('pts-us').textContent = us;
  $('pts-opp').textContent = them;
  $('pts-us').classList.toggle('win', us > them);
  $('pts-opp').classList.toggle('win', them > us);
  $('date').textContent = fmtDate(d.date);

  const reels = players.filter(p => p.reel && safeFile(p.reel.file));
  $('reels').innerHTML = reels.map(p => `<figure class="reel">
      <video src="${esc(fileUrl(safeFile(p.reel.file)))}#t=0.5" controls playsinline preload="metadata"></video>
      <figcaption><b>#${num(p.numero)} ${esc(p.nom)}</b><span class="muted">${esc(p.resume)}</span></figcaption></figure>`).join('');
  $('reels-sec').hidden = !reels.length;
  // Une seule vidéo à la fois.
  document.addEventListener('play', e => document.querySelectorAll('video').forEach(v => { if (v !== e.target) v.pause(); }), true);

  $('box').innerHTML = '<thead><tr><th>Joueur</th><th>Pts</th><th>Reb</th><th>Passes</th><th>Interc.</th><th>Contres</th><th>Tirs 2</th><th>Tirs 3</th><th>LF</th><th>Pertes</th><th>Fautes</th></tr></thead><tbody>' +
    players.map(p => boxRow(`#${num(p.numero)} ${esc(p.nom)}`, p.ligne)).join('') +
    boxRow('Numéro non lu', d.unknown) +
    boxRow(esc(d.team || 'Équipe'), d.total, 'total') +
    boxRow(esc(d.opponent || 'Adversaire'), d.opp, 'total') + '</tbody>';

  renderMomentum(d.momentum);

  const clips = (Array.isArray(d.clips) ? d.clips : []).filter(c => c && safeFile(c.file));
  if (clips.length) {
    const nums = [...new Set(clips.flatMap(c => (Array.isArray(c.numeros) ? c.numeros : []).map(Number)))].filter(n => nameOf.has(n)).sort((a, b) => a - b);
    let filter = null;
    const chips = () => {
      $('chips').innerHTML = `<button class="chip" type="button" data-n="" aria-pressed="${filter == null}">Tout le monde</button>` +
        nums.map(n => `<button class="chip" type="button" data-n="${n}" aria-pressed="${filter === n}">#${n} ${esc(nameOf.get(n))}</button>`).join('');
    };
    const list = () => {
      $('plays').innerHTML = clips.map((c, i) => ({ c, i }))
        .filter(({ c }) => filter == null || (c.numeros || []).map(Number).includes(filter))
        .map(({ c, i }) => `<li><button type="button" data-i="${i}"><span class="clock">${esc(c.clock)}</span><span>${esc(c.label)}</span>
          <span class="who">${(c.numeros || []).map(n => `#${num(n)} ${esc(nameOf.get(+n) || '')}`).join(' · ')}</span></button></li>`).join('');
    };
    $('chips').addEventListener('click', e => {
      const b = e.target.closest('button[data-n]');
      if (!b) return;
      filter = b.dataset.n === '' ? null : +b.dataset.n;
      chips();
      list();
    });
    $('plays').addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      document.querySelectorAll('#plays button').forEach(x => x.removeAttribute('aria-current'));
      b.setAttribute('aria-current', 'true');
      const v = $('viewer-video');
      v.src = fileUrl(safeFile(clips[+b.dataset.i].file));
      $('viewer').hidden = false;
      v.play().catch(() => {});
      $('viewer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    chips();
    list();
    $('plays-sec').hidden = false;
  }

  $('btn-share').hidden = false;
  $('btn-share').addEventListener('click', async () => {
    const data = { title: document.title, url: location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(location.href); $('btn-share').textContent = 'Lien copié ✓'; }
    } catch { /* partage annulé */ }
  });
  $('state').hidden = true;
  $('page').hidden = false;
}

async function load() {
  if (!/^[a-z0-9-]{8,40}$/.test(id)) { fail('Lien de match incomplet : demande au coach de te le renvoyer.'); return; }
  try {
    const res = await fetch(BASE + id + '/data.json', { cache: 'no-cache' });
    if (res.status === 400 || res.status === 404) { fail('Cette page de match n\'existe pas ou a été retirée par le coach.'); return; }
    if (!res.ok) throw new Error(`erreur ${res.status}`);
    const d = await res.json();
    if (!d || d.v !== 1 || !d.score) throw new Error('page illisible');
    render(d);
  } catch (err) {
    console.error(err);
    fail('Impossible de charger le match pour le moment. Réessaie dans un instant.');
  }
}
load();
