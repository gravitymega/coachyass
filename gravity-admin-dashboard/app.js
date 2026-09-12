// Dashboard admin unifié — coachyass / basketlibre / gravity-basketball
// Utilise le SDK Supabase JS (chargé via CDN dans index.html serait plus simple,
// mais ici on l'importe en ESM directement depuis esm.sh pour rester zero-build).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://aevoulzotvmnrnclfuek.supabase.co';
// Clé publique "anon" — protégée par RLS, normal de l'exposer côté client.
const SUPABASE_ANON_KEY = 'sb_publishable_NAj99iQim_odAYNwR-qucg_2KKHYf7Z';

const SITES = ['gravity-basketball', 'coachyass', 'basketlibre'];
const SITE_LABELS = {
  'gravity-basketball': 'Gravity Basketball',
  coachyass: 'CoachYass',
  basketlibre: 'BasketLibre',
  'gravity-basketball-mtl': 'Gravity Basketball MTL',
  osmm: 'OSMM Montréal',
};
// Panneau "Disponibilités" — pertinent uniquement pour Gravity Coaching
// (site interne 'coachyass') et Gravity Pickup (site interne 'basketlibre').
const SLOTS_SITES = ['coachyass', 'basketlibre'];
const WEEKDAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- État ----------
let currentAdmin = null; // { id, sites: [...] }
let activeSite = 'all';
let activeGroup = 'accueil';
let allBookings = [];
let allReviews = [];
let allPrograms = [];
let allSlots = [];
let allPartners = [];
let allInstagramCarousel = [];
let slotBookingCounts = {}; // { [slot_id]: count } — réservations actives (hors annulé) par créneau
let siteRows = {}; // { [slug]: { booking_suspended, suspended_message } }
let championshipRegistrations = [];
let championshipStandings = [];
let championshipPlayers = [];
let allReferees = [];
let allCoachApplications = [];
let allPartnershipApplications = [];
let allFinanceEntries = [];
let allTeams = [];
let allTeamPlayers = [];
let allTeamGames = [];
let allTeamTrainings = [];
let allAnnouncements = [];
let allPlayerDocuments = [];

// Regroupement des panneaux sous un menu latéral (au lieu de tout afficher
// à plat) — chaque section du HTML porte un attribut data-group="<id>"
// correspondant à l'un de ces groupes. "Accueil" est la vue par défaut.
const GROUPS = [
  { id: 'accueil', label: 'Accueil' },
  { id: 'reservations', label: 'Réservations' },
  { id: 'programmes', label: 'Programmes' },
  { id: 'disponibilites', label: 'Disponibilités', slotsOnly: true },
  { id: 'partenaires', label: 'Partenaires' },
  { id: 'avis', label: 'Avis' },
  { id: 'championnat', label: 'Championnat', champOnly: true },
  { id: 'mes-equipes', label: 'Mes équipes', champOnly: true },
  { id: 'espace-joueurs', label: 'Espace Joueurs', champOnly: true },
  { id: 'recrutement', label: 'Recrutement', champOnly: true },
  { id: 'partenariats', label: 'Partenariats', champOnly: true },
  { id: 'communication', label: 'Communication' },
  { id: 'comptabilite', label: 'Comptabilité' },
  { id: 'produit', label: 'Produit vedette' },
  { id: 'videos', label: 'Vidéos Instagram' },
];

// ---------- Éléments DOM ----------
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const googleLoginBtn = document.getElementById('google-login-btn');
const appEl = document.getElementById('app');
const userEmailEl = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const siteTabsEl = document.getElementById('site-tabs');
const statsRowEl = document.getElementById('stats-row');
const bookingsTbody = document.getElementById('bookings-tbody');
const bookingsNameFilterEl = document.getElementById('bookings-name-filter');
const bookingsTypeFilterEl = document.getElementById('bookings-type-filter');
const bookingsDateFromEl = document.getElementById('bookings-date-from');
const bookingsDateToEl = document.getElementById('bookings-date-to');
const bookingsFilterResetBtn = document.getElementById('bookings-filter-reset');
const pendingReviewsEl = document.getElementById('pending-reviews');
const approvedReviewsEl = document.getElementById('approved-reviews');
const reviewAddForm = document.getElementById('review-add-form');
const reviewAddSiteSelect = document.getElementById('review-add-site');
const reviewAddNameInput = document.getElementById('review-add-name');
const reviewAddRatingSelect = document.getElementById('review-add-rating');
const reviewAddCommentInput = document.getElementById('review-add-comment');
const reviewAddSaveNote = document.getElementById('review-add-save-note');
const productForm = document.getElementById('product-form');
const productSiteSelect = document.getElementById('product-site');
const productUrlInput = document.getElementById('product-url');
const productExtractBtn = document.getElementById('product-extract-btn');
const productExtractStatus = document.getElementById('product-extract-status');
const productTitleInput = document.getElementById('product-title');
const productPriceInput = document.getElementById('product-price');
const productImageInput = document.getElementById('product-image');
const productActiveInput = document.getElementById('product-active');
const productSaveNote = document.getElementById('product-save-note');
const clickStatsRowEl = document.getElementById('click-stats-row');
const clickStatsTbodyEl = document.getElementById('click-stats-tbody');
const clickStatsEmptyEl = document.getElementById('click-stats-empty');
const clickStatsTableEl = document.getElementById('click-stats-table');

const refereesTbody = document.getElementById('referees-tbody');
const coachesTbody = document.getElementById('coaches-tbody');
const partnershipsTbody = document.getElementById('partnerships-tbody');
const financeStatsRowEl = document.getElementById('finance-stats-row');
const financeForm = document.getElementById('finance-form');
const financeTypeSelect = document.getElementById('finance-type');
const financeSiteSelect = document.getElementById('finance-site');
const financeCategoryInput = document.getElementById('finance-category');
const financeAmountInput = document.getElementById('finance-amount');
const financeDateInput = document.getElementById('finance-date');
const financeDescriptionInput = document.getElementById('finance-description');
const financeSaveNote = document.getElementById('finance-save-note');
const financeTbody = document.getElementById('finance-tbody');
const refundsTbody = document.getElementById('refunds-tbody');


const sidebarEl = document.getElementById('sidebar');
const groupNavEl = document.getElementById('group-nav');
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebarBackdropEl = document.getElementById('sidebar-backdrop');
const homeGridEl = document.getElementById('home-grid');

const programsTbody = document.getElementById('programs-tbody');
const programNewBtn = document.getElementById('program-new-btn');
const programForm = document.getElementById('program-form');
const programIdInput = document.getElementById('program-id');
const programSiteSelect = document.getElementById('program-site');
const programSlugInput = document.getElementById('program-slug');
const programNameInput = document.getElementById('program-name');
const programDescriptionInput = document.getElementById('program-description');
const programDetailsRowsEl = document.getElementById('program-details-rows');
const programDetailsAddBtn = document.getElementById('program-details-add');
const programPricingRowsEl = document.getElementById('program-pricing-rows');
const programPricingAddBtn = document.getElementById('program-pricing-add');
const programScheduleInput = document.getElementById('program-schedule');
const programLocationInput = document.getElementById('program-location');
const programZeffyInput = document.getElementById('program-zeffy');
const programOrderInput = document.getElementById('program-order');
const programActiveCheckbox = document.getElementById('program-active');
const programSaveNote = document.getElementById('program-save-note');
const programCancelBtn = document.getElementById('program-cancel-btn');
const programDeleteBtn = document.getElementById('program-delete-btn');

const slotsTbody = document.getElementById('slots-tbody');
const siteSuspendListEl = document.getElementById('site-suspend-list');
const slotForm = document.getElementById('slot-form');
const slotSiteSelect = document.getElementById('slot-site');
const slotDateInput = document.getElementById('slot-date');
const slotStartInput = document.getElementById('slot-start');
const slotEndInput = document.getElementById('slot-end');
const slotLocationInput = document.getElementById('slot-location');
const slotCapacityInput = document.getElementById('slot-capacity');
const slotSaveNote = document.getElementById('slot-save-note');
const slotBulkForm = document.getElementById('slot-bulk-form');
const bulkSiteSelect = document.getElementById('bulk-site');
const bulkWeekdaySelect = document.getElementById('bulk-weekday');
const bulkStartInput = document.getElementById('bulk-start');
const bulkEndInput = document.getElementById('bulk-end');
const bulkLocationInput = document.getElementById('bulk-location');
const bulkCapacityInput = document.getElementById('bulk-capacity');
const bulkWeeksInput = document.getElementById('bulk-weeks');
const bulkSaveNote = document.getElementById('bulk-save-note');

const partnersTbody = document.getElementById('partners-tbody');
const partnerNewBtn = document.getElementById('partner-new-btn');
const partnerForm = document.getElementById('partner-form');
const partnerIdInput = document.getElementById('partner-id');
const partnerSiteSelect = document.getElementById('partner-site');
const partnerNameInput = document.getElementById('partner-name');
const partnerLogoFileInput = document.getElementById('partner-logo-file');
const partnerLogoPreviewEl = document.getElementById('partner-logo-preview');
const partnerWebsiteInput = document.getElementById('partner-website');
const partnerOrderInput = document.getElementById('partner-order');
const partnerActiveCheckbox = document.getElementById('partner-active');
const partnerSaveNote = document.getElementById('partner-save-note');
const partnerCancelBtn = document.getElementById('partner-cancel-btn');
const partnerDeleteBtn = document.getElementById('partner-delete-btn');

// ---------- Mes équipes (teams / players — gravity-basketball) ----------
const teamsTbody = document.getElementById('teams-tbody');
const teamForm = document.getElementById('team-form');
const teamFormTitle = document.getElementById('team-form-title');
const teamIdInput = document.getElementById('team-id');
const teamAfficheFileInput = document.getElementById('team-affiche-file');
const teamAffichePreviewEl = document.getElementById('team-affiche-preview');
const teamDescriptionInput = document.getElementById('team-description');
const teamZeffyInput = document.getElementById('team-zeffy');
const teamOrderInput = document.getElementById('team-order');
const teamActiveCheckbox = document.getElementById('team-active');
const teamSaveNote = document.getElementById('team-save-note');
const teamCancelBtn = document.getElementById('team-cancel-btn');

const teamPlayersTbody = document.getElementById('team-players-tbody');
const teamPlayerNewBtn = document.getElementById('team-player-new-btn');
const teamPlayerForm = document.getElementById('team-player-form');
const teamPlayerIdInput = document.getElementById('team-player-id');
const teamPlayerTeamSelect = document.getElementById('team-player-team');
const teamPlayerNameInput = document.getElementById('team-player-name');
const teamPlayerNumeroInput = document.getElementById('team-player-numero');
const teamPlayerPosteInput = document.getElementById('team-player-poste');
const teamPlayerAgeInput = document.getElementById('team-player-age');
const teamPlayerPhotoFileInput = document.getElementById('team-player-photo-file');
const teamPlayerPhotoPreviewEl = document.getElementById('team-player-photo-preview');
const teamPlayerInstagramInput = document.getElementById('team-player-instagram');
const teamPlayerEmailInput = document.getElementById('team-player-email');
const teamPlayerPointsInput = document.getElementById('team-player-points');
const teamPlayerReboundsInput = document.getElementById('team-player-rebonds');
const teamPlayerAssistsInput = document.getElementById('team-player-passes');
const teamPlayerGamesInput = document.getElementById('team-player-matchs');
const teamPlayerOrderInput = document.getElementById('team-player-order');
const teamPlayerActiveCheckbox = document.getElementById('team-player-active');
const teamPlayerSaveNote = document.getElementById('team-player-save-note');
const teamPlayerCancelBtn = document.getElementById('team-player-cancel-btn');
const teamPlayerDeleteBtn = document.getElementById('team-player-delete-btn');

// ---------- Espace Joueurs (comptes / documents / matchs / entraînements / communiqués) ----------
const playerAccountsTbody = document.getElementById('player-accounts-tbody');

const playerDocumentsTbody = document.getElementById('player-documents-tbody');
const playerDocumentNewBtn = document.getElementById('player-document-new-btn');
const playerDocumentForm = document.getElementById('player-document-form');
const playerDocumentIdInput = document.getElementById('player-document-id');
const playerDocumentPlayerSelect = document.getElementById('player-document-player');
const playerDocumentTitreInput = document.getElementById('player-document-titre');
const playerDocumentTitreHint = document.getElementById('player-document-titre-hint');
const playerDocumentCategorieSelect = document.getElementById('player-document-categorie');
const playerDocumentFileInput = document.getElementById('player-document-file');
const playerDocumentFileLabel = document.getElementById('player-document-file-label');
const playerDocumentSubmitBtn = document.getElementById('player-document-submit-btn');
const playerDocumentSaveNote = document.getElementById('player-document-save-note');
const playerDocumentCancelBtn = document.getElementById('player-document-cancel-btn');

const teamGamesTbody = document.getElementById('team-games-tbody');
const teamGameNewBtn = document.getElementById('team-game-new-btn');
const teamGameForm = document.getElementById('team-game-form');
const teamGameIdInput = document.getElementById('team-game-id');
const teamGameTeamSelect = document.getElementById('team-game-team');
const teamGameTypeSelect = document.getElementById('team-game-type');
const teamGameAdversaireInput = document.getElementById('team-game-adversaire');
const teamGameDateInput = document.getElementById('team-game-date');
const teamGameHeureInput = document.getElementById('team-game-heure');
const teamGameLieuNomInput = document.getElementById('team-game-lieu-nom');
const teamGameAdresseInput = document.getElementById('team-game-adresse');
const teamGameDomicileCheckbox = document.getElementById('team-game-domicile');
const teamGameResultatInput = document.getElementById('team-game-resultat');
const teamGameNotesInput = document.getElementById('team-game-notes');
const teamGameOrderInput = document.getElementById('team-game-order');
const teamGameSaveNote = document.getElementById('team-game-save-note');
const teamGameCancelBtn = document.getElementById('team-game-cancel-btn');
const teamGameDeleteBtn = document.getElementById('team-game-delete-btn');

const teamTrainingsTbody = document.getElementById('team-trainings-tbody');
const teamTrainingNewBtn = document.getElementById('team-training-new-btn');
const teamTrainingForm = document.getElementById('team-training-form');
const teamTrainingIdInput = document.getElementById('team-training-id');
const teamTrainingTeamSelect = document.getElementById('team-training-team');
const teamTrainingDateInput = document.getElementById('team-training-date');
const teamTrainingHeureDebutInput = document.getElementById('team-training-heure-debut');
const teamTrainingHeureFinInput = document.getElementById('team-training-heure-fin');
const teamTrainingLieuNomInput = document.getElementById('team-training-lieu-nom');
const teamTrainingAdresseInput = document.getElementById('team-training-adresse');
const teamTrainingNotesInput = document.getElementById('team-training-notes');
const teamTrainingOrderInput = document.getElementById('team-training-order');
const teamTrainingSaveNote = document.getElementById('team-training-save-note');
const teamTrainingCancelBtn = document.getElementById('team-training-cancel-btn');
const teamTrainingDeleteBtn = document.getElementById('team-training-delete-btn');

const announcementsTbody = document.getElementById('announcements-tbody');
const announcementNewBtn = document.getElementById('announcement-new-btn');
const announcementForm = document.getElementById('announcement-form');
const announcementIdInput = document.getElementById('announcement-id');
const announcementTeamSelect = document.getElementById('announcement-team');
const announcementTitreInput = document.getElementById('announcement-titre');
const announcementContenuInput = document.getElementById('announcement-contenu');
const announcementSaveNote = document.getElementById('announcement-save-note');
const announcementCancelBtn = document.getElementById('announcement-cancel-btn');
const announcementDeleteBtn = document.getElementById('announcement-delete-btn');

const igCarouselTbody = document.getElementById('ig-carousel-tbody');
const igCarouselNewBtn = document.getElementById('ig-carousel-new-btn');
const igCarouselForm = document.getElementById('ig-carousel-form');
const igCarouselIdInput = document.getElementById('ig-carousel-id');
const igCarouselSiteSelect = document.getElementById('ig-carousel-site');
const igCarouselUrlInput = document.getElementById('ig-carousel-url');
const igCarouselVideoFileInput = document.getElementById('ig-carousel-video-file');
const igCarouselVideoPreviewEl = document.getElementById('ig-carousel-video-preview');
const igCarouselOrderInput = document.getElementById('ig-carousel-order');
const igCarouselActiveCheckbox = document.getElementById('ig-carousel-active');
const igCarouselSaveNote = document.getElementById('ig-carousel-save-note');
const igCarouselCancelBtn = document.getElementById('ig-carousel-cancel-btn');
const igCarouselDeleteBtn = document.getElementById('ig-carousel-delete-btn');

let allPhotoGallery = [];
const photoGalleryTbody = document.getElementById('photo-gallery-tbody');
const photoGalleryNewBtn = document.getElementById('photo-gallery-new-btn');
const photoGalleryForm = document.getElementById('photo-gallery-form');
const photoGalleryIdInput = document.getElementById('photo-gallery-id');
const photoGallerySiteSelect = document.getElementById('photo-gallery-site');
const photoGalleryFileInput = document.getElementById('photo-gallery-file');
const photoGalleryPreviewEl = document.getElementById('photo-gallery-preview');
const photoGalleryCaptionInput = document.getElementById('photo-gallery-caption');
const photoGalleryOrderInput = document.getElementById('photo-gallery-order');
const photoGalleryActiveCheckbox = document.getElementById('photo-gallery-active');
const photoGallerySaveNote = document.getElementById('photo-gallery-save-note');
const photoGalleryCancelBtn = document.getElementById('photo-gallery-cancel-btn');
const photoGalleryDeleteBtn = document.getElementById('photo-gallery-delete-btn');

const commTypeFilterEl = document.getElementById('comm-type-filter');
const commStatusFilterEl = document.getElementById('comm-status-filter');
const commTbody = document.getElementById('comm-tbody');
const commSelectAllEl = document.getElementById('comm-select-all');
const commCountEl = document.getElementById('comm-selected-count');
const commSubjectInput = document.getElementById('comm-subject');
const commBodyInput = document.getElementById('comm-body');
const commActionsEl = document.getElementById('comm-actions');

const championshipRegTbody = document.getElementById('championship-reg-tbody');
const standingsTbody = document.getElementById('standings-tbody');
const standingsAddForm = document.getElementById('standings-add-form');
const standingsNewTeamInput = document.getElementById('standings-new-team');
const awardForm = document.getElementById('award-form');
const awardTypeSelect = document.getElementById('award-type');
const awardWeekField = document.getElementById('award-week-field');
const awardWeekInput = document.getElementById('award-week');
const awardSeasonInput = document.getElementById('award-season');
const awardMvpPlayerSelect = document.getElementById('award-mvp-player');
const awardDefendersInput = document.getElementById('award-defenders');
const awardSaveNote = document.getElementById('award-save-note');
const statForm = document.getElementById('stat-form');
const statPlayerSelect = document.getElementById('stat-player');
const statDateInput = document.getElementById('stat-date');
const statPointsInput = document.getElementById('stat-points');
const statAssistsInput = document.getElementById('stat-assists');
const statStealsInput = document.getElementById('stat-steals');
const statSaveNote = document.getElementById('stat-save-note');

// URL de la fonction Netlify d'extraction (déployée avec ce même site).
// En local/preview ça pointera vers /.netlify/functions/scrape-product relatif à ce domaine.
const SCRAPE_FN_URL = '/.netlify/functions/scrape-product';

// ---------- Auth ----------
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.hidden = true;
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = "Connexion échouée : " + error.message;
    loginError.hidden = false;
    return;
  }
  await afterLogin(data.user);
});

