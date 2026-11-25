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
