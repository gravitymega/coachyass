# Miniature YouTube « Game Day » : style minimaliste (référence : Gravity vs Legacy 3R, 17 oct. 2026)
import json, os, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S=os.path.dirname(os.path.abspath(__file__))
CFG=json.load(open(os.path.join(S,"match.json")))
OR=(236,112,48); WHITE=(255,255,255); DARK=(20,12,8); RED=(226,48,46)
A=lambda s: ImageFont.truetype(os.path.join(S,"Anton.ttf"),s)
rng=np.random.default_rng(21)
W,H=1920,1080
def tracked(d,cx,y,t,f,fill,sp,anchor="c"):
  w=sum(d.textlength(c,font=f)+sp for c in t)-sp; x=cx-w/2 if anchor=="c" else (cx-w if anchor=="r" else cx)
  for c in t: d.text((x,y),c,font=f,fill=fill); x+=d.textlength(c,font=f)+sp
def centered(d,cx,y,t,f,fill,**k):
  d.text((cx-d.textlength(t,font=f)/2,y),t,font=f,fill=fill,**k)
# fond : fumée orange floue sur noir
acc=np.zeros((H,W))
for k,wt in [(220,1.0),(110,0.55),(55,0.25)]:
  n=rng.random((H//k+2,W//k+2)); acc+=wt*np.asarray(Image.fromarray((n*255).astype(np.uint8)).resize((W,H),Image.BICUBIC).filter(ImageFilter.GaussianBlur(k*0.6))).astype(float)/255
acc=(acc-acc.min())/(acc.max()-acc.min())
a=np.clip((acc-0.38)*1.9,0,1)**1.3
a=np.asarray(Image.fromarray((a*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(45))).astype(float)/255
y,x=np.mgrid[0:H,0:W]; v=1-np.clip(np.sqrt(((x-W/2)/(W*0.62))**2+((y-H*0.45)/(H*0.75))**2),0,1)
a=a*(0.25+0.75*v)*0.9
base=np.array([10,6,5]); smoke=np.array([185,92,40])
bg=Image.fromarray((base*(1-a[...,None])+smoke*a[...,None]).astype(np.uint8))
# grain léger
g=np.asarray(bg).astype(np.int16)+rng.normal(0,5,(H,W))[...,None]; bg=Image.fromarray(np.clip(g,0,255).astype(np.uint8))
d=ImageDraw.Draw(bg)
# LIVE + GAME DAY
d.rectangle([54,48,308,136],fill=RED); d.ellipse([84,78,112,106],fill=WHITE); d.text((130,46),"LIVE",font=A(72),fill=WHITE)
tracked(d,W-72,62,"GAME DAY",A(46),OR,22,"r")
# logos
def shadow(img,pos,r=22,a=0.65):
  m=Image.new("L",(W,H),0); m.paste(img.split()[3],(pos[0]+8,pos[1]+14)); m=m.filter(ImageFilter.GaussianBlur(r)).point(lambda p:int(p*a))
  bg.paste((0,0,0),(0,0),m)
gl=Image.open(os.path.join(S,"gravity-logo.png")).convert("RGBA"); gw=560; gl=gl.resize((gw,int(gw*gl.height/gl.width)),Image.LANCZOS)
cy=480; xL,xR=W*0.235,W*0.77
p=(int(xL-gl.width/2),int(cy-gl.height/2)); shadow(gl,p); bg.paste(gl,p,gl)
Dd=500; ol=Image.open(os.path.join(S,CFG["logo_adversaire"])).convert("RGBA")
bd=Image.new("RGBA",(Dd,Dd),(0,0,0,0)); ImageDraw.Draw(bd).ellipse([0,0,Dd-1,Dd-1],fill=OR)
t=12; ol=ol.resize((Dd-2*t,Dd-2*t),Image.LANCZOS); bd.paste(ol,(t,t),ol)
p=(int(xR-Dd/2),int(cy-Dd/2)); shadow(bd,p); bg.paste(bd,p,bd)
d=ImageDraw.Draw(bg)
# VS
f=A(300); bb=d.textbbox((0,0),"VS",font=f); vx=W/2-(bb[2]-bb[0])/2-bb[0]+10; vy=cy-(bb[3]+bb[1])/2
d.text((vx+10,vy+12),"VS",font=f,fill=(0,0,0)); d.text((vx,vy),"VS",font=f,fill=WHITE,stroke_width=9,stroke_fill=OR)
# noms
fn=A(112); centered(d,xL,742,"GRAVITY",fn,WHITE)
nm=CFG.get("adversaire_court",CFG["adversaire"]); f2=fn
while d.textlength(nm,font=f2)>W*0.36: f2=A(f2.size-4)
centered(d,xR,742+(fn.size-f2.size)*0.75,nm,f2,WHITE)
# bandeau date + bande noire
d.rectangle([0,900,W,1038],fill=OR); f=A(112); bb=d.textbbox((0,0),CFG["date_longue"],font=f)
d.text((W/2-(bb[2]-bb[0])/2-bb[0],969-(bb[3]+bb[1])/2),CFG["date_longue"],font=f,fill=DARK)
d.rectangle([0,1038,W,H],fill=(14,10,8)); tracked(d,W/2,1042,"GRAVITY BASKETBALL MONTRÉAL · EN DIRECT SUR YOUTUBE",A(26),WHITE,10)
os.makedirs(os.path.join(S,"sortie"),exist_ok=True); bg.save(os.path.join(S,"sortie","miniature-youtube.jpg"),quality=94); print("ok")
