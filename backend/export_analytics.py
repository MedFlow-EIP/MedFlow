"""Export des données d'usage pour la track EIP (objectif 2 : « ce qu'on mesure »).

À lancer sur la VM :
    docker compose exec -T backend python export_analytics.py [depuis AAAA-MM-JJ]

Écrit deux fichiers CSV dans data/exports/ :
- events-<date>.csv : un événement par ligne (utilisateur pseudonymisé) ;
- summary-<date>.csv : par événement, le nombre total et le nombre de personnes.
"""
import csv
import hashlib
import os
import sqlite3
import sys
from datetime import datetime, timezone

from config import Config


def pseudonym(uid: str) -> str:
    """Identifiant stable mais non réversible : on suit une personne sans savoir qui elle est."""
    return hashlib.sha256(uid.encode()).hexdigest()[:10]


def export(db_path: str, out_dir: str, since: str = "") -> tuple[str, str]:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    columns = {r["name"] for r in conn.execute("PRAGMA table_info(analytics_events)")}
    detail = "detail" if "detail" in columns else "NULL AS detail"
    rows = conn.execute(
        f"SELECT uid, event_type, screen, path_id, lesson_id, {detail}, created_at FROM analytics_events "
        "WHERE created_at >= ? ORDER BY created_at",
        (since,),
    ).fetchall()
    conn.close()

    os.makedirs(out_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    events_path = os.path.join(out_dir, f"events-{stamp}.csv")
    summary_path = os.path.join(out_dir, f"summary-{stamp}.csv")

    with open(events_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["personne", "evenement", "ecran", "detail", "parcours", "lecon", "date_utc"])
        for r in rows:
            writer.writerow([pseudonym(r["uid"]), r["event_type"], r["screen"] or "", r["detail"] or "",
                             r["path_id"] or "", r["lesson_id"] or "", r["created_at"]])

    totals: dict[tuple[str, str], list] = {}
    for r in rows:
        key = (r["event_type"], r["screen"] or "")
        entry = totals.setdefault(key, [0, set()])
        entry[0] += 1
        entry[1].add(r["uid"])
    with open(summary_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["evenement", "ecran", "total", "personnes"])
        for (event, screen), (count, people) in sorted(totals.items()):
            writer.writerow([event, screen, count, len(people)])

    return events_path, summary_path


if __name__ == "__main__":
    since = sys.argv[1] if len(sys.argv) > 1 else ""
    out = os.path.join(os.path.dirname(Config.DATABASE_PATH), "exports")
    for path in export(Config.DATABASE_PATH, out, since):
        print("[export]", path)
