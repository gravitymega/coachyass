#!/usr/bin/env python3
"""Met à jour catalogue.json à partir des vidéos du dossier (rushes du documentaire Gravity).

Dépose les nouveaux fichiers (.mov, .mp4, .m4v) dans ce dossier, puis lance :
    python3 ajouter.py
Les infos techniques (durée, résolution, cadence, date de tournage, volume, empreinte, vignette)
sont recalculées ; les notes écrites à la main (titre, séquence, usage, lieu, tags, voix, son)
sont conservées. Pour une nouvelle vidéo, remplis ensuite ses notes dans catalogue.json.
Demande : ffmpeg et ffprobe installés.
"""
import hashlib, json, os, subprocess, sys
from datetime import datetime, timedelta, timezone

D = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(D, 'catalogue.json')
EXT = ('.mov', '.mp4', '.m4v')
MONTREAL = timezone(timedelta(hours=-4))  # heure d'été ; passe à -5 de novembre à mars

def probe(p):
    j = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', p]))
    v = next(s for s in j['streams'] if s['codec_type'] == 'video')
    a = next((s for s in j['streams'] if s['codec_type'] == 'audio'), None)
    rot = next((int(sd['rotation']) for sd in v.get('side_data_list', []) if 'rotation' in sd), 0)
    num, den = map(int, v['r_frame_rate'].split('/'))
    return j, v, a, rot, num / den

def volumes(p):
    r = subprocess.run(['ffmpeg', '-i', p, '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
    out = {}
    for line in r.splitlines():
        for k in ('mean_volume', 'max_volume'):
            if k + ':' in line:
                out[k] = float(line.split(k + ':')[1].split('dB')[0])
    return out

cat = json.load(open(CAT, encoding='utf-8')) if os.path.exists(CAT) else {'documentaire': 'Gravity — documentaire', 'rushes': []}
par_id = {r['id']: r for r in cat['rushes']}
os.makedirs(os.path.join(D, 'vignettes'), exist_ok=True)

for f in sorted(os.listdir(D)):
    if not f.lower().endswith(EXT):
        continue
    p = os.path.join(D, f)
    rid = os.path.splitext(f)[0]
    j, v, a, rot, fps = probe(p)
    dur = float(j['format']['duration'])
    ct = j['format'].get('tags', {}).get('creation_time')
    tourne = (datetime.fromisoformat(ct.replace('Z', '+00:00')).astimezone(MONTREAL).strftime('%Y-%m-%d %H:%M:%S') + " (heure de Montréal)") if ct else None
    w, h = v['width'], v['height']
    vol = volumes(p)
    vign = f'vignettes/{rid}.jpg'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{dur / 2:.2f}', '-i', p, '-frames:v', '1', '-vf', 'scale=-2:360', '-q:v', '4', os.path.join(D, vign)])
    tech = dict(fichier=f, vignette=vign, tourne_le=tourne, duree_s=round(dur, 2),
                resolution_affichee=f'{h}x{w}' if abs(rot) in (90, 270) else f'{w}x{h}',
                cadence_ips=round(fps, 2), codec=v['codec_name'], rotation=rot,
                audio=dict(codec=a['codec_name'] if a else None, volume_moyen_db=vol.get('mean_volume'), crete_db=vol.get('max_volume')),
                taille_octets=os.path.getsize(p), sha256=hashlib.sha256(open(p, 'rb').read()).hexdigest())
    if rid in par_id:
        par_id[rid].update(tech)
    else:
        nouveau = dict(id=rid, titre='', sequence='', usage='', lieu='', tags=[], voix='', son='', utilise_dans=[])
        nouveau.update(tech)
        cat['rushes'].append(nouveau)
        par_id[rid] = nouveau
        print('Nouveau :', f, '— remplis ses notes dans catalogue.json')

cat['rushes'].sort(key=lambda r: (r.get('tourne_le') or '', r['id']))
cat['mis_a_jour'] = datetime.now(MONTREAL).strftime('%Y-%m-%d')
json.dump(cat, open(CAT, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open(CAT, 'a').write('\n')

# Index lisible
lignes = ['| Plan | Tourné le | Durée | Format | Séquence | Contenu |', '|---|---|---|---|---|---|']
for r in cat['rushes']:
    lignes.append(f"| [{r['id']}]({r['fichier']}) | {(r.get('tourne_le') or '').replace(' (heure de Montréal)', '')} | {r['duree_s']} s | {r['resolution_affichee']} · {r['cadence_ips']:g} i/s | {r.get('sequence', '')} | {r.get('titre', '')} |")
idx = os.path.join(D, 'README.md')
txt = open(idx, encoding='utf-8').read() if os.path.exists(idx) else ''
debut, fin = '<!-- index:début -->', '<!-- index:fin -->'
bloc = debut + '\n' + '\n'.join(lignes) + '\n' + fin
if debut in txt and fin in txt:
    txt = txt[:txt.index(debut)] + bloc + txt[txt.index(fin) + len(fin):]
else:
    txt += '\n' + bloc + '\n'
open(idx, 'w', encoding='utf-8').write(txt)
print(len(cat['rushes']), 'plans au catalogue')
