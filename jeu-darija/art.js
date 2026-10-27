// Personnages et décors dessinés pour le jeu (SVG fait main, aucune image externe).
// Chaque fonction renvoie une chaîne SVG ; les animations (clignement, rebond) sont en CSS.

const svg = (vb, body, cls = '') => `<svg class="art art-${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

// ---------- Personnages vivants ----------
// Chaque personnage est un <div class="char" data-mood="…"> : les humeurs (happy, talk, cheer, sad, wow)
// changent la bouche, les sourcils et la posture en CSS ; les pupilles suivent le doigt (characters.js).
// Les groupes animés portent leur point de rotation en px du viewBox (transform-box: view-box).
const O = (x, y) => `style="transform-origin:${x}px ${y}px"`;
const wrap = (name, mood, cls, vb, body) =>
  `<div class="char char-${name} ${cls}" data-char="${name}" data-mood="${mood}"><svg class="art" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g class="body" ${O(100, 228)}>${body}</g></svg></div>`;

// Un œil : blanc, iris, deux reflets. Le groupe .pupil se déplace pour regarder.
function eye(cx, cy, r, iris = '#2b2140', white = '#fff') {
  return `<g class="eye" style="transform-origin:${cx}px ${cy}px;animation-delay:${((cx * 7) % 30) / 10}s">
    <ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 1.12}" fill="${white}"/>
    <g class="pupil"><circle cx="${cx}" cy="${cy + r * 0.1}" r="${r * 0.66}" fill="${iris}"/>
    <circle cx="${cx - r * 0.24}" cy="${cy - r * 0.26}" r="${r * 0.26}" fill="#fff"/>
    <circle cx="${cx + r * 0.24}" cy="${cy + r * 0.26}" r="${r * 0.11}" fill="#fff"/></g></g>`;
}
// Les cinq bouches ; une seule est visible selon l'humeur.
function mouths(cx, cy, w, ink = '#5a2318', tongue = '#ff7b8a') {
  return `<g class="mouths">
    <path class="m m-happy" d="M${cx - w} ${cy} Q${cx} ${cy + w * 0.95} ${cx + w} ${cy}" stroke="${ink}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
    <g class="m m-talk" ${O(cx, cy + 2)}><ellipse cx="${cx}" cy="${cy + 3}" rx="${w * 0.55}" ry="${w * 0.5}" fill="${ink}"/><ellipse cx="${cx}" cy="${cy + 3 + w * 0.25}" rx="${w * 0.32}" ry="${w * 0.2}" fill="${tongue}"/></g>
    <g class="m m-cheer"><path d="M${cx - w * 1.05} ${cy - 1} Q${cx} ${cy + w * 1.7} ${cx + w * 1.05} ${cy - 1}Z" fill="${ink}"/><ellipse cx="${cx}" cy="${cy + w * 0.8}" rx="${w * 0.48}" ry="${w * 0.28}" fill="${tongue}"/></g>
    <path class="m m-sad" d="M${cx - w * 0.6} ${cy + 5} Q${cx} ${cy - 1} ${cx + w * 0.6} ${cy + 5}" stroke="${ink}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
    <ellipse class="m m-wow" cx="${cx}" cy="${cy + 3}" rx="${w * 0.36}" ry="${w * 0.46}" fill="${ink}"/>
  </g>`;
}
function brows(lx, rx, y, color, len = 9) {
  return `<g class="brows" ${O((lx + rx) / 2, y)}>
    <path class="brow-l" ${O(lx, y)} d="M${lx - len} ${y + 1} Q${lx} ${y - 4} ${lx + len} ${y}" stroke="${color}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path class="brow-r" ${O(rx, y)} d="M${rx - len} ${y} Q${rx} ${y - 4} ${rx + len} ${y + 1}" stroke="${color}" stroke-width="3.4" fill="none" stroke-linecap="round"/></g>`;
}
const cheeks = (lx, rx, y, c = '#ff8f9a') => `<g class="cheeks"><ellipse cx="${lx}" cy="${y}" rx="9" ry="5.5" fill="${c}" opacity=".55"/><ellipse cx="${rx}" cy="${y}" rx="9" ry="5.5" fill="${c}" opacity=".55"/></g>`;

