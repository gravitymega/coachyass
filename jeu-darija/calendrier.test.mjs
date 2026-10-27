import test from 'node:test';
import assert from 'node:assert/strict';
import { prayerTimes, ramadanInfo, hijri, hhmm, nextPrayer } from './calendrier.js';

test('heures de prière à Montréal dans le bon ordre et plausibles', () => {
  for (const [date, tz] of [[new Date(2026, 5, 21), -4], [new Date(2026, 11, 21), -5], [new Date(2026, 2, 20), -4]]) {
    const t = prayerTimes(date, { tz, method: 'isna' });
    assert.ok(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha, JSON.stringify(t));
    assert.ok(t.dhuhr > 11.5 && t.dhuhr < 13.5, `dohr ${hhmm(t.dhuhr)}`);
  }
  const june = prayerTimes(new Date(2026, 5, 21), { tz: -4 });
  assert.ok(june.maghrib > 20.6 && june.maghrib < 20.9, `maghrib juin ${hhmm(june.maghrib)}`); // vers 20 h 47
  const dec = prayerTimes(new Date(2026, 11, 21), { tz: -5 });
  assert.ok(dec.maghrib > 16.1 && dec.maghrib < 16.5, `maghrib décembre ${hhmm(dec.maghrib)}`); // vers 16 h 15
  assert.equal(hhmm(13.5), '13:30');
});

test('calendrier hégirien : Ramadan, Aïd et compte à rebours', () => {
  assert.ok(hijri(new Date(2026, 9, 27)));
  const before = ramadanInfo(new Date(2026, 9, 27));
  assert.equal(before.phase, 'avant');
  assert.ok(before.days > 90 && before.days < 120, String(before.days)); // Ramadan 1448 : vers le 8 février 2027
  assert.equal(ramadanInfo(new Date(2026, 1, 25)).phase, 'ramadan'); // Ramadan 1447 a commencé vers le 18 février 2026
  assert.equal(nextPrayer(new Date(2026, 5, 21, 3, 0), { tz: -4 }).next.id, 'fajr');
});
