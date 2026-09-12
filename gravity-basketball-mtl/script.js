// Gravity Basketball — script.js

// Backend partagé Supabase (coachyass / basketlibre / gravity-basketball).
// La clé "anon" ci-dessous est PUBLIQUE PAR CONCEPTION (protégée par Row Level
// Security côté serveur) — normal et sûr de l'exposer côté client.
const SUPABASE_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';

const MAILER_URL = 'https://gravity-mailer.netlify.app/.netlify/functions/send-confirmation';
const MAILER_KEY = '11c58c7548b0ed0666742f1e44a9cec1777bddee1c9fcbe5';

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
  const fieldPrepDetails = document.getElementById('field-prep-details');
  const dechargePrepCheckbox = document.getElementById('decharge_prep');
  const ageCategorieSelect = document.getElementById('age_categorie');
  const inscriptionTitle = document.getElementById('inscription-title');
  const programmeToggles = document.querySelectorAll('#field-programme .type-toggle');

  // "Plus de détails" repliable — les champs avancés de Gravity Prep (adresse,
  // niveau, mensurations, etc.) restent masqués tant qu'on ne clique pas dessus,
  // pour ne pas surcharger le formulaire dès la sélection du programme.
  const prepDetailsToggle = document.getElementById('prep-details-toggle');
  const prepDetailsFields = document.getElementById('prep-details-fields');
  if (prepDetailsToggle && prepDetailsFields) {
    prepDetailsToggle.addEventListener('click', () => {
      const expanded = prepDetailsToggle.getAttribute('aria-expanded') === 'true';
      prepDetailsToggle.setAttribute('aria-expanded', String(!expanded));
      prepDetailsFields.hidden = expanded;
      prepDetailsToggle.lastChild.textContent = expanded ? ' Plus de détails (optionnel)' : ' Moins de détails';
    });
  }

  function syncProgrammeUI() {
    const selected = form.querySelector('input[name="programme"]:checked').value;
    const isLigueMaison = selected === 'Ligue Maison';
    const isPrep = selected === 'Gravity Prep';
    const isU15Masculin = selected === 'Gravity U15 Masculin';

    // La Ligue Maison et Gravity Prep n'ont pas de formule "équipe" — ce sont
    // des programmes individuels.
    fieldTypeInscription.style.display = (isLigueMaison || isPrep) ? 'none' : 'flex';
    if (isLigueMaison || isPrep) {
      fieldEquipe.style.display = 'none';
    } else {
      syncTypeUI();
    }

    if (fieldPrepDetails) fieldPrepDetails.style.display = isPrep ? 'grid' : 'none';
    if (!isPrep && prepDetailsToggle && prepDetailsFields) {
      prepDetailsToggle.setAttribute('aria-expanded', 'false');
      prepDetailsFields.hidden = true;
      prepDetailsToggle.lastChild.textContent = ' Plus de détails (optionnel)';
    }
    // La décharge n'est exigée (et interactible) que pour Gravity Prep — un
    // champ requis mais caché bloquerait la soumission des autres programmes.
    if (dechargePrepCheckbox) {
      dechargePrepCheckbox.required = isPrep;
      if (!isPrep) dechargePrepCheckbox.checked = false;
    }

    ageCategorieSelect.value = isLigueMaison ? '9-10 ans' : isPrep ? 'Prep' : isU15Masculin ? 'U15' : '13-14 ans';
    inscriptionTitle.textContent = isLigueMaison
      ? 'Réserve ta place — Ligue Maison'
      : isPrep
        ? 'Réserve ta place — Gravity Prep'
        : isU15Masculin
          ? 'Réserve ta place — Gravity U15 Masculin'
          : 'Réserve ta place — Gravity Basketball Ligue 3v3';

    programmeToggles.forEach(t => {
      const input = t.querySelector('input');
      t.classList.toggle('is-checked', input.checked);
    });
  }
  programmeRadios.forEach(r => r.addEventListener('change', syncProgrammeUI));

  // Lien direct vers un programme précis (ex. pour une pub Gravity Prep) :
  // ?programme=Gravity%20Prep pré-sélectionne le bon programme au chargement.
  const programmeFromUrl = new URLSearchParams(window.location.search).get('programme');
  if (programmeFromUrl) {
    const radio = form.querySelector(`input[name="programme"][value="${programmeFromUrl}"]`);
    if (radio) {
      radio.checked = true;
      syncProgrammeUI();
    }
  }

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
    const isPrep = programme === 'Gravity Prep';
    const isU15Masculin = programme === 'Gravity U15 Masculin';
    const isIndividuelSeulement = programme === 'Ligue Maison' || isPrep;
    const payload = {
      site: 'gravity-basketball',
      type: programme === 'Ligue Maison'
        ? 'inscription_ligue_maison'
        : isPrep
          ? 'inscription_gravity_prep'
          : isU15Masculin
            ? 'inscription_u15_masculin'
            : 'inscription_ligue_3v3',
      contact_name: get('nom_complet'),
      contact_email: get('email'),
      contact_phone: get('telephone'),
      details: {
        programme,
        type_inscription: isIndividuelSeulement ? 'Individuel' : get('type_inscription'),
        nom_equipe: isIndividuelSeulement ? '' : get('nom_equipe'),
        age_categorie: get('age_categorie'),
        remarque: get('remarque'),
        reference: get('reference'),
        consentement_medias: data.get('consentement_medias') === 'Oui',
        mode_paiement: get('mode_paiement') || 'Interac',
        ...(isPrep ? {
          adresse: get('adresse'),
          niveau: get('niveau'),
          poste_de_jeu: get('poste_de_jeu'),
          taille_vetement: get('taille_vetement'),
          grandeur: get('grandeur'),
          poids: get('poids'),
          occupation: get('occupation'),
          objectif_saison: get('objectif_saison'),
          reseaux_sociaux: get('reseaux_sociaux'),
          disponibilites: get('disponibilites'),
          decharge_acceptee: data.get('decharge_prep') === 'Oui',
        } : {}),
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
        fetch(MAILER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-mailer-key': MAILER_KEY },
          body: JSON.stringify({
            type: 'basketball-mtl',
            to: payload.contact_email,
            fields: { nom: payload.contact_name, programme, modePaiement: payload.details.mode_paiement },
          }),
        }).catch(() => {});
        form.hidden = true;
        success.hidden = false;
        const interacCta = document.getElementById('interac-payment-cta');
        const zeffyCta = document.getElementById('zeffy-payment-cta');
        const zeffyLink = document.getElementById('zeffy-payment-link');
        const paymentPendingCta = document.getElementById('payment-pending-cta');
        const modePaiement = get('mode_paiement') || 'Interac';
        const link = ZEFFY_LINKS[programme];

        interacCta.hidden = true;
        zeffyCta.hidden = true;
        paymentPendingCta.hidden = true;

        if (modePaiement === 'Zeffy' && link) {
          zeffyLink.href = link;
          zeffyCta.hidden = false;
        } else if (modePaiement === 'Zeffy') {
          // Zeffy choisi mais pas de lien dédié pour ce programme (ex. Gravity
          // Prep) — on ne redirige jamais vers le mauvais événement de paiement.
          paymentPendingCta.hidden = false;
        } else {
          interacCta.hidden = false;
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

  // ---------- Espace Joueurs (compte joueur — Supabase Auth via REST, sans SDK) ----------
  (function initEspaceJoueurs() {
    const AUTH_URL = `${SUPABASE_URL}/auth/v1`;
    const REST_URL = `${SUPABASE_URL}/rest/v1`;
    const STORAGE_URL = `${SUPABASE_URL}/storage/v1`;
    const SESSION_KEY = 'gravity_espace_joueurs_session';

    const ejLoginForm = document.getElementById('ej-login-form');
    if (!ejLoginForm) return;

    const ejLoginError = document.getElementById('ej-login-error');
    const ejProfileEl = document.getElementById('ej-profile');
    const ejPhotoEl = document.getElementById('ej-player-photo');
    const ejNameEl = document.getElementById('ej-player-name');
    const ejMetaEl = document.getElementById('ej-player-meta');
    const ejLogoutBtn = document.getElementById('ej-logout-btn');
    const ejTabsEl = document.getElementById('ej-tabs');
    const ejCommuniquesEl = document.getElementById('ej-communiques');
    const ejMatchsEl = document.getElementById('ej-matchs');
    const ejEntrainementsEl = document.getElementById('ej-entrainements');
    const ejStatsEl = document.getElementById('ej-stats');
    const ejDocumentsEl = document.getElementById('ej-documents');
    const ejPasswordForm = document.getElementById('ej-password-form');
    const ejPasswordNote = document.getElementById('ej-password-note');

    function ejEscapeHtml(str) {
      return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
      ));
    }

    function ejGetSession() {
      try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
    }
    function ejSetSession(session) {
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) { /* stockage indisponible */ }
    }
    function ejClearSession() {
      try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* stockage indisponible */ }
    }

    async function ejRefreshSession(session) {
      const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const newSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in - 60) * 1000,
        user_id: data.user && data.user.id,
      };
      ejSetSession(newSession);
      return newSession;
    }

    async function ejGetValidSession() {
      let session = ejGetSession();
      if (!session) return null;
      if (Date.now() >= session.expires_at) {
        session = await ejRefreshSession(session);
        if (!session) { ejClearSession(); return null; }
      }
      return session;
    }

    async function ejAuthedFetch(url, opts) {
      const session = await ejGetValidSession();
      if (!session) throw new Error('not_authenticated');
      const headers = Object.assign({}, (opts && opts.headers) || {}, {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
      });
      return fetch(url, Object.assign({}, opts, { headers }));
    }

    function ejMapEmbedSrc(address) {
      return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
    }

    function ejFormatDateLabel(dateStr, timeStr) {
      const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      return timeStr ? `${label} — ${timeStr}` : label;
    }

    // ---------- Connexion / déconnexion ----------
    ejLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      ejLoginError.hidden = true;
      const email = document.getElementById('ej-login-email').value.trim();
      const password = document.getElementById('ej-login-password').value;
      const submitBtn = ejLoginForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
          method: 'POST',
          headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error_description || data.msg || 'Courriel ou mot de passe incorrect.');
        ejSetSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: Date.now() + (data.expires_in - 60) * 1000,
          user_id: data.user && data.user.id,
        });
        await ejShowProfile();
      } catch (err) {
        ejLoginError.textContent = err.message;
        ejLoginError.hidden = false;
      } finally {
        submitBtn.disabled = false;
      }
    });

    ejLogoutBtn?.addEventListener('click', () => {
      ejClearSession();
      ejProfileEl.hidden = true;
      ejLoginForm.hidden = false;
      ejLoginForm.reset();
    });

    // ---------- Onglets ----------
    ejTabsEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('.ej-tab-btn');
      if (!btn) return;
      ejTabsEl.querySelectorAll('.ej-tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.ej-tab-panel').forEach((panel) => {
        panel.hidden = panel.dataset.tab !== btn.dataset.tab;
      });
    });

    // ---------- Changement de mot de passe ----------
    ejPasswordForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      ejPasswordNote.hidden = true;
      const newPassword = document.getElementById('ej-new-password').value;
      const submitBtn = ejPasswordForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        const res = await ejAuthedFetch(`${AUTH_URL}/user`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: newPassword }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.msg || data.error_description || 'Échec de la mise à jour.');
        ejPasswordNote.textContent = 'Mot de passe mis à jour !';
        ejPasswordNote.style.color = '';
        ejPasswordNote.hidden = false;
        ejPasswordForm.reset();
      } catch (err) {
        ejPasswordNote.textContent = 'Erreur : ' + err.message;
        ejPasswordNote.style.color = '#ff6b6b';
        ejPasswordNote.hidden = false;
      } finally {
        submitBtn.disabled = false;
      }
    });

    // ---------- Chargement du profil ----------
    async function ejShowProfile() {
      let player;
      try {
        const session = await ejGetValidSession();
        if (!session || !session.user_id) throw new Error('not_authenticated');
        // Filtre explicite par auth_user_id : certaines lignes players (ex.
        // programme "championship") sont lisibles publiquement par ailleurs
        // (RLS "public read championship players"), donc "select=*&limit=1"
        // sans filtre pourrait retourner la fiche d'un AUTRE joueur si elle
        // trie avant la nôtre — jamais fiable pour retrouver "son propre" profil.
        const res = await ejAuthedFetch(`${REST_URL}/players?select=*&auth_user_id=eq.${session.user_id}&limit=1`);
        const rows = await res.json();
        player = Array.isArray(rows) ? rows[0] : null;
      } catch (err) {
        ejClearSession();
        return;
      }
      if (!player) {
        ejLoginError.textContent = "Aucun profil joueur n'est encore relié à ce compte. Contacte Gravity Basketball.";
        ejLoginError.hidden = false;
        ejClearSession();
        return;
      }

      ejLoginForm.hidden = true;
      ejProfileEl.hidden = false;

      ejNameEl.textContent = player.full_name;
      const metaParts = [];
      if (player.numero) metaParts.push(`#${player.numero}`);
      if (player.poste) metaParts.push(player.poste);
      ejMetaEl.textContent = metaParts.join(' · ');
      if (player.photo_url) {
        ejPhotoEl.src = player.photo_url;
        ejPhotoEl.alt = player.full_name;
        ejPhotoEl.hidden = false;
      } else {
        ejPhotoEl.hidden = true;
      }

      await Promise.all([
        ejLoadCommuniques(player).catch(() => { ejCommuniquesEl.innerHTML = '<p class="ej-empty">Impossible de charger les communiqués pour l\'instant.</p>'; }),
        ejLoadMatchs(player).catch(() => { ejMatchsEl.innerHTML = '<p class="ej-empty">Impossible de charger le calendrier des matchs pour l\'instant.</p>'; }),
        ejLoadEntrainements(player).catch(() => { ejEntrainementsEl.innerHTML = '<p class="ej-empty">Impossible de charger le calendrier des entraînements pour l\'instant.</p>'; }),
        ejLoadStats(player).catch(() => { ejStatsEl.innerHTML = '<p class="ej-empty">Impossible de charger les statistiques pour l\'instant.</p>'; }),
        ejLoadDocuments(player).catch(() => { ejDocumentsEl.innerHTML = '<p class="ej-empty">Impossible de charger les documents pour l\'instant.</p>'; }),
      ]);
    }

    async function ejLoadCommuniques(player) {
      const filter = player.team_id
        ? `or=(team_id.is.null,team_id.eq.${player.team_id})`
        : 'team_id=is.null';
      const res = await ejAuthedFetch(`${REST_URL}/announcements?select=*&${filter}&order=created_at.desc`);
      const rows = res.ok ? await res.json() : [];
      if (!rows.length) {
        ejCommuniquesEl.innerHTML = '<p class="ej-empty">Aucun communiqué pour l\'instant.</p>';
        return;
      }
      ejCommuniquesEl.innerHTML = rows.map((a) => `
        <div class="ej-card">
          <p class="ej-card-title">${ejEscapeHtml(a.titre)}</p>
          <p class="ej-card-meta">${new Date(a.created_at).toLocaleDateString('fr-CA', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p>${ejEscapeHtml(a.contenu).replace(/\n/g, '<br>')}</p>
        </div>
      `).join('');
    }

    async function ejLoadMatchs(player) {
      if (!player.team_id) {
        ejMatchsEl.innerHTML = '<p class="ej-empty">Tu n\'es pas encore assigné à une équipe.</p>';
        return;
      }
      const res = await ejAuthedFetch(`${REST_URL}/team_games?select=*&team_id=eq.${player.team_id}&order=date_match.asc`);
      const rows = res.ok ? await res.json() : [];
      if (!rows.length) {
        ejMatchsEl.innerHTML = '<p class="ej-empty">Aucun match programmé pour l\'instant.</p>';
        return;
      }
      ejMatchsEl.innerHTML = rows.map((g) => `
        <div class="ej-card">
          <span class="ej-card-badge${g.type === 'playoff' ? ' ej-badge-playoff' : ''}">${g.type === 'playoff' ? 'Playoffs' : 'Saison régulière'}</span>
          <p class="ej-card-title">${g.adversaire ? `Vs ${ejEscapeHtml(g.adversaire)}` : 'Match'} ${g.domicile ? '(Domicile)' : '(Extérieur)'}</p>
          <p class="ej-card-meta">${ejFormatDateLabel(g.date_match, g.heure_match)}</p>
          ${g.lieu_nom ? `<p class="ej-card-meta">${ejEscapeHtml(g.lieu_nom)}</p>` : ''}
          ${g.resultat ? `<p><strong>Résultat :</strong> ${ejEscapeHtml(g.resultat)}</p>` : ''}
          ${g.notes ? `<p>${ejEscapeHtml(g.notes)}</p>` : ''}
          ${g.adresse ? `<div class="ej-map-wrap"><iframe src="${ejMapEmbedSrc(g.adresse)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Carte — ${ejEscapeHtml(g.lieu_nom || g.adresse)}"></iframe></div>` : ''}
        </div>
      `).join('');
    }

    async function ejLoadEntrainements(player) {
      if (!player.team_id) {
        ejEntrainementsEl.innerHTML = '<p class="ej-empty">Tu n\'es pas encore assigné à une équipe.</p>';
        return;
      }
      const res = await ejAuthedFetch(`${REST_URL}/team_trainings?select=*&team_id=eq.${player.team_id}&order=date_entrainement.asc`);
      const rows = res.ok ? await res.json() : [];
      if (!rows.length) {
        ejEntrainementsEl.innerHTML = '<p class="ej-empty">Aucun entraînement programmé pour l\'instant.</p>';
        return;
      }
      ejEntrainementsEl.innerHTML = rows.map((t) => {
        const heure = t.heure_debut ? `${t.heure_debut}${t.heure_fin ? '–' + t.heure_fin : ''}` : '';
        return `
        <div class="ej-card">
          <p class="ej-card-title">Entraînement</p>
          <p class="ej-card-meta">${ejFormatDateLabel(t.date_entrainement, heure)}</p>
          ${t.lieu_nom ? `<p class="ej-card-meta">${ejEscapeHtml(t.lieu_nom)}</p>` : ''}
          ${t.notes ? `<p>${ejEscapeHtml(t.notes)}</p>` : ''}
          ${t.adresse ? `<div class="ej-map-wrap"><iframe src="${ejMapEmbedSrc(t.adresse)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Carte — ${ejEscapeHtml(t.lieu_nom || t.adresse)}"></iframe></div>` : ''}
        </div>
      `;
      }).join('');
    }

    async function ejLoadStats(player) {
      const statBoxes = [
        { label: 'Points/match', num: player.saison_points ?? 0 },
        { label: 'Rebonds/match', num: player.saison_rebonds ?? 0 },
        { label: 'Passes/match', num: player.saison_passes ?? 0 },
        { label: 'Matchs joués', num: player.saison_matchs ?? 0 },
      ];
      let html = `<div class="ej-stats-grid">${statBoxes.map((r) => `
        <div class="ej-stat-box"><span class="num">${ejEscapeHtml(String(r.num))}</span><span class="label">${r.label}</span></div>
      `).join('')}</div>`;

      const res = await ejAuthedFetch(`${REST_URL}/player_stats?select=*&player_id=eq.${player.id}&order=game_date.desc`);
      const gameRows = res.ok ? await res.json() : [];
      if (gameRows.length) {
        html += '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Pts</th><th>Reb</th><th>Pas</th><th>Interceptions</th></tr></thead><tbody>' +
          gameRows.map((s) => `<tr><td>${s.game_date ? new Date(s.game_date + 'T00:00:00').toLocaleDateString('fr-CA') : '—'}</td><td>${s.points ?? 0}</td><td>${s.rebounds ?? 0}</td><td>${s.assists ?? 0}</td><td>${s.steals ?? 0}</td></tr>`).join('') +
          '</tbody></table></div>';
      }
      ejStatsEl.innerHTML = html;
    }

    async function ejLoadDocuments(player) {
      const res = await ejAuthedFetch(`${REST_URL}/player_documents?select=*&player_id=eq.${player.id}&order=created_at.desc`);
      const rows = res.ok ? await res.json() : [];
      if (!rows.length) {
        ejDocumentsEl.innerHTML = '<p class="ej-empty">Aucun document pour l\'instant.</p>';
        return;
      }
      const CATEGORIES = { contrat: 'Contrat / inscription', medical: 'Médical', autre: 'Autre' };
      const cards = await Promise.all(rows.map(async (doc) => {
        let href = '#';
        try {
          const signRes = await ejAuthedFetch(`${STORAGE_URL}/object/sign/player-documents/${doc.file_path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ expiresIn: 3600 }),
          });
          const signData = await signRes.json();
          if (signRes.ok && signData.signedURL) href = `${STORAGE_URL}${signData.signedURL}`;
        } catch (e) { /* lien indisponible */ }
        return `
          <div class="ej-card">
            <p class="ej-card-title">${ejEscapeHtml(doc.titre)}</p>
            <p class="ej-card-meta">${doc.categorie ? ejEscapeHtml(CATEGORIES[doc.categorie] || doc.categorie) + ' — ' : ''}${new Date(doc.created_at).toLocaleDateString('fr-CA')}</p>
            <a class="ej-doc-link" href="${href}" target="_blank" rel="noopener noreferrer">Ouvrir / télécharger</a>
          </div>
        `;
      }));
      ejDocumentsEl.innerHTML = cards.join('');
    }

    // Restaure la session si déjà connecté (refresh de page)
    ejGetValidSession().then((session) => { if (session) ejShowProfile(); });
  })();
});