// Hbibiti : grand-mère au foulard, lunettes rondes, bras qui saluent.
export function hbibiti(mood = 'happy', cls = '') {
  const dots = [[70, 70], [88, 60], [112, 60], [130, 70], [52, 118], [148, 118], [60, 150], [140, 150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2"/>`).join('');
  return wrap('hbibiti', mood, cls, '0 0 200 230', `
    <path d="M38 230 C38 180 68 160 100 160 C132 160 162 180 162 230Z" fill="#7a48b8"/>
    <path d="M76 164 Q100 186 124 164 L120 178 Q100 194 80 178Z" fill="#ffc93c"/>
    <g fill="#ffc93c">${[0, 1, 2].map((i) => `<circle cx="100" cy="${198 + i * 11}" r="3"/>`).join('')}</g>
    <g class="arm arm-l" ${O(60, 180)}><path d="M60 180 Q40 196 46 214" stroke="#7a48b8" stroke-width="17" stroke-linecap="round" fill="none"/><circle cx="46" cy="217" r="10" fill="#f6cfaa"/></g>
    <g class="arm arm-r" ${O(140, 180)}><path d="M140 180 Q160 196 154 214" stroke="#7a48b8" stroke-width="17" stroke-linecap="round" fill="none"/><circle cx="154" cy="217" r="10" fill="#f6cfaa"/></g>
    <g class="head" ${O(100, 168)}>
      <path d="M42 112 C38 42 162 42 158 112 C158 158 131 178 100 178 C69 178 42 158 42 112Z" fill="#d23a3f"/>
      <ellipse cx="100" cy="113" rx="42" ry="44" fill="#f6cfaa"/>
      <path d="M54 98 C62 52 138 52 146 98 C128 76 72 76 54 98Z" fill="#b02a30"/>
      <g fill="#ffd56b">${dots}</g>
      ${cheeks(70, 130, 132)}
      ${eye(85, 112, 8.5)}${eye(115, 112, 8.5)}
      <g fill="none" stroke="#6b4423" stroke-width="3"><circle cx="85" cy="112" r="13.5"/><circle cx="115" cy="112" r="13.5"/><path d="M98.5 111 Q100 108 101.5 111"/></g>
      ${brows(85, 115, 91, '#8a6a55')}
      <path d="M96 123 Q100 128 104 123" stroke="#d29a74" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M64 108 q-4 5 0 10 M136 108 q4 5 0 10" stroke="#d9a888" stroke-width="2" fill="none" stroke-linecap="round"/>
      ${mouths(100, 138, 10)}
    </g>`);
}

// Papa (côté marocain) : cheveux courts, petite barbe, chemise rouge avec l'étoile verte.
export function papa(mood = 'happy', cls = '') {
  return wrap('papa', mood, cls, '0 0 200 230', `
    <path d="M40 230 C40 182 68 162 100 162 C132 162 160 182 160 230Z" fill="#c8323a"/>
    <path d="M84 164 L100 184 L116 164" fill="#fff" opacity=".9"/>
    <path d="M124 196 l3 7 h8 l-6 5 2 8 -7 -5 -7 5 2 -8 -6 -5 h8z" fill="#00843d"/>
    <g class="arm arm-l" ${O(60, 182)}><path d="M60 182 Q40 198 46 216" stroke="#c8323a" stroke-width="18" stroke-linecap="round" fill="none"/><circle cx="46" cy="219" r="10" fill="#d9a77e"/></g>
    <g class="arm arm-r" ${O(140, 182)}><path d="M140 182 Q160 198 154 216" stroke="#c8323a" stroke-width="18" stroke-linecap="round" fill="none"/><circle cx="154" cy="219" r="10" fill="#d9a77e"/></g>
    <g class="head" ${O(100, 168)}>
      <ellipse cx="56" cy="112" rx="9" ry="12" fill="#d9a77e"/><ellipse cx="144" cy="112" rx="9" ry="12" fill="#d9a77e"/>
      <ellipse cx="100" cy="110" rx="45" ry="50" fill="#e2b48c"/>
      <path d="M53 102 C46 42 154 42 147 102 C142 82 124 74 100 76 C76 74 58 82 53 102Z" fill="#2b1b12"/>
      <path d="M58 118 C60 160 80 168 100 168 C120 168 140 160 142 118 C138 140 124 150 100 150 C76 150 62 140 58 118Z" fill="#2b1b12" opacity=".9"/>
      ${cheeks(72, 128, 128, '#e58a7a')}
      ${eye(83, 108, 8.5, '#3a2416')}${eye(117, 108, 8.5, '#3a2416')}
      ${brows(83, 117, 90, '#2b1b12', 11)}
      <path d="M96 118 Q100 126 104 118" stroke="#b9805a" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M86 131 Q100 127 114 131" stroke="#2b1b12" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${mouths(100, 138, 9, '#4a1d12')}
    </g>`);
}

// Maman (côté algérien) : tunique verte et blanche, broche étoile et croissant, foulard (facultatif).
export function maman(mood = 'happy', cls = '', scarf = true) {
  const hair = scarf
    ? `<path d="M44 112 C40 44 160 44 156 112 C156 160 130 180 100 180 C70 180 44 160 44 112Z" fill="#2bb673"/>
       <path d="M56 96 C64 54 136 54 144 96 C126 76 74 76 56 96Z" fill="#1f9a5d"/>`
    : `<path d="M50 120 C40 50 160 50 150 120 C152 170 136 196 132 200 L68 200 C64 196 48 170 50 120Z" fill="#3a2212"/>
       <path d="M58 100 C66 60 134 60 142 100 C122 80 78 80 58 100Z" fill="#4a2c18"/>`;
  return wrap('maman', mood, cls, '0 0 200 230', `
    <path d="M38 230 C38 182 68 162 100 162 C132 162 162 182 162 230Z" fill="#fff"/>
    <path d="M38 230 C38 182 68 162 100 162 L100 230Z" fill="#2bb673"/>
    <g transform="translate(122 196)"><circle r="8" fill="#e5484d"/><circle cx="3" r="6.5" fill="#fff"/><path d="M7 -4 l1.6 3.4 3.6.4 -2.7 2.4 .8 3.6 -3.3-1.9 -3.3 1.9 .8-3.6 -2.7-2.4 3.6-.4z" fill="#e5484d"/></g>
    <g class="arm arm-l" ${O(60, 182)}><path d="M60 182 Q40 198 46 216" stroke="#2bb673" stroke-width="17" stroke-linecap="round" fill="none"/><circle cx="46" cy="219" r="10" fill="#f0c4a0"/></g>
    <g class="arm arm-r" ${O(140, 182)}><path d="M140 182 Q160 198 154 216" stroke="#fff" stroke-width="17" stroke-linecap="round" fill="none"/><circle cx="154" cy="219" r="10" fill="#f0c4a0"/></g>
    <g class="head" ${O(100, 168)}>
      ${hair}
      <ellipse cx="100" cy="114" rx="41" ry="45" fill="#f0c4a0"/>
      ${scarf ? '' : '<path d="M60 104 C66 66 134 66 140 104 C128 86 112 80 100 82 C88 80 72 86 60 104Z" fill="#3a2212"/>'}
      ${cheeks(70, 130, 132)}
      ${eye(84, 112, 8.5, '#3a2416')}${eye(116, 112, 8.5, '#3a2416')}
      <path d="M74 104 l-4 -3 M126 104 l4 -3" stroke="#3a2416" stroke-width="2.4" stroke-linecap="round"/>
      ${brows(84, 116, 93, '#5a3a24')}
      <path d="M96 122 Q100 128 104 122" stroke="#d29a74" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${mouths(100, 138, 9.5, '#7a2a2a')}
    </g>`);
}

// Assad : lionceau de l'Atlas, gardien (maillot rouge, étoile verte, gants), queue qui balance.
export function assad(mood = 'happy', cls = '') {
  const ring = (n, rad, r, c) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return `<circle cx="${(100 + Math.cos(a) * rad).toFixed(1)}" cy="${(98 + Math.sin(a) * rad * 0.95).toFixed(1)}" r="${r}" fill="${c}"/>`;
  }).join('');
  return wrap('assad', mood, cls, '0 0 200 230', `
    <g class="tail" ${O(138, 206)}><path d="M138 206 Q182 202 178 160" stroke="#f2b85a" stroke-width="9" fill="none" stroke-linecap="round"/><circle cx="178" cy="153" r="11" fill="#c7671f"/></g>
    <path d="M50 230 C50 184 74 166 100 166 C126 166 150 184 150 230Z" fill="#d23a3f"/>
    <path d="M100 182 l5 12 h13 l-10 8 4 13 -12 -8 -12 8 4 -13 -10 -8 h13z" fill="#00843d"/>
    <g class="arm arm-l" ${O(62, 186)}><ellipse cx="44" cy="198" rx="17" ry="20" fill="#fff"/><rect x="31" y="210" width="26" height="9" rx="4" fill="#ff8a3d"/></g>
    <g class="arm arm-r" ${O(138, 186)}><ellipse cx="156" cy="198" rx="17" ry="20" fill="#fff"/><rect x="143" y="210" width="26" height="9" rx="4" fill="#ff8a3d"/></g>
    <g class="head" ${O(100, 170)}>
      <g class="mane" ${O(100, 98)}>${ring(14, 54, 21, '#c7671f')}${ring(14, 44, 15, '#df8a33')}</g>
      <circle cx="58" cy="56" r="15" fill="#f2b85a"/><circle cx="142" cy="56" r="15" fill="#f2b85a"/>
      <circle cx="58" cy="56" r="8" fill="#f7a6a0"/><circle cx="142" cy="56" r="8" fill="#f7a6a0"/>
      <ellipse cx="100" cy="104" rx="46" ry="43" fill="#f7c46c"/>
      <path d="M92 64 Q100 54 108 64 Q100 60 92 64Z" fill="#df8a33"/>
      <ellipse cx="100" cy="125" rx="23" ry="16" fill="#fff1d0"/>
      ${cheeks(68, 132, 121)}
      ${eye(81, 100, 9.5, '#3a1c0a')}${eye(119, 100, 9.5, '#3a1c0a')}
      ${brows(81, 119, 83, '#9a4a14', 10)}
      <path d="M91 115 Q100 110 109 115 Q105 124 100 124 Q95 124 91 115Z" fill="#6b3014"/>
      <g fill="#c98a3a"><circle cx="84" cy="126" r="1.8"/><circle cx="80" cy="131" r="1.8"/><circle cx="116" cy="126" r="1.8"/><circle cx="120" cy="131" r="1.8"/></g>
      ${mouths(100, 132, 8, '#5a2010')}
    </g>`);
}

