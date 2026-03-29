import hashlib
import json
import os
import secrets
import sqlite3
from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.environ.get("STUDY_CRM_DATA_DIR", str(BASE_DIR / "data")))
DB_FILE = DATA_DIR / "study_crm.db"
LEGACY_JSON_FILE = DATA_DIR / "study_crm.json"
ADMIN_CODE_FILE = DATA_DIR / "admin_access_code.txt"
DEFAULT_USER = {"username": "admin", "password": "estudo123", "name": "Aluno"}
DEFAULT_DATA = {
    "subjects": [
        {
            "name": "Matematica",
            "goal": "Revisar fundamentos e avancar em algebra.",
            "status": "estudando",
            "priority": "alta",
            "nextReview": "2026-03-31",
            "progress": 35,
            "notes": "Focar em exercicios de funcao e equacao.",
        },
        {
            "name": "Historia",
            "goal": "Concluir Brasil Republica.",
            "status": "revisar",
            "priority": "media",
            "nextReview": "2026-04-02",
            "progress": 60,
            "notes": "Montar linha do tempo para fixacao.",
        },
    ],
    "tasks": [
        {"title": "Lista de equacoes do 2 grau", "subject_index": 0, "status": "fazendo", "dueDate": "2026-03-30"},
        {"title": "Resumo Era Vargas", "subject_index": 1, "status": "pendente", "dueDate": "2026-04-01"},
    ],
    "sessions": [
        {"subject_index": 0, "date": "2026-03-28", "duration": 90, "summary": "Resolvi exercicios e revisei formulas."}
    ],
}
DELETE_ERRORS = {"subjects": "Materia nao encontrada.", "tasks": "Tarefa nao encontrada.", "sessions": "Sessao nao encontrada."}


def get_db():
    connection = sqlite3.connect(DB_FILE)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def fetch_one(connection, query, params=()):
    row = connection.execute(query, params).fetchone()
    return dict(row) if row else None


def fetch_all(connection, query, params=()):
    return [dict(row) for row in connection.execute(query, params).fetchall()]


def hash_password(password, salt=None):
    final_salt = salt or secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), final_salt.encode("utf-8"), 100000)
    return f"{final_salt}${hashed.hex()}"


def verify_password(password, stored_hash):
    try:
        salt, _ = stored_hash.split("$", 1)
    except ValueError:
        return False
    return hash_password(password, salt) == stored_hash


