// Découpe d'un long texte en morceaux ≤ max caractères, aux fins de phrases
// (puis aux virgules, puis aux espaces) : chaque morceau est synthétisé à part
// et les MP3 sont mis bout à bout.
export function splitText(text, max = 900) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+[.!?…]+["»”)]*\s*|[^.!?…]+$/g) || [clean];
  const chunks = [];
  let cur = '';
  const pushPiece = piece => {
    if ((cur + piece).length <= max) { cur += piece; return; }
    if (cur.trim()) chunks.push(cur.trim());
    cur = '';
    if (piece.length <= max) { cur = piece; return; }
    // Phrase trop longue : on coupe aux virgules, puis aux espaces.
    let rest = piece;
    while (rest.length > max) {
      let cut = rest.lastIndexOf(', ', max);
      if (cut < max * 0.4) cut = rest.lastIndexOf(' ', max);
      if (cut <= 0) cut = max;
      chunks.push(rest.slice(0, cut + 1).trim());
      rest = rest.slice(cut + 1);
    }
    cur = rest;
  };
  sentences.forEach(pushPiece);
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}
