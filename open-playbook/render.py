#!/usr/bin/env python3
"""Open Playbook : vidéo MP4 verticale 1080×1920 d'une fiche animée (pycairo + ffmpeg).

La vidéo montre le titre et le placement de départ, l'animation étape par étape
avec les légendes FR/EN, puis l'écran final « Pourquoi ça marche / Why it works ».

Usage :
    python3 render.py horns-flare            # une fiche
    python3 render.py horns-flare zipper     # plusieurs fiches
    python3 render.py --all                  # toutes les fiches animées
    python3 render.py --all --out videos     # dossier de sortie (défaut : videos)

Timeline (identique au site, lue dans data/timeline.json) :
    déplacements 1,5 s, passe 0,85 s, puis lecture = max(2,2 s ; 0,13 s × mots FR+EN).
"""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"


def setup_fonts():
    """Rend Barlow (paquets @fontsource, licence OFL) visible par cairo, sans rien installer."""
    dirs = [ROOT / "node_modules" / "@fontsource" / n / "files" for n in ("barlow", "barlow-condensed")]
    dirs = [d for d in dirs if d.is_dir()]
    if not dirs:
        print("⚠ Polices Barlow absentes : lance « npm install ». Police de secours utilisée.", file=sys.stderr)
        return
    conf = Path(tempfile.gettempdir()) / "open-playbook-fonts.conf"
    entries = "\n".join(f"  <dir>{d}</dir>" for d in dirs)
    conf.write_text(
        '<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n'
        f"  <include ignore_missing=\"yes\">/etc/fonts/fonts.conf</include>\n{entries}\n</fontconfig>\n",
        encoding="utf-8",
    )
    os.environ["FONTCONFIG_FILE"] = str(conf)


setup_fonts()
import cairo  # noqa: E402  (après la configuration des polices)

W, H, FPS = 1080, 1920, 30
INTRO, OUTRO = 2.5, 5.0

# Codes visuels
BLUE = (0x1F / 255, 0x5F / 255, 0xD1 / 255)
RED = (0xD7 / 255, 0x26 / 255, 0x3D / 255)
ORANGE = (0xF0 / 255, 0x8A / 255, 0x24 / 255)
INK = (0.11, 0.14, 0.2)
BG = (0.06, 0.1, 0.17)
BOARD = (1, 1, 1)
WHITE = (1, 1, 1)
MUTED = (0.72, 0.77, 0.85)

FONT = "Barlow"
FONT_COND = "Barlow Condensed"

PLAYER_IDS = ["1", "2", "3", "4", "5", "x1", "x2", "x3", "x4", "x5"]
TIMELINE = json.loads((DATA / "timeline.json").read_text(encoding="utf-8"))


# --------------------------------------------------------------- timeline ---
def read_time(c):
    words = len(c["fr"].split()) + len(c["en"].split())
    return max(TIMELINE["readMin"], TIMELINE["readPerWord"] * words)


def step_timings(steps):
    t, out = 0.0, []
    for s in steps:
        move = TIMELINE["move"] if s.get("m") else 0.0
        pas = TIMELINE["pass"] if s.get("p") else 0.0
        read = read_time(s["c"])
        out.append({"start": t, "move": move, "pass": pas, "read": read, "end": t + move + pas + read})
        t += move + pas + read
    return out


def frames(t):
    """États figés : 0 = départ, k = après l'étape k."""
    pos = {p: tuple(t["start"][p]) for p in PLAYER_IDS if p in t["start"]}
    ball = t["start"].get("b")
    out = [(dict(pos), ball)]
    for s in t.get("steps", []):
        for pid, mv in s.get("m", {}).items():
            pos[pid] = (mv[0], mv[1])
        if s.get("p"):
            ball = s["p"]
        out.append((dict(pos), ball))
    return out


def ease(x):
    return 2 * x * x if x < 0.5 else 1 - (-2 * x + 2) ** 2 / 2


def lerp(a, b, k):
    return (a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)


def ball_spot(p):
    return (p[0] + 1.05, p[1] - 1.05)