// Fifi : fennec algérienne, maillot vert n° 10, grandes oreilles qui frémissent, ballon qui rebondit.
export function fifi(mood = 'happy', cls = '') {
  return wrap('fifi', mood, cls, '0 0 200 230', `
    <g class="tail" ${O(62, 210)}><path d="M62 210 C20 214 10 180 24 160 C40 170 52 186 62 196Z" fill="#ecc189"/><path d="M24 160 C18 170 18 180 22 188 C30 180 32 170 24 160Z" fill="#fff7ea"/></g>
    <path d="M50 230 C50 184 74 166 100 166 C126 166 150 184 150 230Z" fill="#00843d"/>
    <text x="100" y="218" text-anchor="middle" font-size="34" font-weight="900" fill="#fff" font-family="Arial Rounded MT Bold, Arial, sans-serif">10</text>
    <g class="ball" ${O(162, 200)}><circle cx="162" cy="198" r="20" fill="#f08a24"/>
      <path d="M142 198 h40 M162 178 v40 M148 184 Q162 198 148 212 M176 184 Q162 198 176 212" stroke="#7a3b0a" stroke-width="2.4" fill="none"/></g>
    <g class="arm arm-l" ${O(64, 186)}><path d="M64 184 Q48 198 52 214" stroke="#00843d" stroke-width="15" stroke-linecap="round" fill="none"/><circle cx="52" cy="216" r="8.5" fill="#f2cb93"/></g>
    <g class="arm arm-r" ${O(136, 184)}><path d="M136 184 Q150 182 154 176" stroke="#00843d" stroke-width="15" stroke-linecap="round" fill="none"/><circle cx="156" cy="174" r="8.5" fill="#f2cb93"/></g>
    <g class="head" ${O(100, 168)}>
      <g class="ear ear-l" ${O(80, 82)}><path d="M78 92 C52 72 34 36 38 10 C62 20 92 50 98 78Z" fill="#ecc189"/><path d="M76 84 C58 66 46 40 48 24 C66 34 86 54 90 74Z" fill="#f9b8b0"/></g>
      <g class="ear ear-r" ${O(120, 82)}><path d="M122 92 C148 72 166 36 162 10 C138 20 108 50 102 78Z" fill="#ecc189"/><path d="M124 84 C142 66 154 40 152 24 C134 34 114 54 110 74Z" fill="#f9b8b0"/></g>
      <ellipse cx="100" cy="114" rx="44" ry="40" fill="#f2cb93"/>
      <path d="M60 120 Q100 170 140 120 Q132 148 100 152 Q68 148 60 120Z" fill="#fff7ea"/>
      <path d="M94 80 Q100 74 106 80 Q100 86 94 80Z" fill="#dda866"/>
      ${cheeks(68, 132, 128)}
      ${eye(81, 108, 11)}${eye(119, 108, 11)}
      ${brows(81, 119, 89, '#b7834a')}
      <ellipse cx="100" cy="129" rx="6.5" ry="4.8" fill="#2b2140"/><circle cx="98" cy="127.5" r="1.6" fill="#fff"/>
      ${mouths(100, 138, 7, '#3b1e2a')}
    </g>`);
}

