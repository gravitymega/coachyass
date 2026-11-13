import sys, math, numpy as np
import json, os
CFG=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),"match.json")))

from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops
S=os.path.dirname(os.path.abspath(__file__))
OR=(236,112,48); CREAM=(245,238,228); RED=(220,40,40)
A=lambda s: ImageFont.truetype(os.path.join(S,"Anton.ttf"),s)
def Inter(s,w="Bold"): return ImageFont.truetype(f"/usr/share/fonts/opentype/inter/Inter-{w}.otf",s)
rng=np.random.default_rng(11)
def tw(d,t,f,sp=0): return sum(d.textlength(c,font=f)+sp for c in t)-sp
def tracked(d,xy,t,f,fill,sp,anchor="l"):
  x,y=xy; w=tw(d,t,f,sp)
  if anchor=="c": x-=w/2
  if anchor=="r": x-=w
  for c in t: d.text((x,y),c,font=f,fill=fill); x+=d.textlength(c,font=f)+sp
def centered(d,cx,y,t,f,fill,stroke=0,sf=None):
  w=d.textlength(t,font=f); d.text((cx-w/2,y),t,font=f,fill=fill,stroke_width=stroke,stroke_fill=sf)
def background(W,H):
  y,x=np.mgrid[0:H,0:W].astype(float)
  r=np.sqrt(((x-W/2)/W)**2+((y-H*0.42)/H)**2)
  t=np.clip(r/0.75,0,1)
  c0=np.array([96,46,18]); c1=np.array([12,7,5])
  img=(c0*(1-t[...,None])**1.4+c1*(1-(1-t[...,None])**1.4)).astype(np.uint8)
  bg=Image.fromarray(img)
  # faisceaux de projecteurs
  L=Image.new("L",(W,H),0); d=ImageDraw.Draw(L)
  for sx,ang in [(0.18,12),(0.5,0),(0.82,-12)]:
    x0=W*sx; spread=W*0.16
    d.polygon([(x0-W*0.02,0),(x0+W*0.02,0),(x0+spread+math.tan(math.radians(-ang))*H*0.2,H),(x0-spread+math.tan(math.radians(-ang))*H*0.2,H)],fill=46)
  L=L.filter(ImageFilter.GaussianBlur(W/40))
  bg=Image.composite(Image.new("RGB",(W,H),(255,190,120)),bg,L)
  # lignes de terrain en bas
  c=Image.new("L",(W,H),0); d=ImageDraw.Draw(c); lw=max(2,W//500)
  d.ellipse([W*0.5-W*0.42,H*0.80,W*0.5+W*0.42,H*1.35],outline=55,width=lw)
  d.ellipse([W*0.5-W*0.12,H*0.90,W*0.5+W*0.12,H*1.10],outline=55,width=lw)
  d.line([(0,H*0.86),(W,H*0.86)],fill=40,width=lw)
  bg=Image.composite(Image.new("RGB",(W,H),OR),bg,c)
  # vignette
  v=Image.new("L",(W,H),0); ImageDraw.Draw(v).ellipse([-W*0.2,-H*0.25,W*1.2,H*1.15],fill=255)
  v=ImageChops.invert(v.filter(ImageFilter.GaussianBlur(W/10))).point(lambda p:int(p*0.75))
  return Image.composite(Image.new("RGB",(W,H),(5,3,2)),bg,v)
def glow(bg,im,pos,rad,col=(255,140,60),a=0.55):
  big=Image.new("L",bg.size,0); big.paste(im.split()[3],pos)
  big=big.filter(ImageFilter.GaussianBlur(rad)).point(lambda p:int(p*a)); bg.paste(Image.new("RGB",bg.size,col),(0,0),big)
def opp_badge(D):
  b=Image.new("RGBA",(D,D),(0,0,0,0)); d=ImageDraw.Draw(b)
  d.ellipse([0,0,D-1,D-1],fill=OR)
  t=max(3,D//45); lg=Image.open(os.path.join(S,CFG["logo_adversaire"])).resize((D-2*t,D-2*t),Image.LANCZOS)
  b.paste(lg,(t,t),lg)
  return b
def grain(im,a=7):
  x=np.asarray(im).astype(np.int16); n=rng.normal(0,a,x.shape[:2])[...,None]; return Image.fromarray(np.clip(x+n,0,255).astype(np.uint8))
def make(W,H,name,mode):
  bg=background(W,H); d=ImageDraw.Draw(bg); u=min(W,H)/1080
  M=int(48*u)
  # haut
  if mode=="yt":
    bx,by=M,M; f=Inter(int(34*u),"ExtraBold"); w=d.textlength("LIVE",font=f)
    d.rectangle([bx,by,bx+w+int(70*u),by+int(56*u)],fill=RED); d.ellipse([bx+int(18*u),by+int(19*u),bx+int(36*u),by+int(37*u)],fill="white")
    d.text((bx+int(48*u),by+int(8*u)),"LIVE",font=f,fill="white")
  else:
    logo=Image.open(os.path.join(S,"gravity-logo.png")); logo.thumbnail((int(90*u),int(90*u)),Image.LANCZOS); bg.paste(logo,(M,M-int(8*u)),logo)
    tracked(d,(M+logo.width+int(18*u),M+int(6*u)),"GRAVITY BASKETBALL",Inter(int(22*u)),CREAM,int(4*u))
    tracked(d,(M+logo.width+int(18*u),M+int(38*u)),"PREP · 2026-27",Inter(int(20*u),"SemiBold"),OR,int(4*u))
  tracked(d,(W-M,M+int(10*u)),"GAME DAY",Inter(int(30*u),"ExtraBold"),OR,int(9*u),"r")
  # disposition
  if mode=="yt": cy=H*0.43; LW=int(W*0.25); xs=(W*0.24,W*0.76); nameY=cy+LW*0.47; ns=int(64*u); vs=int(250*u)
  elif mode=="post": cy=H*0.40; LW=int(W*0.30); xs=(W*0.23,W*0.77); nameY=cy+LW*0.55; ns=int(50*u); vs=int(170*u)
  else: cy=H*0.40; LW=int(W*0.50); xs=(W*0.5,W*0.5); nameY=None; ns=int(56*u); vs=int(140*u)
  logo=Image.open(os.path.join(S,"gravity-logo.png")).convert("RGBA"); lw=LW; lh=int(lw*logo.height/logo.width); logo=logo.resize((lw,lh),Image.LANCZOS)
  ob=opp_badge(int(LW*0.86))
  if mode!="story":
    p1=(int(xs[0]-lw/2),int(cy-lh/2)); glow(bg,logo,p1,int(30*u)); bg.paste(logo,p1,logo)
    p2=(int(xs[1]-ob.width/2),int(cy-ob.height/2)); glow(bg,ob,p2,int(30*u),(200,60,50),0.45); bg.paste(ob,p2,ob)
    d=ImageDraw.Draw(bg); f=A(vs); w=d.textlength("VS",font=f); bb=d.textbbox((0,0),"VS",font=f)
    d.text((W/2-w/2+int(8*u),cy-(bb[3]+bb[1])/2+int(8*u)),"VS",font=f,fill=(0,0,0))
    d.text((W/2-w/2,cy-(bb[3]+bb[1])/2),"VS",font=f,fill=CREAM,stroke_width=int(5*u),stroke_fill=OR)
    centered(d,xs[0],nameY,"GRAVITY",A(ns),CREAM); 
    f2=A(ns); t2=CFG["adversaire"]
    while d.textlength(t2,font=f2)>W*0.42: f2=A(f2.size-2)
    centered(d,xs[1],nameY,t2,f2,CREAM)
  else:
    sz=int(W*0.40); l2=logo.resize((sz,int(sz*logo.height/logo.width)),Image.LANCZOS); o2=opp_badge(int(sz*0.86))
    p1=(int(W/2-l2.width/2),int(H*0.12)); glow(bg,l2,p1,int(30*u)); bg.paste(l2,p1,l2)
    d=ImageDraw.Draw(bg); centered(d,W/2,p1[1]+l2.height+int(6*u),"GRAVITY",A(ns),CREAM)
    f=A(vs); centered(d,W/2+6*u,H*0.37+6*u,"VS",f,(0,0,0)); centered(d,W/2,H*0.37,"VS",f,CREAM,int(5*u),OR)
    p2=(int(W/2-o2.width/2),int(H*0.47)); glow(bg,o2,p2,int(30*u),(200,60,50),0.45); bg.paste(o2,p2,o2)
    d=ImageDraw.Draw(bg); centered(d,W/2,p2[1]+o2.height+int(8*u),CFG["adversaire"],A(ns),CREAM)
  # bandeau orange
  d=ImageDraw.Draw(bg)
  if mode=="yt": by0,bh=H*0.80,H*0.105; txt=CFG["date_longue"]
  elif mode=="post": by0,bh=H*0.765,H*0.085; txt=CFG["date_longue"]
  else: by0,bh=H*0.80,H*0.065; txt=CFG["date_longue"]
  d.rectangle([0,by0,W,by0+bh],fill=OR)
  f=A(int(bh*0.62)); bb=d.textbbox((0,0),txt,font=f); d.text((W/2-(bb[2]-bb[0])/2-bb[0],by0+bh/2-(bb[3]+bb[1])/2),txt,font=f,fill=(24,12,6))
  # infos
  fy=by0+bh+int(22*u)
  if mode!="yt":
    tracked(d,(W/2,fy),CFG["lieu_type"]+" · "+CFG["salle"],Inter(int(26*u),"ExtraBold"),CREAM,int(5*u),"c")
    tracked(d,(W/2,fy+int(44*u)),CFG["rue"],Inter(int(22*u),"SemiBold"),(200,190,180),int(4*u),"c")
    fy+=int(100*u)
    tracked(d,(W/2,fy),"VENEZ NOMBREUX · EN DIRECT SUR YOUTUBE",Inter(int(20*u)),OR,int(5*u),"c")
    tracked(d,(W/2,H-M-int(4*u)),"@GRAVITYBASKETBALL_MTL",Inter(int(20*u)),(180,170,160),int(5*u),"c")
  else:
    tracked(d,(W/2,fy),"GRAVITY BASKETBALL MONTRÉAL · EN DIRECT SUR YOUTUBE",Inter(int(22*u)),CREAM,int(6*u),"c")
  grain(bg).save(os.path.join(S,"sortie",name),quality=94)
os.makedirs(os.path.join(S,"sortie"),exist_ok=True)
make(1920,1080,"miniature-youtube.jpg","yt")
print("ok")
