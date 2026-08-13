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
                    next_review_date TEXT NOT NULL,
                    last_reviewed_at TEXT,
                    PRIMARY KEY (uid, course_id, item_index)
                )
                """
            )

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
        """Recherche des utilisateurs par nom affiché, avec leur statut
        d'amitié actuel vis-à-vis de exclude_uid (pour savoir quoi
        afficher : Ajouter / Demande envoyée / Ami / Accepter)."""
        if not query or not query.strip():
            return []

        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT uid, display_name, avatar_url
                FROM user_stats
                WHERE display_name LIKE ? AND uid != ? AND display_name IS NOT NULL
                ORDER BY display_name ASC
                LIMIT ?
                """,
                (f"%{query.strip()}%", exclude_uid, limit),
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

            # Calcul du streak (jours consécutifs d'activité). La colonne
            # existait déjà dans le schéma mais n'était jamais mise à jour.
            today = date.today()
            stats_row = conn.execute(
                "SELECT streak, last_activity FROM user_stats WHERE uid=?",
                (uid,)
            ).fetchone()

            last_activity_str = stats_row["last_activity"] if stats_row else None
            current_streak = stats_row["streak"] if stats_row else 0

            if last_activity_str:
                last_activity = date.fromisoformat(last_activity_str)
                delta_days = (today - last_activity).days

                if delta_days == 0:
                    # Déjà actif aujourd'hui : le streak ne bouge pas.
                    new_streak = current_streak
                elif delta_days == 1:
                    # Actif hier : la série continue.
                    new_streak = current_streak + 1
                else:
                    # Au moins un jour sauté : la série repart de 1.
                    new_streak = 1
            else:
                # Toute première activité de cet utilisateur.
                new_streak = 1

            conn.execute(
                """
                UPDATE user_stats
                SET streak = ?, last_activity = ?
                WHERE uid = ?
                """,
                (new_streak, today.isoformat(), uid)
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
        return {
            "correct": selected_option == correct_answer,
            "correct_answer": correct_answer,
        }

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
                "SELECT course_id, item_index, next_review_date FROM revision_schedule WHERE uid=?",
                (uid,),
            ).fetchall()

        schedule_by_key = {
            (row["course_id"], row["item_index"]): row["next_review_date"]
            for row in schedule_rows
        }

        today = date.today().isoformat()
        due: List[Dict] = []
        new: List[Dict] = []

        for course in courses:
            for idx, q in enumerate(course.quiz or []):
                key = (course.id, idx)
                scheduled_for = schedule_by_key.get(key)
                item = {
                    "course_id": course.id,
                    "course_nom": course.nom,
                    "item_index": idx,
                    "question": q.get("question"),
                    "options": q.get("options"),
                }
                if scheduled_for is None:
                    new.append(item)
                elif scheduled_for <= today:
                    item["overdue_days"] = (
                        date.today() - date.fromisoformat(scheduled_for)
                    ).days
                    due.append(item)

        due.sort(key=lambda it: it["overdue_days"], reverse=True)
        return (due + new)[:limit]

    def record_quiz_answer(
        self, uid: str, course_id: str, item_index: int, selected_option: str
    ) -> Dict:
        """Enregistre la réponse à une question de quiz et recalcule sa
        prochaine date de révision via SM-2. Contrairement à l'ancienne
        version basée sur les flashcards, la qualité SM-2 n'est jamais
        déclarée par le client : elle est déduite automatiquement de la
        bonne/mauvaise réponse (5 si correct, 1 sinon), ce qui retire tout
        biais d'auto-évaluation ("je pensais savoir")."""
        if not uid or not course_id:
            raise ValueError("UID and course_id are required")

        course = self.fetch_course(uid, course_id)
        if not course or item_index >= len(course.quiz or []):
            raise ValueError("Question de quiz introuvable")

        correct_answer = course.quiz[item_index].get("correct")
        is_correct = selected_option == correct_answer
        quality = 5 if is_correct else 1

        with self.transaction() as conn:
            row = conn.execute(
                """
                SELECT ease_factor, interval_days, repetitions
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

            new_schedule = next_schedule(current, quality)
            next_date = next_review_date(new_schedule)

            conn.execute(
                """
                INSERT INTO revision_schedule
                    (uid, course_id, item_index, ease_factor, interval_days, repetitions, next_review_date, last_reviewed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (uid, course_id, item_index) DO UPDATE SET
                    ease_factor=excluded.ease_factor,
                    interval_days=excluded.interval_days,
                    repetitions=excluded.repetitions,
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
                    next_date.isoformat(),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )

        return {
            "correct": is_correct,
            "correct_answer": correct_answer,
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