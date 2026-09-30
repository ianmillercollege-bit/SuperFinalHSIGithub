"""Login and demo accounts (BACKEND_CONTRACT.md v1.3 section 7b and v1.4 section 7c).

Every demo password is cirqo-demo (DECISIONS.md #33/#34), stored hashed. Tokens live in the database
and die on restart. Never returns isClient or billingTier.
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import select

import constants as C
from db import ApiKey, Brand, Token, User, get_db
from schemas import DemoAccountsOut, LoginIn, LoginOut, MeOut, OkOut
from services.passwords import verify_password
from services.session import new_token, required_user, token_and_user

router = APIRouter(prefix="/auth", tags=["Brand accounts"])

WRONG = "Wrong username or password."  # the same message for both, so usernames cannot be probed


def me_body(db, user: User, token: Token) -> dict:
    brand = db.get(Brand, user.brand_id) if user.brand_id else None
    return {"expiresAt": token.expires_at,
            "user": {"userId": user.user_id, "name": user.name, "role": user.role, "username": user.username},
            "brand": {"brandId": brand.brand_id, "brandName": brand.name} if brand else None}


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, db=Depends(get_db)):
    user = db.scalars(select(User).where(User.username == body.username.strip().lower())).first()
    if user is None or not verify_password(body.password, user.password_hash):
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
    found = token_and_user(db, authorization) if authorization else None
    if found:
        db.delete(found[0])
        db.commit()
    return {"ok": True}


@router.get("/demo-accounts", response_model=DemoAccountsOut)
def demo_accounts(db=Depends(get_db)):
    """The original brands' accounts plus the first spreadsheet companies (v1.4), each with a username."""
    names = {b.brand_id: b.name for b in db.scalars(select(Brand)).all()}
    keys = db.scalars(select(ApiKey).order_by(ApiKey.api_key)).all()
    users = db.scalars(select(User).order_by(User.user_id)).all()
    listed = [dict(a) for a in C.DEMO_ACCOUNTS if a["brandId"] in names]
    listed_keys = {a["apiKey"] for a in listed}
    originals = {a["brandId"] for a in C.DEMO_ACCOUNTS}
    for key in sorted((k for k in keys if k.brand_id not in originals and k.api_key.startswith("fd_demo_")),
                      key=lambda k: k.brand_id):
        admin = next((u for u in users if u.brand_id == key.brand_id), None)
        if admin and key.api_key not in listed_keys:
            listed.append({"brandId": key.brand_id, "role": key.role, "apiKey": key.api_key, "username": admin.username})
    return {"accounts": [{"brandId": a["brandId"], "brandName": names[a["brandId"]], "role": a["role"],
                          "apiKey": a["apiKey"], "username": a["username"]} for a in listed],
            "passwordNote": f"Every demo password is {C.DEMO_PASSWORD}."}


__all__ = ["router", "required_user"]
