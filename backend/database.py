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
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Iterator, List, Optional, Tuple

from spaced_repetition import CardSchedule, next_review_date, next_schedule


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
    # Spécialités médicales (F54) : suggérées à l'import, modifiables.
    tags: List[str] = field(default_factory=list)


# Catalogue des badges — chaque condition est évaluée contre un dict de
# stats courantes de l'utilisateur (xp, streak, lessons_completed).
# Ajouter un badge ici suffit à l'activer, aucune migration nécessaire.
BADGE_CATALOG: List[Dict] = [
    {
        "id": "first_lesson",
        "title": "Premiers pas",
        "description": "Terminer votre première leçon",
        "icon": "school",
        "color": "#3b82f6",
        "metric": "lessons_completed",
        "threshold": 1,
    },
    {
        "id": "streak_3",
        "title": "Sur la lancée",
        "description": "3 jours de série consécutifs",
        "icon": "flame",
        "color": "#f59e0b",
        "metric": "streak",
        "threshold": 3,
    },
    {
        "id": "streak_7",
        "title": "Semaine parfaite",
        "description": "7 jours de série consécutifs",
        "icon": "flame",
        "color": "#f97316",
        "metric": "streak",
        "threshold": 7,
    },
    {
        "id": "streak_30",
        "title": "Habitude ancrée",
        "description": "30 jours de série consécutifs",
        "icon": "flame",
        "color": "#dc2626",
        "metric": "streak",
        "threshold": 30,
    },
    {
        "id": "xp_100",
        "title": "Apprenti",
        "description": "100 XP cumulés",
        "icon": "star",
        "color": "#8b5cf6",
        "metric": "xp",
        "threshold": 100,
    },
    {
        "id": "xp_500",
        "title": "Étudiant assidu",
        "description": "500 XP cumulés",
        "icon": "star",
        "color": "#7c3aed",
        "metric": "xp",
        "threshold": 500,
    },
    {
        "id": "xp_1000",
        "title": "Expert",
        "description": "1000 XP cumulés",
        "icon": "trophy",
        "color": "#f59e0b",
        "metric": "xp",
        "threshold": 1000,
    },
    {
        "id": "lessons_10",
        "title": "Sur la bonne voie",
        "description": "10 leçons complétées",
        "icon": "checkmark-done",
        "color": "#10b981",
        "metric": "lessons_completed",
        "threshold": 10,
    },
    {
        "id": "lessons_50",
        "title": "Marathonien",
        "description": "50 leçons complétées",
        "icon": "checkmark-done-circle",
        "color": "#059669",
        "metric": "lessons_completed",
        "threshold": 50,
    },
]


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

            try:
                conn.execute("ALTER TABLE courses ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'")
            except sqlite3.OperationalError:
                pass

            # Empreinte du document importé (F52) : détecte un cours déjà importé.
            try:
                conn.execute("ALTER TABLE courses ADD COLUMN source_hash TEXT")
            except sqlite3.OperationalError:
                pass

            # Journal des réponses (révision, entraînement) : précision par
            # spécialité, quêtes. Une ligne par réponse donnée.
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS answer_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uid TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    item_index INTEGER NOT NULL,
                    correct INTEGER NOT NULL,
                    source TEXT NOT NULL,
                    answered_at TEXT NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_answer_log_uid_date ON answer_log(uid, answered_at)")

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

            # Migration légère : ajoute display_name si absent (bases déjà
            # existantes créées avant cette colonne). Ignore l'erreur si la
            # colonne existe déjà — SQLite n'a pas de ADD COLUMN IF NOT EXISTS.
            try:
                conn.execute("ALTER TABLE user_stats ADD COLUMN display_name TEXT")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE user_stats ADD COLUMN avatar_url TEXT")
            except sqlite3.OperationalError:
                pass

            # Migration légère : streak dédié à la révision espacée,
            # distinct du streak de leçons (colonne streak ci-dessus).
            try:
                conn.execute("ALTER TABLE user_stats ADD COLUMN revision_streak INTEGER DEFAULT 0")
            except sqlite3.OperationalError:
                pass

            try:
                conn.execute("ALTER TABLE user_stats ADD COLUMN last_revision_activity DATE")
            except sqlite3.OperationalError:
                pass

            # Protections de série : une gagnée tous les 7 jours de série,
            # utilisée automatiquement pour chaque jour manqué.
            try:
                conn.execute("ALTER TABLE user_stats ADD COLUMN streak_freezes INTEGER NOT NULL DEFAULT 0")
            except sqlite3.OperationalError:
                pass

            # Email (en minuscules) pour la recherche d'amis par adresse exacte.
            try:
                conn.execute("ALTER TABLE user_stats ADD COLUMN email TEXT")
            except sqlite3.OperationalError:
                pass

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS user_badges (
                    uid TEXT NOT NULL,
                    badge_id TEXT NOT NULL,
                    unlocked_at TEXT NOT NULL,
                    PRIMARY KEY (uid, badge_id)
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS activity_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uid TEXT NOT NULL,
                    type TEXT NOT NULL,
                    title TEXT NOT NULL,
                    detail TEXT,
                    xp_gained INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS analytics_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uid TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    path_id TEXT,
                    lesson_id TEXT,
                    screen TEXT,
                    created_at TEXT NOT NULL
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS revision_schedule (
                    uid TEXT NOT NULL,
                    course_id TEXT NOT NULL,
                    item_index INTEGER NOT NULL,
                    ease_factor REAL NOT NULL DEFAULT 2.5,
                    interval_days INTEGER NOT NULL DEFAULT 0,
                    repetitions INTEGER NOT NULL DEFAULT 0,
                    lapses INTEGER NOT NULL DEFAULT 0,
                    next_review_date TEXT NOT NULL,
                    last_reviewed_at TEXT,
                    PRIMARY KEY (uid, course_id, item_index)
                )
                """
            )

            try:
                conn.execute("ALTER TABLE revision_schedule ADD COLUMN lapses INTEGER NOT NULL DEFAULT 0")
            except sqlite3.OperationalError:
                pass

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS friendships (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    requester_uid TEXT NOT NULL,
                    addressee_uid TEXT NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('pending','accepted')),
                    created_at TEXT NOT NULL,
                    UNIQUE(requester_uid, addressee_uid)
                )
                """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_friendships_requester
                ON friendships(requester_uid)
                """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_friendships_addressee
                ON friendships(addressee_uid)
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

            # Un appel IA par ligne : sert aux quotas (voir consume_ai_quota).
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uid TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_ai_usage_uid_kind
                ON ai_usage(uid, kind, created_at)
                """
            )

            conn.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_ai_usage_created
                ON ai_usage(created_at)
                """
            )

            # Calendrier d'examens : les cours liés passent en priorité en révision.
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS exams (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    uid TEXT NOT NULL,
                    title TEXT NOT NULL,
                    exam_date TEXT NOT NULL,
                    course_ids TEXT NOT NULL DEFAULT '[]',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_exams_uid_date ON exams(uid, exam_date)")

            # Quêtes (F58) : une récompense par quête et par période (jour / semaine).
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS quest_claims (
                    uid TEXT NOT NULL,
                    quest_id TEXT NOT NULL,
                    period_key TEXT NOT NULL,
                    claimed_at TEXT NOT NULL,
                    PRIMARY KEY (uid, quest_id, period_key)
                )
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
                INSERT INTO courses (uid, course_id, nom, summary, flashcards, quiz, sessions, tags, source_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(uid, course_id) DO UPDATE SET
                    nom=excluded.nom,
                    summary=excluded.summary,
                    flashcards=excluded.flashcards,
                    quiz=excluded.quiz,
                    sessions=COALESCE(courses.sessions, excluded.sessions),
                    -- Régénérer un cours garde les tags choisis par l'utilisateur.
                    tags=CASE WHEN ? THEN excluded.tags ELSE courses.tags END,
                    source_hash=COALESCE(excluded.source_hash, courses.source_hash),
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
                    json.dumps(payload.get("tags", []), ensure_ascii=False),
                    payload.get("source_hash"),
                    "tags" in payload,
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
                SELECT course_id, nom, summary, flashcards, quiz, sessions, created_at, updated_at, tags
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

                # Parcours annoncé mais sans aucune leçon en base : jamais déblocable
                # (sinon on ouvrirait un parcours vide une fois le précédent terminé).
                lesson_count = conn.execute(
                    "SELECT COUNT(*) FROM lessons WHERE path_id=?", (row["path_id"],)
                ).fetchone()[0]
                coming_soon = lesson_count == 0

                is_locked = coming_soon or not previous_completed

                paths.append({
                    "id": row["path_id"],
                    "title": row["title"],
                    "description": row["description"],
                    "color": row["color"],
                    "emoji": row["emoji"],
                    "totalLessons": total,
                    "completedLessons": completed,
                    "isLocked": is_locked,
                    "comingSoon": coming_soon,
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

    def log_analytics_event(
        self,
        uid: str,
        event_type: str,
        path_id: str | None = None,
        lesson_id: str | None = None,
        screen: str | None = None,
    ) -> None:
        """Journal d'événements purement analytique, distinct de
        activity_log (qui alimente 'Actions récentes' côté utilisateur —
        on ne veut PAS y mélanger des événements internes comme
        'lesson_started' ou 'screen_view', ça polluerait ce feed).
        Sert au diagnostic de frictions (objectif 2 du track EIP) :
        combien commencent une leçon vs la terminent, quels écrans sont
        vus sans action derrière."""
        with self.transaction() as conn:
            conn.execute(
                """
                INSERT INTO analytics_events (uid, event_type, path_id, lesson_id, screen, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (uid, event_type, path_id, lesson_id, screen, datetime.now(timezone.utc).isoformat()),
            )

    def log_activity(
        self, uid: str, activity_type: str, title: str, detail: str = "", xp_gained: int = 0
    ) -> None:
        """Ajoute un événement au journal d'activité (utilisé pour la section
        'Actions récentes'). ``activity_type`` détermine l'icône/couleur
        côté mobile (ex: 'lesson_completed', 'badge_unlocked')."""
        with self.transaction() as conn:
            conn.execute(
                """
                INSERT INTO activity_log (uid, type, title, detail, xp_gained, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (uid, activity_type, title, detail, xp_gained, datetime.now(timezone.utc).isoformat()),
            )

    WEEKLY_GOAL_DEFAULT = 5  # leçons/semaine, fixe pour l'instant (pas encore configurable par utilisateur)

    # Paliers de ligue par XP cumulé — purement dérivé, aucune donnée à
    # tracker en plus. Rendre le classement plus lisible qu'un simple rang.
    LEAGUE_TIERS = [
        {"id": "bronze", "name": "Bronze", "minXp": 0, "color": "#cd7f32"},
        {"id": "silver", "name": "Argent", "minXp": 100, "color": "#c0c0c0"},
        {"id": "gold", "name": "Or", "minXp": 500, "color": "#f59e0b"},
        {"id": "platinum", "name": "Platine", "minXp": 1500, "color": "#60a5fa"},
        {"id": "diamond", "name": "Diamant", "minXp": 3000, "color": "#8b5cf6"},
    ]

    def get_league_for_xp(self, xp: int) -> Dict:
        current = self.LEAGUE_TIERS[0]
        next_tier = None
        for i, tier in enumerate(self.LEAGUE_TIERS):
            if xp >= tier["minXp"]:
                current = tier
                next_tier = self.LEAGUE_TIERS[i + 1] if i + 1 < len(self.LEAGUE_TIERS) else None

        return {
            "id": current["id"],
            "name": current["name"],
            "color": current["color"],
            "nextLeagueName": next_tier["name"] if next_tier else None,
            "xpToNextLeague": (next_tier["minXp"] - xp) if next_tier else 0,
        }

    def get_weekly_progress(self, uid: str) -> Dict:
        """Nombre de leçons complétées depuis le début de la semaine courante
        (lundi 00:00 UTC), vs l'objectif hebdomadaire."""
        today = date.today()
        monday = today - timedelta(days=today.weekday())
        monday_start_iso = monday.isoformat()

        with self.connection() as conn:
            row = conn.execute(
                """
                SELECT COUNT(*) AS c
                FROM activity_log
                WHERE uid = ? AND type = 'lesson_completed' AND created_at >= ?
                """,
                (uid, monday_start_iso),
            ).fetchone()

        return {
            "weeklyGoal": self.WEEKLY_GOAL_DEFAULT,
            "weeklyProgress": row["c"] if row else 0,
        }

    def get_recent_activity(self, uid: str, limit: int = 20) -> List[Dict]:
        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT type, title, detail, xp_gained, created_at
                FROM activity_log
                WHERE uid = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (uid, limit),
            ).fetchall()

        return [
            {
                "type": row["type"],
                "title": row["title"],
                "detail": row["detail"] or "",
                "xpGained": row["xp_gained"],
                "createdAt": row["created_at"],
            }
            for row in rows
        ]

    def get_lessons_completed_count(self, uid: str) -> int:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS c FROM user_lessons WHERE uid=? AND status='completed'",
                (uid,),
            ).fetchone()
        return row["c"] if row else 0

    def _current_badge_stats(self, uid: str) -> Dict:
        with self.connection() as conn:
            stats_row = conn.execute(
                "SELECT xp, streak FROM user_stats WHERE uid=?", (uid,)
            ).fetchone()
        return {
            "xp": stats_row["xp"] if stats_row else 0,
            "streak": stats_row["streak"] if stats_row else 0,
            "lessons_completed": self.get_lessons_completed_count(uid),
        }

    def get_user_badges(self, uid: str) -> List[Dict]:
        """Catalogue complet des badges, avec l'état débloqué/verrouillé et
        la progression actuelle vers le seuil (pour une barre "4/7 jours"
        côté mobile, même sur un badge encore verrouillé)."""
        with self.connection() as conn:
            unlocked_rows = conn.execute(
                "SELECT badge_id, unlocked_at FROM user_badges WHERE uid=?", (uid,)
            ).fetchall()
        unlocked = {row["badge_id"]: row["unlocked_at"] for row in unlocked_rows}

        stats = self._current_badge_stats(uid)

        result = []
        for badge in BADGE_CATALOG:
            current_value = stats[badge["metric"]]
            threshold = badge["threshold"]
            result.append({
                "id": badge["id"],
                "title": badge["title"],
                "description": badge["description"],
                "icon": badge["icon"],
                "color": badge["color"],
                "unlocked": badge["id"] in unlocked,
                "unlockedAt": unlocked.get(badge["id"]),
                "currentValue": min(current_value, threshold),
                "threshold": threshold,
                "progress": round(min(current_value / threshold, 1.0), 3) if threshold else 1.0,
            })
        return result

    def check_and_unlock_badges(self, uid: str) -> List[Dict]:
        """Vérifie les conditions de chaque badge et débloque les nouveaux
        (journalise aussi l'événement). Renvoie uniquement les badges
        nouvellement débloqués à CET appel, pour affichage immédiat."""
        with self.connection() as conn:
            already_unlocked = {
                row["badge_id"]
                for row in conn.execute(
                    "SELECT badge_id FROM user_badges WHERE uid=?", (uid,)
                ).fetchall()
            }

        stats = self._current_badge_stats(uid)

        newly_unlocked = [
            badge
            for badge in BADGE_CATALOG
            if badge["id"] not in already_unlocked
            and stats[badge["metric"]] >= badge["threshold"]
        ]

        if newly_unlocked:
            now = datetime.now(timezone.utc).isoformat()
            with self.transaction() as conn:
                for badge in newly_unlocked:
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO user_badges (uid, badge_id, unlocked_at)
                        VALUES (?, ?, ?)
                        """,
                        (uid, badge["id"], now),
                    )
            for badge in newly_unlocked:
                self.log_activity(
                    uid,
                    "badge_unlocked",
                    badge["title"],
                    badge["description"],
                    xp_gained=0,
                )

        return [
            {k: v for k, v in badge.items()}
            for badge in newly_unlocked
        ]

    def upsert_user_profile(self, uid: str, display_name: str | None) -> None:
        """Mémorise/actualise le nom affiché pour cet utilisateur, à partir
        du header X-User-Name déjà envoyé sur chaque requête authentifiée
        (require_auth). Nécessaire pour pouvoir afficher de vrais noms dans
        le classement, sans appel Firebase Admin par utilisateur."""
        if not display_name:
            return
        with self.transaction() as conn:
            conn.execute(
                """
                INSERT INTO user_stats (uid, xp, streak, display_name)
                VALUES (?, 0, 0, ?)
                ON CONFLICT(uid) DO UPDATE SET display_name = excluded.display_name
                """,
                (uid, display_name),
            )

    def register_user(self, uid: str, display_name: str | None, email: str | None) -> None:
        """Crée la ligne user_stats de l'utilisateur s'il n'en a pas encore
        (appelé dès sa première requête authentifiée) et met à jour son nom
        et son email quand ils sont connus. Une valeur absente n'écrase
        jamais une valeur déjà enregistrée."""
        with self.transaction() as conn:
            conn.execute(
                """
                INSERT INTO user_stats (uid, xp, streak, display_name, email)
                VALUES (?, 0, 0, ?, ?)
                ON CONFLICT(uid) DO UPDATE SET
                    display_name = COALESCE(excluded.display_name, user_stats.display_name),
                    email = COALESCE(excluded.email, user_stats.email)
                """,
                (uid, display_name, email),
            )

    def set_avatar_url(self, uid: str, avatar_url: str) -> None:
        """Mémorise l'URL de l'avatar uploadé, pour pouvoir l'afficher dans
        le classement/liste d'amis sans requêter Firebase Admin à chaque
        fois (l'avatar réel reste stocké côté disque + Firebase photoURL,
        ceci n'est qu'une référence pour l'affichage aux autres)."""
        with self.transaction() as conn:
            conn.execute(
                """
                INSERT INTO user_stats (uid, xp, streak, avatar_url)
                VALUES (?, 0, 0, ?)
                ON CONFLICT(uid) DO UPDATE SET avatar_url = excluded.avatar_url
                """,
                (uid, avatar_url),
            )

    def get_leaderboard(self, limit: int = 20) -> List[Dict]:
        """Classement des utilisateurs par XP décroissant."""
        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT uid, display_name, avatar_url, xp, streak
                FROM user_stats
                ORDER BY xp DESC, uid ASC
                LIMIT ?
                """,
                (limit,),
            ).fetchall()

        return [
            {
                "uid": row["uid"],
                "displayName": row["display_name"] or "Utilisateur",
                "avatarUrl": row["avatar_url"],
                "xp": row["xp"],
                "streak": row["streak"],
            }
            for row in rows
        ]

    def get_user_rank(self, uid: str) -> int:
        """Position de cet utilisateur dans le classement global (1 = premier).
        Renvoie 1 si l'utilisateur n'a pas encore de ligne user_stats."""
        with self.connection() as conn:
            row = conn.execute(
                "SELECT xp FROM user_stats WHERE uid=?", (uid,)
            ).fetchone()
            user_xp = row["xp"] if row else 0

            higher_count = conn.execute(
                "SELECT COUNT(*) AS c FROM user_stats WHERE xp > ?", (user_xp,)
            ).fetchone()["c"]

        return higher_count + 1

    # -----------------------------------------------------------------
    # Amis
    # -----------------------------------------------------------------

    def search_users(self, query: str, exclude_uid: str, limit: int = 20) -> List[Dict]:
        """Recherche des utilisateurs par nom affiché (partiel) ou par email
        (adresse exacte uniquement, pour ne pas permettre de lister les
        comptes avec un bout d'adresse), avec leur statut d'amitié actuel
        vis-à-vis de exclude_uid (Ajouter / Demande envoyée / Ami / Accepter).
        L'email n'est jamais renvoyé dans les résultats."""
        if not query or not query.strip():
            return []
        query = query.strip()

        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT uid, display_name, avatar_url
                FROM user_stats
                WHERE uid != ?
                  AND (
                    (display_name IS NOT NULL AND display_name LIKE ?)
                    OR (email IS NOT NULL AND email = ?)
                  )
                ORDER BY display_name ASC
                LIMIT ?
                """,
                (exclude_uid, f"%{query}%", query.lower(), limit),
            ).fetchall()

        results = []
        for row in rows:
            status = self.get_friendship_status(exclude_uid, row["uid"])
            results.append({
                "uid": row["uid"],
                "displayName": row["display_name"] or "Utilisateur",
                "avatarUrl": row["avatar_url"],
                "friendshipStatus": status,
            })
        return results

    def get_friendship_status(self, uid: str, other_uid: str) -> str:
        """'none' | 'friends' | 'request_sent' | 'request_received'."""
        with self.connection() as conn:
            row = conn.execute(
                """
                SELECT requester_uid, status FROM friendships
                WHERE (requester_uid=? AND addressee_uid=?)
                   OR (requester_uid=? AND addressee_uid=?)
                """,
                (uid, other_uid, other_uid, uid),
            ).fetchone()

        if not row:
            return "none"
        if row["status"] == "accepted":
            return "friends"
        # status == 'pending'
        if row["requester_uid"] == uid:
            return "request_sent"
        return "request_received"

    def send_friend_request(self, requester_uid: str, addressee_uid: str) -> str:
        """Envoie une demande d'ami. Si l'autre avait déjà envoyé une
        demande en attente vers requester_uid, elle est auto-acceptée
        (les deux se voulaient déjà comme amis). Renvoie le statut final
        ('pending' ou 'accepted')."""
        if requester_uid == addressee_uid:
            raise ValueError("Impossible de s'ajouter soi-même")

        with self.transaction() as conn:
            reverse_pending = conn.execute(
                """
                SELECT id FROM friendships
                WHERE requester_uid=? AND addressee_uid=? AND status='pending'
                """,
                (addressee_uid, requester_uid),
            ).fetchone()

            if reverse_pending:
                conn.execute(
                    "UPDATE friendships SET status='accepted' WHERE id=?",
                    (reverse_pending["id"],),
                )
                return "accepted"

            conn.execute(
                """
                INSERT OR IGNORE INTO friendships (requester_uid, addressee_uid, status, created_at)
                VALUES (?, ?, 'pending', ?)
                """,
                (requester_uid, addressee_uid, datetime.now(timezone.utc).isoformat()),
            )
            return "pending"

    def respond_to_friend_request(self, uid: str, requester_uid: str, accept: bool) -> None:
        """uid répond à une demande reçue de requester_uid."""
        with self.transaction() as conn:
            if accept:
                conn.execute(
                    """
                    UPDATE friendships SET status='accepted'
                    WHERE requester_uid=? AND addressee_uid=? AND status='pending'
                    """,
                    (requester_uid, uid),
                )
            else:
                conn.execute(
                    """
                    DELETE FROM friendships
                    WHERE requester_uid=? AND addressee_uid=? AND status='pending'
                    """,
                    (requester_uid, uid),
                )

    def remove_friend(self, uid: str, other_uid: str) -> None:
        """Retire un ami, ou annule/refuse une demande — peu importe qui
        avait envoyé la demande à l'origine."""
        with self.transaction() as conn:
            conn.execute(
                """
                DELETE FROM friendships
                WHERE (requester_uid=? AND addressee_uid=?)
                   OR (requester_uid=? AND addressee_uid=?)
                """,
                (uid, other_uid, other_uid, uid),
            )

    def get_friends(self, uid: str) -> List[Dict]:
        """Liste des amis confirmés, avec leurs stats."""
        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT
                    CASE WHEN requester_uid = ? THEN addressee_uid ELSE requester_uid END AS friend_uid
                FROM friendships
                WHERE (requester_uid=? OR addressee_uid=?) AND status='accepted'
                """,
                (uid, uid, uid),
            ).fetchall()

            friends = []
            for row in rows:
                friend_uid = row["friend_uid"]
                stats_row = conn.execute(
                    "SELECT display_name, avatar_url, xp, streak FROM user_stats WHERE uid=?",
                    (friend_uid,),
                ).fetchone()
                friends.append({
                    "uid": friend_uid,
                    "displayName": (stats_row["display_name"] if stats_row else None) or "Utilisateur",
                    "avatarUrl": stats_row["avatar_url"] if stats_row else None,
                    "xp": stats_row["xp"] if stats_row else 0,
                    "streak": stats_row["streak"] if stats_row else 0,
                })

        return friends

    def get_pending_requests(self, uid: str) -> Dict[str, List[Dict]]:
        """Demandes reçues (à accepter/refuser) et envoyées (en attente)."""
        with self.connection() as conn:
            received_rows = conn.execute(
                """
                SELECT f.requester_uid AS other_uid, f.created_at, s.display_name, s.avatar_url
                FROM friendships f
                LEFT JOIN user_stats s ON s.uid = f.requester_uid
                WHERE f.addressee_uid=? AND f.status='pending'
                ORDER BY f.created_at DESC
                """,
                (uid,),
            ).fetchall()

            sent_rows = conn.execute(
                """
                SELECT f.addressee_uid AS other_uid, f.created_at, s.display_name, s.avatar_url
                FROM friendships f
                LEFT JOIN user_stats s ON s.uid = f.addressee_uid
                WHERE f.requester_uid=? AND f.status='pending'
                ORDER BY f.created_at DESC
                """,
                (uid,),
            ).fetchall()

        return {
            "received": [
                {
                    "uid": r["other_uid"],
                    "displayName": r["display_name"] or "Utilisateur",
                    "avatarUrl": r["avatar_url"],
                }
                for r in received_rows
            ],
            "sent": [
                {
                    "uid": r["other_uid"],
                    "displayName": r["display_name"] or "Utilisateur",
                    "avatarUrl": r["avatar_url"],
                }
                for r in sent_rows
            ],
        }

    def get_friends_leaderboard(self, uid: str) -> List[Dict]:
        """Classement XP limité à soi + ses amis confirmés."""
        friends = self.get_friends(uid)
        with self.connection() as conn:
            self_row = conn.execute(
                "SELECT display_name, avatar_url, xp, streak FROM user_stats WHERE uid=?", (uid,)
            ).fetchone()

        entries = [
            {
                "uid": uid,
                "displayName": (self_row["display_name"] if self_row else None) or "Utilisateur",
                "avatarUrl": self_row["avatar_url"] if self_row else None,
                "xp": self_row["xp"] if self_row else 0,
                "streak": self_row["streak"] if self_row else 0,
            }
        ] + friends

        entries.sort(key=lambda e: e["xp"], reverse=True)
        return entries

    MAX_STREAK_FREEZES = 2
    STREAK_FREEZE_EVERY = 7  # jours de série pour gagner une protection

    @classmethod
    def next_streak(cls, current: int, last_activity: Optional[str], freezes: int, today: date):
        """Série après une activité aujourd'hui. Renvoie
        (série, protections restantes, protections utilisées, protection gagnée).

        Chaque jour manqué consomme une protection ; s'il n'y en a pas assez,
        la série repart de 1. Tous les 7 jours de série, une protection est
        gagnée (2 au maximum)."""
        current = current or 0
        freezes = freezes or 0
        used = 0
        if not last_activity:
            new_streak = 1
        else:
            delta = (today - date.fromisoformat(last_activity)).days
            if delta <= 0:
                return current, freezes, 0, False  # déjà actif aujourd'hui
            missed = delta - 1
            if missed == 0:
                new_streak = current + 1
            elif missed <= freezes:
                used = missed
                freezes -= missed
                new_streak = current + 1
            else:
                new_streak = 1

        earned = new_streak % cls.STREAK_FREEZE_EVERY == 0 and freezes < cls.MAX_STREAK_FREEZES
        if earned:
            freezes += 1
        return new_streak, freezes, used, earned

    @classmethod
    def displayed_streak(cls, streak: int, last_activity: Optional[str], freezes: int, today: Optional[date] = None) -> int:
        """Série à afficher : 0 si trop de jours ont été manqués pour être couverts
        par les protections (la valeur en base n'est mise à jour qu'à la
        prochaine leçon)."""
        if not streak or not last_activity:
            return 0
        missed = ((today or date.today()) - date.fromisoformat(last_activity)).days - 1
        return streak if missed <= (freezes or 0) else 0

    def complete_lesson(self, uid: str, lesson_id: str) -> List[Dict]:
        """Marque une leçon comme complétée, met à jour XP/streak, journalise
        l'activité et débloque les badges éligibles. Renvoie les badges
        nouvellement débloqués (liste vide si aucun)."""

        with self.transaction() as conn:

            lesson = conn.execute(
                "SELECT xp, lesson_id, title FROM lessons WHERE lesson_id=?",
                (lesson_id,)
            ).fetchone()

            xp = lesson["xp"] if lesson else 10
            lesson_title = lesson["title"] if lesson else "Leçon"

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

            # Calcul du streak (jours consécutifs d'activité), avec les
            # protections de série pour les jours manqués.
            today = date.today()
            stats_row = conn.execute(
                "SELECT streak, last_activity, streak_freezes FROM user_stats WHERE uid=?",
                (uid,)
            ).fetchone()

            new_streak, freezes, used, earned = self.next_streak(
                stats_row["streak"] if stats_row else 0,
                stats_row["last_activity"] if stats_row else None,
                stats_row["streak_freezes"] if stats_row else 0,
                today,
            )

            conn.execute(
                """
                UPDATE user_stats
                SET streak = ?, last_activity = ?, streak_freezes = ?
                WHERE uid = ?
                """,
                (new_streak, today.isoformat(), freezes, uid)
            )

            path_id_row = conn.execute(
                "SELECT path_id FROM user_lessons WHERE uid=? AND lesson_id=?",
                (uid, lesson_id)
            ).fetchone()
            path_id = path_id_row["path_id"] if path_id_row else None

            if path_id_row:
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

        if used:
            self.log_activity(
                uid,
                "streak_freeze_used",
                "Série protégée",
                f"{used} protection{'s' if used > 1 else ''} utilisée{'s' if used > 1 else ''}",
            )
        if earned:
            self.log_activity(uid, "streak_freeze_earned", "Protection de série gagnée", f"{new_streak} jours de série")

        # Hors de la transaction ci-dessus : ces deux appels ont besoin de
        # relire les stats (xp/streak) fraîchement commitées.
        self.log_activity(
            uid,
            "lesson_completed",
            lesson_title,
            f"+{xp} XP",
            xp_gained=xp,
        )
        # Copie analytique (distincte du feed "Actions récentes" ci-dessus) —
        # sert à calculer le taux d'abandon commencé/terminé par leçon.
        self.log_analytics_event(uid, "lesson_completed", path_id=path_id, lesson_id=lesson_id)

        return self.check_and_unlock_badges(uid)

    def reset_user_progress(self, uid: str) -> None:
        """Remet à zéro toute la progression/gamification de cet utilisateur
        (XP, streak, leçons, badges, activité) — outil de debug/test pour
        pouvoir retester le parcours depuis un état neuf. N'affecte que
        l'utilisateur appelant (uid vient du token vérifié), aucun risque
        de reset le compte de quelqu'un d'autre."""
        with self.transaction() as conn:
            conn.execute("DELETE FROM user_lessons WHERE uid=?", (uid,))
            conn.execute(
                "UPDATE user_stats SET xp=0, streak=0, last_activity=NULL WHERE uid=?",
                (uid,),
            )
            conn.execute("DELETE FROM user_badges WHERE uid=?", (uid,))
            conn.execute("DELETE FROM activity_log WHERE uid=?", (uid,))
            # Évite que les tests répétés d'un dev polluent les données
            # d'usage réelles utilisées pour le diagnostic de frictions.
            conn.execute("DELETE FROM analytics_events WHERE uid=?", (uid,))

        # Recrée les leçons dans leur état initial (1ère leçon de chaque
        # parcours disponible, le reste verrouillé).
        self.ensure_user_lessons(uid)

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
    def get_all_quiz_items(
        self, uid: str, course_id: Optional[str] = None
    ) -> List[Dict]:
        """Renvoie TOUTES les questions de quiz d'un cours (ou de tous les
        cours), sans filtrage par date de révision — pour le mode
        entraînement libre. Ne touche jamais à revision_schedule : à
        l'inverse de get_due_quiz_items, aucune notion de "dû" ici."""
        if not uid:
            raise ValueError("UID is required")

        courses = [self.fetch_course(uid, course_id)] if course_id else self.fetch_courses(uid)
        courses = [c for c in courses if c is not None]

        items: List[Dict] = []
        for course in courses:
            for idx, q in enumerate(course.quiz or []):
                items.append({
                    "course_id": course.id,
                    "course_nom": course.nom,
                    "item_index": idx,
                    "question": q.get("question"),
                    "options": q.get("options"),
                })
        return items

    def check_quiz_answer(
        self, uid: str, course_id: str, item_index: int, selected_option: str
    ) -> Dict:
        """Vérifie une réponse SANS toucher à revision_schedule — pour le
        mode entraînement libre, où l'utilisateur peut répéter les mêmes
        questions autant de fois qu'il veut sans perturber son vrai
        planning de répétition espacée."""
        if not uid or not course_id:
            raise ValueError("UID and course_id are required")

        course = self.fetch_course(uid, course_id)
        if not course or item_index >= len(course.quiz or []):
            raise ValueError("Question de quiz introuvable")

        correct_answer = course.quiz[item_index].get("correct")
        with self.transaction() as conn:
            self._log_answer(conn, uid, course_id, item_index, selected_option == correct_answer, "practice")
        return {
            "correct": selected_option == correct_answer,
            "correct_answer": correct_answer,
            "explanation": course.quiz[item_index].get("explanation"),
        }

    @staticmethod
    def _log_answer(conn, uid: str, course_id: str, item_index: int, correct: bool, source: str) -> None:
        conn.execute(
            "INSERT INTO answer_log (uid, course_id, item_index, correct, source, answered_at) VALUES (?, ?, ?, ?, ?, ?)",
            (uid, course_id, item_index, 1 if correct else 0, source, datetime.now(timezone.utc).isoformat()),
        )

    UNTAGGED_LABEL = "Sans spécialité"

    def get_specialty_stats(self, uid: str) -> List[Dict]:
        """Progression par spécialité (F69) : cours, questions, cartes maîtrisées,
        cartes dues aujourd'hui et taux de bonnes réponses. Un cours à plusieurs
        tags compte dans chacune de ses spécialités."""
        courses = self.fetch_courses(uid)
        today = date.today().isoformat()
        with self.connection() as conn:
            schedule = {
                (r["course_id"], r["item_index"]): r
                for r in conn.execute(
                    "SELECT course_id, item_index, interval_days, next_review_date FROM revision_schedule WHERE uid=?",
                    (uid,),
                ).fetchall()
            }
            answers = {
                r["course_id"]: (r["total"], r["correct"] or 0)
                for r in conn.execute(
                    "SELECT course_id, COUNT(*) AS total, SUM(correct) AS correct FROM answer_log WHERE uid=? GROUP BY course_id",
                    (uid,),
                ).fetchall()
            }

        groups: Dict[str, Dict] = {}
        for course in courses:
            questions = len(course.quiz or [])
            mastered = due = 0
            for idx in range(questions):
                row = schedule.get((course.id, idx))
                if row is None or row["next_review_date"] <= today:
                    due += 1
                if row is not None and row["interval_days"] >= self.MASTERED_INTERVAL_DAYS:
                    mastered += 1
            total, correct = answers.get(course.id, (0, 0))
            for tag in course.tags or [self.UNTAGGED_LABEL]:
                g = groups.setdefault(tag, {"tag": tag, "courses": 0, "questions": 0, "mastered": 0,
                                            "due_today": 0, "answers": 0, "correct": 0})
                g["courses"] += 1
                g["questions"] += questions
                g["mastered"] += mastered
                g["due_today"] += due
                g["answers"] += total
                g["correct"] += correct

        result = []
        for g in groups.values():
            g["mastery"] = round(100 * g["mastered"] / g["questions"]) if g["questions"] else 0
            g["accuracy"] = round(100 * g["correct"] / g["answers"]) if g["answers"] else None
            result.append(g)
        # Spécialités les plus fournies d'abord, « Sans spécialité » en dernier.
        result.sort(key=lambda g: (g["tag"] == self.UNTAGGED_LABEL, -g["questions"], g["tag"]))
        return result

    def search_courses(self, uid: str, query: str, limit: int = 30) -> List[Dict]:
        """Recherche insensible à la casse dans les noms de cours, les
        flashcards (question/réponse) et les questions de quiz (question
        seule, jamais les options ni la bonne réponse — pas de raison de
        les exposer ici). Ne s'appuie pas sur la recherche plein texte de
        SQLite (non configurée) : filtrage en Python, suffisant vu le
        volume de contenu par utilisateur."""
        if not uid:
            raise ValueError("UID is required")
        query = (query or "").strip()
        if not query:
            return []

        needle = query.lower()
        courses = self.fetch_courses(uid)
        results: List[Dict] = []

        for course in courses:
            if needle in (course.nom or "").lower():
                results.append({
                    "course_id": course.id,
                    "course_nom": course.nom,
                    "match_type": "course_name",
                    "snippet": course.nom,
                })

            for idx, card in enumerate(course.flashcards or []):
                question = card.get("question") or ""
                answer = card.get("answer") or ""
                if needle in question.lower() or needle in answer.lower():
                    results.append({
                        "course_id": course.id,
                        "course_nom": course.nom,
                        "match_type": "flashcard",
                        "item_index": idx,
                        "snippet": question,
                    })

            for idx, q in enumerate(course.quiz or []):
                question = q.get("question") or ""
                if needle in question.lower():
                    results.append({
                        "course_id": course.id,
                        "course_nom": course.nom,
                        "match_type": "quiz",
                        "item_index": idx,
                        "snippet": question,
                    })

        return results[:limit]

    def get_leech_items(self, uid: str, course_id: Optional[str] = None) -> List[Dict]:
        """Renvoie les questions signalées "leech" (LEECH_THRESHOLD échecs
        consécutifs ou plus), sans tenir compte de la date de révision —
        contrairement à get_due_quiz_items, on veut pouvoir les retravailler
        sur demande, pas seulement attendre que SM-2 les replanifie."""
        if not uid:
            raise ValueError("UID is required")

        with self.connection() as conn:
            schedule_rows = conn.execute(
                "SELECT course_id, item_index, lapses FROM revision_schedule WHERE uid=? AND lapses >= ?",
                (uid, self.LEECH_THRESHOLD),
            ).fetchall()

        leech_by_key = {(row["course_id"], row["item_index"]): row["lapses"] for row in schedule_rows}
        if not leech_by_key:
            return []

        courses = [self.fetch_course(uid, course_id)] if course_id else self.fetch_courses(uid)
        courses = [c for c in courses if c is not None]

        items: List[Dict] = []
        for course in courses:
            for idx, q in enumerate(course.quiz or []):
                key = (course.id, idx)
                if key in leech_by_key:
                    items.append({
                        "course_id": course.id,
                        "course_nom": course.nom,
                        "item_index": idx,
                        "question": q.get("question"),
                        "options": q.get("options"),
                        "lapses": leech_by_key[key],
                    })
        return items

    def get_mastered_items(self, uid: str, course_id: Optional[str] = None) -> List[Dict]:
        """Renvoie les questions "maîtrisées" (intervalle SM-2 d'au moins
        MASTERED_INTERVAL_DAYS, signe d'une série de bonnes réponses
        soutenue — un seul échec réinitialise l'intervalle à 1 jour, donc
        un long intervalle ne peut venir que d'une vraie maîtrise). Vue
        purement informative — pas d'action de révision associée."""
        if not uid:
            raise ValueError("UID is required")

        with self.connection() as conn:
            schedule_rows = conn.execute(
                "SELECT course_id, item_index, interval_days, repetitions FROM revision_schedule WHERE uid=? AND interval_days >= ?",
                (uid, self.MASTERED_INTERVAL_DAYS),
            ).fetchall()

        mastered_by_key = {
            (row["course_id"], row["item_index"]): (row["interval_days"], row["repetitions"])
            for row in schedule_rows
        }
        if not mastered_by_key:
            return []

        courses = [self.fetch_course(uid, course_id)] if course_id else self.fetch_courses(uid)
        courses = [c for c in courses if c is not None]

        items: List[Dict] = []
        for course in courses:
            for idx, q in enumerate(course.quiz or []):
                key = (course.id, idx)
                if key in mastered_by_key:
                    interval_days, repetitions = mastered_by_key[key]
                    items.append({
                        "course_id": course.id,
                        "course_nom": course.nom,
                        "item_index": idx,
                        "question": q.get("question"),
                        "interval_days": interval_days,
                        "repetitions": repetitions,
                    })
        return items

    def get_revision_forecast(self, uid: str, days: int = 7) -> List[Dict]:
        """Prévision du nombre de cartes dues chaque jour sur les
        ``days`` prochains jours (aujourd'hui inclus). Le jour "aujourd'hui"
        regroupe aussi tout ce qui est en retard — une carte en retard de 3
        jours est due aujourd'hui, pas seulement à sa date d'origine.
        N'inclut pas les cartes jamais vues (imprévisibles par nature :
        elles deviennent dues dès qu'on les découvre).
        Chaque jour contient aussi ``courses`` : le détail par cours
        (``course_id``, ``course_nom``, ``count``), pour afficher ce qu'il y
        aura à réviser un jour donné, pas seulement combien."""
        if not uid:
            raise ValueError("UID is required")

        today = date.today()
        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT next_review_date, course_id, COUNT(*) as count
                FROM revision_schedule WHERE uid=?
                GROUP BY next_review_date, course_id
                """,
                (uid,),
            ).fetchall()

        course_names = {c.id: c.nom for c in self.fetch_courses(uid)}

        forecast: List[Dict] = []
        for i in range(days):
            d = today + timedelta(days=i)
            day = d.isoformat()
            per_course: Dict[str, int] = {}
            for row in rows:
                # Aujourd'hui regroupe aussi les cartes en retard.
                if row["next_review_date"] == day or (i == 0 and row["next_review_date"] < day):
                    per_course[row["course_id"]] = per_course.get(row["course_id"], 0) + row["count"]
            courses = [
                {
                    "course_id": course_id,
                    "course_nom": course_names.get(course_id) or "Cours supprimé",
                    "count": count,
                }
                for course_id, count in sorted(per_course.items(), key=lambda kv: -kv[1])
            ]
            forecast.append({"date": day, "count": sum(per_course.values()), "courses": courses})
        return forecast

    def get_due_quiz_items(
        self, uid: str, course_id: Optional[str] = None, limit: int = 20
    ) -> List[Dict]:
        """Renvoie les questions de quiz à réviser aujourd'hui (jamais vues,
        ou dont la date de révision SM-2 est aujourd'hui ou passée), triées
        en priorisant les plus en retard, puis les jamais vues.
        ``course_id=None`` cherche sur tous les cours de l'utilisateur.
        Le champ ``correct`` n'est jamais renvoyé — la réponse ne doit pas
        fuiter avant que l'utilisateur n'ait répondu."""
        if not uid:
            raise ValueError("UID is required")

        courses = [self.fetch_course(uid, course_id)] if course_id else self.fetch_courses(uid)
        courses = [c for c in courses if c is not None]

        with self.connection() as conn:
            schedule_rows = conn.execute(
                "SELECT course_id, item_index, next_review_date, lapses FROM revision_schedule WHERE uid=?",
                (uid,),
            ).fetchall()

        schedule_by_key = {
            (row["course_id"], row["item_index"]): row
            for row in schedule_rows
        }

        today = date.today().isoformat()
        exams = self.get_exam_priorities(uid)
        due: List[Dict] = []
        new: List[Dict] = []
        # Cartes pas encore dues, mais dont la prochaine révision tomberait
        # après un examen proche : on les avance pour les revoir avant.
        before_exam: List[Dict] = []

        for course in courses:
            exam = exams.get(course.id)
            for idx, q in enumerate(course.quiz or []):
                key = (course.id, idx)
                schedule_row = schedule_by_key.get(key)
                scheduled_for = schedule_row["next_review_date"] if schedule_row else None
                item = {
                    "course_id": course.id,
                    "course_nom": course.nom,
                    "item_index": idx,
                    "question": q.get("question"),
                    "options": q.get("options"),
                    "is_leech": bool(schedule_row and schedule_row["lapses"] >= self.LEECH_THRESHOLD),
                }
                if exam:
                    item["exam"] = {"title": exam["title"], "days_left": exam["days_left"]}
                if scheduled_for is None:
                    new.append(item)
                elif scheduled_for <= today:
                    item["overdue_days"] = (
                        date.today() - date.fromisoformat(scheduled_for)
                    ).days
                    due.append(item)
                elif exam and exam["days_left"] <= self.EXAM_CRAM_DAYS and scheduled_for > exam["exam_date"]:
                    before_exam.append(item)

        # Cours d'un examen proche d'abord (le plus proche en tête), puis le reste.
        # Dans chaque groupe : en retard, jamais vues, puis avancées pour l'examen.
        def priority(entry):
            bucket, item = entry
            exam_rank = item["exam"]["days_left"] if "exam" in item else self.EXAM_PRIORITY_DAYS + 1
            return (exam_rank, bucket, -item.get("overdue_days", 0))

        ranked = [(0, it) for it in due] + [(1, it) for it in new] + [(2, it) for it in before_exam]
        ranked.sort(key=priority)
        return [it for _, it in ranked][:limit]

    # Un examen dans les 30 jours fait passer ses cours en priorité ; à 14 jours
    # ou moins, les cartes prévues après l'examen sont avancées.
    EXAM_PRIORITY_DAYS = 30
    EXAM_CRAM_DAYS = 14
    MAX_EXAMS = 50

    def get_exam_priorities(self, uid: str) -> Dict[str, Dict]:
        """Pour chaque cours lié à un examen à venir (≤ 30 jours), l'examen le plus proche."""
        today = date.today()
        horizon = (today + timedelta(days=self.EXAM_PRIORITY_DAYS)).isoformat()
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT title, exam_date, course_ids FROM exams WHERE uid=? AND exam_date>=? AND exam_date<=? "
                "ORDER BY exam_date ASC",
                (uid, today.isoformat(), horizon),
            ).fetchall()

        priorities: Dict[str, Dict] = {}
        for row in rows:
            try:
                course_ids = json.loads(row["course_ids"] or "[]")
            except json.JSONDecodeError:
                course_ids = []
            days_left = (date.fromisoformat(row["exam_date"]) - today).days
            for cid in course_ids:
                # Lignes triées par date : le premier examen trouvé est le plus proche.
                priorities.setdefault(cid, {"title": row["title"], "exam_date": row["exam_date"], "days_left": days_left})
        return priorities

    def create_exam(self, uid: str, title: str, exam_date: str, course_ids: List[str]) -> int:
        with self.transaction() as conn:
            cur = conn.execute(
                "INSERT INTO exams (uid, title, exam_date, course_ids) VALUES (?, ?, ?, ?)",
                (uid, title, exam_date, json.dumps(course_ids, ensure_ascii=False)),
            )
        return cur.lastrowid

    def count_exams(self, uid: str) -> int:
        with self.connection() as conn:
            return conn.execute("SELECT COUNT(*) FROM exams WHERE uid=?", (uid,)).fetchone()[0]

    def fetch_exams(self, uid: str) -> List[Dict]:
        """Examens de l'utilisateur, du plus proche au plus lointain, avec les cours liés."""
        today = date.today()
        names = {c.id: c.nom for c in self.fetch_courses(uid)}
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT id, title, exam_date, course_ids FROM exams WHERE uid=? ORDER BY exam_date ASC, id ASC",
                (uid,),
            ).fetchall()

        exams = []
        for row in rows:
            try:
                course_ids = json.loads(row["course_ids"] or "[]")
            except json.JSONDecodeError:
                course_ids = []
            exams.append({
                "id": row["id"],
                "title": row["title"],
                "exam_date": row["exam_date"],
                "days_left": (date.fromisoformat(row["exam_date"]) - today).days,
                # Un cours supprimé depuis disparaît simplement de la liste.
                "courses": [{"id": cid, "nom": names[cid]} for cid in course_ids if cid in names],
            })
        return exams

    def delete_exam(self, uid: str, exam_id: int) -> bool:
        with self.transaction() as conn:
            result = conn.execute("DELETE FROM exams WHERE uid=? AND id=?", (uid, exam_id))
        return result.rowcount > 0

    LEECH_THRESHOLD = 3  # échecs consécutifs à partir desquels une carte est signalée "leech"
    MASTERED_INTERVAL_DAYS = 21  # même convention qu'Anki pour une carte "mature"/bien maîtrisée

    def record_quiz_answer(
        self, uid: str, course_id: str, item_index: int, selected_option: str
    ) -> Dict:
        """Enregistre la réponse à une question de quiz et recalcule sa
        prochaine date de révision via SM-2. Contrairement à l'ancienne
        version basée sur les flashcards, la qualité SM-2 n'est jamais
        déclarée par le client : elle est déduite automatiquement de la
        bonne/mauvaise réponse (5 si correct, 1 sinon), ce qui retire tout
        biais d'auto-évaluation ("je pensais savoir").

        Suit aussi le nombre d'échecs consécutifs ("lapses") : une carte
        ratée LEECH_THRESHOLD fois de suite est un "leech" — un signal
        classique en répétition espacée qu'il faut retravailler ce
        contenu autrement (reformulation, image, etc.) plutôt que de
        continuer à la revoir en boucle avec la même formulation."""
        if not uid or not course_id:
            raise ValueError("UID and course_id are required")

        course = self.fetch_course(uid, course_id)
        if not course or item_index >= len(course.quiz or []):
            raise ValueError("Question de quiz introuvable")

        quiz_item = course.quiz[item_index]
        correct_answer = quiz_item.get("correct")
        explanation = quiz_item.get("explanation")
        is_correct = selected_option == correct_answer
        quality = 5 if is_correct else 1

        with self.transaction() as conn:
            row = conn.execute(
                """
                SELECT ease_factor, interval_days, repetitions, lapses
                FROM revision_schedule WHERE uid=? AND course_id=? AND item_index=?
                """,
                (uid, course_id, item_index),
            ).fetchone()

            current = (
                CardSchedule(
                    ease_factor=row["ease_factor"],
                    interval_days=row["interval_days"],
                    repetitions=row["repetitions"],
                )
                if row
                else CardSchedule()
            )
            current_lapses = row["lapses"] if row else 0
            new_lapses = 0 if is_correct else current_lapses + 1

            new_schedule = next_schedule(current, quality)
            next_date = next_review_date(new_schedule)

            conn.execute(
                """
                INSERT INTO revision_schedule
                    (uid, course_id, item_index, ease_factor, interval_days, repetitions, lapses, next_review_date, last_reviewed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (uid, course_id, item_index) DO UPDATE SET
                    ease_factor=excluded.ease_factor,
                    interval_days=excluded.interval_days,
                    repetitions=excluded.repetitions,
                    lapses=excluded.lapses,
                    next_review_date=excluded.next_review_date,
                    last_reviewed_at=excluded.last_reviewed_at
                """,
                (
                    uid,
                    course_id,
                    item_index,
                    new_schedule.ease_factor,
                    new_schedule.interval_days,
                    new_schedule.repetitions,
                    new_lapses,
                    next_date.isoformat(),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )
            self._log_answer(conn, uid, course_id, item_index, is_correct, "revision")

        return {
            "correct": is_correct,
            "correct_answer": correct_answer,
            "explanation": explanation,
            "is_leech": new_lapses >= self.LEECH_THRESHOLD,
            "ease_factor": new_schedule.ease_factor,
            "interval_days": new_schedule.interval_days,
            "repetitions": new_schedule.repetitions,
            "next_review_date": next_date.isoformat(),
        }

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

            if session_type == "revision":
                self._update_revision_streak(conn, uid)

    def _update_revision_streak(self, conn, uid: str) -> None:
        """Streak dédié à la révision espacée — même logique jour-par-jour
        que le streak de leçons (complete_lesson), mais totalement
        indépendant : réviser sans jamais compléter de leçon (ou
        l'inverse) fait progresser l'un sans toucher à l'autre."""
        today = date.today()

        conn.execute(
            "INSERT OR IGNORE INTO user_stats (uid, xp, streak) VALUES (?, 0, 0)",
            (uid,),
        )

        stats_row = conn.execute(
            "SELECT revision_streak, last_revision_activity FROM user_stats WHERE uid=?",
            (uid,),
        ).fetchone()

        last_activity_str = stats_row["last_revision_activity"] if stats_row else None
        current_streak = (stats_row["revision_streak"] if stats_row and stats_row["revision_streak"] else 0)

        if last_activity_str:
            last_activity = date.fromisoformat(last_activity_str)
            delta_days = (today - last_activity).days

            if delta_days == 0:
                new_streak = current_streak
            elif delta_days == 1:
                new_streak = current_streak + 1
            else:
                new_streak = 1
        else:
            new_streak = 1

        conn.execute(
            "UPDATE user_stats SET revision_streak=?, last_revision_activity=? WHERE uid=?",
            (new_streak, today.isoformat(), uid),
        )

    def get_revision_streak(self, uid: str) -> int:
        if not uid:
            raise ValueError("UID is required")

        with self.connection() as conn:
            row = conn.execute(
                "SELECT revision_streak, last_revision_activity FROM user_stats WHERE uid=?",
                (uid,),
            ).fetchone()

        if not row or not row["revision_streak"]:
            return 0

        # Un streak "expire" silencieusement s'il n'y a pas eu d'activité
        # hier ou aujourd'hui — sinon un streak de 5 jours vieux de 3
        # semaines resterait affiché comme actif indéfiniment.
        last_activity_str = row["last_revision_activity"]
        if not last_activity_str:
            return 0
        delta_days = (date.today() - date.fromisoformat(last_activity_str)).days
        if delta_days > 1:
            return 0
        return row["revision_streak"]

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

    def find_course_by_hash(self, uid: str, source_hash: str) -> Optional[Dict]:
        """Cours de l'utilisateur importé depuis le même document, ou None."""
        with self.connection() as conn:
            row = conn.execute(
                "SELECT course_id, nom FROM courses WHERE uid=? AND source_hash=? ORDER BY created_at DESC LIMIT 1",
                (uid, source_hash),
            ).fetchone()
        return {"course_id": row["course_id"], "nom": row["nom"]} if row else None

    def update_course(
        self,
        uid: str,
        course_id: str,
        nom: Optional[str] = None,
        flashcards: Optional[List[Dict]] = None,
        tags: Optional[List[str]] = None,
    ) -> bool:
        """Renomme un cours, remplace ses flashcards et/ou ses tags. Le quiz n'est pas
        modifiable : le planning de révision repose sur l'ordre de ses questions."""
        if not uid or not course_id:
            raise ValueError("UID and course_id are required")

        fields, values = [], []
        if nom is not None:
            fields.append("nom=?")
            values.append(nom)
        if flashcards is not None:
            fields.append("flashcards=?")
            values.append(json.dumps(flashcards, ensure_ascii=False))
        if tags is not None:
            fields.append("tags=?")
            values.append(json.dumps(tags, ensure_ascii=False))
        if not fields:
            return False

        with self.transaction() as conn:
            result = conn.execute(
                f"UPDATE courses SET {', '.join(fields)}, updated_at=CURRENT_TIMESTAMP "
                "WHERE uid=? AND course_id=?",
                (*values, uid, course_id),
            )
        return result.rowcount > 0

    def export_user_data(self, uid: str) -> Dict:
        """Toutes les données d'un utilisateur, table par table (export RGPD).

        Même parcours que ``delete_user_data`` : une table ajoutée plus tard
        avec une colonne ``uid`` sera exportée elle aussi.
        """
        json_columns = {"flashcards", "quiz", "attachments", "metadata", "data"}

        def as_dict(row) -> Dict:
            item = dict(row)
            for key, value in item.items():
                if key in json_columns and isinstance(value, str):
                    try:
                        item[key] = json.loads(value)
                    except json.JSONDecodeError:
                        pass
            return item

        export: Dict[str, List[Dict]] = {}
        with self.connection() as conn:
            tables = [
                row["name"]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
                ).fetchall()
            ]
            for table in tables:
                columns = {col["name"] for col in conn.execute(f'PRAGMA table_info("{table}")').fetchall()}
                if "uid" in columns:
                    rows = conn.execute(f'SELECT * FROM "{table}" WHERE uid = ?', (uid,)).fetchall()
                    if rows:
                        export[table] = [as_dict(r) for r in rows]

            messages = conn.execute(
                """
                SELECT m.* FROM chat_messages m
                JOIN chat_conversations c ON c.conversation_id = m.conversation_id
                WHERE c.uid = ?
                ORDER BY m.created_at ASC, m.rowid ASC
                """,
                (uid,),
            ).fetchall()
            if messages:
                export["chat_messages"] = [as_dict(r) for r in messages]

            friendships = conn.execute(
                "SELECT * FROM friendships WHERE requester_uid = ? OR addressee_uid = ?",
                (uid, uid),
            ).fetchall()
            if friendships:
                export["friendships"] = [as_dict(r) for r in friendships]

        return export

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
                SELECT course_id, nom, summary, flashcards, quiz, sessions, created_at, updated_at, tags
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

        try:
            tags = json.loads(row["tags"] or "[]") if "tags" in row.keys() else []
        except json.JSONDecodeError:
            tags = []

        return Course(
            tags=tags,
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

    def delete_user_data(self, uid: str) -> None:
        """Efface toutes les données d'un utilisateur (suppression de compte).

        Parcourt toutes les tables ayant une colonne ``uid`` plutôt qu'une liste
        figée : une table ajoutée plus tard sera effacée elle aussi.
        """
        with self.transaction() as conn:
            # Les messages n'ont pas de colonne uid, et les clés étrangères
            # SQLite ne sont pas activées : on les supprime explicitement.
            conn.execute(
                """
                DELETE FROM chat_messages WHERE conversation_id IN (
                    SELECT conversation_id FROM chat_conversations WHERE uid = ?
                )
                """,
                (uid,),
            )
            conn.execute(
                "DELETE FROM friendships WHERE requester_uid = ? OR addressee_uid = ?",
                (uid, uid),
            )
            tables = [
                row["name"]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
                ).fetchall()
            ]
            for table in tables:
                columns = {col["name"] for col in conn.execute(f'PRAGMA table_info("{table}")').fetchall()}
                if "uid" in columns:
                    conn.execute(f'DELETE FROM "{table}" WHERE uid = ?', (uid,))

    def delete_chat_conversation(self, uid: str, conversation_id: str) -> bool:
        """Supprime une conversation de l'utilisateur. False si elle n'est pas à lui."""
        with self.transaction() as conn:
            owner = conn.execute(
                "SELECT uid FROM chat_conversations WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchone()
            if not owner or owner["uid"] != uid:
                return False
            conn.execute("DELETE FROM chat_messages WHERE conversation_id = ?", (conversation_id,))
            conn.execute("DELETE FROM chat_conversations WHERE conversation_id = ?", (conversation_id,))
        return True

    def consume_ai_quota(
        self,
        uid: str,
        kind: str,
        limits: List[Tuple[int, int]],
        global_per_day: int,
    ) -> Optional[str]:
        """Réserve un appel IA si les quotas le permettent.

        ``limits`` : liste de (fenêtre en secondes, nombre max d'appels) pour cet
        utilisateur et ce type d'appel. Renvoie None si l'appel est autorisé (et
        l'enregistre), sinon "user" ou "global" selon le quota atteint.
        Vérification et enregistrement se font dans la même transaction
        exclusive, pour que des requêtes simultanées ne dépassent pas la limite.
        """
        now = datetime.now(timezone.utc)
        day_ago = (now - timedelta(days=1)).isoformat()
        with self.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                total = conn.execute(
                    "SELECT COUNT(*) FROM ai_usage WHERE created_at > ?",
                    (day_ago,),
                ).fetchone()[0]
                if total >= global_per_day:
                    conn.rollback()
                    return "global"

                for window_seconds, max_calls in limits:
                    since = (now - timedelta(seconds=window_seconds)).isoformat()
                    count = conn.execute(
                        "SELECT COUNT(*) FROM ai_usage WHERE uid = ? AND kind = ? AND created_at > ?",
                        (uid, kind, since),
                    ).fetchone()[0]
                    if count >= max_calls:
                        conn.rollback()
                        return "user"

                conn.execute(
                    "INSERT INTO ai_usage (uid, kind, created_at) VALUES (?, ?, ?)",
                    (uid, kind, now.isoformat()),
                )
                # Les lignes de plus de 2 jours ne servent plus à rien.
                conn.execute(
                    "DELETE FROM ai_usage WHERE created_at < ?",
                    ((now - timedelta(days=2)).isoformat(),),
                )
                conn.commit()
                return None
            except Exception:
                conn.rollback()
                raise

    def get_chat_conversation_owner(self, conversation_id: str) -> str | None:
        """UID propriétaire d'une conversation, ou None si elle n'existe pas."""
        with self.connection() as conn:
            row = conn.execute(
                "SELECT uid FROM chat_conversations WHERE conversation_id = ?",
                (conversation_id,),
            ).fetchone()
        return row["uid"] if row else None

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
                ORDER BY created_at ASC, rowid ASC
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