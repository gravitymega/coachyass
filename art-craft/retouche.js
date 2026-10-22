// Art craft — Retouche photo (studio image) : éditeur photo complet, tout dans le navigateur
// (réglages, looks, filtres, détourage BodyPix, gomme magique, formats réseaux, lots).
// Repris de l'artifact « Art Craft Pictures » ; les services Claude (IA, Google Drive)
// passent par retouche-bridge.js.
(() => {
"use strict";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const DEF = {exposure:0,contrast:0,highlights:0,shadows:0,whites:0,blacks:0,temp:0,tint:0,vibrance:0,saturation:0,texture:0,clarity:0,dehaze:0,sharpen:0,masking:0,deblur:0,deblurSize:1,denoise:0,vignette:0,grain:0,art:0,artMix:100};
const SL = {
  lumiere:[
    ["exposure","Exposition",-2,2,0.05,v=>(v>0?"+":"")+v.toFixed(2)+" IL"],
    ["contrast","Contraste",-100,100,1],
    ["highlights","Hautes lumières",-100,100,1],
    ["shadows","Ombres",-100,100,1],
    ["whites","Blancs",-100,100,1],
    ["blacks","Noirs",-100,100,1]],
  couleur:[
    ["temp","Température",-100,100,1,null,"temp"],
    ["tint","Teinte",-100,100,1,null,"tint"],
    ["vibrance","Vibrance",-100,100,1],
    ["saturation","Saturation",-100,100,1]],
  details:[
    "Détail et contraste local",
    ["texture","Texture",-100,100,1,null,null,"Fait ressortir les détails fins : tissus, cheveux, feuillage."],
    ["clarity","Clarté",-100,100,1,null,null,"Renforce le relief des tons moyens."],
    ["dehaze","Correction de la brume",-100,100,1,null,null,"Retire le voile des photos ternes, brumeuses ou prises derrière une vitre."],
    "Netteté",
    ["sharpen","Netteté",0,150,1],
    ["masking","Masquage",0,100,1,null,null,"Limite la netteté aux contours et protège la peau et le ciel."],
    ["deblur","Correction du flou",0,100,1,null,null,"Récupère une mise au point légèrement ratée ou un petit flou de bougé."],
    ["deblurSize","Taille du flou",1,3,1,v=>["","Léger","Moyen","Fort"][v]],
    "Bruit",
    ["denoise","Réduction du bruit",0,100,1,null,null,"Sur les photos de nuit, réduis le bruit avant de monter la netteté."]],
  effets:[
    ["vignette","Vignettage",-100,100,1],
    ["grain","Grain argentique",0,100,1]]
};
const sliderDefs = () => Object.values(SL).flat().filter(x => typeof x !== "string");
const fmtNum = v => (v>0?"+":"")+Math.round(v);

const MAX_SRC = 12e6;      // working resolution cap
const MAX_OUT = 16e6;      // export cap (iOS canvas limit)
const PREV_EDGE = 1400;

let src = null;            // full-res canvas
let prev = null, thumb = null, autoP = null;
let params = {...DEF}, committed = {...DEF}, history = [], future = [];
let activeLook = null, comparePos = 50, comparing = false;
let fileBase = "photo";
const view = $("#view"), orig = $("#orig"), frame = $("#frame");
const vctx = view.getContext("2d"), octx = orig.getContext("2d");
let outImg = null;

/* ---------- Sliders ---------- */
const inputs = {};
for (const [g, list] of Object.entries(SL)) {
  const host = document.querySelector(`[data-group="${g}"]`);
  for (const item of list) {
    if (typeof item === "string"){ const sub = document.createElement("div"); sub.className = "sub"; sub.textContent = item; host.appendChild(sub); continue; }
    const [key,label,min,max,step,fmt,cls,hint] = item;
    const row = document.createElement("div");
    row.className = "row" + (cls ? " "+cls : "");
    row.innerHTML = `<div class="row-top"><label for="s-${key}" title="Double-clic pour réinitialiser">${label}</label><output id="o-${key}"></output></div>
      <input type="range" id="s-${key}" min="${min}" max="${max}" step="${step}" value="${DEF[key]}">${hint ? `<small class="hint">${hint}</small>` : ""}`;
    host.appendChild(row);
    const inp = row.querySelector("input"), out = row.querySelector("output");
    inputs[key] = {inp, out, fmt: fmt || fmtNum};
    inp.addEventListener("input", () => { interacting = Date.now(); params[key] = +inp.value; activeLook = null; markLooks(); syncOut(key); schedule(); });
    inp.addEventListener("change", commit);
    row.querySelector("label").addEventListener("dblclick", () => { params[key] = DEF[key]; syncUI(); schedule(); commit(); });
  }
}
function syncOut(k){ const o = inputs[k]; o.out.textContent = o.fmt(params[k]); o.out.classList.toggle("changed", params[k] !== DEF[k]); }
function syncUI(){ for (const k in inputs){ inputs[k].inp.value = params[k]; syncOut(k);} syncArt(); }
syncUI();

function same(a,b){ for (const k in DEF) if (a[k]!==b[k]) return false; return true; }
function commit(){
  if (same(params, committed)){ stepLabel = null; renderSteps(); return; }
  const lab = labelFor(committed, params);
  history.push({...committed}); if (history.length > 60) history.shift();
  future = []; committed = {...params}; updUndo();
  logStep(lab, params);
}
function updUndo(){ $("#undo").disabled = !history.length; $("#redo").disabled = !future.length; }
$("#undo").onclick = () => { if(!history.length) return; future.push({...params}); params = history.pop(); committed = {...params}; activeLook=null; markLooks(); syncUI(); updUndo(); schedule(); };
$("#redo").onclick = () => { if(!future.length) return; history.push({...params}); params = future.pop(); committed = {...params}; activeLook=null; markLooks(); syncUI(); updUndo(); schedule(); };

/* ---------- Tabs ---------- */
$$(".tab").forEach(t => t.onclick = () => {
  $$(".tab").forEach(x => x.setAttribute("aria-selected", x===t));
  $$(".pane").forEach(p => p.classList.toggle("on", p.dataset.pane === t.dataset.tab));
  if (t.dataset.tab === "lumiere") drawHisto();
});

/* ---------- Image processing ---------- */
function blur(srcA, w, h, r, out, tmp){
  const n = w*h, a = out || new Float32Array(n), b = tmp || new Float32Array(n);
  if (a !== srcA) a.set(srcA);
  r = Math.max(1, Math.min(r, Math.floor((Math.min(w,h)-1)/2) || 1));
  const inv = 1/(2*r+1);
  for (let pass=0; pass<3; pass++){
    for (let y=0; y<h; y++){
      const base = y*w; let s = 0;
      for (let k=-r; k<=r; k++) s += a[base + Math.min(w-1, Math.max(0,k))];
      for (let x=0; x<w; x++){
        b[base+x] = s*inv;
        s += a[base + Math.min(w-1, x+r+1)] - a[base + Math.max(0, x-r)];
      }
    }
    for (let x=0; x<w; x++){
      let s = 0;
      for (let k=-r; k<=r; k++) s += b[Math.min(h-1, Math.max(0,k))*w + x];
      for (let y=0; y<h; y++){
        a[y*w+x] = s*inv;
        s += b[Math.min(h-1, y+r+1)*w + x] - b[Math.max(0, y-r)*w + x];
      }
    }
  }
  return a;
}
const q16 = f => { const o = new Uint16Array(f.length); for (let i=0;i<f.length;i++) o[i] = Math.max(0,Math.min(65535, f[i]*65535+.5)); return o; };

const NEED_ALL = {detail:true, texture:true, clarity:true, denoise:true, dehaze:true};
function needFor(p){ return {detail: p.sharpen!==0 || p.clarity!==0 || p.texture!==0, texture: p.texture!==0, clarity: p.clarity!==0, denoise: p.denoise>0, dehaze: p.dehaze!==0}; }

// k = scale relative to preview so radii look consistent; refEdge = long edge of the whole picture (for crops)
function prepare(id, k, need = NEED_ALL, refEdge){
  const w = id.width, h = id.height, d = id.data, n = w*h;
  refEdge = refEdge || Math.max(w,h);
  const L = new Float32Array(n);
  for (let i=0,j=0;i<n;i++,j+=4) L[i] = (0.2126*d[j]+0.7152*d[j+1]+0.0722*d[j+2])/255;
  const P = {w,h,d,k,refEdge,ox:0,oy:0,fw:w,fh:h};
  P.L = q16(L);
  if (!(need.detail || need.texture || need.clarity || need.denoise || need.dehaze)) return P;
  const buf = new Float32Array(n), tmp = new Float32Array(n);
  if (need.detail) P.Ls = q16(blur(L,w,h,Math.max(1,Math.round(k)),buf,tmp));
  if (need.texture) P.Lt = q16(blur(L,w,h,Math.max(2,Math.round(3*k)),buf,tmp));
  if (need.clarity) P.Ll = q16(blur(L,w,h,Math.max(3,Math.round(refEdge/90)),buf,tmp));
  if (need.dehaze){
    for (let i=0,j=0;i<n;i++,j+=4) buf[i] = Math.min(d[j],d[j+1],d[j+2])/255;
    P.Lh = q16(blur(buf,w,h,Math.max(3,Math.round(refEdge/50)),buf,tmp));
  }
  if (need.denoise){
    const rd = Math.max(1, Math.round(2*k));
    for (const [c,name] of [[0,"Rb"],[1,"Gb"],[2,"Bb"]]){
      for (let i=0,j=c;i<n;i++,j+=4) buf[i] = d[j]/255;
      P[name] = q16(blur(buf,w,h,rd,buf,tmp));
    }
  }
  return P;
}

// Richardson-Lucy deconvolution on luminance (gaussian-like PSF)
const deblurRadius = (P, size) => Math.max(1, Math.round(size*P.k));
function ensureDeblur(P, size){
  const r = deblurRadius(P, size);
  if (P.Ld && P.LdR === r) return;
  const {w,h} = P, n = w*h, I = 1/65535, e = 1e-3;
  const est = new Float32Array(n), be = new Float32Array(n), tmp = new Float32Array(n);
  for (let i=0;i<n;i++) est[i] = P.L[i]*I + e;
  for (let it=0; it<7; it++){
    blur(est,w,h,r,be,tmp);
    for (let i=0;i<n;i++) be[i] = (P.L[i]*I + e)/Math.max(e, be[i]);
    blur(be,w,h,r,be,tmp);
    for (let i=0;i<n;i++){ const v = est[i]*be[i]; est[i] = v < 0 ? 0 : v > 1.3 ? 1.3 : v; }
  }
  for (let i=0;i<n;i++) est[i] -= e;
  P.Ld = q16(est); P.LdR = r;
}

function hash(i){ let h = Math.imul(i ^ (i>>>15), 0x2c1b3c6d); h = Math.imul(h ^ (h>>>12), 0x297a2d39); h ^= h>>>15; return ((h>>>0) & 1023)/1023 - .5; }
const ss = (a,b,x) => { const t = Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };

function render(P, p, out){
  const {w,h,d,k} = P, o = out.data, I = 1/65535;
  const ox = P.ox||0, oy = P.oy||0, fw = P.fw||w, fh = P.fh||h;
  const dn = p.denoise/100, sig = 0.02 + 0.07*dn, sig2 = 2*sig*sig;
  const sh = (p.sharpen/100)*1.7*(1-0.5*dn);
  const cl = (p.clarity/100)*1.3, tx = (p.texture/100)*1.5;
  const ms = p.masking/100, db = p.deblur/100, dh = p.dehaze/100, gk = Math.max(1, Math.round(k));
  const expF = Math.pow(2, p.exposure/2.2);
  const kc = p.contrast/100, cf = kc>=0 ? 1+kc*0.9 : 1+kc*0.65;
  const hi = p.highlights/100, so = p.shadows/100;
  const wp = 1 - (p.whites/100)*0.22, bp = -(p.blacks/100)*0.10, lv = 1/(wp-bp);
  const t = p.temp/100, rM = 1+t*0.16, bM = 1-t*0.16, gM = 1-(p.tint/100)*0.11;
  const sat = 1 + p.saturation/100, vib = p.vibrance/100;
  const vg = p.vignette/100, gr = (p.grain/100)*0.13, gs = Math.max(1, Math.round(k));
  const gw = Math.ceil(fw/gs);
  const cx = fw/2 - ox, cy = fh/2 - oy, rad = 1/Math.sqrt((fw/2)*(fw/2)+(fh/2)*(fh/2));
  const hasDn = dn>0 && P.Rb;
  const hasDet = (sh!==0 && P.Ls) || (cl!==0 && P.Ll) || (tx!==0 && P.Lt) || (db>0 && P.Ld);
  const hasDh = dh!==0 && P.Lh;
  for (let y=0, i=0; y<h; y++){
    for (let x=0; x<w; x++, i++){
      const j = i*4;
      let r = d[j]/255, g = d[j+1]/255, b = d[j+2]/255;
      const Lsrc = P.L[i]*I;
      if (hasDn){
        const rb = P.Rb[i]*I, gb = P.Gb[i]*I, bb = P.Bb[i]*I;
        const Lb = 0.2126*rb+0.7152*gb+0.0722*bb, df = Lsrc-Lb;
        const wl = dn*Math.exp(-(df*df)/sig2);
        // luminance: edge-aware; chroma: always smoothed
        const Ln = Lsrc + (Lb-Lsrc)*wl, cd = Math.min(1, dn*1.2);
        r = Ln + ((r-Lsrc) + ((rb-Lb)-(r-Lsrc))*cd);
        g = Ln + ((g-Lsrc) + ((gb-Lb)-(g-Lsrc))*cd);
        b = Ln + ((b-Lsrc) + ((bb-Lb)-(b-Lsrc))*cd);
      }
      if (hasDet){
        let add = 0;
        const lsv = P.Ls ? P.Ls[i]*I : Lsrc;
        if (db>0 && P.Ld) add += (P.Ld[i]*I - Lsrc)*db*1.2;
        if (sh!==0 && P.Ls){
          let dt = Lsrc - lsv; const a = Math.abs(dt); if (a < 0.01) dt *= a/0.01;
          let m = 1;
          if (ms>0){
            const il = x>=gk ? i-gk : i, ir = x<w-gk ? i+gk : i, iu = y>=gk ? i-gk*w : i, idn = y<h-gk ? i+gk*w : i;
            const eg = (Math.abs(P.Ls[ir]-P.Ls[il]) + Math.abs(P.Ls[idn]-P.Ls[iu]))*I;
            const th = ms*0.07; m = ss(th*0.4, th*1.4+0.002, eg);
          }
          add += dt*sh*m;
        }
        if (tx!==0 && P.Lt) add += (lsv - P.Lt[i]*I)*tx*(0.3+2.8*Lsrc*(1-Lsrc));
        if (cl!==0 && P.Ll){ const m = 4*Lsrc*(1-Lsrc); add += (lsv - P.Ll[i]*I)*cl*m; }
        r += add; g += add; b += add;
      }
      if (hasDh){
        if (dh>0){ const v = Math.min(0.6, P.Lh[i]*I*dh*0.75), iv = 1/(1-v); r=(r-v)*iv; g=(g-v)*iv; b=(b-v)*iv; }
        else { const v = -dh*0.35; r += (0.8-r)*v; g += (0.8-g)*v; b += (0.8-b)*v; }
      }
      // exposure (gamma-correct multiply) with soft shoulder
      if (expF !== 1){
        r*=expF; g*=expF; b*=expF;
        if (expF > 1){
          if (r>.85) r = .85+.15*(1-Math.exp(-(r-.85)/.15));
          if (g>.85) g = .85+.15*(1-Math.exp(-(g-.85)/.15));
          if (b>.85) b = .85+.15*(1-Math.exp(-(b-.85)/.15));
        }
      }
      // levels
      r=(r-bp)*lv; g=(g-bp)*lv; b=(b-bp)*lv;
      // contrast around mid grey
      if (cf!==1){ r=.5+(r-.5)*cf; g=.5+(g-.5)*cf; b=.5+(b-.5)*cf; }
      // shadows / highlights
      if (hi!==0 || so!==0){
        const l = Math.max(0,Math.min(1,0.2126*r+0.7152*g+0.0722*b));
        const delta = so*0.32*(1-ss(0,.6,l)) + hi*0.32*ss(.4,1,l);
        r+=delta; g+=delta; b+=delta;
      }
      // white balance
      r*=rM; g*=gM; b*=bM;
      // vibrance & saturation
      if (vib!==0 || sat!==1){
        const l = 0.2126*r+0.7152*g+0.0722*b;
        const mx = Math.max(r,g,b), mn = Math.min(r,g,b), c = Math.max(0,Math.min(1,mx-mn));
        const f = sat * (1 + vib*(1-c)*(vib>0?1.1:1));
        r = l+(r-l)*f; g = l+(g-l)*f; b = l+(b-l)*f;
      }
      if (vg!==0){
        const dx=(x-cx), dy=(y-cy), dd = Math.sqrt(dx*dx+dy*dy)*rad;
        const m = 1 - vg*0.7*ss(.35,1.15,dd);
        r*=m; g*=m; b*=m;
      }
      if (gr>0){
        const gi = (((y+oy)/gs)|0)*gw + (((x+ox)/gs)|0);
        const l = Math.max(0,Math.min(1,0.2126*r+0.7152*g+0.0722*b));
        const nz = hash(gi)*gr*(0.4+2.4*l*(1-l));
        r+=nz; g+=nz; b+=nz;
      }
      o[j]=r*255; o[j+1]=g*255; o[j+2]=b*255; o[j+3]=d[j+3];
    }
  }
  return out;
}

function computeAuto(P){
  const {w,h,d} = P, n = w*h, hist = new Uint32Array(256);
  let sr=0,sg=0,sb=0,cnt=0,sum=0;
  for (let i=0;i<n;i+=2){
    const j=i*4, l = P.L[i]/65535; hist[Math.min(255,(l*255)|0)]++; sum+=l;
    if (l>.15 && l<.85){ sr+=d[j]; sg+=d[j+1]; sb+=d[j+2]; cnt++; }
  }
  const tot = Math.ceil(n/2); let acc=0, p1=0, p99=1;
  for (let i=0;i<256;i++){ acc+=hist[i]; if (acc>=tot*.005){ p1=i/255; break; } }
  acc=0; for (let i=255;i>=0;i--){ acc+=hist[i]; if (acc>=tot*.005){ p99=i/255; break; } }
  const mean = sum/tot, cl = (v,a,b)=>Math.max(a,Math.min(b,v));
  const a = {...DEF};
  a.blacks = Math.round(cl(-(p1*0.85)/0.10*100,-60,15));
  a.whites = Math.round(cl(((1-p99)*0.85)/0.22*100,-10,60));
  const bp = -(a.blacks/100)*0.10, wp = 1-(a.whites/100)*0.22, m2 = (mean-bp)/(wp-bp);
  a.exposure = Math.round(cl(2.2*Math.log2(0.47/Math.max(.05,m2))*0.7,-1.2,1.2)*20)/20;
  if (cnt>50){
    const R=sr/cnt,G=sg/cnt,B=sb/cnt;
    a.temp = Math.round(cl(((B-R)/(B+R))/0.16*100*0.55,-35,35));
    a.tint = Math.round(cl((1-(R+B)/(2*G))/0.11*100*0.5,-30,30));
  }
  a.shadows = Math.round(cl((0.42-mean)*90,0,35));
  a.highlights = Math.round(cl(-(p99-0.85)*160,-35,0));
  a.contrast = 8; a.vibrance = 22; a.texture = 10; a.clarity = 12; a.sharpen = 45; a.masking = 25; a.denoise = 12;
  return a;
}

const LOOKS = [
  ["Original", p=>({...DEF})],
  ["Naturel", a=>({...a})],
  ["Ultra net", a=>({...a, texture:35, clarity:a.clarity+10, dehaze:10, sharpen:90, masking:35, deblur:35, deblurSize:1, denoise:Math.max(a.denoise,15)})],
  ["Studio portrait", a=>({...a, texture:-8, clarity:6, sharpen:70, masking:65, deblur:20, denoise:25, highlights:a.highlights-8, vibrance:a.vibrance-4})],
  ["Produit", a=>({...a, texture:25, clarity:a.clarity+6, dehaze:8, sharpen:80, masking:45, whites:a.whites+12, contrast:a.contrast+8, vibrance:a.vibrance+8})],
  ["Éclatant", a=>({...a, vibrance:a.vibrance+25, contrast:a.contrast+12, clarity:a.clarity+12})],
  ["Portrait doux", a=>({...a, clarity:-12, sharpen:22, denoise:35, highlights:a.highlights-12, temp:a.temp+8, vibrance:a.vibrance-6})],
  ["Paysage", a=>({...a, clarity:40, vibrance:a.vibrance+28, highlights:Math.min(a.highlights,-35), shadows:a.shadows+20, sharpen:65})],
  ["Argentique N&B", a=>({...a, saturation:-100, vibrance:0, contrast:a.contrast+22, clarity:24, grain:32, vignette:18})],
  ["Cinéma", a=>({...a, contrast:a.contrast+16, temp:a.temp-8, tint:a.tint+4, saturation:-14, blacks:a.blacks+12, vignette:28, grain:10})],
  ["Doré", a=>({...a, temp:a.temp+24, tint:a.tint+6, vibrance:a.vibrance+12, highlights:a.highlights-10, vignette:15})],
];
const clampP = p => { for (const [k,,mn,mx] of sliderDefs()) p[k] = Math.max(mn, Math.min(mx, p[k] ?? DEF[k])); return p; };

function buildLooks(){
  const host = $("#looks"); host.innerHTML = "";
  LOOKS.forEach(([name, fn], idx) => {
    const btn = document.createElement("button"); btn.className = "look"; btn.setAttribute("aria-pressed","false"); btn.dataset.idx = idx;
    const c = document.createElement("canvas"); c.width = thumb.w; c.height = thumb.h;
    const lp = clampP(fn(autoP));
    if (lp.deblur > 0) ensureDeblur(thumb, lp.deblurSize);
    const ctx = c.getContext("2d"); const out = ctx.createImageData(thumb.w, thumb.h);
    ctx.putImageData(render(thumb, lp, out), 0, 0);
    btn.append(c); const s = document.createElement("span"); s.textContent = name; btn.append(s);
    btn.onclick = () => { stepLabel = "Style " + name; params = clampP(fn(autoP)); activeLook = idx; markLooks(); syncUI(); schedule(); commit(); };
    host.append(btn);
  });
  markLooks();
}
function markLooks(){ $$(".look").forEach(b => b.setAttribute("aria-pressed", +b.dataset.idx === activeLook)); }

$("#autoBtn").onclick = () => { stepLabel = "Amélioration auto"; params = {...autoP}; activeLook = 1; markLooks(); syncUI(); schedule(); commit(); };
$("#resetAll").onclick = () => { stepLabel = "Réglages remis à zéro"; params = {...DEF}; activeLook = 0; markLooks(); syncUI(); schedule(); commit(); };

/* ---------- Preview pipeline ---------- */
let outData = null, pending = false;
function schedule(){
  autosave();
  if (pending || !prev) return;
  if (params.deblur > 0 && (!prev.Ld || prev.LdR !== deblurRadius(prev, params.deblurSize))){
    pending = true; busy(true, "Correction du flou…");
    setTimeout(() => { ensureDeblur(prev, params.deblurSize); busy(false); pending = false; schedule(); }, 30);
    return;
  }
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (prevLo && Date.now() - interacting < 140 && !cutActive() && !light.on){
      if (params.deblur > 0) ensureDeblur(prevLo, params.deblurSize);
      if (!outLo) outLo = new ImageData(prevLo.w, prevLo.h);
      render(prevLo, params, outLo); applyArt(outLo, params, prevLo.k);
      if (loC.width !== prevLo.w || loC.height !== prevLo.h){ loC.width = prevLo.w; loC.height = prevLo.h; }
      loC.getContext("2d").putImageData(outLo, 0, 0); view.classList.remove("checker");
      vctx.imageSmoothingEnabled = true; vctx.imageSmoothingQuality = "high"; vctx.drawImage(loC, 0, 0, view.width, view.height);
      clearTimeout(fullTimer); fullTimer = setTimeout(schedule, 160);
      return;
    }
    outData = render(prev, params, outData); applyArt(outData, params, 1); lightPreview(); paintView();
    if ($('[data-pane="lumiere"]').classList.contains("on")) drawHisto();
    scheduleLoupe();
  });
}

function drawHisto(){
  if (!outData) return;
  const c = $("#histo"), ctx = c.getContext("2d"), d = outData.data;
  const hr = new Uint32Array(64), hg = new Uint32Array(64), hb = new Uint32Array(64);
  for (let j=0;j<d.length;j+=16){ hr[d[j]>>2]++; hg[d[j+1]>>2]++; hb[d[j+2]>>2]++; }
  let mx = 1; for (let i=1;i<63;i++) mx = Math.max(mx,hr[i],hg[i],hb[i]);
  ctx.clearRect(0,0,c.width,c.height);
  ctx.globalCompositeOperation = getComputedStyle(document.documentElement).colorScheme==="dark" ? "lighter" : "multiply";
  const draw = (hh, col) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0,c.height);
    for (let i=0;i<64;i++) ctx.lineTo(i/63*c.width, c.height - Math.min(1,hh[i]/mx)*(c.height-6));
    ctx.lineTo(c.width,c.height); ctx.closePath(); ctx.fill();
  };
  const dark = ctx.globalCompositeOperation === "lighter";
  draw(hr, dark?"rgba(220,70,70,.7)":"rgba(230,90,90,.75)");
  draw(hg, dark?"rgba(70,190,90,.7)":"rgba(90,200,110,.75)");
  draw(hb, dark?"rgba(80,120,230,.7)":"rgba(90,130,240,.75)");
  ctx.globalCompositeOperation = "source-over";
}

function fitFrame(){
  if (!prev) return;
  const st = $("#stage"), pad = 14;
  const W = st.clientWidth - pad*2, H = st.clientHeight - pad*2;
  const s = Math.min(W/prev.w, H/prev.h);
  frame.style.width = Math.max(1, Math.floor(prev.w*s)) + "px";
  frame.style.height = Math.max(1, Math.floor(prev.h*s)) + "px";
}
new ResizeObserver(fitFrame).observe($("#stage"));

function scaledCanvas(srcC, maxEdge){
  const s = Math.min(1, maxEdge/Math.max(srcC.width, srcC.height));
  const w = Math.max(1, Math.round(srcC.width*s)), h = Math.max(1, Math.round(srcC.height*s));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(srcC,0,0,w,h);
  return c;
}

