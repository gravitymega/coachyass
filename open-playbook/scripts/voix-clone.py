#!/usr/bin/env python3
"""Clips de narration des vidéos lus avec la voix de l'utilisateur (clonage Chatterbox, licence MIT).

Les vidéos sont en anglais (render.py, VL = "en") : on ne génère que les clips anglais que les vidéos
utilisent (audio-index.json, écrit par npm run audio:jobs). Même chemin que les clips du site
(audio/v4/en/<empreinte>.mp3), dans un dossier à part (--out voix-perso), que render.py prend en
priorité : python3 render.py --all --audio voix-perso,https://gravitymega.github.io/coachyass

    python3 scripts/voix-clone.py --echantillon ma-voix.ogg                # tout
    python3 scripts/voix-clone.py --echantillon ma-voix.ogg --shard 3/20   # une part
    python3 scripts/voix-clone.py --echantillon ma-voix.ogg --ids pick-and-roll-central

Échantillon : la voix de l'utilisateur (demande du 9 nov. 2026), 10 s suffisent (le modèle n'en lit pas
plus). Il n'est pas dans le dépôt public : le workflow le lit dans le secret OP_VOIX_ECHANTILLON.

Contrôle : Whisper réécoute chaque prise. Le modèle ajoute parfois un bout de mot après la phrase
(« … not the air, and… ») : tout ce qui suit le dernier mot attendu est coupé. S'il manque un mot ou
qu'un mot est faux, la prise est refaite (autre graine), et on garde la meilleure des prises.
"""
import argparse, difflib, hashlib, json, os, re, subprocess, sys, tempfile, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
import importlib.util

_spec = importlib.util.spec_from_file_location("tts", Path(__file__).resolve().parent / "tts.py")
tts = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tts)  # même traitement du son que les clips du site (encode, FILTERS)

LANG = "en"
EXAGGERATION = 0.5   # 0.3 = posé, 0.7 = très expressif
CFG = 0.5
TRIES = 3            # prises au plus par phrase
NUM = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven",
       "8": "eight", "9": "nine", "10": "ten", "11": "eleven", "12": "twelve"}


def words(text):
    """Mots comparables : minuscules, sans ponctuation, chiffres en lettres, « pick-and-roll » = 3 mots."""
    out = []
    for w in re.findall(r"[a-z0-9']+", text.lower().replace("-", " ")):
        w = w.strip("'")
        if w.endswith("'s"):
            w = w[:-2]
        if w:
            out.append(NUM.get(w, w))
    return out


def check(whisper, wav, expected):
    """(erreurs, fin du dernier mot attendu en secondes ou None)."""
    segs, _ = whisper.transcribe(wav, language=LANG, word_timestamps=True, beam_size=5,
                                 condition_on_previous_text=False, vad_filter=False)
    heard = []  # (mot, fin)
    for s in segs:
        for w in s.words or []:
            for x in words(w.word):
                heard.append((x, w.end))
    exp = words(expected)
    sm = difflib.SequenceMatcher(a=exp, b=[h[0] for h in heard], autojunk=False)
    matched = sum(b.size for b in sm.get_matching_blocks())
    last_b = None
    for b in sm.get_matching_blocks():
        if b.size:
            last_b = b.b + b.size - 1
    # Erreurs = mots attendus absents ou faux (les mots en trop après la fin sont coupés, pas comptés).
    errors = len(exp) - matched
    if last_b is not None:
        errors += last_b + 1 - matched  # mots entendus en trop avant le dernier mot attendu
    end = heard[last_b][1] if last_b is not None else None
    return errors, end, len(heard) - (last_b + 1 if last_b is not None else 0)


def cut(src, dst, end):
    """Garde le son jusqu'à la fin du dernier mot attendu (+ 0,12 s), fondu de sortie court."""
    if end is None:
        os.replace(src, dst)
        return
    t = end + 0.12
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-t", f"{t:.3f}",
                    "-af", f"afade=t=out:st={max(0, t - 0.08):.3f}:d=0.08", dst], check=True)


