from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import init_db
from app.routes import groups, tasks


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Task Graph", lifespan=lifespan)
app.include_router(tasks.router, prefix="/api")
app.include_router(groups.router, prefix="/api")