function buildPreview(keepParams){
  const pc = scaledCanvas(src, PREV_EDGE);
  view.width = orig.width = pc.width; view.height = orig.height = pc.height;
  octx.drawImage(pc,0,0);
  const id = pc.getContext("2d").getImageData(0,0,pc.width,pc.height);
  prev = prepare(id, 1);
  const tc = scaledCanvas(src, 200);
  thumb = prepare(tc.getContext("2d").getImageData(0,0,tc.width,tc.height), tc.width/pc.width);
  const lc = scaledCanvas(src, Math.round(PREV_EDGE/2)); prevLo = prepare(lc.getContext("2d").getImageData(0,0,lc.width,lc.height), lc.width/pc.width); outLo = null;
  outData = vctx.createImageData(pc.width, pc.height);
  autoP = computeAuto(prev);
  if (!keepParams){ params = {...autoP}; committed = {...DEF}; history = []; future = []; activeLook = 1; commit(); }
  buildLooks(); syncUI();
  $("#empty").style.display = "none"; frame.style.display = "block";
  $("#panel").classList.remove("off");
  ["#compare","#exportBtn"].forEach(s => $(s).disabled = false);
  $("#tools").hidden = false;
  scheduleLoupe(0);
  if (crop && !keepParams){ crop.cx = .5; crop.cy = .5; crop.z = 1; $("#zoomS").value = 1; $("#zoomO").textContent = "×1,0"; }
  cut = null; buildBgTiles();
  if (!keepParams){ prevSrcBackup = null; $("#eraseUndo").disabled = true; }
  holeM = null; holeHas = false; ensureHole(); drawHoleOverlay(); $("#eraseRun").disabled = true; holeC.hidden = !objTool;
  fitFrame(); clampCrop(); updateCropUI(); refreshSocial(); schedule();
}

function busy(on, txt){ const b = $("#busy"); b.textContent = txt || "Préparation…"; b.classList.toggle("on", on); }

function loadFile(file){
  if (!file || !file.type.startsWith("image/")) return;
  fileBase = (file.name || "photo").replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g,"-").slice(0,60) || "photo";
  busy(true);
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => setTimeout(() => {
      let w = img.naturalWidth, h = img.naturalHeight;
      const s = Math.min(1, Math.sqrt(MAX_SRC/(w*h)));
      w = Math.round(w*s); h = Math.round(h*s);
      src = document.createElement("canvas"); src.width = w; src.height = h;
      const ctx = src.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(img,0,0,w,h);
      newProject(fileBase); buildPreview(false); busy(false); runAutopilot();
    }, 30);
    img.onerror = () => { busy(false); alert("Ce fichier n’a pas pu être lu. Essaie une photo JPEG, PNG ou WebP."); };
    img.src = rd.result;
  };
  rd.readAsDataURL(file);
}
const fileIn = $("#file");
$("#openBtn").onclick = $("#emptyOpen").onclick = () => fileIn.click();
fileIn.onchange = () => { loadFile(fileIn.files[0]); fileIn.value = ""; };
const stage = $("#stage");
stage.addEventListener("dragover", e => { e.preventDefault(); stage.classList.add("drag"); });
stage.addEventListener("dragleave", () => stage.classList.remove("drag"));
stage.addEventListener("drop", e => { e.preventDefault(); stage.classList.remove("drag"); loadFile(e.dataTransfer.files[0]); });

/* ---------- Rotate / flip ---------- */
function transformSrc(kind){
  if (!src) return;
  const r = kind==="L"||kind==="R";
  const c = document.createElement("canvas"); c.width = r?src.height:src.width; c.height = r?src.width:src.height;
  const ctx = c.getContext("2d");
  if (kind==="R"){ ctx.translate(c.width,0); ctx.rotate(Math.PI/2); }
  if (kind==="L"){ ctx.translate(0,c.height); ctx.rotate(-Math.PI/2); }
  if (kind==="H"){ ctx.translate(c.width,0); ctx.scale(-1,1); }
  if (kind==="V"){ ctx.translate(0,c.height); ctx.scale(1,-1); }
  ctx.drawImage(src,0,0); src = c; prevSrcBackup = null; $("#eraseUndo").disabled = true; srcVer++; logStep({L:"Rotation à gauche", R:"Rotation à droite", H:"Miroir horizontal", V:"Miroir vertical"}[kind], null);
  busy(true); setTimeout(() => { buildPreview(true); busy(false); }, 20);
}
$("#rotL").onclick = () => transformSrc("L"); $("#rotR").onclick = () => transformSrc("R");
$("#flipH").onclick = () => transformSrc("H"); $("#flipV").onclick = () => transformSrc("V");

/* ---------- Compare ---------- */
function setSplit(pct){
  comparePos = Math.max(0, Math.min(100, pct));
  orig.style.clipPath = comparing ? `inset(0 ${100-comparePos}% 0 0)` : "inset(0 100% 0 0)";
  $("#split").style.left = comparePos + "%";
}
$("#compare").onclick = () => {
  comparing = !comparing; $("#compare").setAttribute("aria-pressed", comparing);
  frame.classList.toggle("comparing", comparing); setSplit(50);
  if (comparing && loupeOn) $("#loupeBtn").click();
};

/* ---------- Loupe 100 % ---------- */
let loupeOn = false, lx = .5, ly = .5, loupeTimer = 0;
const loupe = $("#loupe"), lc = $("#loupeC");
$("#loupeBtn").onclick = () => {
  loupeOn = !loupeOn; $("#loupeBtn").setAttribute("aria-pressed", loupeOn);
  if (loupeOn && comparing) $("#compare").click();
  loupe.hidden = !loupeOn; frame.classList.toggle("louping", loupeOn); placeMark(); scheduleLoupe(0);
};
function placeMark(){ const m = $("#lmark"); m.style.left = lx*100 + "%"; m.style.top = ly*100 + "%"; }
function scheduleLoupe(delay = 120){ if (!loupeOn || !src || !prev) return; clearTimeout(loupeTimer); loupeTimer = setTimeout(drawLoupe, delay); }
function drawLoupe(){
  const S = Math.max(80, Math.round(loupe.clientWidth));
  if (lc.width !== S){ lc.width = S; lc.height = S; }
  const W = src.width, H = src.height, refEdge = Math.max(W, H), k = W / prev.w;
  const M = Math.max(48, Math.round(refEdge/40));
  const cxp = Math.round(lx*W), cyp = Math.round(ly*H);
  const x0 = W <= S ? 0 : Math.max(0, Math.min(W - S, cxp - (S>>1)));
  const y0 = H <= S ? 0 : Math.max(0, Math.min(H - S, cyp - (S>>1)));
  const sx = Math.max(0, x0 - M), sy = Math.max(0, y0 - M);
  const ex = Math.min(W, x0 + S + M), ey = Math.min(H, y0 + S + M);
  const id = src.getContext("2d").getImageData(sx, sy, ex - sx, ey - sy);
  const P = prepare(id, k, needFor(params), refEdge);
  P.ox = sx; P.oy = sy; P.fw = W; P.fh = H;
  if (params.deblur > 0) ensureDeblur(P, params.deblurSize);
  const out = applyArt(render(P, params, new ImageData(id.width, id.height)), params, k, sx, sy, W, H);
  const tc = document.createElement("canvas"); tc.width = id.width; tc.height = id.height;
  tc.getContext("2d").putImageData(out, 0, 0);
  const ctx = lc.getContext("2d"); ctx.clearRect(0, 0, S, S);
  const vw = Math.min(S, W), vh = Math.min(S, H);
  ctx.drawImage(tc, x0 - sx, y0 - sy, vw, vh, (S - vw)/2, (S - vh)/2, vw, vh);
}
let dragging = false, cropDrag = null;
frame.addEventListener("pointerdown", e => {
  if (objTool){ holeDrag = true; frame.setPointerCapture(e.pointerId); holeAt(e, true); return; }
  if (cut && cut.tool){ toolDrag = true; frame.setPointerCapture(e.pointerId); toolAt(e, true); return; }
  if (comparing || loupeOn){ dragging = true; frame.setPointerCapture(e.pointerId); move(e); return; }
  if (crop){ cropDrag = {x:e.clientX, y:e.clientY, cx:crop.cx, cy:crop.cy}; frame.setPointerCapture(e.pointerId); }
});
frame.addEventListener("pointermove", e => {
  if (holeDrag) return holeAt(e, false);
  if (toolDrag) return toolAt(e, false);
  if (dragging) return move(e);
  if (cropDrag && crop){
    const r = frame.getBoundingClientRect();
    crop.cx = cropDrag.cx + (e.clientX - cropDrag.x)/r.width;
    crop.cy = cropDrag.cy + (e.clientY - cropDrag.y)/r.height;
    clampCrop(); updateCropUI();
  }
});
const endDrag = () => { if (holeDrag){ holeDrag = false; holeEnd(); } if (toolDrag){ toolDrag = false; toolEnd(); } dragging = false; if (cropDrag){ cropDrag = null; refreshSocial(); } };
frame.addEventListener("pointerup", endDrag);
frame.addEventListener("pointercancel", endDrag);
function move(e){
  const r = frame.getBoundingClientRect(), fx = (e.clientX - r.left)/r.width, fy = (e.clientY - r.top)/r.height;
  if (comparing) setSplit(fx*100);
  else if (loupeOn){ lx = Math.max(0, Math.min(1, fx)); ly = Math.max(0, Math.min(1, fy)); placeMark(); scheduleLoupe(60); }
}

/* ---------- Social formats ---------- */
const SOCIAL = [
  {id:"instagram-portrait", pf:"Instagram", name:"Post portrait", w:1080, h:1350, r:"4:5", rec:"ig"},
  {id:"instagram-carre", pf:"Instagram", name:"Post carré", w:1080, h:1080, r:"1:1", rec:"ig"},
  {id:"instagram-story", pf:"Instagram", name:"Story / Reel", w:1080, h:1920, r:"9:16", rec:"vert", safe:{t:250,b:340,l:0,r:0}},
  {id:"tiktok", pf:"TikTok", name:"Photo / vidéo", w:1080, h:1920, r:"9:16", rec:"vert", safe:{t:160,b:480,l:0,r:140}},
  {id:"facebook-post", pf:"Facebook", name:"Publication", w:1080, h:1350, r:"4:5", rec:"fb"},
  {id:"facebook-lien", pf:"Facebook", name:"Lien partagé", w:1200, h:630, r:"1,91:1", rec:"fb"},
  {id:"facebook-story", pf:"Facebook", name:"Story", w:1080, h:1920, r:"9:16", rec:"vert", safe:{t:250,b:340,l:0,r:0}},
  {id:"youtube-miniature", pf:"YouTube", name:"Miniature", w:1280, h:720, r:"16:9", rec:"yt"},
  {id:"youtube-banniere", pf:"YouTube", name:"Bannière de chaîne", w:2560, h:1440, r:"16:9", rec:"ytb", safe:{t:508,b:509,l:507,r:507}},
  {id:"linkedin-post", pf:"LinkedIn", name:"Publication", w:1080, h:1350, r:"4:5", rec:"li"},
  {id:"linkedin-lien", pf:"LinkedIn", name:"Lien partagé", w:1200, h:630, r:"1,91:1", rec:"li"},
  {id:"x-post", pf:"X", name:"Publication", w:1600, h:900, r:"16:9", rec:"x"},
  {id:"pinterest", pf:"Pinterest", name:"Épingle", w:1000, h:1500, r:"2:3", rec:"pin"},
];
const RECO = {
  ig:{fmt:"jpg", q:.9, tips:[
    "Le portrait 4:5 occupe le plus de place dans le fil : c’est le format le plus visible.",
    "Instagram recompresse chaque photo : exporter pile en 1080 px de large évite une perte de qualité en plus.",
    "Les réglages conseillés compensent cette compression avec un peu plus de texture et de netteté."],
    adj:p=>({...p, vibrance:p.vibrance+10, texture:p.texture+10, sharpen:Math.max(p.sharpen,55), masking:Math.max(p.masking,35)})},
  vert:{fmt:"jpg", q:.9, tips:[
    "Garde visages et textes hors des zones rouges : le nom, les boutons et la légende les recouvrent.",
    "Sur un écran de téléphone, un contraste un peu plus franc rend mieux."],
    adj:p=>({...p, contrast:p.contrast+10, clarity:p.clarity+10, vibrance:p.vibrance+12, sharpen:Math.max(p.sharpen,50), masking:Math.max(p.masking,30)})},
  fb:{fmt:"jpg", q:.9, tips:[
    "Facebook compresse fortement : exporte aux dimensions exactes pour limiter la perte.",
    "Choisis PNG seulement si l’image contient du texte ou un logo."],
    adj:p=>({...p, vibrance:p.vibrance+8, texture:p.texture+8, sharpen:Math.max(p.sharpen,55), masking:Math.max(p.masking,35)})},
  yt:{fmt:"jpg", q:.92, tips:[
    "La miniature s’affiche souvent en petit : couleurs et contraste francs, sujet bien lisible.",
    "YouTube limite le fichier à 2 Mo : le JPEG reste sous cette taille, le PNG pas toujours.",
    "Évite le coin en bas à droite, recouvert par la durée de la vidéo."],
    adj:p=>({...p, contrast:p.contrast+18, vibrance:p.vibrance+22, clarity:p.clarity+18, dehaze:p.dehaze+10, sharpen:Math.max(p.sharpen,60), masking:Math.max(p.masking,30)})},
  ytb:{fmt:"jpg", q:.92, tips:[
    "Seule la zone centrale (1546 × 423 px) est visible sur tous les appareils : places-y le sujet et le texte.",
    "Le reste n’apparaît que sur grand écran : garde-le simple."],
    adj:p=>({...p, clarity:p.clarity+10, vibrance:p.vibrance+10, sharpen:Math.max(p.sharpen,45)})},
  li:{fmt:"jpg", q:.92, tips:[
    "Sur LinkedIn, un rendu naturel et net inspire confiance : évite les filtres marqués.",
    "Pour un portrait, un masquage élevé garde les yeux nets et la peau douce."],
    adj:p=>({...p, vibrance:p.vibrance+5, texture:p.texture+5, sharpen:Math.max(p.sharpen,50), masking:Math.max(p.masking,45)})},
  x:{fmt:"jpg", q:.92, tips:[
    "Le 16:9 s’affiche en entier dans le fil, sans recadrage.",
    "Pour une capture d’écran ou un visuel avec texte, préfère le PNG."],
    adj:p=>({...p, vibrance:p.vibrance+8, clarity:p.clarity+8, sharpen:Math.max(p.sharpen,50)})},
  pin:{fmt:"jpg", q:.9, tips:[
    "Les épingles verticales 2:3 s’affichent le mieux dans la grille.",
    "Une image lumineuse et nette attire davantage l’œil parmi les autres épingles."],
    adj:p=>({...p, exposure:p.exposure+0.1, dehaze:p.dehaze+8, vibrance:p.vibrance+12, texture:p.texture+12})},
};
let crop = null, recoApplied = null;
function cropRect(W, H, f, pos){
  const A = f.w/f.h; let cw, ch;
  if (W/H > A){ ch = H; cw = H*A; } else { cw = W; ch = W/A; }
  const z = pos.z || 1; cw /= z; ch /= z;
  const x = Math.max(0, Math.min(W - cw, pos.cx*W - cw/2)), y = Math.max(0, Math.min(H - ch, pos.cy*H - ch/2));
  return {x: Math.round(x), y: Math.round(y), w: Math.max(1, Math.round(cw)), h: Math.max(1, Math.round(ch))};
}
function clampCrop(){ if (!crop || !prev) return; const r = cropRect(prev.w, prev.h, crop.f, crop); crop.cx = (r.x + r.w/2)/prev.w; crop.cy = (r.y + r.h/2)/prev.h; }
function updateCropUI(){
  autosave();
  const box = $("#cropBox");
  if (!crop || !prev){ box.hidden = true; return; }
  const r = cropRect(prev.w, prev.h, crop.f, crop);
  box.hidden = false;
  Object.assign(box.style, {left: r.x/prev.w*100 + "%", top: r.y/prev.h*100 + "%", width: r.w/prev.w*100 + "%", height: r.h/prev.h*100 + "%"});
  $("#cropTag").textContent = `${crop.f.pf} · ${crop.f.r}`;
  const sz = $("#safeZone"), sf = crop.f.safe;
  if (sf && $("#safeT").checked){
    sz.hidden = false;
    Object.assign(sz.style, {top: sf.t/crop.f.h*100 + "%", bottom: sf.b/crop.f.h*100 + "%", left: sf.l/crop.f.w*100 + "%", right: sf.r/crop.f.w*100 + "%"});
  } else sz.hidden = true;
}
function buildSocial(){
  const host = $("#fmts"); host.innerHTML = "";
  const mk = (label, sub, f) => {
    const b = document.createElement("button"); b.className = "fmt"; b._f = f;
    const a = document.createElement("span"); a.textContent = label;
    const c = document.createElement("small"); c.textContent = sub;
    b.append(a, c); b.onclick = () => setFormat(f); return b;
  };
  let grid = document.createElement("div"); grid.className = "fmt-grid"; host.append(grid);
  grid.append(mk("Format d’origine", "Sans recadrage", null));
  let pf = null;
  for (const f of SOCIAL){
    if (f.pf !== pf){
      pf = f.pf;
      const h = document.createElement("div"); h.className = "sub"; h.textContent = pf; host.append(h);
      grid = document.createElement("div"); grid.className = "fmt-grid"; host.append(grid);
    }
    grid.append(mk(f.name, `${f.w} × ${f.h} · ${f.r}`, f));
  }
}
function setFormat(f){
  if ((crop ? crop.f : null) !== f) logStep(f ? `Format ${f.pf} ${f.name.toLowerCase()}` : "Format d’origine", null);
  crop = f ? {f, cx: crop ? crop.cx : .5, cy: crop ? crop.cy : .5, z: 1} : null;
  clampCrop();
  recoApplied = null;
  if (f) fmt = RECO[f.rec].fmt;
  $("#zoomS").value = 1; $("#zoomO").textContent = "×1,0";
  refreshSocial(); updateCropUI();
  $('[data-pane="reseaux"]').scrollTop = 0;
}
function refreshSocial(){
  $$("#fmts .fmt").forEach(b => b.setAttribute("aria-pressed", b._f === (crop ? crop.f : null)));
  $("#fmtDetail").hidden = !crop; $("#fmtIntro").hidden = !!crop;
  if (!crop || !src) return;
  const f = crop.f, R = RECO[f.rec];
  $("#safeRow").hidden = !f.safe;
  const r = cropRect(src.width, src.height, f, crop), up = f.w / r.w;
  const box = $("#reco"); box.innerHTML = "";
  const add = (tag, txt, cls) => { const e = document.createElement(tag); e.textContent = txt; if (cls) e.className = cls; box.append(e); return e; };
  add("h3", `Réglages conseillés · ${f.pf} ${f.name.toLowerCase()}`);
  add("p", `Dimensions : ${f.w} × ${f.h} px (${f.r})`);
  add("p", `Fichier : ${R.fmt === "jpg" ? "JPEG, qualité " + Math.round(R.q*100) + " %" : "PNG"}, couleurs sRGB`);
  add("p", "Netteté de sortie adaptée à l’écran, appliquée à l’export");
  const ul = document.createElement("ul"); R.tips.forEach(t => { const li = document.createElement("li"); li.textContent = t; ul.append(li); }); box.append(ul);
  if (up > 1.05) add("p", `Ta photo est un peu petite pour ce cadrage : elle sera agrandie ×${up.toFixed(1).replace(".", ",")}. Dézoome si possible.`, "warn");
  const btn = $("#applyReco"); btn.disabled = recoApplied === f.id;
  btn.textContent = recoApplied === f.id ? "Réglages conseillés appliqués" : "Appliquer les réglages conseillés";
}
$("#zoomS").addEventListener("input", () => {
  if (!crop) return; crop.z = +$("#zoomS").value;
  $("#zoomO").textContent = "×" + crop.z.toFixed(1).replace(".", ",");
  clampCrop(); updateCropUI();
});
$("#zoomS").addEventListener("change", refreshSocial);
$("#safeT").addEventListener("change", updateCropUI);
$("#applyReco").onclick = () => {
  if (!crop) return;
  stepLabel = "Réglages conseillés " + crop.f.pf; params = clampP(RECO[crop.f.rec].adj({...params})); recoApplied = crop.f.id;
  activeLook = null; markLooks(); syncUI(); schedule(); commit(); refreshSocial();
};
buildSocial(); refreshSocial();

async function exportCanvas(sc, p, k, f, pos, useCut){
  const r = cropRect(sc.width, sc.height, f, pos);
  const cc = document.createElement("canvas"); cc.width = r.w; cc.height = r.h;
  cc.getContext("2d").drawImage(sc, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  let done = await renderFull(cc, p, k, 1);
  if (useCut && (cutActive() || light.on)){
    let ac = null;
    if (cut){
      ac = document.createElement("canvas"); ac.width = done.width; ac.height = done.height;
      const ax = ac.getContext("2d"); ax.imageSmoothingQuality = "high";
      ax.drawImage(cut.alphaC, r.x*cut.W/sc.width, r.y*cut.H/sc.height, r.w*cut.W/sc.width, r.h*cut.H/sc.height, 0, 0, ac.width, ac.height);
    }
    lightCanvas(done, ac);
    if (cutActive()) done = composeCut(done, ac);
  }
  return resizeTo(done, f.w, f.h);
}
function resizeTo(c, tw, th){
  let cur = c;
  while (cur.width/2 >= tw && cur.height/2 >= th){
    const n = document.createElement("canvas"); n.width = Math.round(cur.width/2); n.height = Math.round(cur.height/2);
    const x = n.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, n.width, n.height); cur = n;
  }
  const out = document.createElement("canvas"); out.width = tw; out.height = th;
  const x = out.getContext("2d"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, tw, th);
  const f = tw / c.width;
  if (f > 1.15) sharpenCanvas(out, 0.6, 1); else if (f < 0.95) sharpenCanvas(out, 0.3, 1);
  return out;
}

