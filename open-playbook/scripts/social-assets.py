#!/usr/bin/env python3
"""Images des comptes « Gravity Playbook » : photo de profil (1080×1080) et bannière YouTube (2560×1440).
Même style que les vidéos (néon sur fond nuit), sans logo ni marque protégée.  python3 scripts/social-assets.py"""
import math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import render as R  # polices et fonctions de dessin des vidéos
cairo = R.cairo


def background(cr, w, h):
    g = cairo.LinearGradient(0, 0, 0, h)
    g.add_color_stop_rgb(0, 0.10, 0.06, 0.20)
    g.add_color_stop_rgb(1, *R.NIGHT)
    cr.set_source(g)
    cr.paint()


def court_lines(cr, cx, cy, r, alpha=0.35):
    cr.set_line_width(r * 0.025)
    cr.set_source_rgba(*R.LIME, alpha)
    cr.arc(cx, cy, r, 0, 2 * math.pi)
    cr.stroke()
    cr.arc(cx, cy, r * 0.45, 0, 2 * math.pi)
    cr.stroke()
    cr.move_to(cx - r, cy)
    cr.line_to(cx + r, cy)
    cr.stroke()


def avatar(path):
    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, 1080, 1080)
    cr = cairo.Context(s)
    background(cr, 1080, 1080)
    court_lines(cr, 540, 540, 430)
    R.neon_text(cr, "GRAVITY", 540, 520, 190, R.LIME)
    R.neon_text(cr, "PLAYBOOK", 540, 700, 150, R.ORANGE)
    s.write_to_png(str(path))


def banner(path):
    w, h = 2560, 1440
    s = cairo.ImageSurface(cairo.FORMAT_ARGB32, w, h)
    cr = cairo.Context(s)
    background(cr, w, h)
    court_lines(cr, w / 2, h / 2, 520, 0.22)
    # Zone visible sur tous les écrans : 1546×423 au centre.
    R.neon_text(cr, "GRAVITY PLAYBOOK", w / 2, h / 2 + 10, 150, R.LIME)
    R.text(cr, "BASKETBALL PLAYS, DEFENSES AND DRILLS, BROKEN DOWN", w / 2, h / 2 + 110, 54, R.WHITE, R.FONT_COND, bold=True, align="center")
    s.write_to_png(str(path))


if __name__ == "__main__":
    out = ROOT / "social"
    out.mkdir(exist_ok=True)
    avatar(out / "gravity-playbook-avatar.png")
    banner(out / "gravity-playbook-banner.png")
    print("social/gravity-playbook-avatar.png, social/gravity-playbook-banner.png")
