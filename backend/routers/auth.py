"""Login and demo accounts (BACKEND_CONTRACT.md v1.3 section 7b and v1.4 section 7c).

Every demo password is cirqo-demo (DECISIONS.md #33/#34), stored hashed. Tokens live in the database
and die on restart. Never returns isClient or billingTier.
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select

import constants as C
from db import ApiKey, Brand, CommunityOrg, LoginAlias, Token, User, get_db
from schemas import DemoAccountsOut, LoginIn, LoginOut, MeOut, OkOut
from services.passwords import verify_password
from services.session import new_token, required_user, token_and_user

router = APIRouter(prefix="/auth", tags=["Brand accounts"])

WRONG = "Wrong username or password."  # the same message for both, so usernames cannot be probed


def me_body(db, user: User, token: Token) -> dict:
    brand = db.get(Brand, user.brand_id) if user.brand_id else None
    org = db.get(CommunityOrg, user.org_id) if user.org_id else None  # v1.6: a Community Partner's organization
    return {"expiresAt": token.expires_at,
            "user": {"userId": user.user_id, "name": user.name, "role": user.role, "username": user.username},
            "brand": {"brandId": brand.brand_id, "brandName": brand.name} if brand else None,
            "org": {"orgId": org.org_id, "orgName": org.name} if org else None}


def find_user(db, username: str) -> User | None:
    """By username, or (v1.7) by an alias: a renamed company's original sheet email."""
    name = username.strip().lower()
    user = db.scalars(select(User).where(User.username == name)).first()
    if user is None:
        alias = db.get(LoginAlias, name)
        user = db.get(User, alias.user_id) if alias else None
    return user


def password_ok(user: User, password: str) -> bool:
    """cirqo-demo works for every account (decision #41, condition 1); a sheet company's admin may also use
    the company's own password from the sheet."""
    if verify_password(password, user.password_hash):
        return True
    return bool(user.sheet_password_hash) and verify_password(password, user.sheet_password_hash)


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, db=Depends(get_db)):
    user = find_user(db, body.username)
    if user is None or not password_ok(user, body.password):
        raise HTTPException(401, WRONG)
    token = new_token(db, user)
    return {"token": token.token, **me_body(db, user, token)}


@router.get("/me", response_model=MeOut)
def me(authorization: str | None = Header(None), db=Depends(get_db)):
    found = token_and_user(db, authorization)
    if found is None:
        raise HTTPException(401, "Sign in first: send Authorization: Bearer <token>.")
    token, user = found
    return me_body(db, user, token)


@router.post("/logout", response_model=OkOut)
def logout(authorization: str | None = Header(None), db=Depends(get_db)):
    try:
        found = token_and_user(db, authorization) if authorization else None
    except HTTPException:
        found = None  # a malformed or ended token: there is nothing to end, and logout still succeeds
    if found:
        db.delete(found[0])
        db.commit()
    return {"ok": True}


@router.get("/demo-accounts", response_model=DemoAccountsOut)
def demo_accounts(db=Depends(get_db)):
    """The original brands' accounts plus the first spreadsheet companies (v1.4), each with a username."""
    rows = db.scalars(select(Brand)).all()
    names = {b.brand_id: b.name for b in rows if b.opted_in}  # v1.5: login lists only opted-in companies
    keys = db.scalars(select(ApiKey).order_by(ApiKey.api_key)).all()
    users = db.scalars(select(User).order_by(User.user_id)).all()
    listed = [dict(a) for a in C.DEMO_ACCOUNTS if a["brandId"] in names]
    listed_keys = {a["apiKey"] for a in listed}
    originals = {a["brandId"] for a in C.DEMO_ACCOUNTS}
    for key in sorted((k for k in keys if k.brand_id not in originals and k.api_key.startswith("fd_demo_")),
                      key=lambda k: k.brand_id):
        admin = next((u for u in users if u.brand_id == key.brand_id), None)
        if admin and key.api_key not in listed_keys and key.brand_id in names:
            listed.append({"brandId": key.brand_id, "role": key.role, "apiKey": key.api_key, "username": admin.username})
    return {"accounts": [{"brandId": a["brandId"], "brandName": names[a["brandId"]], "role": a["role"],
                          "apiKey": a["apiKey"], "username": a["username"], "optedIn": True} for a in listed],
            "passwordNote": f"Every demo password is {C.DEMO_PASSWORD}."}


__all__ = ["router", "required_user"]