/* ---------- Export ---------- */
let fmt = "jpg", scale = 1;
// Formats d'export : WebP (et AVIF quand le navigateur sait l'encoder) donnent des fichiers
// bien plus légers que JPEG à qualité égale, avec transparence possible (comme Squoosh).
const FMT_MIME = {jpg:"image/jpeg", png:"image/png", webp:"image/webp", avif:"image/avif"};
const FMT_LABEL = {jpg:"JPEG", png:"PNG", webp:"WebP", avif:"AVIF"};
const fmtQuality = (f, rq) => f === "jpg" ? (rq || 0.93) : f === "png" ? 1 : f === "avif" ? 0.7 : 0.88;
const canEncode = f => { try { const c = document.createElement("canvas"); c.width = c.height = 2; return c.toDataURL(FMT_MIME[f]).startsWith("data:" + FMT_MIME[f]); } catch (e) { return false; } };
["webp", "avif"].forEach(f => { if (!canEncode(f)) $$(`[data-fmt="${f}"]`).forEach(b => b.remove()); });
function outDims(sc){ return [src.width*sc, src.height*sc]; }
function refreshSheet(){
  const tr = cutActive() && bgOpt.bg === "transparent";
  if (tr && fmt === "jpg") fmt = "png";
  $$("#fmtSeg button").forEach(b => b.disabled = tr && b.dataset.fmt === "jpg");
  $$("#sizeSeg button").forEach(b => {
    const s = +b.dataset.scale, [w,h] = outDims(s);
    b.disabled = s>1 && w*h > MAX_OUT;
    if (b.disabled && scale===s) scale = 1;
  });
  $$("#sizeSeg button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.scale===scale));
  $$("#fmtSeg button").forEach(b => b.setAttribute("aria-pressed", b.dataset.fmt===fmt));
  $("#sizeSeg").style.display = $("#sizeLabel").style.display = crop ? "none" : "";
  if (crop){
    const R = RECO[crop.f.rec];
    $("#outInfo").textContent = `${crop.f.pf} · ${crop.f.name} : ${crop.f.w} × ${crop.f.h} px. Export optimisé (${fmt === "jpg" ? "JPEG qualité " + Math.round(R.q*100) + " %" : FMT_LABEL[fmt]}, netteté écran).`;
    return;
  }
  const [w,h] = outDims(scale);
  let info = `${w} × ${h} px, ${(w*h/1e6).toFixed(1)} Mpx`;
  if (scale>1) info += ". Agrandissement par interpolation fine et accentuation des détails.";
  if ([...$$("#sizeSeg button")].some(b=>b.disabled)) info += " Les tailles grisées dépassent 16 Mpx.";
  $("#outInfo").textContent = info;
}
$$("#fmtSeg button").forEach(b => b.onclick = () => { fmt = b.dataset.fmt; refreshSheet(); });
$$("#sizeSeg button").forEach(b => b.onclick = () => { if (!b.disabled){ scale = +b.dataset.scale; refreshSheet(); } });
$("#exportBtn").onclick = () => { $("#exportMsg").textContent = ""; $("#fallback").style.display = "none"; refreshSheet(); $("#sheet").classList.add("on"); };
$("#cancelExport").onclick = () => $("#sheet").classList.remove("on");
$("#sheet").addEventListener("click", e => { if (e.target.id === "sheet") $("#sheet").classList.remove("on"); });
document.addEventListener("keydown", e => { if (e.key === "Escape") $("#sheet").classList.remove("on"); });

let downloads = null;
if (window.artcraftRuntime && window.artcraftRuntime.use) window.artcraftRuntime.use("downloads").then(d => downloads = d).catch(() => {});

function sharpenCanvas(c, amount, r){
  const ctx = c.getContext("2d"), id = ctx.getImageData(0,0,c.width,c.height), d = id.data, n = c.width*c.height;
  const L = new Float32Array(n);
  for (let i=0,j=0;i<n;i++,j+=4) L[i] = (0.2126*d[j]+0.7152*d[j+1]+0.0722*d[j+2])/255;
  const B = blur(L, c.width, c.height, r);
  for (let i=0,j=0;i<n;i++,j+=4){
    let dt = L[i]-B[i]; const a = Math.abs(dt); if (a<0.008) dt *= a/0.008;
    const add = dt*amount*255; d[j]+=add; d[j+1]+=add; d[j+2]+=add;
  }
  ctx.putImageData(id,0,0);
}

$("#doExport").onclick = () => {
  const btn = $("#doExport"); btn.disabled = true; $("#exportMsg").textContent = "Traitement en pleine résolution…";
  setTimeout(async () => {
    try {
      const k = src.width / prev.w;
      if (cutActive() && bgOpt.bg === "transparent" && fmt === "jpg") fmt = "png";
      let final = crop ? await exportCanvas(src, params, k, crop.f, crop, true) : await renderFull(src, params, k, scale, () => { $("#exportMsg").textContent = "Agrandissement…"; });
      if (!crop) lightCanvas(final, cut ? cut.alphaC : null);
      if (!crop && cutActive()) final = composeCut(final, cut.alphaC);
      const mime = FMT_MIME[fmt];
      const q = fmtQuality(fmt, crop ? RECO[crop.f.rec].q : 0);
      const blob = await new Promise(r => final.toBlob(r, mime, q));
      if (!blob) throw new Error("encode");
      const name = crop ? `${fileBase}-${crop.f.id}.${fmt}` : `${fileBase}-artcraft${scale>1?"-x"+scale:""}.${fmt}`;
      if (downloads){
        try {
          await downloads.save({filename: name, data: blob});
          $("#exportMsg").textContent = "Photo exportée.";
        } catch (err) {
          if (err && err.code === "declined") $("#exportMsg").textContent = "Export annulé.";
          else if (err && err.code === "rate_limited") $("#exportMsg").textContent = "Une demande d’enregistrement est déjà ouverte. Réessaie dans un instant.";
          else showFallback(final, mime);
        }
      } else browserSave(blob, name, final, mime);
    } catch (e) {
      $("#exportMsg").textContent = "L’export a échoué : la photo est peut-être trop grande pour cet appareil. Essaie la taille originale.";
    }
    btn.disabled = false;
  }, 40);
};
function showFallback(c, mime){
  $("#fallbackImg").src = c.toDataURL(mime, 0.93);
  $("#fallback").style.display = "block";
  $("#exportMsg").textContent = "Ta photo est prête.";
}
/* ---------- Shared full-resolution render ---------- */
async function renderFull(sc, p, k, up, onUpscale){
  const id = sc.getContext("2d").getImageData(0,0,sc.width,sc.height);
  const P = prepare(id, k, needFor(p));
  if (p.deblur > 0) ensureDeblur(P, p.deblurSize);
  const outC = document.createElement("canvas"); outC.width = sc.width; outC.height = sc.height;
  const cx = outC.getContext("2d");
  cx.putImageData(applyArt(render(P, p, cx.createImageData(sc.width, sc.height)), p, k), 0, 0);
  if (up <= 1) return outC;
  if (onUpscale) onUpscale();
  await yieldUI();
  let cur = outC;
  for (let s=2; s<=up; s*=2){
    const n = document.createElement("canvas"); n.width = cur.width*2; n.height = cur.height*2;
    const nctx = n.getContext("2d"); nctx.imageSmoothingEnabled = true; nctx.imageSmoothingQuality = "high";
    nctx.drawImage(cur,0,0,n.width,n.height);
    sharpenCanvas(n, 0.7, 2);
    cur = n;
  }
  return cur;
}

/* ---------- Batch ---------- */
function decodeFile(file){
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onerror = () => rej(new Error("read"));
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        const s = Math.min(1, Math.sqrt(MAX_SRC/(w*h)));
        w = Math.round(w*s); h = Math.round(h*s);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d"); ctx.imageSmoothingQuality = "high"; ctx.drawImage(img,0,0,w,h);
        res(c);
      };
      img.onerror = () => rej(new Error("decode"));
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const toBlob = (c, mime, q = 0.93) => new Promise(r => c.toBlob(r, mime, q));
const plural = (n, w) => `${n} ${w}${n>1?"s":""}`;

let bSoc = null;
let bFiles = [], bMode = "auto", bLook = 1, bFmt = "jpg", bScale = 1, bResults = [], bRunning = false, bDone = false;
const bsheet = $("#bsheet");
function openBatch(){ refreshB(); bsheet.classList.add("on"); }
$("#batchBtn").onclick = openBatch;
$("#emptyBatch").onclick = openBatch;
$("#bClose").onclick = () => bsheet.classList.remove("on");
bsheet.addEventListener("click", e => { if (e.target === bsheet) bsheet.classList.remove("on"); });
document.addEventListener("keydown", e => { if (e.key === "Escape") bsheet.classList.remove("on"); });
$("#bPick").onclick = () => $("#bFiles").click();
$("#bFiles").onchange = () => {
  const picked = [...$("#bFiles").files].filter(f => f.type.startsWith("image/"));
  $("#bFiles").value = "";
  if (!picked.length) return;
  if (bRunning) return;
  bFiles = picked.slice(0, 500);
  bDone = false; bResults = []; if (job) clearJob();
  clearOut();
  if (picked.length > 500) $("#bMsg").textContent = "Seules les 500 premières photos ont été gardées.";
  buildBList(); refreshB();
};
LOOKS.forEach(([name], idx) => {
  if (!idx) return;
  const b = document.createElement("button"); b.textContent = name; b.dataset.idx = idx;
  b.onclick = () => { bLook = idx; invalidate(); refreshB(); };
  $("#bStyle").append(b);
});
$$("#bMode button").forEach(b => b.onclick = () => { if (!b.disabled){ bMode = b.dataset.mode; invalidate(); refreshB(); } });
$$("#bFmt button").forEach(b => b.onclick = () => { bFmt = b.dataset.fmt; invalidate(); refreshB(); });
[null, ...SOCIAL].forEach(f => {
  const b = document.createElement("button"); b._f = f;
  b.textContent = f ? `${f.pf} ${f.name.toLowerCase()}` : "Aucun recadrage";
  b.onclick = () => { bSoc = f; if (f) bFmt = RECO[f.rec].fmt; invalidate(); refreshB(); };
  $("#bSoc").append(b);
});
$("#bReco").addEventListener("change", () => { invalidate(); refreshB(); });
$$("#bSize button").forEach(b => b.onclick = () => { bScale = +b.dataset.scale; invalidate(); refreshB(); });

function clearOut(){ $("#bBar").hidden = true; $("#bBar i").style.width = "0"; $("#bFallback").style.display = "none"; $("#bFallback").innerHTML = ""; $("#bMsg").textContent = ""; }
function invalidate(){ if (job && job.finished && !bRunning){ clearJob(); clearOut(); buildBList(); } }
function refreshB(){
  $$("#bMode button").forEach(b => { b.disabled = b.dataset.mode !== "auto" && !src; if (b.disabled && bMode === b.dataset.mode) bMode = "auto"; });
  $$("#bMode button").forEach(b => b.setAttribute("aria-pressed", b.dataset.mode === bMode));
  $("#bStyleWrap").style.display = $("#bArtWrap").style.display = bMode === "auto" ? "" : "none";
  $$("#bArt button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.art === bArtSel));
  $$("#bStyle button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.idx === bLook));
  $$("#bFmt button").forEach(b => b.setAttribute("aria-pressed", b.dataset.fmt === bFmt));
  $$("#bSize button").forEach(b => b.setAttribute("aria-pressed", +b.dataset.scale === bScale));
  $$("#bSoc button").forEach(b => b.setAttribute("aria-pressed", b._f === bSoc));
  $("#bRecoRow").hidden = !bSoc;
  $("#bSize").style.display = $("#bSizeLabel").style.display = bSoc ? "none" : "";
  $("#bPick").textContent = bFiles.length ? `${plural(bFiles.length, "photo")} · changer` : "Choisir des photos";
  const run = $("#bRun");
  $("#bNew").hidden = !(job && job.finished);
  { const dl = $("#driveLot"); if (dl) dl.hidden = !(job && job.finished && !bRunning); }
  if (bRunning && job){ run.disabled = true; run.textContent = `Traitement ${jobDone()}/${job.total}…`; return; }
  if (job && job.finished){ run.disabled = false; run.textContent = window.JSZip ? "Télécharger le ZIP" : "Enregistrer les photos"; return; }
  run.disabled = !bFiles.length;
  run.textContent = !bFiles.length ? "Choisis des photos" : `Traiter ${plural(bFiles.length, "photo")}`;
}
function buildBList(){
  const ul = $("#bList"); ul.innerHTML = "";
  const names = job ? job.names : bFiles.map(f => f.name);
  names.forEach(nm => {
    const li = document.createElement("li");
    li.innerHTML = `<canvas width="88" height="88"></canvas><span class="nm"></span><span class="st">En attente</span>`;
    li.querySelector(".nm").textContent = nm;
    ul.append(li);
  });
  if (job) job.status.forEach((_, i) => updateJobUI(i));
}

async function saveBatchCore(){
  if (!bResults.length) return;
  const msg = $("#bMsg");
  if (!downloads) return browserBatchSave();
  if (window.JSZip){
    msg.textContent = "Création du fichier ZIP…";
    let z;
    try {
      const zip = new JSZip(); bResults.forEach(r => zip.file(r.name, r.blob));
      z = await zip.generateAsync({type:"blob", compression:"STORE"});
    } catch (e) { return saveIndividually(); }
    try {
      await downloads.save({filename: zipName(), data: z});
      msg.textContent = "Photos exportées.";
    } catch (err) {
      const code = err && err.code;
      if (code === "declined") msg.textContent = "Export annulé.";
      else if (code === "rate_limited") msg.textContent = "Une demande d’enregistrement est déjà ouverte. Réessaie dans un instant.";
      else if (code === "too_large" || code === "rejected_extension" || code === "extension_not_enabled") { msg.textContent = "Le ZIP n’est pas accepté ici, les photos vont être proposées une par une."; await sleep(800); saveIndividually(); }
      else showBFallback();
    }
  } else saveIndividually();
}
async function saveIndividually(){
  const msg = $("#bMsg");
  let saved = 0;
  for (let i=0; i<bResults.length; i++){
    const r = bResults[i];
    msg.textContent = `Enregistrement ${i+1} sur ${bResults.length}…`;
    let tries = 0;
    while (true){
      try { await downloads.save({filename: r.name, data: r.blob}); saved++; break; }
      catch (err) {
        const code = err && err.code;
        if (code === "declined") break;
        if (code === "rate_limited" && tries++ < 3){ await sleep(1500); continue; }
        return showBFallback();
      }
    }
  }
  msg.textContent = `${plural(saved, "photo")} exportée${saved>1?"s":""}.`;
}
async function showBFallback(){
  const fb = $("#bFallback"); fb.innerHTML = ""; fb.style.display = "grid";
  $("#bMsg").textContent = "Appuie longuement sur chaque image (ou clic droit) pour l’enregistrer.";
  for (const r of bResults){
    const url = await new Promise(res => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.readAsDataURL(r.blob); });
    const img = document.createElement("img"); img.src = url; img.alt = r.name; fb.append(img);
  }
}
/* ---------- Background removal ---------- */
let cut = null, toolDrag = false, lastPt = null, bpNet = null, bpLoading = null, paintPending = false;
const bgOpt = {bg:"g2", color:"#F26B1D", text:false, word:"GRAVITY BASKETBALL", halo:false, edge:35, brush:34};
const cutActive = () => !!(cut && bgOpt.bg !== "none");

function loadScript(srcUrl){ return new Promise((res, rej) => { const s = document.createElement("script"); s.src = srcUrl; s.onload = res; s.onerror = () => rej(new Error("script")); document.head.append(s); }); }
async function loadNet(){
  if (bpNet) return bpNet;
  if (bpLoading) return bpLoading;
  bpLoading = (async () => {
    if (!window.tf) await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js");
    if (!window["body-pix"]) await loadScript("https://cdn.jsdelivr.net/npm/@tensorflow-models/body-pix@2.2.1/dist/body-pix.min.umd.js");
    try { const ok = await tf.setBackend("webgl"); if (!ok) await tf.setBackend("cpu"); } catch (e) { await tf.setBackend("cpu"); }
    await tf.ready();
    // Modèle BodyPix (MobileNetV1, Apache 2.0) servi par le site : vendor/bodypix/.
    bpNet = await window["body-pix"].load({architecture:"MobileNetV1", outputStride:16, multiplier:1.0, quantBytes:2, modelUrl:"vendor/bodypix/model.json"});
    return bpNet;
  })();
  try { return await bpLoading; } catch (e) { bpLoading = null; throw e; }
}

async function runCut(){
  const st = $("#cutStatus"), btn = $("#cutBtn");
  btn.disabled = true; st.textContent = "Chargement du modèle de détourage…";
  busy(true, "Détourage en cours…");
  try {
    const net = await loadNet();
    st.textContent = "Analyse de la photo…"; await sleep(30);
    const sc = scaledCanvas(src, 1024);
    const o = {internalResolution:"full", segmentationThreshold:0.6};
    const merged = await net.segmentPerson(sc, o);
    const multi = await net.segmentMultiPerson(sc, {...o, maxDetections:10, scoreThreshold:0.3, nmsRadius:20, minKeypointScore:0.3, refineSteps:10});
    const W = prev.w, H = prev.h, sw = merged.width, sh = merged.height;
    const up = m => { const out = new Uint8Array(W*H); for (let y=0;y<H;y++){ const yy = Math.min(sh-1, (y*sh/H)|0)*sw; for (let x=0;x<W;x++) out[y*W+x] = m[yy + Math.min(sw-1, (x*sw/W)|0)]; } return out; };
    const M = up(merged.data);
    const inst = [], areas = [];
    for (const sgm of multi){ const m = up(sgm.data); let a = 0; for (let i=0;i<m.length;i++) a += m[i]; if (a > W*H*0.0008){ inst.push(m); areas.push(a); } }
    const sel = new Set(); if (inst.length) sel.add(areas.indexOf(Math.max(...areas)));
    let any = 0; for (let i=0;i<M.length;i++) any += M[i];
    cut = {W, H, M, inst, sel, add:new Uint8Array(W*H), rem:new Uint8Array(W*H), base:null, A:null, alphaC:document.createElement("canvas"), ver:0, tool:null};
    cut.alphaC.width = W; cut.alphaC.height = H;
    computeBase(); updateA(); applyAlpha(); logStep("Arrière-plan enlevé", null);
    if (any < W*H*0.002) $("#cutInfo").textContent = "Aucune personne détectée. Utilise l’outil Garder pour peindre ce qui doit rester.";
    else $("#cutInfo").textContent = inst.length > 1
      ? `${inst.length} personnes détectées : seul le joueur principal est gardé. Outil Personnes pour en ajouter. Si le ballon a disparu, repeins-le avec Garder.`
      : "Joueur détouré. Si le ballon ou une main a disparu, repeins-les avec l’outil Garder.";
    st.textContent = "";
  } catch (e) {
    st.textContent = "Le détourage n’a pas pu démarrer sur cet appareil. Réessaie, ou utilise un navigateur à jour.";
  }
  busy(false); btn.disabled = false; refreshCutUI(); schedule();
}

function computeBase(){
  const {W, H, M, inst, sel} = cut, n = W*H;
  const R = new Uint8Array(n);
  if (!inst.length){ R.set(M); cut.base = refineEdges(R, W, H); return; }
  const S = new Uint8Array(n), U = new Uint8Array(n);
  inst.forEach((m, i) => { const t = sel.has(i) ? S : U; for (let j=0;j<n;j++) if (m[j]) t[j] = 1; });
  const Sd = blur(Float32Array.from(S), W, H, Math.max(2, Math.round(Math.max(W,H)/150)));
  for (let j=0;j<n;j++) R[j] = (M[j] && !(U[j] && Sd[j] < 0.05)) ? 1 : 0;
  const lab = new Int32Array(n), stack = new Int32Array(n), keep = [false]; let L = 0;
  for (let j=0;j<n;j++){
    if (!R[j] || lab[j]) continue;
    L++; let sp = 0, touch = false; stack[sp++] = j; lab[j] = L;
    while (sp){
      const q = stack[--sp]; if (S[q]) touch = true; const x = q % W;
      if (x > 0 && R[q-1] && !lab[q-1]){ lab[q-1] = L; stack[sp++] = q-1; }
      if (x < W-1 && R[q+1] && !lab[q+1]){ lab[q+1] = L; stack[sp++] = q+1; }
      if (q >= W && R[q-W] && !lab[q-W]){ lab[q-W] = L; stack[sp++] = q-W; }
      if (q < n-W && R[q+W] && !lab[q+W]){ lab[q+W] = L; stack[sp++] = q+W; }
    }
    keep[L] = touch;
  }
  for (let j=0;j<n;j++) if (R[j] && !keep[lab[j]]) R[j] = 0;
  cut.base = refineEdges(R, W, H);
}
// Guided filter: snaps the mask to the edges of the photo
function refineEdges(R, W, H){
  const n = W*H, I = new Float32Array(n), p = new Float32Array(n), tmp = new Float32Array(n);
  for (let j=0;j<n;j++){ I[j] = prev.L[j]/65535; p[j] = R[j]; }
  const r = Math.max(2, Math.round(Math.max(W,H)/300)), eps = 0.002;
  const mI = blur(I,W,H,r,null,tmp), mP = blur(p,W,H,r,null,tmp);
  const Ip = new Float32Array(n), II = new Float32Array(n);
  for (let j=0;j<n;j++){ Ip[j] = I[j]*p[j]; II[j] = I[j]*I[j]; }
  blur(Ip,W,H,r,Ip,tmp); blur(II,W,H,r,II,tmp);
  const a = new Float32Array(n), b = new Float32Array(n);
  for (let j=0;j<n;j++){ const v = II[j]-mI[j]*mI[j], cv = Ip[j]-mI[j]*mP[j]; a[j] = cv/(v+eps); b[j] = mP[j]-a[j]*mI[j]; }
  blur(a,W,H,r,a,tmp); blur(b,W,H,r,b,tmp);
  for (let j=0;j<n;j++) p[j] = Math.max(0, Math.min(1, a[j]*I[j]+b[j]));
  return p;
}
function updateA(){
  const e = bgOpt.edge/100;
  cut.A = e > 0.02 ? blur(cut.base, cut.W, cut.H, Math.max(1, Math.round(e*Math.max(cut.W,cut.H)/260))) : cut.base;
}
function applyAlpha(){
  const {W, H, A, add, rem} = cut, n = W*H, e = bgOpt.edge/100;
  const lo = 0.5 - 0.15 - e*0.3, hi = 0.5 + 0.15 + e*0.3;
  const id = new ImageData(W, H), d = id.data;
  for (let j=0, k=0; j<n; j++, k+=4){
    let a = ss(lo, hi, A[j]);
    if (add[j]) a = Math.max(a, add[j]/255);
    if (rem[j]) a *= 1 - rem[j]/255;
    d[k] = d[k+1] = d[k+2] = 255; d[k+3] = a*255;
  }
  cut.alphaC.getContext("2d").putImageData(id, 0, 0); cut.ver++;
}

/* tools: people picking & brush */
function setTool(t){
  if (!cut) return;
  cut.tool = cut.tool === t ? null : t;
  if (cut.tool){ if (comparing) $("#compare").click(); if (loupeOn) $("#loupeBtn").click(); }
  refreshCutUI();
}
function framePt(e){ const r = frame.getBoundingClientRect(); return {x:(e.clientX - r.left)/r.width*cut.W, y:(e.clientY - r.top)/r.height*cut.H, scale:cut.W/r.width, cx:e.clientX - r.left, cy:e.clientY - r.top}; }
function toolAt(e, first){
  const pt = framePt(e);
  if (cut.tool === "people"){
    if (!first) return;
    const x = Math.round(pt.x), y = Math.round(pt.y), W = cut.W, H = cut.H, rad = Math.round(Math.max(W,H)*0.02);
    let hit = -1;
    for (let i=0; i<cut.inst.length && hit<0; i++){
      const m = cut.inst[i];
      for (let dy=-rad; dy<=rad && hit<0; dy+=2) for (let dx=-rad; dx<=rad; dx+=2){
        const xx = x+dx, yy = y+dy; if (xx<0||yy<0||xx>=W||yy>=H) continue;
        if (m[yy*W+xx]){ hit = i; break; }
      }
    }
    if (hit < 0){ $("#toolHint").textContent = "Aucune personne détectée à cet endroit. Utilise Garder pour peindre un élément."; return; }
    if (cut.sel.has(hit)) cut.sel.delete(hit); else cut.sel.add(hit);
    busy(true, "Mise à jour…");
    setTimeout(() => { computeBase(); updateA(); applyAlpha(); busy(false); schedule(); $("#toolHint").textContent = `${cut.sel.size} personne${cut.sel.size>1?"s":""} gardée${cut.sel.size>1?"s":""}. Touche un joueur pour l’ajouter ou le retirer.`; }, 20);
    return;
  }
  const r = bgOpt.brush * pt.scale;
  const cur = $("#bcur"); cur.style.display = "block"; cur.style.width = cur.style.height = bgOpt.brush*2 + "px";
  cur.style.left = pt.cx + "px"; cur.style.top = pt.cy + "px";
  const from = first || !lastPt ? pt : lastPt, dist = Math.hypot(pt.x - from.x, pt.y - from.y), steps = Math.max(1, Math.ceil(dist/(r/3)));
  for (let s=1; s<=steps; s++) dab(from.x + (pt.x-from.x)*s/steps, from.y + (pt.y-from.y)*s/steps, r, cut.tool === "keep");
  lastPt = pt;
  if (!paintPending){ paintPending = true; requestAnimationFrame(() => { paintPending = false; applyAlpha(); schedule(); }); }
}
function dab(cx, cy, r, keep){
  const {W, H, add, rem} = cut;
  const x0 = Math.max(0, Math.floor(cx-r)), x1 = Math.min(W-1, Math.ceil(cx+r)), y0 = Math.max(0, Math.floor(cy-r)), y1 = Math.min(H-1, Math.ceil(cy+r));
  for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++){
    const dd = Math.hypot(x-cx, y-cy); if (dd > r) continue;
    const v = 255*(1 - ss(r*0.65, r, dd)), j = y*W+x;
    if (keep){ if (v > add[j]) add[j] = v; rem[j] = rem[j]*(1 - v/255); }
    else { if (v > rem[j]) rem[j] = v; add[j] = add[j]*(1 - v/255); }
  }
}
function toolEnd(){ lastPt = null; const c = $("#bcur"); if (c) c.style.display = "none"; }

/* ---------- Gravity Basketball backgrounds ---------- */
function rng(seed){ let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; }
function vignette(x, W, H, s){ const g = x.createRadialGradient(W/2, H/2, Math.min(W,H)*0.35, W/2, H/2, Math.hypot(W,H)*0.6); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${s})`); x.fillStyle = g; x.fillRect(0,0,W,H); }
function glowSpot(x, cx, cy, r, col){ const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(cx-r, cy-r, r*2, r*2); }
function drawBall(x, cx, cy, r, seam = "#2A1206"){
  x.save();
  const g = x.createRadialGradient(cx - r*0.35, cy - r*0.35, r*0.1, cx, cy, r);
  g.addColorStop(0, "#FFB066"); g.addColorStop(0.55, "#F26B1D"); g.addColorStop(1, "#9C3A08");
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI*2); x.fillStyle = g; x.fill();
  x.clip(); x.strokeStyle = seam; x.lineWidth = Math.max(1, r*0.07); x.lineCap = "round";
  x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy); x.stroke();
  x.beginPath(); x.arc(cx - r*1.25, cy, r*0.95, -Math.PI/2.4, Math.PI/2.4); x.stroke();
  x.beginPath(); x.arc(cx + r*1.25, cy, r*0.95, Math.PI - Math.PI/2.4, Math.PI + Math.PI/2.4); x.stroke();
  x.restore();
}
// perspective helper for courts: court coordinates in metres (cx sideways, z depth)
function persp(W, H, y0){ const S = W*0.26, K = (H - y0)*2; return (cx, z) => [W/2 + cx*S/z, y0 + K/z]; }
function polyline(x, pts){ x.beginPath(); pts.forEach(([a,b], i) => i ? x.lineTo(a,b) : x.moveTo(a,b)); x.stroke(); }
function arcPts(P, cx0, z0, rad, a0, a1, n = 48){ const o = []; for (let i=0;i<=n;i++){ const a = a0 + (a1-a0)*i/n; const zz = z0 - Math.cos(a)*rad; if (zz > 0.6) o.push(P(cx0 + Math.sin(a)*rad, zz)); } return o; }

function bgParquet(x, W, H){
  const u = Math.min(W,H)/1000, hz = H*0.56;
  let g = x.createLinearGradient(0,0,0,hz); g.addColorStop(0,"#0D0907"); g.addColorStop(1,"#2B1A10"); x.fillStyle = g; x.fillRect(0,0,W,hz);
  const R = rng(7);
  for (let i=0;i<Math.round(260*W*H/1e6)+60;i++){ const px = R()*W, py = hz*(0.35+R()*0.62); x.fillStyle = `rgba(255,${180+R()*60|0},120,${0.05+R()*0.18})`; x.beginPath(); x.arc(px, py, (1+R()*3)*u*2, 0, 6.3); x.fill(); }
  g = x.createLinearGradient(0,hz,0,H); g.addColorStop(0,"#8E5426"); g.addColorStop(0.5,"#BF7A3C"); g.addColorStop(1,"#D99852"); x.fillStyle = g; x.fillRect(0,hz,W,H-hz);
  const P = persp(W, H, hz - H*0.02);
  x.lineWidth = Math.max(1, 1.6*u); x.strokeStyle = "rgba(70,32,8,.28)";
  for (let cx=-30; cx<=30; cx+=0.42){ const a = P(cx, 30), b = P(cx, 1.1); x.beginPath(); x.moveTo(a[0], Math.max(hz,a[1])); x.lineTo(b[0], b[1]); x.stroke(); }
  x.strokeStyle = "rgba(255,230,190,.10)";
  for (let z=1.2; z<30; z*=1.12){ const a = P(-40, z), b = P(40, z); if (a[1] < hz) continue; x.beginPath(); x.moveTo(0, a[1]); x.lineTo(W, b[1]); x.stroke(); }
  x.strokeStyle = "rgba(255,255,255,.78)"; x.lineWidth = Math.max(2, 6*u);
  polyline(x, arcPts(P, 0, 6.2, 1.8, 0, Math.PI*2, 80));
  polyline(x, [P(-40, 6.2), P(40, 6.2)]);
  g = x.createRadialGradient(W/2, hz + (H-hz)*0.35, 0, W/2, hz + (H-hz)*0.35, W*0.55); g.addColorStop(0,"rgba(255,236,200,.38)"); g.addColorStop(1,"rgba(255,236,200,0)"); x.fillStyle = g; x.fillRect(0,hz,W,H-hz);
  g = x.createLinearGradient(0, hz, 0, hz + H*0.05); g.addColorStop(0,"rgba(0,0,0,.45)"); g.addColorStop(1,"rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0,hz,W,H*0.05);
  x.save(); x.globalCompositeOperation = "lighter";
  const cone = x.createRadialGradient(W/2, -H*0.15, 0, W/2, -H*0.15, H*1.05); cone.addColorStop(0,"rgba(255,214,160,.35)"); cone.addColorStop(1,"rgba(255,214,160,0)"); x.fillStyle = cone; x.fillRect(0,0,W,H);
  x.restore(); vignette(x, W, H, .55);
}
function bgOrbit(x, W, H){
  const u = Math.min(W,H)/1000, m = Math.min(W,H);
  let g = x.createRadialGradient(W/2, H*0.45, 0, W/2, H*0.45, Math.hypot(W,H)*0.62);
  g.addColorStop(0,"#2E1563"); g.addColorStop(0.45,"#120B33"); g.addColorStop(1,"#04030C"); x.fillStyle = g; x.fillRect(0,0,W,H);
  glowSpot(x, W*0.2, H*0.25, m*0.55, "rgba(140,60,255,.22)");
  glowSpot(x, W*0.85, H*0.7, m*0.6, "rgba(255,110,30,.16)");
  const R = rng(42);
  for (let i=0;i<Math.round(500*W*H/1e6)+150;i++){ x.fillStyle = `rgba(255,255,255,${0.2+R()*0.8})`; x.beginPath(); x.arc(R()*W, R()*H, (0.4+R()*R()*1.8)*u*1.6, 0, 6.3); x.fill(); }
  x.save(); x.translate(W/2, H*0.52); x.rotate(-0.32);
  [0.36, 0.5, 0.66].forEach((k, i) => {
    const rx = Math.max(W,H)*k, ry = rx*0.3;
    x.save(); x.shadowColor = "rgba(255,122,26,.9)"; x.shadowBlur = 16*u; x.strokeStyle = `rgba(255,150,60,${0.65 - i*0.12})`; x.lineWidth = Math.max(1, (3 - i*0.6)*u);
    x.beginPath(); x.ellipse(0, 0, rx, ry, 0, 0, Math.PI*2); x.stroke(); x.restore();
    const ang = [0.6, 3.6, 5.2][i]; drawBall(x, Math.cos(ang)*rx, Math.sin(ang)*ry, (26 - i*5)*u*1.4);
  });
  x.restore();
  const br = m*0.42; glowSpot(x, W*0.92, H*1.04, br*1.5, "rgba(255,120,30,.35)"); drawBall(x, W*0.92, H*1.04, br);
  vignette(x, W, H, .5);
}
function bgNeon(x, W, H){
  const u = Math.min(W,H)/1000, hz = H*0.5;
  let g = x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#05040A"); g.addColorStop(0.5,"#0D0820"); g.addColorStop(1,"#050409"); x.fillStyle = g; x.fillRect(0,0,W,H);
  g = x.createLinearGradient(0, hz - H*0.22, 0, hz + H*0.02); g.addColorStop(0,"rgba(255,43,214,0)"); g.addColorStop(1,"rgba(255,43,214,.35)"); x.fillStyle = g; x.fillRect(0, hz - H*0.22, W, H*0.24);
  x.strokeStyle = "rgba(33,230,255,.12)"; x.lineWidth = Math.max(1, u);
  for (let i=1;i<14;i++){ const yy = hz - (hz*0.9)*Math.pow(i/14, 1.6); x.beginPath(); x.moveTo(0,yy); x.lineTo(W,yy); x.stroke(); }
  const P = persp(W, H, hz);
  const neon = (pts, col, w) => { x.save(); x.lineJoin = x.lineCap = "round"; x.shadowColor = col; x.shadowBlur = 24*u; x.strokeStyle = col; x.lineWidth = w*u; polyline(x, pts); x.shadowBlur = 0; x.strokeStyle = "rgba(255,255,255,.9)"; x.lineWidth = Math.max(1, w*0.32*u); polyline(x, pts); x.restore(); };
  const zb = 15;
  neon([P(-7.5, zb), P(7.5, zb)], "#21E6FF", 5);
  neon([P(-7.5, zb), P(-7.5, 0.9)], "#21E6FF", 5); neon([P(7.5, zb), P(7.5, 0.9)], "#21E6FF", 5);
  neon([P(-2.45, zb), P(-2.45, zb-5.8), P(2.45, zb-5.8), P(2.45, zb)], "#FF2BD6", 6);
  neon(arcPts(P, 0, zb-5.8, 1.8, -Math.PI/2, Math.PI/2, 40), "#FF2BD6", 6);
  neon([P(-6.6, zb), ...arcPts(P, 0, zb-1.6, 6.75, -1.35, 1.35, 60), P(6.6, zb)], "#21E6FF", 6);
  glowSpot(x, W/2, hz, W*0.5, "rgba(255,43,214,.18)");
  vignette(x, W, H, .6);
}
function bgPlayground(x, W, H){
  const u = Math.min(W,H)/1000, hz = H*0.64, m = Math.min(W,H);
  let g = x.createLinearGradient(0,0,0,hz); g.addColorStop(0,"#241650"); g.addColorStop(0.55,"#C8476B"); g.addColorStop(1,"#FFB062"); x.fillStyle = g; x.fillRect(0,0,W,hz);
  glowSpot(x, W*0.3, hz - m*0.06, m*0.5, "rgba(255,200,120,.45)");
  g = x.createRadialGradient(W*0.3, hz - m*0.06, 0, W*0.3, hz - m*0.06, m*0.12); g.addColorStop(0,"#FFF1C4"); g.addColorStop(1,"#FFA552"); x.fillStyle = g; x.beginPath(); x.arc(W*0.3, hz - m*0.06, m*0.12, 0, 6.3); x.fill();
  const R = rng(11); x.fillStyle = "#2A1533"; let px = 0;
  while (px < W){ const bw = (30 + R()*90)*u*1.4, bh = (40 + R()*180)*u*1.3; x.fillRect(px, hz - bh, bw, bh + 2); px += bw + R()*8*u; }
  g = x.createLinearGradient(0,hz,0,H); g.addColorStop(0,"#3D3242"); g.addColorStop(1,"#1E1922"); x.fillStyle = g; x.fillRect(0,hz,W,H-hz);
  for (let i=0;i<Math.round(2500*W*H/1e6);i++){ x.fillStyle = `rgba(255,255,255,${R()*0.06})`; x.fillRect(R()*W, hz + R()*(H-hz), 2*u+1, 2*u+1); }
  const P = persp(W, H, hz);
  x.strokeStyle = "rgba(255,240,220,.55)"; x.lineWidth = Math.max(2, 5*u);
  polyline(x, [P(-2.45, 14), P(-2.45, 8.2), P(2.45, 8.2), P(2.45, 14)]);
  polyline(x, arcPts(P, 0, 8.2, 1.8, -Math.PI/2, Math.PI/2, 40));
  polyline(x, [P(-9, 14), P(9, 14)]);
  const ink = "#160C1C", bx = W*0.84, base = hz + (H-hz)*0.25;
  x.fillStyle = ink; x.strokeStyle = ink;
  x.fillRect(bx, H*0.24, 12*u*1.5, base - H*0.24);
  x.lineWidth = 9*u*1.4; x.beginPath(); x.moveTo(bx + 4*u, H*0.27); x.lineTo(bx - W*0.07, H*0.27); x.stroke();
  x.fillRect(bx - W*0.07 - 4*u, H*0.17, 8*u*1.5, H*0.15);
  x.lineWidth = 4*u*1.4; x.beginPath(); x.ellipse(bx - W*0.11, H*0.3, W*0.035, H*0.008, 0, 0, Math.PI*2); x.stroke();
  x.lineWidth = Math.max(1, 1.6*u);
  for (let i=0;i<=6;i++){ const t = i/6, sx = bx - W*0.145 + t*W*0.07; x.beginPath(); x.moveTo(sx, H*0.3); x.lineTo(bx - W*0.13 + t*W*0.04, H*0.37); x.stroke(); }
  vignette(x, W, H, .45);
}
function bgStudio(x, W, H){
  const u = Math.min(W,H)/1000, m = Math.min(W,H);
  const g = x.createRadialGradient(W/2, H*0.42, 0, W/2, H*0.42, Math.hypot(W,H)*0.6);
  g.addColorStop(0,"#FF9440"); g.addColorStop(0.5,"#E2560F"); g.addColorStop(1,"#5E1A00"); x.fillStyle = g; x.fillRect(0,0,W,H);
  const r = m*0.66, cx = W/2, cy = H*0.45;
  x.save(); x.strokeStyle = "rgba(70,18,0,.28)"; x.lineWidth = 12*u; x.lineCap = "round";
  x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.stroke();
  x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.clip();
  x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy); x.stroke();
  x.beginPath(); x.arc(cx - r*1.25, cy, r*0.95, -1.3, 1.3); x.stroke();
  x.beginPath(); x.arc(cx + r*1.25, cy, r*0.95, Math.PI - 1.3, Math.PI + 1.3); x.stroke();
  x.restore();
  const sh = x.createRadialGradient(W/2, H*0.96, 0, W/2, H*0.96, W*0.4); sh.addColorStop(0,"rgba(0,0,0,.4)"); sh.addColorStop(1,"rgba(0,0,0,0)");
  x.save(); x.translate(0, H*0.96); x.scale(1, 0.25); x.translate(0, -H*0.96); x.fillStyle = sh; x.fillRect(0, H*0.5, W, H); x.restore();
  const R = rng(5); for (let i=0;i<Math.round(3000*W*H/1e6);i++){ x.fillStyle = `rgba(${R()<.5?0:255},${R()<.5?0:255},0,${R()*0.03})`; x.fillRect(R()*W, R()*H, 2*u+1, 2*u+1); }
  vignette(x, W, H, .35);
}
function bgStreet(x, W, H){
  const u = Math.min(W,H)/1000, gy = H*0.84;
  x.fillStyle = "#77736E"; x.fillRect(0,0,W,H);
  const R = rng(23);
  for (let i=0;i<40;i++){ glowSpot(x, R()*W, R()*gy, (80+R()*260)*u*1.5, R()<.5 ? "rgba(40,36,32,.18)" : "rgba(200,196,190,.14)"); }
  for (let i=0;i<Math.round(9000*W*H/1e6);i++){ const v = R()<.5 ? 30 : 220; x.fillStyle = `rgba(${v},${v},${v},${R()*0.12})`; x.fillRect(R()*W, R()*gy, (1+R()*2)*u+1, (1+R()*2)*u+1); }
  x.strokeStyle = "rgba(30,28,26,.45)"; x.lineWidth = Math.max(1, 3*u);
  for (let i=1;i<3;i++){ x.beginPath(); x.moveTo(W*i/3, 0); x.lineTo(W*i/3, gy); x.stroke(); }
  x.beginPath(); x.moveTo(0, gy*0.45); x.lineTo(W, gy*0.45); x.stroke();
  x.save(); x.translate(W*0.5, H*0.48); x.rotate(-0.42);
  const L = Math.hypot(W,H);
  [["#FF6A13", 0.2, 0], ["#F6F1EA", 0.05, 0.16], ["#121212", 0.09, 0.25]].forEach(([c, w, off]) => {
    x.save(); x.shadowColor = c; x.shadowBlur = 18*u; x.fillStyle = c; x.globalAlpha = 0.9;
    x.fillRect(-L, (off - 0.18)*L*0.5, L*2, w*L*0.5); x.restore();
  });
  x.restore();
  x.fillStyle = "rgba(255,106,19,.85)";
  for (let i=0;i<18;i++){ const dx = R()*W, dy = H*0.2 + R()*H*0.5, len = (30 + R()*120)*u*1.5; x.fillRect(dx, dy, 3*u+1, len); x.beginPath(); x.arc(dx + 1.5*u, dy + len, 3*u+1, 0, 6.3); x.fill(); }
  const g = x.createLinearGradient(0, gy, 0, H); g.addColorStop(0,"#2C2A28"); g.addColorStop(1,"#171615"); x.fillStyle = g; x.fillRect(0, gy, W, H - gy);
  x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(0, gy, W, 6*u+1);
  vignette(x, W, H, .5);
}
function bgJersey(x, W, H){
  const u = Math.min(W,H)/1000, L = Math.hypot(W,H);
  x.fillStyle = "#101010"; x.fillRect(0,0,W,H);
  x.save(); x.translate(W/2, H/2); x.rotate(-0.36);
  const pat = [["#101010",0.16],["#F26B1D",0.11],["#F4EFE6",0.025],["#F26B1D",0.035],["#101010",0.12],["#F4EFE6",0.02]];
  let y = -L;
  while (y < L){ for (const [c, w] of pat){ x.fillStyle = c; x.fillRect(-L, y, L*2, w*L + 1); y += w*L; } }
  x.restore();
  x.fillStyle = "rgba(255,255,255,.09)"; const st = 22*u + 6;
  for (let yy=0; yy<H; yy+=st) for (let xx=0; xx<W; xx+=st){ const t = (xx/W + (H-yy)/H)/2, r = st*0.42*t; if (r < 0.5) continue; x.beginPath(); x.arc(xx + (yy/st%2 ? st/2 : 0), yy, r, 0, 6.3); x.fill(); }
  x.fillStyle = "rgba(0,0,0,.15)"; const ms = 4*u + 2;
  for (let yy=0; yy<H; yy+=ms*2) for (let xx=(yy/(ms*2))%2*ms; xx<W; xx+=ms*2) x.fillRect(xx, yy, ms*0.5, ms*0.5);
  vignette(x, W, H, .55);
}
function bgArena(x, W, H){
  const u = Math.min(W,H)/1000, fy = H*0.72;
  let g = x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0B1838"); g.addColorStop(0.7,"#06102A"); g.addColorStop(1,"#03081A"); x.fillStyle = g; x.fillRect(0,0,W,H);
  x.save(); x.globalCompositeOperation = "lighter";
  [[0.22, "rgba(140,180,255,.10)"], [0.5, "rgba(255,220,170,.12)"], [0.78, "rgba(140,180,255,.10)"]].forEach(([k, c]) => {
    const gg = x.createLinearGradient(0,0,0,fy); gg.addColorStop(0, c); gg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = gg;
    x.beginPath(); x.moveTo(W*k - W*0.03, 0); x.lineTo(W*k + W*0.03, 0); x.lineTo(W*k + W*0.16, fy); x.lineTo(W*k - W*0.16, fy); x.closePath(); x.fill();
  });
  const R = rng(99);
  for (let i=0;i<70;i++){ const bx = R()*W, by = R()*fy*0.95, br = (12 + R()*80)*u*1.4, warm = R() < 0.55;
    const col = warm ? `rgba(255,200,120,${0.1+R()*0.3})` : `rgba(110,165,255,${0.1+R()*0.3})`;
    const gg = x.createRadialGradient(bx, by, br*0.2, bx, by, br); gg.addColorStop(0, col); gg.addColorStop(0.8, col.replace(/[\d.]+\)$/, "0.05)")); gg.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = gg; x.beginPath(); x.arc(bx, by, br, 0, 6.3); x.fill();
    if (R() < 0.5){ const rg = x.createLinearGradient(0, fy, 0, fy + (H-fy)*0.9); rg.addColorStop(0, col.replace(/[\d.]+\)$/, "0.12)")); rg.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = rg; x.fillRect(bx - br*0.25, fy, br*0.5, (H-fy)*0.9); }
  }
  x.restore();
  g = x.createLinearGradient(0, fy, 0, H); g.addColorStop(0, "rgba(120,160,255,.10)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, fy, W, H-fy);
  x.fillStyle = "rgba(180,200,255,.18)"; x.fillRect(0, fy, W, Math.max(1, 2*u));
  vignette(x, W, H, .55);
}
const GBG = [
  {id:"g2", name:"Gravity Orbit", draw:bgOrbit, text:"#FFFFFF", halo:"#FF7A1A"},
  {id:"g1", name:"Parquet", draw:bgParquet, text:"#FFFFFF", halo:"#FF9A3C"},
  {id:"g3", name:"Néon Court", draw:bgNeon, text:"#FFFFFF", halo:"#21E6FF"},
  {id:"g8", name:"Arena Lights", draw:bgArena, text:"#FFFFFF", halo:"#8FB8FF"},
  {id:"g4", name:"Playground", draw:bgPlayground, text:"#FFF4E6", halo:"#FFC070"},
  {id:"g5", name:"Studio Orange", draw:bgStudio, text:"#FFFFFF", halo:"#FFFFFF"},
  {id:"g6", name:"Street Wall", draw:bgStreet, text:"#FFFFFF", halo:"#FF6A13"},
  {id:"g7", name:"Jersey", draw:bgJersey, text:"#FFFFFF", halo:"#FFD23F"},
];
const bgTheme = id => GBG.find(g => g.id === id) || {text:"#FFFFFF", halo:"#F26B1D"};

function drawWordmark(x, W, H, theme){
  const words = (bgOpt.word || "").trim().toUpperCase(); if (!words) return;
  const parts = words.split(/\s+/), a = parts[0], b = parts.slice(1).join(" ");
  const fam = 'Anton, Impact, "Arial Narrow Bold", "Arial Black", sans-serif';
  x.save(); x.textAlign = "center"; x.textBaseline = "alphabetic";
  let fs = Math.min(W*0.3, H*0.32); x.font = `${fs}px ${fam}`;
  const mw = x.measureText(a).width; if (mw > W*0.94){ fs *= W*0.94/mw; x.font = `${fs}px ${fam}`; }
  const y = H*0.42;
  x.fillStyle = theme.text; x.globalAlpha = 0.92; x.fillText(a, W/2, y);
  if (b){
    let fs2 = fs*0.3; x.font = `${fs2}px ${fam}`;
    if ("letterSpacing" in x) x.letterSpacing = `${fs2*0.35}px`;
    const w2 = x.measureText(b).width; if (w2 > W*0.9){ fs2 *= W*0.9/w2; x.font = `${fs2}px ${fam}`; if ("letterSpacing" in x) x.letterSpacing = `${fs2*0.35}px`; }
    x.globalAlpha = 0.85; x.fillText(b, W/2, y + fs2*1.35);
  }
  x.restore();
}
function hexRgb(h){ const v = parseInt(h.slice(1), 16); return [v>>16 & 255, v>>8 & 255, v & 255]; }
function drawHalo(x, alpha, W, H, color){
  const k = Math.max(3, Math.round(Math.max(W,H)/160)), sw = Math.ceil(W/k), sh = Math.ceil(H/k);
  const t = document.createElement("canvas"); t.width = sw; t.height = sh; const tx = t.getContext("2d");
  tx.drawImage(alpha, 0, 0, sw, sh);
  const id = tx.getImageData(0, 0, sw, sh), d = id.data, a = new Float32Array(sw*sh);
  for (let i=0;i<a.length;i++) a[i] = d[i*4+3]/255;
  const b = blur(a, sw, sh, 3), [r, g, bl] = hexRgb(color);
  for (let i=0;i<a.length;i++){ d[i*4] = r; d[i*4+1] = g; d[i*4+2] = bl; d[i*4+3] = Math.min(255, b[i]*2.4*255); }
  tx.putImageData(id, 0, 0);
  x.save(); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high"; x.drawImage(t, 0, 0, W, H); x.restore();
}
function drawBgLayer(W, H, proc){
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  const id = bgOpt.bg;
  if (id === "blur"){
    const s = Math.max(4, Math.round(Math.max(W,H)/40));
    const t1 = document.createElement("canvas"); t1.width = Math.ceil(W/s); t1.height = Math.ceil(H/s);
    const t1x = t1.getContext("2d"); t1x.imageSmoothingQuality = "high"; t1x.drawImage(proc, 0, 0, t1.width, t1.height);
    const t2 = document.createElement("canvas"); t2.width = Math.ceil(W/4); t2.height = Math.ceil(H/4);
    const t2x = t2.getContext("2d"); t2x.imageSmoothingQuality = "high"; t2x.drawImage(t1, 0, 0, t2.width, t2.height);
    x.imageSmoothingQuality = "high"; x.drawImage(t2, 0, 0, W, H);
  } else if (id === "color"){ x.fillStyle = bgOpt.color; x.fillRect(0, 0, W, H); }
  else if (id !== "transparent"){ const g = GBG.find(q => q.id === id); if (g) g.draw(x, W, H); }
  if (bgOpt.text && id !== "transparent") drawWordmark(x, W, H, id === "color" ? {text: lum(bgOpt.color) > 0.6 ? "#111111" : "#FFFFFF"} : bgTheme(id));
  return c;
}
const lum = h => { const [r,g,b] = hexRgb(h); return (0.2126*r + 0.7152*g + 0.0722*b)/255; };
function composeCut(proc, alpha, bgLayer, haloLayer){
  const W = proc.width, H = proc.height;
  const out = document.createElement("canvas"); out.width = W; out.height = H; const x = out.getContext("2d");
  x.drawImage(bgLayer || drawBgLayer(W, H, proc), 0, 0);
  if (bgOpt.halo && bgOpt.bg !== "transparent"){
    if (haloLayer) x.drawImage(haloLayer, 0, 0);
    else drawHalo(x, alpha, W, H, bgOpt.bg === "color" ? (lum(bgOpt.color) > 0.6 ? "#111111" : "#FFFFFF") : bgTheme(bgOpt.bg).halo);
  }
  const s = document.createElement("canvas"); s.width = W; s.height = H; const sx = s.getContext("2d");
  sx.drawImage(proc, 0, 0); sx.globalCompositeOperation = "destination-in"; sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = "high"; sx.drawImage(alpha, 0, 0, W, H);
  x.drawImage(s, 0, 0);
  return out;
}
/* preview compositing with caches */
const procC = document.createElement("canvas");
let bgCache = {key:"", c:null}, haloCache = {key:"", c:null};
function paintView(){
  if (!cutActive()){ view.classList.remove("checker"); vctx.putImageData(outData, 0, 0); return; }
  const W = prev.w, H = prev.h;
  if (procC.width !== W || procC.height !== H){ procC.width = W; procC.height = H; }
  procC.getContext("2d").putImageData(outData, 0, 0);
  let bgL = null;
  if (bgOpt.bg !== "blur"){
    const key = [bgOpt.bg, bgOpt.color, bgOpt.text, bgOpt.word, W, H, fontsReady].join("|");
    if (bgCache.key !== key) bgCache = {key, c: drawBgLayer(W, H, procC)};
    bgL = bgCache.c;
  }
  let haloL = null;
  if (bgOpt.halo && bgOpt.bg !== "transparent"){
    const hc = bgOpt.bg === "color" ? (lum(bgOpt.color) > 0.6 ? "#111111" : "#FFFFFF") : bgTheme(bgOpt.bg).halo;
    const key = [cut.ver, hc, W, H].join("|");
    if (haloCache.key !== key){ const c = document.createElement("canvas"); c.width = W; c.height = H; drawHalo(c.getContext("2d"), cut.alphaC, W, H, hc); haloCache = {key, c}; }
    haloL = haloCache.c;
  }
  const out = composeCut(procC, cut.alphaC, bgL, haloL);
  view.classList.toggle("checker", bgOpt.bg === "transparent");
  vctx.clearRect(0, 0, W, H); vctx.drawImage(out, 0, 0);
}
let fontsReady = 0;
if (document.fonts && document.fonts.load) document.fonts.load('80px "Anton"').then(() => { fontsReady = 1; buildBgTiles(); if (cut) schedule(); }).catch(() => {});

/* ---------- Fond UI ---------- */
function buildBgTiles(){
  const host = $("#bgs"); if (!host) return; host.innerHTML = "";
  const items = [{id:"none", name:"Fond d’origine"}, {id:"transparent", name:"Transparent"}, {id:"blur", name:"Flou"}, {id:"color", name:"Couleur"}, ...GBG];
  for (const it of items){
    const b = document.createElement("button"); b.className = "bgt"; b.dataset.id = it.id;
    const c = document.createElement("canvas"); c.width = 150; c.height = 150; const x = c.getContext("2d");
    if (it.draw){ it.draw(x, 150, 150); }
    else if (it.id === "transparent"){ for (let i=0;i<10;i++) for (let j=0;j<10;j++){ x.fillStyle = (i+j)%2 ? "#CFCFCF" : "#FFFFFF"; x.fillRect(i*15, j*15, 15, 15); } }
    else if (it.id === "color"){ x.fillStyle = bgOpt.color; x.fillRect(0, 0, 150, 150); }
    else if (src){ const t = scaledCanvas(src, 150); const s = Math.max(150/t.width, 150/t.height); if (it.id === "blur"){ const sm = document.createElement("canvas"); sm.width = 10; sm.height = 10; sm.getContext("2d").drawImage(t, 0, 0, 10, 10); x.imageSmoothingQuality = "high"; x.drawImage(sm, 0, 0, 150, 150); } else x.drawImage(t, (150 - t.width*s)/2, (150 - t.height*s)/2, t.width*s, t.height*s); }
    else { x.fillStyle = "#888"; x.fillRect(0, 0, 150, 150); }
    const sp = document.createElement("span"); sp.textContent = it.name;
    b.append(c, sp); b.onclick = () => { if (bgOpt.bg !== it.id) logStep("Fond : " + it.name, null); bgOpt.bg = it.id; refreshCutUI(); schedule(); };
    host.append(b);
  }
  refreshCutUI();
}
function refreshCutUI(){
  const has = !!cut;
  $("#cutStart").hidden = has; $("#cutPanel").hidden = !has;
  $$("#bgs .bgt").forEach(b => b.setAttribute("aria-pressed", b.dataset.id === bgOpt.bg));
  $("#colorRow").hidden = bgOpt.bg !== "color";
  $$("#toolSeg button").forEach(b => b.setAttribute("aria-pressed", !!(cut && cut.tool === b.dataset.tool)));
  $("#brushRow").hidden = !(cut && (cut.tool === "keep" || cut.tool === "erase"));
  const hints = {people:"Touche un joueur pour l’ajouter ou le retirer. Par défaut, seul le joueur principal est gardé.", keep:"Peins sur ce qui doit rester visible : le ballon, une main, un maillot.", erase:"Peins sur ce qui doit disparaître."};
  $("#toolHint").textContent = cut && cut.tool ? hints[cut.tool] : "Choisis un outil puis touche la photo.";
  frame.classList.toggle("tooling", !!(cut && cut.tool));
  $("#txtV").disabled = !bgOpt.text;
}
$("#cutBtn").onclick = () => { if (src) runCut(); };
$$("#toolSeg button").forEach(b => b.onclick = () => setTool(b.dataset.tool));
$("#brushS").addEventListener("input", () => { bgOpt.brush = +$("#brushS").value; });
$("#edgeS").addEventListener("input", () => { bgOpt.edge = +$("#edgeS").value; $("#edgeO").textContent = bgOpt.edge; });
$("#edgeS").addEventListener("change", () => { if (!cut) return; updateA(); applyAlpha(); schedule(); });
$("#bgColor").addEventListener("input", () => { bgOpt.color = $("#bgColor").value; const t = $('#bgs .bgt[data-id="color"] canvas'); if (t){ const x = t.getContext("2d"); x.fillStyle = bgOpt.color; x.fillRect(0, 0, 150, 150); } schedule(); });
$("#txtT").addEventListener("change", () => { bgOpt.text = $("#txtT").checked; refreshCutUI(); schedule(); });
$("#txtV").addEventListener("input", () => { bgOpt.word = $("#txtV").value; schedule(); });
$("#haloT").addEventListener("change", () => { bgOpt.halo = $("#haloT").checked; schedule(); });
$("#resetBrush").onclick = () => { if (!cut) return; cut.add.fill(0); cut.rem.fill(0); applyAlpha(); schedule(); };
$("#cutOff").onclick = () => { cut = null; refreshCutUI(); schedule(); logStep("Détourage supprimé", null); };
$$(".tab").forEach(t => t.addEventListener("click", () => { if (t.dataset.tab !== "fond" && cut && cut.tool){ cut.tool = null; refreshCutUI(); } }));
buildBgTiles();

/* ---------- Studio IA ---------- */
let sampleFn = null, sampleImg = false;
async function initAI(){
  try {
    if (!window.artcraftRuntime || !window.artcraftRuntime.use) throw 0;
    sampleFn = await window.artcraftRuntime.use("sample");
    if (sampleFn){ const lim = await sampleFn.limits().catch(() => null); sampleImg = !!(lim && lim.images); }
  } catch (e) { sampleFn = null; }
  $("#aiBlock").hidden = !sampleFn; $("#capBlock").hidden = !sampleFn; $("#aiOff").hidden = !!sampleFn;
  $("#aiBgBox").hidden = !sampleFn; $("#apAIRow").hidden = !sampleFn;
}
initAI();
$("#aiLogin").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = $("#aiLoginMsg"), pw = $("#aiPass").value;
  if (!pw) return;
  msg.textContent = "Vérification…";
  try {
    await window.artcraftRuntime.login(pw);
    msg.textContent = "";
    await initAI();
  } catch (err) {
    msg.textContent = {bad_password:"Mot de passe incorrect.", no_key:"L’IA n’est pas encore branchée : ANTHROPIC_API_KEY manque sur Netlify (site art-craft-gravity)."}[err && err.code] || "Serveur injoignable, réessaie.";
  }
});
const AI_ERR = c => ({not_granted:"Mot de passe Art craft refusé : reconnecte-toi dans l’onglet Studio IA.", server:"Le serveur d’Art craft ne répond pas, réessaie dans un instant.", rate_limited:"Trop de demandes en même temps, réessaie dans un moment.", refused:"Claude n’a pas pu traiter cette demande.", invalid_json:"Réponse illisible, réessaie avec une demande plus simple.", cancelled:"Demande annulée."}[c] || "La demande n’a pas abouti. Réessaie dans un instant.");
function previewBlob(){
  return new Promise(res => {
    if (!prev) return res(null);
    const c = scaledCanvas(view, 768); c.toBlob(b => res(b), "image/jpeg", 0.85);
  });
}
function sliderSpec(){ return sliderDefs().map(([k, label, mn, mx]) => `${k} (${label}) : ${mn} à ${mx}`).join("\n"); }
function applyAiSettings(obj){
  if (!obj || typeof obj !== "object") return 0;
  let n = 0; const next = {...params};
  for (const [k, v] of Object.entries(obj)) if (k in DEF && typeof v === "number" && isFinite(v)){ next[k] = v; n++; }
  if (!n) return 0;
  stepLabel = "Retouche IA"; params = clampP(next); activeLook = null; markLooks(); syncUI(); schedule(); commit();
  return n;
}
function aiShow(html){ const o = $("#aiOut"); o.hidden = false; o.innerHTML = ""; o.append(...html); }
const el = (tag, txt, cls) => { const e = document.createElement(tag); if (txt != null) e.textContent = txt; if (cls) e.className = cls; return e; };
async function aiCall(kind){
  if (!sampleFn || !prev) return;
  const req = $("#aiPrompt").value.trim();
  if (kind === "edit" && !req){ $("#aiPrompt").focus(); return; }
  const b1 = $("#aiEdit"), b2 = $("#aiAnalyze"); b1.disabled = b2.disabled = true;
  aiShow([el("p", "Claude regarde ta photo…", "muted")]);
  const cur = {}; for (const k in DEF) cur[k] = params[k];
  const task = kind === "edit"
    ? `Le photographe demande : « ${req} ». Choisis les réglages qui réalisent cette demande sur cette photo précise.`
    : "Analyse cette photo comme un retoucheur professionnel de photo de sport et propose les réglages qui la rendent la plus professionnelle possible (exposition, couleurs, netteté, bruit).";
  const prompt = `Tu es un retoucheur photo professionnel intégré à l’outil Art Craft Pictures.
${task}
L’image jointe est l’aperçu actuel, avec les réglages actuels déjà appliqués.
Réglages actuels (JSON) : ${JSON.stringify(cur)}
Réglages disponibles et plages :
${sliderSpec()}
Réponds uniquement avec un objet JSON de la forme :
{"reglages": {<seulement les réglages à modifier, valeurs absolues dans les plages>}, "explication": "<1 à 2 phrases en français, tutoiement>", "diagnostic": ["<3 constats courts en français sur la photo>"]}`;
  try {
    const img = sampleImg ? await previewBlob() : null;
    const r = await sampleFn.json(prompt, img ? {images:[img]} : {});
    const n = applyAiSettings(r && r.reglages);
    const parts = [];
    if (kind === "analyze" && r && Array.isArray(r.diagnostic) && r.diagnostic.length){ parts.push(el("h3", "Diagnostic")); const ul = el("ul"); r.diagnostic.slice(0, 4).forEach(d => ul.append(el("li", String(d)))); parts.push(ul); }
    parts.push(el("p", (r && r.explication) ? String(r.explication) : (n ? "Réglages appliqués." : "Aucun changement proposé.")));
    if (n) parts.push(el("p", `${n} réglage${n>1?"s":""} modifié${n>1?"s":""}. Le bouton Annuler sous la photo revient en arrière.`, "muted"));
    aiShow(parts);
  } catch (e) { aiShow([el("p", AI_ERR(e && e.code))]); }
  b1.disabled = b2.disabled = false;
}
$("#aiEdit").onclick = () => aiCall("edit");
$("#aiAnalyze").onclick = () => aiCall("analyze");
$$("#aiIdeas button").forEach(b => b.onclick = () => { $("#aiPrompt").value = b.textContent; aiCall("edit"); });

/* captions */
let capNet = "Instagram", capTone = "Hype";
$$("#capNet button").forEach(b => b.onclick = () => { capNet = b.textContent; $$("#capNet button").forEach(x => x.setAttribute("aria-pressed", x === b)); });
$$("#capTone button").forEach(b => b.onclick = () => { capTone = b.textContent; $$("#capTone button").forEach(x => x.setAttribute("aria-pressed", x === b)); });
$("#capBtn").onclick = async () => {
  if (!sampleFn || !prev) return;
  const btn = $("#capBtn"), out = $("#capOut"); btn.disabled = true; out.hidden = false; out.innerHTML = ""; out.append(el("p", "Claude écrit ta légende…", "muted"));
  const ctx = $("#capCtx").value.trim();
  const prompt = `Écris une légende de publication ${capNet} en français pour la marque Gravity Basketball, à partir de la photo jointe.
Ton : ${capTone}. ${ctx ? "Contexte donné par l’auteur : " + ctx + "." : ""}
Respecte les usages de ${capNet} (longueur, emojis avec modération, appel à l’action court). N’invente ni nom de joueur, ni score, ni lieu.
Réponds uniquement en JSON : {"legende": "<texte>", "hashtags": ["<5 à 10 hashtags sans espace, avec #>"]}`;
  try {
    const img = sampleImg ? await previewBlob() : null;
    const r = await sampleFn.json(prompt, img ? {images:[img]} : {});
    const text = String(r.legende || "").trim() + (Array.isArray(r.hashtags) && r.hashtags.length ? "\n\n" + r.hashtags.join(" ") : "");
    out.innerHTML = "";
    const pre = el("p", text, "cap"); out.append(pre);
    const copy = el("button", "Copier", "ghost"); copy.style.marginTop = "8px";
    copy.onclick = async () => { try { await navigator.clipboard.writeText(text); copy.textContent = "Copiée"; } catch (e) { const r2 = document.createRange(); r2.selectNodeContents(pre); const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(r2); copy.textContent = "Texte sélectionné"; } };
    out.append(copy);
  } catch (e) { out.innerHTML = ""; out.append(el("p", AI_ERR(e && e.code))); }
  btn.disabled = false;
};

/* ---------- Magic eraser (PatchMatch inpainting) ---------- */
let objTool = false, holeM = null, holeDrag = false, holeLast = null, prevSrcBackup = null, holeHas = false;
const holeC = $("#holeC");
function ensureHole(){
  if (!prev) return;
  if (!holeM || holeM.length !== prev.w*prev.h){ holeM = new Uint8Array(prev.w*prev.h); holeC.width = prev.w; holeC.height = prev.h; holeHas = false; }
}
function drawHoleOverlay(){
  const x = holeC.getContext("2d"), W = prev.w, H = prev.h, id = x.createImageData(W, H), d = id.data;
  for (let i=0;i<holeM.length;i++) if (holeM[i]){ d[i*4] = 255; d[i*4+1] = 45; d[i*4+2] = 85; d[i*4+3] = 150; }
  x.putImageData(id, 0, 0);
}
function setObjTool(on){
  objTool = on; ensureHole();
  $("#eraseTool").setAttribute("aria-pressed", on);
  holeC.hidden = !on && !holeHas;
  if (on){ if (comparing) $("#compare").click(); if (loupeOn) $("#loupeBtn").click(); if (cut && cut.tool){ cut.tool = null; refreshCutUI(); } }
  frame.classList.toggle("tooling", on || !!(cut && cut.tool));
}
$("#eraseTool").onclick = () => setObjTool(!objTool);
$("#eraseClear").onclick = () => { if (!holeM) return; holeM.fill(0); holeHas = false; drawHoleOverlay(); $("#eraseRun").disabled = true; };
function holeAt(e, first){
  const r = frame.getBoundingClientRect(), W = prev.w, H = prev.h;
  const pt = {x:(e.clientX - r.left)/r.width*W, y:(e.clientY - r.top)/r.height*H};
  const rad = +$("#objBrush").value * W / r.width;
  const cur = $("#bcur"); cur.style.display = "block"; cur.style.width = cur.style.height = (+$("#objBrush").value)*2 + "px"; cur.style.left = (e.clientX - r.left) + "px"; cur.style.top = (e.clientY - r.top) + "px";
  const from = first || !holeLast ? pt : holeLast, dist = Math.hypot(pt.x-from.x, pt.y-from.y), steps = Math.max(1, Math.ceil(dist/(rad/3)));
  for (let s=1; s<=steps; s++){
    const cx = from.x + (pt.x-from.x)*s/steps, cy = from.y + (pt.y-from.y)*s/steps;
    const x0 = Math.max(0, Math.floor(cx-rad)), x1 = Math.min(W-1, Math.ceil(cx+rad)), y0 = Math.max(0, Math.floor(cy-rad)), y1 = Math.min(H-1, Math.ceil(cy+rad));
    for (let y=y0; y<=y1; y++) for (let x=x0; x<=x1; x++) if ((x-cx)*(x-cx) + (y-cy)*(y-cy) <= rad*rad) holeM[y*W+x] = 1;
  }
  holeLast = pt; holeHas = true; $("#eraseRun").disabled = false;
  drawHoleOverlay();
}
function holeEnd(){ holeLast = null; const c = $("#bcur"); if (c) c.style.display = "none"; }

function inpaint(rgba, w, h, hole){
  // pyramid
  const levels = [];
  let img = new Float32Array(w*h*3), hl = Uint8Array.from(hole);
  for (let i=0;i<w*h;i++){ img[i*3] = rgba[i*4]; img[i*3+1] = rgba[i*4+1]; img[i*3+2] = rgba[i*4+2]; }
  levels.push({w, h, img, hole:hl});
  while (Math.max(levels[levels.length-1].w, levels[levels.length-1].h) > 48){
    const L = levels[levels.length-1], w2 = Math.ceil(L.w/2), h2 = Math.ceil(L.h/2);
    const im2 = new Float32Array(w2*h2*3), ho2 = new Uint8Array(w2*h2);
    let holes = 0;
    for (let y=0;y<h2;y++) for (let x=0;x<w2;x++){
      let r=0,g=0,b=0,c=0;
      for (let dy=0;dy<2;dy++) for (let dx=0;dx<2;dx++){ const xx = Math.min(L.w-1, 2*x+dx), yy = Math.min(L.h-1, 2*y+dy), j = yy*L.w+xx; if (!L.hole[j]){ r+=L.img[j*3]; g+=L.img[j*3+1]; b+=L.img[j*3+2]; c++; } }
      const k = y*w2+x;
      if (c){ im2[k*3]=r/c; im2[k*3+1]=g/c; im2[k*3+2]=b/c; } else { ho2[k] = 1; holes++; }
    }
    levels.push({w:w2, h:h2, img:im2, hole:ho2});
    if (!holes) break;
  }
  while (levels.length > 1 && !levels[levels.length-1].hole.some(v => v)) levels.pop();
  const top = levels[levels.length-1];
  // coarsest: onion-peel texture synthesis (each boundary pixel copies the centre of the best-matching known patch)
  const P = 3; // patch radius (7x7)
  { const {w:W, h:H, img:I} = top, known = Uint8Array.from(top.hole, v => v ? 0 : 1); let left = 0; for (const v of known) if (!v) left++;
    const R0 = rng(77), src = [];
    for (let y=P;y<H-P;y++) for (let x=P;x<W-P;x++){ let ok = 1; for (let dy=-P;dy<=P && ok;dy++) for (let dx=-P;dx<=P;dx++) if (!known[(y+dy)*W+x+dx]){ ok = 0; break; } if (ok) src.push(y*W+x); }
    if (!src.length) for (let j=0;j<W*H;j++) if (known[j]) src.push(j);
    const cand = src.length > 900 ? Array.from({length:900}, () => src[(R0()*src.length)|0]) : src;
    let guard = 0;
    while (left && guard++ < 4000){
      const bnd = [];
      for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const j = y*W+x; if (known[j]) continue; let k = 0;
        for (let dy=-1;dy<=1 && !k;dy++) for (let dx=-1;dx<=1;dx++){ const xx=x+dx, yy=y+dy; if (xx>=0&&yy>=0&&xx<W&&yy<H&&known[yy*W+xx]){ k=1; break; } }
        if (k) bnd.push(j); }
      if (!bnd.length) break;
      const fill = [];
      for (const p of bnd){ const px = p % W, py = (p/W)|0; let best = 1e30, bq = -1;
        for (const q of cand){ const qx = q % W, qy = (q/W)|0; let sum = 0, cnt = 0;
          for (let dy=-P;dy<=P;dy++){ const ty = py+dy, sy = qy+dy; if (ty<0||ty>=H||sy<0||sy>=H) continue;
            for (let dx=-P;dx<=P;dx++){ const tx = px+dx, sx = qx+dx; if (tx<0||tx>=W||sx<0||sx>=W) continue; const t = ty*W+tx; if (!known[t]) continue;
              const a = t*3, b = (sy*W+sx)*3, d0 = I[a]-I[b], d1 = I[a+1]-I[b+1], d2 = I[a+2]-I[b+2]; sum += d0*d0+d1*d1+d2*d2; cnt++; } }
          if (cnt){ const v = sum/cnt; if (v < best){ best = v; bq = q; } } }
        fill.push([p, bq]); }
      for (const [p, q] of fill){ if (q >= 0){ I[p*3]=I[q*3]; I[p*3+1]=I[q*3+1]; I[p*3+2]=I[q*3+2]; } known[p] = 1; left--; }
    }
  }
  const R = rng(1234);
  let prevNN = null, prevW = 0;
  for (let li = levels.length-1; li >= 0; li--){
    const L = levels[li], {w:W, h:H, img:I, hole:HO} = L, n = W*H;
    if (li < levels.length-1){
      const C = levels[li+1];
      for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const j = y*W+x; if (!HO[j]) continue;
        const fx = Math.min(C.w-1.001, Math.max(0, x/2 - 0.25)), fy = Math.min(C.h-1.001, Math.max(0, y/2 - 0.25)), x0 = fx|0, y0 = fy|0, ax = fx-x0, ay = fy-y0;
        for (let c=0;c<3;c++){ const a = C.img[(y0*C.w+x0)*3+c], b = C.img[(y0*C.w+x0+1)*3+c], d = C.img[((y0+1)*C.w+x0)*3+c], e = C.img[((y0+1)*C.w+x0+1)*3+c];
          I[j*3+c] = (a*(1-ax)+b*ax)*(1-ay) + (d*(1-ax)+e*ax)*ay; } }
    }
    // valid sources: patch fully inside and hole-free
    const near = blur(Float32Array.from(HO), W, H, P); // >0 near hole
    const valid = new Uint8Array(n), vlist = [];
    for (let y=P;y<H-P;y++) for (let x=P;x<W-P;x++){ const j = y*W+x; let ok = 1;
      if (near[j] > 1e-6){ for (let dy=-P;dy<=P && ok;dy++) for (let dx=-P;dx<=P;dx++) if (HO[j+dy*W+dx]){ ok = 0; break; } }
      if (ok){ valid[j] = 1; vlist.push(j); } }
    if (!vlist.length) continue;
    // targets: centers whose patch touches the hole
    const tgt = [];
    for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const j = y*W+x; let t = 0;
      for (let dy=-P;dy<=P && !t;dy++){ const yy=y+dy; if (yy<0||yy>=H) continue; for (let dx=-P;dx<=P;dx++){ const xx=x+dx; if (xx<0||xx>=W) continue; if (HO[yy*W+xx]){ t=1; break; } } }
      if (t) tgt.push(j); }
    const nn = new Int32Array(n).fill(-1), nd = new Float32Array(n).fill(1e30);
    const hw = li === levels.length-1 ? 0.05 : 0.35;
    const dist = (p, q, best) => {
      const px = p % W, py = (p / W)|0, qx = q % W, qy = (q / W)|0; let s = 0;
      for (let dy=-P;dy<=P;dy++){ const ty = py+dy; if (ty<0||ty>=H) continue;
        for (let dx=-P;dx<=P;dx++){ const tx = px+dx; if (tx<0||tx>=W) continue;
          const a = (ty*W+tx)*3, b = ((qy+dy)*W+qx+dx)*3;
          const d0 = I[a]-I[b], d1 = I[a+1]-I[b+1], d2 = I[a+2]-I[b+2]; s += (d0*d0+d1*d1+d2*d2)*(HO[ty*W+tx] ? hw : 1); }
        if (s >= best) return s; }
      return s; };
    const tryQ = (p, q) => { if (q < 0 || q >= n || !valid[q]) return; const d = dist(p, q, nd[p]); if (d < nd[p]){ nd[p] = d; nn[p] = q; } };
    for (const p of tgt){
      if (prevNN){ const px = p % W, py = (p/W)|0, cp = Math.min(prevW*((levels[li+1].h)) - 1, ((py>>1)*prevW + (px>>1))), cq = prevNN[cp];
        if (cq >= 0){ const qx = Math.min(W-1-P, Math.max(P, (cq % prevW)*2 + (px&1))), qy = Math.min(H-1-P, Math.max(P, ((cq/prevW)|0)*2 + (py&1))); tryQ(p, qy*W+qx); } }
      tryQ(p, vlist[(R()*vlist.length)|0]);
    }
    const em = li === levels.length-1 ? 4 : 3;
    for (let it=0; it<em; it++){
      for (let pm=0; pm<4 && !(it === 0 && li < levels.length-1); pm++){
        const rev = pm & 1, m = tgt.length;
        for (let ii=0; ii<m; ii++){
          const p = tgt[rev ? m-1-ii : ii], px = p % W, s = rev ? -1 : 1;
          if (nn[p] >= 0) nd[p] = dist(p, nn[p], 1e30);
          const a = p - s, b = p - s*W;
          if (px - s >= 0 && px - s < W && nn[a] >= 0) tryQ(p, nn[a] + s);
          if (b >= 0 && b < n && nn[b] >= 0) tryQ(p, nn[b] + s*W);
          let rad = Math.max(W, H);
          const q0 = nn[p] >= 0 ? nn[p] : vlist[(R()*vlist.length)|0], qx0 = q0 % W, qy0 = (q0/W)|0;
          while (rad >= 1){ const qx = Math.round(qx0 + (R()*2-1)*rad), qy = Math.round(qy0 + (R()*2-1)*rad); if (qx>=P && qy>=P && qx<W-P && qy<H-P) tryQ(p, qy*W+qx); rad = rad >> 1; }
        }
      }
      // vote
      const sharp = it === em-1 ? 0.15 : 0.5;
      const acc = new Float32Array(n*3), wsum = new Float32Array(n);
      let md = 0, mc = 0; for (const p of tgt) if (nn[p] >= 0){ md += nd[p]; mc++; }
      md = mc ? md/mc + 1 : 1;
      for (const p of tgt){ const q = nn[p]; if (q < 0) continue;
        const px = p % W, py = (p/W)|0, qx = q % W, qy = (q/W)|0, wt = Math.exp(-nd[p]/(sharp*md));
        for (let dy=-P;dy<=P;dy++){ const ty = py+dy; if (ty<0||ty>=H) continue;
          for (let dx=-P;dx<=P;dx++){ const tx = px+dx; if (tx<0||tx>=W) continue; const t = ty*W+tx; if (!HO[t]) continue;
            const sidx = ((qy+dy)*W+qx+dx)*3; acc[t*3]+=I[sidx]*wt; acc[t*3+1]+=I[sidx+1]*wt; acc[t*3+2]+=I[sidx+2]*wt; wsum[t]+=wt; } } }
      if (li === 0 && it === em-1){
        // final pass: each pixel takes the colour of the best-matching patch covering it (keeps texture sharp)
        const bd = new Float32Array(n).fill(1e30);
        for (const p of tgt){ const q = nn[p]; if (q < 0) continue;
          const px = p % W, py = (p/W)|0, qx = q % W, qy = (q/W)|0, dd = nd[p];
          for (let dy=-P;dy<=P;dy++){ const ty = py+dy; if (ty<0||ty>=H) continue;
            for (let dx=-P;dx<=P;dx++){ const tx = px+dx; if (tx<0||tx>=W) continue; const t = ty*W+tx; if (!HO[t]) continue;
              const pen = dd*(1 + 0.08*(dx*dx+dy*dy));
              if (pen < bd[t]){ bd[t] = pen; const sidx = ((qy+dy)*W+qx+dx)*3; acc[t*3]=I[sidx]; acc[t*3+1]=I[sidx+1]; acc[t*3+2]=I[sidx+2]; wsum[t]=1; } } } }
      }
      for (let t=0;t<n;t++) if (HO[t] && wsum[t] > 0){ I[t*3]=acc[t*3]/wsum[t]; I[t*3+1]=acc[t*3+1]/wsum[t]; I[t*3+2]=acc[t*3+2]/wsum[t]; }
    }
    prevNN = nn; prevW = W;
  }
  const out = new Uint8ClampedArray(w*h*4), F = levels[0].img;
  for (let i=0;i<w*h;i++){ out[i*4]=F[i*3]; out[i*4+1]=F[i*3+1]; out[i*4+2]=F[i*3+2]; out[i*4+3]=255; }
  return out;
}
$("#eraseRun").onclick = () => {
  if (!holeHas || !src) return;
  busy(true, "Effacement de l’objet…");
  setTimeout(() => {
    try {
      const W = prev.w, H = prev.h;
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y=0;y<H;y++) for (let x=0;x<W;x++) if (holeM[y*W+x]){ if (x<x0) x0=x; if (x>x1) x1=x; if (y<y0) y0=y; if (y>y1) y1=y; }
      if (x1 < 0) throw 0;
      const mw = Math.round((x1-x0)*0.6 + 24), mh = Math.round((y1-y0)*0.6 + 24);
      x0 = Math.max(0, x0-mw); y0 = Math.max(0, y0-mh); x1 = Math.min(W-1, x1+mw); y1 = Math.min(H-1, y1+mh);
      const S = src.width / W, sx = Math.round(x0*S), sy = Math.round(y0*S), sw = Math.min(src.width - sx, Math.round((x1-x0+1)*S)), sh = Math.min(src.height - sy, Math.round((y1-y0+1)*S));
      const f = Math.min(1, 360/Math.max(sw, sh)), ww = Math.max(8, Math.round(sw*f)), wh = Math.max(8, Math.round(sh*f));
      const wc = document.createElement("canvas"); wc.width = ww; wc.height = wh;
      const wx = wc.getContext("2d"); wx.imageSmoothingQuality = "high"; wx.drawImage(src, sx, sy, sw, sh, 0, 0, ww, wh);
      const hole = new Uint8Array(ww*wh);
      for (let y=0;y<wh;y++) for (let x=0;x<ww;x++){
        const px = Math.min(W-1, x0 + Math.floor(x/ww*(x1-x0+1))), py = Math.min(H-1, y0 + Math.floor(y/wh*(y1-y0+1)));
        if (holeM[py*W+px]) hole[y*ww+x] = 1;
      }
      const dil = blur(Float32Array.from(hole), ww, wh, 2); for (let i=0;i<hole.length;i++) if (dil[i] > 0.02) hole[i] = 1;
      const id = wx.getImageData(0, 0, ww, wh);
      const res = inpaint(id.data, ww, wh, hole);
      const soft = blur(Float32Array.from(hole), ww, wh, 1);
      for (let i=0;i<ww*wh;i++){ res[i*4+3] = Math.min(255, Math.max(hole[i] ? 255 : 0, soft[i]*2*255)); }
      wx.putImageData(new ImageData(res, ww, wh), 0, 0);
      prevSrcBackup = document.createElement("canvas"); prevSrcBackup.width = src.width; prevSrcBackup.height = src.height; prevSrcBackup.getContext("2d").drawImage(src, 0, 0);
      const sctx = src.getContext("2d"); sctx.imageSmoothingQuality = "high"; sctx.drawImage(wc, 0, 0, ww, wh, sx, sy, sw, sh);
      holeM.fill(0); holeHas = false; $("#eraseRun").disabled = true; $("#eraseUndo").disabled = false;
      rebuildKeepCut();
      drawHoleOverlay(); srcVer++; logStep("Gomme magique", null);
    } catch (e) { $("#eraseHint").textContent = "L’effacement a échoué. Essaie une zone plus petite."; }
    busy(false);
  }, 40);
};
$("#eraseUndo").onclick = () => {
  if (!prevSrcBackup) return;
  src.getContext("2d").drawImage(prevSrcBackup, 0, 0); prevSrcBackup = null; $("#eraseUndo").disabled = true;
  rebuildKeepCut(); srcVer++; logStep("Gomme annulée", null);
};
function rebuildKeepCut(){
  const keep = cut; buildPreview(true); cut = keep; refreshCutUI(); ensureHole(); schedule(); scheduleLoupe(0);
}

/* ---------- Virtual lighting ---------- */
const light = {on:false, angle:315, power:55, amb:30, color:"#FFE2B8"};
function lightMaps(proc, alpha){
  const W = proc.width, H = proc.height, k = Math.min(1, 360/Math.max(W, H)), w = Math.max(8, Math.round(W*k)), h = Math.max(8, Math.round(H*k)), n = w*h;
  const t = document.createElement("canvas"); t.width = w; t.height = h; const tx = t.getContext("2d");
  tx.drawImage(proc, 0, 0, w, h); const d = tx.getImageData(0, 0, w, h).data;
  const L = new Float32Array(n); for (let i=0;i<n;i++) L[i] = (0.2126*d[i*4]+0.7152*d[i*4+1]+0.0722*d[i*4+2])/255;
  const Hm = blur(L, w, h, Math.max(2, Math.round(Math.max(w,h)/45)));
  let A = null;
  if (alpha){ tx.clearRect(0, 0, w, h); tx.drawImage(alpha, 0, 0, w, h); const ad = tx.getImageData(0, 0, w, h).data; A = new Float32Array(n); for (let i=0;i<n;i++) A[i] = ad[i*4+3]/255; }
  const Ab = A ? blur(A, w, h, Math.max(1, Math.round(Math.max(w,h)/150))) : null;
  const a = light.angle*Math.PI/180, lx = Math.cos(a), ly = Math.sin(a), lz = 0.55, pw = light.power/100, am = light.amb/100;
  const mul = new Float32Array(n), rim = new Float32Array(n);
  const diag = Math.hypot(w, h)/2;
  for (let y=0;y<h;y++) for (let x=0;x<w;x++){
    const i = y*w+x, xl = Math.max(0, x-1), xr = Math.min(w-1, x+1), yu = Math.max(0, y-1), yd = Math.min(h-1, y+1);
    const gx = (Hm[y*w+xr]-Hm[y*w+xl])*w*0.9, gy = (Hm[yd*w+x]-Hm[yu*w+x])*h*0.9;
    let nx = -gx, ny = -gy, nz = 1; const nl = Math.hypot(nx, ny, nz); nx/=nl; ny/=nl; nz/=nl;
    const lam = Math.max(0, nx*lx + ny*ly + nz*lz)/Math.hypot(lx, ly, lz);
    const dirg = 0.5 + 0.5*(((x-w/2)*lx + (y-h/2)*ly)/diag);
    const S = 0.6*dirg + 0.4*lam;
    mul[i] = (1 - am*0.55*(1 - S)) * (1 + pw*0.9*(S - 0.45));
    if (Ab){ const ex = Math.min(w-1, x+1), wx2 = Math.max(0, x-1), ey = Math.min(h-1, y+1), wy = Math.max(0, y-1);
      const agx = Ab[y*w+ex]-Ab[y*w+wx2], agy = Ab[ey*w+x]-Ab[wy*w+x], gm = Math.hypot(agx, agy);
      if (gm > 1e-4){ const facing = Math.max(0, (-agx*lx - agy*ly)/gm); rim[i] = Math.min(1, gm*6) * facing*facing * pw * A[i]; } }
  }
  return {w, h, mul, rim: Ab ? blur(rim, w, h, 1) : null};
}
function applyLight(data, W, H, maps){
  const {w, h, mul, rim} = maps, [cr, cg, cb] = hexRgb(light.color), sx = (w-1)/Math.max(1, W-1), sy = (h-1)/Math.max(1, H-1);
  const tr = cr/255, tg = cg/255, tb = cb/255;
  for (let y=0;y<H;y++){
    const fy = y*sy, y0 = fy|0, y1 = Math.min(h-1, y0+1), ay = fy-y0;
    for (let x=0;x<W;x++){
      const fx = x*sx, x0 = fx|0, x1 = Math.min(w-1, x0+1), ax = fx-x0;
      const i00 = y0*w+x0, i01 = y0*w+x1, i10 = y1*w+x0, i11 = y1*w+x1;
      const m = (mul[i00]*(1-ax)+mul[i01]*ax)*(1-ay) + (mul[i10]*(1-ax)+mul[i11]*ax)*ay;
      const j = (y*W+x)*4, warm = m > 1 ? m - 1 : 0;
      let r = data[j]*(m - warm + warm*tr*1.15), g = data[j+1]*(m - warm + warm*tg*1.15), b = data[j+2]*(m - warm + warm*tb*1.15);
      if (rim){ const rv = (rim[i00]*(1-ax)+rim[i01]*ax)*(1-ay) + (rim[i10]*(1-ax)+rim[i11]*ax)*ay; if (rv > 0.002){ r += rv*cr*1.3; g += rv*cg*1.3; b += rv*cb*1.3; } }
      data[j] = r; data[j+1] = g; data[j+2] = b;
    }
  }
}
function lightCanvas(c, alpha){
  if (!light.on) return c;
  const maps = lightMaps(c, alpha), x = c.getContext("2d"), id = x.getImageData(0, 0, c.width, c.height);
  applyLight(id.data, c.width, c.height, maps); x.putImageData(id, 0, 0); return c;
}
const lightC = document.createElement("canvas");
function lightPreview(){
  if (!light.on) return;
  if (lightC.width !== prev.w || lightC.height !== prev.h){ lightC.width = prev.w; lightC.height = prev.h; }
  lightC.getContext("2d").putImageData(outData, 0, 0);
  applyLight(outData.data, prev.w, prev.h, lightMaps(lightC, cut ? cut.alphaC : null));
}
$("#lightT").addEventListener("change", () => { light.on = $("#lightT").checked; $("#lightOpts").hidden = !light.on; schedule(); });
[["lightA","angle"],["lightP","power"],["lightAmb","amb"]].forEach(([id, key]) => $("#"+id).addEventListener("input", () => { light[key] = +$("#"+id).value; if (id === "lightA") $("#lightAO").textContent = dirName(light.angle); schedule(); }));
const dirName = a => ["droite","bas droite","bas","bas gauche","gauche","haut gauche","haut","haut droite"][Math.round(((a % 360)+360)%360/45)%8];
$$("#lightCol button").forEach(b => b.onclick = () => { light.color = b.dataset.c; $$("#lightCol button").forEach(x => x.setAttribute("aria-pressed", x === b)); schedule(); });

/* ---------- History & saved projects ---------- */
var steps = [], stepLabel = null, curProj = null, originalSrc = null, srcVer = 0, savedSrcVer = -1, savedAlphaObj, savedAlphaVer = -1, saveTimer = 0, restoring = false, dbP = null;
function cloneCanvas(c){ const n = document.createElement("canvas"); n.width = c.width; n.height = c.height; n.getContext("2d").drawImage(c, 0, 0); return n; }
function timeAgo(t){ const d = (Date.now() - t)/1000; if (d < 45) return "à l’instant"; if (d < 3600) return `il y a ${Math.round(d/60)} min`; if (d < 86400) return `il y a ${Math.round(d/3600)} h`; if (d < 172800) return "hier"; return new Date(t).toLocaleDateString("fr-FR", {day:"numeric", month:"short"}); }
function labelFor(a, b){
  if (stepLabel){ const l = stepLabel; stepLabel = null; return l; }
  const ch = sliderDefs().filter(([k]) => a[k] !== b[k]);
  if (!ch.length) return "Réglages";
  if (ch.length === 1){ const [k, lab,,,, fmt] = ch[0]; return `${lab} ${(fmt || fmtNum)(b[k])}`; }
  if (ch.length === 2) return `${ch[0][1]} et ${ch[1][1].toLowerCase()}`;
  return "Plusieurs réglages";
}
function logStep(label, p){
  if (restoring) return;
  steps.push({label, p: p ? {...p} : null, t: Date.now()});
  if (steps.length > 80) steps.splice(1, steps.length - 80);
  renderSteps(); autosave();
}
function renderSteps(){
  const ul = $("#steps"); if (!ul) return; ul.innerHTML = "";
  let cur = -1; for (let i=steps.length-1; i>=0; i--) if (steps[i].p && same(clampP({...DEF, ...steps[i].p}), params)){ cur = i; break; }
  steps.forEach((s, i) => {
    const li = document.createElement("li"); li.className = "step" + (i === cur ? " on" : "") + (s.p ? "" : " info");
    const b = document.createElement(s.p ? "button" : "div");
    const a = document.createElement("span"); a.textContent = s.label;
    const t = document.createElement("small"); t.textContent = i === cur ? "État actuel" : timeAgo(s.t);
    b.append(a, t);
    if (s.p) b.onclick = () => { stepLabel = `Retour à « ${s.label} »`; params = clampP({...DEF, ...s.p}); activeLook = null; markLooks(); syncUI(); schedule(); commit(); };
    li.append(b); ul.prepend(li);
  });
}
function newProject(name){
  curProj = {id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, created: Date.now(), origSaved: false};
  originalSrc = cloneCanvas(src); srcVer++; savedSrcVer = -1; savedAlphaObj = undefined; savedAlphaVer = -1;
  steps = [{label:"Photo d’origine", p:{...DEF}, t:Date.now()}];
  stepLabel = "Amélioration auto";
}

/* IndexedDB (private to this browser) */
function idb(){
  if (dbP) return dbP;
  dbP = new Promise((res, rej) => {
    try {
      const r = indexedDB.open("artcraft-pictures", 2);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("projects")) d.createObjectStore("projects", {keyPath:"id"}); if (!d.objectStoreNames.contains("images")) d.createObjectStore("images"); if (!d.objectStoreNames.contains("jobs")) d.createObjectStore("jobs"); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  });
  dbP.catch(() => { dbP = null; });
  return dbP;
}
function store(name, mode, fn){
  return idb().then(d => new Promise((res, rej) => {
    const t = d.transaction(name, mode), req = fn(t.objectStore(name));
    t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
}
function autosave(){
  if (restoring || !curProj || !src) return;
  clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 1500);
}
async function saveNow(){
  clearTimeout(saveTimer); saveTimer = 0;
  if (!curProj || !src || !prev) return;
  const p = curProj, st = $("#saveState");
  try {
    if (savedSrcVer !== srcVer){
      const v = srcVer, b = await toBlob(src, "image/jpeg", 0.95);
      await store("images", "readwrite", s => s.put(b, p.id + ":src"));
      if (!p.origSaved && originalSrc){ const o = await toBlob(originalSrc, "image/jpeg", 0.95); await store("images", "readwrite", s => s.put(o, p.id + ":orig")); p.origSaved = true; }
      savedSrcVer = v;
    }
    if (savedAlphaObj !== cut || (cut && savedAlphaVer !== cut.ver)){
      const c = cut, v = c ? c.ver : -1;
      if (c){ const ab = await toBlob(c.alphaC, "image/png"); await store("images", "readwrite", s => s.put(ab, p.id + ":alpha")); }
      else await store("images", "readwrite", s => s.delete(p.id + ":alpha"));
      savedAlphaObj = c; savedAlphaVer = v;
    }
    const th = scaledCanvas(view, 180).toDataURL("image/jpeg", 0.8);
    const rec = {id:p.id, name:p.name, created:p.created, updated:Date.now(), thumb:th, hasAlpha:!!cut,
      state:{params:{...params}, crop: crop ? {fid:crop.f.id, cx:crop.cx, cy:crop.cy, z:crop.z} : null, bg:{...bgOpt}, light:{...light}, steps:steps.slice(-60)}};
    await store("projects", "readwrite", s => s.put(rec));
    if (st) st.textContent = "Projet enregistré automatiquement sur cet appareil.";
    renderProjects();
  } catch (e) {
    if (st) st.textContent = e && e.name === "QuotaExceededError" ? "Mémoire pleine : supprime d’anciens projets pour continuer à enregistrer." : "L’enregistrement des projets n’est pas disponible dans ce navigateur.";
  }
}
document.addEventListener("visibilitychange", () => { if (document.hidden && saveTimer) saveNow(); });

function cutFromAlpha(ac){
  const W = prev.w, H = prev.h, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(ac, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data, base = new Float32Array(W*H), M = new Uint8Array(W*H);
  for (let i=0;i<W*H;i++){ base[i] = d[i*4+3]/255; M[i] = base[i] > 0.5 ? 1 : 0; }
  return {W, H, M, inst:[], sel:new Set(), add:new Uint8Array(W*H), rem:new Uint8Array(W*H), base, A:base, alphaC:c, ver:1, tool:null};
}
async function openProject(id){
  busy(true, "Ouverture du projet…");
  try {
    await saveNow();
    const rec = await store("projects", "readonly", s => s.get(id));
    const sb = await store("images", "readonly", s => s.get(id + ":src"));
    if (!rec || !sb) throw new Error("missing");
    const ob = await store("images", "readonly", s => s.get(id + ":orig"));
    const ab = rec.hasAlpha ? await store("images", "readonly", s => s.get(id + ":alpha")) : null;
    const c = await decodeFile(sb), oc = ob ? await decodeFile(ob) : null, ac = ab ? await decodeFile(ab) : null;
    restoring = true;
    if (comparing) $("#compare").click(); if (loupeOn) $("#loupeBtn").click();
    src = c; fileBase = rec.name; originalSrc = oc || cloneCanvas(c);
    curProj = {id:rec.id, name:rec.name, created:rec.created, origSaved:!!ob};
    srcVer++; savedSrcVer = srcVer;
    prevSrcBackup = null; $("#eraseUndo").disabled = true;
    buildPreview(true);
    const st = rec.state || {};
    params = clampP({...DEF, ...(st.params || {})}); committed = {...params}; history = []; future = []; updUndo();
    activeLook = null; markLooks(); syncUI();
    const f = st.crop && SOCIAL.find(q => q.id === st.crop.fid);
    crop = f ? {f, cx:st.crop.cx, cy:st.crop.cy, z:st.crop.z || 1} : null; recoApplied = null;
    $("#zoomS").value = crop ? crop.z : 1; $("#zoomO").textContent = "×" + (crop ? crop.z : 1).toFixed(1).replace(".", ",");
    clampCrop(); updateCropUI(); refreshSocial();
    Object.assign(bgOpt, st.bg || {});
    $("#txtT").checked = !!bgOpt.text; $("#txtV").value = bgOpt.word; $("#haloT").checked = !!bgOpt.halo; $("#bgColor").value = bgOpt.color;
    $("#edgeS").value = bgOpt.edge; $("#edgeO").textContent = bgOpt.edge; $("#brushS").value = bgOpt.brush;
    Object.assign(light, st.light || {});
    $("#lightT").checked = !!light.on; $("#lightOpts").hidden = !light.on; $("#lightA").value = light.angle; $("#lightAO").textContent = dirName(light.angle);
    $("#lightP").value = light.power; $("#lightAmb").value = light.amb; $$("#lightCol button").forEach(b => b.setAttribute("aria-pressed", b.dataset.c === light.color));
    cut = ac ? cutFromAlpha(ac) : null;
    savedAlphaObj = cut; savedAlphaVer = cut ? cut.ver : -1;
    buildBgTiles(); refreshCutUI();
    steps = Array.isArray(st.steps) && st.steps.length ? st.steps : [{label:"Photo d’origine", p:{...DEF}, t:rec.created}];
    restoring = false;
    logStep("Projet repris", null);
    schedule();
  } catch (e) {
    restoring = false;
    $("#projNote").textContent = "Ce projet n’a pas pu être ouvert.";
  }
  busy(false);
}
async function deleteProject(id){
  try {
    await store("projects", "readwrite", s => s.delete(id));
    await store("images", "readwrite", s => { s.delete(id + ":orig"); s.delete(id + ":alpha"); return s.delete(id + ":src"); });
    if (curProj && curProj.id === id){ curProj = null; $("#saveState").textContent = "Projet supprimé : la photo ouverte n’est plus enregistrée."; }
  } catch (e) {}
  renderProjects();
}
async function renderProjects(){
  let list;
  try { list = await store("projects", "readonly", s => s.getAll()); }
  catch (e) { $("#projList").innerHTML = ""; $("#emptyProjWrap").hidden = true; $("#projNote").textContent = "Les projets ne peuvent pas être enregistrés dans ce navigateur."; return; }
  list.sort((a, b) => b.updated - a.updated);
  const build = (host, items) => {
    host.innerHTML = "";
    for (const r of items){
      const card = document.createElement("div"); card.className = "proj";
      const im = document.createElement("img"); im.src = r.thumb; im.alt = "";
      const info = document.createElement("div"); info.className = "pinfo";
      const nm = document.createElement("span"); nm.textContent = r.name;
      const tm = document.createElement("small"); tm.textContent = (curProj && curProj.id === r.id ? "Ouvert · " : "") + "modifié " + timeAgo(r.updated);
      info.append(nm, tm);
      const acts = document.createElement("div"); acts.className = "pacts";
      const open = document.createElement("button"); open.className = "ghost sm"; open.textContent = curProj && curProj.id === r.id ? "En cours" : "Reprendre";
      open.disabled = !!(curProj && curProj.id === r.id); open.onclick = () => openProject(r.id);
      const del = document.createElement("button"); del.className = "ghost sm"; del.textContent = "Supprimer"; let armed = false;
      del.onclick = () => { if (!armed){ armed = true; del.textContent = "Confirmer"; del.classList.add("danger"); setTimeout(() => { armed = false; del.textContent = "Supprimer"; del.classList.remove("danger"); }, 3500); return; } deleteProject(r.id); };
      acts.append(open, del); card.append(im, info, acts); host.append(card);
    }
  };
  build($("#projList"), list);
  if (!list.length) $("#projList").innerHTML = '<p class="fhint">Aucun projet enregistré pour l’instant.</p>';
  build($("#emptyProj"), list.slice(0, 3)); $("#emptyProjWrap").hidden = !list.length;
}

$("#toOriginal").onclick = () => {
  if (!src || !originalSrc) return;
  restoring = true;
  src = cloneCanvas(originalSrc); srcVer++;
  prevSrcBackup = null; $("#eraseUndo").disabled = true;
  buildPreview(true); setFormat(null);
  light.on = false; $("#lightT").checked = false; $("#lightOpts").hidden = true;
  restoring = false;
  stepLabel = "Retour à la photo d’origine"; params = {...DEF}; activeLook = 0; markLooks(); syncUI(); schedule();
  if (same(params, committed)) logStep("Retour à la photo d’origine", params); else commit();
};
let zeroArm = false;
$("#startOver").onclick = async () => {
  const b = $("#startOver");
  if (!zeroArm){ zeroArm = true; b.textContent = "Touche encore pour confirmer"; b.classList.add("danger"); setTimeout(() => { zeroArm = false; b.textContent = "Recommencer à zéro"; b.classList.remove("danger"); }, 4000); return; }
  zeroArm = false; b.textContent = "Recommencer à zéro"; b.classList.remove("danger");
  if (saveTimer) await saveNow();
  if (comparing) $("#compare").click(); if (loupeOn) $("#loupeBtn").click(); if (objTool) setObjTool(false);
  restoring = true; setFormat(null); restoring = false;
  src = null; prev = null; originalSrc = null; cut = null; curProj = null; steps = [];
  params = {...DEF}; committed = {...DEF}; history = []; future = []; updUndo(); syncUI();
  light.on = false; $("#lightT").checked = false; $("#lightOpts").hidden = true;
  frame.style.display = "none"; $("#empty").style.display = ""; $("#panel").classList.add("off"); $("#tools").hidden = true;
  ["#compare", "#exportBtn"].forEach(s => $(s).disabled = true);
  $('[data-tab="auto"]').click();
  renderSteps(); renderProjects();
};
$("#histBtn").onclick = () => {
  if (src){ $('[data-tab="historique"]').click(); }
  else { renderProjects(); const w = $("#emptyProjWrap"); if (!w.hidden) w.scrollIntoView({block:"nearest"}); else $("#emptyHint").textContent = "Aucun projet enregistré : ouvre une photo pour commencer."; }
};
$$(".tab").forEach(t => t.addEventListener("click", () => { if (t.dataset.tab === "historique"){ renderSteps(); renderProjects(); } }));
renderProjects();

/* ---------- Autonomous batch jobs (persisted, resumable) ---------- */
const yieldUI = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
var wakeLock = null, job = null, jobMem = null, prevLo = null, outLo = null, interacting = 0, fullTimer = 0;
var loC = document.createElement("canvas");
async function keepAwake(on){
  try {
    if (on && !wakeLock && navigator.wakeLock && !document.hidden){ wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); }
    else if (!on && wakeLock){ const w = wakeLock; wakeLock = null; await w.release(); }
  } catch (e) {}
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && bRunning) keepAwake(true); });
const baseTitle = document.title;
const setTitle = t => { document.title = t ? `${t} · ${baseTitle}` : baseTitle; };
const saveMeta = () => job && job.persisted ? store("jobs", "readwrite", s => s.put(JSON.parse(JSON.stringify(job)), "meta")).catch(() => {}) : Promise.resolve();
const jobDone = () => job ? job.status.filter(s => s !== "wait" && s !== "run").length : 0;
const ST_TXT = s => s === "wait" ? "En attente" : s === "run" ? "Traitement…" : s === "ok" ? "Prête" : s === "err" ? "Illisible" : `Prête, ×${s.slice(3)} max`;

function showPill(){
  const p = $("#jobPill"); if (!job){ p.hidden = true; return; }
  p.hidden = false;
  const d = jobDone();
  p.textContent = job.finished ? `Lot prêt · ${job.status.filter(s => s !== "err").length} photos` : `Lot en cours · ${d}/${job.total}`;
  p.classList.toggle("ok", !!job.finished);
}
function updateJobUI(i){
  if (!job) return;
  if (lbIndex === i && job.status[i] !== "run" && !$("#lightbox").hidden) openLightbox(i);
  const li = $$("#bList li")[i];
  if (li){
    const st = li.querySelector(".st"), s = job.status[i];
    st.textContent = ST_TXT(s); st.className = "st" + (s === "ok" || s.startsWith("max") ? " ok" : "");
    if (job.thumbs[i]){ const img = new Image(); img.onload = () => li.querySelector("canvas").getContext("2d").drawImage(img, 0, 0, 88, 88); img.src = job.thumbs[i]; }
    if (s === "run" && bsheet.classList.contains("on")) li.scrollIntoView({block:"nearest"});
  }
  const d = jobDone(); $("#bBar").hidden = false; $("#bBar i").style.width = (d/job.total*100) + "%";
  setTitle(job.finished ? "✓ Lot terminé" : `(${d}/${job.total})`);
  showPill(); refreshB();
}
async function clearJob(){
  job = null; jobMem = null; setTitle(""); showPill();
  try { await store("jobs", "readwrite", s => s.clear()); } catch (e) {}
}
async function startJob(){
  const S = {mode:bMode, look:bLook, fmt:bFmt, scale:bScale, soc: bSoc ? bSoc.id : null, reco: $("#bReco").checked, fixed:{...params}, delta:null, art: bArtSel};
  if (src && autoP){ S.delta = {}; for (const k in DEF) S.delta[k] = params[k] - autoP[k]; }
  job = {id: Date.now(), total: bFiles.length, names: bFiles.map(f => f.name), status: bFiles.map(() => "wait"), thumbs: bFiles.map(() => ""), outNames: bFiles.map(() => ""), settings: S, finished: false, persisted: false};
  jobMem = {inputs: bFiles.slice(), outs: []};
  clearOut(); buildBList();
  $("#bMsg").textContent = "Préparation du lot…";
  try {
    await store("jobs", "readwrite", s => s.clear());
    for (let i=0; i<bFiles.length; i++) await store("jobs", "readwrite", s => s.put(bFiles[i], "in:" + i));
    job.persisted = true; await saveMeta();
    $("#bMsg").textContent = "";
  } catch (e) {
    job.persisted = false;
    $("#bMsg").textContent = "Mémoire insuffisante pour la reprise automatique : garde la page ouverte jusqu’à la fin.";
  }
  runJob();
}
async function processOne(input, S, decode, encode){
  const soc = S.soc ? SOCIAL.find(f => f.id === S.soc) : null, mime = FMT_MIME[S.fmt] || "image/jpeg";
  const c = await decode(input);
  const pc = scaledCanvas(c, PREV_EDGE);
  const a = computeAuto(prepare(pc.getContext("2d").getImageData(0, 0, pc.width, pc.height), 1, {detail:false, clarity:false, denoise:false}));
  let p;
  if (S.mode === "sync") p = {...DEF, ...S.fixed};
  else if (S.mode === "delta" && S.delta){ p = {...a}; for (const k in DEF) p[k] = a[k] + (S.delta[k] || 0); p.art = S.fixed.art || 0; p.artMix = S.fixed.artMix == null ? 100 : S.fixed.artMix; }
  else { p = LOOKS[S.look] ? LOOKS[S.look][1](a) : {...a}; if (S.art){ p.art = S.art; p.artMix = 100; } }
  p = clampP(p);
  let s = S.scale; while (s > 1 && c.width*c.height*s*s > MAX_OUT) s /= 2;
  if (soc){ s = 1; if (S.reco) p = clampP(RECO[soc.rec].adj(p)); }
  const out = soc ? await exportCanvas(c, p, c.width/pc.width, soc, {cx:.5, cy:.5, z:1}) : await renderFull(c, p, c.width/pc.width, s);
  const blob = await encode(out, mime, fmtQuality(S.fmt, soc ? RECO[soc.rec].q : 0));
  if (!blob) throw new Error("encode");
  const m = Math.min(out.width, out.height), tc = document.createElement("canvas"); tc.width = tc.height = 88;
  tc.getContext("2d").drawImage(out, (out.width - m)/2, (out.height - m)/2, m, m, 0, 0, 88, 88);
  const thumb = await encode(tc, "image/jpeg", 0.7);
  return {blob, thumb, s, soc: !!soc};
}
/* worker pool: same code, run in parallel off the main thread */
let pool = null, poolTried = false;
function buildWorkerSrc(){
  const fns = [blur, prepare, needFor, ensureDeblur, hash, render, computeAuto, cropRect, resizeTo, sharpenCanvas, renderFull, exportCanvas, scaledCanvas, processOne,
    artLum, artSobel, artKuwa, artSat, artOil, artWater, artSketch, artComic, artCells, artHalftone, artPixel, artGrad, artDuo, artNeon, artGlitch, artVintage, artDreamy, artNoir, artCross, artEngrave, applyArt];
  let src = 'self.document = {createElement: () => new OffscreenCanvas(1, 1)};\n';
  src += `const DEF = ${JSON.stringify(DEF)}, NEED_ALL = ${JSON.stringify(NEED_ALL)}, MAX_SRC = ${MAX_SRC}, MAX_OUT = ${MAX_OUT}, PREV_EDGE = ${PREV_EDGE};\n`;
  src += `const RANGES = ${JSON.stringify(sliderDefs().map(([k,,mn,mx]) => [k, mn, mx]))};\n`;
  src += 'const clampP = p => { for (const [k, mn, mx] of RANGES) p[k] = Math.max(mn, Math.min(mx, p[k] ?? DEF[k])); return p; };\n';
  src += `const SOCIAL = ${JSON.stringify(SOCIAL)};\n`;
  src += `const LOOKS = [${LOOKS.map(([n, f]) => `[${JSON.stringify(n)}, ${f.toString()}]`).join(",\n")}];\n`;
  src += `const RECO = {${Object.entries(RECO).map(([k, v]) => `${JSON.stringify(k)}: {fmt: ${JSON.stringify(v.fmt)}, q: ${v.q}, adj: ${v.adj.toString()}}`).join(",\n")}};\n`;
  src += `const ART = [${ART.map(a => `{id: ${a.id}, m: ${a.m.toString()}, f: ${a.f ? a.f.name : "null"}}`).join(",\n")}];\n`;
  src += `const q16 = ${q16.toString()};\nconst ss = ${ss.toString()};\nconst deblurRadius = ${deblurRadius.toString()};\nconst yieldUI = () => Promise.resolve();\n`;
  for (const f of fns) src += f.toString() + "\n";
  src += `
async function decodeBlob(b){
  const bmp = await createImageBitmap(b); let w = bmp.width, h = bmp.height;
  const s = Math.min(1, Math.sqrt(MAX_SRC/(w*h))); w = Math.round(w*s); h = Math.round(h*s);
  const c = new OffscreenCanvas(w, h), x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close(); return c;
}
const encode = (c, type, quality) => c.convertToBlob({type, quality});
self.onmessage = async e => {
  const d = e.data;
  if (d.ping){ try { const t = new OffscreenCanvas(4, 4); t.getContext("2d").fillRect(0, 0, 2, 2); await t.convertToBlob({type:"image/jpeg"}); self.postMessage({pong:1}); } catch (err) { self.postMessage({pong:0}); } return; }
  try { const r = await processOne(d.input, d.S, decodeBlob, encode); self.postMessage({id:d.id, ok:true, r}); }
  catch (err) { self.postMessage({id:d.id, ok:false, err:String(err && err.message || err)}); }
};`;
  return src;
}
async function getPool(){
  if (poolTried) return pool;
  poolTried = true;
  try {
    if (!window.Worker || !window.OffscreenCanvas || !window.createImageBitmap) return null;
    const url = URL.createObjectURL(new Blob([buildWorkerSrc()], {type:"text/javascript"}));
    const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || (mobile ? 4 : 8);
    const n = Math.max(1, Math.min(mobile ? 2 : 4, cores - 1, Math.floor(mem/2) || 1));
    const ws = [];
    for (let i=0; i<n; i++) ws.push(new Worker(url));
    await Promise.all(ws.map(w => new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("timeout")), 5000);
      w.onmessage = e => { clearTimeout(t); e.data && e.data.pong ? res() : rej(new Error("no-canvas")); };
      w.onerror = ev => { clearTimeout(t); rej(ev); };
      w.postMessage({ping:1});
    })));
    pool = ws;
  } catch (e) { pool = null; }
  return pool;
}
let taskSeq = 0;
function workerRun(w, input, S){
  return new Promise((res, rej) => {
    const id = ++taskSeq;
    w.onmessage = e => { if (e.data && e.data.id === id){ e.data.ok ? res(e.data.r) : rej(new Error(e.data.err)); } };
    w.onerror = ev => { ev.preventDefault && ev.preventDefault(); rej(new Error("worker")); };
    w.postMessage({id, input, S});
  });
}
const blobToDataURL = b => new Promise(res => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = () => res(""); rd.readAsDataURL(b); });
async function runJob(){
  if (!job || bRunning || job.finished) return;
  bRunning = true; bsheet.classList.add("running"); keepAwake(true); showPill(); refreshB();
  const S = job.settings, used = new Set(job.outNames.filter(Boolean));
  const todo = []; for (let i=0; i<job.total; i++) if (job.status[i] === "wait" || job.status[i] === "run"){ job.status[i] = "wait"; todo.push(i); }
  const workers = await getPool();
  $("#bSpeed").textContent = workers ? `Traitement en parallèle sur ${workers.length} cœur${workers.length > 1 ? "s" : ""}.` : "Traitement sur un seul cœur (ce navigateur ne permet pas le traitement parallèle).";
  let next = 0;
  const finish = async (i, r) => {
    const soc = S.soc ? SOCIAL.find(f => f.id === S.soc) : null;
    const base = (job.names[i] || "photo").replace(/\.[^.]+$/, "").replace(/[^\w\-]+/g, "-").slice(0, 60) || "photo";
    const suf = soc ? "-" + soc.id : (r.s > 1 ? "-x" + r.s : "");
    let name = `${base}-artcraft${suf}.${S.fmt}`, n = 2;
    while (used.has(name)) name = `${base}-artcraft-${n++}${suf}.${S.fmt}`;
    used.add(name);
    if (job.persisted){ try { await store("jobs", "readwrite", st => st.put({name, blob:r.blob}, "out:" + i)); } catch (e) { job.persisted = false; jobMem.outs[i] = {name, blob:r.blob}; } }
    else jobMem.outs[i] = {name, blob:r.blob};
    job.thumbs[i] = r.thumb ? await blobToDataURL(r.thumb) : ""; job.outNames[i] = name;
    job.status[i] = !soc && r.s < S.scale ? "max" + r.s : "ok";
  };
  const lane = async w => {
    while (job && next < todo.length){
      const i = todo[next++];
      job.status[i] = "run"; updateJobUI(i);
      try {
        const input = job.persisted ? await store("jobs", "readonly", s => s.get("in:" + i)) : jobMem.inputs[i];
        if (!input) throw new Error("missing");
        let r;
        if (w){ try { r = await workerRun(w, input, S); } catch (e) { r = await processOne(input, S, decodeFile, toBlob); } }
        else { await yieldUI(); r = await processOne(input, S, decodeFile, toBlob); }
        if (!job) return;
        await finish(i, r);
      } catch (e) { if (!job) return; job.status[i] = "err"; }
      await saveMeta(); updateJobUI(i);
      await yieldUI();
    }
  };
  await Promise.all(workers ? workers.map(w => lane(w)) : [lane(null)]);
  bRunning = false; bsheet.classList.remove("running"); keepAwake(false);
  if (!job) return;
  job.finished = true; await saveMeta();
  const ok = job.status.filter(s => s !== "err").length;
  $("#bMsg").textContent = ok === job.total ? `${plural(ok, "photo")} prête${ok>1?"s":""}. Tu peux tout télécharger.` : `${ok} sur ${job.total} photos prêtes. Les autres n’ont pas pu être lues.`;
  updateJobUI(job.total - 1);
  try { navigator.vibrate && navigator.vibrate([80, 60, 80]); } catch (e) {}
}
async function jobResults(){
  if (!job) return [];
  const out = [];
  for (let i=0; i<job.total; i++){
    if (job.status[i] === "err" || job.status[i] === "wait") continue;
    const r = job.persisted ? await store("jobs", "readonly", s => s.get("out:" + i)).catch(() => null) : jobMem && jobMem.outs[i];
    if (r && r.blob) out.push(r);
  }
  return out;
}
async function resumeJob(){
  try {
    const meta = await store("jobs", "readonly", s => s.get("meta"));
    if (!meta || !meta.total) return;
    job = meta; job.persisted = true; jobMem = {inputs: [], outs: []};
    job.status = job.status.map(s => s === "run" ? "wait" : s);
    buildBList(); showPill(); refreshB();
    if (!job.finished){ $("#bMsg").textContent = "Lot interrompu repris automatiquement."; runJob(); }
  } catch (e) {}
}
$("#bRun").onclick = async () => {
  if (bRunning) return;
  if (job && job.finished) return saveBatch();
  if (!bFiles.length) return;
  startJob();
};
$("#bNew").onclick = async () => { if (bRunning) return; await clearJob(); bFiles = []; clearOut(); buildBList(); refreshB(); };
$("#jobPill").onclick = () => openBatch();

/* ---------- Autopilot ---------- */
const AP_KEY = "acp-autopilot";
let ap = {on:false, look:1, fmt:"", ai:false};
try { Object.assign(ap, JSON.parse(localStorage.getItem(AP_KEY) || "{}")); } catch (e) {}
const saveAp = () => { try { localStorage.setItem(AP_KEY, JSON.stringify(ap)); } catch (e) {} };
function buildAutopilot(){
  $("#apT").checked = ap.on; $("#apOpts").hidden = !ap.on; $("#apAI").checked = ap.ai;
  const ls = $("#apLook"); ls.innerHTML = "";
  LOOKS.forEach(([name], idx) => { if (!idx) return; const b = document.createElement("button"); b.textContent = name; b.setAttribute("aria-pressed", ap.look === idx); b.onclick = () => { ap.look = idx; saveAp(); buildAutopilot(); }; ls.append(b); });
  const fs = $("#apFmt"); fs.innerHTML = "";
  [null, ...SOCIAL].forEach(f => { const b = document.createElement("button"); b.textContent = f ? `${f.pf} ${f.name.toLowerCase()}` : "Aucun recadrage"; b.setAttribute("aria-pressed", (ap.fmt || "") === (f ? f.id : "")); b.onclick = () => { ap.fmt = f ? f.id : ""; saveAp(); buildAutopilot(); }; fs.append(b); });
  $("#apAIRow").hidden = !sampleFn;
}
$("#apT").addEventListener("change", () => { ap.on = $("#apT").checked; saveAp(); buildAutopilot(); });
$("#apAI").addEventListener("change", () => { ap.ai = $("#apAI").checked; saveAp(); });
function runAutopilot(){
  if (!ap.on || !prev) return;
  const L = LOOKS[ap.look];
  if (L && ap.look !== 1){ stepLabel = "Pilote auto : style " + L[0]; params = clampP(L[1](autoP)); activeLook = ap.look; markLooks(); syncUI(); schedule(); commit(); }
  const f = ap.fmt ? SOCIAL.find(q => q.id === ap.fmt) : null;
  if (f) setFormat(f);
  if (ap.ai && sampleFn) setTimeout(() => aiCall("analyze"), 400);
}
setTimeout(buildAutopilot, 1200);
resumeJob();

$$(".tab").forEach(t => t.addEventListener("click", () => { if (t.dataset.tab === "auto") buildAutopilot(); }));
/* ---------- Share links via Google Drive ---------- */
var mcpApi = null, mcpFileArgs = false;
const DRIVE = "Google Drive", FOLDER_T = "application/vnd.google-apps.folder";
const DV_ERR = c => ({needs_reauth:"Connexion Google expirée : réessaie pour te reconnecter.", tool_error:"Google Drive a refusé l’envoi, réessaie.", not_granted:"Connexion Google impossible.", consent_required:"Autorise l’accès à Google Drive pour continuer.", rate_limited:"Trop d’envois en même temps, réessaie dans un instant.", server_unavailable:"Google Drive ne répond pas, réessaie dans un instant.", cancelled:"Envoi annulé."}[c] || "L’envoi vers Google Drive n’a pas abouti.");
(async () => {
  try {
    if (window.artcraftRuntime && window.artcraftRuntime.use) mcpApi = await window.artcraftRuntime.use("mcp");
    if (mcpApi){ const l = await mcpApi.listTools().catch(() => null); mcpFileArgs = !!(l && l.fileArgs); }
  } catch (e) { mcpApi = null; }
  refreshDrive();
})();
function refreshDrive(){
  $$(".dv-off").forEach(e => e.hidden = !!mcpApi);
  $$(".dv-on").forEach(e => e.hidden = !mcpApi);
}
async function driveCall(tool, input){ const r = await mcpApi.callTool(DRIVE, tool, input, {cache:false}); return (r && r.payload) || {}; }
const blobB64 = b => new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result).split(",")[1]); rd.onerror = rej; rd.readAsDataURL(b); });
async function shrinkBlob(blob, maxBytes){
  const c = await decodeFile(blob); let scale = 1, out = blob;
  for (let i=0; i<6 && out.size > maxBytes; i++){
    scale *= 0.8; const t = document.createElement("canvas"); t.width = Math.round(c.width*scale); t.height = Math.round(c.height*scale);
    const x = t.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(c, 0, 0, t.width, t.height);
    out = await toBlob(t, "image/jpeg", 0.88);
  }
  return out;
}
async function uploadPhoto(parentId, name, blob){
  const type = blob.type || "image/jpeg";
  const input = {title:name, contentMimeType:type, disableConversionToGoogleType:true, parentId};
  if (mcpFileArgs && blob.size <= 16*1024*1024) input.base64Content = {$file:{data:blob, name, type}};
  else {
    let b = blob;
    if (b.size > 700*1024){ b = await shrinkBlob(b, 700*1024); input.contentMimeType = b.type || "image/jpeg"; input.title = name.replace(/\.png$/i, ".jpg"); }
    input.base64Content = await blobB64(b);
  }
  return driveCall("create_file", input);
}
async function ensureRoot(force){
  let id = null; try { id = force ? null : localStorage.getItem("acp-drive-root"); } catch (e) {}
  if (id) return id;
  const f = await driveCall("create_file", {title:"Art Craft Pictures", contentMimeType:FOLDER_T});
  if (!f.id) throw {code:"tool_error"};
  try { localStorage.setItem("acp-drive-root", f.id); } catch (e) {}
  return f.id;
}
async function makeAlbum(title){
  let root = await ensureRoot(false);
  try { const f = await driveCall("create_file", {title, contentMimeType:FOLDER_T, parentId:root}); if (f.id) return f; } catch (e) { if (!e || e.code !== "tool_error") throw e; }
  root = await ensureRoot(true);
  const f = await driveCall("create_file", {title, contentMimeType:FOLDER_T, parentId:root});
  if (!f.id) throw {code:"tool_error"};
  return f;
}
function albumsList(){ try { return JSON.parse(localStorage.getItem("acp-albums") || "[]"); } catch (e) { return []; } }
function saveAlbum(a){ const l = albumsList(); l.unshift(a); try { localStorage.setItem("acp-albums", JSON.stringify(l.slice(0, 30))); } catch (e) {} renderAlbums(); }
function copyText(text, btn){
  const done = () => { const o = btn.textContent; btn.textContent = "Lien copié"; setTimeout(() => btn.textContent = o, 1800); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallback());
  else fallback();
  function fallback(){ const i = document.createElement("textarea"); i.value = text; document.body.append(i); i.select(); try { document.execCommand("copy"); done(); } catch (e) {} i.remove(); }
}
function renderAlbums(){
  const host = $("#albums"); if (!host) return; host.innerHTML = "";
  const l = albumsList();
  if (!l.length){ host.innerHTML = '<p class="fhint">Aucun album partagé pour l’instant.</p>'; return; }
  for (const a of l){
    const row = document.createElement("div"); row.className = "proj";
    const info = document.createElement("div"); info.className = "pinfo";
    const n = document.createElement("span"); n.textContent = a.title;
    const t = document.createElement("small"); t.textContent = `${plural(a.count, "photo")} · ${timeAgo(a.t)}${a.mails ? " · partagé avec " + a.mails : ""}`;
    info.append(n, t);
    const acts = document.createElement("div"); acts.className = "pacts";
    const c = document.createElement("button"); c.className = "ghost sm"; c.textContent = "Copier le lien"; c.onclick = () => copyText(a.url, c);
    const o = document.createElement("a"); o.className = "ghost sm"; o.textContent = "Ouvrir"; o.href = a.url; o.target = "_blank"; o.rel = "noopener";
    acts.append(c, o); row.append(info, acts); host.append(row);
  }
}
function makeDriveBox(host, getItems, defTitle){
  host.innerHTML = `<div class="sub">Partager par lien · Google Drive</div>
    <div class="dv-off">
      <p class="fhint">Le lien Google Drive automatique demande la connexion Google d’Art craft (identifiant client à configurer une fois, comme pour les shorts). En attendant, partage tes photos avec le menu de ton appareil :</p>
      <button class="primary dv-prep" style="width:100%;height:44px">Préparer le partage</button>
      <button class="ghost dv-native" hidden style="width:100%;margin-top:8px">Partager…</button>
      <p class="fhint dv-nmsg" role="status"></p>
      <p class="fhint">Dans le menu, choisis Drive pour les ranger dans ton Google Drive et obtenir un lien, ou WhatsApp, Messages, Instagram…</p>
    </div>
    <div class="dv-on" hidden>
      <input class="txt dv-album" maxlength="80" aria-label="Nom de l’album">
      <input class="txt dv-mails" type="text" inputmode="email" placeholder="E-mails à inviter (facultatif, séparés par des virgules)" aria-label="E-mails à inviter">
      <button class="primary dv-go">Créer le lien de partage</button>
      <p class="fhint dv-msg" role="status"></p>
      <div class="dv-res" hidden>
        <input class="txt dv-link" readonly aria-label="Lien de partage">
        <div class="btn-row"><button class="ghost dv-copy">Copier le lien</button><a class="ghost dv-open" target="_blank" rel="noopener">Ouvrir dans Drive</a></div>
        <button class="ghost dv-share" hidden style="width:100%;margin-top:8px">Envoyer le lien…</button>
        <p class="fhint">Les personnes invitées par e-mail ouvrent le lien directement. Pour un lien ouvert à tout le monde : dans Drive, Partager → Accès général → « Tous les utilisateurs disposant du lien ».</p>
      </div>
    </div>`;
  const q = s => host.querySelector(s);
  host._reset = () => { q(".dv-album").value = defTitle(); q(".dv-res").hidden = true; q(".dv-msg").textContent = ""; q(".dv-native").hidden = true; q(".dv-nmsg").textContent = ""; host._files = null; };
  q(".dv-prep").onclick = async () => {
    const btn = q(".dv-prep"), msg = q(".dv-nmsg"); btn.disabled = true; q(".dv-native").hidden = true; msg.textContent = "Préparation des photos…";
    try {
      const items = await getItems();
      if (!items.length) throw {code:"empty"};
      const files = items.map(it => new File([it.blob], it.name, {type: it.blob.type || "image/jpeg"}));
      if (canShareFiles(files)){
        host._files = files; const nb = q(".dv-native"); nb.hidden = false; nb.textContent = `Partager ${plural(files.length, "photo")}…`;
        msg.textContent = "C’est prêt : touche Partager.";
      } else {
        if (files.length === 1) anchorDownload(files[0], files[0].name);
        else if (window.JSZip){ const zip = new JSZip(); files.forEach(f => zip.file(f.name, f)); anchorDownload(await zip.generateAsync({type:"blob", compression:"STORE"}), `art-craft-pictures-${files.length}-photos.zip`); }
        msg.textContent = "Ton navigateur ne propose pas le partage direct : les photos sont téléchargées. Dépose-les sur drive.google.com pour créer un lien.";
      }
    } catch (e) { msg.textContent = e && e.code === "empty" ? "Aucune photo prête à partager." : "La préparation a échoué, réessaie."; }
    btn.disabled = false;
  };
  q(".dv-native").onclick = () => {
    if (!host._files) return;
    navigator.share({files: host._files, title: defTitle()}).then(() => { q(".dv-nmsg").textContent = "Partagé."; })
      .catch(e => { if (!e || e.name !== "AbortError") q(".dv-nmsg").textContent = "Le partage a échoué : essaie avec moins de photos à la fois."; });
  };
  host._reset();
  q(".dv-go").onclick = async () => {
    if (!mcpApi) return;
    const btn = q(".dv-go"), msg = q(".dv-msg");
    const raw = q(".dv-mails").value.split(/[\s,;]+/).map(s => s.trim()).filter(Boolean);
    const mails = raw.filter(m => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m));
    if (raw.length !== mails.length){ msg.textContent = "Une adresse e-mail n’est pas valide."; return; }
    btn.disabled = true; q(".dv-res").hidden = true;
    try {
      msg.textContent = "Préparation des photos…";
      const items = await getItems();
      if (!items.length) throw {code:"empty"};
      const title = q(".dv-album").value.trim() || defTitle();
      msg.textContent = "Création de l’album sur Google Drive…";
      const folder = await makeAlbum(title);
      let up = 0;
      for (const it of items){
        msg.textContent = `Envoi de la photo ${up+1} sur ${items.length}…`;
        await uploadPhoto(folder.id, it.name, it.blob); up++;
      }
      for (const m of mails){ msg.textContent = `Invitation de ${m}…`; await driveCall("share_file", {fileId:folder.id, role:"reader", emailAddress:m}); }
      const url = folder.viewUrl || `https://drive.google.com/drive/folders/${folder.id}`;
      q(".dv-link").value = url; q(".dv-open").href = url; q(".dv-res").hidden = false;
      q(".dv-copy").onclick = () => copyText(url, q(".dv-copy"));
      const sh = q(".dv-share"); sh.hidden = !navigator.share;
      sh.onclick = () => navigator.share({title, text:`${title} · photos Gravity Basketball`, url}).catch(() => {});
      msg.textContent = `${plural(up, "photo")} dans l’album « ${title} ».` + (mails.length ? ` Invitation envoyée à ${mails.join(", ")}.` : "");
      saveAlbum({title, url, count:up, t:Date.now(), mails: mails.join(", ")});
      if (src) logStep("Partagé sur Google Drive", null);
    } catch (e) {
      msg.textContent = e && e.code === "empty" ? "Aucune photo prête à partager." : DV_ERR(e && e.code);
      if (e && ["server_not_connected","server_not_found","not_granted","capability_disabled","capability_removed","not_in_manifest"].includes(e.code)) q(".dv-off").hidden = false;
    }
    btn.disabled = false;
  };
}
async function currentExport(){
  const k = src.width / prev.w;
  if (cutActive() && bgOpt.bg === "transparent" && fmt === "jpg") fmt = "png";
  let final = crop ? await exportCanvas(src, params, k, crop.f, crop, true) : await renderFull(src, params, k, scale);
  if (!crop) lightCanvas(final, cut ? cut.alphaC : null);
  if (!crop && cutActive()) final = composeCut(final, cut.alphaC);
  const mime = FMT_MIME[fmt];
  const blob = await toBlob(final, mime, fmtQuality(fmt, crop ? RECO[crop.f.rec].q : 0));
  if (!blob) throw {code:"empty"};
  const name = crop ? `${fileBase}-${crop.f.id}.${fmt}` : `${fileBase}-artcraft${scale > 1 ? "-x" + scale : ""}.${fmt}`;
  return [{name, blob}];
}
const today = () => new Date().toLocaleDateString("fr-FR", {day:"numeric", month:"long", year:"numeric"});
makeDriveBox($("#driveOne"), async () => src ? currentExport() : [], () => `Gravity Basketball · ${fileBase} · ${today()}`);
makeDriveBox($("#driveLot"), () => jobResults(), () => `Gravity Basketball · lot du ${today()}`);
$("#exportBtn").addEventListener("click", () => $("#driveOne")._reset());
$("#jobPill").addEventListener("click", () => { $("#driveLot").hidden = !(job && job.finished); });
refreshDrive(); renderAlbums();

