def test_board_requires_auth(client):
    assert client.get("/api/board").status_code == 401


def test_get_board_returns_five_columns(auth_client):
    res = auth_client.get("/api/board")
    assert res.status_code == 200
    data = res.json()
    assert len(data["columns"]) == 5
    assert isinstance(data["cards"], dict)
    col = data["columns"][0]
    assert {"id", "title", "cardIds"} <= col.keys()


def test_create_card(auth_client):
    res = auth_client.post(
        "/api/board/cards",
        json={"column_id": "col-backlog", "title": "Test card", "details": "Some details"},
    )
    assert res.status_code == 200
    card = res.json()
    assert card["title"] == "Test card"
    assert card["id"].startswith("card-")

    board = auth_client.get("/api/board").json()
    assert card["id"] in board["cards"]
    backlog = next(c for c in board["columns"] if c["id"] == "col-backlog")
    assert card["id"] in backlog["cardIds"]


def test_rename_column(auth_client):
    res = auth_client.put("/api/board/columns/col-backlog", json={"title": "To Do"})
    assert res.status_code == 200
    board = auth_client.get("/api/board").json()
    backlog = next(c for c in board["columns"] if c["id"] == "col-backlog")
    assert backlog["title"] == "To Do"
    # restore so other tests aren't affected
    auth_client.put("/api/board/columns/col-backlog", json={"title": "Backlog"})


def test_update_card(auth_client):
    card = auth_client.post(
        "/api/board/cards",
        json={"column_id": "col-backlog", "title": "Original title", "details": ""},
    ).json()
    res = auth_client.put(f"/api/board/cards/{card['id']}", json={"title": "Updated title"})
    assert res.status_code == 200
    board = auth_client.get("/api/board").json()
    assert board["cards"][card["id"]]["title"] == "Updated title"


def test_delete_card(auth_client):
    card = auth_client.post(
        "/api/board/cards",
        json={"column_id": "col-backlog", "title": "To delete", "details": ""},
    ).json()
    res = auth_client.delete(f"/api/board/cards/{card['id']}")
    assert res.status_code == 200
    board = auth_client.get("/api/board").json()
    assert card["id"] not in board["cards"]


def test_move_card_between_columns(auth_client):
    card = auth_client.post(
        "/api/board/cards",
        json={"column_id": "col-backlog", "title": "Moving card", "details": ""},
    ).json()
    res = auth_client.put(
        f"/api/board/cards/{card['id']}/move",
        json={"column_id": "col-done", "position": 0},
    )
    assert res.status_code == 200
    board = auth_client.get("/api/board").json()
    done = next(c for c in board["columns"] if c["id"] == "col-done")
    backlog = next(c for c in board["columns"] if c["id"] == "col-backlog")
    assert card["id"] in done["cardIds"]
    assert card["id"] not in backlog["cardIds"]


def test_unknown_column_returns_404(auth_client):
    res = auth_client.put("/api/board/columns/col-nope", json={"title": "X"})
    assert res.status_code == 404


def test_unknown_card_returns_404(auth_client):
    assert auth_client.delete("/api/board/cards/card-nope").status_code == 404
