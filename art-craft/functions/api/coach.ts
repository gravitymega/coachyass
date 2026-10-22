// Cloudflare Pages : /api/coach → même code que la fonction Netlify (netlify/functions/coach.mts).
// Variables à définir dans Cloudflare (Settings → Variables and Secrets) : ART_CRAFT_PASSWORD
// et, seulement si on accepte de payer l'API, ANTHROPIC_API_KEY.
import { handleCoach } from '../../netlify/functions/coach.mts';

export const onRequest = ({ request, env }: { request: Request; env: Record<string, string | undefined> }) =>
  handleCoach(request, name => env[name]);