// Grappo : le gant magique, robot gentil ; doigts qui gigotent, écran-visage dans la paume.
export function grappo(mood = 'happy', cls = '') {
  const fingers = [[52, 46], [78, 28], [104, 28], [130, 46]].map(([x, y], i) => `
    <g class="finger f${i}" ${O(x + 11, 106)}><rect x="${x}" y="${y}" width="22" height="${112 - y}" rx="11" fill="#3d7bff"/><rect x="${x + 4}" y="${y + 6}" width="6" height="16" rx="3" fill="#9fc0ff" opacity=".8"/></g>`).join('');
  return wrap('grappo', mood, cls, '0 0 200 230', `
    <rect x="80" y="180" width="40" height="50" rx="8" fill="#5b6b8c"/>
    <rect x="70" y="166" width="60" height="22" rx="9" fill="#ff8a3d"/>
    <circle class="led" cx="100" cy="177" r="4" fill="#fff36b"/>
    <g class="head" ${O(100, 170)}>
      ${fingers}
      <g class="thumb arm-l" ${O(56, 140)}><rect x="26" y="102" width="26" height="58" rx="13" fill="#3d7bff" transform="rotate(-38 39 131)"/></g>
      <rect x="48" y="84" width="108" height="86" rx="32" fill="#4a86ff"/>
      <rect x="62" y="96" width="80" height="58" rx="18" fill="#16264f"/>
      <g class="cheeks"><rect x="66" y="134" width="12" height="6" rx="3" fill="#ff8fb0" opacity=".8"/><rect x="126" y="134" width="12" height="6" rx="3" fill="#ff8fb0" opacity=".8"/></g>
      ${eye(86, 118, 9, '#16264f', '#7ff7ff')}${eye(118, 118, 9, '#16264f', '#7ff7ff')}
      ${brows(86, 118, 102, '#7ff7ff', 7)}
      ${mouths(102, 140, 8, '#7ff7ff', '#ff8fb0')}
    </g>`);
}

