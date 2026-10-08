// Tableau tactique : clip vidéo -> jeu dessiné sur un demi-terrain.
//
// Tout se passe dans le navigateur (aucun envoi de la vidéo) :
//   1. le coach clique 4 repères du terrain sur une image du clip -> homographie
//      image -> terrain (en mètres) ;
//   2. COCO-SSD (TensorFlow.js) détecte joueurs et ballon sur des images
//      échantillonnées ; le point au sol (bas de la boîte) est projeté sur le
//      terrain ;
//   3. suivi glouton par proximité -> trajectoires, équipes séparées par la
//      couleur du maillot (k-moyennes), porteur du ballon -> dribbles et passes ;
//   4. rendu « tableau de coach » : O numérotés (attaque), X (défense), coupes,
//      dribbles en zigzag, passes en pointillés, écrans ; corrections à la main.
//
// Coordonnées terrain : mètres, origine au centre de la ligne de fond,
// x vers la droite (vu du milieu de terrain face au panier), y vers le milieu
// de terrain. Demi-terrain FIBA : 15 m x 14 m.

(() => {
  'use strict';

  // ---------- Géométrie du terrain ----------
  const COURT_W = 15;
  const COURT_L = 14;
  const BASKET_Y = 1.575;

  function arc(cx, cy, r, from, to, steps = 40) {
    // angle mesuré depuis l'axe +y (vers le milieu de terrain), sens horaire vers +x
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      pts.push([cx + r * Math.sin(a), cy + r * Math.cos(a)]);
    }
    return pts;
  }

  function courtLines() {
    const phi3 = Math.asin(6.6 / 6.75);
    const y3 = BASKET_Y + Math.sqrt(6.75 ** 2 - 6.6 ** 2);
    const three = [[-6.6, 0], [-6.6, y3], ...arc(0, BASKET_Y, 6.75, -phi3, phi3, 60), [6.6, y3], [6.6, 0]];
    return [
      [[-7.5, 0], [7.5, 0], [7.5, COURT_L], [-7.5, COURT_L], [-7.5, 0]],
      [[-2.45, 0], [-2.45, 5.8], [2.45, 5.8], [2.45, 0]],
      arc(0, 5.8, 1.8, 0, Math.PI * 2, 48),
      three,
      arc(0, BASKET_Y, 1.25, -Math.PI / 2, Math.PI / 2, 24),
      arc(0, COURT_L, 1.8, Math.PI / 2, Math.PI * 1.5, 24),
    ];
  }

  const REF_SETS = {
    paint: {
      points: [[-2.45, 0], [2.45, 0], [2.45, 5.8], [-2.45, 5.8]],
      names: [
        'coin de la raquette sur la ligne de fond, à GAUCHE',
        'coin de la raquette sur la ligne de fond, à DROITE',
        'coin de la raquette sur la ligne de lancer franc, à DROITE',
        'coin de la raquette sur la ligne de lancer franc, à GAUCHE',
      ],
    },
    half: {
      points: [[-7.5, 0], [7.5, 0], [7.5, COURT_L], [-7.5, COURT_L]],
      names: [
        'coin du terrain sur la ligne de fond, à GAUCHE',
        'coin du terrain sur la ligne de fond, à DROITE',
        'bout de la ligne médiane, à DROITE',
        'bout de la ligne médiane, à GAUCHE',
      ],
    },
  };

  // ---------- Algèbre ----------
  function solveLinear(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      if (Math.abs(M[piv][c]) < 1e-10) return null;
      [M[c], M[piv]] = [M[piv], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  function homography(src, dst) {
    const A = [];
    const b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i];
      const [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solveLinear(A, b);
    return h ? [...h, 1] : null;
  }

  function applyH(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    if (Math.abs(w) < 1e-9) return null;
    return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w, w];
  }

  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function pathLength(pts) {
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
    return L;
  }

  function simplify(pts, tol) {
    if (pts.length < 3) return pts.slice();
    const segDist = (p, a, b) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy;
      if (!l2) return dist(p, a);
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
      return dist(p, [a[0] + t * dx, a[1] + t * dy]);
    };
    let maxD = 0;
    let idx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = segDist(pts[i], pts[0], pts[pts.length - 1]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
    const left = simplify(pts.slice(0, idx + 1), tol);
    const right = simplify(pts.slice(idx), tol);
    return [...left.slice(0, -1), ...right];
  }

  function distToPolyline(p, pts) {
    let best = Infinity;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
      best = Math.min(best, dist(p, [a[0] + t * dx, a[1] + t * dy]));
    }
    return best;
  }

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const fileInput = $('tt-file');
  const video = $('tt-video');
  const videoBox = $('tt-video-box');
  const videoEmpty = $('tt-video-empty');
  const overlay = $('tt-overlay');
  const octx = overlay.getContext('2d');
  const refSelect = $('tt-ref');
  const calibBtn = $('tt-calib-btn');
  const calibHint = $('tt-calib-hint');
  const startBtn = $('tt-start-btn');
  const endBtn = $('tt-end-btn');
  const rangeEl = $('tt-range');
  const fpsSelect = $('tt-fps');
  const analyzeBtn = $('tt-analyze-btn');
  const cancelBtn = $('tt-cancel-btn');
  const progressBar = $('tt-progress-bar');
  const statusEl = $('tt-status');
  const board = $('tt-board');
  const bctx = board.getContext('2d');
  const titleInput = $('tt-title');
  const toolsEl = $('tt-tools');
  const simplifyInput = $('tt-simplify');
  const defPathsInput = $('tt-def-paths');
  const playBtn = $('tt-play-btn');
  const swapBtn = $('tt-swap-btn');
  const undoBtn = $('tt-undo-btn');
  const clearBtn = $('tt-clear-btn');
  const exportBtn = $('tt-export-btn');
  const selBox = $('tt-selected');
  const selName = $('tt-sel-name');
  const selLabel = $('tt-sel-label');
  const selTeam = $('tt-sel-team');
  const selDelete = $('tt-sel-delete');

  // ---------- État ----------
  const state = {
    videoUrl: null,
    calibrating: false,
    calibPts: [],
    H: null, // image -> terrain
    Hinv: null, // terrain -> image
    trimStart: 0,
    trimEnd: null,
    cancel: false,
    lastDetections: [],
    // Résultat de l'analyse automatique
    analysis: null, // { dt, tracks: [{ id, pts:[[x,y]], start, holder:[bool] }], passes: [...] }
    // Corrections du coach sur les éléments automatiques
    overrides: {}, // trackId -> { team, label, deleted, dx, dy }
    deletedAuto: new Set(), // clés de tracés automatiques gommés
    swapTeams: false,
    // Éléments ajoutés à la main
    manualPlayers: [], // { id, team, label, x, y }
    manualPaths: [], // { id, type, pts }
    history: [],
    tool: 'select',
    selected: null, // id de joueur
    drawing: null,
    dragging: null,
    anim: null,
  };
  let nextManualId = 1;
  let model = null;

  // ---------- Statut ----------
  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.classList.toggle('error', isError);
  }
  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
  }
  function updateRange() {
    if (!video.duration) { rangeEl.textContent = ''; return; }
    const end = state.trimEnd ?? video.duration;
    rangeEl.textContent = `Analyse de ${fmtTime(state.trimStart)} à ${fmtTime(end)} (${(end - state.trimStart).toFixed(1)} s)`;
  }
  function updateButtons() {
    const loaded = !!video.duration;
    calibBtn.disabled = !loaded;
    startBtn.disabled = !loaded;
    endBtn.disabled = !loaded;
    analyzeBtn.disabled = !loaded || !state.H || !!state.running;
    playBtn.disabled = !state.analysis;
    swapBtn.disabled = !state.analysis;
  }

  // ---------- Vidéo ----------
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
    state.videoUrl = URL.createObjectURL(file);
    video.src = state.videoUrl;
    videoBox.hidden = false;
    videoEmpty.hidden = true;
    state.H = null;
    state.Hinv = null;
    state.calibPts = [];
    state.trimStart = 0;
    state.trimEnd = null;
    state.lastDetections = [];
    setStatus('Clip chargé. Étape 2 : place les repères du terrain.');
    if (!titleInput.value) titleInput.value = file.name.replace(/\.[^.]+$/, '');
  });

  video.addEventListener('loadedmetadata', () => {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    updateRange();
    updateButtons();
    drawOverlay();
  });
  video.addEventListener('error', () => setStatus("Impossible de lire ce fichier vidéo dans le navigateur (essaie un .mp4).", true));

  startBtn.addEventListener('click', () => {
    state.trimStart = video.currentTime;
    if (state.trimEnd != null && state.trimEnd <= state.trimStart) state.trimEnd = null;
    updateRange();
  });
  endBtn.addEventListener('click', () => {
    if (video.currentTime <= state.trimStart) { setStatus('La fin doit être après le début.', true); return; }
    state.trimEnd = video.currentTime;
    updateRange();
  });

  // ---------- Calibration ----------
  function refSet() { return REF_SETS[refSelect.value]; }

  function updateCalibHint() {
    if (!state.calibrating) { calibHint.hidden = true; return; }
    const i = state.calibPts.length;
    calibHint.hidden = false;
    calibHint.innerHTML = `Repère ${i + 1}/4 : clique le <strong>${refSet().names[i]}</strong> <span style="opacity:.75">(gauche/droite vus du milieu de terrain, face au panier)</span>.`;
  }

  calibBtn.addEventListener('click', () => {
    video.pause();
    state.calibrating = true;
    state.calibPts = [];
    state.H = null;
    state.Hinv = null;
    videoBox.classList.add('calibrating');
    // Les contrôles natifs capteraient les clics.
    video.controls = false;
    updateCalibHint();
    updateButtons();
    drawOverlay();
    renderBoard();
  });
  refSelect.addEventListener('change', () => {
    if (state.calibrating) { state.calibPts = []; updateCalibHint(); }
    else if (state.calibPts.length === 4) finishCalibration();
    drawOverlay();
    renderBoard();
  });

  overlay.addEventListener('click', (e) => {
    if (!state.calibrating) return;
    const r = overlay.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * video.videoWidth;
    const y = ((e.clientY - r.top) / r.height) * video.videoHeight;
    state.calibPts.push([x, y]);
    if (state.calibPts.length === 4) {
      state.calibrating = false;
      videoBox.classList.remove('calibrating');
      video.controls = true;
      finishCalibration();
    }
    updateCalibHint();
    drawOverlay();
    renderBoard();
  });

  function finishCalibration() {
    const court = refSet().points;
    state.H = homography(state.calibPts, court);
    state.Hinv = homography(court, state.calibPts);
    if (!state.H || !state.Hinv) {
      setStatus('Repères incohérents (3 points alignés ?). Recommence.', true);
      state.H = null;
      state.Hinv = null;
    } else {
      setStatus('Terrain repéré : vérifie que les lignes orange tombent sur les vraies lignes, sinon recommence. Étape 3 : analyser.');
    }
    updateButtons();
  }

  function drawOverlay() {
    if (!overlay.width) return;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    const unit = Math.max(2, overlay.width / 400);
    if (state.Hinv) {
      octx.strokeStyle = 'rgba(232,103,46,0.85)';
      octx.lineWidth = unit;
      for (const line of courtLines()) {
        octx.beginPath();
        let started = false;
        for (const [x, y] of line) {
          const p = applyH(state.Hinv, x, y);
          if (!p || p[2] <= 0) { started = false; continue; }
          if (!started) { octx.moveTo(p[0], p[1]); started = true; } else octx.lineTo(p[0], p[1]);
        }
        octx.stroke();
      }
    }
    state.calibPts.forEach(([x, y], i) => {
      octx.fillStyle = '#e8672e';
      octx.beginPath();
      octx.arc(x, y, unit * 4, 0, Math.PI * 2);
      octx.fill();
      octx.fillStyle = '#fff';
      octx.font = `bold ${unit * 6}px Inter, sans-serif`;
      octx.fillText(String(i + 1), x + unit * 5, y - unit * 5);
    });
    for (const d of state.lastDetections) {
      octx.strokeStyle = d.holder ? '#ffd23f' : 'rgba(255,255,255,0.8)';
      octx.lineWidth = unit;
      octx.strokeRect(d.bbox[0], d.bbox[1], d.bbox[2], d.bbox[3]);
    }
  }

  // ---------- Analyse ----------
  function seekTo(t) {
    return new Promise((resolve) => {
      const done = () => { video.removeEventListener('seeked', done); resolve(); };
      video.addEventListener('seeked', done);
      video.currentTime = Math.abs(video.currentTime - t) < 1e-3 ? t + 1e-3 : t;
    });
  }

  async function loadModel() {
    if (model) return model;
    if (!window.cocoSsd || !window.tf) throw new Error('Le module de détection ne s\'est pas chargé (connexion internet ?).');
    setStatus('Chargement du modèle de détection (une seule fois, ~20 Mo)…');
    await tf.ready();
    try {
      model = await cocoSsd.load({ base: 'mobilenet_v2' });
    } catch {
      model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    }
    return model;
  }

  function torsoColor(data, cw, ch, bbox) {
    const [bx, by, bw, bh] = bbox;
    const x0 = Math.max(0, Math.floor(bx + bw * 0.3));
    const x1 = Math.min(cw - 1, Math.ceil(bx + bw * 0.7));
    const y0 = Math.max(0, Math.floor(by + bh * 0.2));
    const y1 = Math.min(ch - 1, Math.ceil(by + bh * 0.5));
    let r = 0; let g = 0; let b = 0; let n = 0;
    const step = Math.max(1, Math.floor((x1 - x0) / 12));
    for (let y = y0; y <= y1; y += step) {
      for (let x = x0; x <= x1; x += step) {
        const i = (y * cw + x) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
    }
    return n ? [r / n, g / n, b / n] : [128, 128, 128];
  }

  function insideCourt([x, y]) {
    return x > -8.5 && x < 8.5 && y > -1.5 && y < COURT_L + 1;
  }

  analyzeBtn.addEventListener('click', analyze);
  cancelBtn.addEventListener('click', () => { state.cancel = true; });

  async function analyze() {
    if (!state.H) return;
    state.running = true;
    state.cancel = false;
    updateButtons();
    cancelBtn.hidden = false;
    video.pause();
    try {
      await loadModel();
      const fps = Number(fpsSelect.value);
      const dt = 1 / fps;
      const t0 = state.trimStart;
      const t1 = state.trimEnd ?? video.duration;
      const n = Math.max(2, Math.floor((t1 - t0) / dt) + 1);
      const scale = Math.min(1, 960 / video.videoWidth);
      const cap = document.createElement('canvas');
      cap.width = Math.round(video.videoWidth * scale);
      cap.height = Math.round(video.videoHeight * scale);
      const cctx = cap.getContext('2d', { willReadFrequently: true });
      const frames = [];

      for (let f = 0; f < n; f++) {
        if (state.cancel) throw new Error('Analyse annulée.');
        await seekTo(Math.min(t0 + f * dt, video.duration - 0.01));
        cctx.drawImage(video, 0, 0, cap.width, cap.height);
        const preds = await model.detect(cap, 40, 0.35);
        const { data } = cctx.getImageData(0, 0, cap.width, cap.height);
        const people = [];
        let ball = null;
        for (const p of preds) {
          if (p.class === 'person') people.push(p);
          else if (p.class === 'sports ball' && (!ball || p.score > ball.score)) ball = p;
        }
        const dets = [];
        for (const p of people) {
          const [bx, by, bw, bh] = p.bbox;
          const foot = applyH(state.H, (bx + bw / 2) / scale, (by + bh) / scale);
          if (!foot || !insideCourt(foot)) continue;
          dets.push({
            pos: [foot[0], foot[1]],
            color: torsoColor(data, cap.width, cap.height, p.bbox),
            bbox: p.bbox.map((v) => v / scale),
            holder: false,
          });
        }
        if (ball) {
          const cx = (ball.bbox[0] + ball.bbox[2] / 2) / scale;
          const cy = (ball.bbox[1] + ball.bbox[3] / 2) / scale;
          let best = null;
          let bestD = Infinity;
          for (const d of dets) {
            const [bx, by, bw, bh] = d.bbox;
            const dx = Math.max(bx - cx, 0, cx - (bx + bw));
            const dy = Math.max(by - cy, 0, cy - (by + bh));
            const dd = Math.hypot(dx, dy);
            if (dd < bh * 0.35 && dd < bestD) { best = d; bestD = dd; }
          }
          if (best) best.holder = true;
        }
        frames.push(dets);
        state.lastDetections = dets;
        drawOverlay();
        progressBar.style.width = `${((f + 1) / n) * 100}%`;
        setStatus(`Analyse… image ${f + 1}/${n} — ${dets.length} joueur(s) sur le terrain`);
      }

      state.analysis = buildTracks(frames, dt);
      state.overrides = {};
      state.deletedAuto = new Set();
      state.swapTeams = false;
      state.history = [];
      state.selected = null;
      const nb = state.analysis.tracks.length;
      setStatus(nb
        ? `Terminé : ${nb} joueur(s) suivi(s)${state.analysis.passes.length ? `, ${state.analysis.passes.length} passe(s) repérée(s)` : ''}. Corrige le tableau au besoin.`
        : 'Aucun joueur suivi sur le terrain. Vérifie les repères ou essaie un clip plus net.', !nb);
      renderBoard();
    } catch (err) {
      setStatus(err.message || String(err), true);
    } finally {
      state.running = false;
      state.lastDetections = [];
      cancelBtn.hidden = true;
      drawOverlay();
      updateButtons();
    }
  }

  // ---------- Suivi ----------
  function buildTracks(frames, dt) {
    const n = frames.length;
    const maxStep = 7.5 * dt + 0.8; // ~course rapide + bruit de détection
    const maxGap = Math.round(1 / dt); // 1 s sans détection -> trajectoire close
    const tracks = [];
    let nextId = 1;

    frames.forEach((dets, f) => {
      const live = tracks.filter((t) => f - t.last <= maxGap);
      const pairs = [];
      live.forEach((t, ti) => {
        const gap = f - t.last;
        dets.forEach((d, di) => {
          const dd = dist(t.obs[t.last].pos, d.pos);
          if (dd <= maxStep * gap) pairs.push([dd, ti, di]);
        });
      });
      pairs.sort((a, b) => a[0] - b[0]);
      const usedT = new Set();
      const usedD = new Set();
      for (const [, ti, di] of pairs) {
        if (usedT.has(ti) || usedD.has(di)) continue;
        usedT.add(ti); usedD.add(di);
        const t = live[ti];
        t.obs[f] = dets[di];
        t.last = f;
      }
      dets.forEach((d, di) => {
        if (usedD.has(di)) return;
        const obs = new Array(n).fill(null);
        obs[f] = d;
        tracks.push({ id: `t${nextId++}`, obs, first: f, last: f });
      });
    });

    const minLen = Math.max(3, Math.round(n * 0.25));
    let kept = tracks
      .map((t) => ({ ...t, count: t.obs.filter(Boolean).length }))
      .filter((t) => t.count >= minLen)
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    // Interpolation des trous + lissage
    kept = kept.map((t) => {
      const raw = [];
      const holder = [];
      for (let f = t.first; f <= t.last; f++) {
        const o = t.obs[f];
        if (o) { raw.push(o.pos.slice()); holder.push(o.holder); continue; }
        let a = f - 1; while (!t.obs[a]) a--;
        let b = f + 1; while (!t.obs[b]) b++;
        const k = (f - a) / (b - a);
        const pa = t.obs[a].pos;
        const pb = t.obs[b].pos;
        raw.push([pa[0] + (pb[0] - pa[0]) * k, pa[1] + (pb[1] - pa[1]) * k]);
        holder.push(false);
      }
      const w = 2;
      const pts = raw.map((_, i) => {
        let sx = 0; let sy = 0; let c = 0;
        for (let j = Math.max(0, i - w); j <= Math.min(raw.length - 1, i + w); j++) { sx += raw[j][0]; sy += raw[j][1]; c++; }
        return [sx / c, sy / c];
      });
      const cols = t.obs.filter(Boolean).map((o) => o.color);
      const color = [0, 1, 2].map((k) => cols.map((c) => c[k]).sort((x, y) => x - y)[Math.floor(cols.length / 2)]);
      return { id: t.id, start: t.first, pts, holder, color };
    });

    // Porteur du ballon par image (trous courts comblés)
    const holderAt = new Array(n).fill(null);
    for (const t of kept) t.holder.forEach((h, i) => { if (h) holderAt[t.start + i] = t.id; });
    for (let f = 1; f < n - 1; f++) {
      if (holderAt[f]) continue;
      let a = f - 1; let b = f + 1;
      while (b < n && !holderAt[b] && b - a <= 3) b++;
      if (holderAt[a] && b < n && holderAt[a] === holderAt[b] && b - a <= 3) holderAt[f] = holderAt[a];
    }
    for (const t of kept) t.holder = t.pts.map((_, i) => holderAt[t.start + i] === t.id);

    // Équipes : k-moyennes (k = 2) sur la couleur du maillot
    let teams = {};
    if (kept.length >= 2) {
      let c0 = kept[0].color;
      let c1 = kept.reduce((best, t) => (dist3(t.color, c0) > dist3(best, c0) ? t.color : best), kept[1].color);
      for (let it = 0; it < 10; it++) {
        const g0 = []; const g1 = [];
        kept.forEach((t) => (dist3(t.color, c0) <= dist3(t.color, c1) ? g0 : g1).push(t.color));
        if (g0.length) c0 = mean3(g0);
        if (g1.length) c1 = mean3(g1);
      }
      kept.forEach((t) => { teams[t.id] = dist3(t.color, c0) <= dist3(t.color, c1) ? 0 : 1; });
    } else kept.forEach((t) => { teams[t.id] = 0; });
    // L'équipe qui a le plus le ballon = attaque (A)
    const hold = [0, 0];
    kept.forEach((t) => { hold[teams[t.id]] += t.holder.filter(Boolean).length; });
    const attackCluster = hold[1] > hold[0] ? 1 : 0;
    kept.forEach((t) => { t.team = teams[t.id] === attackCluster ? 'A' : 'B'; });

    // Passes : changement de porteur entre deux attaquants
    const passes = [];
    let prev = null;
    let prevF = -1;
    for (let f = 0; f < n; f++) {
      const h = holderAt[f];
      if (!h) continue;
      if (prev && h !== prev && f - prevF <= Math.round(2 / dt)) {
        const a = kept.find((t) => t.id === prev);
        const b = kept.find((t) => t.id === h);
        if (a && b && a.team === 'A' && b.team === 'A') {
          passes.push({ key: `pass-${f}`, from: a.id, to: b.id, fa: prevF, fb: f });
        }
      }
      prev = h;
      prevF = f;
    }

    // Numéros : 1 = premier porteur, puis de gauche à droite ; défenseurs = numéro de l'attaquant le plus proche
    const attack = kept.filter((t) => t.team === 'A');
    const firstHolder = holderAt.find(Boolean);
    attack.sort((a, b) => (a.id === firstHolder ? -1 : b.id === firstHolder ? 1 : a.pts[0][0] - b.pts[0][0]));
    attack.forEach((t, i) => { t.label = String(i + 1); });
    const free = new Set(attack.map((t) => t.label));
    const defense = kept.filter((t) => t.team === 'B');
    let extra = attack.length;
    defense.forEach((d) => {
      let best = null;
      let bd = Infinity;
      for (const a of attack) {
        if (!free.has(a.label)) continue;
        const dd = dist(a.pts[0], d.pts[0]);
        if (dd < bd) { bd = dd; best = a; }
      }
      if (best) { d.label = best.label; free.delete(best.label); } else d.label = String(++extra);
    });

    return { dt, n, tracks: kept, passes };
  }
  function dist3(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
  function mean3(arr) { return [0, 1, 2].map((k) => arr.reduce((s, c) => s + c[k], 0) / arr.length); }

  // ---------- Modèle du tableau ----------
  function trackTeam(t) {
    const o = state.overrides[t.id] || {};
    let team = o.team || t.team;
    if (!o.team && state.swapTeams) team = team === 'A' ? 'B' : 'A';
    return team;
  }

  function trackPts(t) {
    const o = state.overrides[t.id] || {};
    const dx = o.dx || 0;
    const dy = o.dy || 0;
    return t.pts.map(([x, y]) => [x + dx, y + dy]);
  }

  // Liste unifiée joueurs + tracés (auto corrigés + manuels)
  function boardModel() {
    const players = [];
    const paths = [];
    const tol = Number(simplifyInput.value);
    const showDef = defPathsInput.checked;
    const a = state.analysis;
    if (a) {
      for (const t of a.tracks) {
        const o = state.overrides[t.id] || {};
        if (o.deleted) continue;
        const team = trackTeam(t);
        const pts = trackPts(t);
        players.push({ id: t.id, auto: true, team, label: o.label ?? t.label, x: pts[0][0], y: pts[0][1], hasBall: t.holder[0] });
        if (team === 'B' && !showDef) continue;
        // Découpe en segments dribble / sans ballon
        let runStart = 0;
        for (let i = 1; i <= pts.length; i++) {
          if (i < pts.length && t.holder[i] === t.holder[runStart]) continue;
          const seg = pts.slice(Math.max(0, runStart - 1), i);
          const key = `${t.id}-${runStart}`;
          if (pathLength(seg) >= 1 && !state.deletedAuto.has(key)) {
            paths.push({ key, auto: true, type: t.holder[runStart] ? 'dribble' : 'cut', pts: simplify(seg, tol), team, owner: t.id, startsAtPlayer: runStart === 0 });
          }
          runStart = i;
        }
      }
      for (const p of a.passes) {
        if (state.deletedAuto.has(p.key)) continue;
        const ta = a.tracks.find((t) => t.id === p.from);
        const tb = a.tracks.find((t) => t.id === p.to);
        if ((state.overrides[ta.id] || {}).deleted || (state.overrides[tb.id] || {}).deleted) continue;
        const pa = trackPts(ta)[p.fa - ta.start];
        const pb = trackPts(tb)[p.fb - tb.start];
        if (!pa || !pb || dist(pa, pb) < 1) continue;
        paths.push({ key: p.key, auto: true, type: 'pass', pts: [pa, pb], team: 'A' });
      }
    }
    for (const p of state.manualPlayers) players.push({ ...p, auto: false });
    for (const p of state.manualPaths) paths.push({ ...p, key: p.id, auto: false });
    return { players, paths };
  }

  // ---------- Historique ----------
  function snapshot() {
    state.history.push(JSON.stringify({
      overrides: state.overrides,
      deletedAuto: [...state.deletedAuto],
      swapTeams: state.swapTeams,
      manualPlayers: state.manualPlayers,
      manualPaths: state.manualPaths,
    }));
    if (state.history.length > 60) state.history.shift();
  }
  undoBtn.addEventListener('click', () => {
    const s = state.history.pop();
    if (!s) return;
    const o = JSON.parse(s);
    state.overrides = o.overrides;
    state.deletedAuto = new Set(o.deletedAuto);
    state.swapTeams = o.swapTeams;
    state.manualPlayers = o.manualPlayers;
    state.manualPaths = o.manualPaths;
    state.selected = null;
    renderBoard();
  });
  clearBtn.addEventListener('click', () => {
    if (!confirm('Effacer tout le tableau (y compris le résultat de l\'analyse) ?')) return;
    snapshot();
    state.analysis = null;
    state.overrides = {};
    state.deletedAuto = new Set();
    state.manualPlayers = [];
    state.manualPaths = [];
    state.selected = null;
    updateButtons();
    renderBoard();
  });
  swapBtn.addEventListener('click', () => {
    snapshot();
    state.swapTeams = !state.swapTeams;
    renderBoard();
  });
  simplifyInput.addEventListener('input', () => renderBoard());
  defPathsInput.addEventListener('change', () => renderBoard());
  titleInput.addEventListener('input', () => renderBoard());

  // ---------- Rendu du tableau ----------
  const MARGIN = 0.8;
  const TITLE_H = 1.3;
  let S = 40; // pixels (logiques) par mètre
  let DPR = 1;

  function resizeBoard() {
    const cssW = board.clientWidth || 600;
    S = cssW / (COURT_W + MARGIN * 2);
    DPR = Math.min(3, window.devicePixelRatio || 1);
    const cssH = S * (COURT_L + MARGIN * 2 + TITLE_H);
    board.style.height = `${cssH}px`;
    board.width = Math.round(cssW * DPR);
    board.height = Math.round(cssH * DPR);
    renderBoard();
  }
  window.addEventListener('resize', resizeBoard);

  const toPx = (x, y) => [(x + COURT_W / 2 + MARGIN) * S, (y + MARGIN) * S];
  const toCourt = (px, py) => [px / S - COURT_W / 2 - MARGIN, py / S - MARGIN];

  function strokePolyline(ctx, pts) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => {
      const [px, py] = toPx(x, y);
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    });
    ctx.stroke();
  }

  function drawCourt(ctx) {
    ctx.fillStyle = '#fdfdfb';
    ctx.fillRect(0, 0, board.width / DPR, board.height / DPR);
    // raquette légèrement teintée
    ctx.fillStyle = 'rgba(232,103,46,0.10)';
    const [lx, ly] = toPx(-2.45, 0);
    ctx.fillRect(lx, ly, 4.9 * S, 5.8 * S);
    ctx.strokeStyle = '#1d1d1d';
    ctx.lineWidth = Math.max(1.2, S * 0.05);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const line of courtLines()) strokePolyline(ctx, line);
    // panneau + cercle
    ctx.lineWidth = Math.max(2, S * 0.08);
    strokePolyline(ctx, [[-0.9, 1.2], [0.9, 1.2]]);
    ctx.lineWidth = Math.max(1.2, S * 0.05);
    ctx.strokeStyle = '#e8672e';
    const [bx, by] = toPx(0, BASKET_Y);
    ctx.beginPath();
    ctx.arc(bx, by, 0.225 * S, 0, Math.PI * 2);
    ctx.stroke();
    // titre
    const title = titleInput.value.trim();
    if (title) {
      ctx.fillStyle = '#1d1d1d';
      ctx.font = `600 ${S * 0.55}px Oswald, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title.toUpperCase(), (board.width / DPR) / 2, (COURT_L + MARGIN * 2 + TITLE_H / 2 - 0.2) * S);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#9a9a9a';
    ctx.font = `500 ${S * 0.3}px Inter, sans-serif`;
    ctx.fillText('Gravity Basketball', (board.width / DPR) - S * 0.3, (board.height / DPR) - S * 0.25);
    ctx.textAlign = 'left';
  }

  function trimStart(pts, r) {
    // retire le début du tracé caché sous le joueur
    if (pts.length < 2) return pts;
    const out = pts.map((p) => p.slice());
    let rest = r;
    while (out.length >= 2) {
      const d = dist(out[0], out[1]);
      if (d > rest) {
        const k = rest / d;
        out[0] = [out[0][0] + (out[1][0] - out[0][0]) * k, out[0][1] + (out[1][1] - out[0][1]) * k];
        return out;
      }
      rest -= d;
      out.shift();
    }
    return out;
  }

  function trimEnd(pts, r) {
    return trimStart(pts.slice().reverse(), r).reverse();
  }

  function arrowHead(ctx, from, to, color) {
    const [fx, fy] = toPx(from[0], from[1]);
    const [tx, ty] = toPx(to[0], to[1]);
    const a = Math.atan2(ty - fy, tx - fx);
    const L = S * 0.42;
    const W = S * 0.2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx - L * Math.cos(a) + W * Math.sin(a), ty - L * Math.sin(a) - W * Math.cos(a));
    ctx.lineTo(tx - L * Math.cos(a) - W * Math.sin(a), ty - L * Math.sin(a) + W * Math.cos(a));
    ctx.closePath();
    ctx.fill();
  }

  function resample(pts, step) {
    const out = [pts[0]];
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const d = dist(a, b);
      let t = step - carry;
      while (t <= d) {
        out.push([a[0] + ((b[0] - a[0]) * t) / d, a[1] + ((b[1] - a[1]) * t) / d]);
        t += step;
      }
      carry = d - (t - step);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  // Lissage léger d'une polyligne simplifiée (Chaikin) pour des courbes de tableau
  function chaikin(pts, it = 2) {
    let p = pts;
    for (let k = 0; k < it; k++) {
      if (p.length < 3) return p;
      const q = [p[0]];
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i]; const b = p[i + 1];
        q.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
        q.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      q.push(p[p.length - 1]);
      p = q;
    }
    return p;
  }

  function drawPath(ctx, path, highlight) {
    const color = highlight ? '#e8672e' : path.team === 'B' ? '#c0392b' : '#1d1d1d';
    let pts = chaikin(path.pts);
    if (path.startsAtPlayer !== false || path.type === 'pass') pts = trimStart(pts, 0.5);
    if (path.type === 'pass') pts = trimEnd(pts, 0.5);
    if (pts.length < 2 || pathLength(pts) < 0.3) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, S * 0.07);
    ctx.setLineDash([]);
    const endBase = trimEnd(pts, 0.38);
    const tail = pts[pts.length - 1];
    const before = endBase[endBase.length - 1] || pts[pts.length - 2];

    if (path.type === 'dribble') {
      const rs = resample(endBase, 0.22);
      const zz = rs.map((p, i) => {
        if (i === 0 || i === rs.length - 1) return p;
        const a = rs[i - 1]; const b = rs[i + 1];
        const dx = b[0] - a[0]; const dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        const s = (i % 2 ? 1 : -1) * 0.16;
        return [p[0] - (dy / l) * s, p[1] + (dx / l) * s];
      });
      ctx.lineWidth = Math.max(1.2, S * 0.055);
      strokePolyline(ctx, zz);
      arrowHead(ctx, before, tail, color);
    } else if (path.type === 'pass') {
      ctx.setLineDash([S * 0.25, S * 0.18]);
      strokePolyline(ctx, endBase);
      ctx.setLineDash([]);
      arrowHead(ctx, before, tail, color);
    } else if (path.type === 'screen') {
      strokePolyline(ctx, pts);
      const a = pts[pts.length - 2]; const b = tail;
      const dx = b[0] - a[0]; const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      ctx.lineWidth = Math.max(2, S * 0.1);
      strokePolyline(ctx, [[b[0] - (dy / l) * 0.45, b[1] + (dx / l) * 0.45], [b[0] + (dy / l) * 0.45, b[1] - (dx / l) * 0.45]]);
    } else {
      strokePolyline(ctx, endBase);
      arrowHead(ctx, before, tail, color);
    }
  }

  function drawPlayer(ctx, p, selected) {
    const [px, py] = toPx(p.x, p.y);
    const r = 0.42 * S;
    if (selected) {
      ctx.fillStyle = 'rgba(232,103,46,0.25)';
      ctx.beginPath();
      ctx.arc(px, py, r * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.team === 'A') {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#1d1d1d';
      ctx.lineWidth = Math.max(1.5, S * 0.07);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#1d1d1d';
      ctx.font = `700 ${S * 0.46}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label || '', px, py + S * 0.02);
    } else {
      const k = r * 0.75;
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = Math.max(2, S * 0.09);
      ctx.beginPath();
      ctx.moveTo(px - k, py - k); ctx.lineTo(px + k, py + k);
      ctx.moveTo(px + k, py - k); ctx.lineTo(px - k, py + k);
      ctx.stroke();
      if (p.label) {
        ctx.fillStyle = '#c0392b';
        ctx.font = `700 ${S * 0.36}px Inter, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(p.label, px + k * 0.9, py + k * 0.6);
      }
    }
    if (p.hasBall) {
      ctx.fillStyle = '#e8672e';
      ctx.strokeStyle = '#1d1d1d';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px + r * 0.95, py - r * 0.95, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawCalibTarget(ctx) {
    if (!state.calibrating) return;
    const i = state.calibPts.length;
    const pts = refSet().points;
    pts.forEach(([x, y], k) => {
      const [px, py] = toPx(x, y);
      const active = k === i;
      ctx.fillStyle = k < i ? '#2e9e5b' : active ? '#e8672e' : '#bbb';
      ctx.beginPath();
      ctx.arc(px, py, S * (active ? 0.32 : 0.2), 0, Math.PI * 2);
      ctx.fill();
      if (active) {
        ctx.fillStyle = '#1d1d1d';
        ctx.font = `700 ${S * 0.4}px Inter, sans-serif`;
        ctx.fillText(String(k + 1), px + S * 0.35, py - S * 0.3);
      }
    });
  }

  function renderBoard() {
    if (!board.width) return;
    const ctx = bctx;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawCourt(ctx);
    drawCalibTarget(ctx);
    if (state.anim) { drawAnimFrame(ctx); return; }
    const { players, paths } = boardModel();
    for (const p of paths) drawPath(ctx, p, false);
    if (state.drawing) drawPath(ctx, { type: state.drawing.type, pts: state.drawing.pts, team: 'A', startsAtPlayer: false }, true);
    for (const p of players) drawPlayer(ctx, p, p.id === state.selected);
    updateSelectionPanel(players);
  }

  // ---------- Animation ----------
  playBtn.addEventListener('click', () => {
    if (!state.analysis) return;
    if (state.anim) { state.anim = null; playBtn.textContent = '▶ Rejouer l\'action'; renderBoard(); return; }
    state.anim = { t0: performance.now() };
    playBtn.textContent = '■ Arrêter';
    const tick = () => {
      if (!state.anim) return;
      renderBoard();
      const total = (state.analysis.n - 1) * state.analysis.dt;
      if ((performance.now() - state.anim.t0) / 1000 > total + 1) {
        state.anim = null;
        playBtn.textContent = '▶ Rejouer l\'action';
        renderBoard();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  function drawAnimFrame(ctx) {
    const a = state.analysis;
    const tSec = (performance.now() - state.anim.t0) / 1000;
    const fIdx = Math.min(a.n - 1, tSec / a.dt);
    for (const p of state.manualPlayers) drawPlayer(ctx, p, false);
    for (const t of a.tracks) {
      const o = state.overrides[t.id] || {};
      if (o.deleted) continue;
      const local = fIdx - t.start;
      if (local < 0 || local > t.pts.length - 1) continue;
      const pts = trackPts(t);
      const i = Math.floor(local);
      const k = local - i;
      const pa = pts[i];
      const pb = pts[Math.min(pts.length - 1, i + 1)];
      const pos = [pa[0] + (pb[0] - pa[0]) * k, pa[1] + (pb[1] - pa[1]) * k];
      const team = trackTeam(t);
      ctx.strokeStyle = team === 'B' ? 'rgba(192,57,43,0.35)' : 'rgba(29,29,29,0.3)';
      ctx.lineWidth = Math.max(1, S * 0.05);
      ctx.setLineDash([]);
      strokePolyline(ctx, [...pts.slice(0, i + 1), pos]);
      drawPlayer(ctx, { team, label: o.label ?? t.label, x: pos[0], y: pos[1], hasBall: t.holder[Math.round(local)] }, false);
    }
  }

  // ---------- Interaction tableau ----------
  toolsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tool]');
    if (!btn) return;
    state.tool = btn.dataset.tool;
    toolsEl.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('active', b === btn));
  });

  function eventCourt(e) {
    const r = board.getBoundingClientRect();
    return toCourt(e.clientX - r.left, e.clientY - r.top);
  }

  function hitPlayer(p, players) {
    let best = null;
    let bd = 0.7;
    for (const pl of players) {
      const d = dist(p, [pl.x, pl.y]);
      if (d < bd) { bd = d; best = pl; }
    }
    return best;
  }

  function nextLabel(team) {
    const used = new Set(boardModel().players.filter((p) => p.team === team).map((p) => p.label));
    for (let i = 1; i < 30; i++) if (!used.has(String(i))) return String(i);
    return '';
  }

  board.addEventListener('pointerdown', (e) => {
    if (state.anim) return;
    const p = eventCourt(e);
    const { players, paths } = boardModel();
    const tool = state.tool;

    if (tool === 'select') {
      const hit = hitPlayer(p, players);
      state.selected = hit ? hit.id : null;
      if (hit) {
        snapshot();
        state.dragging = { id: hit.id, auto: hit.auto, last: p, moved: false };
        board.setPointerCapture(e.pointerId);
      }
      renderBoard();
      return;
    }
    if (tool === 'addA' || tool === 'addB') {
      snapshot();
      const team = tool === 'addA' ? 'A' : 'B';
      const id = `m${nextManualId++}`;
      state.manualPlayers.push({ id, team, label: nextLabel(team), x: p[0], y: p[1] });
      state.selected = id;
      renderBoard();
      return;
    }
    if (tool === 'erase') {
      const hit = hitPlayer(p, players);
      if (hit) { removePlayer(hit); renderBoard(); return; }
      let best = null;
      let bd = 0.45;
      for (const path of paths) {
        const d = distToPolyline(p, path.pts);
        if (d < bd) { bd = d; best = path; }
      }
      if (best) {
        snapshot();
        if (best.auto) state.deletedAuto.add(best.key);
        else state.manualPaths = state.manualPaths.filter((m) => m.id !== best.key);
        renderBoard();
      }
      return;
    }
    // Outils de tracé : on part du centre du joueur s'il y en a un sous le doigt
    const hit = hitPlayer(p, players);
    const start = hit ? [hit.x, hit.y] : p;
    state.drawing = { type: tool, pts: [start], fromPlayer: !!hit };
    board.setPointerCapture(e.pointerId);
    renderBoard();
  });

  board.addEventListener('pointermove', (e) => {
    const p = eventCourt(e);
    if (state.dragging) {
      const d = state.dragging;
      const dx = p[0] - d.last[0];
      const dy = p[1] - d.last[1];
      d.last = p;
      if (Math.abs(dx) + Math.abs(dy) > 0) d.moved = true;
      if (d.auto) {
        const o = (state.overrides[d.id] = state.overrides[d.id] || {});
        o.dx = (o.dx || 0) + dx;
        o.dy = (o.dy || 0) + dy;
      } else {
        const m = state.manualPlayers.find((x) => x.id === d.id);
        if (m) { m.x += dx; m.y += dy; }
        // les tracés manuels qui partaient de ce joueur suivent
        for (const path of state.manualPaths) {
          if (path.fromPlayer === d.id) { path.pts[0] = [path.pts[0][0] + dx, path.pts[0][1] + dy]; }
        }
      }
      renderBoard();
      return;
    }
    if (state.drawing) {
      const d = state.drawing;
      if (d.type === 'pass') d.pts = [d.pts[0], p];
      else if (dist(d.pts[d.pts.length - 1], p) > 0.12) d.pts.push(p);
      renderBoard();
    }
  });

  function endPointer() {
    if (state.dragging) {
      if (!state.dragging.moved) state.history.pop();
      state.dragging = null;
      renderBoard();
      return;
    }
    const d = state.drawing;
    if (!d) return;
    state.drawing = null;
    if (pathLength(d.pts) >= 0.5) {
      snapshot();
      const pts = d.type === 'pass' ? d.pts : simplify(d.pts, 0.25);
      const hitStart = d.fromPlayer ? hitPlayer(d.pts[0], boardModel().players) : null;
      state.manualPaths.push({ id: `mp${nextManualId++}`, type: d.type, pts, team: 'A', startsAtPlayer: d.fromPlayer, fromPlayer: hitStart && !hitStart.auto ? hitStart.id : null });
    }
    renderBoard();
  }
  board.addEventListener('pointerup', endPointer);
  board.addEventListener('pointercancel', endPointer);

  function removePlayer(pl) {
    snapshot();
    if (pl.auto) {
      state.overrides[pl.id] = { ...(state.overrides[pl.id] || {}), deleted: true };
    } else {
      state.manualPlayers = state.manualPlayers.filter((m) => m.id !== pl.id);
    }
    if (state.selected === pl.id) state.selected = null;
  }

  function selectedPlayer(players) {
    return players.find((p) => p.id === state.selected) || null;
  }

  function updateSelectionPanel(players) {
    const p = selectedPlayer(players);
    selBox.hidden = !p;
    if (!p) return;
    selName.textContent = p.team === 'A' ? 'Attaquant' : 'Défenseur';
    if (document.activeElement !== selLabel) selLabel.value = p.label || '';
  }

  selLabel.addEventListener('focus', () => snapshot());
  selLabel.addEventListener('input', () => {
    const id = state.selected;
    if (!id) return;
    const m = state.manualPlayers.find((x) => x.id === id);
    if (m) m.label = selLabel.value;
    else state.overrides[id] = { ...(state.overrides[id] || {}), label: selLabel.value };
    renderBoard();
  });
  selTeam.addEventListener('click', () => {
    const id = state.selected;
    const p = selectedPlayer(boardModel().players);
    if (!p) return;
    snapshot();
    const team = p.team === 'A' ? 'B' : 'A';
    const m = state.manualPlayers.find((x) => x.id === id);
    if (m) m.team = team;
    else state.overrides[id] = { ...(state.overrides[id] || {}), team };
    renderBoard();
  });
  selDelete.addEventListener('click', () => {
    const p = selectedPlayer(boardModel().players);
    if (!p) return;
    removePlayer(p);
    renderBoard();
  });

  // ---------- Export ----------
  exportBtn.addEventListener('click', () => {
    const wasSel = state.selected;
    state.selected = null;
    renderBoard();
    board.toBlob((blob) => {
      state.selected = wasSel;
      renderBoard();
      if (!blob) return;
      const name = (titleInput.value.trim() || 'jeu').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'jeu';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `tableau-${name}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  });

  // ---------- Démarrage ----------
  updateButtons();
  if (document.fonts?.ready) document.fonts.ready.then(resizeBoard);
  resizeBoard();
})();
