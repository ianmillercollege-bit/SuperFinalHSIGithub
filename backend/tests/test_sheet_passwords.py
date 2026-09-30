"""BACKEND_CONTRACT.md v1.7 section 7c Login, DECISIONS.md #41: each sheet company's own password is accepted
alongside cirqo-demo, and only hashes of those passwords are committed.

The plaintext passwords are not in the repository, so the test that logs in all 150 sheet pairs reads them from
a local copy of the workbook: set SHEET_PASSWORDS_XLSX to its path (it is skipped when that file is not there).
Everything else runs everywhere, including CI.
"""

import hashlib
import json
import os
import re
import subprocess
from pathlib import Path

import openpyxl
import pytest
from sqlalchemy import select

from db import LoginAlias, SessionLocal, User
from seed.catalog import RENAMES, rename_email
from seed.hash_sheet_passwords import sheet_logins
from seed_loader import rebuild_database
from services.passwords import hash_password

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
DATA = BACKEND / "seed" / "data"
HASHES = BACKEND / "seed" / "source" / "sheet_password_hashes.json"
LOCAL_SHEET = os.environ.get("SHEET_PASSWORDS_XLSX",
                             str(Path.home() / "Downloads" / "Greek_God_Tech_Companies (filled).xlsx"))
DEMO = "cirqo-demo"


@pytest.fixture
def seeded(client, monkeypatch):
    monkeypatch.setenv("SEED_DIR", str(DATA))
    rebuild_database()
    return client


def accounts() -> list[dict]:
    return json.loads(HASHES.read_text(encoding="utf-8"))["accounts"]


def login(client, username, password):
    return client.post("/api/v1/auth/login", json={"username": username, "password": password})


def test_only_hashes_are_committed():
    rows = accounts()
    assert len(rows) == 150 and len({a["loginEmail"] for a in rows}) == 150
    for a in rows:
        assert set(a) == {"companyId", "company", "loginEmail", "passwordHash", "fingerprint"}
        assert re.fullmatch(r"pbkdf2_sha256\$120000\$[0-9a-f]{32}\$[0-9a-f]{64}", a["passwordHash"])
        assert re.fullmatch(r"[0-9a-f]{64}", a["fingerprint"])
    # The committed sheet still has its Temporary Password column empty.
    ws = openpyxl.load_workbook(BACKEND / "seed" / "source" / "greek_god_tech_companies.xlsx",
                                read_only=True, data_only=True)["Login Credentials"]
    rows_ = list(ws.iter_rows(values_only=True))
    header = next(r for r in rows_ if r and "Login Email" in r)
    col = next(j for j, h in enumerate(header) if h and str(h).startswith("Temporary Password"))
    assert not any(r[col] for r in rows_ if r and str(r[0] or "").startswith("CO-"))


def repo_texts():
    """Every tracked or new file in the repository, as text (xlsx cells for workbooks)."""
    listed = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=REPO,
                            capture_output=True, text=True, check=True).stdout.splitlines()
    for rel in listed:
        path = REPO / rel
        if not path.is_file():
            continue
        if path.suffix == ".xlsx":
            wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
            yield rel, "\n".join(str(v) for ws in wb.worksheets for row in ws.iter_rows(values_only=True)
                                 for v in row if v is not None)
        else:
            yield rel, path.read_bytes().decode("utf-8", errors="ignore")


def test_no_sheet_password_appears_anywhere_in_the_repo():
    """Condition 2: every 16-character run of password characters in every file is fingerprinted and compared
    with the committed fingerprints. No plaintext is needed, so this runs in CI."""
    fingerprints = {a["fingerprint"] for a in accounts()}
    runs = re.compile(r"[A-Za-z0-9!#$%&*?@^]{16,}")
    scanned = 0
    for rel, text in repo_texts():
        for m in runs.finditer(text):
            s = m.group()
            for i in range(len(s) - 15):
                assert hashlib.sha256(s[i:i + 16].encode()).hexdigest() not in fingerprints, \
                    f"a sheet password appears in {rel}"
        scanned += 1
    assert scanned > 100


