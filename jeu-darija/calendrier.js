// Calendrier musulman et heures de prière, calculés sur la tablette (sans Internet).
// Logique pure, testable avec Node.

// ---------- Ramadan et Aïd (calendrier hégirien Umm al-Qura du navigateur) ----------
const FMT = (() => { try { return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }); } catch { return null; } })();
export function hijri(date) {
  if (!FMT) return null;
  const parts = Object.fromEntries(FMT.formatToParts(date).map((p) => [p.type, p.value]));
  return { d: parseInt(parts.day, 10), m: parseInt(parts.month, 10), y: parseInt(parts.year, 10) };
}
// { phase: 'ramadan' (jour n), 'aid' (Aïd el-Fitr, 3 jours), 'aidkbir' (Aïd el-Adha), sinon 'avant' avec le nombre de jours }
export function ramadanInfo(date = new Date()) {
  const h = hijri(date);
  if (!h) return null;
  if (h.m === 9) return { phase: 'ramadan', day: h.d };
  if (h.m === 10 && h.d <= 3) return { phase: 'aid' };
  if (h.m === 12 && h.d >= 10 && h.d <= 13) return { phase: 'aidkbir' };
  const d = new Date(date);
  for (let i = 1; i < 400; i++) {
    d.setDate(d.getDate() + 1);
    const x = hijri(d);
    if (x.m === 9) return { phase: 'avant', days: i };
  }
  return null;
}

// ---------- Heures de prière (méthode astronomique classique, comme les calendriers des mosquées) ----------
export const METHODS = {
  isna: { name: 'Amérique du Nord (ISNA, 15°)', fajr: 15, isha: 15 },
  mwl: { name: 'Ligue islamique mondiale (18° / 17°)', fajr: 18, isha: 17 },
  maroc: { name: 'Maroc (19° / 17°)', fajr: 19, isha: 17 },
  algerie: { name: 'Algérie (18° / 17°)', fajr: 18, isha: 17 },
};
export const MONTREAL = { lat: 45.5017, lng: -73.5673 };
export const PRAYERS = [
  { id: 'fajr', name: 'Sobh (Fajr)' }, { id: 'dhuhr', name: 'Dohr' }, { id: 'asr', name: 'Asr' },
  { id: 'maghrib', name: 'Maghrib' }, { id: 'isha', name: 'Icha' },
];
const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };

function sun(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360), q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.020 * Math.sin(rad(2 * g)), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = fix(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15, 24);
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - RA };
}
function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

// Heures en décimal (13.5 = 13 h 30), à l'heure locale de décalage tz (en heures, ex. -4 à Montréal l'été).
export function prayerTimes(date, { lat = MONTREAL.lat, lng = MONTREAL.lng, tz, method = 'isna' } = {}) {
  const M = METHODS[method] || METHODS.isna;
  if (tz == null) tz = -date.getTimezoneOffset() / 60;
  const jd = julian(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
  const at = (t) => sun(jd + t / 24);
  const noon = (t) => fix(12 - at(t).eqt, 24);
  const angleTime = (angle, t, ccw) => {
    const { decl } = at(t);
    const v = (-Math.sin(rad(angle)) - Math.sin(rad(decl)) * Math.sin(rad(lat))) / (Math.cos(rad(decl)) * Math.cos(rad(lat)));
    const h = deg(Math.acos(Math.max(-1, Math.min(1, v)))) / 15;
    return noon(t) + (ccw ? -h : h);
  };
  const asrTime = (t) => {
    const { decl } = at(t);
    const angle = -deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(lat - decl))))));
    return angleTime(angle, t);
  };
  // Deux passes pour plus de précision.
  let tm = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 };
  for (let i = 0; i < 2; i++) {
    const d = Object.fromEntries(Object.entries(tm).map(([k, v]) => [k, v / 24]));
    tm = {
      fajr: angleTime(M.fajr, d.fajr * 24, true), sunrise: angleTime(0.833, d.sunrise * 24, true), dhuhr: noon(d.dhuhr * 24),
      asr: asrTime(d.asr * 24), sunset: angleTime(0.833, d.sunset * 24), maghrib: angleTime(0.833, d.maghrib * 24), isha: angleTime(M.isha, d.isha * 24),
    };
  }
  const out = {};
  for (const [k, v] of Object.entries(tm)) out[k] = fix(v + tz - lng / 15, 24);
  out.dhuhr += 1 / 60; // une minute de prudence après le zénith
  return out;
}
export const hhmm = (h) => { const m = Math.round(h * 60); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };

// La prochaine prière (et celle qui vient de commencer, pour allumer la lanterne pendant 20 minutes).
export function nextPrayer(now, opts) {
  const t = prayerTimes(now, opts);
  const h = now.getHours() + now.getMinutes() / 60;
  const current = PRAYERS.find((p) => h >= t[p.id] && h < t[p.id] + 1 / 3) || null;
  const next = PRAYERS.find((p) => t[p.id] > h) || PRAYERS[0];
  return { times: t, current, next, at: t[next.id] };
}