// Darbouka Dada : tambour qui chante et se tape sur la tête en rythme.
export function dada(mood = 'happy', cls = '') {
  return wrap('dada', mood, cls, '0 0 200 230', `
    <ellipse cx="80" cy="222" rx="16" ry="7" fill="#7a3b0a"/><ellipse cx="120" cy="222" rx="16" ry="7" fill="#7a3b0a"/>
    <g class="head" ${O(100, 214)}>
      <path d="M44 50 C44 112 78 118 78 152 L72 214 L128 214 L122 152 C122 118 156 112 156 50 C140 64 60 64 44 50Z" fill="#d23a3f"/>
      <ellipse cx="100" cy="50" rx="56" ry="18" fill="#f6e7c8" stroke="#8a4b16" stroke-width="5"/>
      <path d="M52 82 l12 12 12 -12 12 12 12 -12 12 12 12 -12 12 12 12 -12" stroke="#ffc93c" stroke-width="5" fill="none" stroke-linejoin="round"/>
      <path d="M76 186 h48" stroke="#ffc93c" stroke-width="6"/>
      ${cheeks(76, 124, 132)}
      ${eye(86, 112, 9.5)}${eye(114, 112, 9.5)}
      ${brows(86, 114, 95, '#7a1c1c', 8)}
      ${mouths(100, 132, 9, '#4a1010')}
    </g>
    <g class="arm arm-l hand-l" ${O(52, 116)}><path d="M52 116 Q22 88 58 56" stroke="#f3c6a0" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="60" cy="52" r="10" fill="#f3c6a0"/></g>
    <g class="arm arm-r hand-r" ${O(148, 116)}><path d="M148 116 Q178 88 142 56" stroke="#f3c6a0" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="140" cy="52" r="10" fill="#f3c6a0"/></g>`);
}

