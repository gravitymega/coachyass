#!/usr/bin/env python3
"""Clips audio de la narration (voix libres, hors ligne, gratuites).

Lit audio-jobs.json (npm run audio:jobs) et écrit public/audio/<version>/<langue>/<empreinte>.mp3.
Les clips déjà présents sont gardés ; ceux qui ne servent plus sont supprimés.

    python3 scripts/tts.py --voices voices/                 # tout
    python3 scripts/tts.py --voices voices/ --lang fr --shard 1/4
    python3 scripts/tts.py --voices voices/ --text "⟦Pick-and-roll⟧ central." --lang fr --wav essai.wav

Voix : Kokoro-82M (Apache 2.0) pour les deux langues ; --voices doit contenir kokoro-v1.0.int8.onnx et
voices-v1.0.bin (releases de kokoro-onnx). Réglages dans VOICE ci-dessous.

Prononciation : en français, les passages entre ⟦…⟧ (src/pronounce.ts) sont phonétisés en anglais
(espeak en-us) et le reste en français (espeak fr-fr) ; les deux sont recollés et lus d'une traite par
la même voix. Le modèle a appris les deux langues : pick-and-roll, close-out ou Golden State Warriors
sont dits à l'anglaise, sans changer de voix ni couper la phrase.

Son : silences du début et de la fin coupés (la voix part dès le début du clip, ce qui cale l'animation),
coupure des graves parasites, volume égalisé à -16 LUFS, fondus de 10 ms (pas de clic), MP3 mono 24 kHz.
"""
import argparse, hashlib, json, os, re, subprocess, sys, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
# Voix par langue : nom Kokoro (ou mélange {voix: poids}), langue espeak, vitesse.
VOICE = {
    # Voix d'homme française (choix du 2 nov. 2026) : Kokoro n'a qu'une voix française (ff_siwis, femme) ;
    # mélangée à 45 % avec la voix d'homme italienne im_nicola, elle donne une voix d'homme (≈145 Hz) qui garde
    # la diction française. Banc d'essai Whisper sur 16 phrases du site : 20,6 % d'erreurs, contre 40 % pour
    # l'ancienne voix Piper « pierre ».
    "fr": ({"ff_siwis": 0.55, "im_nicola": 0.45}, "fr-fr", 1.0),
    "en": ("am_michael", "en-us", 1.0),
}
FILTERS = ",".join([
    # Coupe le silence au début, puis à la fin (en retournant le son).
    "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02",
    "areverse", "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05", "areverse",
    "highpass=f=70",
    "loudnorm=I=-16:TP=-1.5:LRA=7",
    "afade=t=in:d=0.01", "areverse", "afade=t=in:d=0.01", "areverse",
    "apad=pad_dur=0.12",
])


def style_of(kokoro, voice):
    """Voix Kokoro : un nom, ou un mélange pondéré de voix (vecteurs de style moyennés)."""
    if isinstance(voice, str):
        return voice
    total = sum(voice.values())
    return sum(kokoro.get_voice_style(k) * w for k, w in voice.items()) / total


MARK = re.compile(r"⟦(.+?)⟧")
# Petits mots français collés à un terme anglais : espeak les accentue quand ils sont seuls au bord
# d'un morceau (« ˈœ̃ hˈɛdʒ ») ; on retire cet accent pour garder la mélodie de la phrase.
SMALL = {"le", "la", "les", "un", "une", "des", "du", "de", "d'un", "d'une", "en", "au", "aux", "et", "ou", "sur", "par", "pour", "l'"}


def destress_edges(p, part, before_en, after_en):
    words = part.split()
    toks = p.split(" ")
    if not toks:
        return p
    if after_en and words and words[-1].lower().strip(",.;:") in SMALL:
        toks[-1] = toks[-1].replace("ˈ", "").replace("ˌ", "")
    if before_en and words and words[0].lower() in SMALL:
        toks[0] = toks[0].replace("ˈ", "").replace("ˌ", "")
    return " ".join(toks)


