// Cloudflare Pages : /api/video → même code que le Worker (netlify/functions/video.mts).
// Variables facultatives : HF_TOKEN (token Hugging Face gratuit « Read ») et GEMINI_API_KEY.
import { handleVideo } from '../../netlify/functions/video.mts';

export const onRequest = ({ request, env }: { request: Request; env: Record<string, unknown> }) =>
  handleVideo(request, name => (typeof env[name] === 'string' ? (env[name] as string) : undefined));
