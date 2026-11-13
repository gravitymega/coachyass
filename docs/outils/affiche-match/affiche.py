import sys, numpy as np
import json, os
CFG=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"match.json")))

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps, ImageEnhance, ImageChops
S=os.path.dirname(os.path.abspath(__file__)); P=None
OR=(240,110,40); CREAM=(242,234,224); BLK=(12,11,11)
A=lambda s: ImageFont.truetype(os.path.join(S,"Anton.ttf"),s)
def Inter(s,w="Bold"): return ImageFont.truetype(f"/usr/share/fonts/opentype/inter/Inter-{w}.otf",s)
rng=np.random.default_rng(4)
def tw(d,t,f,sp): return sum(d.textlength(c,font=f)+sp for c in t)-sp
def tracked(d,xy,t,f,fill,sp,anchor="l"):
  x,y=xy; w=tw(d,t,f,sp); x-= w/2 if anchor=="c" else (w if anchor=="r" else 0)
  for c in t: d.text((x,y),c,font=f,fill=fill); x+=d.textlength(c,font=f)+sp
def grain(im,a=10):
  x=np.asarray(im).astype(np.int16); n=rng.normal(0,a,x.shape[:2])[...,None]; return Image.fromarray(np.clip(x+n,0,255).astype(np.uint8))
def duotone(id,w,h,cent):
  im=ImageOps.exif_transpose(Image.open(id)).convert("L")
  im=ImageOps.fit(im,(w,h),Image.LANCZOS,centering=cent); im=ImageOps.autocontrast(im,cutoff=1); im=ImageEnhance.Contrast(im).enhance(1.35)
  return ImageOps.colorize(im,BLK,(255,214,180),mid=(200,80,24))
def brush(w,h,seed):
  r=np.random.default_rng(seed); m=Image.new("L",(w,h),0); d=ImageDraw.Draw(m)
  for i in range(int(h/2.2)):
    y=r.integers(0,h); d.line([(r.integers(-10,w//14),y),(w-r.integers(0,w//10),y+r.integers(-5,5))],fill=int(r.integers(180,255)),width=int(r.integers(5,15)))
  m=m.filter(ImageFilter.GaussianBlur(1.3)); return ImageChops.multiply(m,Image.fromarray(((r.random((h,w))>0.12)*255).astype(np.uint8)))
def badge(D):
  b=Image.new("RGBA",(D,D),(0,0,0,0)); d=ImageDraw.Draw(b)
  d.ellipse([0,0,D-1,D-1],fill=CREAM)
  t=max(3,D//45); lg=Image.open(os.path.join(S,CFG["logo_adversaire"])).resize((D-2*t,D-2*t),Image.LANCZOS)
  b.paste(lg,(t,t),lg)
  return b
def make(W,H,name):
  u=W/1080; story=H/W>1.5
  bg=Image.new("RGB",(W,H),BLK)
  # photo duotone en haut, fondu vers le noir
  ph_h=int(H*(0.66 if story else 0.60))
  ph=duotone(os.path.join(S,CFG["photo"]),W,ph_h,tuple(CFG.get("photo_cadrage",[0.5,0.4])))
  fade=Image.new("L",(W,ph_h),255); d=ImageDraw.Draw(fade)
  for i in range(int(ph_h*0.55)): d.line([(0,ph_h-i),(W,ph_h-i)],fill=int(255*(i/(ph_h*0.55))**1.3))
  for i in range(int(ph_h*0.18)): d.line([(0,i),(W,i)],fill=int(255*(i/(ph_h*0.18))))
  bg.paste(ph,(0,0),fade)
  d=ImageDraw.Draw(bg); M=int(50*u)
  # en-tête
  logo=Image.open(os.path.join(S,"gravity-logo.png")); l=logo.copy(); l.thumbnail((int(84*u),int(84*u)),Image.LANCZOS); bg.paste(l,(M,M-int(6*u)),l)
  tracked(d,(M+l.width+int(16*u),M+int(4*u)),"GRAVITY BASKETBALL",Inter(int(21*u)),CREAM,int(4*u))
  tracked(d,(M+l.width+int(16*u),M+int(34*u)),"MONTRÉAL",Inter(int(19*u),"SemiBold"),OR,int(4*u))
  tracked(d,(W-M,M+int(4*u)),"PREP · 2026-27",Inter(int(21*u)),CREAM,int(4*u),"r")
  tracked(d,(W-M,M+int(34*u)),CFG["lieu_type"],Inter(int(19*u),"SemiBold"),OR,int(4*u),"r")
  # titre
  ty=int(H*(0.53 if story else 0.385)); f=A(int(215*u)); t="GAME DAY"
  bb=d.textbbox((M-int(6*u),ty),t,font=f); d.text((M-int(6*u),ty),t,font=f,fill=CREAM)
  sq=int(40*u); d.rectangle([bb[2]+int(12*u),bb[3]-sq,bb[2]+int(12*u)+sq,bb[3]],fill=OR)
  # affiche du match
  my=bb[3]+int(50*u); LH=int(150*u)
  lg=logo.copy(); lg=lg.resize((int(LH*logo.width/logo.height),LH),Image.LANCZOS); bg.paste(lg,(M,my),lg)
  vx=M+lg.width+int(30*u); fvs=A(int(96*u)); d.text((vx,my+LH/2-int(70*u)),"VS",font=fvs,fill=OR)
  bx=vx+int(d.textlength("VS",font=fvs))+int(30*u); b=badge(LH); bg.paste(b,(bx,my),b)
  nx=bx+LH+int(28*u)
  if nx+int(300*u)<W-M:
    d.text((nx,my+int(18*u)),CFG["adversaire_l1"],font=A(int(58*u)),fill=CREAM); d.text((nx,my+int(84*u)),CFG["adversaire_l2"],font=A(int(44*u)),fill=OR)
  else:
    d.text((M,my+LH+int(16*u)),"VS "+CFG["adversaire"],font=A(int(52*u)),fill=CREAM); my+=int(80*u)
  # pinceau date
  py=my+LH+int(48*u); txt=CFG["date_courte"]; fd=A(int(70*u)); w=int(d.textlength(txt,font=fd))+int(90*u)
  br=brush(w,int(110*u),7); bg.paste(Image.new("RGB",br.size,OR),(M-int(14*u),py),br)
  d.text((M+int(24*u),py+int(8*u)),txt,font=fd,fill=BLK)
  # infos
  iy=py+int(140*u)
  tracked(d,(M,iy),CFG["adresse"],Inter(int(22*u)),CREAM,int(3*u))
  tracked(d,(M,iy+int(36*u)),"EN DIRECT SUR YOUTUBE · VENEZ NOMBREUX",Inter(int(20*u),"SemiBold"),OR,int(3*u))
  # pied
  fy=H-M-int(20*u); d.line([(M,fy-int(18*u)),(W-M,fy-int(18*u))],fill=(70,62,58),width=1)
  tracked(d,(M,fy),"GRAVITY PREP · SAISON 2026-27",Inter(int(17*u)),CREAM,int(3*u))
  tracked(d,(W-M,fy),"@GRAVITYBASKETBALL_MTL",Inter(int(17*u)),OR,int(3*u),"r")
  grain(bg).save(os.path.join(S,"sortie",name),quality=94)
os.makedirs(os.path.join(S,"sortie"),exist_ok=True)
make(1080,1350,"affiche-match-4x5.jpg"); make(1080,1920,"affiche-match-story.jpg"); print("ok")
