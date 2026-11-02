#!/usr/bin/env python3
"""Clips audio de la narration (voix d'homme libres, hors ligne, gratuites).

Lit audio-jobs.json (npm run audio:jobs) et écrit public/audio/<version>/<langue>/<empreinte>.mp3.
Les clips déjà présents sont gardés ; ceux qui ne servent plus sont supprimés.

    python3 scripts/tts.py --voices voices/                 # tout
    python3 scripts/tts.py --voices voices/ --lang fr --shard 1/4

Voix d'homme (licences libres, voir README) :
    fr : Piper fr_FR-upmc-medium, locuteur « pierre » (CC BY-SA 4.0)
    en : Kokoro-82M (Apache 2.0), voix am_michael, très naturelle (vidéos en anglais)
         --voices doit contenir kokoro-v1.0.int8.onnx et voices-v1.0.bin (releases de kokoro-onnx)
"""
import argparse, hashlib, json, os, subprocess, sys, tempfile, time, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VOICES = {"fr": "fr_FR-upmc-medium"}  # Piper
KOKORO = {"en": ("am_michael", "en-us", 1.0)}  # Kokoro : voix, langue, vitesse
# Réglages de lecture : un peu plus posé que par défaut, pour un coach qui explique.
SPEED = {"fr": 1.05, "en": 1.05}  # length_scale > 1 = plus lent
SPEAKER = {"fr": 1, "en": None}  # upmc : 0 = jessica, 1 = pierre (voix d'homme)


def kokoro_wav(k, text, voice, lang, speed, path):
    """WAV d'une phrase avec Kokoro ; si le modèle rend un son vide, on réessaie à une vitesse voisine, puis phrase par phrase."""
    import numpy as np
    import soundfile as sf

    for sp in (speed, speed - 0.03, speed + 0.03):
        audio, sr = k.create(text, voice=voice, speed=sp, lang=lang)
        audio = np.nan_to_num(np.asarray(audio, dtype=np.float32).reshape(-1))
        if audio.size >= sr // 10:
            break
    else:
        import re
        parts = [p for p in re.split(r"(?<=[.!?:;])\s+", text) if p.strip()]
        chunks = []
        for p in parts:
            a, sr = k.create(p, voice=voice, speed=speed, lang=lang)
            chunks += [np.asarray(a, dtype=np.float32).reshape(-1), np.zeros(int(0.25 * sr), dtype=np.float32)]
        audio = np.concatenate(chunks) if chunks else audio
    sf.write(path, audio, sr)


def shard_of(path: str, n: int) -> int:
    return int(hashlib.sha1(path.encode()).hexdigest()[:8], 16) % n


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--voices", default="voices", help="dossier des modèles .onnx et .onnx.json")
    ap.add_argument("--jobs", default=str(ROOT / "audio-jobs.json"))
    ap.add_argument("--out", default=str(ROOT / "public"))
    ap.add_argument("--lang", choices=["fr", "en"])
    ap.add_argument("--shard", default="1/1", help="i/n : ne traite qu'une part des clips")
    ap.add_argument("--no-prune", action="store_true")
    a = ap.parse_args()

    if a.lang != "en":
        from piper import PiperVoice
        from piper.config import SynthesisConfig

    i, n = (int(x) for x in a.shard.split("/"))
    jobs = [j for j in json.loads(Path(a.jobs).read_text()) if (not a.lang or j["lang"] == a.lang) and shard_of(j["path"], n) == i - 1]
    out = Path(a.out)
    wanted = {j["path"] for j in jobs}

    if not a.no_prune:
        # Supprime les clips de cette part qui ne correspondent plus à aucun texte.
        for lang in [a.lang] if a.lang else ["fr", "en"]:
            folder = out / "audio" / jobs[0]["path"].split("/")[1] / lang if jobs else None
            if folder and folder.exists():
                for f in folder.glob("*.mp3"):
                    rel = f.relative_to(out).as_posix()
                    if shard_of(rel, n) == i - 1 and rel not in wanted:
                        f.unlink()

    todo = [j for j in jobs if not (out / j["path"]).exists()]
    print(f"part {i}/{n} : {len(jobs)} clips, {len(todo)} à générer", flush=True)
    voices = {}
    kokoro = None
    t0 = time.time()
    for k, j in enumerate(todo, 1):
        lang = j["lang"]
        dest = out / j["path"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            if lang in KOKORO:
                if kokoro is None:
                    from kokoro_onnx import Kokoro
                    kokoro = Kokoro(str(Path(a.voices) / "kokoro-v1.0.int8.onnx"), str(Path(a.voices) / "voices-v1.0.bin"))
                kokoro_wav(kokoro, j["text"], *KOKORO[lang], tmp.name)
            else:
                if lang not in voices:
                    voices[lang] = PiperVoice.load(str(Path(a.voices) / f"{VOICES[lang]}.onnx"))
                cfg = SynthesisConfig(length_scale=SPEED[lang], speaker_id=SPEAKER[lang])
                with wave.open(tmp.name, "wb") as w:
                    voices[lang].synthesize_wav(j["text"], w, syn_config=cfg)
            # MP3 mono 40 kb/s, volume égalisé, court silence en fin de clip.
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=0.15",
                 "-ac", "1", "-ar", "22050", "-c:a", "libmp3lame", "-b:a", "40k", str(dest) + ".part.mp3"],
                check=True,
            )
            os.replace(str(dest) + ".part.mp3", dest)
        if k % 100 == 0 or k == len(todo):
            print(f"  {k}/{len(todo)} ({time.time() - t0:.0f} s)", flush=True)


if __name__ == "__main__":
    sys.exit(main())