// Connexion Google (OAuth) — Supabase relie automatiquement ce compte au
// compte existant (courriel/mot de passe) si l'adresse courriel est la
// même et déjà confirmée, donc la ligne admin_users existante reste
// reconnue peu importe la méthode de connexion utilisée.
googleLoginBtn.addEventListener('click', async () => {
  loginError.hidden = true;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) {
    loginError.textContent = "Connexion Google échouée : " + error.message;
    loginError.hidden = false;
  }
  // En cas de succès, le navigateur est redirigé vers Google puis revient
  // ici — supabase.auth.getSession() (plus bas) prend le relais au retour.
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

async function afterLogin(user) {
  // Vérifie que cet utilisateur est bien un admin autorisé (table admin_users)
  const { data: adminRow, error } = await supabase
    .from('admin_users')
    .select('id, full_name, role, sites')
    .eq('id', user.id)
    .single();

  if (error || !adminRow) {
    loginError.textContent = "Ce compte n'est pas autorisé sur le dashboard admin. Contacte Yassine.";
    loginError.hidden = false;
    await supabase.auth.signOut();
    return;
  }

  currentAdmin = adminRow;
  loginScreen.hidden = true;
  appEl.hidden = false;
  userEmailEl.textContent = user.email;

  renderSiteTabs();
  renderSidebar();
  applyPanelVisibility();
  productSiteSelect.innerHTML =
    '<option value="">Global (tous les sites)</option>' +
    currentAdmin.sites.map((s) => `<option value="${s}">${SITE_LABELS[s] || s}</option>`).join('');
  programSiteSelect.innerHTML =
    currentAdmin.sites.map((s) => `<option value="${s}">${SITE_LABELS[s] || s}</option>`).join('');
  if (reviewAddSiteSelect) {
    reviewAddSiteSelect.innerHTML =
      currentAdmin.sites.map((s) => `<option value="${s}">${SITE_LABELS[s] || s}</option>`).join('');
  }
  const adminSlotsSites = currentAdmin.sites.filter((s) => SLOTS_SITES.includes(s));
  slotSiteSelect.innerHTML = adminSlotsSites.map((s) => `<option value="${s}">${SITE_LABELS[s] || s}</option>`).join('');
  bulkSiteSelect.innerHTML = adminSlotsSites.map((s) => `<option value="${s}">${SITE_LABELS[s] || s}</option>`).join('');
  partnerSiteSelect.innerHTML =
    '<option value="">Tous les sites</option>' +
    currentAdmin.sites.map((s) => `<option value="${s}">${SITE_LABELS[s] || s}</option>`).join('');
  if (financeSiteSelect) {
    financeSiteSelect.innerHTML =
      '<option value="">Global / non spécifique</option>' +
      currentAdmin.sites.map((s) => `<option value="${s}">${SITE_LABELS[s] || s}</option>`).join('');
  }
  if (financeDateInput) {
    financeDateInput.value = new Date().toISOString().slice(0, 10);
  }

  await loadAll();
}

// Un admin gère-t-il le programme Championnat (gravity-basketball) / les
// sites concernés par "Disponibilités" (coachyass/basketlibre) ? Utilisé à
// la fois pour filtrer les entrées du menu latéral et pour décider quels
// panneaux afficher une fois un groupe sélectionné.
function adminHasChampionship() {
  return currentAdmin.sites.includes('gravity-basketball');
}
function adminSlotsSites() {
  return currentAdmin.sites.filter((s) => SLOTS_SITES.includes(s));
}

// ---------- Menu latéral (groupes de panneaux) ----------
function groupBadgeCount(id) {
  if (id === 'reservations') return allBookings.filter((r) => r.status === 'nouveau').length;
  if (id === 'avis') return allReviews.filter((r) => !r.approved).length;
  if (id === 'recrutement') {
    return (
      allReferees.filter((r) => r.status === 'nouveau').length +
      allCoachApplications.filter((r) => r.status === 'nouveau').length
    );
  }
  if (id === 'partenariats') return allPartnershipApplications.filter((r) => r.status === 'nouveau').length;
  return 0;
}

function renderSidebar() {
  if (!groupNavEl) return;
  const champOk = adminHasChampionship();
  const slotsOk = adminSlotsSites().length > 0;
  const visibleGroups = GROUPS.filter((g) => {
    if (g.champOnly) return champOk;
    if (g.slotsOnly) return slotsOk;
    return true;
  });
  groupNavEl.innerHTML = visibleGroups
    .map((g) => {
      const badge = groupBadgeCount(g.id);
      return `<button type="button" class="sidebar-nav-btn${g.id === activeGroup ? ' active' : ''}" data-group="${g.id}">
        <span>${g.label}</span>${badge ? `<span class="sidebar-badge">${badge}</span>` : ''}
      </button>`;
    })
    .join('');
  groupNavEl.querySelectorAll('.sidebar-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => setActiveGroup(btn.dataset.group));
  });
}

// Chaque panneau du HTML porte data-group="<id>" ; on ne montre que ceux du
// groupe actif, en respectant en plus les règles existantes
// championship-only / slots-only (elles-mêmes dépendantes de l'onglet de
// site actif — un panneau championnat reste caché sous l'onglet BasketLibre
// même si son groupe est sélectionné, par exemple).
function applyPanelVisibility() {
  const champOk = adminHasChampionship() && (activeSite === 'all' || activeSite === 'gravity-basketball');
  const slotsSites = adminSlotsSites();
  const slotsOk = slotsSites.length > 0 && (activeSite === 'all' || SLOTS_SITES.includes(activeSite));
  document.querySelectorAll('[data-group]').forEach((el) => {
    let visible = el.dataset.group === activeGroup;
    if (el.classList.contains('championship-only')) visible = visible && champOk;
    if (el.classList.contains('slots-only')) visible = visible && slotsOk;
    el.hidden = !visible;
  });
}

function setActiveGroup(id) {
  activeGroup = id;
  const group = GROUPS.find((g) => g.id === id);
  // Évite d'atterrir sur un groupe championnat/disponibilités avec un onglet
  // de site incompatible, ce qui afficherait une page vide sans explication.
  if (group?.champOnly && activeSite !== 'all' && activeSite !== 'gravity-basketball') {
    activeSite = 'all';
    renderSiteTabs();
  } else if (group?.slotsOnly && activeSite !== 'all' && !SLOTS_SITES.includes(activeSite)) {
    activeSite = 'all';
    renderSiteTabs();
  }
  if (id === 'accueil') renderHome();
  renderSidebar();
  applyPanelVisibility();
  closeSidebarMobile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function toggleSidebarMobile() {
  sidebarEl?.classList.toggle('open');
  sidebarBackdropEl?.classList.toggle('show');
}
function closeSidebarMobile() {
  sidebarEl?.classList.remove('open');
  sidebarBackdropEl?.classList.remove('show');
}
hamburgerBtn?.addEventListener('click', toggleSidebarMobile);
sidebarBackdropEl?.addEventListener('click', closeSidebarMobile);

// ---------- Accueil : vue d'ensemble ----------
// Ignore volontairement le filtre d'onglet de site (activeSite) : l'idée
// est un coup d'œil global sur tout ce que cet admin gère, peu importe
// l'onglet sélectionné ailleurs dans le dashboard.
function renderHome() {
  if (!homeGridEl) return;
  const champOk = adminHasChampionship();
  const slotsOk = adminSlotsSites().length > 0;
  const cards = [];

  const bookingsNouveaux = allBookings.filter((r) => r.status === 'nouveau').length;
  cards.push({
    group: 'reservations',
    num: allBookings.length,
    label: `Réservations / inscriptions${bookingsNouveaux ? ` — ${bookingsNouveaux} nouvelle(s)` : ''}`,
  });

  const pendingReviews = allReviews.filter((r) => !r.approved).length;
  cards.push({ group: 'avis', num: pendingReviews, label: 'Avis en attente de modération' });

  if (slotsOk) {
    const today = new Date().toISOString().slice(0, 10);
    const openSlots = allSlots.filter((s) => s.status === 'open' && s.slot_date >= today && !s.booking_blocked);
    cards.push({ group: 'disponibilites', num: openSlots.length, label: 'Créneaux ouverts à venir' });
  }

  cards.push({
    group: 'partenaires',
    num: allPartners.filter((p) => p.active).length,
    label: 'Partenaires actifs',
  });

  if (champOk) {
    const recrutementPending =
      allReferees.filter((r) => r.status === 'nouveau').length +
      allCoachApplications.filter((r) => r.status === 'nouveau').length;
    cards.push({ group: 'recrutement', num: recrutementPending, label: 'Candidatures arbitres/coachs en attente' });

    const partnershipPending = allPartnershipApplications.filter((r) => r.status === 'nouveau').length;
    cards.push({ group: 'partenariats', num: partnershipPending, label: 'Demandes de partenariat en attente' });
  }

  homeGridEl.innerHTML = cards
    .map(
      (c) => `
    <button type="button" class="home-card" data-group="${c.group}">
      <div class="num">${c.num}</div>
      <div class="label">${c.label}</div>
    </button>`
    )
    .join('');
  homeGridEl.querySelectorAll('.home-card').forEach((btn) => {
    btn.addEventListener('click', () => setActiveGroup(btn.dataset.group));
  });
}

// Restaure la session si déjà connecté (refresh de page)
supabase.auth.getSession().then(({ data }) => {
  if (data.session) afterLogin(data.session.user);
});

// ---------- Onglets de site ----------
function renderSiteTabs() {
  const sites = ['all', ...currentAdmin.sites];
  siteTabsEl.innerHTML = sites
    .map((s) => {
      const label = s === 'all' ? 'Tous les sites' : SITE_LABELS[s] || s;
      return `<button class="tab-btn${s === activeSite ? ' active' : ''}" data-site="${s}">${label}</button>`;
    })
    .join('');
  siteTabsEl.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSite = btn.dataset.site;
      renderSiteTabs();
      updateBookingsTypeOptions();
      renderBookings();
      renderReviews();
      applyPanelVisibility();
      commSelectedIds.clear();
      updateCommTypeOptions();
      renderCommTable();
      renderProgramsTable();
      renderSlotsTable();
      renderPartnersTable();
      renderInstagramCarouselTable();
    });
  });
}

// ---------- Chargement des données ----------
async function loadAll() {
  const tasks = [loadBookings(), loadReviews(), loadClickStats(), loadPrograms(), loadPartners(), loadInstagramCarousel(), loadPhotoGallery(), loadFinanceEntries()];
  if (currentAdmin.sites.some((s) => SLOTS_SITES.includes(s))) {
    tasks.push(loadSlots(), loadSiteSuspendStatus());
  }
  if (currentAdmin.sites.includes('gravity-basketball')) {
    tasks.push(
      loadChampionshipRegistrations(),
      loadStandings(),
      loadChampionshipPlayers(),
      loadReferees(),
      loadCoachApplications(),
      loadPartnershipApplications(),
      loadTeams(),
      loadTeamPlayers(),
      loadTeamGames(),
      loadTeamTrainings(),
      loadAnnouncements(),
      loadPlayerDocuments()
    );
  }
  await Promise.all(tasks);
  // Re-rendu final : ces tables croisent des données chargées en parallèle
  // (nom d'équipe, nom de joueur) qui peuvent arriver dans n'importe quel ordre.
  renderTeamGamesTable();
  renderTeamTrainingsTable();
  renderAnnouncementsTable();
  renderPlayerDocumentsTable();
  renderPlayerAccountsTable();
  renderSidebar();
  renderHome();
}

async function loadBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .in('site', currentAdmin.sites)
    .order('created_at', { ascending: false })
    .limit(300);
  if (!error) allBookings = data || [];
  updateBookingsTypeOptions();
  renderBookings();
  updateCommTypeOptions();
  renderCommTable();
}

async function loadReviews() {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .in('site', currentAdmin.sites)
    .order('created_at', { ascending: false })
    .limit(300);
  if (!error) allReviews = data || [];
  renderReviews();
}

// ---------- Rendu réservations ----------
function filteredBySite(list) {
  return activeSite === 'all' ? list : list.filter((r) => r.site === activeSite);
}

function updateBookingsTypeOptions() {
  const rows = filteredBySite(allBookings);
  const types = Array.from(new Set(rows.map((r) => r.type).filter(Boolean))).sort();
  const current = bookingsTypeFilterEl.value;
  bookingsTypeFilterEl.innerHTML =
    '<option value="">Tous les programmes</option>' +
    types.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  if (types.includes(current)) bookingsTypeFilterEl.value = current;
}

function getBookingsFilteredRows() {
  let rows = filteredBySite(allBookings);

  const name = bookingsNameFilterEl.value.trim().toLocaleLowerCase('fr-CA');
  if (name) {
    rows = rows.filter((r) => (r.contact_name || '').toLocaleLowerCase('fr-CA').includes(name));
  }

  const type = bookingsTypeFilterEl.value;
  if (type) rows = rows.filter((r) => r.type === type);

  const dateFrom = bookingsDateFromEl.value;
  const dateTo = bookingsDateToEl.value;
  if (dateFrom) rows = rows.filter((r) => r.created_at && r.created_at.slice(0, 10) >= dateFrom);
  if (dateTo) rows = rows.filter((r) => r.created_at && r.created_at.slice(0, 10) <= dateTo);

  return rows;
}

