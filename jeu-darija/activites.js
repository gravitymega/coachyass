// La liste des activités proposées sur la carte. Les parents peuvent couper chacune dans les réglages.
import { tracer, sourates, miroir, duel } from './act-ecole.js';
import { voyage, cuisine, noms, marche, priere } from './act-monde.js';
import { foot, basket, studio, animal } from './act-jeux.js';
import { photos, messages } from './act-famille.js';

const A = (id, icon, title, desc, open, extra = {}) => ({ id, icon, title, desc, open, ...extra });
export const ACTS = [
  A('construire', '🏗️', 'Construire', 'Bâtis ta maison dans la ville avec tes pièces', (ctx) => ctx.openVille({ build: true })),
  A('tracer', '✍️', 'Tracer les lettres', 'Écris les lettres arabes avec ton doigt', tracer),
  A('sourates', '📖', 'Petites sourates', 'Al-Fatiha, Al-Ikhlas… verset par verset', sourates),
  A('miroir', '🎤', 'Le miroir des mots', 'Dis le mot et compare avec Papa ou Maman', miroir),
  A('ramadan', '🌙', 'Ramadan dans la ville', 'La ville de nuit, avec ses lanternes', (ctx) => ctx.openVille({ night: true })),
  A('duel', '👨‍👧', 'Duel en famille', 'Papa ou Maman contre toi !', duel),
  A('voyage', '🗺️', 'Voyage au bled', 'Casablanca, Fès, Alger, Oran… et ton passeport', voyage),
  A('cuisine', '🍲', 'La cuisine de Hbibiti', 'Prépare le msemen, la harira, le couscous', cuisine),
  A('noms', '🕌', 'Les 99 noms d’Allah', 'Un nouveau nom chaque jour', noms),
  A('marche', '🧮', 'Le marché au souk', 'Achète, paie et rends la monnaie', marche),
  A('priere', '⏰', 'Les heures de prière', 'La prochaine prière à la maison', priere),
  A('foot', '⚽', 'Le championnat d’Assad', 'Raja, Wydad, MCA, JSK : à toi de marquer !', foot),
  A('basket', '🏀', 'Le basket de Fifi', 'Vise et tire : des lancers francs', basket),
  A('studio', '🎵', 'Le studio de musique', 'Darbouka, bendir et qraqeb', studio),
  A('animal', '🧸', 'Mon animal', 'Un chat ou un chameau à soigner', animal),
  A('photos', '📸', 'Qui c’est ?', 'Les photos de la famille, en darija', photos),
  A('messages', '📞', 'Les messages', 'Les messages vocaux des grands-parents', messages),
];
export function openAct(id, ctx, opts) {
  const a = ACTS.find((x) => x.id === id);
  if (a) a.open(ctx, opts);
}