/* ---------- Plain-browser fallbacks ---------- */
function anchorDownload(blob, name){
  try { const url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = name; a.rel = "noopener"; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 8000); return true; } catch (e) { return false; }
}
function canShareFiles(files){ try { return !!(navigator.canShare && navigator.share && navigator.canShare({files})); } catch (e) { return false; } }
function browserSave(blob, name, canvas, mime){
  anchorDownload(blob, name);
  showFallback(canvas, mime);
  $("#exportMsg").textContent = "Téléchargement lancé. S’il ne démarre pas, appuie longuement sur l’image pour l’enregistrer.";
  const f = new File([blob], name, {type: blob.type || mime});
  const sb = $("#shareNative"); sb.hidden = !canShareFiles([f]);
  sb.onclick = () => navigator.share({files:[f], title:name}).catch(() => {});
}
async function browserBatchSave(){
  const msg = $("#bMsg");
  if (window.JSZip){
    msg.textContent = "Création du fichier ZIP…";
    try { const zip = new JSZip(); bResults.forEach(r => zip.file(r.name, r.blob)); anchorDownload(await zip.generateAsync({type:"blob", compression:"STORE"}), zipName()); } catch (e) {}
  }
  await showBFallback();
  msg.textContent = (window.JSZip ? "Téléchargement du ZIP lancé. " : "") + "Tu peux aussi partager les photos ou appuyer longuement sur chacune pour l’enregistrer.";
  const files = bResults.map(r => new File([r.blob], r.name, {type: r.blob.type || "image/jpeg"}));
  const sb = $("#bShare"); sb.hidden = !canShareFiles(files);
  sb.onclick = () => navigator.share({files, title:"Photos Gravity Basketball"}).catch(e => { if (!e || e.name !== "AbortError") msg.textContent = "Partage impossible avec autant de photos : essaie par petits groupes."; });
}
/* ---------- Artistic filters ---------- */
function artLum(s, n){ const L = new Float32Array(n); for (let i=0, j=0; i<n; i++, j+=4) L[i] = (0.2126*s[j] + 0.7152*s[j+1] + 0.0722*s[j+2])/255; return L; }
function artSobel(L, w, h){
  const E = new Float32Array(w*h);
  for (let y=1; y<h-1; y++) for (let x=1; x<w-1; x++){
    const i = y*w+x;
    const gx = -L[i-w-1] - 2*L[i-1] - L[i+w-1] + L[i-w+1] + 2*L[i+1] + L[i+w+1];
    const gy = -L[i-w-1] - 2*L[i-w] - L[i-w+1] + L[i+w-1] + 2*L[i+w] + L[i+w+1];
    E[i] = Math.sqrt(gx*gx + gy*gy)/4;
  }
  return E;
}
function artKuwa(s, w, h, r){
  const W1 = w+1, n1 = W1*(h+1);
  const SR = new Float64Array(n1), SG = new Float64Array(n1), SB = new Float64Array(n1), SL = new Float64Array(n1), SQ = new Float64Array(n1);
  for (let y=0; y<h; y++){
    let ar=0, ag=0, ab=0, al=0, aq=0;
    for (let x=0; x<w; x++){
      const j = (y*w+x)*4, l = 0.2126*s[j] + 0.7152*s[j+1] + 0.0722*s[j+2];
      ar += s[j]; ag += s[j+1]; ab += s[j+2]; al += l; aq += l*l;
      const t = (y+1)*W1 + x+1, u = y*W1 + x+1;
      SR[t] = SR[u] + ar; SG[t] = SG[u] + ag; SB[t] = SB[u] + ab; SL[t] = SL[u] + al; SQ[t] = SQ[u] + aq;
    }
  }
  const o = new Uint8ClampedArray(s.length);
  const R = (A, x0, y0, x1, y1) => A[(y1+1)*W1 + x1+1] - A[y0*W1 + x1+1] - A[(y1+1)*W1 + x0] + A[y0*W1 + x0];
  for (let y=0; y<h; y++) for (let x=0; x<w; x++){
    let best = 1e30, br=0, bg=0, bb=0;
    for (let q=0; q<4; q++){
      const x0 = q&1 ? x : Math.max(0, x-r), x1 = q&1 ? Math.min(w-1, x+r) : x;
      const y0 = q&2 ? y : Math.max(0, y-r), y1 = q&2 ? Math.min(h-1, y+r) : y;
      const c = (x1-x0+1)*(y1-y0+1), m = R(SL, x0, y0, x1, y1)/c, v = R(SQ, x0, y0, x1, y1)/c - m*m;
      if (v < best){ best = v; br = R(SR, x0, y0, x1, y1)/c; bg = R(SG, x0, y0, x1, y1)/c; bb = R(SB, x0, y0, x1, y1)/c; }
    }
    const j = (y*w+x)*4; o[j] = br; o[j+1] = bg; o[j+2] = bb; o[j+3] = s[j+3];
  }
  return o;
}
function artSat(o, f){ for (let j=0; j<o.length; j+=4){ const l = 0.2126*o[j] + 0.7152*o[j+1] + 0.0722*o[j+2]; o[j] = l + (o[j]-l)*f; o[j+1] = l + (o[j+1]-l)*f; o[j+2] = l + (o[j+2]-l)*f; } return o; }
function artOil(s, w, h, c){ return artSat(artKuwa(s, w, h, Math.max(2, Math.round(3*c.k))), 1.15); }
function artWater(s, w, h, c){
  const o = artKuwa(s, w, h, Math.max(2, Math.round(2*c.k))), n = w*h;
  const L = artLum(o, n), E = artSobel(L, w, h);
  for (let i=0, j=0; i<n; i++, j+=4){
    const ed = 1 - Math.min(0.45, E[i]*1.6), gr = hash((c.oy + (i/w|0))*c.FW + c.ox + i%w)*22;
    for (let ch=0; ch<3; ch++){ let v = 255 - (255 - o[j+ch])*0.82; v = v*ed + gr; o[j+ch] = v; }
  }
  return artSat(o, 0.85);
}
function artSketch(s, w, h, c){
  const n = w*h, L = artLum(s, n), inv = new Float32Array(n);
  for (let i=0; i<n; i++) inv[i] = 1 - L[i];
  const B = blur(inv, w, h, Math.max(2, Math.round(4*c.k)));
  const o = new Uint8ClampedArray(s.length);
  for (let i=0, j=0; i<n; i++, j+=4){
    let v = Math.min(1, L[i]/Math.max(0.02, 1 - B[i])); v = Math.pow(v, 1.7);
    o[j] = 248*v; o[j+1] = 242*v; o[j+2] = 230*v; o[j+3] = s[j+3];
  }
  return o;
}
function artComic(s, w, h, c){
  const n = w*h, L = artLum(s, n), Lb = blur(L, w, h, Math.max(1, Math.round(c.k))), E = artSobel(Lb, w, h);
  const o = artSat(Uint8ClampedArray.from(s), 1.35), lv = 5, th = 0.11;
  for (let i=0, j=0; i<n; i++, j+=4){
    if (E[i] > th){ o[j] = o[j+1] = o[j+2] = 18; continue; }
    for (let ch=0; ch<3; ch++) o[j+ch] = Math.round(o[j+ch]/255*(lv-1))/(lv-1)*255;
  }
  return o;
}
function artCells(s, w, h, c, size){
  const gx0 = Math.floor(c.ox/size), gy0 = Math.floor(c.oy/size), gx1 = Math.floor((c.ox + w - 1)/size), gy1 = Math.floor((c.oy + h - 1)/size);
  const cw = gx1 - gx0 + 1, ch = gy1 - gy0 + 1, A = new Float32Array(cw*ch*4);
  for (let y=0; y<h; y++){ const cy = Math.floor((c.oy + y)/size) - gy0;
    for (let x=0; x<w; x++){ const cx = Math.floor((c.ox + x)/size) - gx0, k = (cy*cw + cx)*4, j = (y*w+x)*4; A[k] += s[j]; A[k+1] += s[j+1]; A[k+2] += s[j+2]; A[k+3]++; } }
  for (let k=0; k<A.length; k+=4) if (A[k+3]){ A[k] /= A[k+3]; A[k+1] /= A[k+3]; A[k+2] /= A[k+3]; }
  return {A, cw, gx0, gy0};
}
function artHalftone(s, w, h, c){
  const size = Math.max(4, Math.round(7*c.k)), {A, cw, gx0, gy0} = artCells(s, w, h, c, size), o = new Uint8ClampedArray(s.length);
  for (let y=0; y<h; y++) for (let x=0; x<w; x++){
    const gx = c.ox + x, gy = c.oy + y, cx = Math.floor(gx/size), cy = Math.floor(gy/size), k = ((cy-gy0)*cw + (cx-gx0))*4;
    const r = A[k], g = A[k+1], b = A[k+2], l = (0.2126*r + 0.7152*g + 0.0722*b)/255;
    const rad = size*0.62*Math.sqrt(1 - l), dx = gx - (cx+0.5)*size, dy = gy - (cy+0.5)*size, d = Math.sqrt(dx*dx + dy*dy);
    const a = Math.max(0, Math.min(1, rad - d + 0.5)), j = (y*w+x)*4, mx = Math.max(r, g, b) || 1, boost = Math.min(1.6, 255/mx);
    o[j] = 250 + (Math.min(255, r*boost*0.85) - 250)*a; o[j+1] = 244 + (Math.min(255, g*boost*0.85) - 244)*a; o[j+2] = 228 + (Math.min(255, b*boost*0.85) - 228)*a; o[j+3] = s[j+3];
  }
  return o;
}
function artPixel(s, w, h, c){
  const size = Math.max(3, Math.round(10*c.k)), {A, cw, gx0, gy0} = artCells(s, w, h, c, size), o = new Uint8ClampedArray(s.length), lv = 7;
  for (let y=0; y<h; y++) for (let x=0; x<w; x++){
    const k = ((Math.floor((c.oy+y)/size)-gy0)*cw + (Math.floor((c.ox+x)/size)-gx0))*4, j = (y*w+x)*4;
    for (let ch=0; ch<3; ch++) o[j+ch] = Math.round(A[k+ch]/255*(lv-1))/(lv-1)*255;
    o[j+3] = s[j+3];
  }
  return o;
}
function artGrad(stops, t){ for (let i=1; i<stops.length; i++) if (t <= stops[i][0]){ const [a, ca] = stops[i-1], [b, cb] = stops[i], f = (t-a)/(b-a); return [ca[0]+(cb[0]-ca[0])*f, ca[1]+(cb[1]-ca[1])*f, ca[2]+(cb[2]-ca[2])*f]; } return stops[stops.length-1][1]; }
function artDuo(s, w, h, c){
  const st = [[0,[18,22,50]],[0.55,[242,107,29]],[1,[255,238,218]]], o = new Uint8ClampedArray(s.length);
  for (let j=0; j<s.length; j+=4){ const t = (0.2126*s[j] + 0.7152*s[j+1] + 0.0722*s[j+2])/255, col = artGrad(st, t); o[j] = col[0]; o[j+1] = col[1]; o[j+2] = col[2]; o[j+3] = s[j+3]; }
  return o;
}
function artNeon(s, w, h, c){
  const n = w*h, L = artLum(s, n), E = artSobel(blur(L, w, h, Math.max(1, Math.round(c.k))), w, h), G = blur(E, w, h, Math.max(2, Math.round(3*c.k)));
  const o = new Uint8ClampedArray(s.length), D = (c.FW + c.FH) || 1;
  for (let i=0, j=0; i<n; i++, j+=4){
    const x = i%w, y = i/w|0, t = ((c.ox+x) + (c.oy+y))/D, a = Math.min(1, E[i]*4.5 + G[i]*3);
    const cr = 255 + (33-255)*t, cg = 43 + (230-43)*t, cb = 214 + (255-214)*t, base = 0.12;
    o[j] = s[j]*base*(1-a) + cr*a; o[j+1] = s[j+1]*base*(1-a) + cg*a; o[j+2] = s[j+2]*base*(1-a) + cb*a; o[j+3] = s[j+3];
  }
  return o;
}
function artGlitch(s, w, h, c){
  const o = new Uint8ClampedArray(s.length), bh = Math.max(3, Math.round(14*c.k)), d = Math.max(1, Math.round(4*c.k)), sl = Math.max(1, Math.round(2*c.k));
  for (let y=0; y<h; y++){
    const band = Math.floor((c.oy + y)/bh), r1 = hash(band*7919 + 13) + 0.5, r2 = hash(band*104729 + 7);
    const sh = r1 > 0.78 ? Math.round(r2*120*c.k) : 0, dark = Math.floor((c.oy + y)/sl) % 2 ? 0.88 : 1;
    for (let x=0; x<w; x++){
      const xr = Math.max(0, Math.min(w-1, x - d + sh)), xg = Math.max(0, Math.min(w-1, x + sh)), xb = Math.max(0, Math.min(w-1, x + d + sh)), j = (y*w+x)*4, row = y*w;
      o[j] = s[(row+xr)*4]*dark; o[j+1] = s[(row+xg)*4+1]*dark; o[j+2] = s[(row+xb)*4+2]*dark; o[j+3] = s[j+3];
    }
  }
  return o;
}
function artVintage(s, w, h, c){
  const o = new Uint8ClampedArray(s.length), FW = c.FW, FH = c.FH, diag = Math.hypot(FW, FH);
  for (let y=0; y<h; y++) for (let x=0; x<w; x++){
    const j = (y*w+x)*4, gx = c.ox + x, gy = c.oy + y;
    let r = s[j]*0.9 + 22, g = s[j+1]*0.86 + 16, b = s[j+2]*0.74 + 30;
    const lk = Math.max(0, 0.6 - Math.hypot(gx - FW*0.95, gy - FH*0.05)/diag*1.4)*1.3;
    r = 255 - (255-r)*(1-lk); g = 255 - (255-g)*(1-lk*0.55); b = 255 - (255-b)*(1-lk*0.15);
    const vg = 1 - 0.32*Math.pow(Math.hypot(gx - FW/2, gy - FH/2)/(diag/2), 2.2), gr = hash(gy*FW + gx)*26;
    o[j] = r*vg + gr; o[j+1] = g*vg + gr; o[j+2] = b*vg + gr; o[j+3] = s[j+3];
  }
  return o;
}
function artDreamy(s, w, h, c){
  const n = w*h, r = Math.max(3, Math.round(8*c.k)), ch = [0,1,2].map(q => { const a = new Float32Array(n); for (let i=0; i<n; i++) a[i] = s[i*4+q]/255; return blur(a, w, h, r); });
  const o = new Uint8ClampedArray(s.length);
  for (let i=0, j=0; i<n; i++, j+=4) for (let q=0; q<3; q++){ const a = s[j+q]/255, b = ch[q][i]*0.9; o[j+q] = (1 - (1-a)*(1-b))*255*0.96; }
  for (let j=3; j<o.length; j+=4) o[j] = s[j];
  return artSat(o, 1.18);
}
function artNoir(s, w, h, c){
  const o = new Uint8ClampedArray(s.length);
  for (let j=0; j<s.length; j+=4){ let v = (0.6*s[j] + 0.35*s[j+1] + 0.05*s[j+2])/255; v = v < 0.5 ? 2*v*v : 1 - 2*(1-v)*(1-v); v = Math.max(0, (v - 0.06)/0.94); o[j] = o[j+1] = o[j+2] = v*255; o[j+3] = s[j+3]; }
  return o;
}
function artCross(s, w, h, c){
  const o = new Uint8ClampedArray(s.length), sc = v => { v /= 255; return (v < 0.5 ? 2*v*v : 1 - 2*(1-v)*(1-v))*255; };
  for (let j=0; j<s.length; j+=4){ o[j] = sc(s[j])*0.95 + 12; o[j+1] = sc(s[j+1])*0.6 + s[j+1]*0.4; o[j+2] = s[j+2]*0.6 + 70; o[j+3] = s[j+3]; }
  return artSat(o, 1.3);
}
function artEngrave(s, w, h, c){
  const o = new Uint8ClampedArray(s.length), p = Math.max(3, 6*c.k);
  for (let y=0; y<h; y++) for (let x=0; x<w; x++){
    const j = (y*w+x)*4, l = (0.2126*s[j] + 0.7152*s[j+1] + 0.0722*s[j+2])/255;
    const v = 0.5 + 0.5*Math.sin(2*Math.PI*((c.oy+y) + 0.35*(c.ox+x))/p), ink = ss(-0.12, 0.12, (1 - l) - v);
    o[j] = 245 + (28-245)*ink; o[j+1] = 238 + (24-238)*ink; o[j+2] = 224 + (22-224)*ink; o[j+3] = s[j+3];
  }
  return o;
}
const ART = [
  {id:0, name:"Aucun", m:k => 0, f:null},
  {id:1, name:"Peinture à l’huile", m:k => Math.ceil(3*k) + 2, f:artOil},
  {id:2, name:"Aquarelle", m:k => Math.ceil(2*k) + 3, f:artWater},
  {id:3, name:"Croquis crayon", m:k => Math.ceil(14*k) + 2, f:artSketch},
  {id:4, name:"Bande dessinée", m:k => Math.ceil(4*k) + 3, f:artComic},
  {id:5, name:"Pop art", m:k => Math.ceil(7*k) + 2, f:artHalftone},
  {id:6, name:"Duotone Gravity", m:k => 0, f:artDuo},
  {id:7, name:"Néon contours", m:k => Math.ceil(12*k) + 3, f:artNeon},
  {id:8, name:"Glitch", m:k => Math.ceil(130*k) + 6, f:artGlitch},
  {id:9, name:"Pixel art", m:k => Math.ceil(10*k) + 2, f:artPixel},
  {id:10, name:"Film vintage", m:k => 0, f:artVintage},
  {id:11, name:"Rêve lumineux", m:k => Math.ceil(26*k) + 2, f:artDreamy},
  {id:12, name:"Noir dramatique", m:k => 0, f:artNoir},
  {id:13, name:"Cross-process", m:k => 0, f:artCross},
  {id:14, name:"Gravure", m:k => 0, f:artEngrave},
];
function applyArt(img, p, k, ox, oy, FW, FH){
  const A = p && p.art ? ART[p.art] : null; if (!A || !A.f) return img;
  const mix = (p.artMix == null ? 100 : p.artMix)/100; if (mix <= 0) return img;
  const W = img.width, H = img.height, d = img.data, M = A.m(k), T = 640;
  const c0 = {k, FW: FW || W, FH: FH || H}; ox = ox || 0; oy = oy || 0;
  const out = new Uint8ClampedArray(d.length);
  for (let ty=0; ty<H; ty+=T) for (let tx=0; tx<W; tx+=T){
    const x0 = Math.max(0, tx-M), y0 = Math.max(0, ty-M), x1 = Math.min(W, tx+T+M), y1 = Math.min(H, ty+T+M), w = x1-x0, h = y1-y0;
    const s = new Uint8ClampedArray(w*h*4);
    for (let y=0; y<h; y++) s.set(d.subarray(((y0+y)*W + x0)*4, ((y0+y)*W + x1)*4), y*w*4);
    const r = A.f(s, w, h, {k, ox: ox + x0, oy: oy + y0, FW: c0.FW, FH: c0.FH});
    const cx1 = Math.min(W, tx+T), cy1 = Math.min(H, ty+T);
    for (let y=ty; y<cy1; y++) out.set(r.subarray(((y-y0)*w + (tx-x0))*4, ((y-y0)*w + (cx1-x0))*4), (y*W + tx)*4);
  }
  for (let j=0; j<d.length; j+=4){ d[j] += (out[j]-d[j])*mix; d[j+1] += (out[j+1]-d[j+1])*mix; d[j+2] += (out[j+2]-d[j+2])*mix; }
  return img;
}