function renderBookings() {
  const rows = getBookingsFilteredRows();

  const total = rows.length;
  const nouveaux = rows.filter((r) => r.status === 'nouveau').length;
  statsRowEl.innerHTML = `
    <div class="stat-card"><div class="num">${total}</div><div class="label">Total</div></div>
    <div class="stat-card"><div class="num">${nouveaux}</div><div class="label">Nouveaux</div></div>
  `;

  bookingsTbody.innerHTML = rows
    .map((r) => {
      const details = r.details ? Object.entries(r.details).map(([k, v]) => `${k}: ${v}`).join(' · ') : '';
      const date = new Date(r.created_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' });
      return `
        <tr>
          <td><span class="site-badge ${r.site}">${SITE_LABELS[r.site] || r.site}</span></td>
          <td>${escapeHtml(r.contact_name || '')}</td>
          <td class="wrap">${escapeHtml(r.contact_email || '')}<br>${escapeHtml(r.contact_phone || '')}
            ${r.contact_email ? `<br><button type="button" class="btn btn-ghost comm-write-btn" data-email="${escapeHtml(r.contact_email)}">✉️ Écrire</button>` : ''}
            ${r.site === 'gravity-basketball' ? `<br><button type="button" class="btn btn-ghost booking-create-player-btn" data-id="${r.id}">Créer la fiche joueur</button>` : ''}
          </td>
          <td>${escapeHtml(r.type || '')}</td>
          <td class="wrap">${escapeHtml(details)}</td>
          <td>
            <select class="status-select" data-id="${r.id}">
              ${['nouveau', 'contacté', 'confirmé', 'annulé', 'archivé']
                .map((s) => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`)
                .join('')}
            </select>
          </td>
          <td>${date}</td>
        </tr>`;
    })
    .join('') ||
    `<tr><td colspan="7" class="empty-note">${
      allBookings.length ? 'Aucune réservation ne correspond aux filtres.' : 'Aucune réservation.'
    }</td></tr>`;

  bookingsTbody.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.id;
      const status = sel.value;
      await supabase.from('bookings').update({ status }).eq('id', id);
      const b = allBookings.find((x) => x.id === id);
      if (b) b.status = status;
    });
  });

  bookingsTbody.querySelectorAll('.comm-write-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const email = btn.dataset.email;
      const subject = commSubjectInput.value.trim() || 'Gravity Basketball';
      const body = commBodyInput.value || '';
      window.open(buildGmailComposeUrl([email], subject, body), '_blank', 'noopener');
    });
  });
  bookingsTbody.querySelectorAll('.booking-create-player-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const booking = allBookings.find((b) => b.id === btn.dataset.id);
      if (!booking) return;
      const details = booking.details || {};
      setActiveGroup('mes-equipes');
      openTeamPlayerForm(null, {
        full_name: booking.contact_name || '',
        age_category: details.age_categorie || '',
        poste: details.poste_de_jeu || '',
        email: booking.contact_email || '',
      });
    });
  });
}

bookingsNameFilterEl.addEventListener('input', renderBookings);
bookingsTypeFilterEl.addEventListener('change', renderBookings);
bookingsDateFromEl.addEventListener('change', renderBookings);
bookingsDateToEl.addEventListener('change', renderBookings);
bookingsFilterResetBtn.addEventListener('click', () => {
  bookingsNameFilterEl.value = '';
  bookingsTypeFilterEl.value = '';
  bookingsDateFromEl.value = '';
  bookingsDateToEl.value = '';
  renderBookings();
});

// ---------- Programmes (Phase B — CRUD dashboard uniquement, les sites
// publics ne lisent PAS encore cette table : leur contenu reste codé en
// dur pour l'instant, voir shared-backend-supabase/programs-schema.sql) ----------
async function loadPrograms() {
  const { data, error } = await supabase
    .from('programs')
    .select('*')
    .in('site', currentAdmin.sites)
    .order('site', { ascending: true })
    .order('display_order', { ascending: true });
  if (!error) allPrograms = data || [];
  renderProgramsTable();
}

function renderProgramsTable() {
  const rows = filteredBySite(allPrograms);
  programsTbody.innerHTML =
    rows
      .map((p) => `
        <tr>
          <td><span class="site-badge ${p.site}">${SITE_LABELS[p.site] || p.site}</span></td>
          <td>${escapeHtml(p.name)}<div class="muted">${escapeHtml(p.slug)}</div></td>
          <td>${p.display_order}</td>
          <td><span class="program-status-pill ${p.active ? 'active' : 'inactive'}">${p.active ? 'Actif' : 'Inactif'}</span></td>
          <td>
            <div class="program-row-actions">
              <button type="button" class="btn btn-ghost program-edit-btn" data-id="${p.id}">Éditer</button>
              <button type="button" class="btn btn-ghost program-toggle-btn" data-id="${p.id}">${p.active ? 'Désactiver' : 'Activer'}</button>
            </div>
          </td>
        </tr>
      `)
      .join('') || '<tr><td colspan="5" class="empty-note">Aucun programme pour ce site — clique "+ Nouveau programme" pour en ajouter un.</td></tr>';

  programsTbody.querySelectorAll('.program-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const program = allPrograms.find((p) => p.id === btn.dataset.id);
      if (program) openProgramForm(program);
    });
  });
  programsTbody.querySelectorAll('.program-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const program = allPrograms.find((p) => p.id === btn.dataset.id);
      if (!program) return;
      btn.disabled = true;
      const { error } = await supabase.from('programs').update({ active: !program.active }).eq('id', program.id);
      if (error) alert('Erreur : ' + error.message);
      await loadPrograms();
    });
  });
}

// ---------- Partenaires (logos affichés sur les sites publics) ----------
async function loadPartners() {
  const { data, error } = await supabase
    .from('partners')
    .select('*')
    .order('display_order', { ascending: true });
  if (!error) allPartners = data || [];
  renderPartnersTable();
}

function partnersFilteredBySite(list) {
  // Un partenaire "Tous les sites" (site === null) reste visible peu
  // importe l'onglet actif — il s'applique partout.
  if (activeSite === 'all') return list;
  return list.filter((p) => p.site === activeSite || p.site === null);
}

function renderPartnersTable() {
  if (!partnersTbody) return;
  const rows = partnersFilteredBySite(allPartners);
  partnersTbody.innerHTML =
    rows
      .map((p) => `
        <tr>
          <td>${p.logo_url ? `<img src="${escapeHtml(p.logo_url)}" alt="${escapeHtml(p.name)}" style="height:32px; width:auto; max-width:80px; object-fit:contain;">` : '—'}</td>
          <td>${escapeHtml(p.name)}</td>
          <td>${p.site ? `<span class="site-badge ${p.site}">${SITE_LABELS[p.site] || p.site}</span>` : '<span class="muted">Tous les sites</span>'}</td>
          <td>${p.display_order}</td>
          <td><span class="program-status-pill ${p.active ? 'active' : 'inactive'}">${p.active ? 'Actif' : 'Inactif'}</span></td>
          <td>
            <div class="program-row-actions">
              <button type="button" class="btn btn-ghost partner-edit-btn" data-id="${p.id}">Éditer</button>
              <button type="button" class="btn btn-ghost partner-toggle-btn" data-id="${p.id}">${p.active ? 'Désactiver' : 'Activer'}</button>
            </div>
          </td>
        </tr>
      `)
      .join('') || '<tr><td colspan="6" class="empty-note">Aucun partenaire pour l\'instant — clique "+ Nouveau partenaire" pour en ajouter un.</td></tr>';

  partnersTbody.querySelectorAll('.partner-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const partner = allPartners.find((p) => p.id === btn.dataset.id);
      if (partner) openPartnerForm(partner);
    });
  });
  partnersTbody.querySelectorAll('.partner-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const partner = allPartners.find((p) => p.id === btn.dataset.id);
      if (!partner) return;
      btn.disabled = true;
      const { error } = await supabase.from('partners').update({ active: !partner.active }).eq('id', partner.id);
      if (error) alert('Erreur : ' + error.message);
      await loadPartners();
    });
  });
}

function openPartnerForm(partner) {
  partnerForm.hidden = false;
  partnerIdInput.value = partner ? partner.id : '';
  partnerSiteSelect.value = partner ? (partner.site || '') : (activeSite !== 'all' ? activeSite : '');
  partnerNameInput.value = partner ? partner.name : '';
  partnerWebsiteInput.value = partner ? (partner.website_url || '') : '';
  partnerOrderInput.value = partner ? partner.display_order : 0;
  partnerActiveCheckbox.checked = partner ? partner.active : true;
  partnerDeleteBtn.hidden = !partner;
  partnerLogoFileInput.value = '';
  partnerLogoPreviewEl.innerHTML = partner?.logo_url
    ? `<img src="${escapeHtml(partner.logo_url)}" alt="" style="height:48px; width:auto; max-width:140px; object-fit:contain;">`
    : '';
  partnerForm.dataset.currentLogoUrl = partner?.logo_url || '';
  partnerForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closePartnerForm() {
  partnerForm.hidden = true;
  partnerForm.reset();
  partnerIdInput.value = '';
  partnerLogoPreviewEl.innerHTML = '';
  partnerForm.dataset.currentLogoUrl = '';
}

partnerNewBtn.addEventListener('click', () => openPartnerForm(null));
partnerCancelBtn.addEventListener('click', () => closePartnerForm());

partnerLogoFileInput.addEventListener('change', () => {
  const file = partnerLogoFileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  partnerLogoPreviewEl.innerHTML = `<img src="${url}" alt="" style="height:48px; width:auto; max-width:140px; object-fit:contain;">`;
});

partnerDeleteBtn.addEventListener('click', async () => {
  const id = partnerIdInput.value;
  if (!id) return;
  if (!confirm('Supprimer définitivement ce partenaire ? Cette action est irréversible.')) return;
  const { error } = await supabase.from('partners').delete().eq('id', id);
  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  closePartnerForm();
  await loadPartners();
});

partnerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = partnerIdInput.value || null;
  const saveBtn = partnerForm.querySelector('button[type="submit"]');
  saveBtn.disabled = true;

  let logoUrl = partnerForm.dataset.currentLogoUrl || null;
  const file = partnerLogoFileInput.files[0];
  if (file) {
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('partner-logos').upload(path, file, { upsert: false });
    if (uploadError) {
      partnerSaveNote.textContent = 'Erreur upload logo : ' + uploadError.message;
      partnerSaveNote.style.color = '#ff6b6b';
      partnerSaveNote.hidden = false;
      saveBtn.disabled = false;
      return;
    }
    logoUrl = supabase.storage.from('partner-logos').getPublicUrl(path).data.publicUrl;
  }

  const payload = {
    site: partnerSiteSelect.value || null,
    name: partnerNameInput.value.trim(),
    logo_url: logoUrl,
    website_url: partnerWebsiteInput.value.trim() || null,
    display_order: parseInt(partnerOrderInput.value, 10) || 0,
    active: partnerActiveCheckbox.checked,
  };

  const { error } = id
    ? await supabase.from('partners').update(payload).eq('id', id)
    : await supabase.from('partners').insert(payload);

  saveBtn.disabled = false;
  if (error) {
    partnerSaveNote.textContent = 'Erreur : ' + error.message;
    partnerSaveNote.style.color = '#ff6b6b';
    partnerSaveNote.hidden = false;
    return;
  }

  partnerSaveNote.textContent = 'Enregistré !';
  partnerSaveNote.style.color = '';
  partnerSaveNote.hidden = false;
  await loadPartners();
  setTimeout(() => {
    closePartnerForm();
    partnerSaveNote.hidden = true;
  }, 1200);
});

// ---------- Mes équipes : équipes (affiche + Zeffy par équipe) ----------
async function loadTeams() {
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('site', 'gravity-basketball')
    .order('display_order', { ascending: true });
  if (!error) allTeams = data || [];
  renderTeamsTable();
  populateTeamPlayerTeamSelect();
  populateTeamGameTeamSelect();
  populateTeamTrainingTeamSelect();
  populateAnnouncementTeamSelect();
  renderTeamGamesTable();
  renderTeamTrainingsTable();
  renderAnnouncementsTable();
}

function renderTeamsTable() {
  if (!teamsTbody) return;
  teamsTbody.innerHTML =
    allTeams
      .map((t) => `
        <tr>
          <td>${escapeHtml(t.categorie)}</td>
          <td>${escapeHtml(t.genre)}</td>
          <td>${escapeHtml(t.nom_equipe)}</td>
          <td>${t.affiche_url ? `<img src="${escapeHtml(t.affiche_url)}" alt="" style="height:32px; width:auto; max-width:80px; object-fit:contain;">` : '<span class="muted">—</span>'}</td>
          <td>${t.zeffy_url ? '<span class="program-status-pill active">Propre</span>' : '<span class="muted">Lien global</span>'}</td>
          <td>${t.display_order}</td>
          <td><span class="program-status-pill ${t.active ? 'active' : 'inactive'}">${t.active ? 'Actif' : 'Inactif'}</span></td>
          <td>
            <div class="program-row-actions">
              <button type="button" class="btn btn-ghost team-edit-btn" data-id="${t.id}">Éditer</button>
              <button type="button" class="btn btn-ghost team-toggle-btn" data-id="${t.id}">${t.active ? 'Désactiver' : 'Activer'}</button>
            </div>
          </td>
        </tr>
      `)
      .join('') || '<tr><td colspan="8" class="empty-note">Aucune équipe trouvée.</td></tr>';

  teamsTbody.querySelectorAll('.team-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const team = allTeams.find((t) => t.id === btn.dataset.id);
      if (team) openTeamForm(team);
    });
  });
  teamsTbody.querySelectorAll('.team-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const team = allTeams.find((t) => t.id === btn.dataset.id);
      if (!team) return;
      btn.disabled = true;
      const { error } = await supabase.from('teams').update({ active: !team.active }).eq('id', team.id);
      if (error) alert('Erreur : ' + error.message);
      await loadTeams();
    });
  });
}

function openTeamForm(team) {
  teamForm.hidden = false;
  teamIdInput.value = team.id;
  teamFormTitle.textContent = `${team.categorie} — ${team.genre} (${team.nom_equipe})`;
  teamDescriptionInput.value = team.description || '';
  teamZeffyInput.value = team.zeffy_url || '';
  teamOrderInput.value = team.display_order;
  teamActiveCheckbox.checked = team.active;
  teamAfficheFileInput.value = '';
  teamAffichePreviewEl.innerHTML = team.affiche_url
    ? `<img src="${escapeHtml(team.affiche_url)}" alt="" style="height:60px; width:auto; max-width:160px; object-fit:contain;">`
    : '';
  teamForm.dataset.currentAfficheUrl = team.affiche_url || '';
  teamForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeTeamForm() {
  teamForm.hidden = true;
  teamForm.reset();
  teamIdInput.value = '';
  teamAffichePreviewEl.innerHTML = '';
  teamForm.dataset.currentAfficheUrl = '';
}

teamCancelBtn?.addEventListener('click', () => closeTeamForm());

teamAfficheFileInput?.addEventListener('change', () => {
  const file = teamAfficheFileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  teamAffichePreviewEl.innerHTML = `<img src="${url}" alt="" style="height:60px; width:auto; max-width:160px; object-fit:contain;">`;
});

teamForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = teamIdInput.value;
  if (!id) return;
  const saveBtn = teamForm.querySelector('button[type="submit"]');
  saveBtn.disabled = true;

  let afficheUrl = teamForm.dataset.currentAfficheUrl || null;
  const file = teamAfficheFileInput.files[0];
  if (file) {
    const path = `affiches/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('equipes').upload(path, file, { upsert: false });
    if (uploadError) {
      teamSaveNote.textContent = 'Erreur upload affiche : ' + uploadError.message;
      teamSaveNote.style.color = '#ff6b6b';
      teamSaveNote.hidden = false;
      saveBtn.disabled = false;
      return;
    }
    afficheUrl = supabase.storage.from('equipes').getPublicUrl(path).data.publicUrl;
  }

  const payload = {
    affiche_url: afficheUrl,
    description: teamDescriptionInput.value.trim() || null,
    zeffy_url: teamZeffyInput.value.trim() || null,
    display_order: parseInt(teamOrderInput.value, 10) || 0,
    active: teamActiveCheckbox.checked,
  };

  const { error } = await supabase.from('teams').update(payload).eq('id', id);

  saveBtn.disabled = false;
  if (error) {
    teamSaveNote.textContent = 'Erreur : ' + error.message;
    teamSaveNote.style.color = '#ff6b6b';
    teamSaveNote.hidden = false;
    return;
  }

  teamSaveNote.textContent = 'Enregistré !';
  teamSaveNote.style.color = '';
  teamSaveNote.hidden = false;
  await loadTeams();
  setTimeout(() => {
    closeTeamForm();
    teamSaveNote.hidden = true;
  }, 1200);
});

// ---------- Mes équipes : joueurs (photo + stats de saison par équipe) ----------
function teamLabel(teamId) {
  const t = allTeams.find((x) => x.id === teamId);
  return t ? `${t.categorie} — ${t.genre}` : '—';
}

function populateTeamPlayerTeamSelect() {
  if (!teamPlayerTeamSelect) return;
  const current = teamPlayerTeamSelect.value;
  teamPlayerTeamSelect.innerHTML = allTeams
    .map((t) => `<option value="${t.id}">${escapeHtml(t.categorie)} — ${escapeHtml(t.genre)} (${escapeHtml(t.nom_equipe)})</option>`)
    .join('');
  if (current) teamPlayerTeamSelect.value = current;
}

async function loadTeamPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('site', 'gravity-basketball')
    .eq('program', 'equipe')
    .order('display_order', { ascending: true });
  if (!error) allTeamPlayers = data || [];
  renderTeamPlayersTable();
  renderPlayerAccountsTable();
  populatePlayerDocumentPlayerSelect();
  renderPlayerDocumentsTable();
}

function renderTeamPlayersTable() {
  if (!teamPlayersTbody) return;
  teamPlayersTbody.innerHTML =
    allTeamPlayers
      .map((p) => `
        <tr>
          <td>${p.photo_url ? `<img src="${escapeHtml(p.photo_url)}" alt="" style="height:32px; width:32px; border-radius:50%; object-fit:cover;">` : '<span class="muted">—</span>'}</td>
          <td>${escapeHtml(p.full_name)}</td>
          <td>${escapeHtml(teamLabel(p.team_id))}</td>
          <td>${p.numero ? escapeHtml(p.numero) : '—'}</td>
          <td>${p.poste ? escapeHtml(p.poste) : '—'}</td>
          <td>${p.age_category ? escapeHtml(p.age_category) : '—'}</td>
          <td>${p.saison_points ?? 0} / ${p.saison_rebonds ?? 0} / ${p.saison_passes ?? 0} / ${p.saison_matchs ?? 0}</td>
          <td><span class="program-status-pill ${p.active ? 'active' : 'inactive'}">${p.active ? 'Actif' : 'Inactif'}</span></td>
          <td>
            <div class="program-row-actions">
              <button type="button" class="btn btn-ghost team-player-edit-btn" data-id="${p.id}">Éditer</button>
              <button type="button" class="btn btn-ghost team-player-toggle-btn" data-id="${p.id}">${p.active ? 'Désactiver' : 'Activer'}</button>
              <button type="button" class="btn btn-ghost team-player-share-btn" data-id="${p.id}">Partager la fiche</button>
            </div>
          </td>
        </tr>
      `)
      .join('') || '<tr><td colspan="9" class="empty-note">Aucun joueur pour l\'instant — clique "+ Nouveau joueur" pour en ajouter un.</td></tr>';

  teamPlayersTbody.querySelectorAll('.team-player-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const player = allTeamPlayers.find((p) => p.id === btn.dataset.id);
      if (player) openTeamPlayerForm(player);
    });
  });
  teamPlayersTbody.querySelectorAll('.team-player-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const player = allTeamPlayers.find((p) => p.id === btn.dataset.id);
      if (!player) return;
      btn.disabled = true;
      const { error } = await supabase.from('players').update({ active: !player.active }).eq('id', player.id);
      if (error) alert('Erreur : ' + error.message);
      await loadTeamPlayers();
    });
  });
  teamPlayersTbody.querySelectorAll('.team-player-share-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const player = allTeamPlayers.find((p) => p.id === btn.dataset.id);
      if (player) sharePlayerCard(player, btn);
    });
  });
}

