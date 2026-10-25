import os
from collections.abc import Iterator

from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

DATABASE_URL = os.environ.get("TASKGRAPH_DB", "sqlite:///taskgraph.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(Engine, "connect")
def _enable_sqlite_fks(dbapi_connection, _record) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def init_db(bind: Engine = engine) -> None:
    from app import models  # noqa: F401  (register tables)

    SQLModel.metadata.create_all(bind)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
