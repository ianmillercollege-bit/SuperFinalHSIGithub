"""Who is calling (BACKEND_CONTRACT.md v1.4 section 7c, "Login" and "Token scoping").

A request may carry `Authorization: Bearer <token>`. Without it, v1.3 behaviour applies (?brandId=,
default Kestrel). With it, the token must be valid and unexpired (else 401), and the brand is the
token user's brand. CIRQO Staff users belong to no brand.
"""

import secrets
from datetime import timedelta

from fastapi import Depends, Header, HTTPException

from db import Token, User, get_db
from timeutil import now, now_iso, to_iso

TOKEN_HOURS = 12
STAFF = "CIRQO Staff"
VIEWER = "Viewer"


def new_token(db, user: User) -> Token:
    token = Token(token=f"tok_{secrets.token_hex(16)}", user_id=user.user_id,
                  expires_at=to_iso(now() + timedelta(hours=TOKEN_HOURS)))
    db.add(token)
    db.commit()
    return token


def bearer(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value.strip():
        raise HTTPException(401, "Send the login token as: Authorization: Bearer <token>.")
    return value.strip()


def token_and_user(db, authorization: str | None) -> tuple[Token, User] | None:
    value = bearer(authorization)
    if value is None:
        return None
    token = db.get(Token, value)
    if token is None or token.expires_at <= now_iso():
        raise HTTPException(401, "The login token is invalid or has expired. Please sign in again.")
    user = db.get(User, token.user_id)
    if user is None:
        raise HTTPException(401, "The login token is invalid or has expired. Please sign in again.")
    return token, user


def optional_user(authorization: str | None = Header(None), db=Depends(get_db)) -> User | None:
    """The signed-in user, or None when no token was sent. 401 for a bad or expired token."""
    found = token_and_user(db, authorization)
    return found[1] if found else None


def required_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(401, "Sign in first: send Authorization: Bearer <token>.")
    return user
