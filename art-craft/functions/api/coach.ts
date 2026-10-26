// Cloudflare Pages : /api/coach → même code que la fonction Netlify (netlify/functions/coach.mts).
// Variables à définir dans Cloudflare (Settings → Variables and Secrets) : ART_CRAFT_PASSWORD
// et GEMINI_API_KEY (clé gratuite) ; ANTHROPIC_API_KEY seulement si on accepte de payer l'API.
import { handleCoach } from '../../netlify/functions/coach.mts';

type Ai = { run: (model: string, input: unknown) => Promise<unknown> };
export const onRequest = ({ request, env }: { request: Request; env: Record<string, unknown> }) =>
  handleCoach(request, name => (typeof env[name] === 'string' ? (env[name] as string) : undefined), env.AI as Ai | undefined);
