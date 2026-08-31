// Gravity Basketball — script.js

// Backend partagé Supabase (coachyass / basketlibre / gravity-basketball).
// La clé "anon" ci-dessous est PUBLIQUE PAR CONCEPTION (protégée par Row Level
// Security côté serveur) — normal et sûr de l'exposer côté client.
const SUPABASE_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';

// Liens de paiement Zeffy par programme (comme pour le Championnat et Basket Libre).
// Note : "Ligue 3v3" (13-14 ans) et le Championnat partagent le même événement
// Zeffy — confirmé par Yassine que le tarif est bien le même pour les deux
// programmes (260 $ individuel / 936 $ équipe complète).
const ZEFFY_LINKS = {
  'Ligue 3v3': 'https://www.zeffy.com/en-CA/ticketing/gravity-basketball-league-3v3-inscription',
  'Ligue Maison': 'https://www.zeffy.com/en-CA/ticketing/gravity-ligue-maison-inscription',
};

// Formulaire Zeffy unique pour "Mes équipes" — un seul événement avec choix de
// catégorie/équipe dans le formulaire lui-même. Vide tant que le lien n'est pas
// fourni : chaque équipe affiche alors "Inscription bientôt disponible" au lieu
// d'un bouton mort. Une équipe peut aussi avoir son propre lien (teams.zeffy_url,
// rempli depuis le dashboard admin) qui prend le dessus sur ce lien global.
const ZEFFY_URL = '';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('inscription-form');
  const success = document.getElementById('form-success');
  const submitBtn = document.getElementById('submit-btn');
  const typeRadios = form.querySelectorAll('input[name="type_inscription"]');
  const fieldEquipe = document.getElementById('field-equipe');
  const toggles = form.querySelectorAll('.type-toggle');

  // Show/hide "nom de l'équipe" + highlight selected toggle (fallback for browsers without :has())
  function syncTypeUI() {
    const selected = form.querySelector('input[name="type_inscription"]:checked').value;
    fieldEquipe.style.display = selected === 'Équipe' ? 'grid' : 'none';
    toggles.forEach(t => {
      const input = t.querySelector('input');
      t.classList.toggle('is-checked', input.checked);
    });
  }
  typeRadios.forEach(r => r.addEventListener('change', syncTypeUI));

  // ---------- Sélecteur de programme (Ligue 3v3 / Ligue Maison) ----------
  // Chaque carte-programme a son propre bouton "Réserver ma place" — ce bloc
  // fait en sorte que le formulaire (unique, partagé) reflète bien le bon
  // programme selon le bouton cliqué, plutôt que de tout renvoyer comme une
  // inscription à la Ligue 3v3 par défaut.
  const programmeRadios = form.querySelectorAll('input[name="programme"]');
  const fieldTypeInscription = document.getElementById('field-type-inscription');
  const ageCategorieSelect = document.getElementById('age_categorie');
  const inscriptionTitle = document.getElementById('inscription-title');
  const programmeToggles = document.querySelectorAll('#field-programme .type-toggle');

  function syncProgrammeUI() {
    const selected = form.querySelector('input[name="programme"]:checked').value;
    const isLigueMaison = selected === 'Ligue Maison';

    // La Ligue Maison n'a pas de formule "équipe" — c'est un programme individuel.
    fieldTypeInscription.style.display = isLigueMaison ? 'none' : 'flex';
    if (isLigueMaison) {
      fieldEquipe.style.display = 'none';
    } else {
      syncTypeUI();
    }

    ageCategorieSelect.value = isLigueMaison ? '9-10 ans' : '13-14 ans';
    inscriptionTitle.textContent = isLigueMaison
      ? 'Réserve ta place — Ligue Maison'
      : 'Réserve ta place — Gravity Basketball Ligue 3v3';

    programmeToggles.forEach(t => {
      const input = t.querySelector('input');
      t.classList.toggle('is-checked', input.checked);
    });
  }
  programmeRadios.forEach(r => r.addEventListener('change', syncProgrammeUI));

  // Boutons "Réserver ma place" des cartes-programmes : pré-sélectionnent le
  // bon programme avant que l'ancre #inscription ne fasse défiler la page.
  document.querySelectorAll('a[data-programme]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.programme;
      const radio = form.querySelector(`input[name="programme"][value="${value}"]`);
      if (radio) {
        radio.checked = true;
        syncProgrammeUI();
      }
    });
  });

  syncProgrammeUI();

  // Envoi vers Supabase (table partagée "bookings", site = gravity-basketball).
  // Prefer: return=minimal est INDISPENSABLE — sans cet en-tête, Supabase tente
  // de renvoyer la ligne créée, ce qui déclenche une vérification de policy
  // SELECT que le public (anon) n'a pas, et l'insertion échoue.
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi...';

    const data = new FormData(form);
    const get = (name) => (data.get(name) || '').toString().trim();

    const programme = get('programme') || 'Ligue 3v3';
    const payload = {
      site: 'gravity-basketball',
      type: programme === 'Ligue Maison' ? 'inscription_ligue_maison' : 'inscription_ligue_3v3',
      contact_name: get('nom_complet'),
      contact_email: get('email'),
      contact_phone: get('telephone'),
      details: {
        programme,
        type_inscription: programme === 'Ligue Maison' ? 'Individuel' : get('type_inscription'),
        nom_equipe: programme === 'Ligue Maison' ? '' : get('nom_equipe'),
        age_categorie: get('age_categorie'),
        remarque: get('remarque'),
        reference: get('reference'),
        consentement_medias: data.get('consentement_medias') === 'Oui',
      },
    };

    fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    })
      .then((res) => {
        if (!res.ok) throw new Error('supabase insert failed: ' + res.status);
        form.hidden = true;
        success.hidden = false;
        const zeffyCta = document.getElementById('zeffy-payment-cta');
        const zeffyLink = document.getElementById('zeffy-payment-link');
        const paymentPendingCta = document.getElementById('payment-pending-cta');
        const link = ZEFFY_LINKS[programme];
        if (link) {
          if (zeffyLink) zeffyLink.href = link;
          if (zeffyCta) zeffyCta.hidden = false;
          if (paymentPendingCta) paymentPendingCta.hidden = true;
        } else {
          // Pas de lien Zeffy dédié pour ce programme (ex. Ligue 3v3) — on ne
          // redirige jamais vers le mauvais événement de paiement.
          if (zeffyCta) zeffyCta.hidden = true;
          if (paymentPendingCta) paymentPendingCta.hidden = false;
        }
        success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      })
      .catch(() => {
        alert("Oups, l'envoi a échoué. Écris-nous directement sur Instagram @GravityBasketballMTL ou au 438-341-2051.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Envoyer ma demande d'inscription";
      });
  });

  // Partage "Amène un ami"
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      const shareData = {
        title: 'Gravity Basketball Ligue 3v3',
        text: "Ligue de basketball 3v3 pour jeunes à Montréal (secteur Dorval-Lachine) — compétitif, arbitré, règles FIBA. Viens jouer !",
        url: window.location.href,
      };
      if (navigator.share) {
        navigator.share(shareData).catch(() => {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(shareData.url).then(() => {
          const original = shareBtn.textContent;
          shareBtn.textContent = 'Lien copié !';
          setTimeout(() => { shareBtn.textContent = original; }, 2000);
        });
      }
    });
  }

  // ---------- Bandeau produit vedette (toujours visible, alimenté par le dashboard admin) ----------
  const banner = document.getElementById('product-banner');
  const BANNER_DISMISS_KEY = 'gravity_product_banner_dismissed_id';

  if (banner) {
    fetch(`${SUPABASE_URL}/rest/v1/featured_product?select=*&active=eq.true&order=updated_at.desc&limit=1&or=(site.eq.gravity-basketball,site.is.null)`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        const product = rows && rows[0];
        if (!product) return;
        if (localStorage.getItem(BANNER_DISMISS_KEY) === product.id) return;

        document.getElementById('product-banner-title').textContent = product.title || '';
        document.getElementById('product-banner-price').textContent = product.price || '';
        const bannerLink = document.getElementById('product-banner-link');
        bannerLink.href = product.affiliate_link;
        const img = document.getElementById('product-banner-img');
        if (product.image_url) { img.src = product.image_url; } else { img.style.display = 'none'; }
        banner.hidden = false;

        // Compteur de clics minimal (aucune IP/donnée personnelle) — écriture
        // seule, non bloquante, n'empêche jamais l'ouverture du lien Amazon.
        bannerLink.addEventListener('click', () => {
          try {
            fetch(`${SUPABASE_URL}/rest/v1/product_clicks`, {
              method: 'POST',
              keepalive: true,
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({
                site: 'gravity-basketball',
                product_id: product.id,
                affiliate_link: product.affiliate_link,
              }),
            }).catch(() => {});
          } catch {}
        });

        document.getElementById('product-banner-close').addEventListener('click', () => {
          banner.hidden = true;
          localStorage.setItem(BANNER_DISMISS_KEY, product.id);
        });
      })
      .catch(() => {});
  }

  // ---------- Programmes (Ligue 3v3 / Ligue Maison) — contenu synchronisé avec
  // la table Supabase "programs" (éditable depuis le dashboard admin, onglet
  // "Programmes"). Le HTML déjà présent dans la page reste la version de
  // secours : si le fetch échoue, est vide, ou que le programme est désactivé,
  // rien ne change à l'écran. ----------
  const PROGRAM_DOM = {
    'ligue-3v3': { name: 'programme-name-ligue-3v3', list: 'programme-list-ligue-3v3' },
    'ligue-maison': { name: 'programme-name-ligue-maison', desc: 'programme-desc-ligue-maison', list: 'programme-list-ligue-maison' },
  };

  fetch(`${SUPABASE_URL}/rest/v1/programs?select=*&site=eq.gravity-basketball&active=eq.true&slug=in.(ligue-3v3,ligue-maison)`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  })
    .then((res) => (res.ok ? res.json() : []))
    .then((rows) => {
      (rows || []).forEach((program) => {
        const dom = PROGRAM_DOM[program.slug];
        if (!dom) return;

        const nameEl = document.getElementById(dom.name);
        if (nameEl && program.name) nameEl.textContent = program.name;

        if (dom.desc) {
          const descEl = document.getElementById(dom.desc);
          if (descEl && program.description) descEl.textContent = program.description;
        }

        const listEl = document.getElementById(dom.list);
        if (listEl && Array.isArray(program.details) && program.details.length) {
          // On ajoute le(s) tarif(s) à la suite des détails uniquement s'il n'y a
          // qu'une seule ligne de prix (même comportement que la page actuelle,
          // ex. Ligue Maison "Coût : 180 $"). S'il y a plusieurs paliers de prix
          // (ex. individuel / équipe), on n'essaie pas de les caser dans cette
          // liste simple — ils resteront visibles ailleurs (Zeffy, dashboard).
          const items = [...program.details];
          if (Array.isArray(program.pricing) && program.pricing.length === 1) {
            items.push(program.pricing[0]);
          }
          listEl.innerHTML = items.map(() => '<li><span class="li-label"></span><span class="li-value"></span></li>').join('');
          listEl.querySelectorAll('li').forEach((li, i) => {
            li.querySelector('.li-label').textContent = items[i].label || '';
            li.querySelector('.li-value').textContent = items[i].value || '';
          });
        }
      });
    })
    .catch(() => {});

  // ---------- Avis clients ----------
  const reviewsList = document.getElementById('reviews-list');
  const reviewsEmpty = document.getElementById('reviews-empty');
  const reviewForm = document.getElementById('review-form');
  const reviewNote = document.getElementById('review-note');
  const reviewSubmitBtn = document.getElementById('review-submit-btn');

  function starString(n) {
    return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
  }

  if (reviewsList) {
    fetch(`${SUPABASE_URL}/rest/v1/reviews?select=*&site=eq.gravity-basketball&approved=eq.true&order=created_at.desc&limit=12`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        if (!rows || rows.length === 0) return;
        reviewsEmpty.hidden = true;
        rows.forEach((r) => {
          const card = document.createElement('div');
          card.className = 'review-card';
          card.innerHTML =
            `<div class="review-stars">${starString(r.rating)}</div>` +
            `<p class="review-comment"></p>` +
            `<p class="review-author"></p>`;
          card.querySelector('.review-comment').textContent = r.comment || '';
          card.querySelector('.review-author').textContent = '— ' + r.contact_name;
          reviewsList.appendChild(card);
        });
      })
      .catch(() => {});
  }

  if (reviewForm) {
    reviewForm.addEventListener('submit', (e) => {
      e.preventDefault();
      reviewSubmitBtn.disabled = true;
      reviewSubmitBtn.textContent = 'Envoi...';

      const payload = {
        site: 'gravity-basketball',
        contact_name: document.getElementById('review-name').value.trim(),
        rating: parseInt(document.getElementById('review-rating').value, 10),
        comment: document.getElementById('review-comment').value.trim(),
      };

      fetch(`${SUPABASE_URL}/rest/v1/reviews`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (!res.ok) throw new Error('review insert failed');
          reviewForm.hidden = true;
          reviewNote.hidden = false;
        })
        .catch(() => {
          alert("Oups, l'envoi a échoué. Réessaie plus tard.");
          reviewSubmitBtn.disabled = false;
          reviewSubmitBtn.textContent = 'Envoyer mon avis';
        });
    });
  }

  // ---------- Nos partenaires ----------
  // "site.eq.gravity-basketball,site.is.null" -> partenaires propres à ce site
  // OU partenaires globaux (affichés sur tous les sites), gérés depuis le
  // dashboard admin. Section masquée tant qu'il n'y a aucun partenaire actif.
  const partnersSection = document.getElementById('partenaires');
  const partnersGrid = document.getElementById('partners-grid');
  if (partnersSection && partnersGrid) {
    fetch(
      `${SUPABASE_URL}/rest/v1/partners?select=*&active=eq.true&or=(site.eq.gravity-basketball,site.is.null)&order=display_order.asc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((partners) => {
        if (!partners || partners.length === 0) return;
        partnersGrid.innerHTML = partners
          .map((p) => {
            const img = `<img src="${p.logo_url}" alt="${p.name}" loading="lazy">`;
            return p.website_url
              ? `<a href="${p.website_url}" target="_blank" rel="noopener" class="partner-logo-link" title="${p.name}">${img}</a>`
              : `<span class="partner-logo-link" title="${p.name}">${img}</span>`;
          })
          .join('');
        partnersSection.hidden = false;
      })
      .catch(() => {});
  }

  // ---------- Carrousel Instagram (section Vidéos) ----------
  // Liste de publications gérée depuis le dashboard admin (table
  // instagram_carousel) — embed officiel Instagram, aucune connexion de
  // compte requise côté site.
  const igCarousel = document.getElementById('ig-carousel');
  const igTrack = document.getElementById('ig-carousel-track');
  const igEmpty = document.getElementById('ig-carousel-empty');
  const igPrev = document.getElementById('ig-prev');
  const igNext = document.getElementById('ig-next');

  // Embed direct en iframe (page /embed/ officielle d'Instagram) plutôt que
  // le blockquote + embed.js : ça affiche le lecteur vidéo jouable directement
  // sur le site (bouton "Jouer" dans l'iframe), au lieu d'une carte qui
  // renvoie le client sur Instagram pour voir le contenu.
  function toEmbedUrl(url) {
    const base = url.trim().replace(/\/?$/, '/');
    return base + 'embed/';
  }

  if (igCarousel && igTrack) {
    fetch(
      `${SUPABASE_URL}/rest/v1/instagram_carousel?select=*&site=eq.gravity-basketball-mtl&active=eq.true&order=position.asc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    )
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        if (!rows || rows.length === 0) return;
        igTrack.innerHTML = rows
          .map(
            (r) =>
              `<div class="ig-slide"><iframe src="${toEmbedUrl(r.post_url)}" width="340" height="560" frameborder="0" scrolling="no" allowtransparency="true" loading="lazy" title="Publication Instagram Gravity Basketball"></iframe></div>`
          )
          .join('');
        if (igEmpty) igEmpty.hidden = true;
        igCarousel.hidden = false;

        if (igPrev && igNext) {
          const scrollByCard = () => {
            const card = igTrack.querySelector('.ig-slide');
            return card ? card.getBoundingClientRect().width + 16 : 300;
          };
          igPrev.addEventListener('click', () => igTrack.scrollBy({ left: -scrollByCard(), behavior: 'smooth' }));
          igNext.addEventListener('click', () => igTrack.scrollBy({ left: scrollByCard(), behavior: 'smooth' }));
        }
      })
      .catch(() => {});
  }

  // ---------- Mes équipes (catégories, affiches, inscription Zeffy, joueurs) ----------
  // Contenu 100% géré depuis le dashboard admin (tables Supabase "teams" et
  // "players"). Rien n'est codé en dur ici : si le fetch échoue ou ne renvoie
  // rien, le message de chargement reste affiché tel quel (aucune section
  // cassée), même pattern défensif que les avis/partenaires ci-dessus.
  const teamsContent = document.getElementById('mes-equipes-content');
  const teamsEmpty = document.getElementById('mes-equipes-empty');

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  function initials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join('')
      .toUpperCase() || '?';
  }

  function playerCardHtml(player, teamName) {
    const photo = player.photo_url
      ? `<img class="player-photo" src="${escapeHtml(player.photo_url)}" alt="${escapeHtml(player.full_name)}" loading="lazy">`
      : `<div class="player-photo player-photo-placeholder">${escapeHtml(initials(player.full_name))}</div>`;
    const meta = [player.numero ? '#' + player.numero : '', player.poste || '']
      .filter(Boolean)
      .join(' · ');

    return `
      <div class="player-card" data-player-id="${escapeHtml(player.id)}">
        <div class="player-photo-wrap">${photo}</div>
        <div class="player-info">
          <p class="player-name">${escapeHtml(player.full_name || '')}</p>
          ${meta ? `<p class="player-meta">${escapeHtml(meta)}</p>` : ''}
          <div class="player-stats">
            <div class="player-stat"><span class="player-stat-value">${player.saison_points ?? 0}</span><span class="player-stat-label">Points</span></div>
            <div class="player-stat"><span class="player-stat-value">${player.saison_rebonds ?? 0}</span><span class="player-stat-label">Rebonds</span></div>
            <div class="player-stat"><span class="player-stat-value">${player.saison_passes ?? 0}</span><span class="player-stat-label">Passes</span></div>
            <div class="player-stat"><span class="player-stat-value">${player.saison_matchs ?? 0}</span><span class="player-stat-label">Matchs</span></div>
          </div>
          <button type="button" class="btn btn-ghost btn-block player-share-btn" data-player-id="${escapeHtml(player.id)}" data-team-name="${escapeHtml(teamName || '')}">📤 Partager sur Instagram</button>
        </div>
      </div>`;
  }

  function teamCardHtml(team, players) {
    const poster = team.affiche_url
      ? `<img class="programme-poster team-poster" src="${escapeHtml(team.affiche_url)}" alt="Affiche ${escapeHtml(team.nom_equipe)}" loading="lazy">`
      : `<div class="team-poster-placeholder">Affiche à venir</div>`;

    const zeffyLink = team.zeffy_url || ZEFFY_URL;
    const zeffy = zeffyLink
      ? `<a class="btn btn-primary btn-block" href="${escapeHtml(zeffyLink)}" target="_blank" rel="noopener">S'inscrire — ${escapeHtml(team.nom_equipe)}</a>`
      : `<span class="team-zeffy-soon">Inscription bientôt disponible</span>`;

    const playersHtml = players.length
      ? players.map((p) => playerCardHtml(p, team.nom_equipe)).join('')
      : `<p class="players-empty">Aucun joueur ajouté pour le moment.</p>`;

    const genreBadge = team.genre && team.genre !== 'Mixte'
      ? `<span class="team-genre-badge">${escapeHtml(team.genre)}</span>`
      : '';

    const description = team.description
      ? `<p class="team-description">${escapeHtml(team.description)}</p>`
      : '';

    return `
      <div class="team-card">
        <div class="team-card-head">
          <h4 class="team-name">${escapeHtml(team.nom_equipe)}</h4>
          ${genreBadge}
        </div>
        ${poster}
        ${description}
        <div class="team-zeffy">${zeffy}</div>
        <div class="players-grid">${playersHtml}</div>
      </div>`;
  }

  if (teamsContent) {
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/teams?select=*&site=eq.gravity-basketball&active=eq.true&order=display_order.asc`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      }).then((res) => (res.ok ? res.json() : [])),
      fetch(`${SUPABASE_URL}/rest/v1/players?select=*&site=eq.gravity-basketball&team_id=not.is.null&active=eq.true&order=display_order.asc`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      }).then((res) => (res.ok ? res.json() : [])),
    ])
      .then(([teams, players]) => {
        if (!teams || teams.length === 0) return;

        const playersByTeam = new Map();
        (players || []).forEach((p) => {
          if (!playersByTeam.has(p.team_id)) playersByTeam.set(p.team_id, []);
          playersByTeam.get(p.team_id).push(p);
        });

        // Regroupe les équipes consécutives (triées par display_order) qui
        // partagent la même catégorie — évite de coder en dur la liste des
        // catégories et leur ordre : le display_order du dashboard fait foi.
        const groups = [];
        teams.forEach((team) => {
          const last = groups[groups.length - 1];
          if (last && last.categorie === team.categorie) {
            last.teams.push(team);
          } else {
            groups.push({ categorie: team.categorie, teams: [team] });
          }
        });

        teamsContent.innerHTML = groups
          .map((group) => {
            const rowClass = group.teams.length === 1 ? 'teams-row teams-row-single' : 'teams-row';
            const cards = group.teams
              .map((team) => teamCardHtml(team, playersByTeam.get(team.id) || []))
              .join('');
            return `
              <div class="team-category">
                <h3 class="team-category-title">${escapeHtml(group.categorie)}</h3>
                <div class="${rowClass}">${cards}</div>
              </div>`;
          })
          .join('');
      })
      .catch(() => {});
  }

  // ---------- Partage fiche joueur sur Instagram (option B : image générée) ----------
  // Aucune API Instagram : on dessine une image (photo + stats + logo club) sur
  // un <canvas>, puis on la propose via le partage natif du système (qui inclut
  // Instagram Stories quand l'app est installée) ou, à défaut, en téléchargement.
  const SHARE_LOGO_SRC = 'assets/logo.png';

  function loadImage(src, crossOrigin) {
    return new Promise((resolve) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  async function buildPlayerShareImage(player, teamName) {
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    try {
      if (document.fonts && document.fonts.load) {
        await Promise.all([
          document.fonts.load('700 64px Oswald'),
          document.fonts.load('600 36px Inter'),
        ]);
      }
    } catch (e) { /* tant pis, on dessine avec la police de secours */ }

    // Fond
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, H);
    const grad = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W);
    grad.addColorStop(0, 'rgba(232,103,46,0.22)');
    grad.addColorStop(1, 'rgba(232,103,46,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Carte centrale
    const pad = 60;
    drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 36);
    ctx.fillStyle = '#171717';
    ctx.fill();
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Logo club (coin haut-gauche de la carte)
    const logo = await loadImage(SHARE_LOGO_SRC, false);
    if (logo) {
      const logoH = 70;
      const logoW = logoH * (logo.width / logo.height);
      ctx.drawImage(logo, pad + 40, pad + 40, logoW, logoH);
    }
    ctx.fillStyle = '#a8a8a8';
    ctx.font = '600 26px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('GRAVITY BASKETBALL', W - pad - 40, pad + 82);

    // Photo joueur (cercle)
    const photoCx = W / 2;
    const photoCy = pad + 300;
    const photoR = 190;
    let photoImg = null;
    if (player.photo_url) {
      photoImg = await loadImage(player.photo_url, true);
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
    ctx.closePath();
    if (photoImg) {
      ctx.clip();
      // Recadrage "cover" centré dans le cercle.
      const scale = Math.max((photoR * 2) / photoImg.width, (photoR * 2) / photoImg.height);
      const dw = photoImg.width * scale;
      const dh = photoImg.height * scale;
      ctx.drawImage(photoImg, photoCx - dw / 2, photoCy - dh / 2, dw, dh);
    } else {
      ctx.fillStyle = 'rgba(232,103,46,0.15)';
      ctx.fill();
      ctx.clip();
      ctx.fillStyle = '#ff8a4c';
      ctx.font = '700 140px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initials(player.full_name), photoCx, photoCy + 10);
    }
    ctx.restore();
    ctx.strokeStyle = '#e8672e';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
    ctx.stroke();

    // Nom + numéro/poste
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f5f5f5';
    ctx.font = '700 60px Oswald, sans-serif';
    ctx.fillText((player.full_name || '').toUpperCase(), W / 2, photoCy + photoR + 90);

    const metaParts = [player.numero ? '#' + player.numero : '', player.poste || '', teamName || ''].filter(Boolean);
    if (metaParts.length) {
      ctx.fillStyle = '#ff8a4c';
      ctx.font = '600 34px Inter, sans-serif';
      ctx.fillText(metaParts.join('  ·  '), W / 2, photoCy + photoR + 140);
    }

    // Stats
    const stats = [
      ['Points', player.saison_points ?? 0],
      ['Rebonds', player.saison_rebonds ?? 0],
      ['Passes', player.saison_passes ?? 0],
      ['Matchs', player.saison_matchs ?? 0],
    ];
    const statsY = photoCy + photoR + 220;
    const statsW = W - pad * 2 - 80;
    const boxW = statsW / stats.length;
    stats.forEach(([label, value], i) => {
      const cx = pad + 40 + boxW * i + boxW / 2;
      ctx.fillStyle = '#f5f5f5';
      ctx.font = '700 56px Oswald, sans-serif';
      ctx.fillText(String(value), cx, statsY);
      ctx.fillStyle = '#a8a8a8';
      ctx.font = '600 24px Inter, sans-serif';
      ctx.fillText(label.toUpperCase(), cx, statsY + 40);
    });

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
  }

  function slugify(str) {
    const noAccents = String(str || 'joueur')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    return noAccents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'joueur';
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.player-share-btn');
    if (!btn || !teamsContent || !teamsContent.contains(btn)) return;

    const card = btn.closest('.player-card');
    const playerId = btn.dataset.playerId;
    if (!card || !playerId) return;

    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Génération...';

    // On relit les valeurs affichées à l'écran plutôt que de recharger depuis
    // Supabase : c'est exactement ce que l'utilisateur voit qui doit se
    // retrouver sur l'image partagée.
    const player = {
      id: playerId,
      full_name: card.querySelector('.player-name')?.textContent || '',
      photo_url: card.querySelector('.player-photo')?.tagName === 'IMG' ? card.querySelector('.player-photo').src : '',
      numero: (card.querySelector('.player-meta')?.textContent.match(/#(\S+)/) || [])[1] || '',
      poste: '',
      saison_points: card.querySelectorAll('.player-stat-value')[0]?.textContent || 0,
      saison_rebonds: card.querySelectorAll('.player-stat-value')[1]?.textContent || 0,
      saison_passes: card.querySelectorAll('.player-stat-value')[2]?.textContent || 0,
      saison_matchs: card.querySelectorAll('.player-stat-value')[3]?.textContent || 0,
    };
    const teamName = btn.dataset.teamName || '';

    buildPlayerShareImage(player, teamName)
      .then(async (blob) => {
        if (!blob) throw new Error('canvas vide');
        const file = new File([blob], `gravity-${slugify(player.full_name)}.png`, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: player.full_name,
            text: `${player.full_name} — Gravity Basketball`,
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        }
      })
      .catch((err) => {
        if (err && err.name === 'AbortError') return; // partage annulé par l'utilisateur
        console.error('Partage Instagram — échec génération image', err);
        alert("Impossible de générer l'image pour le moment. Réessaie plus tard.");
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = originalLabel;
      });
  });
});
