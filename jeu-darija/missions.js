// Les missions de Papa et Maman : chaque jour, 3 petites missions par enfant.
// Une mission « en vrai » (darija ou religion), une pour aider ou bouger, et une dans le jeu
// (celle-ci se valide toute seule). Les missions en vrai sont confirmées par un parent.
// Logique pure, testable avec Node.
import { rng, shuffle } from './core.js';

// from : qui donne la mission. who : 'all', 'older' (sait lire, 7 ans) ou 'young' (5 ans).
// {frere} est remplacé par le prénom de l'autre enfant (mission retirée s'il n'y en a pas).
const M = (id, cat, from, t, who = 'all', extra = {}) => ({ id, cat, from, t, who, ...extra });

export const DAILY = [
  // Darija (en vrai)
  M('d-sbah', 'darija', 'papa', 'Dis « Sbah el khir » à papa et à maman ce matin.'),
  M('d-merci', 'darija', 'maman', 'Dis « Choukran » ou « Saha » trois fois aujourd’hui.'),
  M('d-nuit', 'darija', 'maman', 'Dis « Tesbah 3la khir » à papa et à maman avant de dormir.'),
  M('d-compte', 'darija', 'papa', 'Compte jusqu’à 5 en darija avec papa.', 'young'),
  M('d-compte10', 'darija', 'papa', 'Compte jusqu’à 10 en darija avec papa.', 'older'),
  M('d-couleurs', 'darija', 'maman', 'Montre 3 objets et dis leur couleur en darija.'),
  M('d-jetaime', 'darija', 'maman', 'Dis « Kanbghik » à papa et « Nhabek » à maman.'),
  M('d-labas', 'darija', 'papa', 'Appelle un grand-parent et demande « Labas ? » ou « Wach rak ? ».'),
  M('d-repas', 'darija', 'maman', 'Pendant le repas, dis le nom de 3 aliments en darija.', 'older'),
  // Religion (en vrai)
  M('r-bismillah', 'deen', 'papa', 'Dis « Bismillah » avant de manger.'),
  M('r-hamdoulah', 'deen', 'maman', 'Dis « Alhamdulillah » à la fin du repas.'),
  M('r-salam', 'deen', 'papa', 'Dis « Assalamou alaykoum » en entrant à la maison.'),
  M('r-fatiha', 'deen', 'papa', 'Récite la sourate Al-Fatiha avec papa ou maman.', 'older'),
  M('r-priere', 'deen', 'papa', 'Fais une prière à côté de papa ou de maman.', 'older'),
  M('r-tapis', 'deen', 'maman', 'Mets ton petit tapis à côté de papa ou maman pendant la prière.', 'young'),
  M('r-partage', 'deen', 'maman', 'Partage ton goûter ou un jouet : c’est une sadaqa !'),
  M('r-sourate', 'deen', 'maman', 'Écoute une petite sourate avant de dormir.'),
  // Aider à la maison
  M('a-jouets', 'maison', 'maman', 'Range tes jouets tout seul.'),
  M('a-table', 'maison', 'papa', 'Aide à mettre la table.'),
  M('a-lit', 'maison', 'maman', 'Fais ton lit ce matin.', 'older'),
  M('a-courses', 'maison', 'papa', 'Aide papa ou maman à ranger les courses.'),
  M('a-chaussures', 'maison', 'maman', 'Range tes chaussures à leur place.', 'young'),
  // Famille et gentillesse
  M('f-calin', 'famille', 'maman', 'Fais un gros câlin à papa et à maman.'),
  M('f-dessin', 'famille', 'papa', 'Fais un dessin pour tes grands-parents.'),
  M('f-frere', 'famille', 'maman', 'Joue gentiment avec {frere}.'),
  M('f-gentil', 'famille', 'papa', 'Dis un mot gentil à {frere}.'),
  // Bouger et apprendre en vrai
  M('s-sauts', 'sport', 'papa', 'Fais 10 sauts comme Fifi la fennec !'),
  M('s-panier', 'sport', 'papa', 'Fais 10 tirs au panier, ou dans le panier à linge !'),
  M('s-danse', 'sport', 'maman', 'Danse sur le rythme de la darbouka : doum tek tek !'),
  M('e-livre', 'ecole', 'maman', 'Lis une page d’un livre à voix haute.', 'older'),
  M('e-fourchettes', 'ecole', 'papa', 'Compte les fourchettes en mettant la table.', 'older'),
  M('e-rond', 'ecole', 'maman', 'Trouve 3 choses rondes dans la maison.', 'young'),
  // Dans le jeu (se valident toutes seules)
  M('j-niveau', 'jeu', 'papa', 'Réussis un niveau dans l’usine de Hbibiti.', 'all', { auto: 'level' }),
  M('j-histoire', 'jeu', 'maman', 'Écoute une histoire de Hbibiti jusqu’au bout.', 'all', { auto: 'tale' }),
  M('j-poppy', 'jeu', 'papa', 'Fais un niveau dans le coin Poppy Playtime.', 'all', { auto: 'poppy', poppy: true }),
  M('j-ecole', 'jeu', 'maman', 'Fais un niveau à l’Atelier des nombres ou à la Bibliothèque.', 'all', { auto: 'school' }),
  M('j-defi', 'jeu', 'papa', 'Joue au Défi éclair.', 'older', { auto: 'defi', minLevels: 1 }),
];

const GROUPS = [['darija', 'deen'], ['maison', 'famille', 'sport', 'ecole'], ['jeu']];

// Les 3 missions du jour d'un enfant : toujours les mêmes pour une date, différentes chaque jour.
export function dailyMissions(kid, date, { sibling = null, poppy = true, levels = 0 } = {}) {
  let seed = 0;
  for (const c of `${date}:${kid.id}`) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const r = rng(seed || 1);
  const ok = (m) => (m.who === 'all' || (m.who === 'older') === !!kid.older)
    && (!m.t.includes('{frere}') || sibling)
    && (!m.poppy || poppy)
    && (m.minLevels || 0) <= levels;
  return GROUPS.map((cats) => {
    const pool = DAILY.filter((m) => cats.includes(m.cat) && ok(m));
    const m = shuffle(pool, r)[0];
    return { ...m, t: m.t.replace('{frere}', sibling || '') };
  });
}

// État du jour (se remet à zéro chaque jour).
export function dailyState(progress, date) {
  if (progress.daily?.date !== date) progress.daily = { date, done: {} };
  return progress.daily;
}

// Une partie terminée valide les missions de jeu correspondantes. Renvoie les missions validées.
export function autoComplete(progress, missions, date, event) {
  const st = dailyState(progress, date);
  const done = missions.filter((m) => m.auto && !st.done[m.id] && (m.auto === event.kind || (m.auto === 'level' && event.kind !== 'tale' && event.kind !== 'defi') || (m.auto === 'school' && event.school)));
  for (const m of done) st.done[m.id] = true;
  return done;
}
