// Détecteur « made_basket » de Roboflow Universe (baskebtalldata/made_basket, 2 505 images),
// appelé par le mode « paniers » de la fonction coach avant les IA générales.
// Roboflow Hosted API, plan gratuit (clé ROBOFLOW_API_KEY, sans carte) : une demande par image,
// réponse { predictions: [{ x, y, width, height, confidence, class }], image: { width, height } }.
// Variables facultatives : ROBOFLOW_MODEL (défaut « made_basket/2 ») et ROBOFLOW_MADE_CLASS
// (nom exact de la classe « panier marqué » si elle ne contient pas made / make / score).
// (Rangé hors de netlify/functions/ : Netlify y ferait sinon une fonction à part.)

export const ROBOFLOW_URL = "https://serverless.roboflow.com";
export const ROBOFLOW_MODEL = "made_basket/2";
const MIN_CONF = 0.5;
const PARALLEL = 6; // demandes simultanées (le Worker gratuit permet 50 sous-demandes au total)

type Frame = { t: number; data: string; label?: string };
type Prediction = { x: number; y: number; width?: number; height?: number; confidence: number; class: string };
type Detection = { predictions?: Prediction[]; image?: { width?: number; height?: number } };
export type Verdict = { moment: number; panier: boolean; t: number; x: number; y: number; confiance: "haute" | "moyenne" | "basse" };

export class RoboflowError extends Error {}

// Classe « panier marqué » : nom donné, sinon made / make / score / swish.
export function isMadeClass(name: string, wanted?: string) {
  if (wanted) return name.toLowerCase() === wanted.toLowerCase();
  return /made|make|score|swish/i.test(name);
}

async function detect(key: string, model: string, frame: Frame): Promise<Detection> {
  let res: Response;
  try {
    res = await fetch(`${ROBOFLOW_URL}/${model}?api_key=${encodeURIComponent(key)}&confidence=${Math.round(MIN_CONF * 100)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: frame.data,
    });
  } catch {
    throw new RoboflowError("Roboflow injoignable");
  }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new RoboflowError("Clé ROBOFLOW_API_KEY refusée (ou quota gratuit du mois épuisé)");
    throw new RoboflowError(res.status === 429 ? "Quota gratuit de Roboflow épuisé" : `Roboflow indisponible (${res.status})`);
  }
  return res.json();
}

// Images d'un lot de moments (étiquette « Moment k ») → un verdict par moment, même format que l'IA.
// Panier = au moins une image où la classe « panier marqué » est vue ; t = la première de ces images,
// x / y = centre de la boîte (de 0 à 1), pour le zoom vers le cercle.
export async function madeBasketVerdicts(frames: Frame[], { key, model = ROBOFLOW_MODEL, madeClass }: { key: string; model?: string; madeClass?: string }) {
  const results: Detection[] = new Array(frames.length);
  for (let i = 0; i < frames.length; i += PARALLEL) {
    const part = frames.slice(i, i + PARALLEL);
    (await Promise.all(part.map((f) => detect(key, model, f)))).forEach((r, k) => { results[i + k] = r; });
  }
  const labels = [...new Set(frames.map((f) => f.label || "Moment 1"))];
  const moments: Verdict[] = labels.map((label, idx) => {
    let best: { t: number; x: number; y: number; conf: number } | null = null;
    frames.forEach((f, i) => {
      if ((f.label || "Moment 1") !== label) return;
      const r = results[i] || {};
      const w = r.image?.width || 0, h = r.image?.height || 0;
      for (const p of r.predictions || []) {
        if (!isMadeClass(p.class, madeClass) || p.confidence < MIN_CONF) continue;
        // La première image où le panier est vu donne l'instant ; la confiance retenue est la meilleure.
        const hit = { t: f.t, x: w ? p.x / w : 0.5, y: h ? p.y / h : 0.5, conf: p.confidence };
        if (!best) best = hit;
        else best = { ...best, conf: Math.max(best.conf, hit.conf) };
      }
    });
    const n = Number(/(\d+)/.exec(label)?.[1]) || idx + 1;
    if (!best) return { moment: n, panier: false, t: 0, x: 0.5, y: 0.5, confiance: "haute" };
    const b = best as { t: number; x: number; y: number; conf: number };
    return { moment: n, panier: true, t: b.t, x: b.x, y: b.y, confiance: b.conf >= 0.7 ? "haute" : "moyenne" };
  });
  return { moments };
}
