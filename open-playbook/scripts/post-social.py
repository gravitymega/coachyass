#!/usr/bin/env python3
"""Publie la vidéo verticale du jour sur YouTube (Shorts) et Instagram (Reels) : comptes « Gravity Playbook ».

Une fiche par jour, dans un ordre fixe (systèmes d'abord, puis défense, transition, remises, principes, exercices).
Le rang du jour = nombre de jours depuis SOCIAL_START (variable du dépôt, AAAA-MM-JJ). Aucun état à garder.
La vidéo vient de la release GitHub « op-videos-vertical ». Titre, description et hashtags en anglais, sans lien.

Secrets GitHub (sinon la plate-forme est sautée, sans erreur) :
    YouTube   : YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN
    Instagram : IG_USER_ID, IG_ACCESS_TOKEN (jeton de Page longue durée, compte professionnel relié à une Page)

    python3 scripts/post-social.py                 # vidéo du jour
    python3 scripts/post-social.py --id hammer     # une fiche précise
    python3 scripts/post-social.py --dry           # affiche seulement ce qui serait publié
"""
import argparse, datetime, json, os, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = os.environ.get("GITHUB_REPOSITORY", "gravitymega/coachyass")
RELEASE = f"https://github.com/{REPO}/releases/download/op-videos-vertical"
ORDER = ["attaque", "zone_att", "defense", "transition", "remises", "principes", "exercices"]
TAGS = {"attaque": "offense", "zone_att": "zoneoffense", "defense": "defense", "transition": "transition",
        "remises": "inbounds", "principes": "basketballiq", "exercices": "basketballdrills"}
HOOK = {"attaque": "Film room", "zone_att": "Zone offense film room", "transition": "Transition film room",
        "remises": "Set play breakdown", "defense": "Defensive breakdown", "exercices": "Drill breakdown",
        "principes": "Coaching principle"}


def lineup():
    lib = json.loads((ROOT / "data/tactics.json").read_text(encoding="utf-8"))
    todo = [t for t in lib["tactics"] if t.get("steps")]
    return sorted(todo, key=lambda t: (ORDER.index(t["cat"]) if t["cat"] in ORDER else 99, t["lvl"]))


def texts(t):
    name = t["name"]["en"]
    hashtag = "#" + "".join(ch for ch in name.title() if ch.isalnum())[:30]
    tags = ["#basketball", "#basketballcoach", "#playbook", f"#{TAGS.get(t['cat'], 'basketball')}", hashtag, "#shorts"]
    title = f"{name} | {HOOK.get(t['cat'], 'Breakdown')} #shorts"
    if len(title) > 100:
        title = f"{name[:80]} #shorts"
    steps = "\n".join(f"{i}. {s['c']['en']}" for i, s in enumerate(t["steps"], 1))
    keys = "\n".join(f"- {k}" for k in t["keys"]["en"][:3])
    desc = f"{t['sum']['en']}\n\n{steps}\n\nKeys:\n{keys}\n\n{' '.join(tags)}"
    caption = f"{name} — {HOOK.get(t['cat'], 'Breakdown')}\n\n{t['sum']['en']}\n\nThe key: {t['keys']['en'][0]}\n\n{' '.join(tags[:-1])} #reels"
    return title, desc[:4900], caption[:2100]


def http(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.status, dict(r.headers), r.read()


def video_bytes(tid):
    _, _, body = http(f"{RELEASE}/{tid}-vertical.mp4")
    return body


def signed_url(tid):
    """Adresse directe (signée, quelques minutes) du MP4 : Meta télécharge la vidéo par URL."""
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None
    opener = urllib.request.build_opener(NoRedirect)
    try:
        opener.open(f"{RELEASE}/{tid}-vertical.mp4", timeout=60)
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 303, 307, 308):
            return e.headers["Location"]
        raise
    return f"{RELEASE}/{tid}-vertical.mp4"


def youtube(t, title, desc):
    cid, secret, refresh = (os.environ.get(k) for k in ("YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"))
    if not (cid and secret and refresh):
        print("YouTube : secrets absents, sauté")
        return
    form = urllib.parse.urlencode({"client_id": cid, "client_secret": secret, "refresh_token": refresh, "grant_type": "refresh_token"}).encode()
    token = json.loads(http("https://oauth2.googleapis.com/token", form)[2])["access_token"]
    meta = {"snippet": {"title": title, "description": desc, "categoryId": "17", "defaultLanguage": "en",
                        "tags": ["basketball", "basketball coach", "playbook", t["name"]["en"]]},
            "status": {"privacyStatus": "public", "selfDeclaredMadeForKids": False}}
    body = video_bytes(t["id"])
    _, h, _ = http("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
                   json.dumps(meta).encode(), {"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=UTF-8",
                                               "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": str(len(body))})
    _, _, res = http(h["Location"], body, {"Authorization": f"Bearer {token}", "Content-Type": "video/mp4"}, "PUT")
    print(f"YouTube : publié https://youtube.com/shorts/{json.loads(res)['id']}")


def instagram(t, caption):
    ig, token = os.environ.get("IG_USER_ID"), os.environ.get("IG_ACCESS_TOKEN")
    if not (ig and token):
        print("Instagram : secrets absents, sauté")
        return
    api = "https://graph.facebook.com/v21.0"
    form = urllib.parse.urlencode({"media_type": "REELS", "video_url": signed_url(t["id"]), "caption": caption,
                                   "share_to_feed": "true", "access_token": token}).encode()
    creation = json.loads(http(f"{api}/{ig}/media", form)[2])["id"]
    for _ in range(40):  # Meta télécharge et traite la vidéo : jusqu'à ~10 min
        time.sleep(15)
        q = urllib.parse.urlencode({"fields": "status_code", "access_token": token})
        status = json.loads(http(f"{api}/{creation}?{q}")[2]).get("status_code")
        if status == "FINISHED":
            break
        if status == "ERROR":
            sys.exit("Instagram : Meta n'a pas pu traiter la vidéo")
    form = urllib.parse.urlencode({"creation_id": creation, "access_token": token}).encode()
    print(f"Instagram : publié (media {json.loads(http(f'{api}/{ig}/media_publish', form)[2])['id']})")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--id", help="publier cette fiche plutôt que celle du jour")
    ap.add_argument("--dry", action="store_true")
    a = ap.parse_args()
    todo = lineup()
    if a.id:
        t = next((x for x in todo if x["id"] == a.id), None) or sys.exit(f"Fiche inconnue : {a.id}")
    else:
        start = datetime.date.fromisoformat(os.environ.get("SOCIAL_START") or "2026-11-04")
        day = (datetime.datetime.now(datetime.timezone.utc).date() - start).days
        if day < 0:
            return print(f"Début des publications le {start}")
        t = todo[day % len(todo)]
    title, desc, caption = texts(t)
    print(f"Fiche : {t['id']}\nTitre : {title}\n---\n{desc}\n---\n{caption}\n---")
    if a.dry:
        return
    failed = []
    for name, job in (("YouTube", lambda: youtube(t, title, desc)), ("Instagram", lambda: instagram(t, caption))):
        try:
            job()
        except urllib.error.HTTPError as e:
            failed.append(f"{name} : HTTP {e.code} {e.read()[:300]!r}")
        except Exception as e:  # une plate-forme en panne n'empêche pas l'autre
            failed.append(f"{name} : {e}")
    if failed:
        sys.exit("\n".join(failed))


if __name__ == "__main__":
    main()