/* large lots: split downloads into parts */
let zipBase = "";
const zipName = () => (zipBase || `art-craft-pictures-${bResults.length}-photos`) + ".zip";
async function saveBatch(){
  const all = await jobResults();
  if (!all.length){ $("#bMsg").textContent = "Aucune photo à télécharger dans ce lot."; return; }
  const parts = []; let cur = [], size = 0;
  for (const r of all){ if (cur.length && (size + r.blob.size > 300e6 || cur.length >= 100)){ parts.push(cur); cur = []; size = 0; } cur.push(r); size += r.blob.size; }
  if (cur.length) parts.push(cur);
  const host = $("#bParts"); host.innerHTML = "";
  if (parts.length === 1){ bResults = parts[0]; zipBase = ""; return saveBatchCore(); }
  $("#bMsg").textContent = `Lot de ${all.length} photos : téléchargement en ${parts.length} parties pour ménager la mémoire de l’appareil.`;
  parts.forEach((pt, k) => {
    const b = document.createElement("button"); b.className = "ghost"; b.style.width = "100%"; b.style.marginTop = "6px";
    b.textContent = `Partie ${k+1} sur ${parts.length} · ${plural(pt.length, "photo")}`;
    b.onclick = async () => { b.disabled = true; bResults = pt; zipBase = `art-craft-pictures-partie-${k+1}-sur-${parts.length}`; await saveBatchCore(); b.textContent = `Partie ${k+1} : téléchargée`; b.disabled = false; };
    host.append(b);
  });
}