// Lanterne (fanous) : s'allume quand on trouve la bonne réponse.
export function lantern(color = '#ffc93c') {
  return svg('0 0 100 170', `
    <path d="M50 0 v18" stroke="#7d5a2a" stroke-width="3"/>
    <circle cx="50" cy="22" r="6" fill="none" stroke="#b8860b" stroke-width="3"/>
    <path d="M30 40 Q50 22 70 40Z" fill="#b8860b"/>
    <path class="glass" d="M28 40 h44 l8 30 -8 52 h-44 l-8 -52z" fill="${color}" opacity=".35"/>
    <path d="M28 40 h44 l8 30 -8 52 h-44 l-8 -52z M50 40 v82 M20 70 h60" stroke="#b8860b" stroke-width="3" fill="none"/>
    <circle class="flame" cx="50" cy="84" r="8" fill="#fff3b0"/>
    <path d="M30 122 h40 l-6 12 h-28z" fill="#b8860b"/>`, 'lantern');
}

export function tajine() {
  return svg('0 0 220 180', `
    <g class="steam" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7">
      <path d="M90 30 q-8 -12 0 -24"/><path d="M110 24 q-8 -12 0 -24"/><path d="M130 30 q-8 -12 0 -24"/></g>
    <circle cx="110" cy="48" r="10" fill="#8a3b12"/>
    <path d="M110 52 C80 60 50 110 40 130 H180 C170 110 140 60 110 52Z" fill="#c8572a"/>
    <path d="M58 112 Q110 94 162 112" stroke="#ffc93c" stroke-width="5" fill="none"/>
    <path d="M70 92 Q110 78 150 92" stroke="#2b8a8a" stroke-width="5" fill="none"/>
    <ellipse cx="110" cy="138" rx="96" ry="18" fill="#9c3f18"/>
    <ellipse cx="110" cy="132" rx="84" ry="10" fill="#c8572a"/>`, 'tajine');
}

export function hoop() {
  return svg('0 0 220 200', `
    <rect x="100" y="120" width="20" height="80" fill="#7a7a8c"/>
    <rect x="30" y="10" width="160" height="104" rx="8" fill="#fff" stroke="#c9d1e0" stroke-width="5"/>
    <rect x="80" y="44" width="60" height="44" fill="none" stroke="#ff6b3d" stroke-width="5"/>
    <path class="net" d="M76 98 L88 150 L132 150 L144 98 M86 98 L98 150 M98 98 L104 150 M110 98 L110 150 M122 98 L116 150 M134 98 L122 150 M80 116 H140 M84 134 H136" stroke="#fff" stroke-width="3" fill="none"/>
    <ellipse cx="110" cy="98" rx="38" ry="8" fill="none" stroke="#ff6b3d" stroke-width="7"/>`, 'hoop');
}

export function gear(r = 40, teeth = 10, color = '#ffc93c') {
  const pts = [];
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.78 : r;
    pts.push(`${(50 + Math.cos(a - 0.12) * rr).toFixed(1)},${(50 + Math.sin(a - 0.12) * rr).toFixed(1)}`, `${(50 + Math.cos(a + 0.12) * rr).toFixed(1)},${(50 + Math.sin(a + 0.12) * rr).toFixed(1)}`);
  }
  return svg('0 0 100 100', `<polygon points="${pts.join(' ')}" fill="${color}"/><circle cx="50" cy="50" r="${r * 0.3}" fill="rgba(0,0,0,.25)"/>`, 'gear');
}

