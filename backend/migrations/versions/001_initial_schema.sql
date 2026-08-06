-- Migration 001: Initial schema
-- Establishes all tables, indexes, triggers, and seed data that were
-- originally created inline by Database.initialise().

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
);

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
);

CREATE TABLE IF NOT EXISTS paths (
    path_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    color TEXT,
    emoji TEXT,
    total_lessons INTEGER DEFAULT 0
);

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
);

CREATE TABLE IF NOT EXISTS user_lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uid TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    path_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('locked','available','completed')),
    stars INTEGER DEFAULT 0,
    FOREIGN KEY (lesson_id) REFERENCES lessons(lesson_id)
);

CREATE TABLE IF NOT EXISTS user_stats (
    uid TEXT PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    last_activity DATE
);

CREATE INDEX IF NOT EXISTS idx_courses_uid ON courses(uid);
CREATE INDEX IF NOT EXISTS idx_sessions_uid ON user_sessions(uid);
CREATE INDEX IF NOT EXISTS idx_sessions_course ON user_sessions(uid, course_id);

CREATE TRIGGER IF NOT EXISTS update_course_timestamp
AFTER UPDATE ON courses
BEGIN
    UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE uid = NEW.uid AND course_id = NEW.course_id;
END;

INSERT OR IGNORE INTO paths (path_id, title, description, color, emoji, total_lessons)
VALUES
    ('anatomy',      'Anatomie',      'Système squelettique, musculaire et organes', '#3b82f6', '🦴', 10),
    ('cardiology',   'Cardiologie',   'Système cardiovasculaire et pathologies',      '#ef4444', '❤️', 10),
    ('neurology',    'Neurologie',    'Système nerveux et fonctions cérébrales',      '#8b5cf6', '🧠', 10),
    ('pharmacology', 'Pharmacologie', 'Médicaments et leurs actions',                 '#10b981', '💊', 10);

INSERT OR IGNORE INTO lessons (lesson_id, path_id, title, type, position, stars, status, xp)
VALUES
    ('1',  'anatomy', 'Introduction',        'lesson', 'center', 3, 'available', 10),
    ('2',  'anatomy', 'Os du crâne',         'lesson', 'left',   2, 'available', 10),
    ('3',  'anatomy', 'Révision 1',          'review', 'center', 3, 'available', 15),
    ('4',  'anatomy', 'Colonne vertébrale',  'lesson', 'right',  3, 'available', 10),
    ('5',  'anatomy', 'Cage thoracique',     'lesson', 'left',   0, 'available', 10),
    ('6',  'anatomy', 'Test 1',              'test',   'center', 0, 'available', 30),
    ('7',  'anatomy', 'Membres supérieurs',  'lesson', 'right',  0, 'locked',    10),
    ('8',  'anatomy', 'Membres inférieurs',  'lesson', 'center', 0, 'locked',    10),
    ('9',  'anatomy', 'Révision 2',          'review', 'left',   0, 'locked',    15),
    ('10', 'anatomy', 'Test final',          'test',   'center', 0, 'locked',    30)
