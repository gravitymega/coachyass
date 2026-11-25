// Habillage du site (refonte novembre 2026) : menu mobile, photo ou vidéo de la grande
// bannière, galerie photos avec agrandissement, apparition douce des sections.
// Photos : Dashboard → Galerie photos (site « Gravity Basketball MTL »).
// Vidéo de la bannière : Dashboard → Galerie vidéo, une vidéo téléversée (pas un lien Instagram).
(function () {
  'use strict';
  var SB = 'https://aevoulzotvmnrnclfuek.supabase.co/rest/v1/';
  var KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';
  var SITE = 'gravity-basketball-mtl';
  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;

  // ---------- Menu mobile ----------
  var toggle = $('nav-toggle');
  var nav = $('site-nav');
  if (toggle && nav) {
    var setOpen = function (open) {
      document.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    };
    toggle.addEventListener('click', function () { setOpen(!document.body.classList.contains('nav-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  var year = $('footer-year');
  if (year) year.textContent = new Date().getFullYear();

  // ---------- En-tête qui se densifie au défilement ----------
  var header = document.querySelector('.site-header');
  var onScroll = function () { if (header) header.classList.toggle('is-scrolled', window.scrollY > 24); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Apparition douce des sections ----------
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.section .container, .section .container-wide, .facts-grid').forEach(function (el) {
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  // ---------- Données Supabase (lecture publique) ----------
  function get(path) {
    return fetch(SB + path, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .catch(function () { return []; });
  }
  var safeUrl = function (u) { return typeof u === 'string' && /^https:\/\//i.test(u) ? u : null; };

  var heroMedia = $('hero-media');
  var heroSet = false;

  function heroPhoto(url) {
    if (!heroMedia || heroSet) return;
    var img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.className = 'hero-img';
    img.onload = function () {
      if (heroSet) return;
      heroSet = true;
      heroMedia.appendChild(img);
      requestAnimationFrame(function () { heroMedia.classList.add('has-media'); });
    };
    img.src = url;
  }

  function heroVideo(url, poster) {
    if (!heroMedia || reduceMotion || saveData) return false;
    var v = document.createElement('video');
    v.className = 'hero-img';
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('muted', '');
    v.preload = 'metadata';
    if (poster) v.poster = poster;
    v.src = url;
    // La vidéo doit être dans la page pour démarrer : elle reste invisible tant qu'elle ne joue pas.
    heroMedia.appendChild(v);
    v.addEventListener('playing', function () {
      if (heroSet) return;
      heroSet = true;
      requestAnimationFrame(function () { heroMedia.classList.add('has-media'); });
    }, { once: true });
    var fallback = function () { v.remove(); if (poster) heroPhoto(poster); };
    v.addEventListener('error', fallback, { once: true });
    var p = v.play();
    if (p && p.catch) p.catch(fallback);
    return true;
  }

  // ---------- Galerie photos + agrandissement ----------
  var photos = [];
  var current = 0;
  function openLightbox(i) {
    current = (i + photos.length) % photos.length;
    var ph = photos[current];
    $('lightbox-img').src = ph.url;
    $('lightbox-img').alt = ph.caption || 'Photo Gravity Basketball';
    $('lightbox-cap').textContent = ph.caption || '';
    $('lightbox').hidden = false;
    document.body.classList.add('lightbox-open');
    $('lightbox-close').focus();
  }
  function closeLightbox() {
    $('lightbox').hidden = true;
    document.body.classList.remove('lightbox-open');
  }
  if ($('lightbox')) {
    $('lightbox-close').addEventListener('click', closeLightbox);
    $('lightbox-prev').addEventListener('click', function () { openLightbox(current - 1); });
    $('lightbox-next').addEventListener('click', function () { openLightbox(current + 1); });
    $('lightbox').addEventListener('click', function (e) { if (e.target === $('lightbox')) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if ($('lightbox').hidden) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') openLightbox(current - 1);
      if (e.key === 'ArrowRight') openLightbox(current + 1);
    });
  }

  function renderGallery(rows) {
    var grid = $('gallery-grid');
    if (!grid || !rows.length) return;
    photos = rows;
    grid.innerHTML = '';
    // Une grande photo puis des rangées complètes de 4 petites : 1, 5, 9 ou 13 photos.
    var shown = rows.length < 5 ? rows.length : Math.min(13, 1 + 4 * Math.floor((rows.length - 1) / 4));
    rows.slice(0, shown).forEach(function (ph, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'gallery-item';
      b.setAttribute('aria-label', ph.caption ? 'Agrandir : ' + ph.caption : 'Agrandir la photo');
      var img = document.createElement('img');
      img.src = ph.url;
      img.alt = ph.caption || 'Photo Gravity Basketball';
      img.loading = 'lazy';
      img.decoding = 'async';
      b.appendChild(img);
      if (ph.caption) {
        var cap = document.createElement('span');
        cap.className = 'gallery-cap';
        cap.textContent = ph.caption;
        b.appendChild(cap);
      }
      b.addEventListener('click', function () { openLightbox(i); });
      grid.appendChild(b);
    });
    $('galerie').hidden = false;
  }

  function aboutPhoto(ph) {
    var fig = $('about-photo');
    if (!fig || !ph) return;
    var img = fig.querySelector('img');
    img.className = '';
    img.src = ph.url;
    img.alt = ph.caption || 'Gravity Basketball';
    img.removeAttribute('width');
    img.removeAttribute('height');
    fig.classList.add('has-photo');
    if (ph.caption) fig.querySelector('figcaption').textContent = ph.caption;
  }

  if (heroMedia || $('gallery-grid')) {
    Promise.all([
      get('photo_gallery?select=image_url,caption,position&site=eq.' + SITE + '&active=eq.true&order=position.asc&limit=24'),
      heroMedia ? get('instagram_carousel?select=video_url,position&site=eq.' + SITE + '&active=eq.true&video_url=not.is.null&order=position.asc&limit=1') : Promise.resolve([]),
    ]).then(function (res) {
      var rows = (res[0] || []).map(function (r) { return { url: safeUrl(r.image_url), caption: r.caption || '' }; })
        .filter(function (r) { return r.url; });
      var vid = (res[1] || []).map(function (r) { return safeUrl(r.video_url); }).filter(Boolean)[0];
      if (!(vid && heroVideo(vid, rows[0] && rows[0].url)) && rows[0]) heroPhoto(rows[0].url);
      aboutPhoto(rows[1] || rows[0]);
      renderGallery(rows);
    });
  }
})();

// ---------- Chaîne YouTube (section Vidéos) ----------
// La fonction Netlify « youtube » lit le flux public de la chaîne (sans clé).
// La vidéo ne se charge qu'au clic (youtube-nocookie) : page rapide, pas de pisteur avant.
(function () {
  'use strict';
  var block = document.getElementById('yt-block');
  if (!block) return;
  var FEED = 'https://gravity-admin-dashboard.netlify.app/.netlify/functions/youtube';
  var esc = function (s) { return String(s || '').replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var player = document.getElementById('yt-player');
  var grid = document.getElementById('yt-grid');

  function play(v, autoplay) {
    player.innerHTML = '<div class="yt-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + v.id + '?rel=0&modestbranding=1' + (autoplay ? '&autoplay=1' : '') +
      '" title="' + esc(v.title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>' +
      '<p class="yt-now">' + esc(v.title) + '</p>';
    grid.querySelectorAll('.yt-card').forEach(function (c) { c.classList.toggle('is-current', c.dataset.id === v.id); });
  }

  function poster(v) {
    // Avant le clic : une image (légère) avec un bouton lecture, pas d'iframe.
    player.innerHTML = '<button type="button" class="yt-frame yt-poster" aria-label="Lire : ' + esc(v.title) + '">' +
      '<img src="https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg" alt="" loading="lazy"><span class="yt-play" aria-hidden="true"></span></button>' +
      '<p class="yt-now">' + esc(v.title) + '</p>';
    player.querySelector('button').addEventListener('click', function () { play(v, true); });
  }

  fetch(FEED).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    var videos = d && Array.isArray(d.videos) ? d.videos.filter(function (v) { return /^[\w-]{11}$/.test(v.id); }) : [];
    if (!videos.length) return;
    if (d.channel && /^UC[\w-]{22}$/.test(d.channel.id)) {
      document.getElementById('yt-subscribe').href = 'https://www.youtube.com/channel/' + d.channel.id + '?sub_confirmation=1';
      if (d.channel.title) document.getElementById('yt-channel-name').textContent = d.channel.title;
    }
    poster(videos[0]);
    grid.innerHTML = videos.slice(0, 8).map(function (v) {
      return '<button type="button" class="yt-card" data-id="' + v.id + '"><img src="https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg" alt="" loading="lazy">' +
        '<span>' + esc(v.title) + '</span></button>';
    }).join('');
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('.yt-card');
      if (!b) return;
      var v = videos.find(function (x) { return x.id === b.dataset.id; });
      if (v) { play(v, true); player.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
    block.hidden = false;
    // Avec des vidéos YouTube, la carte « Bientôt disponible » d'Instagram n'a plus de sens.
    var igEmpty = document.getElementById('ig-carousel-empty');
    if (igEmpty) igEmpty.hidden = true;
  }).catch(function () { /* chaîne indisponible : la section garde Instagram */ });
})();
