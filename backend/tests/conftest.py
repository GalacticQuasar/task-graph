import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine

from app.db import get_session, init_db
from app.main import app


@pytest.fixture(autouse=True)
def no_auth_env(monkeypatch):
    # Auth is off unless a test opts in, regardless of the developer's shell environment.
    monkeypatch.delenv("TASKGRAPH_TOKEN", raising=False)
    monkeypatch.delenv("TASKGRAPH_REQUIRE_TOKEN", raising=False)


@pytest.fixture
def engine():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    init_db(engine)
    return engine


@pytest.fixture
def session(engine):
    with Session(engine) as session:
        yield session


@pytest.fixture
def client(engine):
    def override():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_session] = override
    # Not used as a context manager, so the app lifespan (which touches the real DB) never runs.
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def chain(client):
    """work out -> shave -> shower -> trim nails; returns ids in order."""
    ids = []
    parent = None
    for title in ["work out", "shave", "shower", "trim nails"]:
        r = client.post("/api/tasks", json={"title": title, "parent_id": parent})
        assert r.status_code == 201
        parent = r.json()["id"]
        ids.append(parent)
    return ids