def init_storage():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    fresh_db = not DB_FILE.exists()
    ensure_admin_code()
    with get_db() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'aluno',
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS subjects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                goal TEXT NOT NULL,
                status TEXT NOT NULL,
                priority TEXT NOT NULL,
                next_review TEXT NOT NULL,
                progress INTEGER NOT NULL,
                notes TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                subject_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                due_date TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                subject_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                duration INTEGER NOT NULL,
                summary TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
            );
            """
        )
        columns = [row["name"] for row in connection.execute("PRAGMA table_info(users)").fetchall()]
        if "role" not in columns:
            connection.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'aluno'")
            connection.execute("UPDATE users SET role = CASE WHEN username = 'admin' THEN 'admin' ELSE 'aluno' END")
        connection.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name_role ON users(name, role)")
    if fresh_db:
        migrate_initial_data()


def ensure_admin_code():
    if not ADMIN_CODE_FILE.exists():
        ADMIN_CODE_FILE.write_text(f"ADMIN-{secrets.token_hex(4).upper()}", encoding="utf-8")


def get_admin_code():
    env_code = os.environ.get("STUDY_CRM_ADMIN_CODE", "").strip()
    if env_code:
        return env_code
    ensure_admin_code()
    return ADMIN_CODE_FILE.read_text(encoding="utf-8").strip()


def migrate_initial_data():
    legacy = None
    if LEGACY_JSON_FILE.exists():
        try:
            legacy = json.loads(LEGACY_JSON_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            legacy = None
    with get_db() as connection:
        if connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]:
            return
        username = DEFAULT_USER["username"]
        name = DEFAULT_USER["name"]
        password = DEFAULT_USER["password"]
        if legacy and legacy.get("users"):
            username = legacy["users"][0].get("username", username)
            name = legacy["users"][0].get("name", name)
            password = legacy["users"][0].get("password", password)
        cursor = connection.execute(
            "INSERT INTO users (username, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (username, hash_password(password), name, "admin", datetime.now().isoformat(timespec="seconds")),
        )
        user_id = cursor.lastrowid
        if legacy and legacy.get("subjects") is not None:
            seed_from_legacy(connection, user_id, legacy)
        else:
            seed_defaults(connection, user_id)


def seed_defaults(connection, user_id):
    subject_ids = []
    for subject in DEFAULT_DATA["subjects"]:
        cursor = connection.execute(
            "INSERT INTO subjects (user_id, name, goal, status, priority, next_review, progress, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, subject["name"], subject["goal"], subject["status"], subject["priority"], subject["nextReview"], subject["progress"], subject["notes"]),
        )
        subject_ids.append(cursor.lastrowid)
    for task in DEFAULT_DATA["tasks"]:
        connection.execute(
            "INSERT INTO tasks (user_id, subject_id, title, status, due_date) VALUES (?, ?, ?, ?, ?)",
            (user_id, subject_ids[task["subject_index"]], task["title"], task["status"], task["dueDate"]),
        )
    for session in DEFAULT_DATA["sessions"]:
        connection.execute(
            "INSERT INTO sessions (user_id, subject_id, date, duration, summary) VALUES (?, ?, ?, ?, ?)",
            (user_id, subject_ids[session["subject_index"]], session["date"], session["duration"], session["summary"]),
        )


def seed_from_legacy(connection, user_id, legacy):
    subject_map = {}
    for subject in legacy.get("subjects", []):
        cursor = connection.execute(
            "INSERT INTO subjects (user_id, name, goal, status, priority, next_review, progress, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (user_id, subject["name"], subject["goal"], subject["status"], subject["priority"], subject["nextReview"], int(subject["progress"]), subject["notes"]),
        )
        subject_map[subject["id"]] = cursor.lastrowid
    for task in legacy.get("tasks", []):
        mapped = subject_map.get(task["subjectId"])
        if mapped:
            connection.execute(
                "INSERT INTO tasks (user_id, subject_id, title, status, due_date) VALUES (?, ?, ?, ?, ?)",
                (user_id, mapped, task["title"], task["status"], task["dueDate"]),
            )
    for session in legacy.get("sessions", []):
        mapped = subject_map.get(session["subjectId"])
        if mapped:
            connection.execute(
                "INSERT INTO sessions (user_id, subject_id, date, duration, summary) VALUES (?, ?, ?, ?, ?)",
                (user_id, mapped, session["date"], int(session["duration"]), session["summary"]),
            )


def get_user_by_session_username(username):
    with get_db() as connection:
        return fetch_one(connection, "SELECT id, username, name, role FROM users WHERE username = ?", (username,))


def get_user_by_id(user_id):
    with get_db() as connection:
        return fetch_one(connection, "SELECT id, username, name, role FROM users WHERE id = ?", (user_id,))


def get_user_for_login(name, role):
    with get_db() as connection:
        return fetch_one(
            connection,
            "SELECT id, username, name, role, password_hash FROM users WHERE name = ? AND role = ?",
            (name, role),
        )


def register_user(name, role, password, admin_code=""):
    name = name.strip()
    role = role.strip().lower()
    password = password.strip()
    if not name or not role or not password:
        raise ValueError("Preencha nome, cargo e senha.")
    if role not in {"aluno", "admin"}:
        raise ValueError("Cargo invalido.")
    if role == "admin" and admin_code.strip() != get_admin_code():
        raise ValueError("Codigo de admin invalido.")
    username = f"{role}_{name.lower().replace(' ', '_')}_{secrets.token_hex(3)}"
    with get_db() as connection:
        if fetch_one(connection, "SELECT id FROM users WHERE name = ? AND role = ?", (name, role)):
            raise ValueError("Ja existe uma conta com esse nome e cargo.")
        cursor = connection.execute(
            "INSERT INTO users (username, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (username, hash_password(password), name, role, datetime.now().isoformat(timespec="seconds")),
        )
        return {"id": cursor.lastrowid, "username": username, "name": name, "role": role}


def get_subjects(user_id):
    with get_db() as connection:
        return fetch_all(connection, "SELECT id, name, goal, status, priority, next_review AS nextReview, progress, notes FROM subjects WHERE user_id = ? ORDER BY next_review, name", (user_id,))


def get_tasks(user_id, subject_id=None):
    with get_db() as connection:
        if subject_id:
            return fetch_all(connection, "SELECT id, title, subject_id AS subjectId, status, due_date AS dueDate FROM tasks WHERE user_id = ? AND subject_id = ? ORDER BY due_date, id", (user_id, subject_id))
        return fetch_all(connection, "SELECT id, title, subject_id AS subjectId, status, due_date AS dueDate FROM tasks WHERE user_id = ? ORDER BY due_date, id", (user_id,))


def get_sessions(user_id):
    with get_db() as connection:
        return fetch_all(connection, "SELECT id, subject_id AS subjectId, date, duration, summary FROM sessions WHERE user_id = ? ORDER BY date DESC, id DESC", (user_id,))


def get_dashboard_data(user_id):
    subjects = get_subjects(user_id)
    tasks = get_tasks(user_id)
    sessions = get_sessions(user_id)
    total_minutes = sum(item["duration"] for item in sessions)
    return {
        "summary": {
            "subjects": len(subjects),
            "studying": len([item for item in subjects if item["status"] == "estudando"]),
            "review": len([item for item in subjects if item["status"] == "revisar"]),
            "tasksDone": len([item for item in tasks if item["status"] == "concluida"]),
            "hoursStudied": round(total_minutes / 60, 1),
        },
        "subjects": subjects,
        "tasks": tasks,
        "sessions": sessions,
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
    }


def get_users_list():
    with get_db() as connection:
        return fetch_all(
            connection,
            """
            SELECT
              u.id,
              u.name,
              u.role,
              u.created_at AS createdAt,
              COUNT(DISTINCT s.id) AS subjects,
              COUNT(DISTINCT t.id) AS tasks,
              COUNT(DISTINCT se.id) AS sessions
            FROM users u
            LEFT JOIN subjects s ON s.user_id = u.id
            LEFT JOIN tasks t ON t.user_id = u.id
            LEFT JOIN sessions se ON se.user_id = u.id
            GROUP BY u.id, u.name, u.role, u.created_at
            ORDER BY CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END, u.name
            """,
        )


def validate_subject_for_user(user_id, subject_id):
    with get_db() as connection:
        return fetch_one(connection, "SELECT id, name FROM subjects WHERE id = ? AND user_id = ?", (subject_id, user_id))


def validate_subject_payload(payload):
    required = ["name", "goal", "status", "priority", "nextReview", "progress", "notes"]
    if any(field not in payload or str(payload[field]).strip() == "" for field in required):
        raise ValueError("Preencha todos os campos da materia.")
    progress = int(payload["progress"])
    if progress < 0 or progress > 100:
        raise ValueError("O progresso deve estar entre 0 e 100.")
    if payload["status"] == "concluido" and progress != 100:
        raise ValueError("Uma materia so pode ser concluida com progresso de 100%.")


def validate_task_payload(payload):
    required = ["title", "subjectId", "status", "dueDate"]
    if any(field not in payload or str(payload[field]).strip() == "" for field in required):
        raise ValueError("Preencha todos os campos da tarefa.")


def validate_session_payload(payload):
    required = ["subjectId", "date", "duration", "summary"]
    if any(field not in payload or str(payload[field]).strip() == "" for field in required):
        raise ValueError("Preencha todos os campos da sessao.")


def upsert_subject(user_id, payload, subject_id=None):
    with get_db() as connection:
        current = None
        if subject_id:
            current = fetch_one(connection, "SELECT id, name, goal, status, priority, next_review AS nextReview, progress, notes FROM subjects WHERE id = ? AND user_id = ?", (subject_id, user_id))
            if not current:
                raise LookupError("Materia nao encontrada.")
        merged = current or {}
        merged = {
            "name": payload.get("name", merged.get("name", "")),
            "goal": payload.get("goal", merged.get("goal", "")),
            "status": payload.get("status", merged.get("status", "")),
            "priority": payload.get("priority", merged.get("priority", "")),
            "nextReview": payload.get("nextReview", merged.get("nextReview", "")),
            "progress": payload.get("progress", merged.get("progress", "")),
            "notes": payload.get("notes", merged.get("notes", "")),
        }
        validate_subject_payload(merged)
        values = (user_id, str(merged["name"]).strip(), str(merged["goal"]).strip(), merged["status"], merged["priority"], merged["nextReview"], int(merged["progress"]), str(merged["notes"]).strip())
        if subject_id:
            connection.execute("UPDATE subjects SET name = ?, goal = ?, status = ?, priority = ?, next_review = ?, progress = ?, notes = ? WHERE id = ? AND user_id = ?", values[1:] + (subject_id, user_id))
        else:
            cursor = connection.execute("INSERT INTO subjects (user_id, name, goal, status, priority, next_review, progress, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", values)
            subject_id = cursor.lastrowid
        return fetch_one(connection, "SELECT id, name, goal, status, priority, next_review AS nextReview, progress, notes FROM subjects WHERE id = ?", (subject_id,))


def upsert_task(user_id, payload, task_id=None):
    with get_db() as connection:
        current = None
        if task_id:
            current = fetch_one(connection, "SELECT id, title, subject_id AS subjectId, status, due_date AS dueDate FROM tasks WHERE id = ? AND user_id = ?", (task_id, user_id))
            if not current:
                raise LookupError("Tarefa nao encontrada.")
        merged = current or {}
        merged = {
            "title": payload.get("title", merged.get("title", "")),
            "subjectId": payload.get("subjectId", merged.get("subjectId", "")),
            "status": payload.get("status", merged.get("status", "")),
            "dueDate": payload.get("dueDate", merged.get("dueDate", "")),
        }
        validate_task_payload(merged)
        if not fetch_one(connection, "SELECT id FROM subjects WHERE id = ? AND user_id = ?", (int(merged["subjectId"]), user_id)):
            raise ValueError("Materia invalida.")
        values = (str(merged["title"]).strip(), int(merged["subjectId"]), merged["status"], merged["dueDate"], user_id)
        if task_id:
            connection.execute("UPDATE tasks SET title = ?, subject_id = ?, status = ?, due_date = ? WHERE id = ? AND user_id = ?", values[:-1] + (task_id, user_id))
        else:
            cursor = connection.execute("INSERT INTO tasks (title, subject_id, status, due_date, user_id) VALUES (?, ?, ?, ?, ?)", values)
            task_id = cursor.lastrowid
        return fetch_one(connection, "SELECT id, title, subject_id AS subjectId, status, due_date AS dueDate FROM tasks WHERE id = ?", (task_id,))


def upsert_session(user_id, payload, session_id=None):
    with get_db() as connection:
        current = None
        if session_id:
            current = fetch_one(connection, "SELECT id, subject_id AS subjectId, date, duration, summary FROM sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
            if not current:
                raise LookupError("Sessao nao encontrada.")
        merged = current or {}
        merged = {
            "subjectId": payload.get("subjectId", merged.get("subjectId", "")),
            "date": payload.get("date", merged.get("date", "")),
            "duration": payload.get("duration", merged.get("duration", "")),
            "summary": payload.get("summary", merged.get("summary", "")),
        }
        validate_session_payload(merged)
        if not fetch_one(connection, "SELECT id FROM subjects WHERE id = ? AND user_id = ?", (int(merged["subjectId"]), user_id)):
            raise ValueError("Materia invalida.")
        values = (int(merged["subjectId"]), merged["date"], int(merged["duration"]), str(merged["summary"]).strip(), user_id)
        if session_id:
            connection.execute("UPDATE sessions SET subject_id = ?, date = ?, duration = ?, summary = ? WHERE id = ? AND user_id = ?", values[:-1] + (session_id, user_id))
        else:
            cursor = connection.execute("INSERT INTO sessions (subject_id, date, duration, summary, user_id) VALUES (?, ?, ?, ?, ?)", values)
            session_id = cursor.lastrowid
        return fetch_one(connection, "SELECT id, subject_id AS subjectId, date, duration, summary FROM sessions WHERE id = ?", (session_id,))


def delete_by_id(table, user_id, item_id):
    with get_db() as connection:
        deleted = connection.execute(f"DELETE FROM {table} WHERE id = ? AND user_id = ?", (item_id, user_id)).rowcount
    if not deleted:
        raise LookupError(DELETE_ERRORS[table])
