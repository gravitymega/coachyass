// Retouche photo : services que la page recevait de Claude quand elle était un artifact,
// remplacés sur le site Art craft (window.artcraftRuntime.use, même forme qu'avant) :
//   - « sample » : Claude par la fonction coach.mts (mode « photo », mot de passe Art craft) ;
//   - « mcp »    : Google Drive par l'API Drive v3 et la connexion Google d'Art craft
//                  (permission drive.file : l'outil ne voit que les fichiers qu'il crée) ;
//   - « downloads » : absent, la page télécharge alors directement dans le navigateur.
// Script classique (pas un module) : il doit exister avant retouche.js.
(() => {
  const PASS_KEY = 'artcraft-voice-password'; // même mot de passe mémorisé que l'Analyse tactique
  const ENDPOINT = '/api/coach';
  const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FOLDER = 'application/vnd.google-apps.folder';

  let password = '';
  try { password = localStorage.getItem(PASS_KEY) || ''; } catch { /* stockage indisponible */ }
  let ready = null; // vérification du mot de passe en cours ou faite

  const fail = code => Object.assign(new Error(code), { code });
  const blobB64 = b => new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onload = () => res(String(rd.result).split(',')[1]);
    rd.onerror = rej;
    rd.readAsDataURL(b);
  });

  async function ping(pw) {
    const res = await fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-art-password': pw }, body: JSON.stringify({ ping: true }),
    }).catch(() => null);
    if (!res) throw fail('server');
    if (res.status === 401) throw fail('bad_password');
    if (!res.ok) throw fail('server');
    const j = await res.json().catch(() => ({}));
    if (!j.ai) throw fail('no_key');
  }

  // Envoie la demande à Claude et lit la réponse en flux (NDJSON : {"d": …} puis {"end"} ou {"error"}).
  async function ask(prompt, opts = {}, json = false) {
    const frames = await Promise.all((opts.images || []).slice(0, 1).map(async (b, i) => ({ t: i, data: await blobB64(b) })));
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-art-password': password },
      body: JSON.stringify({ mode: 'photo', prompt, json, frames }),
    }).catch(() => null);
    if (!res) throw fail('server');
    if (res.status === 401) throw fail('not_granted');
    if (!res.ok) throw fail('server');
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let k;
      while ((k = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, k);
        buf = buf.slice(k + 1);
        if (!line.trim()) continue;
        const m = JSON.parse(line);
        if (m.d) { text += m.d; if (opts.onText) opts.onText({ text }); }
        if (m.error) throw fail(/refus/i.test(m.error) ? 'refused' : /Trop de demandes|Quota/.test(m.error) ? 'rate_limited' : 'server');
      }
    }
    return text;
  }

  function sampler() {
    const fn = async (prompt, opts) => ({ text: await ask(prompt, opts, false) });
    fn.json = async (prompt, opts) => {
      const t = (await ask(prompt, opts, true)).replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
      try { return JSON.parse(t); } catch { /* texte autour du JSON */ }
      const m = t.match(/\{[\s\S]*\}/);
      if (m) try { return JSON.parse(m[0]); } catch { /* illisible */ }
      throw fail('invalid_json');
    };
    fn.limits = async () => ({ images: true });
    return fn;
  }

  // ---------- Google Drive (mêmes outils que le connecteur : create_file, share_file) ----------
  async function token() {
    const { googleToken } = await import('./google-auth.js');
    try { return (await googleToken(DRIVE_SCOPE, 'Google Drive')).value; } catch (e) {
      throw fail(/refusé|fermée/.test(e.message) ? 'consent_required' : 'not_granted');
    }
  }
  async function drive(url, init) {
    const t = await token();
    const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, ...(init.headers || {}) } });
    const j = await res.json().catch(() => ({}));
    if (res.status === 401) throw fail('needs_reauth');
    if (res.status === 429) throw fail('rate_limited');
    if (!res.ok) throw fail(res.status >= 500 ? 'server_unavailable' : 'tool_error');
    return j;
  }
  function b64Blob(s, type) {
    const b = atob(s), a = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i);
    return new Blob([a], { type });
  }
  async function createFile(input) {
    const meta = { name: input.title, mimeType: input.contentMimeType };
    if (input.parentId) meta.parents = [input.parentId];
    if (input.contentMimeType === FOLDER) {
      const f = await drive('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(meta),
      });
      return { id: f.id, viewUrl: f.webViewLink };
    }
    const c = input.base64Content;
    const blob = c && c.$file ? c.$file.data : b64Blob(String(c || ''), input.contentMimeType);
    const bd = 'artcraft' + Date.now().toString(36);
    const body = new Blob([
      `--${bd}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${bd}\r\nContent-Type: ${input.contentMimeType}\r\n\r\n`,
      blob, `\r\n--${bd}--`,
    ]);
    const f = await drive('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${bd}` }, body,
    });
    return { id: f.id, viewUrl: f.webViewLink };
  }
  async function shareFile(input) {
    await drive(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(input.fileId)}/permissions?sendNotificationEmail=true`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: input.role || 'reader', type: 'user', emailAddress: input.emailAddress }),
    });
    return {};
  }
  const mcp = {
    listTools: async () => ({ fileArgs: true }),
    callTool: async (server, tool, input) => {
      if (tool === 'create_file') return { payload: await createFile(input) };
      if (tool === 'share_file') return { payload: await shareFile(input) };
      throw fail('not_in_manifest');
    },
  };

  window.artcraftRuntime = {
    async use(name) {
      if (name === 'sample') {
        if (!password) throw fail('no_password');
        if (!ready) ready = ping(password).catch(e => { ready = null; throw e; });
        await ready;
        return sampler();
      }
      if (name === 'mcp') {
        const { GOOGLE_CLIENT_ID } = await import('./google-auth.js');
        if (!GOOGLE_CLIENT_ID) throw fail('capability_disabled');
        return mcp;
      }
      throw fail('capability_disabled');
    },
    // Connexion à l'IA depuis l'onglet Studio IA : vérifie puis mémorise le mot de passe.
    async login(pw) {
      await ping(pw);
      password = pw;
      ready = Promise.resolve();
      try { localStorage.setItem(PASS_KEY, pw); } catch { /* stockage indisponible */ }
    },
  };
})();
