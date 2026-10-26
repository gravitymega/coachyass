// Cloudflare Workers (parcours « Workers » du tableau de bord) : sert le site statique de dist/
// et les deux fonctions serveur, avec le même code que Netlify et Cloudflare Pages.
import { handleCoach } from '../netlify/functions/coach.mts';
import { handleMusic } from '../netlify/functions/music.mjs';
import { handleVideo } from '../netlify/functions/video.mts';

type Env = {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  // Workers AI (IA gratuite de secours, voir netlify/lib/free-ai.ts).
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
} & Record<string, unknown>;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/coach') return handleCoach(request, name => (typeof env[name] === 'string' ? (env[name] as string) : undefined), env.AI);
    if (pathname === '/api/music') return handleMusic(request, { maxBytes: 20e6 });
    if (pathname === '/api/video') return handleVideo(request, name => (typeof env[name] === 'string' ? (env[name] as string) : undefined));
    return env.ASSETS.fetch(request);
  },
};
