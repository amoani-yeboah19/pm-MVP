import os
import random
import string
import time
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

from auth import COOKIE_NAME, CREDENTIALS, create_session, require_auth
from database import get_db, init_db
from ai import ask, chat, BoardUpdate


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "out")


# --- helpers ---

def _card_id() -> str:
    chars = string.ascii_lowercase + string.digits
    return f"card-{''.join(random.choices(chars, k=6))}{format(int(time.time() * 1000), 'x')}"


def _get_board_id(conn, username: str) -> int:
    user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    board = conn.execute("SELECT id FROM boards WHERE user_id = ?", (user["id"],)).fetchone()
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")
    return board["id"]


def _seed_user(conn, username: str) -> None:
    conn.execute("INSERT OR IGNORE INTO users (username) VALUES (?)", (username,))
    user = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if conn.execute("SELECT id FROM boards WHERE user_id = ?", (user["id"],)).fetchone():
        return
    cursor = conn.execute(
        "INSERT INTO boards (user_id, name) VALUES (?, 'My Board')", (user["id"],)
    )
    board_id = cursor.lastrowid
    defaults = [
        ("col-backlog", "Backlog", 0),
        ("col-discovery", "Discovery", 1),
        ("col-progress", "In Progress", 2),
        ("col-review", "Review", 3),
        ("col-done", "Done", 4),
    ]
    conn.executemany(
        "INSERT INTO columns (id, board_id, title, position) VALUES (?, ?, ?, ?)",
        [(cid, board_id, title, pos) for cid, title, pos in defaults],
    )


def _board_payload(conn, board_id: int) -> dict:
    columns = conn.execute(
        "SELECT id, title FROM columns WHERE board_id = ? ORDER BY position",
        (board_id,),
    ).fetchall()
    cards = conn.execute(
        """SELECT c.id, c.column_id, c.title, c.details
           FROM cards c
           JOIN columns col ON col.id = c.column_id
           WHERE col.board_id = ?
           ORDER BY c.position""",
        (board_id,),
    ).fetchall()
    card_ids_by_col: dict[str, list[str]] = {col["id"]: [] for col in columns}
    cards_dict: dict[str, dict] = {}
    for card in cards:
        card_ids_by_col[card["column_id"]].append(card["id"])
        cards_dict[card["id"]] = {
            "id": card["id"],
            "title": card["title"],
            "details": card["details"],
        }
    return {
        "columns": [
            {"id": col["id"], "title": col["title"], "cardIds": card_ids_by_col[col["id"]]}
            for col in columns
        ],
        "cards": cards_dict,
    }


def _do_move_card(conn, card_id: str, source_col: str, target_col: str, position: int) -> None:
    source_ids = [
        r["id"]
        for r in conn.execute(
            "SELECT id FROM cards WHERE column_id = ? ORDER BY position",
            (source_col,),
        ).fetchall()
        if r["id"] != card_id
    ]
    if target_col == source_col:
        target_ids = list(source_ids)
    else:
        target_ids = [
            r["id"]
            for r in conn.execute(
                "SELECT id FROM cards WHERE column_id = ? ORDER BY position",
                (target_col,),
            ).fetchall()
        ]
    pos = max(0, min(position, len(target_ids)))
    target_ids.insert(pos, card_id)
    for i, cid in enumerate(target_ids):
        if cid == card_id:
            conn.execute(
                "UPDATE cards SET column_id = ?, position = ? WHERE id = ?",
                (target_col, i, card_id),
            )
        else:
            conn.execute("UPDATE cards SET position = ? WHERE id = ?", (i, cid))
    if target_col != source_col:
        for i, cid in enumerate(source_ids):
            conn.execute("UPDATE cards SET position = ? WHERE id = ?", (i, cid))


def _apply_board_update(conn, board_id: int, update: BoardUpdate) -> None:
    for rename in update.rename_columns:
        conn.execute(
            "UPDATE columns SET title = ? WHERE id = ? AND board_id = ?",
            (rename.title, rename.column_id, board_id),
        )
    for card_id in update.delete_card_ids:
        conn.execute(
            "DELETE FROM cards WHERE id = ? AND column_id IN (SELECT id FROM columns WHERE board_id = ?)",
            (card_id, board_id),
        )
    for spec in update.add_cards:
        col = conn.execute(
            "SELECT id FROM columns WHERE id = ? AND board_id = ?",
            (spec.column_id, board_id),
        ).fetchone()
        if not col:
            continue
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?",
            (spec.column_id,),
        ).fetchone()[0]
        cid = _card_id()
        conn.execute(
            "INSERT INTO cards (id, column_id, title, details, position) VALUES (?, ?, ?, ?, ?)",
            (cid, spec.column_id, spec.title, spec.details, max_pos + 1),
        )
    for move in update.move_cards:
        card = conn.execute(
            """SELECT c.column_id FROM cards c
               JOIN columns col ON col.id = c.column_id
               WHERE c.id = ? AND col.board_id = ?""",
            (move.card_id, board_id),
        ).fetchone()
        if not card:
            continue
        if not conn.execute(
            "SELECT id FROM columns WHERE id = ? AND board_id = ?",
            (move.column_id, board_id),
        ).fetchone():
            continue
        _do_move_card(conn, move.card_id, card["column_id"], move.column_id, move.position)


# --- request models ---

