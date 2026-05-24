import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import settings

def get_db_connection() -> sqlite3.Connection:
    """Establish a direct sqlite3 connection to the configured database path with foreign keys enabled."""
    conn = sqlite3.connect(settings.SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row  # Returns dictionaries/rows instead of tuples
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db() -> None:
    """Initialize SQLite tables for Portals, Skills, Chat Sessions, Messages, and Audit Logs if they do not exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Portals table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS portals (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        base_url TEXT NOT NULL,
        headers TEXT NOT NULL, -- JSON serialized dict of request headers (auth keys, etc.)
        swagger_doc TEXT,      -- Uploaded OpenAPI Swagger spec (JSON/YAML)
        created_at TEXT NOT NULL
    )
    """)
    
    # 2. Project Skills table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        portal_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        yaml_content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (portal_id) REFERENCES portals (id) ON DELETE CASCADE
    )
    """)
    
    # 3. Chat Sessions table (references portals)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        portal_id TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (portal_id) REFERENCES portals (id) ON DELETE CASCADE
    )
    """)
    
    # 4. Session Messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS session_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
    )
    """)
    
    # 5. Session Audit Logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS session_audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        log_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()

# --- Database Helper Functions ---

# Portals API
def save_portal(portal_id: str, name: str, base_url: str, headers: Dict[str, str], swagger_doc: Optional[str] = None) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("""
    INSERT INTO portals (id, name, base_url, headers, swagger_doc, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        base_url=excluded.base_url,
        headers=excluded.headers,
        swagger_doc=COALESCE(excluded.swagger_doc, swagger_doc)
    """, (portal_id, name, base_url, json.dumps(headers), swagger_doc, now))
    conn.commit()
    conn.close()

def get_portal(portal_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM portals WHERE id = ?", (portal_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        portal = dict(row)
        portal["headers"] = json.loads(portal["headers"])
        return portal
    return None

def list_portals() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, name, base_url, headers, swagger_doc, created_at FROM portals ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        d["headers"] = json.loads(d["headers"])
        results.append(d)
    return results

def delete_portal(portal_id: str) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM portals WHERE id = ?", (portal_id,))
    conn.commit()
    conn.close()

# Skills API
def save_skill(skill_id: str, portal_id: str, name: str, description: str, yaml_content: str) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("""
    INSERT INTO skills (id, portal_id, name, description, yaml_content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        portal_id=excluded.portal_id,
        name=excluded.name,
        description=excluded.description,
        yaml_content=excluded.yaml_content
    """, (skill_id, portal_id, name, description, yaml_content, now))
    conn.commit()
    conn.close()

def get_skill(skill_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM skills WHERE id = ?", (skill_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def list_skills(portal_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if portal_id:
        cursor.execute("SELECT * FROM skills WHERE portal_id = ? ORDER BY created_at DESC", (portal_id,))
    else:
        cursor.execute("SELECT * FROM skills ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_skill(skill_id: str) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM skills WHERE id = ?", (skill_id,))
    conn.commit()
    conn.close()

# Sessions API
def save_session(session_id: str, portal_id: str, title: str) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("""
    INSERT INTO sessions (id, portal_id, title, created_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        portal_id=excluded.portal_id,
        title=excluded.title
    """, (session_id, portal_id, title, now))
    conn.commit()
    conn.close()

def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def list_sessions(portal_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    if portal_id:
        cursor.execute("SELECT * FROM sessions WHERE portal_id = ? ORDER BY created_at DESC", (portal_id,))
    else:
        cursor.execute("SELECT * FROM sessions ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def delete_session(session_id: str) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()

def save_message(session_id: str, sender: str, text: str) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("""
    INSERT INTO session_messages (session_id, sender, text, created_at)
    VALUES (?, ?, ?, ?)
    """, (session_id, sender, text, now))
    conn.commit()
    conn.close()

def list_messages(session_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT sender, text, created_at FROM session_messages WHERE session_id = ? ORDER BY id ASC", (session_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def save_audit_log(session_id: str, log_text: str) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    cursor.execute("""
    INSERT INTO session_audit_logs (session_id, log_text, created_at)
    VALUES (?, ?, ?)
    """, (session_id, log_text, now))
    conn.commit()
    conn.close()

def list_audit_logs(session_id: str) -> List[str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT log_text FROM session_audit_logs WHERE session_id = ? ORDER BY id ASC", (session_id,))
    rows = cursor.fetchall()
    conn.close()
    return [r["log_text"] for r in rows]