def snapshot(t, timings, states, time):
    """Positions des joueurs et du ballon au temps `time` de l'animation."""
    k = next((i for i, s in enumerate(timings) if time < s["end"]), len(timings) - 1)
    tm, (before, ball0), (after, _) = timings[k], states[k], states[k + 1]
    local = max(0.0, time - tm["start"])
    mk = ease(min(1.0, local / tm["move"])) if tm["move"] else 1.0
    pos = {p: lerp(before.get(p, after[p]), after[p], mk) for p in after}
    step = t["steps"][k]
    ball = None
    if step.get("p") and ball0 and local >= tm["move"]:
        pk = min(1.0, (local - tm["move"]) / tm["pass"])
        ball = lerp(ball_spot(pos[ball0]), ball_spot(pos[step["p"]]), ease(pk))
    elif ball0 in pos:
        ball = ball_spot(pos[ball0])
    return k, pos, ball


# ---------------------------------------------------------------- dessin ---
class Board:
    """Demi-terrain : x de -3 à 53, y de -5 à 47 (pieds), ligne de fond en haut."""

    X0, Y0, FW, FH = -3.0, -5.0, 56.0, 52.0

    def __init__(self, x, y, w):
        self.x, self.y, self.s = x, y, w / self.FW
        self.w, self.h = w, self.FH * self.s

    def pt(self, p):
        return (self.x + (p[0] - self.X0) * self.s, self.y + (p[1] - self.Y0) * self.s)

    def court(self, cr):
        s = self.s
        cr.save()
        rounded(cr, self.x, self.y, self.w, self.h, 28)
        cr.set_source_rgb(*BOARD)
        cr.fill()
        cr.set_source_rgb(*INK)
        cr.set_line_width(0.18 * s)
        cr.set_line_join(cairo.LINE_JOIN_ROUND)
        x0, y0 = self.pt((0, 0))
        cr.rectangle(x0, y0, 50 * s, 47 * s)  # lignes de touche, fond, médiane
        cr.stroke()
        px, py = self.pt((17, 0))
        cr.rectangle(px, py, 16 * s, 19 * s)  # raquette
        cr.stroke()
        cx, cy = self.pt((25, 19))
        cr.arc(cx, cy, 6 * s, 0, math.pi)  # cercle des lancers francs (demi extérieur)
        cr.stroke()
        cr.set_dash([0.8 * s, 0.8 * s])
        cr.arc(cx, cy, 6 * s, math.pi, 2 * math.pi)
        cr.stroke()
        cr.set_dash([])
        bx, by = self.pt((25, 5.25))
        cr.arc(bx, by, 4 * s, 0, math.pi)  # zone de non-charge
        cr.stroke()
        a = math.asin(22 / 23.75)  # ligne à 3 points : corners à 3 pieds des lignes
        yc = 5.25 + 23.75 * math.cos(a)
        for x in (3, 47):
            cr.move_to(*self.pt((x, 0)))
            cr.line_to(*self.pt((x, yc)))
            cr.stroke()
        cr.arc(bx, by, 23.75 * s, math.pi / 2 - a, math.pi / 2 + a)
        cr.stroke()
        mx, my = self.pt((25, 47))
        cr.arc(mx, my, 6 * s, math.pi, 2 * math.pi)  # rond central
        cr.stroke()
        cr.set_line_width(0.3 * s)
        cr.move_to(*self.pt((22, 4)))
        cr.line_to(*self.pt((28, 4)))  # planche
        cr.stroke()
        cr.set_source_rgb(*ORANGE)
        cr.set_line_width(0.22 * s)
        cr.arc(bx, by, 0.75 * s, 0, 2 * math.pi)  # cercle
        cr.stroke()
        cr.restore()

    def arrow(self, cr, a, b, kind, defender):
        s = self.s
        pa, pb = self.pt(a), self.pt(b)
        dx, dy = pb[0] - pa[0], pb[1] - pa[1]
        dist = math.hypot(dx, dy)
        if dist < 2:
            return
        ux, uy = dx / dist, dy / dist
        nx, ny = -uy, ux
        cr.save()
        cr.set_source_rgba(*(RED if defender else INK), 0.9)
        cr.set_line_width(0.22 * s)
        cr.set_line_cap(cairo.LINE_CAP_ROUND)
        end = (pb[0] - ux * 1.6 * s, pb[1] - uy * 1.6 * s)  # s'arrête avant le pion
        if kind == "d":  # dribble : zigzag
            n = max(4, int(dist / (1.2 * s)))
            cr.move_to(*pa)
            for i in range(1, n):
                k = i / n
                off = (0.55 * s) * (1 if i % 2 else -1)
                cr.line_to(pa[0] + (end[0] - pa[0]) * k + nx * off, pa[1] + (end[1] - pa[1]) * k + ny * off)
            cr.line_to(*end)
        else:
            if kind == "pass":
                cr.set_dash([0.35 * s, 0.7 * s])  # passe : pointillés
            cr.move_to(*pa)
            cr.line_to(*end)
        cr.stroke()
        cr.set_dash([])
        if kind == "s":  # écran : barre perpendiculaire
            cr.set_line_width(0.35 * s)
            cr.move_to(end[0] + nx * 1.1 * s, end[1] + ny * 1.1 * s)
            cr.line_to(end[0] - nx * 1.1 * s, end[1] - ny * 1.1 * s)
            cr.stroke()
        else:  # pointe de flèche
            h = 1.0 * s
            cr.move_to(end[0] + ux * 0.3 * s, end[1] + uy * 0.3 * s)
            cr.line_to(end[0] - ux * h + nx * h * 0.55, end[1] - uy * h + ny * h * 0.55)
            cr.line_to(end[0] - ux * h - nx * h * 0.55, end[1] - uy * h - ny * h * 0.55)
            cr.close_path()
            cr.fill()
        cr.restore()

    def players(self, cr, pos, ball):
        s = self.s
        for pid, p in pos.items():
            x, y = self.pt(p)
            if pid.startswith("x"):  # défense : X rouge
                r = 1.05 * s
                cr.set_source_rgb(*RED)
                cr.set_line_width(0.42 * s)
                cr.set_line_cap(cairo.LINE_CAP_ROUND)
                cr.move_to(x - r, y - r)
                cr.line_to(x + r, y + r)
                cr.move_to(x + r, y - r)
                cr.line_to(x - r, y + r)
                cr.stroke()
                text(cr, pid[1], x + 1.55 * s, y + 1.5 * s, 1.1 * s, RED, FONT_COND, bold=True, align="center")
            else:  # attaque : rond bleu numéroté
                cr.set_source_rgb(*BLUE)
                cr.new_path()
                cr.arc(x, y, 1.45 * s, 0, 2 * math.pi)
                cr.fill()
                text(cr, pid, x, y + 0.62 * s, 1.75 * s, WHITE, FONT_COND, bold=True, align="center")
        if ball:
            x, y = self.pt(ball)
            cr.set_source_rgb(*ORANGE)
            cr.new_path()
            cr.arc(x, y, 0.62 * s, 0, 2 * math.pi)
            cr.fill_preserve()
            cr.set_source_rgb(*INK)
            cr.set_line_width(0.1 * s)
            cr.stroke()