class LoginRequest(BaseModel):
    username: str
    password: str


class RenameColumnRequest(BaseModel):
    title: str


class CreateCardRequest(BaseModel):
    column_id: str
    title: str
    details: str = ""


class UpdateCardRequest(BaseModel):
    title: str | None = None
    details: str | None = None


class MoveCardRequest(BaseModel):
    column_id: str
    position: int


class HistoryMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[HistoryMessage] = []


# --- routes ---

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(body: LoginRequest, response: Response):
    if CREDENTIALS.get(body.username) != body.password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    with get_db() as conn:
        _seed_user(conn, body.username)
    token = create_session(body.username)
    response.set_cookie(COOKIE_NAME, token, httponly=True, samesite="lax", max_age=86400 * 7)
    return {"ok": True}


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"ok": True}


@app.get("/api/auth/me")
def me(username: str = Depends(require_auth)):
    return {"username": username}


@app.get("/api/board")
def get_board(username: str = Depends(require_auth)):
    with get_db() as conn:
        return _board_payload(conn, _get_board_id(conn, username))


@app.put("/api/board/columns/{column_id}")
def rename_column(
    column_id: str,
    body: RenameColumnRequest,
    username: str = Depends(require_auth),
):
    with get_db() as conn:
        board_id = _get_board_id(conn, username)
        result = conn.execute(
            "UPDATE columns SET title = ? WHERE id = ? AND board_id = ?",
            (body.title, column_id, board_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404)
    return {"ok": True}


@app.post("/api/board/cards")
def create_card(body: CreateCardRequest, username: str = Depends(require_auth)):
    with get_db() as conn:
        board_id = _get_board_id(conn, username)
        col = conn.execute(
            "SELECT id FROM columns WHERE id = ? AND board_id = ?",
            (body.column_id, board_id),
        ).fetchone()
        if not col:
            raise HTTPException(status_code=404, detail="Column not found")
        max_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) FROM cards WHERE column_id = ?",
            (body.column_id,),
        ).fetchone()[0]
        cid = _card_id()
        conn.execute(
            "INSERT INTO cards (id, column_id, title, details, position) VALUES (?, ?, ?, ?, ?)",
            (cid, body.column_id, body.title, body.details, max_pos + 1),
        )
    return {"id": cid, "title": body.title, "details": body.details}


@app.put("/api/board/cards/{card_id}")
def update_card(
    card_id: str,
    body: UpdateCardRequest,
    username: str = Depends(require_auth),
):
    with get_db() as conn:
        board_id = _get_board_id(conn, username)
        card = conn.execute(
            """SELECT c.id FROM cards c
               JOIN columns col ON col.id = c.column_id
               WHERE c.id = ? AND col.board_id = ?""",
            (card_id, board_id),
        ).fetchone()
        if not card:
            raise HTTPException(status_code=404)
        if body.title is not None:
            conn.execute("UPDATE cards SET title = ? WHERE id = ?", (body.title, card_id))
        if body.details is not None:
            conn.execute("UPDATE cards SET details = ? WHERE id = ?", (body.details, card_id))
    return {"ok": True}


@app.delete("/api/board/cards/{card_id}")
def delete_card(card_id: str, username: str = Depends(require_auth)):
    with get_db() as conn:
        board_id = _get_board_id(conn, username)
        result = conn.execute(
            """DELETE FROM cards WHERE id = ?
               AND column_id IN (SELECT id FROM columns WHERE board_id = ?)""",
            (card_id, board_id),
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404)
    return {"ok": True}


@app.put("/api/board/cards/{card_id}/move")
def move_card(
    card_id: str,
    body: MoveCardRequest,
    username: str = Depends(require_auth),
):
    with get_db() as conn:
        board_id = _get_board_id(conn, username)

        card = conn.execute(
            """SELECT c.column_id FROM cards c
               JOIN columns col ON col.id = c.column_id
               WHERE c.id = ? AND col.board_id = ?""",
            (card_id, board_id),
        ).fetchone()
        if not card:
            raise HTTPException(status_code=404)

        if not conn.execute(
            "SELECT id FROM columns WHERE id = ? AND board_id = ?",
            (body.column_id, board_id),
        ).fetchone():
            raise HTTPException(status_code=404, detail="Target column not found")

        _do_move_card(conn, card_id, card["column_id"], body.column_id, body.position)

    return {"ok": True}


@app.post("/api/ai/ping")
def ai_ping(username: str = Depends(require_auth)):
    return {"response": ask("What is 2+2?")}


@app.post("/api/ai/chat")
def ai_chat(body: ChatRequest, username: str = Depends(require_auth)):
    with get_db() as conn:
        board_id = _get_board_id(conn, username)
        board = _board_payload(conn, board_id)

    history = [m.model_dump() for m in body.history]
    try:
        ai_response = chat(board, history, body.message)
    except Exception:
        raise HTTPException(status_code=500, detail="AI response could not be processed.")

    if ai_response.board_update:
        with get_db() as conn:
            board_id = _get_board_id(conn, username)
            _apply_board_update(conn, board_id, ai_response.board_update)
        with get_db() as conn:
            board_id = _get_board_id(conn, username)
            board = _board_payload(conn, board_id)

    return {
        "message": ai_response.message,
        "board_update": ai_response.board_update.model_dump() if ai_response.board_update else None,
        "board": board,
    }


if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="frontend")
