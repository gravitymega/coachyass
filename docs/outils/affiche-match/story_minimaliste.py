# Story Instagram « Game Day » (1080x1920), même style minimaliste que la miniature YouTube
import json, os, numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S=os.path.dirname(os.path.abspath(__file__))
CFG=json.load(open(os.path.join(S,"match.json")))
OR=(236,112,48); WHITE=(255,255,255); DARK=(20,12,8); RED=(226,48,46)
A=lambda s: ImageFont.truetype(os.path.join(S,"Anton.ttf"),s)
rng=np.random.default_rng(21)
W,H=1080,1920
def tracked(d,cx,y,t,f,fill,sp,anchor="c"):
  w=sum(d.textlength(c,font=f)+sp for c in t)-sp; x=cx-w/2 if anchor=="c" else (cx-w if anchor=="r" else cx)
  for c in t: d.text((x,y),c,font=f,fill=fill); x+=d.textlength(c,font=f)+sp
def centered(d,cx,y,t,f,fill,**k): d.text((cx-d.textlength(t,font=f)/2,y),t,font=f,fill=fill,**k)
acc=np.zeros((H,W))
for k,wt in [(220,1.0),(110,0.55),(55,0.25)]:
  n=rng.random((H//k+2,W//k+2)); acc+=wt*np.asarray(Image.fromarray((n*255).astype(np.uint8)).resize((W,H),Image.BICUBIC).filter(ImageFilter.GaussianBlur(k*0.6))).astype(float)/255
acc=(acc-acc.min())/(acc.max()-acc.min())
a=np.clip((acc-0.38)*1.9,0,1)**1.3
a=np.asarray(Image.fromarray((a*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(45))).astype(float)/255
y,x=np.mgrid[0:H,0:W]; v=1-np.clip(np.sqrt(((x-W/2)/(W*0.75))**2+((y-H*0.45)/(H*0.6))**2),0,1)
a=a*(0.25+0.75*v)*0.9
bg=Image.fromarray((np.array([10,6,5])*(1-a[...,None])+np.array([185,92,40])*a[...,None]).astype(np.uint8))
g=np.asarray(bg).astype(np.int16)+rng.normal(0,5,(H,W))[...,None]; bg=Image.fromarray(np.clip(g,0,255).astype(np.uint8))
d=ImageDraw.Draw(bg)
d.rectangle([60,90,290,170],fill=RED); d.ellipse([86,116,112,142],fill=WHITE); d.text((126,88),"LIVE",font=A(64),fill=WHITE)
tracked(d,W-64,104,"GAME DAY",A(42),OR,18,"r")
def shadow(img,pos,r=22,al=0.65):
  m=Image.new("L",(W,H),0); m.paste(img.split()[3],(pos[0]+8,pos[1]+14)); m=m.filter(ImageFilter.GaussianBlur(r)).point(lambda p:int(p*al)); bg.paste((0,0,0),(0,0),m)
gl=Image.open(os.path.join(S,"gravity-logo.png")).convert("RGBA"); gw=460; gl=gl.resize((gw,int(gw*gl.height/gl.width)),Image.LANCZOS)
p=(int(W/2-gl.width/2),215); shadow(gl,p); bg.paste(gl,p,gl)
d=ImageDraw.Draw(bg); centered(d,W/2,p[1]+gl.height+10,"GRAVITY",A(96),WHITE)
f=A(185); bb=d.textbbox((0,0),"VS",font=f); vx=W/2-(bb[2]-bb[0])/2-bb[0]; vy=868-(bb[3]+bb[1])/2
d.text((vx+9,vy+11),"VS",font=f,fill=(0,0,0)); d.text((vx,vy),"VS",font=f,fill=WHITE,stroke_width=8,stroke_fill=OR)
Dd=400; ol=Image.open(os.path.join(S,CFG["logo_adversaire"])).convert("RGBA")
bd=Image.new("RGBA",(Dd,Dd),(0,0,0,0)); ImageDraw.Draw(bd).ellipse([0,0,Dd-1,Dd-1],fill=OR); t=11; ol=ol.resize((Dd-2*t,Dd-2*t),Image.LANCZOS); bd.paste(ol,(t,t),ol)
p=(int(W/2-Dd/2),1010); shadow(bd,p); bg.paste(bd,p,bd)
d=ImageDraw.Draw(bg); nm=CFG.get("adversaire_court",CFG["adversaire"]); f2=A(96)
while d.textlength(nm,font=f2)>W-140: f2=A(f2.size-4)
centered(d,W/2,1010+Dd+12,nm,f2,WHITE)
d.rectangle([0,1600,W,1730],fill=OR); f=A(100); bb=d.textbbox((0,0),CFG["date_longue"],font=f)
d.text((W/2-(bb[2]-bb[0])/2-bb[0],1665-(bb[3]+bb[1])/2),CFG["date_longue"],font=f,fill=DARK)
d.rectangle([0,1730,W,H],fill=(14,10,8))
tracked(d,W/2,1758,CFG["lieu_type"]+" · "+CFG["salle"],A(34),WHITE,8)
tracked(d,W/2,1808,CFG["rue"],A(28),(200,190,180),6)
tracked(d,W/2,1858,"EN DIRECT SUR YOUTUBE · @GRAVITYBASKETBALL_MTL",A(24),OR,6)
os.makedirs(os.path.join(S,"sortie"),exist_ok=True); bg.save(os.path.join(S,"sortie","story-minimaliste.jpg"),quality=94); print("ok")
