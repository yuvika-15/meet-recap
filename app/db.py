import sqlite3
from contextlib import contextmanager

DB_PATH = "recap_agent.db"
import os

print("Database path:", os.path.abspath(DB_PATH))


@contextmanager
def get_connection():
    """
    Opens a SQLite connection and guarantees it gets closed afterward, even
    if something errors out partway through. `row_factory = sqlite3.Row`
    lets us read columns by name (like a dict) instead of by index number,
    which is much easier to work with as your schema grows.
    """
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    print("========== INIT DB ==========")

    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS classes (
                id TEXT PRIMARY KEY,
                video_path TEXT NOT NULL,
                audio_path TEXT,
                status TEXT NOT NULL DEFAULT 'uploaded',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.commit()

        tables = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()

        print([dict(row) for row in tables])


def create_class_record(class_id: str, video_path: str):
    """Inserts a new row the moment a recording is uploaded."""
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO classes (id, video_path, status) VALUES (?, ?, 'uploaded')",
            (class_id, video_path),
        )
        conn.commit()


def get_class(class_id: str):
    """
    Fetches one class record as a plain Python dict, or None if no row
    with that id exists.
    """
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM classes WHERE id = ?", (class_id,)
        ).fetchone()
        return dict(row) if row else None


def update_audio_path(class_id: str, audio_path: str):
    """Called after ffmpeg finishes - saves the audio path and advances status."""
    with get_connection() as conn:
        conn.execute(
            "UPDATE classes SET audio_path = ?, status = 'audio_extracted' WHERE id = ?",
            (audio_path, class_id),
        )
        conn.commit()