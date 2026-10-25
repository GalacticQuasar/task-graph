import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse

from app.auth import check_config, require_auth
from app.db import init_db
from app.routes import groups, session, tasks


@asynccontextmanager
async def lifespan(_app: FastAPI):
    check_config()
    init_db()
    yield


app = FastAPI(title="Task Graph", lifespan=lifespan)
app.include_router(session.router, prefix="/api")
app.include_router(tasks.router, prefix="/api", dependencies=[Depends(require_auth)])
app.include_router(groups.router, prefix="/api", dependencies=[Depends(require_auth)])


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def api_not_found(path: str):
    # Keeps unknown API paths from falling through to the frontend's index.html below.
    raise HTTPException(404, "not found")


def mount_frontend(app: FastAPI, static_dir: str | Path) -> None:
    """Serve the built frontend (frontend/dist) so one process serves both UI and API.

    Unknown paths get index.html so client-side routes like /share work.
    """
    static_root = Path(static_dir).resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        file = (static_root / path).resolve()
        if path and file.is_file() and file.is_relative_to(static_root):
            # Vite fingerprints everything under assets/, so it can be cached forever.
            immutable = file.parent == static_root / "assets"
            headers = {"Cache-Control": "public, max-age=31536000, immutable"} if immutable else None
            return FileResponse(file, headers=headers)
        return FileResponse(static_root / "index.html", headers={"Cache-Control": "no-cache"})


if static_dir := os.environ.get("TASKGRAPH_STATIC"):
    mount_frontend(app, static_dir)