def phonemes(kokoro, text, lang):
    """Phonèmes d'un texte ; en français, les passages ⟦…⟧ sont phonétisés en anglais."""
    out = []
    parts = MARK.split(text)
    for i, part in enumerate(parts):
        if not part:
            continue
        p = kokoro.tokenizer.phonemize(part, "en-us" if i % 2 else lang)
        p = re.sub(r"\((?:en|fr|en-us|fr-fr)\)", "", p).strip()  # bascules de langue d'espeak
        if not p:
            continue
        if not i % 2 and len(parts) > 1:
            p = destress_edges(p, part, i > 0, i + 1 < len(parts) and bool(parts[i + 1]))
        lead = " " if part[:1].isspace() or (out and not re.match(r"[.,;:!?]", p)) else ""
        out.append(lead + p)
    return re.sub(r"\s+", " ", "".join(out)).strip()


def synth(kokoro, text, lang, path):
    """WAV d'un segment. Si le modèle rend un son vide ou trop court, on réessaie phrase par phrase."""
    import numpy as np
    import soundfile as sf

    voice, elang, speed = VOICE[lang]
    style = style_of(kokoro, voice)
    words = len(re.findall(r"\w+", MARK.sub(r"\1", text)))

    def run(t):
        a, sr = kokoro.create(phonemes(kokoro, t, elang), voice=style, speed=speed, is_phonemes=True)
        return np.nan_to_num(np.asarray(a, dtype=np.float32).reshape(-1)), sr

    audio, sr = run(text)
    # Moins de 0,12 s par mot : morceau perdu par le modèle ; on refait phrase par phrase.
    if audio.size < sr * max(0.3, 0.12 * words):
        parts = [p for p in re.split(r"(?<=[.!?:;])\s+", text) if p.strip()]
        chunks = []
        for p in parts:
            a, sr = run(p)
            chunks += [a, np.zeros(int(0.22 * sr), dtype=np.float32)]
        audio = np.concatenate(chunks) if chunks else audio
    sf.write(path, audio, sr)


def encode(wav, dest):
    tmp = str(dest) + ".part.mp3"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", wav, "-af", FILTERS, "-ac", "1", "-ar", "24000",
                    "-c:a", "libmp3lame", "-b:a", "56k", tmp], check=True)
    os.replace(tmp, dest)


def shard_of(path: str, n: int) -> int:
    return int(hashlib.sha1(path.encode()).hexdigest()[:8], 16) % n


def load_kokoro(folder):
    from kokoro_onnx import Kokoro
    return Kokoro(str(Path(folder) / "kokoro-v1.0.int8.onnx"), str(Path(folder) / "voices-v1.0.bin"))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--voices", default="voices", help="dossier du modèle Kokoro")
    ap.add_argument("--jobs", default=str(ROOT / "audio-jobs.json"))
    ap.add_argument("--out", default=str(ROOT / "public"))
    ap.add_argument("--lang", choices=["fr", "en"])
    ap.add_argument("--shard", default="1/1", help="i/n : ne traite qu'une part des clips")
    ap.add_argument("--no-prune", action="store_true")
    ap.add_argument("--text", help="essai : synthétise ce texte (avec --lang et --wav)")
    ap.add_argument("--wav", help="essai : fichier de sortie (.wav brut, ou .mp3 traité)")
    a = ap.parse_args()
    kokoro = load_kokoro(a.voices)

    if a.text:
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            synth(kokoro, a.text, a.lang or "fr", tmp.name)
            encode(tmp.name, a.wav) if a.wav.endswith(".mp3") else os.replace(tmp.name, a.wav)
        print(phonemes(kokoro, a.text, VOICE[a.lang or "fr"][1]))
        return

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
    t0 = time.time()
    for k, j in enumerate(todo, 1):
        dest = out / j["path"]
        dest.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            synth(kokoro, j["text"], j["lang"], tmp.name)
            encode(tmp.name, dest)
        if k % 100 == 0 or k == len(todo):
            print(f"  {k}/{len(todo)} ({time.time() - t0:.0f} s)", flush=True)


if __name__ == "__main__":
    sys.exit(main())