// player: ligne de la table players. prefill (optionnel, uniquement pour un
// nouveau joueur) : { full_name, age_category, poste, email } — permet de
// créer la fiche joueur en un clic à partir d'une réservation, sans que
// personne n'ait à retaper l'information déjà fournie par le joueur/parent
// dans le formulaire d'inscription public (un seul formulaire pour tout).
function openTeamPlayerForm(player, prefill) {
  populateTeamPlayerTeamSelect();
  teamPlayerForm.hidden = false;
  teamPlayerIdInput.value = player ? player.id : '';
  teamPlayerTeamSelect.value = player ? player.team_id : (allTeams[0]?.id || '');
  teamPlayerNameInput.value = player ? player.full_name : (prefill?.full_name || '');
  teamPlayerNumeroInput.value = player ? (player.numero || '') : '';
  teamPlayerPosteInput.value = player ? (player.poste || '') : (prefill?.poste || '');
  teamPlayerAgeInput.value = player ? (player.age_category || '') : (prefill?.age_category || '');
  teamPlayerInstagramInput.value = player ? (player.instagram_url || '') : '';
  teamPlayerEmailInput.value = player ? (player.email || '') : (prefill?.email || '');
  teamPlayerPointsInput.value = player ? (player.saison_points ?? 0) : 0;
  teamPlayerReboundsInput.value = player ? (player.saison_rebonds ?? 0) : 0;
  teamPlayerAssistsInput.value = player ? (player.saison_passes ?? 0) : 0;
  teamPlayerGamesInput.value = player ? (player.saison_matchs ?? 0) : 0;
  teamPlayerOrderInput.value = player ? player.display_order : 0;
  teamPlayerActiveCheckbox.checked = player ? player.active : true;
  teamPlayerDeleteBtn.hidden = !player;
  teamPlayerPhotoFileInput.value = '';
  teamPlayerPhotoPreviewEl.innerHTML = player?.photo_url
    ? `<img src="${escapeHtml(player.photo_url)}" alt="" style="height:60px; width:60px; border-radius:50%; object-fit:cover;">`
    : '';
  teamPlayerForm.dataset.currentPhotoUrl = player?.photo_url || '';
  teamPlayerForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeTeamPlayerForm() {
  teamPlayerForm.hidden = true;
  teamPlayerForm.reset();
  teamPlayerIdInput.value = '';
  teamPlayerPhotoPreviewEl.innerHTML = '';
  teamPlayerForm.dataset.currentPhotoUrl = '';
}

teamPlayerNewBtn?.addEventListener('click', () => openTeamPlayerForm(null));
teamPlayerCancelBtn?.addEventListener('click', () => closeTeamPlayerForm());

teamPlayerPhotoFileInput?.addEventListener('change', () => {
  const file = teamPlayerPhotoFileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  teamPlayerPhotoPreviewEl.innerHTML = `<img src="${url}" alt="" style="height:60px; width:60px; border-radius:50%; object-fit:cover;">`;
});

teamPlayerDeleteBtn?.addEventListener('click', async () => {
  const id = teamPlayerIdInput.value;
  if (!id) return;
  if (!confirm('Supprimer définitivement ce joueur ? Cette action est irréversible.')) return;
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  closeTeamPlayerForm();
  await loadTeamPlayers();
});

teamPlayerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = teamPlayerIdInput.value || null;
  const existingPlayer = id ? allTeamPlayers.find((p) => p.id === id) : null;
  const saveBtn = teamPlayerForm.querySelector('button[type="submit"]');
  saveBtn.disabled = true;

  let photoUrl = teamPlayerForm.dataset.currentPhotoUrl || null;
  const file = teamPlayerPhotoFileInput.files[0];
  if (file) {
    const path = `joueurs/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('equipes').upload(path, file, { upsert: false });
    if (uploadError) {
      teamPlayerSaveNote.textContent = 'Erreur upload photo : ' + uploadError.message;
      teamPlayerSaveNote.style.color = '#ff6b6b';
      teamPlayerSaveNote.hidden = false;
      saveBtn.disabled = false;
      return;
    }
    photoUrl = supabase.storage.from('equipes').getPublicUrl(path).data.publicUrl;
  }

  const payload = {
    site: 'gravity-basketball',
    program: 'equipe',
    team_id: teamPlayerTeamSelect.value,
    full_name: teamPlayerNameInput.value.trim(),
    numero: teamPlayerNumeroInput.value.trim() || null,
    poste: teamPlayerPosteInput.value.trim() || null,
    age_category: teamPlayerAgeInput.value.trim() || null,
    photo_url: photoUrl,
    instagram_url: teamPlayerInstagramInput.value.trim() || null,
    email: teamPlayerEmailInput.value.trim() || null,
    saison_points: parseInt(teamPlayerPointsInput.value, 10) || 0,
    saison_rebonds: parseInt(teamPlayerReboundsInput.value, 10) || 0,
    saison_passes: parseInt(teamPlayerAssistsInput.value, 10) || 0,
    saison_matchs: parseInt(teamPlayerGamesInput.value, 10) || 0,
    display_order: parseInt(teamPlayerOrderInput.value, 10) || 0,
    active: teamPlayerActiveCheckbox.checked,
  };

  const { error } = id
    ? await supabase.from('players').update(payload).eq('id', id)
    : await supabase.from('players').insert(payload);

  saveBtn.disabled = false;
  if (error) {
    teamPlayerSaveNote.textContent = 'Erreur : ' + error.message;
    teamPlayerSaveNote.style.color = '#ff6b6b';
    teamPlayerSaveNote.hidden = false;
    return;
  }

  teamPlayerSaveNote.textContent = 'Enregistré !';
  teamPlayerSaveNote.style.color = '';
  teamPlayerSaveNote.hidden = false;
  if (existingPlayer && existingPlayer.auth_user_id) {
    notifyEspaceJoueurs({ kind: 'stat', action: 'updated', site: 'gravity-basketball', player_id: id });
  }
  await loadTeamPlayers();
  setTimeout(() => {
    closeTeamPlayerForm();
    teamPlayerSaveNote.hidden = true;
  }, 1200);
});

// ---------- Fiche joueur partageable (image générée, même principe que la
// génération "Partage Instagram" du site public gravity-basketball-mtl) ----------
const SHARE_LOGO_URL = 'https://gravity.osmm-mtl.site/assets/logo.png';

function shareLoadImage(src, crossOrigin) {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function shareDrawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shareInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';
}

function shareSlugify(str) {
  const noAccents = String(str || 'joueur')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return noAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'joueur';
}

async function buildPlayerCardImage(player, teamName) {
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

  // Fond sombre + lavis diagonal orange -> magenta (même diagonale que
  // --gradient-brand sur le site), pour que la fiche partage le même signal
  // visuel que l'Espace Joueurs plutôt qu'un simple halo orange.
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);
  const wash = ctx.createLinearGradient(0, 0, W, H);
  wash.addColorStop(0, 'rgba(232,103,46,0.22)');
  wash.addColorStop(0.55, 'rgba(232,103,46,0.05)');
  wash.addColorStop(1, 'rgba(216,30,91,0.16)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, H);

  const pad = 60;
  shareDrawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 36);
  ctx.fillStyle = '#171717';
  ctx.fill();
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Liseré de marque en haut de la carte (écho du bandeau dégradé utilisé
  // partout sur le site : profil Espace Joueurs, tuiles de stats, onglets).
  ctx.save();
  shareDrawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 36);
  ctx.clip();
  const topBar = ctx.createLinearGradient(pad, 0, W - pad, 0);
  topBar.addColorStop(0, '#e8672e');
  topBar.addColorStop(1, '#d81e5b');
  ctx.fillStyle = topBar;
  ctx.fillRect(pad, pad, W - pad * 2, 6);
  ctx.restore();

  const logo = await shareLoadImage(SHARE_LOGO_URL, true);
  if (logo) {
    const logoH = 64;
    const logoW = logoH * (logo.width / logo.height);
    ctx.drawImage(logo, pad + 40, pad + 54, logoW, logoH);
  }
  ctx.fillStyle = '#a8a8a8';
  ctx.font = '600 24px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('GRAVITY BASKETBALL', W - pad - 40, pad + 78);
  ctx.fillStyle = '#6f6f6f';
  ctx.font = '600 18px Inter, sans-serif';
  ctx.fillText('FICHE JOUEUR', W - pad - 40, pad + 104);

  const photoCx = W / 2;
  const photoCy = pad + 300;
  const photoR = 190;
  const photoImg = player.photo_url ? await shareLoadImage(player.photo_url, true) : null;

  // Anneau à deux tons (orange -> magenta) autour de la photo — même duo que
  // le halo --glow-orange / --glow-magenta utilisé sur l'avatar web.
  const ringGrad = ctx.createLinearGradient(photoCx - photoR, photoCy - photoR, photoCx + photoR, photoCy + photoR);
  ringGrad.addColorStop(0, '#e8672e');
  ringGrad.addColorStop(1, '#d81e5b');
  ctx.save();
  ctx.shadowColor = 'rgba(232,103,46,0.45)';
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(photoCx, photoCy, photoR + 8, 0, Math.PI * 2);
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(photoCx, photoCy, photoR, 0, Math.PI * 2);
  ctx.closePath();
  if (photoImg) {
    ctx.clip();
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
    ctx.fillText(shareInitials(player.full_name), photoCx, photoCy + 10);
  }
  ctx.restore();

  // Nom du joueur en dégradé de marque plutôt qu'en blanc plat — même
  // traitement que le titre du site (--gradient-brand-text).
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const nameText = (player.full_name || '').toUpperCase();
  ctx.font = '700 60px Oswald, sans-serif';
  const nameWidth = ctx.measureText(nameText).width;
  const nameGrad = ctx.createLinearGradient(W / 2 - nameWidth / 2, 0, W / 2 + nameWidth / 2, 0);
  nameGrad.addColorStop(0, '#ff8a4c');
  nameGrad.addColorStop(1, '#f0425f');
  ctx.fillStyle = nameGrad;
  ctx.fillText(nameText, W / 2, photoCy + photoR + 90);

  // Métadonnées en pastilles (équipe / poste / numéro / catégorie) plutôt
  // qu'une ligne de texte séparée par des points — même langage que les
  // pastilles ".ej-pill" de l'Espace Joueurs.
  const metaParts = [
    teamName || '',
    player.poste || '',
    player.numero ? '#' + player.numero : '',
    player.age_category || '',
  ].filter(Boolean);
  if (metaParts.length) {
    const pillFont = '600 26px Inter, sans-serif';
    ctx.font = pillFont;
    const pillPadX = 22;
    const pillGap = 14;
    const pillH = 44;
    const widths = metaParts.map((p) => ctx.measureText(p).width + pillPadX * 2);
    const totalW = widths.reduce((a, b) => a + b, 0) + pillGap * (metaParts.length - 1);
    let cx = W / 2 - totalW / 2;
    const pillY = photoCy + photoR + 120;
    metaParts.forEach((text, i) => {
      const w = widths[i];
      shareDrawRoundedRect(ctx, cx, pillY, w, pillH, pillH / 2);
      ctx.fillStyle = 'rgba(232,103,46,0.16)';
      ctx.fill();
      ctx.fillStyle = '#ff8a4c';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = pillFont;
      ctx.fillText(text, cx + w / 2, pillY + pillH / 2 + 1);
      cx += w + pillGap;
    });
    ctx.textBaseline = 'alphabetic';
  }

  // Statistiques — colonnes séparées par un filet vertical fin, valeur en
  // dégradé de marque et libellé en casse de titre (jamais tout en capitales,
  // plus lisible et cohérent avec le reste de la fiche).
  const stats = [
    ['Points', player.saison_points ?? 0],
    ['Rebonds', player.saison_rebonds ?? 0],
    ['Passes', player.saison_passes ?? 0],
    ['Matchs', player.saison_matchs ?? 0],
  ];
  const statsY = photoCy + photoR + 250;
  const statsW = W - pad * 2 - 80;
  const boxW = statsW / stats.length;
  const statsTop = statsY - 56;
  const statsBottom = statsY + 30;
  stats.forEach(([label, value], i) => {
    const cx = pad + 40 + boxW * i + boxW / 2;
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad + 40 + boxW * i, statsTop);
      ctx.lineTo(pad + 40 + boxW * i, statsBottom);
      ctx.stroke();
    }
    const valueText = String(value);
    ctx.font = '700 56px Oswald, sans-serif';
    const valueWidth = ctx.measureText(valueText).width;
    const valueGrad = ctx.createLinearGradient(cx - valueWidth / 2, 0, cx + valueWidth / 2, 0);
    valueGrad.addColorStop(0, '#f5f5f5');
    valueGrad.addColorStop(1, '#ffe4d6');
    ctx.textAlign = 'center';
    ctx.fillStyle = valueGrad;
    ctx.fillText(valueText, cx, statsY);
    ctx.fillStyle = '#a8a8a8';
    ctx.font = '600 23px Inter, sans-serif';
    ctx.fillText(label, cx, statsY + 38);
  });

  // Liseré de marque en bas de la carte, en écho à celui du haut.
  ctx.save();
  shareDrawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 36);
  ctx.clip();
  const bottomBar = ctx.createLinearGradient(pad, 0, W - pad, 0);
  bottomBar.addColorStop(0, '#d81e5b');
  bottomBar.addColorStop(1, '#e8672e');
  ctx.fillStyle = bottomBar;
  ctx.fillRect(pad, H - pad - 6, W - pad * 2, 6);
  ctx.restore();

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
}

async function sharePlayerCard(player, btn) {
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Génération...';
  try {
    const blob = await buildPlayerCardImage(player, teamLabel(player.team_id));
    if (!blob) throw new Error('canvas vide');
    const file = new File([blob], `gravity-${shareSlugify(player.full_name)}.png`, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: player.full_name, text: `${player.full_name} — Gravity Basketball` });
    } else {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return; // partage annulé par l'utilisateur
    console.error('Fiche joueur — échec génération image', err);
    alert("Impossible de générer la fiche pour le moment. Réessaie plus tard.");
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}

// ---------- Espace Joueurs : comptes joueurs ----------
function renderPlayerAccountsTable() {
  if (!playerAccountsTbody) return;
  playerAccountsTbody.innerHTML =
    allTeamPlayers
      .map((p) => `
        <tr>
          <td>${escapeHtml(p.full_name)}</td>
          <td>${escapeHtml(teamLabel(p.team_id))}</td>
          <td>${p.email ? escapeHtml(p.email) : '<span class="muted">—</span>'}</td>
          <td><span class="program-status-pill ${p.auth_user_id ? 'active' : 'inactive'}">${p.auth_user_id ? 'Accès créé' : 'Aucun accès'}</span></td>
          <td>
            ${p.auth_user_id
              ? ''
              : `<button type="button" class="btn btn-ghost player-account-create-btn" data-id="${p.id}">Créer un accès</button>`}
          </td>
        </tr>
      `)
      .join('') || '<tr><td colspan="5" class="empty-note">Aucun joueur pour l\'instant — ajoute-en un dans "Mes équipes — Joueurs".</td></tr>';

  playerAccountsTbody.querySelectorAll('.player-account-create-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const player = allTeamPlayers.find((p) => p.id === btn.dataset.id);
      if (player) createPlayerAccount(player, btn);
    });
  });
}

async function createPlayerAccount(player, btn) {
  const email = (player.email || window.prompt(`Courriel du joueur "${player.full_name}" pour son accès Espace Joueurs :`, '') || '').trim();
  if (!email) return;

  btn.disabled = true;
  btn.textContent = 'Création...';
  try {
    const { data } = await supabase.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (!token) throw new Error('Session expirée, reconnecte-toi.');

    const res = await fetch('/.netlify/functions/create-player-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ player_id: player.id, email }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Échec de la création du compte');

    alert(
      result.email_sent
        ? `Accès créé pour ${player.full_name}.\n\nUn courriel avec ses identifiants (${result.email}) vient de lui être envoyé automatiquement.\n\n` +
          `Au cas où il ne le reçoit pas (vérifie les Spam) — mot de passe temporaire : ${result.password}`
        : `Accès créé pour ${player.full_name}, mais l'envoi automatique du courriel a échoué.\n\nCourriel : ${result.email}\nMot de passe temporaire : ${result.password}\n\n` +
          `Communique ces informations au joueur toi-même — il pourra se connecter sur gravity.osmm-mtl.site (Espace Joueurs) et changer son mot de passe une fois connecté.`
    );
    await loadTeamPlayers();
  } catch (err) {
    alert('Erreur : ' + err.message);
    btn.disabled = false;
    btn.textContent = 'Créer un accès';
  }
}

// Avertit par courriel les joueurs concernés (Espace Joueurs) d'un ajout ou
// d'une modification — fire-and-forget, ne bloque jamais la sauvegarde.
async function notifyEspaceJoueurs(payload) {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (!token) return;
    await fetch('/.netlify/functions/notify-espace-joueurs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('notifyEspaceJoueurs', err);
  }
}

// ---------- Espace Joueurs : documents ----------
function populatePlayerDocumentPlayerSelect() {
  if (!playerDocumentPlayerSelect) return;
  const current = playerDocumentPlayerSelect.value;
  playerDocumentPlayerSelect.innerHTML = allTeamPlayers
    .map((p) => `<option value="${p.id}">${escapeHtml(p.full_name)} — ${escapeHtml(teamLabel(p.team_id))}</option>`)
    .join('');
  if (current) playerDocumentPlayerSelect.value = current;
}

async function loadPlayerDocuments() {
  const { data, error } = await supabase
    .from('player_documents')
    .select('*')
    .eq('site', 'gravity-basketball')
    .order('created_at', { ascending: false });
  if (!error) allPlayerDocuments = data || [];
  renderPlayerDocumentsTable();
}

function playerNameForDocument(playerId) {
  const p = allTeamPlayers.find((x) => x.id === playerId);
  return p ? p.full_name : '—';
}

function renderPlayerDocumentsTable() {
  if (!playerDocumentsTbody) return;
  const CATEGORIES = { contrat: 'Contrat / inscription', medical: 'Médical', autre: 'Autre' };
  playerDocumentsTbody.innerHTML =
    allPlayerDocuments
      .map((doc) => `
        <tr>
          <td>${escapeHtml(playerNameForDocument(doc.player_id))}</td>
          <td>${escapeHtml(doc.titre)}</td>
          <td>${doc.categorie ? escapeHtml(CATEGORIES[doc.categorie] || doc.categorie) : '<span class="muted">—</span>'}</td>
          <td>${new Date(doc.created_at).toLocaleDateString('fr-CA')}</td>
          <td>
            <div class="program-row-actions">
              <button type="button" class="btn btn-ghost player-document-edit-btn" data-id="${doc.id}">Éditer</button>
              <button type="button" class="btn btn-ghost player-document-delete-btn" data-id="${doc.id}">Supprimer</button>
            </div>
          </td>
        </tr>
      `)
      .join('') || '<tr><td colspan="5" class="empty-note">Aucun document pour l\'instant.</td></tr>';

  playerDocumentsTbody.querySelectorAll('.player-document-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const doc = allPlayerDocuments.find((d) => d.id === btn.dataset.id);
      if (doc) openPlayerDocumentForm(doc);
    });
  });

  playerDocumentsTbody.querySelectorAll('.player-document-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer définitivement ce document ?')) return;
      const doc = allPlayerDocuments.find((d) => d.id === btn.dataset.id);
      btn.disabled = true;
      const { error } = await supabase.from('player_documents').delete().eq('id', btn.dataset.id);
      if (error) {
        alert('Erreur : ' + error.message);
        btn.disabled = false;
        return;
      }
      if (doc) await supabase.storage.from('player-documents').remove([doc.file_path]);
      await loadPlayerDocuments();
    });
  });
}

// doc: optionnel — ligne de player_documents à éditer. Sans argument, ouvre
// le formulaire vide pour un nouvel ajout (multi-fichiers).
function openPlayerDocumentForm(doc) {
  populatePlayerDocumentPlayerSelect();
  playerDocumentForm.reset();
  playerDocumentIdInput.value = doc ? doc.id : '';
  playerDocumentForm.hidden = false;

  if (doc) {
    playerDocumentPlayerSelect.value = doc.player_id;
    playerDocumentTitreInput.value = doc.titre || '';
    playerDocumentCategorieSelect.value = doc.categorie || '';
    playerDocumentFileInput.multiple = false;
    playerDocumentFileLabel.textContent = 'Remplacer le fichier (optionnel)';
    playerDocumentTitreHint.textContent = 'Laisse vide pour garder le titre actuel.';
    playerDocumentSubmitBtn.textContent = 'Enregistrer les modifications';
  } else {
    playerDocumentFileInput.multiple = true;
    playerDocumentFileLabel.textContent = 'Fichiers (PDF, image... — plusieurs à la fois possible)';
    playerDocumentTitreHint.textContent = 'Si tu téléverses plusieurs fichiers à la fois, laisse vide pour utiliser le nom de chaque fichier comme titre.';
    playerDocumentSubmitBtn.textContent = 'Téléverser';
  }
  playerDocumentForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closePlayerDocumentForm() {
  playerDocumentForm.hidden = true;
  playerDocumentForm.reset();
  playerDocumentIdInput.value = '';
}

playerDocumentNewBtn?.addEventListener('click', () => openPlayerDocumentForm(null));
playerDocumentCancelBtn?.addEventListener('click', () => closePlayerDocumentForm());

function playerDocumentDefaultTitre(file) {
  return file.name.replace(/\.[^.]+$/, '');
}

playerDocumentForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = playerDocumentIdInput.value || null;
  const playerId = playerDocumentPlayerSelect.value;
  const files = Array.from(playerDocumentFileInput.files || []);
  if (!playerId) return;
  if (!editId && !files.length) return;
  const saveBtn = playerDocumentSubmitBtn;
  saveBtn.disabled = true;

  const titreInput = playerDocumentTitreInput.value.trim();
  const categorie = playerDocumentCategorieSelect.value || null;

  if (editId) {
    const existing = allPlayerDocuments.find((d) => d.id === editId);
    const newFile = files[0] || null;
    let filePath = existing ? existing.file_path : null;

    if (newFile) {
      const path = `${playerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${newFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: uploadErr } = await supabase.storage.from('player-documents').upload(path, newFile, { upsert: false });
      if (uploadErr) {
        saveBtn.disabled = false;
        playerDocumentSaveNote.textContent = 'Erreur upload : ' + uploadErr.message;
        playerDocumentSaveNote.style.color = '#ff6b6b';
        playerDocumentSaveNote.hidden = false;
        return;
      }
      filePath = path;
    }

    const titre = titreInput || (newFile ? playerDocumentDefaultTitre(newFile) : (existing ? existing.titre : ''));
    const { error } = await supabase.from('player_documents').update({
      player_id: playerId,
      titre,
      categorie,
      file_path: filePath,
    }).eq('id', editId);

    saveBtn.disabled = false;
    if (error) {
      playerDocumentSaveNote.textContent = 'Erreur : ' + error.message;
      playerDocumentSaveNote.style.color = '#ff6b6b';
      playerDocumentSaveNote.hidden = false;
      return;
    }

    if (newFile && existing && existing.file_path && existing.file_path !== filePath) {
      await supabase.storage.from('player-documents').remove([existing.file_path]);
    }

    playerDocumentSaveNote.textContent = 'Enregistré !';
    playerDocumentSaveNote.style.color = '';
    playerDocumentSaveNote.hidden = false;
    notifyEspaceJoueurs({
      kind: 'document',
      action: 'updated',
      site: 'gravity-basketball',
      player_id: playerId,
      details: { titre, count: 1 },
    });
    await loadPlayerDocuments();
    setTimeout(() => {
      closePlayerDocumentForm();
      playerDocumentSaveNote.hidden = true;
    }, 1200);
    return;
  }

  const titres = [];
  let uploadError = null;

  for (const file of files) {
    const path = `${playerId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadErr } = await supabase.storage.from('player-documents').upload(path, file, { upsert: false });
    if (uploadErr) {
      uploadError = uploadErr;
      break;
    }
    const titre = files.length > 1
      ? (titreInput ? `${titreInput} — ${playerDocumentDefaultTitre(file)}` : playerDocumentDefaultTitre(file))
      : (titreInput || playerDocumentDefaultTitre(file));
    const { error } = await supabase.from('player_documents').insert({
      site: 'gravity-basketball',
      player_id: playerId,
      titre,
      categorie,
      file_path: path,
    });
    if (error) {
      uploadError = error;
      break;
    }
    titres.push(titre);
  }

  saveBtn.disabled = false;
  if (uploadError) {
    playerDocumentSaveNote.textContent = 'Erreur : ' + uploadError.message
      + (titres.length ? ` (${titres.length} document(s) déjà enregistré(s) avant l'erreur)` : '');
    playerDocumentSaveNote.style.color = '#ff6b6b';
    playerDocumentSaveNote.hidden = false;
    if (titres.length) await loadPlayerDocuments();
    return;
  }

  playerDocumentSaveNote.textContent = titres.length > 1 ? `${titres.length} documents enregistrés !` : 'Enregistré !';
  playerDocumentSaveNote.style.color = '';
  playerDocumentSaveNote.hidden = false;
  notifyEspaceJoueurs({
    kind: 'document',
    action: 'created',
    site: 'gravity-basketball',
    player_id: playerId,
    details: { titre: titres.join(', '), count: titres.length },
  });
  await loadPlayerDocuments();
  setTimeout(() => {
    closePlayerDocumentForm();
    playerDocumentSaveNote.hidden = true;
  }, 1200);
});

// ---------- Espace Joueurs : calendrier des matchs (saison + playoffs) ----------
function populateTeamGameTeamSelect() {
  if (!teamGameTeamSelect) return;
  const current = teamGameTeamSelect.value;
  teamGameTeamSelect.innerHTML = allTeams
    .map((t) => `<option value="${t.id}">${escapeHtml(t.categorie)} — ${escapeHtml(t.genre)} (${escapeHtml(t.nom_equipe)})</option>`)
    .join('');
  if (current) teamGameTeamSelect.value = current;
}

async function loadTeamGames() {
  const { data, error } = await supabase
    .from('team_games')
    .select('*')
    .eq('site', 'gravity-basketball')
    .order('date_match', { ascending: true });
  if (!error) allTeamGames = data || [];
  renderTeamGamesTable();
}

