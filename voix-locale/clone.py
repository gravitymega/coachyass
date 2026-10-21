#!/usr/bin/env python3
"""Clonage de voix 100 % local et gratuit (Chatterbox Multilingue, licence MIT).

Rien n'est envoyé sur Internet : seul le modèle est téléchargé une fois (~3 Go),
puis tout tourne sur ton ordinateur. Utilise uniquement ta propre voix, ou celle
d'une personne qui a donné son accord.

    python clone.py --echantillon ma-voix.m4a --texte texte-voix-off.txt --sortie sortie/voix-off.wav
"""
import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

PAUSE_PHRASE = 0.30   # secondes entre deux phrases
PAUSE_PARAGRAPHE = 0.75
MAX_CHARS = 220       # le modèle est plus stable sur des phrases courtes


def ffmpeg_ok():
    return shutil.which('ffmpeg') is not None


def preparer_echantillon(src: Path, dst: Path, duree_max: float = 20.0):
    """Mono 24 kHz, silences de début retirés, volume égalisé, 20 s max."""
    if not ffmpeg_ok():
        print("ffmpeg absent : l'échantillon est utilisé tel quel (installe ffmpeg pour de meilleurs résultats).")
        return src
    dst.parent.mkdir(parents=True, exist_ok=True)
    filtre = ('highpass=f=70,'
              'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1,'
              'loudnorm=I=-20:TP=-2')
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-vn', '-ac', '1', '-ar', '24000',
                        '-af', filtre, '-t', str(duree_max), str(dst)], capture_output=True, text=True)
    if r.returncode:
        sys.exit('Échantillon illisible :\n' + r.stderr[-500:])
    return dst


def decouper(texte: str):
    """Liste de (phrase, pause_après_en_secondes)."""
    morceaux = []
    paragraphes = [p.strip() for p in re.split(r'\n\s*\n', texte.strip()) if p.strip()]
    for pi, para in enumerate(paragraphes):
        para = re.sub(r'\s+', ' ', para)
        phrases = [s.strip() for s in re.split(r'(?<=[.!?])\s+', para) if s.strip()]
        out = []
        for ph in phrases:
            while len(ph) > MAX_CHARS:  # phrase trop longue : coupe à la dernière virgule
                cut = max(ph.rfind(',', 0, MAX_CHARS), ph.rfind(';', 0, MAX_CHARS), ph.rfind(' ', 0, MAX_CHARS))
                cut = cut if cut > 40 else MAX_CHARS
                out.append(ph[:cut + 1].strip())
                ph = ph[cut + 1:].strip()
            if ph:
                out.append(ph)
        for si, ph in enumerate(out):
            fin_paragraphe = si == len(out) - 1
            morceaux.append((ph, PAUSE_PARAGRAPHE if fin_paragraphe else PAUSE_PHRASE))
    return morceaux


def choisir_appareil(torch, demande: str):
    if demande != 'auto':
        return demande
    if torch.cuda.is_available():
        return 'cuda'
    if getattr(torch.backends, 'mps', None) and torch.backends.mps.is_available():
        return 'mps'
    return 'cpu'


def main():
    ap = argparse.ArgumentParser(description='Cloner ma voix et lire un texte, en local et gratuitement.')
    ap.add_argument('--echantillon', required=True, help="enregistrement de ta voix (10 à 30 s, ou plus ; mémo vocal OK)")
    ap.add_argument('--texte', required=True, help='fichier .txt, ou le texte lui-même entre guillemets')
    ap.add_argument('--sortie', default='sortie/voix-off.wav')
    ap.add_argument('--langue', default='fr', help='code de langue (fr par défaut)')
    ap.add_argument('--expressivite', type=float, default=0.5, help='0.3 = posé, 0.7 = très expressif (défaut 0.5)')
    ap.add_argument('--fidelite', type=float, default=0.5, help='cfg : plus bas = rythme plus libre (défaut 0.5)')
    ap.add_argument('--graine', type=int, default=7, help='même graine = même résultat ; change-la pour une autre prise')
    ap.add_argument('--appareil', default='auto', choices=['auto', 'cpu', 'cuda', 'mps'])
    ap.add_argument('--preparer-seulement', action='store_true',
                    help="prépare et écoute l'échantillon nettoyé sans lancer le modèle")
    ap.add_argument('--consentement', action='store_true',
                    help="confirme que c'est ta voix ou celle d'une personne qui a donné son accord")
    a = ap.parse_args()

    ech = Path(a.echantillon)
    if not ech.exists():
        sys.exit(f'Échantillon introuvable : {ech}')
    sortie = Path(a.sortie)
    sortie.parent.mkdir(parents=True, exist_ok=True)

    ref = preparer_echantillon(ech, sortie.parent / 'echantillon-prepare.wav')
    print(f"Échantillon prêt : {ref}")
    if a.preparer_seulement:
        return

    if not a.consentement:
        rep = input("Cette voix est la tienne (ou la personne est d'accord) ? [o/N] ").strip().lower()
        if rep not in ('o', 'oui', 'y', 'yes'):
            sys.exit('Annulé : le clonage exige le consentement de la personne.')

    t = Path(a.texte)
    texte = t.read_text(encoding='utf-8') if t.exists() else a.texte
    morceaux = decouper(texte)
    if not morceaux:
        sys.exit('Le texte est vide.')

    try:
        import torch
        import torchaudio as ta
        from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    except ImportError:
        sys.exit("Chatterbox n'est pas installé. Lance d'abord :  pip install -r requirements.txt")

    appareil = choisir_appareil(torch, a.appareil)
    print(f"Chargement du modèle sur « {appareil} » (le premier lancement télécharge ~3 Go)…")
    modele = ChatterboxMultilingualTTS.from_pretrained(device=appareil)

    audios = []
    for i, (phrase, pause) in enumerate(morceaux, 1):
        print(f"[{i}/{len(morceaux)}] {phrase}")
        torch.manual_seed(a.graine + i)
        wav = modele.generate(phrase, language_id=a.langue, audio_prompt_path=str(ref),
                              exaggeration=a.expressivite, cfg_weight=a.fidelite)
        audios.append(wav.cpu())
        audios.append(torch.zeros(1, int(modele.sr * pause)))

    final = torch.cat(audios[:-1], dim=1)  # sans la pause finale
    crete = final.abs().max().item()
    if crete > 0:
        final = final * (0.89 / crete)     # crête à -1 dBFS
    ta.save(str(sortie), final, modele.sr)
    print(f"\nTerminé : {sortie}  ({final.shape[1] / modele.sr:.1f} s)")
    if ffmpeg_ok():
        mp3 = sortie.with_suffix('.mp3')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(sortie), '-b:a', '192k', str(mp3)])
        print(f"et en MP3 : {mp3}")


if __name__ == '__main__':
    main()
