"""BACKEND_CONTRACT.md v1.4 section 7c: login, tokens, roles (test_auth and test_brand_profile)."""

import json
from pathlib import Path

import pytest

from db import SessionLocal, Token
from seed_loader import rebuild_database

DATA = Path(__file__).resolve().parents[1] / "seed" / "data"
PASSWORD = "cirqo-demo"


@pytest.fixture
def seeded(client, monkeypatch):
    monkeypatch.setenv("SEED_DIR", str(DATA))
    rebuild_database()
    return client


def login(client, username, password=PASSWORD):
    return client.post("/api/v1/auth/login", json={"username": username, "password": password})


def token_for(client, username) -> dict:
    res = login(client, username)
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


def test_auth(seeded):
    # Login ok.
    res = login(seeded, "maria.lopez@kestrel.example")
    assert res.status_code == 200
    body = res.json()
    assert body["token"].startswith("tok_") and body["expiresAt"].endswith("Z")
    assert body["user"] == {"userId": "usr_001", "name": "Maria Lopez", "role": "Brand Data Owner",
                            "username": "maria.lopez@kestrel.example"}
    assert body["brand"] == {"brandId": "brand_001", "brandName": "Kestrel"}
    headers = {"Authorization": f"Bearer {body['token']}"}

    # Wrong password and wrong username: 401 with the same neutral message.
    for username, password in (("maria.lopez@kestrel.example", "nope"), ("nobody@kestrel.example", PASSWORD)):
        bad = login(seeded, username, password)
        assert bad.status_code == 401
        assert bad.json() == {"error": {"code": "UNAUTHORIZED", "message": "Wrong username or password."}}

    # me: same shape without the token.
    me = seeded.get("/api/v1/auth/me", headers=headers).json()
    assert me == {k: v for k, v in body.items() if k != "token"}

    # A token scopes a dashboard call: Arcton's token sees Arcton even when brandId says Kestrel.
    arcton = token_for(seeded, "priya.shah@arcton.example")
    scoped = seeded.get("/api/v1/visibility/summary", params={"brandId": "brand_001"}, headers=arcton).json()
    assert scoped["brandName"] == "Arcton"
    incidents = seeded.get("/api/v1/incidents", params={"limit": 100}, headers=arcton).json()["incidents"]
    assert incidents and {i["ownerName"] for i in incidents} <= {"Priya Shah", "Tom Becker"}

    # Viewer: reads fine, 403 on approve / reject / resolve.
    viewer = token_for(seeded, "sam.lee@kestrel.example")
    assert seeded.get("/api/v1/incidents", headers=viewer).status_code == 200
    for action, payload in (("approve", {}), ("reject", {"note": "x"}), ("resolve", {"note": "x"})):
        res = seeded.post(f"/api/v1/incidents/inc_44/{action}", json=payload, headers=viewer)
        assert res.status_code == 403 and res.json()["error"]["code"] == "FORBIDDEN", action

    # Staff: GET /brands 200 with all 153; a brand token gets 403.
    staff = token_for(seeded, "grace.kim@cirqo.example")
    everyone = seeded.get("/api/v1/brands", headers=staff)
    assert everyone.status_code == 200 and len(everyone.json()["brands"]) == 153
    assert seeded.get("/api/v1/brands", headers=headers).status_code == 403

    # Approve without approverName uses the token user (Grace Kim owns inc_44).
    approved = seeded.post("/api/v1/incidents/inc_44/approve", json={}, headers=staff)
    assert approved.status_code == 200 and approved.json()["resolvedBy"] == "Grace Kim"
    # The owner-match rule still applies to the token user.
    wrong = seeded.post("/api/v1/incidents/inc_46/approve", json={}, headers=staff)
    assert wrong.status_code == 403  # inc_46 belongs to Maria Lopez

    # Logout: the token stops working.
    assert seeded.post("/api/v1/auth/logout", headers=headers).json() == {"ok": True}
    assert seeded.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_tokens_are_checked(seeded):
    assert seeded.get("/api/v1/auth/me").status_code == 401
    for bad in ("Bearer tok_nope", "Basic abc", "Bearer "):
        res = seeded.get("/api/v1/incidents", headers={"Authorization": bad})
        assert res.status_code == 401 and res.json()["error"]["code"] == "UNAUTHORIZED", bad
    headers = token_for(seeded, "maria.lopez@kestrel.example")
    with SessionLocal() as db:  # expire it
        for t in db.query(Token).all():
            t.expires_at = "2000-01-01T00:00:00Z"
        db.commit()
    assert seeded.get("/api/v1/auth/me", headers=headers).status_code == 401
    assert seeded.get("/api/v1/incidents", headers=headers).status_code == 401


