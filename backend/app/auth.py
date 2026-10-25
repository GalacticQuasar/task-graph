"""Single-user auth: one shared secret from TASKGRAPH_TOKEN.

Clients prove they know it either with `Authorization: Bearer <token>` (phone shortcuts,
scripts) or with the session cookie set by POST /api/login (the web app). The cookie holds
an HMAC of the token, not the token itself.

With TASKGRAPH_TOKEN unset, auth is disabled for local development, unless
TASKGRAPH_REQUIRE_TOKEN=1 (the Docker image sets this), in which case startup fails.
"""

import hashlib
import hmac
import logging
import os
import secrets

from fastapi import HTTPException, Request, status

COOKIE_NAME = "taskgraph_session"
COOKIE_MAX_AGE = 60 * 60 * 24 * 365  # a year: this is a personal app on your own devices

log = logging.getLogger(__name__)


def configured_token() -> str | None:
    return os.environ.get("TASKGRAPH_TOKEN") or None


def check_config() -> None:
    if configured_token():
        return
    if os.environ.get("TASKGRAPH_REQUIRE_TOKEN") == "1":
        raise RuntimeError("TASKGRAPH_TOKEN must be set (TASKGRAPH_REQUIRE_TOKEN=1)")
    log.warning("TASKGRAPH_TOKEN is not set: authentication is DISABLED")


def session_value(token: str) -> str:
    return hmac.new(token.encode(), b"taskgraph-session", hashlib.sha256).hexdigest()


def token_matches(candidate: str) -> bool:
    token = configured_token()
    return token is not None and secrets.compare_digest(candidate.encode(), token.encode())


def is_authenticated(request: Request) -> bool:
    token = configured_token()
    if token is None:
        return True
    scheme, _, credentials = request.headers.get("authorization", "").partition(" ")
    if scheme.lower() == "bearer" and token_matches(credentials):
        return True
    cookie = request.cookies.get(COOKIE_NAME, "")
    return secrets.compare_digest(cookie.encode(), session_value(token).encode())


def require_auth(request: Request) -> None:
    if not is_authenticated(request):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