def rounded(cr, x, y, w, h, r):
    cr.new_sub_path()
    cr.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    cr.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    cr.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    cr.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    cr.close_path()


def text(cr, s, x, y, size, color, family=FONT, bold=False, align="left"):
    cr.select_font_face(family, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    cr.set_font_size(size)
    ext = cr.text_extents(s)
    if align == "center":
        x -= ext.x_advance / 2
    cr.set_source_rgb(*color)
    cr.move_to(x, y)
    cr.show_text(s)
    cr.new_path()  # sinon le prochain arc part du point courant du texte


def wrap(cr, s, size, width, family=FONT, bold=False):
    cr.select_font_face(family, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    cr.set_font_size(size)
    lines, cur = [], ""
    for word in s.split():
        trial = f"{cur} {word}".strip()
        if cr.text_extents(trial).x_advance > width and cur:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def paragraph(cr, s, x, y, size, width, color, family=FONT, bold=False, leading=1.22, align="left"):
    for line in wrap(cr, s, size, width, family, bold):
        text(cr, line, x + (width / 2 if align == "center" else 0), y, size, color, family, bold, align)
        y += size * leading
    return y


# ---------------------------------------------------------------- vidéo ---
MARGIN = 60
BOARD_BOX = Board(MARGIN, 360, W - 2 * MARGIN)


def header(cr, t, cat_label):
    text(cr, cat_label.upper(), MARGIN, 120, 38, ORANGE, FONT_COND, bold=True)
    y = paragraph(cr, t["name"]["fr"], MARGIN, 190, 72, W - 2 * MARGIN, WHITE, FONT_COND, bold=True, leading=1.05)
    if t["name"]["en"] != t["name"]["fr"]:
        paragraph(cr, t["name"]["en"], MARGIN, y + 6, 44, W - 2 * MARGIN, MUTED, FONT_COND)


def caption_block(cr, c, y, label=None):
    if label:
        text(cr, label, MARGIN, y, 34, ORANGE, FONT_COND, bold=True)
        y += 62
    y = paragraph(cr, c["fr"], MARGIN, y, 50, W - 2 * MARGIN, WHITE, FONT, bold=True, leading=1.2)
    paragraph(cr, c["en"], MARGIN, y + 18, 42, W - 2 * MARGIN, MUTED, FONT, leading=1.2)


def draw_frame(cr, t, cat_label, timings, states, time):
    cr.set_source_rgb(*BG)
    cr.paint()
    header(cr, t, cat_label)
    b = BOARD_BOX
    b.court(cr)
    cap_y = b.y + b.h + 90
    steps = t["steps"]
    total = timings[-1]["end"]
    if time < INTRO:  # titre + placement de départ
        pos, ball = states[0]
        b.players(cr, pos, ball_spot(pos[ball]) if ball in pos else None)
        caption_block(cr, {"fr": "Placement de départ", "en": "Starting positions"}, cap_y)
    elif time < INTRO + total:
        k, pos, ball = snapshot(t, timings, states, time - INTRO)
        before, ball0 = states[k]
        after, _ = states[k + 1]
        step = steps[k]
        for pid, mv in step.get("m", {}).items():
            b.arrow(cr, before[pid], (mv[0], mv[1]), mv[2], pid.startswith("x"))
        if step.get("p") and ball0 in after:
            b.arrow(cr, after[ball0], after[step["p"]], "pass", False)
        b.players(cr, pos, ball)
        caption_block(cr, step["c"], cap_y, f"ÉTAPE {k + 1}/{len(steps)}  ·  STEP {k + 1}/{len(steps)}")
    else:  # écran final
        pos, ball = states[-1]
        b.players(cr, pos, ball_spot(pos[ball]) if ball in pos else None)
        cr.set_source_rgba(*BG, 0.88)
        cr.rectangle(0, b.y - 20, W, H - b.y + 20)
        cr.fill()
        y = b.y + 120
        text(cr, "POURQUOI ÇA MARCHE", MARGIN, y, 64, ORANGE, FONT_COND, bold=True)
        text(cr, "WHY IT WORKS", MARGIN, y + 64, 44, MUTED, FONT_COND, bold=True)
        y = paragraph(cr, t["why"]["fr"], MARGIN, y + 170, 50, W - 2 * MARGIN, WHITE, FONT, bold=True)
        paragraph(cr, t["why"]["en"], MARGIN, y + 30, 42, W - 2 * MARGIN, MUTED, FONT)
    text(cr, "Playbook Ouvert · Open Playbook", W / 2, H - 70, 32, MUTED, FONT_COND, align="center")


def render(t, cat_label, out_dir):
    timings = step_timings(t["steps"])
    states = frames(t)
    duration = INTRO + timings[-1]["end"] + OUTRO
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{t['id']}.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{W}x{H}",
           "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "20",
           "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    cr = cairo.Context(surface)
    for i in range(int(duration * FPS)):
        draw_frame(cr, t, cat_label, timings, states, i / FPS)
        surface.flush()
        proc.stdin.write(bytes(surface.get_data()))
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError(f"ffmpeg a échoué pour {t['id']}")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="id des fiches à générer")
    ap.add_argument("--all", action="store_true", help="toutes les fiches animées")
    ap.add_argument("--out", default="videos", help="dossier de sortie")
    args = ap.parse_args()
    lib = json.loads((DATA / "tactics.json").read_text(encoding="utf-8"))
    cats = {c["id"]: f"{c['fr']} · {c['en']}" if c["fr"] != c["en"] else c["fr"] for c in lib["cats"]}
    by_id = {t["id"]: t for t in lib["tactics"]}
    if args.all:
        todo = [t for t in lib["tactics"] if t.get("steps")]
    else:
        unknown = [i for i in args.ids if i not in by_id]
        if unknown or not args.ids:
            sys.exit(f"Fiche inconnue : {', '.join(unknown)}" if unknown else "Donne un id de fiche ou --all.")
        todo = [by_id[i] for i in args.ids]
    out_dir = (ROOT / args.out) if not Path(args.out).is_absolute() else Path(args.out)
    for t in todo:
        if not t.get("steps"):
            print(f"– {t['id']} : pas d'animation, ignorée")
            continue
        print(f"✓ {render(t, cats.get(t['cat'], t['cat']), out_dir).relative_to(ROOT) if out_dir.is_relative_to(ROOT) else t['id']}")


if __name__ == "__main__":
    main()
