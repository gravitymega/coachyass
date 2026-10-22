// Connexion Google partagée par les modules d'Art craft (Google Drive, YouTube).
// Google Identity Services, directement dans le navigateur : aucun secret. L'identifiant
// client OAuth (GOOGLE_CLIENT_ID) est public par nature ; il doit seulement autoriser
// l'adresse du site (https://coachyass.moqtad6.workers.dev, et l'ancienne adresse Netlify si elle sert
// encore) dans la console Google Cloud.
export const GOOGLE_CLIENT_ID = '';

const tokens = new Map(); // permission → { value, expires }

function loadGis() {
  if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Connexion Google indisponible (script bloqué ?)'));
    document.head.appendChild(s);
  });
}

// Jeton encore valide pour cette permission (sans ouvrir de fenêtre), ou null.
export function cachedToken(scope) {
  const t = tokens.get(scope);
  return t && t.expires > Date.now() + 60e3 ? t : null;
}

// Doit être appelé pendant un clic : Google ouvre une fenêtre de connexion.
// Renvoie { value, expires }. label : nom du service, pour les messages d'erreur.
export async function googleToken(scope, label = 'Google') {
  const ok = cachedToken(scope);
  if (ok) return ok;
  if (!GOOGLE_CLIENT_ID) throw new Error(`${label} n'est pas encore configuré (identifiant client Google manquant).`);
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope,
      callback: r => {
        if (r.error) return reject(new Error(r.error === 'access_denied' ? `Accès à ${label} refusé` : r.error));
        const t = { value: r.access_token, expires: Date.now() + (r.expires_in || 3600) * 1000 };
        tokens.set(scope, t);
        resolve(t);
      },
      error_callback: e => reject(new Error(e && e.type === 'popup_closed' ? 'Fenêtre Google fermée' : 'Connexion Google impossible')),
    });
    client.requestAccessToken({ prompt: '' });
  });
}
