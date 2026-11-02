#!/usr/bin/env python3
"""Open Playbook : vidéos MP4 d'une fiche animée (pycairo + ffmpeg).

Pour chaque fiche, dans videos/<id>/ :
    <id>-vertical.mp4 (1080×1920), <id>-square.mp4 (1080×1080), <id>-horizontal.mp4 (1920×1080),
    une miniature PNG par vidéo et <id>-voix.txt (texte de voix off FR/EN avec les temps).
La vidéo montre le titre et le placement de départ, l'animation étape par étape
avec les légendes FR/EN, puis l'écran final « Pourquoi ça marche / Why it works ».
Le format vertical a le style « Short » : titres néon, terrain en perspective, anneaux lumineux
sous les joueurs, trajets brillants et petit rythme de fond synthétisé (sans droits d'auteur).

Usage :
    python3 render.py horns-flare                     # une fiche, 3 formats
    python3 render.py horns-flare zipper              # plusieurs fiches
    python3 render.py --all                           # toutes les fiches (npm run videos)
    python3 render.py --all --formats vertical        # un seul format
    python3 render.py --all --shard 2/8               # une part sur 8 (rendu en parallèle)
    python3 render.py horns-flare --channel "Ma chaîne"  # nom affiché en bas (ou OP_CHANNEL=...)
    python3 render.py --all --audio public              # avec la voix (clips de scripts/tts.py)
    python3 render.py --all --audio https://gravitymega.github.io/coachyass  # clips publiés du site

Voix : avec --audio, chaque vidéo reçoit deux pistes, français (par défaut) puis anglais,
lues aux mêmes moments que sur le site. Une étape dure assez longtemps pour que sa phrase finisse
dans les deux langues. Il faut audio-index.json (npm run audio:jobs).

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
import urllib.request
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
INTRO0, OUTRO0 = 2.5, 5.0  # sans voix ; avec voix, allongés si la phrase est plus longue
INTRO, OUTRO = INTRO0, OUTRO0

# Codes visuels
BLUE = (0x1F / 255, 0x5F / 255, 0xD1 / 255)
RED = (0xD7 / 255, 0x26 / 255, 0x3D / 255)
ORANGE = (0xF0 / 255, 0x8A / 255, 0x24 / 255)
INK = (0.11, 0.14, 0.2)
BG = (0.06, 0.1, 0.17)
# Terrain : parquet clair, raquette peinte (mêmes valeurs que COLORS dans src/engine.ts)
BOARD = (0xE9 / 255, 0xC8 / 255, 0x9B / 255)
PLANK = (0xDD / 255, 0xB8 / 255, 0x86 / 255)
PAINT = (0xC9 / 255, 0x8E / 255, 0x5A / 255)
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


def step_timings(steps, voice=None):
    """voice[k] : durée de la phrase lue à l'étape k (la plus longue des deux langues), pour l'attendre."""
    t, out = 0.0, []
    for k, s in enumerate(steps):
        move = TIMELINE["move"] if s.get("m") else 0.0
        pas = TIMELINE["pass"] if s.get("p") else 0.0
        read = read_time(s["c"])
        if voice:
            read = max(read, voice[k] + 0.4 - move - pas)
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
    """Demi-terrain : x de -3 à 53, y de -5 à 47 (pieds), ligne de fond en haut.
    full : terrain entier (y jusqu'à 99). horizontal : terrain couché, la première ligne de fond à gauche."""

    X0, Y0, FW = -3.0, -5.0, 56.0

    def __init__(self, x, y, w, full=False, horizontal=False):
        self.full, self.horizontal = full, horizontal
        self.FH = 104.0 if full else 52.0
        self.x, self.y = x, y
        # w : largeur à l'écran (la longueur du terrain si horizontal).
        self.s = w / (self.FH if horizontal else self.FW)
        self.w0, self.h0 = self.FW * self.s, self.FH * self.s  # taille avant rotation
        self.w, self.h = (self.h0, self.w0) if horizontal else (self.w0, self.h0)

    def pt0(self, p):
        return (self.x + (p[0] - self.X0) * self.s, self.y + (p[1] - self.Y0) * self.s)

    def pt(self, p):
        x, y = self.pt0(p)
        if not self.horizontal:
            return (x, y)
        return (self.x + (y - self.y), self.y + self.w0 - (x - self.x))

    def court(self, cr):
        cr.save()
        if self.horizontal:  # le terrain est dessiné dans son repère, puis tourné d'un quart de tour
            cr.translate(self.x, self.y + self.w0)
            cr.rotate(-math.pi / 2)
            cr.translate(-self.x, -self.y)
        self.court_upright(cr)
        cr.restore()

    def court_upright(self, cr):
        s = self.s
        pt = self.pt0
        cr.save()
        rounded(cr, self.x, self.y, self.w0, self.h0, 28)
        cr.clip_preserve()
        cr.set_source_rgb(*BOARD)
        cr.fill()
        x0, y0 = pt((0, 0))
        cr.set_source_rgb(*PLANK)  # lattes du parquet, une sur deux
        for i in range(-2, 28, 2):
            cr.rectangle(x0 + i * 2 * s, self.y, 2 * s, self.h0)
        cr.fill()
        cr.set_source_rgba(*PAINT, 0.55)  # raquette(s) peinte(s)
        for y_top in ((0, 75) if self.full else (0,)):
            px, py = pt((17, y_top))
            cr.rectangle(px, py, 16 * s, 19 * s)
        cr.fill()
        cr.reset_clip()
        if self.full:  # seconde moitié : symétrique par rapport à la ligne médiane
            for mirror in (False, True):
                cr.save()
                if mirror:
                    cr.translate(0, 2 * self.y + (94 - 2 * self.Y0) * s)
                    cr.scale(1, -1)
                self.half_lines(cr, s, pt)
                cr.restore()
            cr.restore()
            return
        self.half_lines(cr, s, pt)
        cr.restore()

    def half_lines(self, cr, s, pt):
        cr.set_source_rgb(*INK)
        cr.set_line_width(0.18 * s)
        cr.set_line_join(cairo.LINE_JOIN_ROUND)
        x0, y0 = pt((0, 0))
        cr.rectangle(x0, y0, 50 * s, 47 * s)  # lignes de touche, fond, médiane
        cr.stroke()
        px, py = pt((17, 0))
        cr.rectangle(px, py, 16 * s, 19 * s)  # raquette
        cr.stroke()
        cx, cy = pt((25, 19))
        cr.arc(cx, cy, 6 * s, 0, math.pi)  # cercle des lancers francs (demi extérieur)
        cr.stroke()
        cr.set_dash([0.8 * s, 0.8 * s])
        cr.arc(cx, cy, 6 * s, math.pi, 2 * math.pi)
        cr.stroke()
        cr.set_dash([])
        bx, by = pt((25, 5.25))
        cr.arc(bx, by, 4 * s, 0, math.pi)  # zone de non-charge
        cr.stroke()
        a = math.asin(22 / 23.75)  # ligne à 3 points : corners à 3 pieds des lignes
        yc = 5.25 + 23.75 * math.cos(a)
        for x in (3, 47):
            cr.move_to(*pt((x, 0)))
            cr.line_to(*pt((x, yc)))
            cr.stroke()
        cr.arc(bx, by, 23.75 * s, math.pi / 2 - a, math.pi / 2 + a)
        cr.stroke()
        mx, my = pt((25, 47))
        cr.arc(mx, my, 6 * s, math.pi, 2 * math.pi)  # rond central
        cr.stroke()
        cr.set_line_width(0.3 * s)
        cr.move_to(*pt((22, 4)))
        cr.line_to(*pt((28, 4)))  # planche
        cr.stroke()
        cr.set_source_rgb(*ORANGE)
        cr.set_line_width(0.22 * s)
        cr.arc(bx, by, 0.75 * s, 0, 2 * math.pi)  # cercle
        cr.stroke()

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
# Nom de la chaîne affiché en bas de chaque vidéo : --channel ou variable d'environnement OP_CHANNEL.
CHANNEL = os.environ.get("OP_CHANNEL", "Playbook Ouvert · Open Playbook")


class Layout:
    """Mise en page d'un format. `k` met à l'échelle les tailles de texte du format vertical."""

    def __init__(self, name, w, h, k, board, cap, footer_y):
        self.name, self.W, self.H, self.k = name, w, h, k
        self.board = board  # Board placé
        self.cap = cap  # (x, y, largeur) du bloc de légende
        self.footer_y = footer_y
        self.margin = 60 * k if name != "horizontal" else 70


def layouts(full=False):
    m = 60
    if full:  # terrain entier : couché dans les formats carré et horizontal, légende dessous ou à droite
        return {
            "vertical": Layout("vertical", 1080, 1920, 1.0, Board(250, 360, 580, full=True), (m, 1500, 1080 - 2 * m), 1850),
            "square": Layout("square", 1080, 1080, 0.68, Board(40, 200, 1000, full=True, horizontal=True), (60, 800, 960), 1045),
            "horizontal": Layout("horizontal", 1920, 1080, 0.9, Board(50, 240, 1240, full=True, horizontal=True), (1330, 320, 540), 1045),
        }
    return {
        # 1080×1920 : titre, terrain pleine largeur, légende dessous.
        "vertical": Layout("vertical", 1080, 1920, 1.0, Board(m, 360, 1080 - 2 * m), (m, 360 + 52 * (960 / 56) + 90, 1080 - 2 * m), 1850),
        # 1080×1080 : titre en haut, terrain à gauche, légende à droite.
        "square": Layout("square", 1080, 1080, 0.68, Board(40, 210, 580), (650, 290, 390), 1045),
        # 1920×1080 : titre en haut à gauche, terrain à gauche, légende à droite.
        "horizontal": Layout("horizontal", 1920, 1080, 0.9, Board(70, 205, 880), (1010, 300, 840), 1045),
    }


def header(cr, L, t, cat_label):
    k, m = L.k, L.margin
    width = L.W - 2 * m
    text(cr, cat_label.upper(), m, 120 * k if L.name == "vertical" else 70, 38 * k, ORANGE, FONT_COND, bold=True)
    top = 190 * k if L.name == "vertical" else 70 + 68 * k
    y = paragraph(cr, t["name"]["fr"], m, top, 72 * k, width, WHITE, FONT_COND, bold=True, leading=1.05)
    if t["name"]["en"] != t["name"]["fr"]:
        paragraph(cr, t["name"]["en"], m, y + 6 * k, 44 * k, width, MUTED, FONT_COND)


def caption_block(cr, L, c, label=None):
    x, y, width = L.cap
    k = L.k
    if label:
        text(cr, label, x, y, 34 * k, ORANGE, FONT_COND, bold=True)
        y += 62 * k
    y = paragraph(cr, c["fr"], x, y, 50 * k, width, WHITE, FONT, bold=True, leading=1.2)
    paragraph(cr, c["en"], x, y + 18 * k, 42 * k, width, MUTED, FONT, leading=1.2)


def draw_frame(cr, L, t, cat_label, timings, states, time):
    if L.name == "vertical":
        return draw_frame_neon(cr, L, t, cat_label, timings, states, time)
    cr.set_source_rgb(*BG)
    cr.paint()
    header(cr, L, t, cat_label)
    b = L.board
    b.court(cr)
    steps = t["steps"]
    total = timings[-1]["end"]
    k = L.k
    if time < INTRO:  # titre + placement de départ
        pos, ball = states[0]
        b.players(cr, pos, ball_spot(pos[ball]) if ball in pos else None)
        caption_block(cr, L, {"fr": "Placement de départ", "en": "Starting positions"})
    elif time < INTRO + total:
        i, pos, ball = snapshot(t, timings, states, time - INTRO)
        before, ball0 = states[i]
        after, _ = states[i + 1]
        step = steps[i]
        for pid, mv in step.get("m", {}).items():
            b.arrow(cr, before[pid], (mv[0], mv[1]), mv[2], pid.startswith("x"))
        if step.get("p") and ball0 in after:
            b.arrow(cr, after[ball0], after[step["p"]], "pass", False)
        b.players(cr, pos, ball)
        caption_block(cr, L, step["c"], f"ÉTAPE {i + 1}/{len(steps)}  ·  STEP {i + 1}/{len(steps)}")
    else:  # écran final
        pos, ball = states[-1]
        b.players(cr, pos, ball_spot(pos[ball]) if ball in pos else None)
        x, y, width = L.cap
        if L.name == "vertical":
            cr.set_source_rgba(*BG, 0.88)
            cr.rectangle(0, b.y - 20, L.W, L.H - b.y + 20)
            cr.fill()
            y = b.y + 120
        text(cr, "POURQUOI ÇA MARCHE", x, y, 64 * k, ORANGE, FONT_COND, bold=True)
        text(cr, "WHY IT WORKS", x, y + 64 * k, 44 * k, MUTED, FONT_COND, bold=True)
        y = paragraph(cr, t["why"]["fr"], x, y + 170 * k, 50 * k, width, WHITE, FONT, bold=True)
        paragraph(cr, t["why"]["en"], x, y + 30 * k, 42 * k, width, MUTED, FONT)
    text(cr, CHANNEL, L.W / 2, L.footer_y, 32 * max(k, 0.8), MUTED, FONT_COND, align="center")


# ------------------------------------------------------- style « Short » ---
# Format vertical façon Shorts / Reels : gros titres néon, terrain en perspective,
# anneaux lumineux sous les joueurs, trajets brillants, petit rythme de fond.
LIME = (0.80, 1.0, 0.24)
ELEC = (0.25, 0.55, 1.0)
PINK = (1.0, 0.30, 0.42)
NIGHT = (0.03, 0.05, 0.11)
FAMILIES = json.loads((DATA / "families.json").read_text(encoding="utf-8")) if (DATA / "families.json").exists() else {}


def mix(a, b, k):
    return tuple(a[i] + (b[i] - a[i]) * k for i in range(3))


def glow_path(cr, color, core_width, fill=False):
    """Trace le chemin courant avec un halo néon (traits larges et transparents, puis cœur clair)."""
    for w, a in ((core_width * 7, 0.06), (core_width * 4.2, 0.10), (core_width * 2.4, 0.18), (core_width * 1.5, 0.35)):
        cr.set_source_rgba(*color, a)
        cr.set_line_width(w)
        cr.stroke_preserve()
    cr.set_source_rgb(*mix(color, WHITE, 0.45))
    if fill:
        cr.fill_preserve()
    cr.set_line_width(core_width)
    cr.stroke()


def neon_text(cr, s, x, y, size, color, align="center", family=FONT_COND):
    cr.select_font_face(family, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    cr.set_font_size(size)
    ext = cr.text_extents(s)
    if align == "center":
        x -= ext.x_advance / 2
    cr.new_path()
    cr.move_to(x, y)
    cr.text_path(s)
    for w, a in ((size * 0.30, 0.05), (size * 0.18, 0.09), (size * 0.09, 0.18)):
        cr.set_source_rgba(*color, a)
        cr.set_line_width(w)
        cr.stroke_preserve()
    cr.set_source_rgb(*mix(color, WHITE, 0.55))
    cr.fill_preserve()
    cr.set_source_rgba(*color, 0.9)
    cr.set_line_width(max(1.5, size * 0.018))
    cr.stroke()


def neon_block(cr, s, cx, y, width, color, size, min_size, max_lines, leading=0.98):
    """Texte en majuscules, réduit jusqu'à tenir en `max_lines` lignes ; renvoie le y suivant."""
    s = s.upper()
    while True:
        lines = wrap(cr, s, size, width, FONT_COND, True)
        if len(lines) <= max_lines or size <= min_size:
            break
        size -= 4
    for line in lines[:max_lines]:
        y += size * 0.82
        neon_text(cr, line, cx, y, size, color)
        y += size * (leading - 0.82)
    return y


class NeonBoard:
    """Demi-terrain vu de la ligne médiane, en hauteur : la ligne de fond est au loin, en haut."""

    def __init__(self, cx, far_y, near_y, width, y_max=48.0, d0=39.0):
        """Le bord lointain (derrière la ligne de fond) est à l'écran en far_y, le bord proche (y = y_max) en near_y.
        y_max < 48 rapproche la caméra du panier quand les joueurs restent dans la moitié haute."""
        self.cx, self.y_max, self.d0 = cx, y_max, d0
        dn, df = d0, d0 + y_max + 4
        self.F = width * dn / 56.0  # la largeur de la vue (56 pieds) tient dans `width` au premier plan
        self.cam_h = (near_y - far_y) / (self.F * (1 / dn - 1 / df))
        self.top = near_y - self.F * self.cam_h / dn

    def depth(self, y):
        return self.d0 + (self.y_max - y)

    def pt(self, p, h=0.0):
        d = self.depth(p[1])
        return (self.cx + (p[0] - 25) * self.F / d, self.top + self.F * (self.cam_h - h) / d)

    def scale(self, y):
        return self.F / self.depth(y)

    def poly(self, cr, pts):
        cr.new_path()
        for i, p in enumerate(pts):
            (cr.move_to if i == 0 else cr.line_to)(*self.pt(p))

    def arc_pts(self, c, r, a0, a1, n=48):
        return [(c[0] + r * math.cos(a0 + (a1 - a0) * i / n), c[1] + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]

    def court(self, cr):
        cr.save()
        self.poly(cr, [(-3, -4), (53, -4), (53, self.y_max), (-3, self.y_max)])
        cr.close_path()
        cr.clip_preserve()  # rien sous le bord proche
        # Parquet sombre et lustré, raquette teintée.
        g = cairo.LinearGradient(0, self.pt((25, -4))[1], 0, self.pt((25, self.y_max))[1])
        g.add_color_stop_rgb(0, *mix(PLANK, NIGHT, 0.55))
        g.add_color_stop_rgb(1, *mix(BOARD, NIGHT, 0.25))
        cr.set_source(g)
        cr.fill()
        cr.set_source_rgba(1, 1, 1, 0.05)
        for i in range(-2, 28, 2):
            self.poly(cr, [(i * 2, -4), (i * 2 + 2, -4), (i * 2 + 2, self.y_max), (i * 2, self.y_max)])
            cr.close_path()
            cr.fill()
        # Le terrain entier se voit quand le cadrage dépasse la ligne médiane : seconde moitié en miroir (y → 94 - y).
        halves = (False, True) if self.y_max > 47 else (False,)
        flip = lambda pts, m: [(x, 94 - y) for x, y in pts] if m else pts
        for m in halves:
            self.poly(cr, flip([(17, 0), (33, 0), (33, 19), (17, 19)], m))
            cr.close_path()
            cr.set_source_rgba(*ELEC, 0.28)
            cr.fill()
        # Lignes blanches légèrement lumineuses.
        a = math.asin(22 / 23.75)
        yc = 5.25 + 23.75 * math.cos(a)
        half = [
            [(17, 0), (17, 19), (33, 19), (33, 0)],
            self.arc_pts((25, 19), 6, 0, 2 * math.pi),
            self.arc_pts((25, 5.25), 4, 0, math.pi),
            [(3, 0), (3, yc)] + self.arc_pts((25, 5.25), 23.75, math.pi / 2 + a, math.pi / 2 - a) + [(47, yc), (47, 0)],
            self.arc_pts((25, 47), 6, math.pi, 2 * math.pi),
        ]
        lines = [[(0, 0), (50, 0), (50, 94), (0, 94), (0, 0)] if len(halves) > 1 else [(0, 0), (50, 0), (50, 47), (0, 47), (0, 0)]]
        lines += [[(0, 47), (50, 47)]] if len(halves) > 1 else []
        for m in halves:
            lines += [flip(pts, m) for pts in half]
        cr.set_line_join(cairo.LINE_JOIN_ROUND)
        for pts in lines:
            self.poly(cr, pts)
            cr.set_source_rgba(1, 1, 1, 0.12)
            cr.set_line_width(7)
            cr.stroke_preserve()
            cr.set_source_rgba(1, 1, 1, 0.85)
            cr.set_line_width(2.4)
            cr.stroke()
        cr.restore()
        # Second panier, au premier plan, seulement s'il est dans le cadre.
        if self.y_max >= 86:
            self.hoop(cr, 94 - 4, 94 - 5.25)
        self.hoop(cr, 4, 5.25)

    def hoop(self, cr, y_board, y_rim):
        """Planche et cercle, en hauteur."""
        cr.new_path()
        p1, p2 = self.pt((22, y_board), 9.5), self.pt((28, y_board), 13)
        cr.rectangle(p1[0], p2[1], p2[0] - p1[0], p1[1] - p2[1])
        cr.set_source_rgba(1, 1, 1, 0.25)
        cr.fill_preserve()
        cr.set_source_rgba(1, 1, 1, 0.9)
        cr.set_line_width(2)
        cr.stroke()
        cr.new_path()
        for i in range(41):
            q = (25 + 0.9 * math.cos(i * math.pi / 20), y_rim + 0.9 * math.sin(i * math.pi / 20))
            (cr.move_to if i == 0 else cr.line_to)(*self.pt(q, 10))
        glow_path(cr, ORANGE, 2.5)

    def arrow(self, cr, a, b, kind, defender):
        dist = math.hypot(b[0] - a[0], b[1] - a[1])
        if dist < 1.2:
            return
        ux, uy = (b[0] - a[0]) / dist, (b[1] - a[1]) / dist
        nx, ny = -uy, ux
        end = (b[0] - ux * 1.9, b[1] - uy * 1.9)
        color = PINK if defender else (ELEC if kind == "pass" else WHITE)
        pts = [a]
        if kind == "d":
            n = max(4, int(dist / 1.1))
            for i in range(1, n):
                k, off = i / n, 0.55 * (1 if i % 2 else -1)
                pts.append((a[0] + (end[0] - a[0]) * k + nx * off, a[1] + (end[1] - a[1]) * k + ny * off))
        pts.append(end)
        cr.save()
        cr.set_line_cap(cairo.LINE_CAP_ROUND)
        cr.set_line_join(cairo.LINE_JOIN_ROUND)
        if kind == "pass":
            cr.set_dash([10, 14])
        self.poly(cr, pts)
        glow_path(cr, color, 4)
        cr.set_dash([])
        if kind == "s":
            self.poly(cr, [(end[0] + nx * 1.3, end[1] + ny * 1.3), (end[0] - nx * 1.3, end[1] - ny * 1.3)])
            glow_path(cr, color, 6)
        else:
            h = 1.3
            self.poly(cr, [(end[0] + ux * 0.4, end[1] + uy * 0.4), (end[0] - ux * h + nx * h * 0.6, end[1] - uy * h + ny * h * 0.6),
                           (end[0] - ux * h - nx * h * 0.6, end[1] - uy * h - ny * h * 0.6)])
            cr.close_path()
            glow_path(cr, color, 3, fill=True)
        cr.restore()

    def ring(self, cr, p, r, color, width):
        cr.new_path()
        for i in range(49):
            q = (p[0] + r * math.cos(i * math.pi / 24), p[1] + r * math.sin(i * math.pi / 24))
            (cr.move_to if i == 0 else cr.line_to)(*self.pt(q))
        cr.close_path()
        glow_path(cr, color, width)

    def players(self, cr, pos, ball, pulse=0.0):
        # Du plus loin au plus proche, pour que les pions proches passent devant.
        for pid, p in sorted(pos.items(), key=lambda kv: kv[1][1]):
            d = pid.startswith("x")
            color = PINK if d else LIME
            self.ring(cr, p, 2.9 + 0.3 * pulse, color if d else WHITE, 2.4)
            self.ring(cr, p, 1.9, color, 3.4)
            sc = self.scale(p[1])
            fx, fy = self.pt(p)
            hx, hy = self.pt(p, 4.6)
            cr.new_path()  # « corps » : trait lumineux du sol au pion
            cr.move_to(fx, fy)
            cr.line_to(hx, hy)
            cr.set_source_rgba(*color, 0.35)
            cr.set_line_width(0.5 * sc)
            cr.stroke()
            r = 1.7 * sc
            cr.new_path()
            cr.arc(hx, hy, r, 0, 2 * math.pi)
            cr.set_source_rgb(*(mix(RED, NIGHT, 0.1) if d else mix(BLUE, NIGHT, 0.1)))
            cr.fill_preserve()
            glow_path(cr, color, 0.16 * sc)
            label = pid[1] if d else pid
            text(cr, label, hx, hy + 0.75 * sc, 2.1 * sc, WHITE, FONT_COND, bold=True, align="center")
        if ball:
            bx, by = self.pt(ball, 3.6)
            r = 0.95 * self.scale(ball[1])
            cr.new_path()
            cr.arc(bx, by, r, 0, 2 * math.pi)
            glow_path(cr, ORANGE, max(2, r * 0.25), fill=True)


def neon_background(cr, L):
    g = cairo.LinearGradient(0, 0, 0, L.H)
    g.add_color_stop_rgb(0, 0.10, 0.06, 0.20)
    g.add_color_stop_rgb(0.5, *NIGHT)
    g.add_color_stop_rgb(1, 0.16, 0.07, 0.04)
    cr.set_source(g)
    cr.paint()
    # Arcs concentriques colorés en haut et en bas (motif « arc-en-ciel » des Shorts).
    colors = (LIME, WHITE, ELEC, ORANGE)
    for row, (y, up) in enumerate(((-30, False), (L.H + 30, True))):
        for i in range(5):
            cx = 110 + i * 215
            c = colors[(i + row) % len(colors)]
            for j, r in enumerate((80, 58, 36)):
                cr.new_path()
                if up:
                    cr.arc(cx, y, r, math.pi, 2 * math.pi)
                else:
                    cr.arc(cx, y, r, 0, math.pi)
                cr.set_source_rgba(*c, 0.55 - j * 0.12)
                cr.set_line_width(16)
                cr.stroke()


def neon_board(states, full=False):
    """Cadrage par fiche : la caméra s'approche du panier si tous les joueurs restent près de lui."""
    ys = [p[1] for pos, _ in states for p in pos.values()]
    y_max = min(98.0 if full else 48.0, max(30.0, max(ys) + 6))
    return NeonBoard(540, 640, 1215, 1070, y_max)


_NEON_STATIC = {}


def neon_static(L, t, cat_label, states):
    """Fond, titre et terrain : identiques sur toute la vidéo, dessinés une seule fois."""
    key = (t["id"], L.W, L.H)
    if key not in _NEON_STATIC:
        _NEON_STATIC.clear()
        surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, L.W, L.H)
        c = cairo.Context(surf)
        neon_background(c, L)
        # Haut : catégorie puis nom de la tactique, en néon.
        neon_text(c, cat_label.split("·")[0].strip().upper(), L.W / 2, 205, 44, ORANGE)
        neon_block(c, t["name"]["fr"], L.W / 2, 225, 980, LIME, 140, 72, 2)
        b = neon_board(states, t.get("court") == "full")
        b.court(c)
        _NEON_STATIC[key] = (surf, b)
    return _NEON_STATIC[key]


def draw_frame_neon(cr, L, t, cat_label, timings, states, time):
    W = L.W
    steps = t["steps"]
    total = timings[-1]["end"]
    static, b = neon_static(L, t, cat_label, states)
    cr.set_source_surface(static, 0, 0)
    cr.paint()
    pulse = 0.5 + 0.5 * math.sin(time * 2 * math.pi / 1.2)
    fam = FAMILIES.get(t.get("family") or "", {}).get("fr", "")
    if time < INTRO:
        pos, ball = states[0]
        b.players(cr, pos, ball_spot(pos[ball]) if ball in pos else None, pulse)
        bottom = (fam or "Placement de départ", "Starting positions", None)
    elif time < INTRO + total:
        i, pos, ball = snapshot(t, timings, states, time - INTRO)
        before, ball0 = states[i]
        after, _ = states[i + 1]
        step = steps[i]
        for pid, mv in step.get("m", {}).items():
            b.arrow(cr, before[pid], (mv[0], mv[1]), mv[2], pid.startswith("x"))
        if step.get("p") and ball0 in after:
            b.arrow(cr, after[ball0], after[step["p"]], "pass", False)
        b.players(cr, pos, ball, pulse)
        bottom = (step["c"]["fr"], step["c"]["en"], f"ÉTAPE {i + 1}/{len(steps)}")
    else:
        pos, ball = states[-1]
        b.players(cr, pos, ball_spot(pos[ball]) if ball in pos else None, pulse)
        bottom = (t["why"]["fr"], t["why"]["en"], "POURQUOI ÇA MARCHE")
    cr.set_source_surface(neon_caption(L, *bottom), 0, 0)
    cr.paint()


_NEON_CAPTIONS = {}


def neon_caption(L, main, alt, label):
    """Bloc de texte du bas (étape, phrase néon, traduction, marque) : dessiné une fois par étape."""
    key = (main, alt, label, L.W)
    if key in _NEON_CAPTIONS:
        return _NEON_CAPTIONS[key]
    if len(_NEON_CAPTIONS) > 40:
        _NEON_CAPTIONS.clear()
    W = L.W
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, L.W, L.H)
    cr = cairo.Context(surf)
    y = 1245
    if label:
        cr.select_font_face(FONT_COND, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
        cr.set_font_size(40)
        w = cr.text_extents(label).x_advance + 56
        rounded(cr, W / 2 - w / 2, y, w, 64, 32)
        cr.set_source_rgba(*ORANGE, 0.18)
        cr.fill_preserve()
        glow_path(cr, ORANGE, 2.5)
        text(cr, label, W / 2, y + 46, 40, WHITE, FONT_COND, bold=True, align="center")
        y += 84
    end = label == "POURQUOI ÇA MARCHE"
    y = neon_block(cr, main, W / 2, y, 980, WHITE if end else LIME, 80, 40, 6 if end else 4, leading=1.0)
    alt_lines = wrap(cr, alt, 34, W - 140, FONT)
    room = int((1735 - (y + 44)) // 42) + 1
    if room >= len(alt_lines):  # la traduction anglaise seulement si elle tient en entier
        for line in alt_lines:
            y += 42
            text(cr, line, W / 2, y + 6, 34, MUTED, FONT, align="center")
    # Bas : marque de la chaîne dans un cadre lumineux.
    cr.select_font_face(FONT_COND, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    cr.set_font_size(34)
    w = cr.text_extents(CHANNEL.upper()).x_advance + 60
    rounded(cr, W / 2 - w / 2, 1752, w, 70, 14)
    cr.set_source_rgba(*NIGHT, 0.85)
    cr.fill_preserve()
    glow_path(cr, ELEC, 2)
    text(cr, CHANNEL.upper(), W / 2, 1799, 34, WHITE, FONT_COND, bold=True, align="center")


    _NEON_CAPTIONS[key] = surf
    return surf


def beat_track(duration, path, bpm=100, rate=22050):
    """Petit rythme de fond (grosse caisse, claquement, charleston), synthétisé : aucun droit d'auteur."""
    import array, random, wave as wavmod
    rnd = random.Random(7)
    beat = 60.0 / bpm
    n = int(duration * rate)
    buf = array.array("h", bytes(2 * n))
    noise = [rnd.uniform(-1, 1) for _ in range(rate)]
    for i in range(n):
        t = i / rate
        tb = t % beat
        k = math.sin(2 * math.pi * (48 * tb + 110 * (1 - math.exp(-28 * tb)) / 28)) * math.exp(-7 * tb)
        nb = int(t / beat)
        clap = noise[i % rate] * math.exp(-25 * tb) * 0.35 if nb % 2 == 1 else 0.0
        th = (t + beat / 2) % beat
        hat = noise[(i * 7) % rate] * math.exp(-90 * th) * 0.18
        bass = math.sin(2 * math.pi * (55 if (nb // 4) % 2 == 0 else 65.4) * t) * 0.18 * math.exp(-2.5 * tb)
        v = (k * 0.75 + clap + hat + bass)
        fade = min(1.0, t / 0.6, (duration - t) / 1.2)
        buf[i] = int(max(-1, min(1, v * 0.8 * fade)) * 32000)
    with wavmod.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(buf.tobytes())


COVER = 0.7  # secondes de couverture au début de chaque vidéo (YouTube, Reels et TikTok la proposent comme miniature)
RED_BAND = (0.70, 0.10, 0.12)


def split_title(name):
    """Deux lignes pour la couverture : avant / après « : », « contre », sinon au milieu."""
    for sep in (" : ", ": ", " contre ", " vs "):
        if sep in name:
            a, b = name.split(sep, 1)
            return a.strip(), (b if sep in (" : ", ": ") else sep.strip() + " " + b).strip()
    words = name.split()
    if len(words) < 2:
        return name, ""
    best, cut = 1e9, 1
    for i in range(1, len(words)):
        d = abs(len(" ".join(words[:i])) - len(" ".join(words[i:])))
        if d < best:
            best, cut = d, i
    return " ".join(words[:cut]), " ".join(words[cut:])


def fit_size(cr, s, width, size, min_size=30):
    cr.select_font_face(FONT_COND, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD)
    while size > min_size:
        cr.set_font_size(size)
        if cr.text_extents(s).x_advance <= width:
            break
        size -= 4
    return size


def draw_cover(cr, L, t, states):
    """Couverture : parquet et placement de départ en fond, bande noire en diagonale avec le nom en très gros."""
    W, H = L.W, L.H
    full = t.get("court") == "full"
    cr.set_source_rgb(*BOARD)
    cr.paint()
    if L.name == "vertical":
        b = Board(0, 0 if full else 260, W, full=full)
    else:
        b = Board(0, 0, W, full=full, horizontal=True)
    b.court(cr)
    pos, ball = states[0]
    b.players(cr, pos, ball_spot(pos[ball]) if ball in pos else None)
    cr.set_source_rgba(0, 0, 0, 0.18)
    cr.paint()
    k = min(W, H) / 1080
    # Bandeau du haut : nom de la chaîne.
    band = 120 * k
    cr.rectangle(0, 0, W, band)
    cr.set_source_rgb(*RED_BAND)
    cr.fill()
    text(cr, CHANNEL.upper(), W / 2, band * 0.66, 52 * k, WHITE, FONT_COND, bold=True, align="center")
    # Bande noire en diagonale, au centre.
    line1, line2 = split_title(t["name"]["fr"])
    bh = (0.36 if L.name == "vertical" else 0.52) * H
    cr.save()
    cr.translate(W / 2, H * (0.5 if L.name != "vertical" else 0.52))
    cr.rotate(-0.10)
    ext = W * 0.75
    for color, grow in ((RED_BAND, 14 * k), ((0.04, 0.04, 0.05), 0)):
        cr.rectangle(-ext - 40, -bh / 2 - grow, 2 * ext + 80, bh + 2 * grow)
        cr.set_source_rgb(*color)
        cr.fill()
    width = W * 0.86
    size1 = fit_size(cr, line1.upper(), width, bh * (0.42 if line2 else 0.6))
    size2 = fit_size(cr, line2.upper(), width, bh * 0.36) if line2 else 0
    total = size1 * 0.8 + (size2 * 0.8 + bh * 0.06 if line2 else 0)
    y = -total / 2 + size1 * 0.8
    text(cr, line1.upper(), 0, y, size1, ORANGE, FONT_COND, bold=True, align="center")
    if line2:
        text(cr, line2.upper(), 0, y + bh * 0.06 + size2 * 0.8, size2, WHITE, FONT_COND, bold=True, align="center")
    url = "gravitymega.github.io/coachyass"
    cr.select_font_face(FONT_COND, cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_NORMAL)
    cr.set_font_size(30 * k)
    text(cr, url, W * 0.44 - cr.text_extents(url).x_advance, bh / 2 - 18 * k, 30 * k, MUTED, FONT_COND)  # aligné à droite, dans le cadre
    cr.restore()


def thumbnail(t, L, cat_label, timings, states, path):
    """Miniature PNG = couverture (nom de la tactique en très gros)."""
    surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, L.W, L.H)
    draw_cover(cairo.Context(surface), L, t, states)
    surface.write_to_png(str(path))
    return surface


def voice_script(t, timings, path):
    """Texte à lire en voix off, FR puis EN, avec le moment de chaque phrase dans la vidéo."""
    def at(sec):
        sec += COVER
        return f"{int(sec // 60)}:{sec % 60:04.1f}"

    end = INTRO + timings[-1]["end"]
    lines = [f"# {t['name']['fr']} / {t['name']['en']}", f"# {t['id']} — durée / duration {at(end + OUTRO)}", ""]
    for lang, intro, why in (("fr", "Placement de départ.", "Pourquoi ça marche :"), ("en", "Starting positions.", "Why it works:")):
        lines.append("## Français" if lang == "fr" else "## English")
        lines.append(f"[{at(0)}] {t['name'][lang]}. {intro}")
        for s, tm in zip(t["steps"], timings):
            lines.append(f"[{at(INTRO + tm['start'])}] {s['c'][lang]}")
        lines.append(f"[{at(end)}] {why} {t['why'][lang]}")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


# ------------------------------------------------------------------ voix ---
AUDIO_INDEX = ROOT / "audio-index.json"


def fetch_clip(source, rel, cache):
    """Chemin local d'un clip : dossier (--audio public) ou site publié (--audio https://…)."""
    if not source.startswith("http"):
        p = Path(source) / rel
        return p if p.exists() else None
    p = cache / rel
    if not p.exists():
        p.parent.mkdir(parents=True, exist_ok=True)
        try:
            with urllib.request.urlopen(f"{source.rstrip('/')}/{rel}", timeout=30) as r:
                p.write_bytes(r.read())
        except Exception:
            return None
    return p


def clip_duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def load_voice(t, source, cache):
    """{fr: [(chemin, durée)…], en: […]} pour [présentation, étapes…, conclusion], ou None si un clip manque."""
    if not source:
        return None
    if not AUDIO_INDEX.exists():
        sys.exit("audio-index.json manquant : lance d'abord npm run audio:jobs")
    entry = json.loads(AUDIO_INDEX.read_text(encoding="utf-8")).get(t["id"])
    if not entry:
        return None
    voice = {}
    for lang in ("fr", "en"):
        clips = [fetch_clip(source, rel, cache) for rel in entry[lang]]
        if not clips or any(c is None for c in clips) or len(clips) != len(t["steps"]) + 2:
            return None
        voice[lang] = [(c, clip_duration(c)) for c in clips]
    return voice


def voice_track(clips, starts, duration, out):
    """Place chaque clip à son moment et produit une piste AAC de la durée de la vidéo."""
    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    for c, _ in clips:
        cmd += ["-i", str(c)]
    parts = [f"[{i}:a]adelay={int(s * 1000)}:all=1[a{i}]" for i, s in enumerate(starts)]
    mix = "".join(f"[a{i}]" for i in range(len(clips)))
    graph = ";".join(parts) + f";{mix}amix=inputs={len(clips)}:normalize=0,apad,atrim=0:{duration:.3f}[out]"
    cmd += ["-filter_complex", graph, "-map", "[out]", "-ac", "1", "-ar", "44100", "-c:a", "aac", "-b:a", "96k", str(out)]
    subprocess.run(cmd, check=True)


def with_beat(tid, tracks, duration):
    """Pistes du format vertical : rythme seul, ou voix + rythme discret."""
    tmp = Path(tempfile.gettempdir())
    beat = tmp / f"op-{tid}-beat.wav"
    beat_track(duration, beat)
    out = []
    for i, track in enumerate(tracks or [None]):
        dest = tmp / f"op-{tid}-mix{i}.m4a"
        if track is None:
            cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(beat), "-af", "volume=0.5", "-ac", "1", "-ar", "44100", "-c:a", "aac", "-b:a", "96k", str(dest)]
        else:
            cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", str(track), "-i", str(beat), "-filter_complex",
                   "[1:a]volume=0.16[m];[0:a][m]amix=inputs=2:normalize=0:duration=first[out]", "-map", "[out]",
                   "-ac", "1", "-ar", "44100", "-c:a", "aac", "-b:a", "96k", str(dest)]
        subprocess.run(cmd, check=True)
        out.append(dest)
    beat.unlink(missing_ok=True)
    return out


def render(t, cat_label, out_dir, formats, audio=None, cache=None):
    global INTRO, OUTRO
    voice = load_voice(t, audio, cache)
    INTRO, OUTRO = INTRO0, OUTRO0
    step_voice = None
    if voice:
        dur = [max(a[1], b[1]) for a, b in zip(voice["fr"], voice["en"])]
        INTRO = max(INTRO0, dur[0] + 0.4)
        step_voice = dur[1:-1]
        OUTRO = max(OUTRO0, dur[-1] + 0.8)
    timings = step_timings(t["steps"], step_voice)
    states = frames(t)
    duration = INTRO + timings[-1]["end"] + OUTRO
    total = COVER + duration  # la couverture passe d'abord
    tracks = []
    if voice:
        starts = [COVER + s for s in [0.15] + [INTRO + tm["start"] for tm in timings] + [INTRO + timings[-1]["end"]]]
        for lang in ("fr", "en"):
            track = Path(tempfile.gettempdir()) / f"op-{t['id']}-{lang}.m4a"
            voice_track(voice[lang], starts, total, track)
            tracks.append(track)
    folder = out_dir / t["id"]
    folder.mkdir(parents=True, exist_ok=True)
    made = []
    for name in formats:
        L = layouts(t.get("court") == "full")[name]
        out = folder / f"{t['id']}-{name}.mp4"
        audio_in, audio_map = [], []
        fmt_tracks = tracks
        if name == "vertical":  # style Short : rythme de fond, sous la voix s'il y en a une
            fmt_tracks = with_beat(t["id"], tracks, total)
        for i, (track, lang) in enumerate(zip(fmt_tracks, ("fra", "eng") if tracks else ("zxx",))):
            audio_in += ["-i", str(track)]
            audio_map += ["-map", f"{i + 1}:a", f"-metadata:s:a:{i}", f"language={lang}",
                          f"-metadata:s:a:{i}", f"title={ {'fra': 'Français', 'eng': 'English'}.get(lang, 'Musique') }",
                          f"-disposition:a:{i}", "default" if i == 0 else "0"]
        # Couverture : miniature PNG, image de couverture du MP4 et premières images de la vidéo.
        thumb = folder / f"{t['id']}-{name}.png"
        cover = thumbnail(t, L, cat_label, timings, states, thumb)
        n_in = 1 + len(audio_in) // 2
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{L.W}x{L.H}",
               "-r", str(FPS), "-i", "-", *audio_in, "-i", str(thumb), "-map", "0:v", *audio_map,
               "-map", f"{n_in}:v", "-c:v:0", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt:v:0", "yuv420p",
               "-c:v:1", "png", "-disposition:v:1", "attached_pic",
               *(["-c:a", "copy"] if fmt_tracks else []), "-movflags", "+faststart", str(out)]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        cover.flush()
        cover_bytes = bytes(cover.get_data())
        for _ in range(int(COVER * FPS)):
            proc.stdin.write(cover_bytes)
        surface = cairo.ImageSurface(cairo.FORMAT_ARGB32, L.W, L.H)
        cr = cairo.Context(surface)
        for i in range(int(duration * FPS)):
            draw_frame(cr, L, t, cat_label, timings, states, i / FPS)
            surface.flush()
            proc.stdin.write(bytes(surface.get_data()))
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError(f"ffmpeg a échoué pour {t['id']} ({name})")
        for tr in fmt_tracks:
            if tr not in tracks:
                tr.unlink(missing_ok=True)
        made.append(out)
    voice_script(t, timings, folder / f"{t['id']}-voix.txt")
    for track in tracks:
        track.unlink(missing_ok=True)
    return folder, made, bool(voice)


def main():
    global CHANNEL
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="*", help="id des fiches à générer")
    ap.add_argument("--all", action="store_true", help="toutes les fiches animées")
    ap.add_argument("--out", default="videos", help="dossier de sortie")
    ap.add_argument("--formats", default="vertical,square,horizontal", help="formats séparés par des virgules")
    ap.add_argument("--channel", default=CHANNEL, help="nom de la chaîne affiché en bas des vidéos")
    ap.add_argument("--shard", default="1/1", help="i/n : ne génère qu'une part des fiches (rendu en parallèle)")
    ap.add_argument("--audio", help="voix : dossier contenant audio/ (ex. public) ou adresse du site publié")
    args = ap.parse_args()
    CHANNEL = args.channel
    formats = [f.strip() for f in args.formats.split(",") if f.strip()]
    bad = [f for f in formats if f not in layouts()]
    if bad:
        sys.exit(f"Format inconnu : {', '.join(bad)} (vertical, square, horizontal)")
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
    si, sn = (int(x) for x in args.shard.split("/"))
    todo = todo[si - 1 :: sn]
    cache = Path(tempfile.gettempdir()) / "op-audio-cache"
    out_dir = (ROOT / args.out) if not Path(args.out).is_absolute() else Path(args.out)
    for n, t in enumerate(todo, 1):
        if not t.get("steps"):
            print(f"– {t['id']} : pas d'animation, ignorée")
            continue
        folder, made, voiced = render(t, cats.get(t["cat"], t["cat"]), out_dir, formats, args.audio, cache)
        shown = folder.relative_to(ROOT) if folder.is_relative_to(ROOT) else folder
        sound = "voix FR + EN" if voiced else ("sans voix (clip manquant)" if args.audio else "sans voix")
        print(f"✓ [{n}/{len(todo)}] {shown}/ : {len(made)} vidéo(s), {len(made)} miniature(s), {sound}", flush=True)


if __name__ == "__main__":
    main()
