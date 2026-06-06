def test_login_valid_credentials(client):
    res = client.post("/api/auth/login", json={"username": "user", "password": "password"})
    assert res.status_code == 200
    assert res.json() == {"ok": True}
    assert "session" in res.cookies


def test_login_invalid_credentials(client):
    res = client.post("/api/auth/login", json={"username": "user", "password": "wrong"})
    assert res.status_code == 401


def test_me_authenticated(auth_client):
    res = auth_client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json() == {"username": "user"}


def test_me_unauthenticated(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


def test_logout(auth_client):
    res = auth_client.post("/api/auth/logout")
    assert res.status_code == 200
    assert auth_client.get("/api/auth/me").status_code == 401