function formatGameDateTime(dateStr, timeStr) {
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return timeStr ? `${label}, ${timeStr}` : label;
}

function renderTeamGamesTable() {
  if (!teamGamesTbody) return;
  teamGamesTbody.innerHTML =
    allTeamGames
      .map((g) => `
        <tr>
          <td>${escapeHtml(teamLabel(g.team_id))}</td>
          <td><span class="program-status-pill ${g.type === 'playoff' ? 'active' : ''}">${g.type === 'playoff' ? 'Playoffs' : 'Saison'}</span></td>
          <td>${g.adversaire ? escapeHtml(g.adversaire) : '<span class="muted">—</span>'}</td>
          <td colspan="2">${formatGameDateTime(g.date_match, g.heure_match)}</td>
          <td>${g.lieu_nom || g.adresse ? escapeHtml(g.lieu_nom || g.adresse) : '<span class="muted">—</span>'}</td>
          <td>
            <div class="program-row-actions">
              <button type="button" class="btn btn-ghost team-game-edit-btn" data-id="${g.id}">Éditer</button>
            </div>
          </td>
        </tr>
      `)
      .join('') || '<tr><td colspan="7" class="empty-note">Aucun match pour l\'instant.</td></tr>';

  teamGamesTbody.querySelectorAll('.team-game-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const game = allTeamGames.find((g) => g.id === btn.dataset.id);
      if (game) openTeamGameForm(game);
    });
  });
}

function openTeamGameForm(game) {
  populateTeamGameTeamSelect();
  teamGameForm.hidden = false;
  teamGameIdInput.value = game ? game.id : '';
  teamGameTeamSelect.value = game ? game.team_id : (allTeams[0]?.id || '');
  teamGameTypeSelect.value = game ? game.type : 'saison';
  teamGameAdversaireInput.value = game ? (game.adversaire || '') : '';
  teamGameDateInput.value = game ? game.date_match : '';
  teamGameHeureInput.value = game ? (game.heure_match || '') : '';
  teamGameLieuNomInput.value = game ? (game.lieu_nom || '') : '';
  teamGameAdresseInput.value = game ? (game.adresse || '') : '';
  teamGameDomicileCheckbox.checked = game ? game.domicile : true;
  teamGameResultatInput.value = game ? (game.resultat || '') : '';
  teamGameNotesInput.value = game ? (game.notes || '') : '';
  teamGameOrderInput.value = game ? game.display_order : 0;
  teamGameDeleteBtn.hidden = !game;
  teamGameForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeTeamGameForm() {
  teamGameForm.hidden = true;
  teamGameForm.reset();
  teamGameIdInput.value = '';
}

teamGameNewBtn?.addEventListener('click', () => openTeamGameForm(null));
teamGameCancelBtn?.addEventListener('click', () => closeTeamGameForm());

teamGameDeleteBtn?.addEventListener('click', async () => {
  const id = teamGameIdInput.value;
  if (!id) return;
  if (!confirm('Supprimer définitivement ce match ?')) return;
  const { error } = await supabase.from('team_games').delete().eq('id', id);
  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  closeTeamGameForm();
  await loadTeamGames();
});

teamGameForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = teamGameIdInput.value || null;
  const saveBtn = teamGameForm.querySelector('button[type="submit"]');
  saveBtn.disabled = true;

  const payload = {
    site: 'gravity-basketball',
    team_id: teamGameTeamSelect.value,
    type: teamGameTypeSelect.value,
    adversaire: teamGameAdversaireInput.value.trim() || null,
    date_match: teamGameDateInput.value,
    heure_match: teamGameHeureInput.value || null,
    lieu_nom: teamGameLieuNomInput.value.trim() || null,
    adresse: teamGameAdresseInput.value.trim() || null,
    domicile: teamGameDomicileCheckbox.checked,
    resultat: teamGameResultatInput.value.trim() || null,
    notes: teamGameNotesInput.value.trim() || null,
    display_order: parseInt(teamGameOrderInput.value, 10) || 0,
  };

  const { error } = id
    ? await supabase.from('team_games').update(payload).eq('id', id)
    : await supabase.from('team_games').insert(payload);

  saveBtn.disabled = false;
  if (error) {
    teamGameSaveNote.textContent = 'Erreur : ' + error.message;
    teamGameSaveNote.style.color = '#ff6b6b';
    teamGameSaveNote.hidden = false;
    return;
  }

  teamGameSaveNote.textContent = 'Enregistré !';
  teamGameSaveNote.style.color = '';
  teamGameSaveNote.hidden = false;
  notifyEspaceJoueurs({
    kind: 'game',
    action: id ? 'updated' : 'created',
    site: 'gravity-basketball',
    team_id: teamGameTeamSelect.value,
    details: {
      adversaire: teamGameAdversaireInput.value.trim(),
      date_match: teamGameDateInput.value,
      heure_match: teamGameHeureInput.value,
      lieu_nom: teamGameLieuNomInput.value.trim(),
    },
  });
  await loadTeamGames();
  setTimeout(() => {
    closeTeamGameForm();
    teamGameSaveNote.hidden = true;
  }, 1200);
});

// ---------- Espace Joueurs : calendrier des entraînements ----------
function populateTeamTrainingTeamSelect() {
  if (!teamTrainingTeamSelect) return;
  const current = teamTrainingTeamSelect.value;
  teamTrainingTeamSelect.innerHTML = allTeams
    .map((t) => `<option value="${t.id}">${escapeHtml(t.categorie)} — ${escapeHtml(t.genre)} (${escapeHtml(t.nom_equipe)})</option>`)
    .join('');
  if (current) teamTrainingTeamSelect.value = current;
}

async function loadTeamTrainings() {
  const { data, error } = await supabase
    .from('team_trainings')
    .select('*')
    .eq('site', 'gravity-basketball')
    .order('date_entrainement', { ascending: true });
  if (!error) allTeamTrainings = data || [];
  renderTeamTrainingsTable();
}

function renderTeamTrainingsTable() {
  if (!teamTrainingsTbody) return;
  teamTrainingsTbody.innerHTML =
    allTeamTrainings
      .map((tr) => `
        <tr>
          <td>${escapeHtml(teamLabel(tr.team_id))}</td>
          <td colspan="2">${formatGameDateTime(tr.date_entrainement, tr.heure_debut ? `${tr.heure_debut}${tr.heure_fin ? '–' + tr.heure_fin : ''}` : '')}</td>
          <td>${tr.lieu_nom || tr.adresse ? escapeHtml(tr.lieu_nom || tr.adresse) : '<span class="muted">—</span>'}</td>
          <td>
            <div class="program-row-actions">
              <button type="button" class="btn btn-ghost team-training-edit-btn" data-id="${tr.id}">Éditer</button>
            </div>
          </td>
        </tr>
      `)
      .join('') || '<tr><td colspan="5" class="empty-note">Aucun entraînement pour l\'instant.</td></tr>';

  teamTrainingsTbody.querySelectorAll('.team-training-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const training = allTeamTrainings.find((tr) => tr.id === btn.dataset.id);
      if (training) openTeamTrainingForm(training);
    });
  });
}

function openTeamTrainingForm(training) {
  populateTeamTrainingTeamSelect();
  teamTrainingForm.hidden = false;
  teamTrainingIdInput.value = training ? training.id : '';
  teamTrainingTeamSelect.value = training ? training.team_id : (allTeams[0]?.id || '');
  teamTrainingDateInput.value = training ? training.date_entrainement : '';
  teamTrainingHeureDebutInput.value = training ? (training.heure_debut || '') : '';
  teamTrainingHeureFinInput.value = training ? (training.heure_fin || '') : '';
  teamTrainingLieuNomInput.value = training ? (training.lieu_nom || '') : '';
  teamTrainingAdresseInput.value = training ? (training.adresse || '') : '';
  teamTrainingNotesInput.value = training ? (training.notes || '') : '';
  teamTrainingOrderInput.value = training ? training.display_order : 0;
  teamTrainingDeleteBtn.hidden = !training;
  teamTrainingForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeTeamTrainingForm() {
  teamTrainingForm.hidden = true;
  teamTrainingForm.reset();
  teamTrainingIdInput.value = '';
}

teamTrainingNewBtn?.addEventListener('click', () => openTeamTrainingForm(null));
teamTrainingCancelBtn?.addEventListener('click', () => closeTeamTrainingForm());

teamTrainingDeleteBtn?.addEventListener('click', async () => {
  const id = teamTrainingIdInput.value;
  if (!id) return;
  if (!confirm('Supprimer définitivement cet entraînement ?')) return;
  const { error } = await supabase.from('team_trainings').delete().eq('id', id);
  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  closeTeamTrainingForm();
  await loadTeamTrainings();
});

teamTrainingForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = teamTrainingIdInput.value || null;
  const saveBtn = teamTrainingForm.querySelector('button[type="submit"]');
  saveBtn.disabled = true;

  const payload = {
    site: 'gravity-basketball',
    team_id: teamTrainingTeamSelect.value,
    date_entrainement: teamTrainingDateInput.value,
    heure_debut: teamTrainingHeureDebutInput.value || null,
    heure_fin: teamTrainingHeureFinInput.value || null,
    lieu_nom: teamTrainingLieuNomInput.value.trim() || null,
    adresse: teamTrainingAdresseInput.value.trim() || null,
    notes: teamTrainingNotesInput.value.trim() || null,
    display_order: parseInt(teamTrainingOrderInput.value, 10) || 0,
  };

  const { error } = id
    ? await supabase.from('team_trainings').update(payload).eq('id', id)
    : await supabase.from('team_trainings').insert(payload);

  saveBtn.disabled = false;
  if (error) {
    teamTrainingSaveNote.textContent = 'Erreur : ' + error.message;
    teamTrainingSaveNote.style.color = '#ff6b6b';
    teamTrainingSaveNote.hidden = false;
    return;
  }

  teamTrainingSaveNote.textContent = 'Enregistré !';
  teamTrainingSaveNote.style.color = '';
  teamTrainingSaveNote.hidden = false;
  notifyEspaceJoueurs({
    kind: 'training',
    action: id ? 'updated' : 'created',
    site: 'gravity-basketball',
    team_id: teamTrainingTeamSelect.value,
    details: {
      date_entrainement: teamTrainingDateInput.value,
      heure_debut: teamTrainingHeureDebutInput.value,
      heure_fin: teamTrainingHeureFinInput.value,
      lieu_nom: teamTrainingLieuNomInput.value.trim(),
    },
  });
  await loadTeamTrainings();
  setTimeout(() => {
    closeTeamTrainingForm();
    teamTrainingSaveNote.hidden = true;
  }, 1200);
});

// ---------- Espace Joueurs : communiqués ----------
function populateAnnouncementTeamSelect() {
  if (!announcementTeamSelect) return;
  const current = announcementTeamSelect.value;
  announcementTeamSelect.innerHTML = '<option value="">Toutes les équipes</option>' + allTeams
    .map((t) => `<option value="${t.id}">${escapeHtml(t.categorie)} — ${escapeHtml(t.genre)} (${escapeHtml(t.nom_equipe)})</option>`)
    .join('');
  if (current) announcementTeamSelect.value = current;
}

async function loadAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('site', 'gravity-basketball')
    .order('created_at', { ascending: false });
  if (!error) allAnnouncements = data || [];
  renderAnnouncementsTable();
}

function renderAnnouncementsTable() {
  if (!announcementsTbody) return;
  announcementsTbody.innerHTML =
    allAnnouncements
      .map((a) => `
        <tr>
          <td>${escapeHtml(a.titre)}</td>
          <td>${a.team_id ? escapeHtml(teamLabel(a.team_id)) : '<span class="muted">Toutes les équipes</span>'}</td>
          <td>${new Date(a.created_at).toLocaleDateString('fr-CA')}</td>
          <td>
            <div class="program-row-actions">
              <button type="button" class="btn btn-ghost announcement-edit-btn" data-id="${a.id}">Éditer</button>
            </div>
          </td>
        </tr>
      `)
      .join('') || '<tr><td colspan="4" class="empty-note">Aucun communiqué pour l\'instant.</td></tr>';

  announcementsTbody.querySelectorAll('.announcement-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const a = allAnnouncements.find((x) => x.id === btn.dataset.id);
      if (a) openAnnouncementForm(a);
    });
  });
}

function openAnnouncementForm(a) {
  populateAnnouncementTeamSelect();
  announcementForm.hidden = false;
  announcementIdInput.value = a ? a.id : '';
  announcementTeamSelect.value = a ? (a.team_id || '') : '';
  announcementTitreInput.value = a ? a.titre : '';
  announcementContenuInput.value = a ? a.contenu : '';
  announcementDeleteBtn.hidden = !a;
  announcementForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeAnnouncementForm() {
  announcementForm.hidden = true;
  announcementForm.reset();
  announcementIdInput.value = '';
}

announcementNewBtn?.addEventListener('click', () => openAnnouncementForm(null));
announcementCancelBtn?.addEventListener('click', () => closeAnnouncementForm());

announcementDeleteBtn?.addEventListener('click', async () => {
  const id = announcementIdInput.value;
  if (!id) return;
  if (!confirm('Supprimer définitivement ce communiqué ?')) return;
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  closeAnnouncementForm();
  await loadAnnouncements();
});

announcementForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = announcementIdInput.value || null;
  const saveBtn = announcementForm.querySelector('button[type="submit"]');
  saveBtn.disabled = true;

  const payload = {
    site: 'gravity-basketball',
    team_id: announcementTeamSelect.value || null,
    titre: announcementTitreInput.value.trim(),
    contenu: announcementContenuInput.value.trim(),
    created_by: currentAdmin.id,
  };

  const { error } = id
    ? await supabase.from('announcements').update(payload).eq('id', id)
    : await supabase.from('announcements').insert(payload);

  saveBtn.disabled = false;
  if (error) {
    announcementSaveNote.textContent = 'Erreur : ' + error.message;
    announcementSaveNote.style.color = '#ff6b6b';
    announcementSaveNote.hidden = false;
    return;
  }

  announcementSaveNote.textContent = 'Publié !';
  announcementSaveNote.style.color = '';
  announcementSaveNote.hidden = false;
  notifyEspaceJoueurs({
    kind: 'announcement',
    action: id ? 'updated' : 'created',
    site: 'gravity-basketball',
    team_id: announcementTeamSelect.value || null,
    details: { titre: announcementTitreInput.value.trim() },
  });
  await loadAnnouncements();
  setTimeout(() => {
    closeAnnouncementForm();
    announcementSaveNote.hidden = true;
  }, 1200);
});

// ---------- Vidéos Instagram (carrousel affiché sur gravity-basketball-mtl) ----------
async function loadInstagramCarousel() {
  const { data, error } = await supabase
    .from('instagram_carousel')
    .select('*')
    .order('position', { ascending: true });
  if (!error) allInstagramCarousel = data || [];
  renderInstagramCarouselTable();
}

function instagramCarouselFilteredBySite(list) {
  if (activeSite === 'all') return list;
  return list.filter((r) => r.site === activeSite);
}

function renderInstagramCarouselTable() {
  if (!igCarouselTbody) return;
  const rows = instagramCarouselFilteredBySite(allInstagramCarousel);
  igCarouselTbody.innerHTML =
    rows
      .map((r) => `
        <tr>
          <td>${r.video_url
            ? `<video src="${escapeHtml(r.video_url)}" style="height:56px; width:auto; max-width:90px; object-fit:cover; border-radius:6px;" muted></video>`
            : `<a href="${escapeHtml(r.post_url)}" target="_blank" rel="noopener">${escapeHtml(r.post_url)}</a>`}</td>
          <td><span class="site-badge ${r.site}">${SITE_LABELS[r.site] || r.site}</span></td>
          <td>${r.position}</td>
          <td><span class="program-status-pill ${r.active ? 'active' : 'inactive'}">${r.active ? 'Actif' : 'Inactif'}</span></td>
          <td>
            <div class="program-row-actions">
              <button type="button" class="btn btn-ghost ig-carousel-edit-btn" data-id="${r.id}">Éditer</button>
              <button type="button" class="btn btn-ghost ig-carousel-toggle-btn" data-id="${r.id}">${r.active ? 'Désactiver' : 'Activer'}</button>
              <button type="button" class="btn btn-ghost ig-carousel-remove-btn" data-id="${r.id}" style="color:#c0392b;">Supprimer</button>
            </div>
          </td>
        </tr>
      `)
      .join('') || '<tr><td colspan="5" class="empty-note">Aucune vidéo pour l\'instant — clique "+ Nouvelle vidéo" pour en ajouter une.</td></tr>';

  igCarouselTbody.querySelectorAll('.ig-carousel-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = allInstagramCarousel.find((r) => r.id === btn.dataset.id);
      if (row) openInstagramCarouselForm(row);
    });
  });
  igCarouselTbody.querySelectorAll('.ig-carousel-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = allInstagramCarousel.find((r) => r.id === btn.dataset.id);
      if (!row) return;
      btn.disabled = true;
      const { error } = await supabase.from('instagram_carousel').update({ active: !row.active }).eq('id', row.id);
      if (error) alert('Erreur : ' + error.message);
      await loadInstagramCarousel();
    });
  });
  igCarouselTbody.querySelectorAll('.ig-carousel-remove-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = allInstagramCarousel.find((r) => r.id === btn.dataset.id);
      if (!row) return;
      if (!confirm('Supprimer définitivement cette vidéo de la galerie ?\n\n' + (row.video_url || row.post_url) + '\n\nCette action est irréversible.')) return;
      btn.disabled = true;
      const { error } = await supabase.from('instagram_carousel').delete().eq('id', row.id);
      if (error) {
        alert('Erreur : ' + error.message);
        btn.disabled = false;
        return;
      }
      await loadInstagramCarousel();
    });
  });
}

function openInstagramCarouselForm(row) {
  igCarouselForm.hidden = false;
  igCarouselIdInput.value = row ? row.id : '';
  igCarouselSiteSelect.value = row ? row.site : 'gravity-basketball-mtl';
  igCarouselUrlInput.value = row ? (row.post_url || '') : '';
  igCarouselOrderInput.value = row ? row.position : (allInstagramCarousel.length || 0);
  igCarouselActiveCheckbox.checked = row ? row.active : true;
  igCarouselDeleteBtn.hidden = !row;
  igCarouselVideoFileInput.value = '';
  igCarouselVideoPreviewEl.innerHTML = row?.video_url
    ? `<video src="${escapeHtml(row.video_url)}" style="height:80px; width:auto; border-radius:6px;" controls muted></video>`
    : '';
  igCarouselForm.dataset.currentVideoUrl = row?.video_url || '';
  igCarouselForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeInstagramCarouselForm() {
  igCarouselForm.hidden = true;
  igCarouselForm.reset();
  igCarouselIdInput.value = '';
  igCarouselVideoPreviewEl.innerHTML = '';
  igCarouselForm.dataset.currentVideoUrl = '';
}

igCarouselNewBtn.addEventListener('click', () => openInstagramCarouselForm(null));
igCarouselCancelBtn.addEventListener('click', () => closeInstagramCarouselForm());

igCarouselVideoFileInput.addEventListener('change', () => {
  const file = igCarouselVideoFileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  igCarouselVideoPreviewEl.innerHTML = `<video src="${url}" style="height:80px; width:auto; border-radius:6px;" controls muted></video>`;
});

igCarouselDeleteBtn.addEventListener('click', async () => {
  const id = igCarouselIdInput.value;
  if (!id) return;
  if (!confirm('Supprimer définitivement cette vidéo de la galerie ? Cette action est irréversible.')) return;
  const { error } = await supabase.from('instagram_carousel').delete().eq('id', id);
  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  closeInstagramCarouselForm();
  await loadInstagramCarousel();
});

igCarouselForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = igCarouselIdInput.value || null;
  const saveBtn = igCarouselForm.querySelector('button[type="submit"]');
  saveBtn.disabled = true;

  const postUrl = igCarouselUrlInput.value.trim();
  let videoUrl = igCarouselForm.dataset.currentVideoUrl || null;
  const file = igCarouselVideoFileInput.files[0];
  if (file) {
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('gravity-media').upload(`videos/${path}`, file, { upsert: false });
    if (uploadError) {
      igCarouselSaveNote.textContent = 'Erreur upload vidéo : ' + uploadError.message;
      igCarouselSaveNote.style.color = '#ff6b6b';
      igCarouselSaveNote.hidden = false;
      saveBtn.disabled = false;
      return;
    }
    videoUrl = supabase.storage.from('gravity-media').getPublicUrl(`videos/${path}`).data.publicUrl;
  }

  if (!videoUrl && !postUrl) {
    igCarouselSaveNote.textContent = 'Erreur : upload un fichier vidéo ou colle un lien Instagram.';
    igCarouselSaveNote.style.color = '#ff6b6b';
    igCarouselSaveNote.hidden = false;
    saveBtn.disabled = false;
    return;
  }

  const payload = {
    site: igCarouselSiteSelect.value,
    post_url: postUrl || null,
    video_url: videoUrl,
    position: parseInt(igCarouselOrderInput.value, 10) || 0,
    active: igCarouselActiveCheckbox.checked,
  };

  const { error } = id
    ? await supabase.from('instagram_carousel').update(payload).eq('id', id)
    : await supabase.from('instagram_carousel').insert(payload);

  saveBtn.disabled = false;
  if (error) {
    igCarouselSaveNote.textContent = 'Erreur : ' + error.message;
    igCarouselSaveNote.style.color = '#ff6b6b';
    igCarouselSaveNote.hidden = false;
    return;
  }

  igCarouselSaveNote.textContent = 'Enregistré !';
  igCarouselSaveNote.style.color = '';
  igCarouselSaveNote.hidden = false;
  await loadInstagramCarousel();
  setTimeout(() => {
    closeInstagramCarouselForm();
    igCarouselSaveNote.hidden = true;
  }, 1200);
});

