import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import auth
from app.main import mount_frontend

TOKEN = "s3cret-token"


@pytest.fixture
def secured(monkeypatch, client):
    monkeypatch.setenv("TASKGRAPH_TOKEN", TOKEN)
    return client


def bearer(token=TOKEN):
    return {"Authorization": f"Bearer {token}"}


def test_auth_disabled_without_token(client):
    assert client.get("/api/tasks").status_code == 200
    assert client.get("/api/me").json()["auth_enabled"] is False


def test_requests_rejected_without_credentials(secured):
    assert secured.get("/api/tasks").status_code == 401
    assert secured.get("/api/groups").status_code == 401
    assert secured.post("/api/capture", json={"title": "x"}).status_code == 401
    assert secured.get("/api/me").status_code == 401


def test_health_is_public(secured):
    assert secured.get("/api/health").json() == {"ok": True}


def test_bearer_token(secured):
    assert secured.get("/api/tasks", headers=bearer()).status_code == 200
    assert secured.get("/api/tasks", headers=bearer("wrong")).status_code == 401


def test_login_sets_cookie_that_authenticates(secured):
    assert secured.post("/api/login", json={"token": "wrong"}).status_code == 401
    r = secured.post("/api/login", json={"token": TOKEN})
    assert r.status_code == 204
    cookie = r.cookies[auth.COOKIE_NAME]
    assert cookie != TOKEN  # the cookie is derived from the token, not the token itself
    assert "httponly" in r.headers["set-cookie"].lower()
    assert secured.get("/api/tasks").status_code == 200  # TestClient keeps the cookie

    secured.post("/api/logout")
    assert secured.get("/api/tasks").status_code == 401


def test_cookie_invalidated_when_token_rotates(secured, monkeypatch):
    secured.post("/api/login", json={"token": TOKEN})
    monkeypatch.setenv("TASKGRAPH_TOKEN", "rotated")
    assert secured.get("/api/tasks").status_code == 401


def test_capture_lands_in_inbox(secured):
    r = secured.post("/api/capture", json={"title": "  buy milk  "}, headers=bearer())
    assert r.status_code == 201
    assert r.json()["title"] == "buy milk"
    inbox = secured.get("/api/tasks?view=inbox", headers=bearer()).json()
    assert [t["title"] for t in inbox] == ["buy milk"]


def test_capture_rejects_blank_title(secured):
    assert secured.post("/api/capture", json={"title": "  "}, headers=bearer()).status_code == 422


def test_require_token_flag(monkeypatch):
    monkeypatch.delenv("TASKGRAPH_TOKEN", raising=False)
    monkeypatch.setenv("TASKGRAPH_REQUIRE_TOKEN", "1")
    with pytest.raises(RuntimeError):
        auth.check_config()


def test_unknown_api_path_is_404_not_index(client):
    assert client.get("/api/nope").status_code == 404


@pytest.fixture
def static_client(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>app</html>")
    (tmp_path / "assets" / "app-abc123.js").write_text("console.log(1)")
    (tmp_path / "manifest.webmanifest").write_text("{}")
    (tmp_path.parent / "secret.txt").write_text("nope")
    app = FastAPI()
    mount_frontend(app, tmp_path)
    return TestClient(app)


def test_static_files_and_spa_fallback(static_client):
    r = static_client.get("/assets/app-abc123.js")
    assert r.text == "console.log(1)"
    assert "immutable" in r.headers["cache-control"]
    assert static_client.get("/manifest.webmanifest").text == "{}"
    for path in ["/", "/share", "/share?title=x"]:
        r = static_client.get(path)
        assert r.text == "<html>app</html>"
        assert r.headers["cache-control"] == "no-cache"


def test_static_path_traversal_blocked(static_client):
    for path in ["/../secret.txt", "/%2e%2e/secret.txt", "/assets/..%2f..%2fsecret.txt"]:
        assert "nope" not in static_client.get(path).text
