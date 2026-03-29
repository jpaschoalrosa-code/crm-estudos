import json
import os
import secrets
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from storage import (
    DB_FILE,
    delete_by_id,
    get_dashboard_data,
    get_sessions,
    get_user_by_id,
    get_users_list,
    get_subjects,
    get_tasks,
    get_user_for_login,
    init_storage,
    register_user,
    upsert_session,
    upsert_subject,
    upsert_task,
    verify_password,
)


BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
SESSIONS = {}


def get_cookie_value(handler, name):
    raw = handler.headers.get("Cookie")
    if not raw:
        return None
    cookie = SimpleCookie()
    cookie.load(raw)
    return cookie.get(name).value if cookie.get(name) else None


def json_response(handler, status, payload, cookies=None):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    if cookies:
        for cookie in cookies:
            handler.send_header("Set-Cookie", cookie)
    handler.end_headers()
    handler.wfile.write(body)


def text_response(handler, status, body, content_type="text/plain; charset=utf-8"):
    raw = body.encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", content_type)
    handler.send_header("Content-Length", str(len(raw)))
    handler.end_headers()
    handler.wfile.write(raw)


def session_cookie(token):
    return f"studycrm_session={token}; Path=/; HttpOnly; SameSite=Lax"


def clear_session_cookie():
    return "studycrm_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"


class StudyCRMHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(HTTPStatus.NO_CONTENT)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/healthz":
            json_response(self, HTTPStatus.OK, {"ok": True})
            return
        if parsed.path == "/api/session":
            self.handle_session_status()
            return
        if parsed.path.startswith("/api/"):
            user = self.require_auth()
            if not user:
                return
            if parsed.path == "/api/dashboard":
                json_response(self, HTTPStatus.OK, get_dashboard_data(user["id"]))
                return
            if parsed.path == "/api/subjects":
                json_response(self, HTTPStatus.OK, get_subjects(user["id"]))
                return
            if parsed.path == "/api/tasks":
                subject_id = parse_qs(parsed.query).get("subjectId", [None])[0]
                json_response(self, HTTPStatus.OK, get_tasks(user["id"], int(subject_id) if subject_id else None))
                return
            if parsed.path == "/api/sessions":
                json_response(self, HTTPStatus.OK, get_sessions(user["id"]))
                return
            if parsed.path == "/api/users":
                if user["role"] != "admin":
                    json_response(self, HTTPStatus.FORBIDDEN, {"error": "Acesso restrito ao admin."})
                    return
                json_response(self, HTTPStatus.OK, get_users_list())
                return
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "Rota nao encontrada."})
            return
        self.serve_static(parsed.path)

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/login":
            self.handle_login()
            return
        if parsed.path == "/api/register":
            self.handle_register()
            return
        if parsed.path == "/api/logout":
            self.handle_logout()
            return
        if not parsed.path.startswith("/api/"):
            json_response(self, HTTPStatus.NOT_FOUND, {"error": "Rota nao encontrada."})
            return
        user = self.require_auth()
        if not user:
            return
        body = self.read_json_body()
        if body is None:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "JSON invalido."})
            return
        try:
            if parsed.path == "/api/subjects":
                json_response(self, HTTPStatus.CREATED, upsert_subject(user["id"], body))
                return
            if parsed.path == "/api/tasks":
                json_response(self, HTTPStatus.CREATED, upsert_task(user["id"], body))
                return
            if parsed.path == "/api/sessions":
                json_response(self, HTTPStatus.CREATED, upsert_session(user["id"], body))
                return
        except ValueError as error:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        json_response(self, HTTPStatus.NOT_FOUND, {"error": "Rota nao encontrada."})

    def do_PUT(self):
        parsed = urlparse(self.path)
        user = self.require_auth()
        if not parsed.path.startswith("/api/") or not user:
            if not parsed.path.startswith("/api/"):
                json_response(self, HTTPStatus.NOT_FOUND, {"error": "Rota nao encontrada."})
            return
        body = self.read_json_body()
        if body is None:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "JSON invalido."})
            return
        item_id = self.extract_id(parsed.path)
        try:
            if parsed.path.startswith("/api/subjects/"):
                json_response(self, HTTPStatus.OK, upsert_subject(user["id"], body, item_id))
                return
            if parsed.path.startswith("/api/tasks/"):
                json_response(self, HTTPStatus.OK, upsert_task(user["id"], body, item_id))
                return
            if parsed.path.startswith("/api/sessions/"):
                json_response(self, HTTPStatus.OK, upsert_session(user["id"], body, item_id))
                return
        except LookupError as error:
            json_response(self, HTTPStatus.NOT_FOUND, {"error": str(error)})
            return
        except ValueError as error:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        json_response(self, HTTPStatus.NOT_FOUND, {"error": "Rota nao encontrada."})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        user = self.require_auth()
        if not parsed.path.startswith("/api/") or not user:
            if not parsed.path.startswith("/api/"):
                json_response(self, HTTPStatus.NOT_FOUND, {"error": "Rota nao encontrada."})
            return
        item_id = self.extract_id(parsed.path)
        try:
            if parsed.path.startswith("/api/subjects/"):
                delete_by_id("subjects", user["id"], item_id)
            elif parsed.path.startswith("/api/tasks/"):
                delete_by_id("tasks", user["id"], item_id)
            elif parsed.path.startswith("/api/sessions/"):
                delete_by_id("sessions", user["id"], item_id)
            else:
                json_response(self, HTTPStatus.NOT_FOUND, {"error": "Rota nao encontrada."})
                return
        except LookupError as error:
            json_response(self, HTTPStatus.NOT_FOUND, {"error": str(error)})
            return
        json_response(self, HTTPStatus.OK, {"deleted": item_id})

    def serve_static(self, path):
        target = "index.html" if path in ("/", "") else path.lstrip("/")
        file_path = (PUBLIC_DIR / target).resolve()
        if not str(file_path).startswith(str(PUBLIC_DIR.resolve())) or not file_path.exists():
            text_response(self, HTTPStatus.NOT_FOUND, "Arquivo nao encontrado.")
            return
        content_type = "text/plain; charset=utf-8"
        if file_path.suffix == ".html":
            content_type = "text/html; charset=utf-8"
        elif file_path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif file_path.suffix == ".js":
            content_type = "application/javascript; charset=utf-8"
        text_response(self, HTTPStatus.OK, file_path.read_text(encoding="utf-8"), content_type)

    def read_json_body(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return None

    def current_user(self):
        token = get_cookie_value(self, "studycrm_session")
        user_id = SESSIONS.get(token)
        if not user_id:
            return None
        return get_user_by_id(user_id)

    def require_auth(self):
        user = self.current_user()
        if user:
            return user
        json_response(self, HTTPStatus.UNAUTHORIZED, {"error": "Login necessario."}, cookies=[clear_session_cookie()])
        return None

    def handle_session_status(self):
        user = self.current_user()
        if not user:
            json_response(self, HTTPStatus.OK, {"authenticated": False, "database": str(DB_FILE)})
            return
        json_response(self, HTTPStatus.OK, {"authenticated": True, "user": user, "database": str(DB_FILE)})

    def handle_login(self):
        body = self.read_json_body()
        if body is None:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "JSON invalido."})
            return
        name = body.get("name", "").strip()
        role = body.get("role", "").strip().lower()
        user = get_user_for_login(name, role)
        password = body.get("password", "").strip()
        if not user or not verify_password(password, user["password_hash"]):
            json_response(self, HTTPStatus.UNAUTHORIZED, {"error": "Nome, cargo ou senha invalidos."})
            return
        token = secrets.token_hex(16)
        SESSIONS[token] = user["id"]
        json_response(
            self,
            HTTPStatus.OK,
            {"authenticated": True, "user": {"id": user["id"], "name": user["name"], "role": user["role"]}},
            cookies=[session_cookie(token)],
        )

    def handle_register(self):
        body = self.read_json_body()
        if body is None:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "JSON invalido."})
            return
        try:
            user = register_user(
                body.get("name", ""),
                body.get("role", ""),
                body.get("password", ""),
                body.get("adminCode", ""),
            )
        except ValueError as error:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        token = secrets.token_hex(16)
        SESSIONS[token] = user["id"]
        json_response(self, HTTPStatus.CREATED, {"authenticated": True, "user": user}, cookies=[session_cookie(token)])

    def handle_logout(self):
        token = get_cookie_value(self, "studycrm_session")
        if token in SESSIONS:
            del SESSIONS[token]
        json_response(self, HTTPStatus.OK, {"logout": True}, cookies=[clear_session_cookie()])

    @staticmethod
    def extract_id(path):
        return int(path.rstrip("/").split("/")[-1])

    def log_message(self, format, *args):
        return


def run():
    init_storage()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), StudyCRMHandler)
    print(f"Servidor do CRM rodando em http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run()