export function mosque() {
  return svg('0 0 300 160', `
    <rect x="40" y="70" width="220" height="90" fill="#f4e4c1"/>
    <path d="M100 70 Q150 -10 200 70Z" fill="#2bb673"/>
    <circle cx="150" cy="14" r="5" fill="#ffc93c"/>
    <rect x="14" y="30" width="22" height="130" fill="#f4e4c1"/><path d="M14 30 Q25 6 36 30Z" fill="#2bb673"/>
    <rect x="264" y="30" width="22" height="130" fill="#f4e4c1"/><path d="M264 30 Q275 6 286 30Z" fill="#2bb673"/>
    ${[70, 112, 150, 188, 230].map((x) => `<path d="M${x - 12} 160 v-34 q12 -18 24 0 v34z" fill="#3b7dd8"/>`).join('')}
    <path d="M40 92 h220" stroke="#d8c08a" stroke-width="4" stroke-dasharray="10 6"/>`, 'mosque');
}

// Fusée de l'Atelier des nombres.
export function rocket(color = '#e5484d') {
  return svg('0 0 100 160', `
    <path class="flame" d="M38 128 Q50 160 62 128 Q50 140 38 128Z" fill="#ffc93c"/>
    <path d="M30 104 L14 132 L34 124Z M70 104 L86 132 L66 124Z" fill="${color}"/>
    <path d="M50 6 C76 30 76 90 68 126 H32 C24 90 24 30 50 6Z" fill="#f4f1ff" stroke="#c9c2e8" stroke-width="3"/>
    <path d="M50 6 C62 17 68 30 70 40 H30 C32 30 38 17 50 6Z" fill="${color}"/>
    <circle cx="50" cy="66" r="13" fill="#7fd3ff" stroke="#3b7dd8" stroke-width="4"/>
    <circle cx="45" cy="61" r="4" fill="#fff" opacity=".8"/>
    <rect x="36" y="118" width="28" height="10" rx="3" fill="#8a84b0"/>`, 'rocket');
}

// Pile de livres de la Bibliothèque.
export function books() {
  return svg('0 0 120 110', `
    <rect x="14" y="74" width="92" height="22" rx="4" fill="#3b7dd8"/><rect x="18" y="78" width="84" height="4" fill="#fff" opacity=".6"/>
    <rect x="22" y="50" width="80" height="24" rx="4" fill="#2bb673"/><rect x="26" y="54" width="72" height="4" fill="#fff" opacity=".6"/>
    <rect x="10" y="28" width="86" height="22" rx="4" fill="#e5484d"/><rect x="14" y="32" width="78" height="4" fill="#fff" opacity=".6"/>
    <path d="M60 28 L60 6 Q78 2 96 10 L96 28" fill="#ffc93c"/>
    <text x="78" y="22" text-anchor="middle" font-size="14" font-weight="900" fill="#7a3b0a" font-family="Arial, sans-serif">Abc</text>`, 'books');
}

// Machine à pinces du coin Poppy Playtime (icône de la salle).
export function clawMachine() {
  return svg('0 0 110 120', `
    <rect x="10" y="4" width="90" height="112" rx="10" fill="#ff8a3d"/>
    <rect x="18" y="14" width="74" height="62" rx="6" fill="#1f4f9a"/>
    <rect x="18" y="14" width="74" height="6" fill="#c9d2e6"/>
    <rect x="53" y="20" width="4" height="18" fill="#9aa6bf"/>
    <path d="M46 38 h18 l-3 8 h-12 z" fill="#5ec4ff"/><path d="M47 46 l-4 8 M63 46 l4 8" stroke="#5ec4ff" stroke-width="3" stroke-linecap="round"/>
    <circle cx="32" cy="68" r="8" fill="#2f6fe0"/><circle cx="50" cy="70" r="7" fill="#ff6fae"/><circle cx="68" cy="68" r="8" fill="#7c4dcc"/><circle cx="82" cy="70" r="6" fill="#ffc93c"/>
    <rect x="18" y="14" width="74" height="62" rx="6" fill="#fff" opacity=".12"/>
    <rect x="22" y="86" width="40" height="22" rx="5" fill="#2b2140"/><circle cx="76" cy="97" r="8" fill="#e5484d"/><rect x="74" y="80" width="4" height="12" rx="2" fill="#2b2140"/>`, 'claw-icon');
}

export const CHARACTERS = { hbibiti, assad, fifi, grappo, dada, papa, maman };