/* ---------- AI background generator ---------- */
const AIBG_KEY = "acp-aibg", aiBgImg = {};
let aiBgs = []; try { aiBgs = JSON.parse(localStorage.getItem(AIBG_KEY) || "[]"); } catch (e) { aiBgs = []; }
function aiBgImage(b){
  if (aiBgImg[b.id]) return aiBgImg[b.id];
  const im = new Image(); im.onload = () => { bgCache.key = ""; buildBgTiles(); if (cut) schedule(); };
  im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(b.svg); aiBgImg[b.id] = im; return im;
}
function aiBgEntry(b){
  return {id:"ai-" + b.id, name:"IA · " + b.name, text:"#FFFFFF", halo:"#FF7A1A", draw:(x, W, H) => {
    const im = aiBgImage(b);
    if (!im.complete || !im.naturalWidth){ x.fillStyle = "#14121C"; x.fillRect(0, 0, W, H); return; }
    const s = Math.max(W/im.naturalWidth, H/im.naturalHeight), w = im.naturalWidth*s, h = im.naturalHeight*s;
    x.drawImage(im, (W - w)/2, (H - h)/2, w, h);
  }};
}
aiBgs.forEach(b => GBG.push(aiBgEntry(b)));
function cleanSvg(t){
  const m = String(t).match(/<svg[\s\S]*<\/svg>/i); if (!m) return null;
  let s = m[0].replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "").replace(/(xlink:)?href\s*=\s*("https?:[^"]*"|'https?:[^']*')/gi, "");
  if (!/xmlns=/.test(s)) s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
  if (!/\swidth=/.test(s.slice(0, s.indexOf(">")))) s = s.replace(/<svg/i, '<svg width="1600" height="1000"');
  return s.length < 400000 ? s : null;
}
$("#aiBgGo").onclick = async () => {
  if (!sampleFn) return;
  const prm = $("#aiBgPrompt").value.trim(), msg = $("#aiBgMsg"), btn = $("#aiBgGo");
  if (!prm){ $("#aiBgPrompt").focus(); return; }
  btn.disabled = true; msg.textContent = "Claude dessine ton fond… (30 à 60 secondes)";
  const prompt = `Tu es un illustrateur. Crée un fond d’affiche sportive au format SVG pour la marque Gravity Basketball, d’après cette description : « ${prm} ».
Contraintes : un seul élément <svg> avec xmlns="http://www.w3.org/2000/svg", width="1600", height="1000" et viewBox="0 0 1600 1000". Uniquement des formes vectorielles, des dégradés et des filtres SVG : pas d’image externe, pas de texte, pas de personnage, pas de script, pas de foreignObject. La zone centrale reste un peu plus calme car un joueur détouré y sera placé. Style riche, lumineux et professionnel, avec de la profondeur (au moins 30 formes).
Réponds uniquement avec le code SVG, sans explication ni bloc de code.`;
  try {
    const r = await sampleFn(prompt, {modelTier:"default", onText: ({text}) => { msg.textContent = `Claude dessine ton fond… ${Math.round(text.length/1000)} ko`; }});
    const svg = cleanSvg(r.text);
    if (!svg) throw {code:"bad_svg"};
    await new Promise((res, rej) => { const t = new Image(); t.onload = () => t.naturalWidth ? res() : rej({code:"bad_svg"}); t.onerror = () => rej({code:"bad_svg"}); t.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
    const b = {id: Date.now().toString(36), name: prm.split(/\s+/).slice(0, 4).join(" "), svg};
    aiBgs.unshift(b); aiBgs = aiBgs.slice(0, 8);
    try { localStorage.setItem(AIBG_KEY, JSON.stringify(aiBgs)); } catch (e) {}
    GBG.push(aiBgEntry(b));
    bgOpt.bg = "ai-" + b.id; buildBgTiles(); refreshCutUI(); schedule();
    logStep("Fond IA : " + b.name, null);
    msg.textContent = "Fond créé et appliqué. Il reste disponible dans la liste des fonds.";
  } catch (e) {
    msg.textContent = e && e.code === "bad_svg" ? "Le dessin reçu n’est pas exploitable, réessaie avec une description plus simple." : AI_ERR(e && e.code);
  }
  btn.disabled = false;
};
$("#aiBgClear").onclick = () => {
  for (const b of aiBgs){ const i = GBG.findIndex(g => g.id === "ai-" + b.id); if (i >= 0) GBG.splice(i, 1); }
  if (String(bgOpt.bg).startsWith("ai-")) bgOpt.bg = "g2";
  aiBgs = []; try { localStorage.removeItem(AIBG_KEY); } catch (e) {}
  buildBgTiles(); schedule(); $("#aiBgMsg").textContent = "Fonds IA effacés.";
};

/* ---------- Art tab UI ---------- */
function buildArtTiles(){
  const host = $("#arts"); if (!host || !thumb) return; host.innerHTML = "";
  for (const A of ART){
    const b = document.createElement("button"); b.className = "look"; b.dataset.art = A.id;
    const c = document.createElement("canvas"); c.width = thumb.w; c.height = thumb.h;
    const x = c.getContext("2d"), out = x.createImageData(thumb.w, thumb.h);
    const p = {...params, art: A.id, artMix: 100};
    render(thumb, p, out); applyArt(out, p, thumb.k); x.putImageData(out, 0, 0);
    const sp = document.createElement("span"); sp.textContent = A.name;
    b.append(c, sp);
    b.onclick = () => { stepLabel = A.id ? "Filtre " + A.name : "Filtre retiré"; params = {...params, art: A.id}; if (A.id && !params.artMix) params.artMix = 100; syncArt(); schedule(); commit(); };
    host.append(b);
  }
  syncArt();
}
function syncArt(){
  $$("#arts .look").forEach(b => b.setAttribute("aria-pressed", +b.dataset.art === (params.art || 0)));
  $("#artMix").value = params.artMix == null ? 100 : params.artMix; $("#artMixO").textContent = $("#artMix").value + " %";
  $("#artMixRow").hidden = !params.art;
}
$("#artMix").addEventListener("input", () => { interacting = Date.now(); params.artMix = +$("#artMix").value; $("#artMixO").textContent = params.artMix + " %"; schedule(); });
$("#artMix").addEventListener("change", () => { stepLabel = `Intensité du filtre ${params.artMix} %`; commit(); });
$$(".tab").forEach(t => t.addEventListener("click", () => { if (t.dataset.tab === "art") buildArtTiles(); }));

var bArtSel = 0;
ART.forEach(A => { const b = document.createElement("button"); b.textContent = A.name; b.dataset.art = A.id; b.onclick = () => { bArtSel = A.id; invalidate(); refreshB(); }; $("#bArt").append(b); });
/* ---------- Big view: focus mode, pinch zoom, lightbox ---------- */
function zoomable(area, target, opts = {}){
  const st = {s:1, x:0, y:0}, pts = new Map(); let start = null, moved = false;
  const apply = () => { target.style.transform = st.s === 1 && !st.x && !st.y ? "" : `translate(${st.x}px, ${st.y}px) scale(${st.s})`; };
  const clamp = () => { st.s = Math.max(1, Math.min(8, st.s)); if (st.s === 1){ st.x = 0; st.y = 0; } else { const r = area.getBoundingClientRect(), lx = r.width*st.s/2, ly = r.height*st.s/2; st.x = Math.max(-lx, Math.min(lx, st.x)); st.y = Math.max(-ly, Math.min(ly, st.y)); } };
  const zoomAt = (ns, cx, cy) => { const r = area.getBoundingClientRect(), ox = cx - (r.left + r.width/2), oy = cy - (r.top + r.height/2), k = ns/st.s; st.x = ox - (ox - st.x)*k; st.y = oy - (oy - st.y)*k; st.s = ns; clamp(); apply(); };
  area.addEventListener("pointerdown", e => {
    area.setPointerCapture(e.pointerId); pts.set(e.pointerId, {x:e.clientX, y:e.clientY}); moved = false;
    if (pts.size === 1 && opts.single && opts.single(e, "down")) { start = {single:true}; return; }
    const v = [...pts.values()];
    start = pts.size === 2 ? {d: Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y), s: st.s, cx:(v[0].x + v[1].x)/2, cy:(v[0].y + v[1].y)/2, x:st.x, y:st.y} : {px:e.clientX, py:e.clientY, x:st.x, y:st.y};
  });
  area.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, {x:e.clientX, y:e.clientY});
    if (start.single){ opts.single(e, "move"); return; }
    const v = [...pts.values()];
    if (pts.size >= 2 && start.d){
      const d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y), cx = (v[0].x + v[1].x)/2, cy = (v[0].y + v[1].y)/2;
      st.x = start.x + (cx - start.cx); st.y = start.y + (cy - start.cy); zoomAt(start.s*d/start.d, cx, cy); moved = true;
    } else if (pts.size === 1 && start.px != null && st.s > 1){ st.x = start.x + e.clientX - start.px; st.y = start.y + e.clientY - start.py; clamp(); apply(); moved = true; }
  });
  const up = e => { pts.delete(e.pointerId); if (!pts.size) start = null; else { const v = [...pts.values()][0]; start = {px:v.x, py:v.y, x:st.x, y:st.y}; } };
  area.addEventListener("pointerup", up); area.addEventListener("pointercancel", up);
  area.addEventListener("dblclick", e => { zoomAt(st.s > 1.2 ? 1 : 2.5, e.clientX, e.clientY); });
  area.addEventListener("wheel", e => { e.preventDefault(); zoomAt(st.s*Math.exp(-e.deltaY*0.0015), e.clientX, e.clientY); }, {passive:false});
  return {reset(){ st.s = 1; st.x = 0; st.y = 0; apply(); }, zoom(f){ const r = area.getBoundingClientRect(); zoomAt(st.s*f, r.left + r.width/2, r.top + r.height/2); }};
}
let focusOn = false;
const stageZoom = zoomable($("#zoomLayer"), frame, {single: (e, phase) => { if (comparing){ move(e); return true; } return false; }});
function setFocus(on){
  focusOn = on; document.body.classList.toggle("focus", on);
  $("#focusBtn").setAttribute("aria-pressed", on); $("#zoomLayer").hidden = !on; $("#focusBar").hidden = !on;
  if (on){
    if (loupeOn) $("#loupeBtn").click(); if (objTool) setObjTool(false); if (cut && cut.tool){ cut.tool = null; refreshCutUI(); }
    try { if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); } catch (e) {}
  } else {
    stageZoom.reset();
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) {}
  }
  requestAnimationFrame(fitFrame);
}
$("#focusBtn").onclick = () => setFocus(!focusOn);
$("#focusClose").onclick = () => setFocus(false);
$("#zoomIn").onclick = () => stageZoom.zoom(1.5);
$("#zoomOut").onclick = () => stageZoom.zoom(1/1.5);
document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && focusOn) setFocus(false); });
document.addEventListener("keydown", e => { if (e.key === "Escape"){ if (!$("#lightbox").hidden) closeLightbox(); else if (focusOn) setFocus(false); } });

