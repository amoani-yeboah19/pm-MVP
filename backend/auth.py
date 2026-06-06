import os
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from fastapi import Cookie, HTTPException

CREDENTIALS = {"user": "password"}
COOKIE_NAME = "session"
_SECRET = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
_signer = URLSafeTimedSerializer(_SECRET, salt="session")


def create_session(username: str) -> str:
    return _signer.dumps(username)


def verify_session(token: str) -> str | None:
    try:
        return _signer.loads(token, max_age=86400 * 7)
    except (BadSignature, SignatureExpired):
        return None


def require_auth(session: str | None = Cookie(default=None)) -> str:
    username = verify_session(session) if session else None
    if not username:
        raise HTTPException(status_code=401)
    return username
