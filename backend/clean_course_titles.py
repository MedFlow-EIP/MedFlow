"""Nettoie les noms de cours générés avant la correction du prompt de titre :
« Cardiologie - Bases essentielles » devient « Cardiologie : Bases essentielles ».

À lancer une fois sur la VM :
    docker compose exec -T backend python clean_course_titles.py           # montre les changements
    docker compose exec -T backend python clean_course_titles.py --apply   # les applique

Les tirets à l'intérieur d'un mot (« Physico-Chimique ») ne sont pas touchés.
"""
import re
import sqlite3
import sys

from config import Config

DASH_BETWEEN_WORDS = re.compile(r"\s+[-–—]+\s+")


def clean_title(title: str) -> str:
    return DASH_BETWEEN_WORDS.sub(" : ", title).strip()


def clean_course_titles(db_path: str, apply: bool = False) -> list[tuple[str, str]]:
    """Renvoie les (ancien, nouveau) noms ; les enregistre seulement si ``apply``."""
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute("SELECT uid, course_id, nom FROM courses").fetchall()
        changes = [(uid, cid, nom, clean_title(nom)) for uid, cid, nom in rows if nom and clean_title(nom) != nom]
        if apply and changes:
            with conn:
                conn.executemany(
                    "UPDATE courses SET nom=? WHERE uid=? AND course_id=?",
                    [(new, uid, cid) for uid, cid, _, new in changes],
                )
        return [(old, new) for _, _, old, new in changes]
    finally:
        conn.close()


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    changes = clean_course_titles(Config.DATABASE_PATH, apply=apply)
    for old, new in changes:
        print(f"{old}  ->  {new}")
    print(f"{len(changes)} cours {'renommés' if apply else 'à renommer (relancer avec --apply)'}.")