// ---------- Galerie photos (photo_gallery) ----------
async function loadPhotoGallery() {
  const { data, error } = await supabase
    .from('photo_gallery')
    .select('*')
    .order('position', { ascending: true });
  if (!error) allPhotoGallery = data || [];
  renderPhotoGalleryTable();
}

function photoGalleryFilteredBySite(list) {
  if (activeSite === 'all') return list;
  return list.filter((r) => r.site === activeSite);
}

function renderPhotoGalleryTable() {
  if (!photoGalleryTbody) return;
  const rows = photoGalleryFilteredBySite(allPhotoGallery);
  photoGalleryTbody.innerHTML =
    rows
      .map((r) => `
        <tr>
          <td><img src="${escapeHtml(r.image_url)}" alt="${escapeHtml(r.caption || '')}" style="height:56px; width:56px; object-fit:cover; border-radius:6px;"></td>
          <td><span class="site-badge ${r.site}">${SITE_LABELS[r.site] || r.site}</span></td>
          <td>${r.position}</td>
          <td><span class="program-status-pill ${r.active ? 'active' : 'inactive'}">${r.active ? 'Actif' : 'Inactif'}</span></td>
          <td>
            <div class="program-row-actions">
              <button type="button" class="btn btn-ghost photo-gallery-edit-btn" data-id="${r.id}">Éditer</button>
              <button type="button" class="btn btn-ghost photo-gallery-toggle-btn" data-id="${r.id}">${r.active ? 'Désactiver' : 'Activer'}</button>
              <button type="button" class="btn btn-ghost photo-gallery-remove-btn" data-id="${r.id}" style="color:#c0392b;">Supprimer</button>
            </div>
          </td>
        </tr>
      `)
      .join('') || '<tr><td colspan="5" class="empty-note">Aucune photo pour l\'instant — clique "+ Nouvelle photo" pour en ajouter une.</td></tr>';

  photoGalleryTbody.querySelectorAll('.photo-gallery-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = allPhotoGallery.find((r) => r.id === btn.dataset.id);
      if (row) openPhotoGalleryForm(row);
    });
  });
  photoGalleryTbody.querySelectorAll('.photo-gallery-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = allPhotoGallery.find((r) => r.id === btn.dataset.id);
      if (!row) return;
      btn.disabled = true;
      const { error } = await supabase.from('photo_gallery').update({ active: !row.active }).eq('id', row.id);
      if (error) alert('Erreur : ' + error.message);
      await loadPhotoGallery();
    });
  });
  photoGalleryTbody.querySelectorAll('.photo-gallery-remove-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = allPhotoGallery.find((r) => r.id === btn.dataset.id);
      if (!row) return;
      if (!confirm('Supprimer définitivement cette photo de la galerie ? Cette action est irréversible.')) return;
      btn.disabled = true;
      const { error } = await supabase.from('photo_gallery').delete().eq('id', row.id);
      if (error) {
        alert('Erreur : ' + error.message);
        btn.disabled = false;
        return;
      }
      await loadPhotoGallery();
    });
  });
}

function openPhotoGalleryForm(row) {
  photoGalleryForm.hidden = false;
  photoGalleryIdInput.value = row ? row.id : '';
  photoGallerySiteSelect.value = row ? row.site : 'gravity-basketball-mtl';
  photoGalleryCaptionInput.value = row ? (row.caption || '') : '';
  photoGalleryOrderInput.value = row ? row.position : (allPhotoGallery.length || 0);
  photoGalleryActiveCheckbox.checked = row ? row.active : true;
  photoGalleryDeleteBtn.hidden = !row;
  photoGalleryFileInput.value = '';
  photoGalleryPreviewEl.innerHTML = row?.image_url
    ? `<img src="${escapeHtml(row.image_url)}" alt="" style="height:80px; width:auto; border-radius:6px;">`
    : '';
  photoGalleryForm.dataset.currentImageUrl = row?.image_url || '';
  photoGalleryForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closePhotoGalleryForm() {
  photoGalleryForm.hidden = true;
  photoGalleryForm.reset();
  photoGalleryIdInput.value = '';
  photoGalleryPreviewEl.innerHTML = '';
  photoGalleryForm.dataset.currentImageUrl = '';
}

photoGalleryNewBtn.addEventListener('click', () => openPhotoGalleryForm(null));
photoGalleryCancelBtn.addEventListener('click', () => closePhotoGalleryForm());

photoGalleryFileInput.addEventListener('change', () => {
  const file = photoGalleryFileInput.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  photoGalleryPreviewEl.innerHTML = `<img src="${url}" alt="" style="height:80px; width:auto; border-radius:6px;">`;
});

photoGalleryDeleteBtn.addEventListener('click', async () => {
  const id = photoGalleryIdInput.value;
  if (!id) return;
  if (!confirm('Supprimer définitivement cette photo de la galerie ? Cette action est irréversible.')) return;
  const { error } = await supabase.from('photo_gallery').delete().eq('id', id);
  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  closePhotoGalleryForm();
  await loadPhotoGallery();
});

photoGalleryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = photoGalleryIdInput.value || null;
  const saveBtn = photoGalleryForm.querySelector('button[type="submit"]');
  saveBtn.disabled = true;

  let imageUrl = photoGalleryForm.dataset.currentImageUrl || null;
  const file = photoGalleryFileInput.files[0];
  if (file) {
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('gravity-media').upload(`photos/${path}`, file, { upsert: false });
    if (uploadError) {
      photoGallerySaveNote.textContent = 'Erreur upload photo : ' + uploadError.message;
      photoGallerySaveNote.style.color = '#ff6b6b';
      photoGallerySaveNote.hidden = false;
      saveBtn.disabled = false;
      return;
    }
    imageUrl = supabase.storage.from('gravity-media').getPublicUrl(`photos/${path}`).data.publicUrl;
  }

  if (!imageUrl) {
    photoGallerySaveNote.textContent = 'Erreur : upload un fichier image.';
    photoGallerySaveNote.style.color = '#ff6b6b';
    photoGallerySaveNote.hidden = false;
    saveBtn.disabled = false;
    return;
  }

  const payload = {
    site: photoGallerySiteSelect.value,
    image_url: imageUrl,
    caption: photoGalleryCaptionInput.value.trim() || null,
    position: parseInt(photoGalleryOrderInput.value, 10) || 0,
    active: photoGalleryActiveCheckbox.checked,
  };

  const { error } = id
    ? await supabase.from('photo_gallery').update(payload).eq('id', id)
    : await supabase.from('photo_gallery').insert(payload);

  saveBtn.disabled = false;
  if (error) {
    photoGallerySaveNote.textContent = 'Erreur : ' + error.message;
    photoGallerySaveNote.style.color = '#ff6b6b';
    photoGallerySaveNote.hidden = false;
    return;
  }

  photoGallerySaveNote.textContent = 'Enregistré !';
  photoGallerySaveNote.style.color = '';
  photoGallerySaveNote.hidden = false;
  await loadPhotoGallery();
  setTimeout(() => {
    closePhotoGalleryForm();
    photoGallerySaveNote.hidden = true;
  }, 1200);
});

// ---------- Disponibilités (available_slots) — Gravity Coaching (site
// interne 'coachyass') et Gravity Pickup (site interne 'basketlibre').
// L'admin ouvre des créneaux précis (date + heure) ; les clients ne
// pourront réserver que parmi les créneaux status='open' et futurs une
// fois les formulaires publics branchés dessus (côté coachyass/basketlibre,
// hors périmètre de ce dashboard). ----------
async function loadSlots() {
  const sites = currentAdmin.sites.filter((s) => SLOTS_SITES.includes(s));
  if (sites.length === 0) {
    allSlots = [];
    slotBookingCounts = {};
    renderSlotsTable();
    return;
  }
  const [slotsRes, bookingsRes] = await Promise.all([
    supabase
      .from('available_slots')
      .select('*')
      .in('site', sites)
      .order('slot_date', { ascending: true })
      .order('start_time', { ascending: true }),
    // Réservations liées à un créneau (slot_id), pour calculer les places
    // restantes. Ne compte pas les réservations "annulé".
    supabase
      .from('bookings')
      .select('slot_id, status')
      .in('site', sites)
      .not('slot_id', 'is', null),
  ]);

  if (!slotsRes.error) allSlots = slotsRes.data || [];
  slotBookingCounts = {};
  if (!bookingsRes.error) {
    (bookingsRes.data || []).forEach((b) => {
      if (b.status === 'annulé') return;
      slotBookingCounts[b.slot_id] = (slotBookingCounts[b.slot_id] || 0) + 1;
    });
  }
  renderSlotsTable();
}

function renderSlotsTable() {
  if (!slotsTbody) return;
  const rows = filteredBySite(allSlots);
  slotsTbody.innerHTML =
    rows
      .map((s) => {
        const dateLabel = new Date(s.slot_date + 'T00:00:00').toLocaleDateString('fr-CA', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        });
        const timeLabel = s.end_time ? `${s.start_time}–${s.end_time}` : s.start_time;
        const booked = slotBookingCounts[s.id] || 0;
        // Purement informatif — ne détermine JAMAIS si le créneau bloque les
        // réservations. Ça, c'est uniquement le flag manuel booking_blocked
        // (bouton "Marquer complet" ci-dessous), sur demande explicite de Yassine.
        let placesLabel = '—';
        if (s.capacity != null) {
          const remaining = s.capacity - booked;
          placesLabel = `${remaining} place${remaining > 1 || remaining < 0 ? 's' : ''} restante${remaining > 1 || remaining < 0 ? 's' : ''}`;
        } else if (booked > 0) {
          placesLabel = `${booked} réservation${booked > 1 ? 's' : ''} (illimité)`;
        }
        return `
        <tr>
          <td><span class="site-badge ${s.site}">${SITE_LABELS[s.site] || s.site}</span></td>
          <td>${escapeHtml(dateLabel)}</td>
          <td>${escapeHtml(timeLabel)}</td>
          <td class="wrap">${escapeHtml(s.location || '')}</td>
          <td>${escapeHtml(placesLabel)}</td>
          <td>
            <span class="program-status-pill ${s.status === 'open' ? 'active' : 'inactive'}">${s.status === 'open' ? 'Ouvert' : 'Fermé'}</span>
            ${s.booking_blocked ? '<span class="program-status-pill inactive" style="margin-left:6px;">COMPLET</span>' : ''}
          </td>
          <td>
            <div class="program-row-actions">
              <button type="button" class="btn btn-ghost slot-toggle-btn" data-id="${s.id}">${s.status === 'open' ? 'Fermer' : 'Rouvrir'}</button>
              <button type="button" class="btn btn-ghost slot-block-btn" data-id="${s.id}">${s.booking_blocked ? "Retirer «Complet»" : 'Marquer complet'}</button>
              <button type="button" class="btn btn-ghost slot-delete-btn" data-id="${s.id}">Supprimer</button>
            </div>
          </td>
        </tr>`;
      })
      .join('') || '<tr><td colspan="7" class="empty-note">Aucun créneau pour ce site — ajoute-en un ci-dessous ou active plusieurs semaines d\'un coup.</td></tr>';

  slotsTbody.querySelectorAll('.slot-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const slot = allSlots.find((s) => s.id === btn.dataset.id);
      if (!slot) return;
      btn.disabled = true;
      const newStatus = slot.status === 'open' ? 'closed' : 'open';
      const { error } = await supabase.from('available_slots').update({ status: newStatus }).eq('id', slot.id);
      if (error) alert('Erreur : ' + error.message);
      await loadSlots();
    });
  });
  slotsTbody.querySelectorAll('.slot-block-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const slot = allSlots.find((s) => s.id === btn.dataset.id);
      if (!slot) return;
      btn.disabled = true;
      const { error } = await supabase.from('available_slots').update({ booking_blocked: !slot.booking_blocked }).eq('id', slot.id);
      if (error) alert('Erreur : ' + error.message);
      await loadSlots();
    });
  });
  slotsTbody.querySelectorAll('.slot-delete-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Supprimer ce créneau ?')) return;
      btn.disabled = true;
      const { error } = await supabase.from('available_slots').delete().eq('id', btn.dataset.id);
      if (error) alert('Erreur : ' + error.message);
      await loadSlots();
    });
  });
}

// ---------- Pause globale par site ("Activité suspendue temporairement") ----------
async function loadSiteSuspendStatus() {
  const sites = currentAdmin.sites.filter((s) => SLOTS_SITES.includes(s));
  if (sites.length === 0) {
    siteRows = {};
    renderSiteSuspendList();
    return;
  }
  const { data, error } = await supabase.from('sites').select('slug, name, booking_suspended, suspended_message').in('slug', sites);
  if (!error) {
    siteRows = {};
    (data || []).forEach((row) => { siteRows[row.slug] = row; });
  }
  renderSiteSuspendList();
}

function renderSiteSuspendList() {
  if (!siteSuspendListEl) return;
  const sites = currentAdmin.sites.filter((s) => SLOTS_SITES.includes(s));
  siteSuspendListEl.innerHTML = sites
    .map((slug) => {
      const row = siteRows[slug] || { booking_suspended: false, suspended_message: '' };
      return `
        <div class="site-suspend-card" data-site="${slug}" style="border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:12px;">
          <label class="checkbox-field">
            <input type="checkbox" class="site-suspend-checkbox" data-site="${slug}" ${row.booking_suspended ? 'checked' : ''}>
            <span><strong>${SITE_LABELS[slug] || slug}</strong> — Suspendre temporairement les réservations (bloque tout le site, tous les créneaux)</span>
          </label>
          <div class="field" style="margin-top:8px;">
            <label>Message affiché aux clients pendant la suspension (optionnel — sinon message par défaut)</label>
            <input type="text" class="site-suspend-message" data-site="${slug}" value="${escapeHtml(row.suspended_message || '')}" placeholder="Ex. Activité en pause jusqu'au 15 septembre — revenez bientôt !">
          </div>
          <button type="button" class="btn btn-ghost site-suspend-save-btn" data-site="${slug}" style="margin-top:8px;">Enregistrer</button>
          <span class="save-note site-suspend-note" data-site="${slug}" hidden style="margin-left:8px;">Enregistré !</span>
        </div>`;
    })
    .join('');

  siteSuspendListEl.querySelectorAll('.site-suspend-save-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const slug = btn.dataset.site;
      const checkbox = siteSuspendListEl.querySelector(`.site-suspend-checkbox[data-site="${slug}"]`);
      const messageInput = siteSuspendListEl.querySelector(`.site-suspend-message[data-site="${slug}"]`);
      const note = siteSuspendListEl.querySelector(`.site-suspend-note[data-site="${slug}"]`);
      btn.disabled = true;
      const { error } = await supabase
        .from('sites')
        .update({ booking_suspended: checkbox.checked, suspended_message: messageInput.value.trim() || null })
        .eq('slug', slug);
      btn.disabled = false;
      if (error) {
        alert('Erreur : ' + error.message);
        return;
      }
      note.hidden = false;
      setTimeout(() => { note.hidden = true; }, 1500);
      await loadSiteSuspendStatus();
    });
  });
}

if (slotForm) {
  slotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      site: slotSiteSelect.value,
      slot_date: slotDateInput.value,
      start_time: slotStartInput.value,
      end_time: slotEndInput.value || null,
      location: slotLocationInput.value.trim() || null,
      capacity: slotCapacityInput.value ? parseInt(slotCapacityInput.value, 10) : null,
      status: 'open',
    };
    const { error } = await supabase.from('available_slots').insert(payload);
    if (error) {
      slotSaveNote.textContent =
        'Erreur : ' + (error.code === '23505' ? 'Ce créneau existe déjà pour ce site (même date + heure).' : error.message);
      slotSaveNote.style.color = '#ff6b6b';
      slotSaveNote.hidden = false;
      return;
    }
    slotSaveNote.textContent = 'Créneau ajouté !';
    slotSaveNote.style.color = '';
    slotSaveNote.hidden = false;
    slotForm.reset();
    await loadSlots();
    setTimeout(() => { slotSaveNote.hidden = true; }, 1500);
  });
}

if (slotBulkForm) {
  slotBulkForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const site = bulkSiteSelect.value;
    const weekday = parseInt(bulkWeekdaySelect.value, 10);
    const startTime = bulkStartInput.value;
    const endTime = bulkEndInput.value || null;
    const location = bulkLocationInput.value.trim() || null;
    const capacity = bulkCapacityInput.value ? parseInt(bulkCapacityInput.value, 10) : null;
    const weeks = parseInt(bulkWeeksInput.value, 10) || 1;

    // Trouve la prochaine occurrence de ce jour de semaine (aujourd'hui inclus),
    // puis génère `weeks` occurrences espacées de 7 jours.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = (weekday - today.getDay() + 7) % 7;
    const first = new Date(today);
    first.setDate(today.getDate() + daysUntil);

    const rows = [];
    for (let i = 0; i < weeks; i++) {
      const d = new Date(first);
      d.setDate(first.getDate() + i * 7);
      const iso = d.toISOString().slice(0, 10);
      rows.push({ site, slot_date: iso, start_time: startTime, end_time: endTime, location, capacity, status: 'open' });
    }

    const { error } = await supabase.from('available_slots').upsert(rows, { onConflict: 'site,slot_date,start_time', ignoreDuplicates: true });
    if (error) {
      bulkSaveNote.textContent = 'Erreur : ' + error.message;
      bulkSaveNote.style.color = '#ff6b6b';
      bulkSaveNote.hidden = false;
      return;
    }
    bulkSaveNote.textContent = `${rows.length} créneau(x) activé(s) (${WEEKDAY_LABELS[weekday]}) !`;
    bulkSaveNote.style.color = '';
    bulkSaveNote.hidden = false;
    await loadSlots();
    setTimeout(() => { bulkSaveNote.hidden = true; }, 2500);
  });
}