def test_seeded_admins_carry_their_hash_and_aliases(seeded):
    by_email = {a["loginEmail"]: a["passwordHash"] for a in accounts()}
    with SessionLocal() as db:
        users = {u.username: u for u in db.scalars(select(User)).all()}
        aliases = {a.alias: a.user_id for a in db.scalars(select(LoginAlias)).all()}
    for email, stored in by_email.items():
        user = users[rename_email(email)]
        assert user.sheet_password_hash == stored and user.role == "Brand Data Owner"
    renamed = {e: rename_email(e) for e in by_email if rename_email(e) != e}
    assert len(renamed) == len(RENAMES) == 9
    assert {a: users[new].user_id for a, new in renamed.items()} == aliases
    # Nobody else has a sheet password: the originals, staff and partners use cirqo-demo only.
    assert sum(u.sheet_password_hash is not None for u in users.values()) == 150


def test_cirqo_demo_still_works_for_every_account(seeded):
    """Condition 1: no judge can be locked out."""
    with SessionLocal() as db:
        usernames = [u.username for u in db.scalars(select(User)).all()]
        aliases = [a.alias for a in db.scalars(select(LoginAlias)).all()]
    for username in usernames + aliases:
        assert login(seeded, username, DEMO).status_code == 200, username


def test_own_password_path(seeded):
    """The mechanism, with a stand-in password (runs in CI): own password and cirqo-demo both work, a wrong
    password and another company's password do not, and the renamed companies' old emails work too."""
    stand_in = "Tq7#pL2!vX9@mR4&"
    with SessionLocal() as db:
        morpheus = db.scalars(select(User).where(User.username == "admin@morpheusaudio.example")).one()
        nikaia = db.scalars(select(User).where(User.username == "admin@nikaiahardware.example")).one()
        morpheus.sheet_password_hash = nikaia.sheet_password_hash = hash_password(stand_in)
        db.commit()
    for username in ("admin@morpheusaudio.example", "ADMIN@MorpheusAudio.example ", "admin@nikehardware.example",
                     "admin@nikaiahardware.example"):
        res = login(seeded, username, stand_in)
        assert res.status_code == 200, username
    assert login(seeded, "admin@nikehardware.example", stand_in).json()["brand"]["brandName"] == "Nikaia"
    assert login(seeded, "admin@nikehardware.example", stand_in).json()["user"]["username"] == \
        "admin@nikaiahardware.example"
    for username, password in (("admin@morpheusaudio.example", "wrong"), ("admin@carpoaudio.example", stand_in),
                               ("maria.lopez@kestrel.example", stand_in), ("admin@nobody.example", stand_in)):
        res = login(seeded, username, password)
        assert res.status_code == 401 and res.json() == {
            "error": {"code": "UNAUTHORIZED", "message": "Wrong username or password."}}, username


@pytest.mark.skipif(not Path(LOCAL_SHEET).is_file(), reason="needs the local workbook with passwords "
                                                             "(set SHEET_PASSWORDS_XLSX)")
def test_all_150_sheet_pairs_log_in(seeded):
    """Condition 3: every sheet pair (username = Login Email) signs in to its own company, and the 9 renamed
    companies also accept their original sheet email. Also checks the plaintext directly against the repo."""
    rows = sheet_logins(LOCAL_SHEET)
    assert len(rows) == 150
    brands = {b["brandId"]: b["brandName"] for b in seeded.get(
        "/api/v1/brands", headers={"Authorization": "Bearer " + login(
            seeded, "grace.kim@cirqo.example", DEMO).json()["token"]}).json()["brands"]}
    renamed = 0
    for r in rows:
        email, password = r["Login Email"].strip().lower(), str(r["Temporary Password"])
        site_email = rename_email(email)
        for username in {email, site_email}:
            res = login(seeded, username, password)
            assert res.status_code == 200, r["Company"]
            body = res.json()
            assert body["user"]["username"] == site_email and body["brand"]["brandName"] in brands.values()
        renamed += site_email != email
    assert renamed == 9
    # Another company's password is refused.
    assert login(seeded, rows[0]["Login Email"], str(rows[1]["Temporary Password"])).status_code == 401
    # The plaintext is nowhere in the repository.
    passwords = [str(r["Temporary Password"]) for r in rows]
    for rel, text in repo_texts():
        assert not any(p in text for p in passwords), rel
