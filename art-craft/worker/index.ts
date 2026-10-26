// Cloudflare Workers (parcours « Workers » du tableau de bord) : sert le site statique de dist/
// et les deux fonctions serveur, avec le même code que Netlify et Cloudflare Pages.
import { handleCoach } from '../netlify/functions/coach.mts';
import { handleMusic } from '../netlify/functions/music.mjs';
import { handleVideo } from '../netlify/functions/video.mts';
import { handleChaine, runAudit } from './chaine.ts';

type Env = {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  // Workers AI (IA gratuite de secours, voir netlify/lib/free-ai.ts).
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
  // Stockage du Gardien de chaîne YouTube (connexion, réglages, dernier rapport).
  CHAINE?: Parameters<typeof runAudit>[0];
} & Record<string, unknown>;

const getter = (env: Env) => (name: string) => (typeof env[name] === 'string' ? (env[name] as string) : undefined);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/coach') return handleCoach(request, getter(env), env.AI);
    if (pathname.startsWith('/api/chaine/')) return handleChaine(request, env.CHAINE, getter(env));
    if (pathname === '/api/music') return handleMusic(request, { maxBytes: 20e6 });
    if (pathname === '/api/video') return handleVideo(request, name => (typeof env[name] === 'string' ? (env[name] as string) : undefined));
    return env.ASSETS.fetch(request);
  },
  // Tous les 2 jours (cron du wrangler.toml) : passage du Gardien de chaîne YouTube.
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    const auth = env.CHAINE && (await env.CHAINE.get('auth', 'json'));
    if (auth) ctx.waitUntil(runAudit(env.CHAINE!, getter(env)));
  },
};