function addProgramRepeaterRow(container, label = '', value = '') {
  const row = document.createElement('div');
  row.className = 'repeater-row';
  row.innerHTML = `
    <input type="text" class="repeater-label" placeholder="Ex. Catégorie d'âge" value="${escapeHtml(label)}">
    <input type="text" class="repeater-value" placeholder="Ex. 13-14 ans" value="${escapeHtml(value)}">
    <button type="button" class="repeater-row-remove" title="Retirer cette ligne">×</button>
  `;
  row.querySelector('.repeater-row-remove').addEventListener('click', () => row.remove());
  container.appendChild(row);
}

function collectProgramRepeaterRows(container) {
  return Array.from(container.querySelectorAll('.repeater-row'))
    .map((row) => ({
      label: row.querySelector('.repeater-label').value.trim(),
      value: row.querySelector('.repeater-value').value.trim(),
    }))
    .filter((r) => r.label || r.value);
}

function openProgramForm(program) {
  programForm.hidden = false;
  programIdInput.value = program ? program.id : '';
  programSiteSelect.value = program ? program.site : (activeSite !== 'all' ? activeSite : currentAdmin.sites[0]);
  programSlugInput.value = program ? program.slug : '';
  programNameInput.value = program ? program.name : '';
  programDescriptionInput.value = program ? (program.description || '') : '';
  programScheduleInput.value = program ? (program.schedule || '') : '';
  programLocationInput.value = program ? (program.location || '') : '';
  programZeffyInput.value = program ? (program.zeffy_url || '') : '';
  programOrderInput.value = program ? program.display_order : 0;
  programActiveCheckbox.checked = program ? program.active : true;
  programDeleteBtn.hidden = !program;

  programDetailsRowsEl.innerHTML = '';
  (program?.details?.length ? program.details : [{ label: '', value: '' }]).forEach((d) =>
    addProgramRepeaterRow(programDetailsRowsEl, d.label, d.value)
  );
  programPricingRowsEl.innerHTML = '';
  (program?.pricing?.length ? program.pricing : [{ label: '', value: '' }]).forEach((d) =>
    addProgramRepeaterRow(programPricingRowsEl, d.label, d.value)
  );

  programForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeProgramForm() {
  programForm.hidden = true;
  programForm.reset();
  programIdInput.value = '';
  programDetailsRowsEl.innerHTML = '';
  programPricingRowsEl.innerHTML = '';
}

programNewBtn.addEventListener('click', () => openProgramForm(null));
programCancelBtn.addEventListener('click', () => closeProgramForm());
programDetailsAddBtn.addEventListener('click', () => addProgramRepeaterRow(programDetailsRowsEl));
programPricingAddBtn.addEventListener('click', () => addProgramRepeaterRow(programPricingRowsEl));

programDeleteBtn.addEventListener('click', async () => {
  const id = programIdInput.value;
  if (!id) return;
  if (!confirm('Supprimer définitivement ce programme ? Cette action est irréversible.')) return;
  const { error } = await supabase.from('programs').delete().eq('id', id);
  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  closeProgramForm();
  await loadPrograms();
});

if (reviewAddForm) {
  reviewAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      site: reviewAddSiteSelect.value,
      contact_name: reviewAddNameInput.value.trim(),
      rating: parseInt(reviewAddRatingSelect.value, 10),
      comment: reviewAddCommentInput.value.trim() || null,
      approved: true,
    };

    const { error } = await supabase.from('reviews').insert(payload);

    if (error) {
      reviewAddSaveNote.textContent = 'Erreur : ' + error.message;
      reviewAddSaveNote.style.color = '#ff6b6b';
      reviewAddSaveNote.hidden = false;
      return;
    }

    reviewAddSaveNote.textContent = 'Avis publié !';
    reviewAddSaveNote.style.color = '';
    reviewAddSaveNote.hidden = false;
    reviewAddForm.reset();
    await loadReviews();
    setTimeout(() => {
      reviewAddSaveNote.hidden = true;
    }, 2500);
  });
}

programForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = programIdInput.value || null;
  const payload = {
    site: programSiteSelect.value,
    slug: programSlugInput.value.trim().toLowerCase(),
    name: programNameInput.value.trim(),
    description: programDescriptionInput.value.trim() || null,
    details: collectProgramRepeaterRows(programDetailsRowsEl),
    pricing: collectProgramRepeaterRows(programPricingRowsEl),
    schedule: programScheduleInput.value.trim() || null,
    location: programLocationInput.value.trim() || null,
    zeffy_url: programZeffyInput.value.trim() || null,
    active: programActiveCheckbox.checked,
    display_order: parseInt(programOrderInput.value, 10) || 0,
  };

  const { error } = id
    ? await supabase.from('programs').update(payload).eq('id', id)
    : await supabase.from('programs').insert(payload);

  if (error) {
    programSaveNote.textContent =
      'Erreur : ' + (error.message.includes('duplicate') || error.code === '23505'
        ? `Ce slug existe déjà pour ce site. Choisis un identifiant unique.`
        : error.message);
    programSaveNote.style.color = '#ff6b6b';
    programSaveNote.hidden = false;
    return;
  }

  programSaveNote.textContent = 'Enregistré !';
  programSaveNote.style.color = '';
  programSaveNote.hidden = false;
  await loadPrograms();
  setTimeout(() => {
    closeProgramForm();
    programSaveNote.hidden = true;
  }, 1200);
});

// ---------- Communication (brouillon Gmail — aucun envoi automatique) ----------
// On ne fait jamais l'envoi nous-mêmes : on construit une URL de compose Gmail
// (view=cm) avec les destinataires en Cci, sujet et corps pré-remplis. Yassine
// relit et clique "Envoyer" lui-même depuis sa propre boîte Gmail.
let commSelectedIds = new Set();
const GMAIL_URL_SAFE_LENGTH = 1800; // marge conservatrice pour rester compatible tous navigateurs

// Compte Gmail depuis lequel Yassine envoie ses communications (Gravity Basketball).
// On force ce compte via "authuser" pour que le brouillon s'ouvre dans la bonne
// boîte même si plusieurs comptes Google sont connectés dans le navigateur.
const COMM_GMAIL_ACCOUNT = 'ballerz1514@gmail.com';

function buildGmailComposeUrl(bccList, subject, body) {
  const params = new URLSearchParams();
  params.set('view', 'cm');
  params.set('fs', '1');
  params.set('authuser', COMM_GMAIL_ACCOUNT);
  if (bccList.length) params.set('bcc', bccList.join(','));
  params.set('su', subject);
  params.set('body', body);
  return 'https://mail.google.com/mail/?' + params.toString();
}

// Découpe la liste de courriels en lots pour ne jamais dépasser une longueur
// d'URL sûre — chaque lot ouvre son propre brouillon Gmail.
function chunkEmailsForGmail(emails, subject, body) {
  const baseLength = buildGmailComposeUrl([], subject, body).length;
  const groups = [];
  let current = [];
  let currentLength = baseLength;
  emails.forEach((email) => {
    const addLength = encodeURIComponent(email).length + (current.length ? 3 : 0);
    if (current.length > 0 && currentLength + addLength > GMAIL_URL_SAFE_LENGTH) {
      groups.push(current);
      current = [];
      currentLength = baseLength;
    }
    current.push(email);
    currentLength += addLength;
  });
  if (current.length) groups.push(current);
  return groups;
}

function getCommFilteredRows() {
  let rows = filteredBySite(allBookings);
  const type = commTypeFilterEl.value;
  const status = commStatusFilterEl.value;
  if (type) rows = rows.filter((r) => r.type === type);
  if (status) rows = rows.filter((r) => r.status === status);
  return rows;
}

function updateCommTypeOptions() {
  const rows = filteredBySite(allBookings);
  const types = Array.from(new Set(rows.map((r) => r.type).filter(Boolean))).sort();
  const current = commTypeFilterEl.value;
  commTypeFilterEl.innerHTML =
    '<option value="">Tous les types</option>' +
    types.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  if (types.includes(current)) commTypeFilterEl.value = current;
}

function getSelectedCommEmails() {
  const rows = getCommFilteredRows();
  const emails = new Set();
  rows.forEach((r) => {
    if (commSelectedIds.has(r.id) && r.contact_email && r.contact_email.trim()) {
      emails.add(r.contact_email.trim());
    }
  });
  return Array.from(emails);
}

function renderCommTable() {
  const rows = getCommFilteredRows();
  commTbody.innerHTML =
    rows
      .map((r) => {
        const hasEmail = !!(r.contact_email && r.contact_email.trim());
        const checked = commSelectedIds.has(r.id) ? 'checked' : '';
        return `
      <tr>
        <td><input type="checkbox" class="comm-row-check" data-id="${r.id}" ${checked} ${hasEmail ? '' : 'disabled'}></td>
        <td>${escapeHtml(r.contact_name || '')}</td>
        <td>${hasEmail ? escapeHtml(r.contact_email) : '<span class="muted">pas de courriel</span>'}</td>
        <td>${escapeHtml(r.type || '')}</td>
        <td>${escapeHtml(r.status || '')}</td>
      </tr>`;
      })
      .join('') || '<tr><td colspan="5" class="empty-note">Aucun contact pour ces filtres.</td></tr>';

  commTbody.querySelectorAll('.comm-row-check').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) commSelectedIds.add(cb.dataset.id);
      else commSelectedIds.delete(cb.dataset.id);
      updateCommSelectAllState();
      updateCommSelectedCount();
      renderCommActions();
    });
  });
  updateCommSelectAllState();
  updateCommSelectedCount();
  renderCommActions();
}

function updateCommSelectAllState() {
  const rows = getCommFilteredRows().filter((r) => r.contact_email && r.contact_email.trim());
  commSelectAllEl.checked = rows.length > 0 && rows.every((r) => commSelectedIds.has(r.id));
  commSelectAllEl.disabled = rows.length === 0;
}

function updateCommSelectedCount() {
  const rows = getCommFilteredRows();
  const withEmail = rows.filter((r) => commSelectedIds.has(r.id) && r.contact_email && r.contact_email.trim()).length;
  commCountEl.textContent = `${commSelectedIds.size} sélectionné(s) — ${withEmail} avec courriel valide.`;
}

function renderCommActions() {
  const subject = commSubjectInput.value.trim() || 'Gravity Basketball';
  const body = commBodyInput.value || '';
  const emails = getSelectedCommEmails();

  if (emails.length === 0) {
    commActionsEl.innerHTML = '<p class="muted">Sélectionne au moins un contact avec un courriel.</p>';
    return;
  }

  const groups = chunkEmailsForGmail(emails, subject, body);
  const gmailButtons = groups
    .map((group, i) => {
      const url = buildGmailComposeUrl(group, subject, body);
      const label =
        groups.length > 1
          ? `Ouvrir dans Gmail — lot ${i + 1}/${groups.length} (${group.length})`
          : `Ouvrir dans Gmail (${group.length})`;
      return `<a href="${url}" target="_blank" rel="noopener" class="btn btn-primary">${escapeHtml(label)}</a>`;
    })
    .join('');

  commActionsEl.innerHTML =
    `<button type="button" class="btn btn-primary" id="comm-send-btn">📤 Envoyer via Gravity Mailer (${emails.length})</button>` +
    gmailButtons +
    `<button type="button" class="btn btn-ghost" id="comm-copy-btn">Copier la liste des courriels (${emails.length})</button>` +
    `<p class="muted" id="comm-send-note" hidden></p>`;

  document.getElementById('comm-copy-btn').addEventListener('click', () => {
    navigator.clipboard.writeText(emails.join(', ')).then(() => {
      const btn = document.getElementById('comm-copy-btn');
      const original = btn.textContent;
      btn.textContent = 'Copié !';
      setTimeout(() => { btn.textContent = original; }, 2000);
    });
  });

  document.getElementById('comm-send-btn').addEventListener('click', () => sendCommCampaign(emails, subject, body));
}

// Envoi réel de la campagne (un seul message, en Cci) via la fonction Netlify
// send-campaign, protégée par le jeton de session Supabase de l'admin connecté.
async function sendCommCampaign(emails, subject, body) {
  const btn = document.getElementById('comm-send-btn');
  const note = document.getElementById('comm-send-note');
  if (!confirm(`Envoyer ce message à ${emails.length} destinataire${emails.length > 1 ? 's' : ''} maintenant ? Cette action est irréversible.`)) {
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Envoi en cours...';
  note.hidden = true;

  try {
    const { data } = await supabase.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if (!token) throw new Error('Session expirée, reconnecte-toi.');

    const res = await fetch('/.netlify/functions/send-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subject, body, emails, site: activeSite }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'Échec de l\'envoi');

    note.textContent = `✅ Envoyé à ${result.sent} destinataire(s).`;
    note.style.color = 'var(--accent-light, #4caf50)';
    note.hidden = false;
  } catch (err) {
    note.textContent = `Erreur : ${err.message}`;
    note.style.color = '#ff6b6b';
    note.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = `📤 Envoyer via Gravity Mailer (${emails.length})`;
  }
}

commSelectAllEl.addEventListener('change', () => {
  const rows = getCommFilteredRows().filter((r) => r.contact_email && r.contact_email.trim());
  if (commSelectAllEl.checked) rows.forEach((r) => commSelectedIds.add(r.id));
  else rows.forEach((r) => commSelectedIds.delete(r.id));
  renderCommTable();
});

commTypeFilterEl.addEventListener('change', renderCommTable);
commStatusFilterEl.addEventListener('change', renderCommTable);
commSubjectInput.addEventListener('input', renderCommActions);
commBodyInput.addEventListener('input', renderCommActions);

// ---------- Rendu avis ----------
function starString(n) {
  return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n);
}

function renderReviews() {
  const rows = filteredBySite(allReviews);
  const pending = rows.filter((r) => !r.approved);
  const approved = rows.filter((r) => r.approved);

  pendingReviewsEl.innerHTML =
    pending
      .map(
        (r) => `
      <div class="review-mod-card" data-id="${r.id}">
        <div>
          <span class="site-badge ${r.site}">${SITE_LABELS[r.site] || r.site}</span>
          <span class="stars">${starString(r.rating)}</span>
          <p>${escapeHtml(r.comment || '')}</p>
          <p class="muted">— ${escapeHtml(r.contact_name || '')}</p>
        </div>
        <div class="review-mod-actions">
          <button class="btn btn-primary approve-btn">Approuver</button>
          <button class="btn btn-ghost reject-btn">Rejeter</button>
        </div>
      </div>`
      )
      .join('') || '<p class="empty-note">Aucun avis en attente.</p>';

  approvedReviewsEl.innerHTML =
    approved
      .map(
        (r) => `
      <div class="review-mod-card" data-id="${r.id}">
        <div>
          <span class="site-badge ${r.site}">${SITE_LABELS[r.site] || r.site}</span>
          <span class="stars">${starString(r.rating)}</span>
          <p>${escapeHtml(r.comment || '')}</p>
          <p class="muted">— ${escapeHtml(r.contact_name || '')}</p>
        </div>
        <div class="review-mod-actions">
          <button class="btn btn-ghost hide-btn">Retirer</button>
        </div>
      </div>`
      )
      .join('') || '<p class="empty-note">Aucun avis publié.</p>';

  pendingReviewsEl.querySelectorAll('.approve-btn').forEach((btn) => {
    btn.addEventListener('click', () => setReviewApproved(btn.closest('.review-mod-card').dataset.id, true));
  });
  pendingReviewsEl.querySelectorAll('.reject-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteReview(btn.closest('.review-mod-card').dataset.id));
  });
  approvedReviewsEl.querySelectorAll('.hide-btn').forEach((btn) => {
    btn.addEventListener('click', () => setReviewApproved(btn.closest('.review-mod-card').dataset.id, false));
  });
}

async function setReviewApproved(id, approved) {
  await supabase.from('reviews').update({ approved }).eq('id', id);
  const r = allReviews.find((x) => x.id === id);
  if (r) r.approved = approved;
  renderReviews();
}

async function deleteReview(id) {
  await supabase.from('reviews').delete().eq('id', id);
  allReviews = allReviews.filter((x) => x.id !== id);
  renderReviews();
}

