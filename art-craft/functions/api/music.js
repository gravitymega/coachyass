// Cloudflare Pages : /api/music → même relais Openverse que la fonction Netlify.
// Pas de limite de 6 Mo par réponse ici : les morceaux jusqu'à 20 Mo passent.
import { handleMusic } from '../../netlify/functions/music.mjs';

export const onRequest = ({ request }) => handleMusic(request, { maxBytes: 20e6 });
