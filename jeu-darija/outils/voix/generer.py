"""Fabrique les fichiers audio de la voix de Hbibiti (jeu-darija/voix/).

Voix : Kokoro-82M (licence Apache 2.0), voix française « ff_siwis », calculée sur l'ordinateur, sans service payant.

Préparation (une fois) :
  python3 -m venv venv && venv/bin/pip install kokoro-onnx soundfile
  npm pack kokoro-fp16-shards kokoro-js   # poids du modèle et voix, publiés sur npm
  cat kokoro-fp16.part{0..9}.bin > kokoro-fp16.onnx   (après extraction des archives)
  python3 -c "import numpy as n; v=lambda f: n.fromfile('voices/'+f+'.bin', 'float32').reshape(-1,1,256); n.savez('voices.npz', ff_siwis=v('ff_siwis'), af_heart=v('af_heart'))"

Utilisation :
  node jeu-darija/outils/voix/phrases.mjs > phrases.json
  venv/bin/python jeu-darija/outils/voix/generer.py --model kokoro-fp16.onnx --voices voices.npz --phrases phrases.json
Seules les phrases nouvelles sont fabriquées ; --clean retire les fichiers qui ne servent plus.
"""
import argparse, json, os, re, subprocess, sys
from multiprocessing import Pool

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'voix'))
SPEED = 0.9
_k = None


def init(model, voices):
    global _k
    os.environ.setdefault('OMP_NUM_THREADS', '1')
    import onnxruntime as ort
    from kokoro_onnx import Kokoro
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 1
    _k = Kokoro.from_session(ort.InferenceSession(model, opts), voices)


def synth(text, voice='ff_siwis', lang='fr-fr'):
    # Le modèle rend parfois un son vide pour une phrase : on réessaie à une vitesse voisine, puis phrase par phrase.
    for speed in (SPEED, SPEED - 0.02, SPEED + 0.02, SPEED - 0.04):
        audio, sr = _k.create(text, voice=voice, speed=speed, lang=lang)
        audio = np.nan_to_num(np.asarray(audio, dtype=np.float32).reshape(-1))
        if audio.size >= sr // 10:
            return audio, sr
    parts = [p for p in re.split(r'(?<=[.!?:;])\s+', text) if p.strip()]
    if len(parts) < 2:
        return audio, sr
    pause = np.zeros(int(0.25 * sr), dtype=np.float32)
    out = []
    for p in parts:
        a, sr = synth(p, voice, lang)
        out += [a, pause]
    return np.concatenate(out), sr


def make(item):
    key, say = item['key'], item['say']
    dest = os.path.join(OUT, key + '.mp3')
    if os.path.exists(dest):
        return key, 'ok'
    audio, sr = synth(say, item.get('voice', 'ff_siwis'), item.get('lang', 'fr-fr'))
    if audio.size < sr // 10:
        return key, 'vide : ' + say
    # Silences du début et de la fin raccourcis, volume égalisé.
    loud = np.where(np.abs(audio) > 0.01)[0]
    if len(loud):
        audio = audio[max(0, loud[0] - int(0.04 * sr)):loud[-1] + int(0.12 * sr)]
    peak = float(np.max(np.abs(audio))) or 1.0
    audio = audio * (0.89 / peak)
    pcm = (np.clip(audio, -1, 1) * 32767).astype('<i2').tobytes()
    tmp = dest + '.tmp.mp3'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(sr), '-ac', '1', '-i', '-',
                    '-c:a', 'libmp3lame', '-b:a', '32k', tmp], input=pcm, check=True)
    os.replace(tmp, dest)
    return key, 'new'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--voices', required=True)
    ap.add_argument('--phrases', required=True)
    ap.add_argument('--jobs', type=int, default=os.cpu_count() or 2)
    ap.add_argument('--clean', action='store_true')
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    items = json.load(open(a.phrases, encoding='utf-8'))
    keys = set()
    done = 0
    with Pool(a.jobs, initializer=init, initargs=(a.model, a.voices)) as pool:
        for key, state in pool.imap_unordered(make, items, chunksize=4):
            if state in ('ok', 'new'):
                keys.add(key)
            done += 1
            if state.startswith('vide'):
                print(state, file=sys.stderr)
            if done % 100 == 0:
                print(f'{done}/{len(items)}', file=sys.stderr, flush=True)
    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump(sorted(keys), f, separators=(',', ':'))
    if a.clean:
        for name in os.listdir(OUT):
            if name.endswith('.mp3') and name[:-4] not in keys:
                os.remove(os.path.join(OUT, name))
    print(f'{len(keys)} phrases dans {OUT}', file=sys.stderr)


if __name__ == '__main__':
    main()
