"""Database access layer for the MEDFLOW backend.

This module centralises every SQLite interaction in a single location to make
the database usage easier to follow and reason about.  It exposes the
``Database`` class which provides high level helpers for common operations used
by the Flask application.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Dict, Iterator, List, Optional, Tuple


logger = logging.getLogger(__name__)


@dataclass
class Course:
    """Simple value object representing a stored course."""

    id: str
    nom: str
    summary: str
    flashcards: List[Dict]
    quiz: List[Dict]
    sessions: int
    created_at: str
    updated_at: str


class Database:
    """Small helper wrapping the SQLite database used by the API."""

    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._ensure_database_file()

    def _ensure_database_file(self) -> None:
        """Make sure the SQLite file exists before attempting to connect."""

        database_dir = os.path.dirname(self.db_path)
        if database_dir:
            os.makedirs(database_dir, exist_ok=True)

        if self.db_path not in ("", ":memory:") and not os.path.exists(self.db_path):
            with open(self.db_path, "a", encoding="utf-8"):
                pass

    def initialise(self) -> None:
        """Create tables, indexes and triggers if they do not exist yet."""

        with self.transaction() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS courses (
                    uid TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    nom TEXT NOT NULL,
                    summary TEXT,
                    flashcards TEXT,
                    quiz TEXT,
                    sessions INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (uid, course_id)
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uid TEXT NOT NULL,
                    course_id TEXT,
                    session_type TEXT NOT NULL CHECK(session_type IN ('revision', 'flashcards', 'quiz')),
                    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    score INTEGER,
                    total_questions INTEGER,
                    FOREIGN KEY (uid, course_id) REFERENCES courses (uid, course_id)
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS paths (
                    path_id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    color TEXT,
                    emoji TEXT,
                    total_lessons INTEGER DEFAULT 0
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS lessons (
                    lesson_id TEXT PRIMARY KEY,
                    path_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    type TEXT NOT NULL CHECK(type IN ('lesson','review','test')),
                    position TEXT,
                    stars INTEGER DEFAULT 0,
                    status TEXT NOT NULL CHECK(status IN ('locked','available','completed')),
                    xp INTEGER DEFAULT 10,
                    FOREIGN KEY (path_id) REFERENCES paths (path_id)
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_lessons (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uid TEXT NOT NULL,
                    lesson_id TEXT NOT NULL,
                    path_id TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('locked','available','completed')),
                    stars INTEGER DEFAULT 0,
                    FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id)
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_stats (
                    uid TEXT PRIMARY KEY,
                    xp INTEGER DEFAULT 0,
                    streak INTEGER DEFAULT 0,
                    last_activity DATE
                )
                """
            )

            conn.execute(
                """
                INSERT OR IGNORE INTO paths (path_id, title, description, color, emoji, total_lessons)
                VALUES 
                    ('anatomy', 'Anatomie', 'Système squelettique, musculaire et organes', '#3b82f6', '🦴', 10),
                    ('cardiology', 'Cardiologie', 'Système cardiovasculaire et pathologies', '#ef4444', '❤️', 10),
                    ('neurology', 'Neurologie', 'Système nerveux et fonctions cérébrales', '#8b5cf6', '🧠', 10),
                    ('pharmacology', 'Pharmacologie', 'Médicaments et leurs actions', '#10b981', '💊', 10)
                """
            )

            conn.execute(
                """
                INSERT OR IGNORE INTO lessons (lesson_id, path_id, title, type, position, stars, status, xp)
                VALUES
                    ('1', 'anatomy', 'Introduction', 'lesson', 'center', 3, 'available', 10),
                    ('2', 'anatomy', 'Os du crâne', 'lesson', 'left', 2, 'available', 10),
                    ('3', 'anatomy', 'Révision 1', 'review', 'center', 3, 'available', 15),
                    ('4', 'anatomy', 'Colonne vertébrale', 'lesson', 'right', 3, 'available', 10),
                    ('5', 'anatomy', 'Cage thoracique', 'lesson', 'left', 0, 'available', 10),
                    ('6', 'anatomy', 'Test 1', 'test', 'center', 0, 'available', 30),
                    ('7', 'anatomy', 'Membres supérieurs', 'lesson', 'right', 0, 'locked', 10),
                    ('8', 'anatomy', 'Membres inférieurs', 'lesson', 'center', 0, 'locked', 10),
                    ('9', 'anatomy', 'Révision 2', 'review', 'left', 0, 'locked', 15),
                    ('10', 'anatomy', 'Test final', 'test', 'center', 0, 'locked', 30)
                """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_courses_uid ON courses(uid)
                """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_sessions_uid ON user_sessions(uid)
                """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_sessions_course ON user_sessions(uid, course_id)
                """
            )

            conn.execute(
                """
                CREATE TRIGGER IF NOT EXISTS update_course_timestamp
                AFTER UPDATE ON courses
                BEGIN
                    UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE uid = NEW.uid AND course_id = NEW.course_id;
                END
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_conversations (
                    conversation_id TEXT PRIMARY KEY,
                    uid TEXT NOT NULL,
                    title TEXT DEFAULT 'Nouvelle conversation',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS chat_messages (
                    message_id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
                    content TEXT NOT NULL,
                    attachments TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

                    FOREIGN KEY (conversation_id)
                    REFERENCES chat_conversations(conversation_id)
                    ON DELETE CASCADE
                )
                """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_chat_conversations_uid
                ON chat_conversations(uid)
                """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation
                ON chat_messages(conversation_id)
                """
            )

            conn.execute(
                """
                CREATE TRIGGER IF NOT EXISTS update_chat_conversation_timestamp
                AFTER INSERT ON chat_messages
                BEGIN
                    UPDATE chat_conversations
                    SET updated_at = CURRENT_TIMESTAMP
                    WHERE conversation_id = NEW.conversation_id;
                END
                """
            )

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        with self.connection() as conn:
            try:
                conn.execute("BEGIN")
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise

    def save_course(self, uid: str, course_id: str, payload: Dict) -> None:
        if not uid or not course_id:
            raise ValueError("UID and course_id are required")

        with self.transaction() as conn:
            conn.execute(
                """
                INSERT INTO courses (uid, course_id, nom, summary, flashcards, quiz, sessions)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(uid, course_id) DO UPDATE SET
                    nom=excluded.nom,
                    summary=excluded.summary,
                    flashcards=excluded.flashcards,
                    quiz=excluded.quiz,
                    sessions=COALESCE(courses.sessions, excluded.sessions),
                    updated_at=CURRENT_TIMESTAMP
                """,
                (
                    uid,
                    course_id,
                    payload["nom"],
                    payload.get("summary", ""),
                    json.dumps(payload.get("flashcards", []), ensure_ascii=False),
                    json.dumps(payload.get("quiz", []), ensure_ascii=False),
                    payload.get("sessions", 0),
                ),
            )

    def fetch_course(self, uid: str, course_id: str) -> Optional[Course]:
        if not uid or not course_id:
            raise ValueError("UID and course_id are required")

        with self.connection() as conn:
            row = conn.execute(
                "SELECT * FROM courses WHERE uid=? AND course_id=?",
                (uid, course_id),
            ).fetchone()

        if not row:
            return None

        return self._row_to_course(row)

    def fetch_courses(self, uid: str) -> List[Course]:
        if not uid:
            raise ValueError("UID is required")

        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT course_id, nom, summary, flashcards, quiz, sessions, created_at, updated_at
                FROM courses
                WHERE uid=?
                ORDER BY updated_at DESC
                """,
                (uid,),
            ).fetchall()

        return [self._row_to_course(row) for row in rows]
    
    def fetch_user_paths(self, uid: str) -> List[Dict]:
        """Retourne tous les parcours avec progression et verrouillage logique."""
        with self.connection() as conn:
            rows = conn.execute("SELECT * FROM paths ORDER BY path_id").fetchall()
            paths = []
            previous_completed = True

            for row in rows:
                total = row["total_lessons"]
                completed = conn.execute(
                    "SELECT COUNT(*) FROM user_lessons WHERE uid=? AND path_id=? AND status='completed'",
                    (uid, row["path_id"])
                ).fetchone()[0]

                available = conn.execute(
                    "SELECT COUNT(*) FROM user_lessons WHERE uid=? AND path_id=? AND status='available'",
                    (uid, row["path_id"])
                ).fetchone()[0]

                is_locked = not previous_completed

                paths.append({
                    "id": row["path_id"],
                    "title": row["title"],
                    "description": row["description"],
                    "color": row["color"],
                    "emoji": row["emoji"],
                    "totalLessons": total,
                    "completedLessons": completed,
                    "isLocked": is_locked,
                    "progress": round((completed / total) * 100, 2) if total else 0,
                })

                previous_completed = completed == total

        return paths

    def fetch_path_lessons(self, uid: str, path_id: str) -> List[Dict]:
        """Retourne toutes les leçons d’un parcours pour un utilisateur spécifique."""
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT * FROM user_lessons WHERE uid=? AND path_id=? ORDER BY CAST(lesson_id AS INTEGER) ASC",
                (uid, path_id),
            ).fetchall()
            return [
                {
                    "id": row["lesson_id"],
                    "title": conn.execute("SELECT title FROM lessons WHERE lesson_id=?", (row["lesson_id"],)).fetchone()["title"],
                    "type": conn.execute("SELECT type FROM lessons WHERE lesson_id=?", (row["lesson_id"],)).fetchone()["type"],
                    "status": row["status"],
                    "stars": row["stars"],
                    "position": conn.execute("SELECT position FROM lessons WHERE lesson_id=?", (row["lesson_id"],)).fetchone()["position"],
                    "xp": conn.execute("SELECT xp FROM lessons WHERE lesson_id=?", (row["lesson_id"],)).fetchone()["xp"],  # <-- ajouté
                }
                for row in rows
            ]

    def complete_lesson(self, uid: str, lesson_id: str):

        with self.transaction() as conn:

            lesson = conn.execute(
                "SELECT xp, lesson_id, title FROM lessons WHERE lesson_id=?",
                (lesson_id,)
            ).fetchone()

            xp = lesson["xp"] if lesson else 10

            conn.execute(
                "UPDATE user_lessons SET status='completed' WHERE uid=? AND lesson_id=?",
                (uid, lesson_id),
            )

            conn.execute(
                """
                INSERT OR IGNORE INTO user_stats (uid, xp, streak)
                VALUES (?,0,0)
                """,
                (uid,)
            )

            conn.execute(
                """
                UPDATE user_stats
                SET xp = xp + ?
                WHERE uid=?
                """,
                (xp, uid)
            )

            path_id_row = conn.execute(
                "SELECT path_id FROM user_lessons WHERE uid=? AND lesson_id=?",
                (uid, lesson_id)
            ).fetchone()

            if not path_id_row:
                return

            path_id = path_id_row["path_id"]

            next_lesson = conn.execute(
                """
                SELECT lesson_id
                FROM user_lessons
                WHERE uid=? AND path_id=? AND status='locked'
                ORDER BY CAST(lesson_id AS INTEGER) ASC
                LIMIT 1
                """,
                (uid, path_id)
            ).fetchone()

            if next_lesson:
                conn.execute(
                    "UPDATE user_lessons SET status='available' WHERE uid=? AND lesson_id=?",
                    (uid, next_lesson["lesson_id"])
                )

    def ensure_user_lessons(self, uid: str):
        """Initialise les leçons pour un nouvel utilisateur si elles n'existent pas encore."""
        with self.transaction() as conn:
            paths = conn.execute("SELECT path_id FROM paths").fetchall()
            for path in paths:
                path_id = path["path_id"]
                existing = conn.execute(
                    "SELECT COUNT(*) FROM user_lessons WHERE uid=? AND path_id=?",
                    (uid, path_id),
                ).fetchone()[0]
                if existing == 0:
                    lessons = conn.execute(
                        "SELECT lesson_id, status FROM lessons WHERE path_id=? ORDER BY CAST(lesson_id AS INTEGER) ASC",
                        (path_id,)
                    ).fetchall()
                    for i, l in enumerate(lessons):
                        status = 'available' if i == 0 else 'locked'
                        conn.execute(
                            """
                            INSERT INTO user_lessons (uid, lesson_id, path_id, status, stars)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                            (uid, l["lesson_id"], path_id, status, 0)
                        )
    def create_session_record(
        self,
        uid: str,
        course_id: Optional[str],
        session_type: str,
        score: Optional[int],
        total_questions: Optional[int],
    ) -> None:
        if not uid or not session_type:
            raise ValueError("UID and session_type are required")

        with self.transaction() as conn:
            conn.execute(
                """
                INSERT INTO user_sessions (uid, course_id, session_type, completed_at, score, total_questions)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)
                """,
                (uid, course_id, session_type, score, total_questions),
            )

    def increment_sessions(self, uid: str, course_id: Optional[str]) -> bool:
        if not uid:
            raise ValueError("UID is required")

        if not course_id:
            return False

        with self.transaction() as conn:
            result = conn.execute(
                "UPDATE courses SET sessions = COALESCE(sessions, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE uid=? AND course_id=?",
                (uid, course_id),
            )
            if result.rowcount == 0:
                raise ValueError(f"Course {course_id} not found for user {uid}")
        return True

    def get_user_session_stats(self, uid: str, course_id: Optional[str] = None) -> Dict[str, int]:
        if not uid:
            raise ValueError("UID is required")

        if course_id:
            query = """
                SELECT
                    COUNT(*) as total_sessions,
                    AVG(score) as avg_score,
                    COUNT(CASE WHEN session_type = 'revision' THEN 1 END) as revision_sessions,
                    COUNT(CASE WHEN session_type = 'flashcards' THEN 1 END) as flashcard_sessions,
                    COUNT(CASE WHEN session_type = 'quiz' THEN 1 END) as quiz_sessions
                FROM user_sessions
                WHERE uid = ? AND course_id = ?
            """
            params: Tuple[Optional[str], ...] = (uid, course_id)
        else:
            query = """
                SELECT
                    COUNT(*) as total_sessions,
                    AVG(score) as avg_score,
                    COUNT(CASE WHEN session_type = 'revision' THEN 1 END) as revision_sessions,
                    COUNT(CASE WHEN session_type = 'flashcards' THEN 1 END) as flashcard_sessions,
                    COUNT(CASE WHEN session_type = 'quiz' THEN 1 END) as quiz_sessions
                FROM user_sessions
                WHERE uid = ?
            """
            params = (uid,)

        with self.connection() as conn:
            row = conn.execute(query, params).fetchone()

        return {
            "total_sessions": row["total_sessions"] or 0,
            "avg_score": round(row["avg_score"] or 0, 2),
            "revision_sessions": row["revision_sessions"] or 0,
            "flashcard_sessions": row["flashcard_sessions"] or 0,
            "quiz_sessions": row["quiz_sessions"] or 0,
        }

    def delete_course(self, uid: str, course_id: str) -> bool:
        """Delete a course owned by *uid*.  Returns True if a row was removed."""
        if not uid or not course_id:
            raise ValueError("UID and course_id are required")

        with self.transaction() as conn:
            result = conn.execute(
                "DELETE FROM courses WHERE uid=? AND course_id=?",
                (uid, course_id),
            )
        return result.rowcount > 0

    def fetch_courses_paginated(
        self,
        uid: str,
        page: int = 1,
        per_page: int = 20,
    ) -> tuple:
        """Return a page of courses plus the total count.

        Returns
        -------
        (courses: List[Course], total: int)
        """
        if not uid:
            raise ValueError("UID is required")

        page = max(1, page)
        per_page = max(1, min(100, per_page))
        offset = (page - 1) * per_page

        with self.connection() as conn:
            total = conn.execute(
                "SELECT COUNT(*) FROM courses WHERE uid=?", (uid,)
            ).fetchone()[0]

            rows = conn.execute(
                """
                SELECT course_id, nom, summary, flashcards, quiz, sessions, created_at, updated_at
                FROM courses
                WHERE uid=?
                ORDER BY updated_at DESC
                LIMIT ? OFFSET ?
                """,
                (uid, per_page, offset),
            ).fetchall()

        return [self._row_to_course(row) for row in rows], total

    def recent_courses(self, limit: int = 5) -> List[Dict[str, str]]:
        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT uid, course_id, nom, created_at
                FROM courses
                ORDER BY created_at DESC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        return [
            {
                "uid": row["uid"],
                "course_id": row["course_id"],
                "nom": row["nom"],
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def total_courses(self) -> int:
        with self.connection() as conn:
            return conn.execute("SELECT COUNT(*) FROM courses").fetchone()[0]

    def total_sessions(self) -> int:
        with self.connection() as conn:
            return conn.execute("SELECT COUNT(*) FROM user_sessions").fetchone()[0]

    @staticmethod
    def _row_to_course(row: sqlite3.Row) -> Course:
        try:
            flashcards = json.loads(row["flashcards"] or "[]")
        except json.JSONDecodeError as exc:
            logger.error("Invalid flashcards JSON for course %s: %s", row["course_id"], exc)
            flashcards = []

        try:
            quiz = json.loads(row["quiz"] or "[]")
        except json.JSONDecodeError as exc:
            logger.error("Invalid quiz JSON for course %s: %s", row["course_id"], exc)
            quiz = []

        return Course(
            id=row["course_id"],
            nom=row["nom"],
            summary=row["summary"],
            flashcards=flashcards,
            quiz=quiz,
            sessions=row["sessions"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def create_chat_conversation(
        self,
        uid: str,
        title: str,
        conversation_id: str,
    ) -> None:

        with self.transaction() as conn:

            conn.execute(
                """
                INSERT INTO chat_conversations (
                    conversation_id,
                    uid,
                    title
                )
                VALUES (?, ?, ?)
                """,
                (
                    conversation_id,
                    uid,
                    title,
                ),
            )

    def save_chat_message(
        self,
        message_id: str,
        conversation_id: str,
        sender: str,
        content: str,
        attachments: list | None = None,
    ) -> None:

        with self.transaction() as conn:

            conn.execute(
                """
                INSERT INTO chat_messages (
                    message_id,
                    conversation_id,
                    sender,
                    content,
                    attachments
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    message_id,
                    conversation_id,
                    sender,
                    content,
                    json.dumps(attachments or [], ensure_ascii=False),
                ),
            )
    
    def fetch_chat_conversations(self, uid: str):

        with self.connection() as conn:

            rows = conn.execute(
                """
                SELECT *
                FROM chat_conversations
                WHERE uid = ?
                ORDER BY updated_at DESC
                """,
                (uid,),
            ).fetchall()

        return [dict(row) for row in rows]

    def fetch_chat_messages(self, conversation_id: str):

        with self.connection() as conn:

            rows = conn.execute(
                """
                SELECT *
                FROM chat_messages
                WHERE conversation_id = ?
                ORDER BY created_at ASC
                """,
                (conversation_id,),
            ).fetchall()

        messages = []

        for row in rows:

            row = dict(row)

            try:
                row["attachments"] = json.loads(
                    row["attachments"] or "[]"
                )
            except:
                row["attachments"] = []

            messages.append(row)

        return messages