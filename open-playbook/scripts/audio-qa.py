#!/usr/bin/env python3
"""Contrôle qualité des clips audio : Whisper réécoute chaque clip et compare avec le texte.

    pip install sherpa-onnx numpy
    python3 scripts/audio-qa.py --whisper <dossier sherpa-onnx-whisper-small> [--lang fr] [--sample 80] [--max 0.25]

Le modèle Whisper vient des releases de sherpa-onnx (asr-models/sherpa-onnx-whisper-small.tar.bz2, MIT).
Pour chaque clip : taux d'erreur de mots (WER) entre le texte et ce que Whisper entend, durée, silence au
début (la voix doit partir tout de suite, sinon l'animation semble en avance) et crête du signal.
Écrit audio-qa.json et affiche les clips au-dessus du seuil --max, du pire au meilleur.
Un WER de quelques % est normal (homophones, noms propres) ; au-delà de 25 %, le clip est à écouter.
"""
import argparse, json, random, re, subprocess, sys, unicodedata
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
NUM = {
    "fr": "zéro un deux trois quatre cinq six sept huit neuf dix onze".split(),
    "en": "zero one two three four five six seven eight nine ten eleven".split(),
}


def words(t, lang):
    t = re.sub(r"[⟦⟧]", "", t)
    t = re.sub(r"\b(\d|1[01])\b", lambda m: NUM[lang][int(m.group(1))], t)
    t = unicodedata.normalize("NFKD", t.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9 ]+", " ", t.replace("-", " ").replace("'", " ")).split()


def wer(ref, hyp):
    d = list(range(len(hyp) + 1))
    for i in range(1, len(ref) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(hyp) + 1):
            prev, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, prev + (ref[i - 1] != hyp[j - 1]))
    return d[len(hyp)] / max(1, len(ref))


def decode(path):
    """MP3 → échantillons 16 kHz mono (ffmpeg)."""
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768


def lead_silence(a, sr=16000):
    env = np.abs(a)
    above = np.nonzero(env > 10 ** (-40 / 20))[0]
    return float(above[0] / sr) if above.size else len(a) / sr


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--whisper", required=True)
    ap.add_argument("--jobs", default=str(ROOT / "audio-jobs.json"))
    ap.add_argument("--out", default=str(ROOT / "public"))
    ap.add_argument("--lang", choices=["fr", "en"])
    ap.add_argument("--sample", type=int, default=0, help="nombre de clips tirés au hasard (0 = tous)")
    ap.add_argument("--max", type=float, default=0.25, help="seuil de WER au-delà duquel un clip est signalé")
    a = ap.parse_args()
    import sherpa_onnx

    jobs = [j for j in json.loads(Path(a.jobs).read_text()) if (not a.lang or j["lang"] == a.lang) and (Path(a.out) / j["path"]).exists()]
    if a.sample:
        random.seed(1)
        jobs = random.sample(jobs, min(a.sample, len(jobs)))
    W = Path(a.whisper)
    recs = {}
    report = []
    for k, j in enumerate(jobs, 1):
        lang = j["lang"]
        if lang not in recs:
            recs[lang] = sherpa_onnx.OfflineRecognizer.from_whisper(
                encoder=str(W / "small-encoder.int8.onnx"), decoder=str(W / "small-decoder.int8.onnx"),
                tokens=str(W / "small-tokens.txt"), language=lang, task="transcribe", num_threads=4)
        audio = decode(Path(a.out) / j["path"])
        s = recs[lang].create_stream()
        s.accept_waveform(16000, audio)
        recs[lang].decode_stream(s)
        heard = s.result.text.strip()
        report.append({
            "path": j["path"], "lang": lang, "text": j["text"], "heard": heard,
            "wer": round(wer(words(j["text"], lang), words(heard, lang)), 3),
            "duration": round(len(audio) / 16000, 2), "lead": round(lead_silence(audio), 3),
            "peak_db": round(20 * np.log10(max(1e-6, float(np.abs(audio).max()))), 1),
        })
        if k % 25 == 0:
            print(f"  {k}/{len(jobs)}", flush=True)
    report.sort(key=lambda r: -r["wer"])
    Path(ROOT / "audio-qa.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
    bad = [r for r in report if r["wer"] > a.max]
    for lang in sorted({r["lang"] for r in report}):
        rs = [r for r in report if r["lang"] == lang]
        print(f"{lang} : {len(rs)} clips, WER moyen {np.mean([r['wer'] for r in rs]):.3f}, "
              f"silence au début max {max(r['lead'] for r in rs):.2f} s, crête max {max(r['peak_db'] for r in rs)} dB")
    for r in bad:
        print(f"[{r['wer']:.2f}] {r['path']}\n   texte : {r['text']}\n   entendu : {r['heard']}")
    print(f"{len(bad)} clip(s) au-dessus de {a.max}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
