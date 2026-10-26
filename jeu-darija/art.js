// Personnages et décors dessinés pour le jeu (SVG fait main, aucune image externe).
// Chaque fonction renvoie une chaîne SVG ; les animations (clignement, rebond) sont en CSS.

const svg = (vb, body, cls = '') => `<svg class="art art-${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

function eyes(lx, rx, y, r = 5, color = '#2b2140') {
  return `<g class="blink" style="transform-origin:${(lx + rx) / 2}px ${y}px">
    <circle cx="${lx}" cy="${y}" r="${r}" fill="${color}"/><circle cx="${rx}" cy="${y}" r="${r}" fill="${color}"/>
    <circle cx="${lx + r * .35}" cy="${y - r * .4}" r="${r * .35}" fill="#fff"/><circle cx="${rx + r * .35}" cy="${y - r * .4}" r="${r * .35}" fill="#fff"/>
  </g>`;
}

// Hbibiti : grand-mère au foulard, lunettes rondes, sourire.
export function hbibiti(mood = 'happy') {
  const mouth = mood === 'sad'
    ? '<path d="M88 132 Q100 124 112 132" stroke="#7a3b2a" stroke-width="4" fill="none" stroke-linecap="round"/>'
    : mood === 'talk'
      ? '<ellipse class="talk" cx="100" cy="130" rx="9" ry="6" fill="#7a3b2a"/>'
      : '<path d="M86 126 Q100 140 114 126" stroke="#7a3b2a" stroke-width="4" fill="#fff" stroke-linecap="round"/>';
  return svg('0 0 200 220', `
    <path d="M36 220 C36 168 66 150 100 150 C134 150 164 168 164 220Z" fill="#6b3fa0"/>
    <path d="M70 160 Q100 178 130 160 L126 220 L74 220Z" fill="#7d4fb3"/>
    <g fill="#ffc93c">${[0, 1, 2, 3, 4].map((i) => `<circle cx="100" cy="${172 + i * 10}" r="3"/>`).join('')}</g>
    <path d="M42 108 C38 40 162 40 158 108 C158 150 132 170 100 170 C68 170 42 150 42 108Z" fill="#c1272d"/>
    <ellipse cx="100" cy="110" rx="40" ry="44" fill="#f0c19a"/>
    <path d="M56 92 C66 50 134 50 144 92 C128 74 72 74 56 92Z" fill="#a51f27"/>
    <g fill="#ffd56b" opacity=".9"><circle cx="70" cy="70" r="3"/><circle cx="90" cy="58" r="3"/><circle cx="112" cy="58" r="3"/><circle cx="132" cy="70" r="3"/><circle cx="52" cy="120" r="3"/><circle cx="148" cy="120" r="3"/><circle cx="60" cy="146" r="3"/><circle cx="140" cy="146" r="3"/></g>
    <ellipse cx="74" cy="124" rx="8" ry="5" fill="#f19a8f" opacity=".7"/><ellipse cx="126" cy="124" rx="8" ry="5" fill="#f19a8f" opacity=".7"/>
    ${eyes(85, 115, 108, 4.5)}
    <g fill="none" stroke="#6b4423" stroke-width="3"><circle cx="85" cy="108" r="12"/><circle cx="115" cy="108" r="12"/><path d="M97 107 Q100 104 103 107"/></g>
    <path d="M96 116 Q100 121 104 116" stroke="#c98b66" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${mouth}
    <path d="M70 96 Q76 92 82 95 M118 95 Q124 92 130 96" stroke="#8a6a55" stroke-width="2.5" fill="none" stroke-linecap="round"/>`, 'hbibiti');
}

// Assad : lion de l'Atlas, gardien de but (maillot rouge, étoile verte, gants).
export function assad() {
  const mane = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `<circle cx="${100 + Math.cos(a) * 52}" cy="${92 + Math.sin(a) * 50}" r="22"/>`;
  }).join('');
  return svg('0 0 200 220', `
    <path d="M44 220 C44 170 70 150 100 150 C130 150 156 170 156 220Z" fill="#c1272d"/>
    <path d="M100 168 l5 13 h14 l-11 8 4 14 -12 -9 -12 9 4 -14 -11 -8 h14z" fill="#00843d"/>
    <g fill="#b85c1e">${mane}</g>
    <circle cx="62" cy="54" r="14" fill="#e3a14a"/><circle cx="138" cy="54" r="14" fill="#e3a14a"/>
    <circle cx="62" cy="54" r="7" fill="#c77a35"/><circle cx="138" cy="54" r="7" fill="#c77a35"/>
    <ellipse cx="100" cy="96" rx="46" ry="44" fill="#f2b85a"/>
    <ellipse cx="100" cy="118" rx="24" ry="17" fill="#fde3b0"/>
    ${eyes(83, 117, 88, 6)}
    <path d="M78 74 Q84 70 90 74 M110 74 Q116 70 122 74" stroke="#8a4b16" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M92 106 h16 l-8 9z" fill="#5a2c10"/>
    <path d="M100 115 v5 M88 122 Q100 132 112 122" stroke="#5a2c10" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g class="gloves"><ellipse cx="38" cy="176" rx="18" ry="22" fill="#fff"/><ellipse cx="162" cy="176" rx="18" ry="22" fill="#fff"/>
    <rect x="24" y="190" width="28" height="10" rx="4" fill="#ff8a3d"/><rect x="148" y="190" width="28" height="10" rx="4" fill="#ff8a3d"/></g>`, 'assad');
}

// Fifi : fennec algérienne, maillot vert n° 10, ballon de basket.
export function fifi() {
  return svg('0 0 200 220', `
    <path d="M48 220 C48 172 72 154 100 154 C128 154 152 172 152 220Z" fill="#00843d"/>
    <text x="100" y="205" text-anchor="middle" font-size="36" font-weight="900" fill="#fff" font-family="Arial Rounded MT Bold, Arial, sans-serif">10</text>
    <path d="M56 98 L34 14 L94 70Z" fill="#e8bd84"/><path d="M144 98 L166 14 L106 70Z" fill="#e8bd84"/>
    <path d="M60 86 L44 32 L84 70Z" fill="#f7b7b0"/><path d="M140 86 L156 32 L116 70Z" fill="#f7b7b0"/>
    <ellipse cx="100" cy="108" rx="44" ry="42" fill="#efc890"/>
    <path d="M70 118 Q100 160 130 118 Q122 142 100 146 Q78 142 70 118Z" fill="#fff6e6"/>
    ${eyes(83, 117, 104, 7)}
    <ellipse cx="100" cy="124" rx="7" ry="5" fill="#2b2140"/>
    <path d="M92 134 Q100 140 108 134" stroke="#2b2140" stroke-width="3" fill="none" stroke-linecap="round"/>
    <g class="bounce-ball"><circle cx="160" cy="186" r="24" fill="#f08a24"/>
    <path d="M136 186 h48 M160 162 v48 M143 169 Q160 186 143 203 M177 169 Q160 186 177 203" stroke="#7a3b0a" stroke-width="2.5" fill="none"/></g>`, 'fifi');
}

// Grappo : le gant magique (robot gentil, yeux lumineux dans la paume).
export function grappo() {
  return svg('0 0 200 200', `
    <rect x="80" y="150" width="40" height="50" rx="8" fill="#5b6b8c"/>
    <rect x="72" y="140" width="56" height="22" rx="8" fill="#ff8a3d"/>
    ${[52, 78, 104, 130].map((x, i) => `<rect x="${x}" y="${i === 0 || i === 3 ? 42 : 26}" width="22" height="70" rx="11" fill="#3d7bff"/><circle cx="${x + 11}" cy="${i === 0 || i === 3 ? 56 : 40}" r="4" fill="#9fc0ff"/>`).join('')}
    <rect x="30" y="92" width="24" height="54" rx="12" fill="#3d7bff" transform="rotate(-35 42 119)"/>
    <rect x="50" y="78" width="104" height="72" rx="28" fill="#4a86ff"/>
    <g class="blink" style="transform-origin:102px 108px"><rect x="78" y="100" width="12" height="16" rx="6" fill="#7ff7ff"/><rect x="114" y="100" width="12" height="16" rx="6" fill="#7ff7ff"/></g>
    <path d="M88 126 Q102 136 116 126" stroke="#7ff7ff" stroke-width="4" fill="none" stroke-linecap="round"/>`, 'grappo');
}

// Darbouka Dada : tambour qui chante.
export function dada() {
  return svg('0 0 200 220', `
    <ellipse cx="100" cy="46" rx="56" ry="18" fill="#f6e7c8" stroke="#8a4b16" stroke-width="5"/>
    <path d="M44 46 C44 110 78 116 78 150 L70 206 L130 206 L122 150 C122 116 156 110 156 46 C140 60 60 60 44 46Z" fill="#c1272d"/>
    <path d="M52 76 l12 14 12 -14 12 14 12 -14 12 14 12 -14 12 14 12 -14" stroke="#ffc93c" stroke-width="5" fill="none"/>
    <path d="M74 176 h52" stroke="#ffc93c" stroke-width="6"/>
    ${eyes(86, 114, 104, 6)}
    <path d="M86 120 Q100 134 114 120" stroke="#2b2140" stroke-width="4" fill="#fff" stroke-linecap="round"/>
    <g class="hands"><circle cx="34" cy="120" r="12" fill="#f0c19a"/><circle cx="166" cy="120" r="12" fill="#f0c19a"/>
    <path d="M44 112 L58 98 M156 112 L142 98" stroke="#f0c19a" stroke-width="8" stroke-linecap="round"/></g>`, 'dada');
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

export const CHARACTERS = { hbibiti, assad, fifi, grappo, dada, lantern, tajine };
