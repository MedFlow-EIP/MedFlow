"""Regression tests for lightweight ALTER TABLE migrations.

Ces tests existent parce qu'un vrai bug de prod (colonne ``lapses``
manquante sur ``revision_schedule``) n'a jamais été attrapé par la suite
existante : toutes les autres bases de test sont créées neuves, donc
``CREATE TABLE IF NOT EXISTS`` avec la colonne déjà dans le schéma
fonctionne toujours, même quand l'``ALTER TABLE`` de migration serait
en réalité cassé ou absent. Le seul moyen de tester une migration, c'est
de recréer artificiellement l'ancien schéma AVANT d'appeler
``initialise()``, exactement comme une vraie base de production existante.
"""
import sqlite3

import pytest

from database import Database


def _make_old_schema_db(tmp_path, table_sql: str) -> str:
    """Crée un fichier SQLite avec un schéma volontairement ancien (sans
    la colonne migrée), pour simuler une vraie base de production
    existante avant l'ajout de cette colonne."""
    db_path = str(tmp_path / "old_schema.db")
    conn = sqlite3.connect(db_path)
    conn.execute(table_sql)
    conn.commit()
    conn.close()
    return db_path


class TestRevisionScheduleLapsesMigration:
    def test_initialise_adds_lapses_column_to_pre_existing_table(self, tmp_path):
        old_schema = """
            CREATE TABLE revision_schedule (
                uid TEXT NOT NULL,
                course_id TEXT NOT NULL,
                item_index INTEGER NOT NULL,
                ease_factor REAL NOT NULL DEFAULT 2.5,
                interval_days INTEGER NOT NULL DEFAULT 0,
                repetitions INTEGER NOT NULL DEFAULT 0,
                next_review_date TEXT NOT NULL,
                last_reviewed_at TEXT,
                PRIMARY KEY (uid, course_id, item_index)
            )
        """
        db_path = _make_old_schema_db(tmp_path, old_schema)

        # Confirme que l'ancien schéma n'a bien pas la colonne, avant migration.
        conn = sqlite3.connect(db_path)
        columns_before = {row[1] for row in conn.execute("PRAGMA table_info(revision_schedule)")}
        conn.close()
        assert "lapses" not in columns_before

        # C'est exactement ce que fait un redéploiement sur une vraie base existante.
        db = Database(db_path)
        db.initialise()  # ne doit PAS lever sqlite3.OperationalError

        with db.connection() as conn:
            columns_after = {row[1] for row in conn.execute("PRAGMA table_info(revision_schedule)")}
        assert "lapses" in columns_after

    def test_get_due_quiz_items_works_after_migrating_from_old_schema(self, tmp_path, monkeypatch):
        old_schema = """
            CREATE TABLE revision_schedule (
                uid TEXT NOT NULL,
                course_id TEXT NOT NULL,
                item_index INTEGER NOT NULL,
                ease_factor REAL NOT NULL DEFAULT 2.5,
                interval_days INTEGER NOT NULL DEFAULT 0,
                repetitions INTEGER NOT NULL DEFAULT 0,
                next_review_date TEXT NOT NULL,
                last_reviewed_at TEXT,
                PRIMARY KEY (uid, course_id, item_index)
            )
        """
        db_path = _make_old_schema_db(tmp_path, old_schema)
        db = Database(db_path)
        db.initialise()

        # Régression exacte du bug de prod : get_due_quiz_items plantait
        # avec "no such column: lapses" sur une base migrée depuis l'ancien
        # schéma, alors qu'il fonctionnait très bien sur une base neuve.
        db.save_course("uid-1", "course-1", {
            "nom": "Test", "summary": "", "flashcards": [],
            "quiz": [{"question": "Q?", "options": {"A": "1", "B": "2"}, "correct": "A"}],
            "sessions": 0,
        })
        items = db.get_due_quiz_items("uid-1")
        assert len(items) == 1

    def test_migration_is_idempotent_across_multiple_initialise_calls(self, tmp_path):
        """initialise() peut être appelé plusieurs fois (redémarrages
        successifs du conteneur) — la migration ne doit jamais planter au
        second appel, une fois la colonne déjà présente."""
        db = Database(str(tmp_path / "test.db"))
        db.initialise()
        db.initialise()  # ne doit pas lever sqlite3.OperationalError

        with db.connection() as conn:
            columns = {row[1] for row in conn.execute("PRAGMA table_info(revision_schedule)")}
        assert "lapses" in columns

    def test_record_quiz_answer_works_after_migration(self, tmp_path):
        old_schema = """
            CREATE TABLE revision_schedule (
                uid TEXT NOT NULL,
                course_id TEXT NOT NULL,
                item_index INTEGER NOT NULL,
                ease_factor REAL NOT NULL DEFAULT 2.5,
                interval_days INTEGER NOT NULL DEFAULT 0,
                repetitions INTEGER NOT NULL DEFAULT 0,
                next_review_date TEXT NOT NULL,
                last_reviewed_at TEXT,
                PRIMARY KEY (uid, course_id, item_index)
            )
        """
        db_path = _make_old_schema_db(tmp_path, old_schema)
        db = Database(db_path)
        db.initialise()

        db.save_course("uid-1", "course-1", {
            "nom": "Test", "summary": "", "flashcards": [],
            "quiz": [{"question": "Q?", "options": {"A": "1", "B": "2"}, "correct": "A"}],
            "sessions": 0,
        })

        result = db.record_quiz_answer("uid-1", "course-1", 0, "A")
        assert result["correct"] is True
        assert result["is_leech"] is False