// ---------- Championnat : inscriptions ----------
async function loadChampionshipRegistrations() {
  const { data, error } = await supabase
    .from('championship_registrations')
    .select('*, championship_teams(team_name, players)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (!error) championshipRegistrations = data || [];
  renderChampionshipRegistrations();
}

const REG_STATUSES = ['en_attente', 'paiement_declare', 'paye', 'rembourse', 'annule'];

function renderChampionshipRegistrations() {
  if (!championshipRegTbody) return;
  championshipRegTbody.innerHTML =
    championshipRegistrations
      .map((r) => {
        const date = new Date(r.created_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' });
        let sizes = '';
        if (r.type === 'individuel') {
          sizes = r.taille_chandail ? `Chandail ${r.taille_chandail} / Short ${r.taille_short || '—'}` : '—';
        } else if (r.championship_teams) {
          const players = r.championship_teams.players || [];
          sizes = players
            .map((p) => `${escapeHtml(p.name || '')}: ${p.taille_chandail || '—'}/${p.taille_short || '—'}`)
            .join('<br>') || '—';
        }
        return `
        <tr>
          <td>${r.type === 'equipe' ? `Équipe (${escapeHtml(r.championship_teams?.team_name || '')})` : 'Individuel'}</td>
          <td>${escapeHtml(r.contact_name || '')}</td>
          <td class="wrap">${escapeHtml(r.contact_email || '')}<br>${escapeHtml(r.contact_phone || '')}</td>
          <td>${r.amount_due} $</td>
          <td>
            <select class="status-select" data-id="${r.id}">
              ${REG_STATUSES.map((s) => `<option value="${s}" ${s === r.payment_status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
          <td class="wrap">${sizes}</td>
          <td>${date}</td>
        </tr>`;
      })
      .join('') || '<tr><td colspan="7" class="empty-note">Aucune inscription au championnat.</td></tr>';

  championshipRegTbody.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.id;
      const payment_status = sel.value;
      const r = championshipRegistrations.find((x) => x.id === id);
      if (payment_status === 'rembourse' && r && r.payment_status !== 'rembourse') {
        const ok = await recordRefund(r);
        if (!ok) {
          sel.value = r.payment_status;
          return;
        }
      }
      await supabase.from('championship_registrations').update({ payment_status }).eq('id', id);
      if (r) r.payment_status = payment_status;
      renderComptabilite();
    });
  });
}

// ---------- Championnat : recrutement (arbitres / coachs) ----------
// Même logique de modération que les avis (approved) mais avec un statut de
// suivi de contact en plus (nouveau/contacte/confirme), comme les inscriptions.
// L'admin ajoute une photo_url au moment d'approuver -- c'est ce qui fait
// apparaître la personne sur la page publique "Notre équipe" (voir
// public_referees() / public_coaches() côté Supabase, qui n'exposent que
// nom + photo des lignes approved = true).
const RECRUIT_STATUSES = ['nouveau', 'contacte', 'confirme'];

async function loadReferees() {
  const { data, error } = await supabase
    .from('referees')
    .select('*')
    .order('created_at', { ascending: false });
  if (!error) allReferees = data || [];
  renderReferees();
}

async function loadCoachApplications() {
  const { data, error } = await supabase
    .from('coach_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (!error) allCoachApplications = data || [];
  renderCoachApplications();
}

function recruitRowHtml(r) {
  const date = new Date(r.created_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' });
  return `
    <tr data-id="${r.id}">
      <td>${escapeHtml(r.full_name || '')}<div class="muted">${date}</div></td>
      <td class="wrap">${escapeHtml(r.email || '')}<br>${escapeHtml(r.phone || '')}</td>
      <td class="wrap">${escapeHtml(r.availability || '')}</td>
      <td class="wrap">${escapeHtml(r.experience || '')}</td>
      <td>
        <select class="recruit-status-select">
          ${RECRUIT_STATUSES.map((s) => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td style="text-align:center;">
        <input type="checkbox" class="recruit-approved-checkbox" ${r.approved ? 'checked' : ''}>
      </td>
      <td>
        <input type="url" class="recruit-photo-input" placeholder="https://..." value="${escapeHtml(r.photo_url || '')}" style="min-width:180px;">
      </td>
      <td><button type="button" class="btn btn-ghost recruit-save-btn">Enregistrer</button></td>
    </tr>`;
}

function wireRecruitTable(tbodyEl, table, records) {
  tbodyEl.querySelectorAll('.recruit-save-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('tr');
      const id = row.dataset.id;
      const status = row.querySelector('.recruit-status-select').value;
      const approved = row.querySelector('.recruit-approved-checkbox').checked;
      const photo_url = row.querySelector('.recruit-photo-input').value.trim() || null;
      btn.disabled = true;
      btn.textContent = 'Un instant...';
      const { error } = await supabase.from(table).update({ status, approved, photo_url }).eq('id', id);
      if (error) {
        btn.disabled = false;
        btn.textContent = 'Erreur — réessayer';
        return;
      }
      const rec = records.find((x) => x.id === id);
      if (rec) Object.assign(rec, { status, approved, photo_url });
      btn.textContent = 'Enregistré !';
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Enregistrer';
      }, 1200);
    });
  });
}

function renderReferees() {
  if (!refereesTbody) return;
  refereesTbody.innerHTML =
    allReferees.map(recruitRowHtml).join('') ||
    '<tr><td colspan="8" class="empty-note">Aucune candidature d\'arbitre pour l\'instant.</td></tr>';
  wireRecruitTable(refereesTbody, 'referees', allReferees);
}

function renderCoachApplications() {
  if (!coachesTbody) return;
  coachesTbody.innerHTML =
    allCoachApplications.map(recruitRowHtml).join('') ||
    '<tr><td colspan="8" class="empty-note">Aucune candidature de coach pour l\'instant.</td></tr>';
  wireRecruitTable(coachesTbody, 'coach_applications', allCoachApplications);
}

// ---------- Championnat : demandes de partenariat ----------
// Panneau séparé de "Recrutement" (demande explicite de Yassine, pour ne
// pas mélanger candidatures arbitres/coachs et propositions de partenariat
// d'entreprises). Reçues via /partenariat sur gravity-championnat.
const PARTNERSHIP_STATUSES = ['nouveau', 'contacte', 'confirme', 'decline'];

async function loadPartnershipApplications() {
  const { data, error } = await supabase
    .from('partnership_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (!error) allPartnershipApplications = data || [];
  renderPartnershipsTable();
}

function renderPartnershipsTable() {
  if (!partnershipsTbody) return;
  partnershipsTbody.innerHTML =
    allPartnershipApplications
      .map((r) => {
        const date = new Date(r.created_at).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' });
        return `
      <tr data-id="${r.id}">
        <td>${escapeHtml(r.company_name || '')}<div class="muted">${date}</div></td>
        <td>${escapeHtml(r.contact_name || '')}</td>
        <td class="wrap">${escapeHtml(r.email || '')}<br>${escapeHtml(r.phone || '')}</td>
        <td class="wrap">${escapeHtml(r.partnership_type || '')}</td>
        <td class="wrap">${escapeHtml(r.message || '')}</td>
        <td>
          <select class="partnership-status-select">
            ${PARTNERSHIP_STATUSES.map((s) => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td><button type="button" class="btn btn-ghost partnership-save-btn">Enregistrer</button></td>
      </tr>`;
      })
      .join('') || '<tr><td colspan="7" class="empty-note">Aucune demande de partenariat pour l\'instant.</td></tr>';

  partnershipsTbody.querySelectorAll('.partnership-save-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('tr');
      const id = row.dataset.id;
      const status = row.querySelector('.partnership-status-select').value;
      btn.disabled = true;
      btn.textContent = 'Un instant...';
      const { error } = await supabase.from('partnership_applications').update({ status }).eq('id', id);
      if (error) {
        btn.disabled = false;
        btn.textContent = 'Erreur — réessayer';
        return;
      }
      const rec = allPartnershipApplications.find((x) => x.id === id);
      if (rec) rec.status = status;
      btn.textContent = 'Enregistré !';
      renderSidebar();
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = 'Enregistrer';
      }, 1200);
    });
  });
}

// ---------- Championnat : classement ----------
async function loadStandings() {
  const { data, error } = await supabase
    .from('championship_standings')
    .select('*')
    .order('points', { ascending: false });
  if (!error) championshipStandings = data || [];
  renderStandings();
}

function renderStandings() {
  if (!standingsTbody) return;
  standingsTbody.innerHTML =
    championshipStandings
      .map(
        (s) => `
      <tr data-id="${s.id}">
        <td>${escapeHtml(s.team_name)}</td>
        <td><input type="number" min="0" class="standings-input" data-field="wins" value="${s.wins}" style="width:56px"></td>
        <td><input type="number" min="0" class="standings-input" data-field="losses" value="${s.losses}" style="width:56px"></td>
        <td><input type="number" min="0" class="standings-input" data-field="games_played" value="${s.games_played}" style="width:56px"></td>
        <td><input type="number" min="0" class="standings-input" data-field="points" value="${s.points}" style="width:56px"></td>
        <td><button class="btn btn-ghost standings-save-btn">Enregistrer</button></td>
      </tr>`
      )
      .join('') || '<tr><td colspan="6" class="empty-note">Aucune équipe. Ajoutes-en une ci-dessous.</td></tr>';

  standingsTbody.querySelectorAll('.standings-save-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('tr');
      const id = row.dataset.id;
      const payload = {};
      row.querySelectorAll('.standings-input').forEach((input) => {
        payload[input.dataset.field] = parseInt(input.value, 10) || 0;
      });
      payload.updated_at = new Date().toISOString();
      await supabase.from('championship_standings').update(payload).eq('id', id);
    });
  });
}

standingsAddForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const team_name = standingsNewTeamInput.value.trim();
  if (!team_name) return;
  await supabase.from('championship_standings').insert({ team_name });
  standingsNewTeamInput.value = '';
  await loadStandings();
});

// ---------- Championnat : reconnaissance des joueurs (MVP) ----------
function syncAwardTypeUI() {
  if (!awardTypeSelect) return;
  const isSaison = awardTypeSelect.value === 'saison';
  awardWeekField.style.display = isSaison ? 'none' : 'grid';
  awardWeekInput.required = !isSaison;
}
awardTypeSelect?.addEventListener('change', syncAwardTypeUI);
syncAwardTypeUI();

awardForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const selectedPlayer = championshipPlayers.find((p) => p.id === awardMvpPlayerSelect.value);
  const payload = {
    award_type: awardTypeSelect.value,
    season_label: awardSeasonInput.value.trim() || 'Saison 2026',
    week_label: awardTypeSelect.value === 'saison' ? null : awardWeekInput.value.trim(),
    mvp_player_id: awardMvpPlayerSelect.value || null,
    mvp_name: selectedPlayer ? selectedPlayer.full_name : null,
    mvp_team: selectedPlayer ? selectedPlayer.team_name : null,
    top_defenders: awardDefendersInput.value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
  const { error } = await supabase.from('championship_weekly_awards').insert(payload);
  awardSaveNote.textContent = error
    ? 'Erreur : ' + error.message
    : 'Publié ! Le joueur reçoit sa couronne et apparaît sur le Mur des légendes.';
  awardSaveNote.style.color = error ? '#ff6b6b' : '';
  awardSaveNote.hidden = false;
  if (!error) {
    awardDefendersInput.value = '';
    awardWeekInput.value = '';
  }
  setTimeout(() => { awardSaveNote.hidden = true; }, 4000);
});

// ---------- Championnat : ajouter une statistique ----------
async function loadChampionshipPlayers() {
  const { data, error } = await supabase
    .from('players')
    .select('id, full_name, team_name')
    .eq('program', 'championship')
    .order('full_name');
  if (!error) championshipPlayers = data || [];
  const options = championshipPlayers
    .map((p) => `<option value="${p.id}">${escapeHtml(p.full_name)}${p.team_name ? ' — ' + escapeHtml(p.team_name) : ''}</option>`)
    .join('') || '<option value="">Aucun joueur inscrit</option>';
  if (statPlayerSelect) statPlayerSelect.innerHTML = options;
  if (awardMvpPlayerSelect) awardMvpPlayerSelect.innerHTML = options;
}

statForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    player_id: statPlayerSelect.value,
    game_date: statDateInput.value,
    points: parseInt(statPointsInput.value, 10) || 0,
    assists: parseInt(statAssistsInput.value, 10) || 0,
    steals: parseInt(statStealsInput.value, 10) || 0,
  };
  const { error } = await supabase.from('player_stats').insert(payload);
  statSaveNote.textContent = error ? 'Erreur : ' + error.message : 'Statistique ajoutée !';
  statSaveNote.style.color = error ? '#ff6b6b' : '';
  statSaveNote.hidden = false;
  if (!error) statForm.reset();
  setTimeout(() => { statSaveNote.hidden = true; }, 4000);
});

// ---------- Clics sur le bandeau produit vedette ----------
async function loadClickStats() {
  if (!clickStatsRowEl) return;
  // On ne récupère que site + date : jamais d'IP ni de donnée personnelle,
  // et la lecture elle-même est déjà restreinte par RLS aux sites de cet admin.
  const { data, error } = await supabase
    .from('product_clicks')
    .select('site, created_at')
    .in('site', currentAdmin.sites)
    .order('created_at', { ascending: false })
    .limit(5000);

  if (error) {
    clickStatsRowEl.innerHTML = '';
    clickStatsTbodyEl.innerHTML = '';
    clickStatsEmptyEl.textContent = 'Erreur lors du chargement des statistiques.';
    clickStatsEmptyEl.hidden = false;
    return;
  }

  const clicks = data || [];
  if (clicks.length === 0) {
    clickStatsRowEl.innerHTML = '';
    clickStatsTbodyEl.innerHTML = '';
    clickStatsEmptyEl.hidden = false;
    if (clickStatsTableEl) clickStatsTableEl.hidden = true;
    return;
  }
  clickStatsEmptyEl.hidden = true;
  if (clickStatsTableEl) clickStatsTableEl.hidden = false;

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const last7Start = now - 7 * DAY;
  const prev7Start = now - 14 * DAY;

  const bySite = {};
  currentAdmin.sites.forEach((s) => { bySite[s] = { total: 0, last7: 0, prev7: 0 }; });

  let totalLast7 = 0;
  let totalPrev7 = 0;

  clicks.forEach((c) => {
    const t = new Date(c.created_at).getTime();
    const bucket = bySite[c.site] || (bySite[c.site] = { total: 0, last7: 0, prev7: 0 });
    bucket.total += 1;
    if (t >= last7Start) {
      bucket.last7 += 1;
      totalLast7 += 1;
    } else if (t >= prev7Start) {
      bucket.prev7 += 1;
      totalPrev7 += 1;
    }
  });

  const trend = totalPrev7 === 0
    ? (totalLast7 > 0 ? '+' + totalLast7 : '±0')
    : (totalLast7 >= totalPrev7 ? '+' : '') + (totalLast7 - totalPrev7);

  clickStatsRowEl.innerHTML = `
    <div class="stat-card"><div class="num">${clicks.length}</div><div class="label">Total</div></div>
    <div class="stat-card"><div class="num">${totalLast7}</div><div class="label">7 derniers jours</div></div>
    <div class="stat-card"><div class="num">${trend}</div><div class="label">Vs 7 jours précédents</div></div>
  `;

  clickStatsTbodyEl.innerHTML = Object.entries(bySite)
    .map(([site, s]) => `
      <tr>
        <td>${SITE_LABELS[site] || site}</td>
        <td>${s.total}</td>
        <td>${s.last7}</td>
        <td>${s.prev7}</td>
      </tr>
    `)
    .join('');
}

// ---------- Produit vedette ----------
productExtractBtn.addEventListener('click', async () => {
  const url = productUrlInput.value.trim();
  if (!url) return;
  productExtractStatus.hidden = false;
  productExtractStatus.textContent = 'Extraction en cours...';
  try {
    const res = await fetch(SCRAPE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      productExtractStatus.textContent = data.error || "Échec de l'extraction — remplis les champs manuellement.";
      return;
    }
    productTitleInput.value = data.title || '';
    productPriceInput.value = data.price || '';
    productImageInput.value = data.image_url || '';
    productExtractStatus.textContent = 'Extraction réussie — vérifie les champs avant d\'enregistrer.';
  } catch {
    productExtractStatus.textContent = "Échec de l'extraction — remplis les champs manuellement.";
  }
});

productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const site = productSiteSelect.value || null;
  const payload = {
    site,
    title: productTitleInput.value.trim(),
    price: productPriceInput.value.trim(),
    image_url: productImageInput.value.trim() || null,
    affiliate_link: productUrlInput.value.trim(),
    active: productActiveInput.checked,
    updated_at: new Date().toISOString(),
  };

  // Upsert manuel : un produit actif par site (ou global si site=null)
  const { data: existing } = await supabase
    .from('featured_product')
    .select('id')
    .eq('site', site)
    .limit(1)
    .maybeSingle();

  let error;
  if (existing) {
    ({ error } = await supabase.from('featured_product').update(payload).eq('id', existing.id));
  } else {
    ({ error } = await supabase.from('featured_product').insert(payload));
  }

  if (error) {
    productSaveNote.textContent = 'Erreur : ' + error.message;
    productSaveNote.style.color = '#ff6b6b';
  } else {
    productSaveNote.textContent = 'Enregistré ! Le bandeau sera mis à jour sur le site.';
    productSaveNote.style.color = '';
  }
  productSaveNote.hidden = false;
  setTimeout(() => { productSaveNote.hidden = true; }, 4000);
});

// ---------- Comptabilité ----------
async function loadFinanceEntries() {
  const { data, error } = await supabase
    .from('finance_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);
  if (!error) allFinanceEntries = data || [];
  renderComptabilite();
}

function renderComptabilite() {
  if (financeStatsRowEl) {
    const champPaid = championshipRegistrations
      .filter((r) => r.payment_status === 'paye')
      .reduce((sum, r) => sum + (Number(r.amount_due) || 0), 0);
    const manualRevenu = allFinanceEntries
      .filter((e) => e.type === 'revenu')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalDepenses = allFinanceEntries
      .filter((e) => e.type === 'depense')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalRevenu = champPaid + manualRevenu;
    const solde = totalRevenu - totalDepenses;
    financeStatsRowEl.innerHTML = `
      <div class="stat-card"><div class="num">${champPaid.toFixed(2)} $</div><div class="label">Inscriptions payées</div></div>
      <div class="stat-card"><div class="num">${manualRevenu.toFixed(2)} $</div><div class="label">Autres revenus</div></div>
      <div class="stat-card"><div class="num">${totalDepenses.toFixed(2)} $</div><div class="label">Dépenses (incl. remboursements)</div></div>
      <div class="stat-card"><div class="num" style="color:${solde >= 0 ? '' : '#ff6b6b'}">${solde.toFixed(2)} $</div><div class="label">Solde net</div></div>
    `;
  }

  if (financeTbody) {
    financeTbody.innerHTML =
      allFinanceEntries
        .map((e) => `
        <tr>
          <td>${e.entry_date}</td>
          <td><span class="program-status-pill ${e.type === 'revenu' ? 'active' : 'inactive'}">${e.type === 'revenu' ? 'Revenu' : 'Dépense'}</span></td>
          <td>${escapeHtml(e.category || '—')}</td>
          <td>${e.site ? `<span class="site-badge ${e.site}">${SITE_LABELS[e.site] || e.site}</span>` : '<span class="muted">Global</span>'}</td>
          <td>${Number(e.amount).toFixed(2)} $</td>
          <td class="wrap">${escapeHtml(e.description || '—')}</td>
          <td><button type="button" class="btn btn-ghost finance-delete-btn" data-id="${e.id}">Supprimer</button></td>
        </tr>`)
        .join('') || '<tr><td colspan="7" class="empty-note">Aucune transaction pour l\'instant.</td></tr>';

    financeTbody.querySelectorAll('.finance-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('Supprimer cette transaction ?')) return;
        btn.disabled = true;
        const { error } = await supabase.from('finance_entries').delete().eq('id', btn.dataset.id);
        if (error) { alert('Erreur : ' + error.message); btn.disabled = false; return; }
        allFinanceEntries = allFinanceEntries.filter((e) => e.id !== btn.dataset.id);
        renderComptabilite();
      });
    });
  }

  renderRefunds();
}

function renderRefunds() {
  if (!refundsTbody) return;
  const rows = championshipRegistrations.filter((r) => r.payment_status === 'paye' || r.payment_status === 'rembourse');
  refundsTbody.innerHTML =
    rows
      .map((r) => `
        <tr>
          <td>${escapeHtml(r.contact_name || '')}</td>
          <td class="wrap">${escapeHtml(r.contact_email || '')}<br>${escapeHtml(r.contact_phone || '')}</td>
          <td>${r.amount_due} $</td>
          <td>${r.payment_status === 'rembourse' ? '<span class="program-status-pill inactive">Remboursé</span>' : '<span class="program-status-pill active">Payé</span>'}</td>
          <td>${r.payment_status === 'paye' ? `<button type="button" class="btn btn-ghost refund-btn" data-id="${r.id}">Rembourser</button>` : '—'}</td>
        </tr>`)
      .join('') || '<tr><td colspan="5" class="empty-note">Aucune inscription payée pour l\'instant.</td></tr>';

  refundsTbody.querySelectorAll('.refund-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = championshipRegistrations.find((x) => x.id === btn.dataset.id);
      if (!r) return;
      btn.disabled = true;
      const ok = await recordRefund(r);
      if (ok) {
        await supabase.from('championship_registrations').update({ payment_status: 'rembourse' }).eq('id', r.id);
        r.payment_status = 'rembourse';
        renderChampionshipRegistrations();
        renderComptabilite();
      }
      btn.disabled = false;
    });
  });
}

// Enregistre la dépense correspondant à un remboursement dans finance_entries.
// Retourne true si l'enregistrement a réussi (ou a été confirmé par l'admin), false si annulé/échoué.
async function recordRefund(registration) {
  const input = prompt(
    `Montant à rembourser à ${registration.contact_name} ?`,
    String(registration.amount_due)
  );
  if (input === null) return false;
  const amount = parseFloat(input.replace(',', '.'));
  if (isNaN(amount) || amount <= 0) {
    alert('Montant invalide.');
    return false;
  }
  const { data, error } = await supabase
    .from('finance_entries')
    .insert({
      site: 'gravity-basketball',
      type: 'depense',
      category: 'remboursement',
      amount,
      entry_date: new Date().toISOString().slice(0, 10),
      description: `Remboursement — ${registration.contact_name} (championnat)`,
    })
    .select()
    .single();
  if (error) {
    alert('Erreur en enregistrant le remboursement : ' + error.message);
    return false;
  }
  allFinanceEntries.unshift(data);
  return true;
}

if (financeForm) {
  financeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      type: financeTypeSelect.value,
      site: financeSiteSelect.value || null,
      category: financeCategoryInput.value.trim() || null,
      amount: parseFloat(financeAmountInput.value),
      entry_date: financeDateInput.value,
      description: financeDescriptionInput.value.trim() || null,
    };
    if (isNaN(payload.amount) || payload.amount <= 0) {
      alert('Montant invalide.');
      return;
    }
    const { data, error } = await supabase.from('finance_entries').insert(payload).select().single();
    if (error) {
      financeSaveNote.textContent = 'Erreur : ' + error.message;
      financeSaveNote.style.color = '#ff6b6b';
    } else {
      allFinanceEntries.unshift(data);
      renderComptabilite();
      financeForm.reset();
      financeDateInput.value = new Date().toISOString().slice(0, 10);
      financeSaveNote.textContent = 'Ajouté !';
      financeSaveNote.style.color = '';
    }
    financeSaveNote.hidden = false;
    setTimeout(() => { financeSaveNote.hidden = true; }, 4000);
  });
}

// ---------- Utilitaire ----------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