def prepare_sample(src, dst):
    """Mono 24 kHz, silence du début retiré, volume égalisé, 10 s (ce que le modèle lit)."""
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "24000", "-af",
                    "highpass=f=70,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,loudnorm=I=-20:TP=-2",
                    "-t", "10", dst], check=True)


def jobs_for(ids=None):
    index = json.loads((ROOT / "audio-index.json").read_text(encoding="utf-8"))
    texts = {j["path"]: j["text"] for j in json.loads((ROOT / "audio-jobs.json").read_text(encoding="utf-8"))}
    paths = []
    for tid, entry in index.items():
        if ids and tid not in ids:
            continue
        paths += entry[LANG]
    seen, out = set(), []
    for p in paths:
        if p not in seen:
            seen.add(p)
            out.append({"path": p, "text": texts[p]})
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--echantillon", required=True, help="enregistrement de la voix (m4a, wav, ogg, mp3…)")
    ap.add_argument("--out", default=str(ROOT / "voix-perso"))
    ap.add_argument("--shard", default="1/1", help="i/n : ne traite qu'une part des clips")
    ap.add_argument("--ids", nargs="*", help="seulement les clips de ces fiches")
    ap.add_argument("--no-prune", action="store_true")
    a = ap.parse_args()

    i, n = (int(x) for x in a.shard.split("/"))
    jobs = [j for j in jobs_for(a.ids) if tts.shard_of(j["path"], n) == i - 1]
    out = Path(a.out)
    wanted = {j["path"] for j in jobs}
    if not a.no_prune and not a.ids and jobs:
        folder = out / Path(jobs[0]["path"]).parent
        if folder.exists():
            for f in folder.glob("*.mp3"):
                rel = f.relative_to(out).as_posix()
                if tts.shard_of(rel, n) == i - 1 and rel not in wanted:
                    f.unlink()
    todo = [j for j in jobs if not (out / j["path"]).exists()]
    print(f"part {i}/{n} : {len(jobs)} clips, {len(todo)} à générer", flush=True)
    if not todo:
        return

    import torch, torchaudio as ta
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    from faster_whisper import WhisperModel

    torch.set_num_threads(os.cpu_count() or 4)
    model = ChatterboxMultilingualTTS.from_pretrained(device="cuda" if torch.cuda.is_available() else "cpu")
    whisper = WhisperModel("small", device="cpu", compute_type="int8")
    with tempfile.TemporaryDirectory() as tmp:
        ref = f"{tmp}/ref.wav"
        prepare_sample(a.echantillon, ref)
        model.prepare_conditionals(ref, exaggeration=EXAGGERATION)
        t0, bad = time.time(), 0
        for k, j in enumerate(todo, 1):
            seed = int(hashlib.sha1(j["path"].encode()).hexdigest()[:6], 16)
            best = None  # (erreurs, mots en trop, fichier, fin)
            for attempt in range(TRIES):
                torch.manual_seed(seed + attempt)
                wav = model.generate(j["text"], language_id=LANG, exaggeration=EXAGGERATION, cfg_weight=CFG)
                raw = f"{tmp}/take{attempt}.wav"
                ta.save(raw, wav.cpu(), model.sr)
                errors, end, extra = check(whisper, raw, j["text"])
                if best is None or (errors, extra) < best[:2]:
                    best = (errors, extra, raw, end)
                if errors == 0:
                    break
            if best[0]:
                bad += 1
                print(f"  ! {j['path']} : {best[0]} mot(s) douteux après {TRIES} prises : {j['text']}", flush=True)
            dest = out / j["path"]
            dest.parent.mkdir(parents=True, exist_ok=True)
            cut(best[2], f"{tmp}/cut.wav", best[3])
            tts.encode(f"{tmp}/cut.wav", dest)
            if k % 25 == 0 or k == len(todo):
                print(f"  {k}/{len(todo)} ({time.time() - t0:.0f} s, {bad} douteux)", flush=True)


if __name__ == "__main__":
    sys.exit(main())
