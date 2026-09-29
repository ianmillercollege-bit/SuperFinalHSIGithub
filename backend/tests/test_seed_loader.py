"""The startup loader: rebuilds SQLite from the DECISIONS.md #17 JSON files."""

import json

import pytest
from sqlalchemy import func, select

from db import (Answer, Assistant, AuditEntry, Brand, Claim, DailyMetric, Incident, Owner, Product, SessionLocal,
                Source)
from seed_loader import rebuild_database, seed_dir
from timeutil import today

FILES = ["brands", "products", "assistants", "sources", "owners", "answers", "claims", "incidents", "audit",
         "daily_metrics"]
TABLES = {"brands": Brand, "products": Product, "assistants": Assistant, "sources": Source, "owners": Owner,
          "answers": Answer, "claims": Claim, "incidents": Incident, "audit": AuditEntry,
          "daily_metrics": DailyMetric}


def rows_in(name: str) -> int:
    data = json.loads((seed_dir() / f"{name}.json").read_text(encoding="utf-8"))
    return len(data if isinstance(data, list) else next(v for v in data.values() if isinstance(v, list)))


def test_fixture_has_every_decision_17_file():
    assert sorted(p.stem for p in seed_dir().glob("*.json")) == sorted(FILES)


def test_every_file_is_loaded_in_full():
    with SessionLocal() as db:
        for name, table in TABLES.items():
            assert db.scalar(select(func.count()).select_from(table)) == rows_in(name), name


def test_seed_only_fields_are_stored():
    with SessionLocal() as db:
        assert [b.name for b in db.scalars(select(Brand).where(Brand.is_client.is_(True)))] == ["Kestrel"]
        assert db.get(Product, "prod_002").price_history == [339.0]  # current price is not "previous"


def test_dates_shift_so_trend_ends_today():
    with SessionLocal() as db:
        assert db.scalar(select(func.max(DailyMetric.date))) == today().isoformat()


def test_rebuild_resets_demo_changes():
    with SessionLocal() as db:
        db.get(Product, "prod_001").price = 1.0
        db.commit()
    rebuild_database()
    with SessionLocal() as db:
        assert db.get(Product, "prod_001").price == 449.99


def test_missing_seed_folder_fails_clearly(monkeypatch, tmp_path):
    monkeypatch.setenv("SEED_DIR", str(tmp_path))
    with pytest.raises(FileNotFoundError, match="generate.py"):
        seed_dir()


def test_bare_lists_are_accepted(monkeypatch, tmp_path):
    # The generator may write [...] instead of {"products": [...]}; both must load.
    for name in FILES:
        data = json.loads((seed_dir() / f"{name}.json").read_text(encoding="utf-8"))
        rows = data if isinstance(data, list) else next(v for v in data.values() if isinstance(v, list))
        (tmp_path / f"{name}.json").write_text(json.dumps(rows), encoding="utf-8")
    monkeypatch.setenv("SEED_DIR", str(tmp_path))
    rebuild_database()
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Product)) == 12
