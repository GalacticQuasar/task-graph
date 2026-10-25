from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlmodel import Session, SQLModel

from app import auth, graph
from app.db import get_session
from app.models import Capture, Task, TaskRead

router = APIRouter(tags=["session"])


class Login(SQLModel):
    token: str


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/me")
def me(request: Request):
    """200 if this request is authenticated; the web app uses it to decide whether to show login."""
    auth.require_auth(request)
    return {"authenticated": True, "auth_enabled": auth.configured_token() is not None}


@router.post("/login", status_code=status.HTTP_204_NO_CONTENT)
def login(body: Login, request: Request, response: Response):
    token = auth.configured_token()
    if token is None:
        return
    if not auth.token_matches(body.token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "wrong token")
    response.set_cookie(
        auth.COOKIE_NAME,
        auth.session_value(token),
        max_age=auth.COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",  # also blocks cross-site POST/PATCH/DELETE carrying the cookie
        secure=request.url.scheme == "https",
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    response.delete_cookie(auth.COOKIE_NAME)


@router.post(
    "/capture",
    response_model=TaskRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(auth.require_auth)],
)
def capture(body: Capture, session: Session = Depends(get_session)):
    """Quick capture from a phone shortcut: title only, lands in the inbox."""
    title = body.title.strip()
    if not title:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "title is empty")
    task = Task(title=title, position=graph.next_position(session, None))
    session.add(task)
    session.commit()
    session.refresh(task)
    return TaskRead.from_task(task)