def test_no_token_keeps_v13_behaviour(seeded):
    assert seeded.get("/api/v1/visibility/summary").json()["brandName"] == "Kestrel"
    assert seeded.get("/api/v1/visibility/summary", params={"brandId": "brand_002"}).json()["brandName"] == "Arcton"
    ok = seeded.post("/api/v1/incidents/inc_44/approve", json={"approverName": "Grace Kim"})
    assert ok.status_code == 200
    missing = seeded.post("/api/v1/incidents/inc_45/approve", json={})
    assert missing.status_code == 422 and missing.json()["error"]["code"] == "VALIDATION_ERROR"


def test_every_seeded_user_can_log_in(seeded):
    with SessionLocal() as db:
        from sqlalchemy import select

        from db import User
        usernames = [u.username for u in db.scalars(select(User)).all()]
    for username in usernames[:12] + ["admin@morpheusaudio.example", usernames[0].upper()]:
        assert login(seeded, username).status_code == 200, username  # usernames are case-insensitive
    staff = login(seeded, "dev.patel@cirqo.example").json()
    assert staff["brand"] is None and staff["user"]["role"] == "CIRQO Staff"


def test_demo_accounts_have_usernames(seeded):
    body = seeded.get("/api/v1/auth/demo-accounts").json()
    assert body["passwordNote"] == "Every demo password is cirqo-demo."
    assert len(body["accounts"]) == 9
    for account in body["accounts"]:
        assert login(seeded, account["username"]).status_code == 200, account
        client_key = {"X-API-Key": account["apiKey"]}
        path = "/api/v1/client/visibility"
        assert seeded.get(path, headers=client_key).json()["brandId"] == account["brandId"]
    assert "isClient" not in json.dumps(body) and "billingTier" not in json.dumps(body)


def test_brand_profile(seeded):
    public = seeded.get("/api/v1/brands/brand_001")
    assert public.status_code == 200
    body = public.json()
    assert {k: body[k] for k in ("brandId", "brandName", "tagline", "hqCity", "founded", "employees", "website")} == {
        "brandId": "brand_001", "brandName": "Kestrel", "tagline": "Thin laptops for students and travelers",
        "hqCity": "Austin, TX", "founded": 2016, "employees": 140, "website": "https://www.kestrel.example"}
    assert body["ceo"] == {"name": "Priya Natarajan"} and body["categories"] == ["laptops"]
    assert body["productCount"] == 6 and {"userId": "usr_001", "name": "Maria Lopez", "role": "Brand Data Owner"} in body["admins"]
    assert all(a["role"] != "Viewer" for a in body["admins"])
    assert "plan" not in body  # public: no plan

    own = seeded.get("/api/v1/brands/brand_001", headers=token_for(seeded, "maria.lopez@kestrel.example")).json()
    assert own["plan"] == "growth"
    staff = seeded.get("/api/v1/brands/brand_002", headers=token_for(seeded, "dev.patel@cirqo.example")).json()
    assert staff["plan"] == "enterprise"
    other = seeded.get("/api/v1/brands/brand_002", headers=token_for(seeded, "maria.lopez@kestrel.example"))
    assert other.status_code == 403 and other.json()["error"]["code"] == "FORBIDDEN"
    assert seeded.get("/api/v1/brands/brand_999").status_code == 404

    sheet = seeded.get("/api/v1/brands/brand_004").json()
    assert sheet["brandName"] == "Morpheus" and sheet["website"] == "https://www.morpheusaudio.example"
    assert sheet["categories"] == ["headphones"] and sheet["productCount"] == 10 and sheet["admins"]
    for text in (public.text, json.dumps(own), json.dumps(sheet)):
        assert "isClient" not in text and "billingTier" not in text


def test_staff_overview(seeded):
    staff = token_for(seeded, "grace.kim@cirqo.example")
    brands = seeded.get("/api/v1/brands", headers=staff).json()["brands"]
    assert [b["brandId"] for b in brands][:4] == ["brand_001", "brand_002", "brand_003", "brand_004"]
    kestrel = brands[0]
    trust = seeded.get("/api/v1/metrics/trust").json()["current"]
    assert (kestrel["accuracyRate"], kestrel["visibilityRate"]) == (trust["accuracyRate"], trust["visibilityRate"])
    assert kestrel["openIncidents"] == len([i for i in seeded.get("/api/v1/incidents", params={"limit": 100}).json()["incidents"]
                                            if i["status"] in ("pending_approval", "escalated")])
    assert sum(b["escalatedIncidents"] > 0 for b in brands) >= 5
    assert seeded.get("/api/v1/brands").status_code == 401  # no token
