import os
import tempfile

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient

# Load .env so OPENROUTER_API_KEY (and any other secrets) are available.
load_dotenv()

# Point to a temp DB before any import of main/database so DB_PATH is
# picked up at module-import time in database.py. This overrides any
# DB_PATH that .env may have set.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DB_PATH"] = _tmp.name

# Create a minimal out/index.html so the StaticFiles mount is active during tests.
_out = os.path.join(os.path.dirname(__file__), "..", "out")
if not os.path.isdir(_out):
    os.makedirs(_out, exist_ok=True)
    with open(os.path.join(_out, "index.html"), "w") as f:
        f.write("<html><body><h1>Kanban Studio</h1></body></html>")

from main import app  # noqa: E402 — must come after env var is set


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_client():
    with TestClient(app) as c:
        c.post("/api/auth/login", json={"username": "user", "password": "password"})
        yield c
