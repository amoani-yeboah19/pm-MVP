"""
AI tests.

Part 8 tests (test_ask_*, test_ping_*) call the real OpenRouter API and are
skipped automatically when OPENROUTER_API_KEY is not in the environment.

Part 9 tests mock `main.chat` so they run without any API key.
"""

import os
from unittest.mock import patch

import pytest

from ai import AIResponse, BoardUpdate, CardSpec, MoveSpec, RenameSpec

_has_key = bool(os.environ.get("OPENROUTER_API_KEY"))


# --- Part 8: real API connectivity ---

@pytest.mark.skipif(not _has_key, reason="OPENROUTER_API_KEY not set")
def test_ask_returns_non_empty_string():
    from ai import ask
    result = ask("What is 2+2?")
    assert isinstance(result, str)
    assert len(result.strip()) > 0


@pytest.mark.skipif(not _has_key, reason="OPENROUTER_API_KEY not set")
def test_ping_endpoint_returns_response(auth_client):
    res = auth_client.post("/api/ai/ping")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data["response"], str)
    assert len(data["response"].strip()) > 0


def test_ping_requires_auth(client):
    assert client.post("/api/ai/ping").status_code == 401


# --- Part 9: structured output + board mutations ---

def test_chat_requires_auth(client):
    assert client.post("/api/ai/chat", json={"message": "hi", "history": []}).status_code == 401


def test_chat_null_board_update(auth_client):
    mock_resp = AIResponse(message="Just chatting")
    with patch("main.chat", return_value=mock_resp):
        res = auth_client.post("/api/ai/chat", json={"message": "hello", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["message"] == "Just chatting"
    assert data["board_update"] is None
    assert "columns" in data["board"]


def test_chat_add_card_mutation(auth_client):
    update = BoardUpdate(add_cards=[CardSpec(column_id="col-backlog", title="AI Task")])
    mock_resp = AIResponse(message="Added a card", board_update=update)
    with patch("main.chat", return_value=mock_resp):
        res = auth_client.post("/api/ai/chat", json={"message": "add a card", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["message"] == "Added a card"
    # board in response already reflects mutation
    titles = [c["title"] for c in data["board"]["cards"].values()]
    assert "AI Task" in titles
    # verify persisted
    board = auth_client.get("/api/board").json()
    assert "AI Task" in [c["title"] for c in board["cards"].values()]


def test_chat_rename_column_mutation(auth_client):
    update = BoardUpdate(rename_columns=[RenameSpec(column_id="col-discovery", title="Research")])
    mock_resp = AIResponse(message="Renamed", board_update=update)
    with patch("main.chat", return_value=mock_resp):
        res = auth_client.post("/api/ai/chat", json={"message": "rename discovery", "history": []})
    assert res.status_code == 200
    board = auth_client.get("/api/board").json()
    titles = [col["title"] for col in board["columns"]]
    assert "Research" in titles


def test_chat_delete_card_mutation(auth_client):
    card_res = auth_client.post(
        "/api/board/cards", json={"column_id": "col-backlog", "title": "To delete", "details": ""}
    )
    card_id = card_res.json()["id"]
    update = BoardUpdate(delete_card_ids=[card_id])
    mock_resp = AIResponse(message="Deleted", board_update=update)
    with patch("main.chat", return_value=mock_resp):
        res = auth_client.post("/api/ai/chat", json={"message": "delete it", "history": []})
    assert res.status_code == 200
    board = auth_client.get("/api/board").json()
    assert card_id not in board["cards"]


def test_chat_move_card_mutation(auth_client):
    card_res = auth_client.post(
        "/api/board/cards", json={"column_id": "col-backlog", "title": "Moveable", "details": ""}
    )
    card_id = card_res.json()["id"]
    update = BoardUpdate(move_cards=[MoveSpec(card_id=card_id, column_id="col-done", position=0)])
    mock_resp = AIResponse(message="Moved", board_update=update)
    with patch("main.chat", return_value=mock_resp):
        res = auth_client.post("/api/ai/chat", json={"message": "move it", "history": []})
    assert res.status_code == 200
    board = auth_client.get("/api/board").json()
    done_col = next(col for col in board["columns"] if col["id"] == "col-done")
    assert card_id in done_col["cardIds"]


def test_chat_invalid_column_id_skipped(auth_client):
    update = BoardUpdate(add_cards=[CardSpec(column_id="col-nonexistent", title="Ghost")])
    mock_resp = AIResponse(message="tried", board_update=update)
    with patch("main.chat", return_value=mock_resp):
        res = auth_client.post("/api/ai/chat", json={"message": "add card", "history": []})
    assert res.status_code == 200
    board = auth_client.get("/api/board").json()
    assert "Ghost" not in [c["title"] for c in board["cards"].values()]


def test_chat_ai_exception_returns_500(auth_client):
    with patch("main.chat", side_effect=ValueError("bad json")):
        res = auth_client.post("/api/ai/chat", json={"message": "bad", "history": []})
    assert res.status_code == 500
