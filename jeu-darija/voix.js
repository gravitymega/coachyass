// La voix de Hbibiti : phrases enregistrées à l'avance avec une voix de synthèse douce et naturelle
// (Kokoro, voix française « siwis », licence libre), sinon la voix de la tablette.
// Ce module est pur (testable avec Node) : il sert au jeu et au script qui fabrique les fichiers audio.

// Prononciation : on réécrit les mots arabes et darija pour qu'une voix française les dise bien.
const FIXES = [
  [/\s*ﷺ/g, ', salla Allahou alayhi wa sallam,'],
  [/Hbibi?ti/g, 'Hebibti'], // حبيبتي : « əbibti », pas « bibiti »
  [/Bismillah/gi, 'Bismilah'],
  [/Alhamdulillah/gi, 'Alhamdoulilah'],
  [/Inchallah/gi, 'Inn chaa Allah'],
  [/Labas/g, 'Labèss'],
  [/Zwin\b/g, 'Zwine'],
  [/Choukran/g, 'Choukrane'],
  [/Wach rak/g, 'Ouach rak'],
  [/Al-Khwarizmi|Khwarizmi/g, 'Al Khouarizmi'],
  [/Dhat an-Nitaqayn/g, 'Zat anne nitaqaïne'],
  [/Ibn al-Haytham/g, 'Ibn al-Haïtam'],
  [/Abou Hourayra/g, 'Abou Houraïra'],
  [/Thawr/g, 'Taour'],
  [/Othmane/g, 'Otmane'],
  // En darija écrite, « 3 » note le son ع (3la, 3achra) : on le lit « a ».
  [/(^|[\s«(])3(?=[a-z])/g, '$1a'],
  [/([a-z])3(?=[a-z])/g, '$1a'],
  [/,\s*,/g, ','],
  [/,\s*([.!?])/g, '$1'],
];
export function fixFr(text) {
  let t = String(text);
  for (const [re, by] of FIXES) t = t.replace(re, by);
  return t.replace(/\s+/g, ' ').trim();
}

// Clé d'une phrase (le nom du fichier audio) : même texte → même clé, insensible aux espaces et apostrophes.
export function normalize(text) {
  return String(text).replace(/[’‘]/g, "'").replace(/ | /g, ' ').replace(/\s+/g, ' ').trim();
}
export function voiceKey(text) {
  // cyrb53 : petit hachage 53 bits, sans collision en pratique pour quelques milliers de phrases.
  const str = normalize(text);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
