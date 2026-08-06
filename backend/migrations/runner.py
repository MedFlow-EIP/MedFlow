"""Simple SQL-file migration runner for the MEDFLOW SQLite database.

Migrations live in ``migrations/versions/`` as plain ``.sql`` files named
``NNN_description.sql`` where *NNN* is a zero-padded integer version number
(e.g. ``001_initial_schema.sql``).  Each file is applied exactly once; the
applied versions are tracked in a ``schema_migrations`` table inside the
database itself.

Usage
-----
From the backend root:

    python -m migrations.runner          # apply pending migrations
    python -m migrations.runner --status # show migration status

Or import programmatically:

    from migrations.runner import MigrationRunner
    from database import Database
    runner = MigrationRunner(db)
    runner.run()
"""
from __future__ import annotations

import argparse
import logging
import os
import sqlite3
from glob import glob

logger = logging.getLogger(__name__)


class MigrationRunner:
    """Applies pending SQL migration files to the given database."""

    VERSIONS_DIR = os.path.join(os.path.dirname(__file__), "versions")

    def __init__(self, db) -> None:
        """
        Parameters
        ----------
        db:
            A ``database.Database`` instance (or any object with a
            ``.connection()`` context-manager and a ``.transaction()``
            context-manager).
        """
        self.db = db

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(self) -> list[str]:
        """Apply all pending migrations in order.

        Returns the list of version strings that were applied.
        """
        self._ensure_migrations_table()
        applied = self._get_applied_versions()
        newly_applied: list[str] = []

        for path in sorted(glob(os.path.join(self.VERSIONS_DIR, "*.sql"))):
            version = os.path.basename(path).split("_")[0]
            if version in applied:
                logger.debug("Migration %s already applied, skipping", version)
                continue
            self._apply(path, version)
            newly_applied.append(version)

        if newly_applied:
            logger.info("Applied %d migration(s): %s", len(newly_applied), newly_applied)
        else:
            logger.info("No new migrations to apply")

        return newly_applied

    def status(self) -> list[dict]:
        """Return a list of all migrations with their applied state."""
        self._ensure_migrations_table()
        applied = self._get_applied_versions()
        result = []
        for path in sorted(glob(os.path.join(self.VERSIONS_DIR, "*.sql"))):
            version = os.path.basename(path).split("_")[0]
            result.append({
                "version": version,
                "file": os.path.basename(path),
                "applied": version in applied,
            })
        return result

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _ensure_migrations_table(self) -> None:
        with self.db.transaction() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version TEXT PRIMARY KEY,
                    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

    def _get_applied_versions(self) -> set[str]:
        with self.db.connection() as conn:
            rows = conn.execute("SELECT version FROM schema_migrations").fetchall()
        return {row["version"] for row in rows}

    def _apply(self, path: str, version: str) -> None:
        with open(path, "r", encoding="utf-8") as fh:
            sql = fh.read()
        logger.info("Applying migration %s from %s", version, path)
        with self.db.transaction() as conn:
            # SQLite's executescript requires autocommit mode; use individual
            # execute calls split on ";" to stay inside our transaction.
            for statement in sql.split(";"):
                stmt = statement.strip()
                if stmt:
                    conn.execute(stmt)
            conn.execute(
                "INSERT INTO schema_migrations (version) VALUES (?)", (version,)
            )


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def _main() -> None:
    parser = argparse.ArgumentParser(description="MEDFLOW database migration runner")
    parser.add_argument("--status", action="store_true", help="Show migration status")
    parser.add_argument(
        "--db",
        default=os.getenv("DATABASE_PATH", os.path.join("data", "medflow.db")),
        help="Path to the SQLite database file",
    )
    args = parser.parse_args()

    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from database import Database

    db = Database(args.db)
    db.initialise()
    runner = MigrationRunner(db)

    if args.status:
        for entry in runner.status():
            state = "✓" if entry["applied"] else "○"
            print(f"  {state}  {entry['file']}")
    else:
        runner.run()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    _main()