/* batch lightbox */
var lbIndex = -1, lbToken = 0;
const lbZoom = zoomable($("#lbStage"), $("#lbImg"));
async function openLightbox(i){
  if (!job) return;
  lbIndex = Math.max(0, Math.min(job.total - 1, i)); const tok = ++lbToken;
  const box = $("#lightbox"); box.hidden = false; lbZoom.reset();
  const s = job.status[lbIndex], done = s === "ok" || String(s).startsWith("max");
  $("#lbInfo").textContent = `${job.names[lbIndex]} · ${lbIndex + 1}/${job.total} · ${done ? "retouchée" : s === "err" ? "illisible" : "original, en attente"}`;
  $("#lbImg").src = job.thumbs[lbIndex] || "";
  try {
    let blob = null;
    if (done) { const r = job.persisted ? await store("jobs", "readonly", st => st.get("out:" + lbIndex)) : jobMem && jobMem.outs[lbIndex]; blob = r && r.blob; }
    if (!blob) blob = job.persisted ? await store("jobs", "readonly", st => st.get("in:" + lbIndex)) : jobMem && jobMem.inputs[lbIndex];
    if (blob && tok === lbToken){ const url = await blobToDataURL(blob); if (tok === lbToken) $("#lbImg").src = url; }
  } catch (e) {}
  $("#lbPrev").disabled = lbIndex <= 0; $("#lbNext").disabled = lbIndex >= job.total - 1;
}
function closeLightbox(){ $("#lightbox").hidden = true; lbIndex = -1; lbToken++; $("#lbImg").src = ""; }
$("#lbClose").onclick = closeLightbox;
$("#lbPrev").onclick = () => openLightbox(lbIndex - 1);
$("#lbNext").onclick = () => openLightbox(lbIndex + 1);
$("#bList").addEventListener("click", e => { const li = e.target.closest("li"); if (!li || !job) return; const i = [...$("#bList").children].indexOf(li); if (i >= 0) openLightbox(i); });
})();
