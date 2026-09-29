"""SQLite via SQLAlchemy. The database lives in memory and is rebuilt from seed data on every
startup (BACKEND_CONTRACT.md section 3), so demo changes last until the next restart."""

from sqlalchemy import JSON, Boolean, Float, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool

# One shared in-memory connection, usable from FastAPI's worker threads.
engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


# Timestamps are stored as ISO 8601 UTC strings ("2026-09-29T17:05:00Z"), which sort correctly as text.


class Brand(Base):
    __tablename__ = "brands"
    brand_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    # Seed-only. Never returned by any endpoint and never read by ranking code (contract section 8).
    is_client: Mapped[bool] = mapped_column(Boolean, default=False)
    billing_tier: Mapped[str | None] = mapped_column(String, nullable=True)


class Product(Base):
    __tablename__ = "products"
    product_id: Mapped[str] = mapped_column(String, primary_key=True)
    brand_id: Mapped[str] = mapped_column(String)
    name: Mapped[str] = mapped_column(String)
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String, default="USD")
    availability: Mapped[str] = mapped_column(String)
    specs: Mapped[dict] = mapped_column(JSON)
    return_policy_days: Mapped[int] = mapped_column(Integer)
    updated_at: Mapped[str] = mapped_column(String)
    price_history: Mapped[list] = mapped_column(JSON, default=list)  # previous prices, numbers only
    features: Mapped[list] = mapped_column(JSON, default=list)  # optional extra verified features


class Assistant(Base):
    __tablename__ = "assistants"
    assistant_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)


class Source(Base):
    __tablename__ = "sources"
    source_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    domain: Mapped[str] = mapped_column(String)
    type: Mapped[str] = mapped_column(String)


class Owner(Base):
    __tablename__ = "owners"
    owner_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)
    incident_types: Mapped[list] = mapped_column(JSON)


class Answer(Base):
    __tablename__ = "answers"
    answer_id: Mapped[str] = mapped_column(String, primary_key=True)
    query_text: Mapped[str] = mapped_column(String)
    assistant_id: Mapped[str] = mapped_column(String)
    answer_text: Mapped[str] = mapped_column(String)
    brand_mentioned: Mapped[bool] = mapped_column(Boolean)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    source_ids: Mapped[list] = mapped_column(JSON, default=list)
    captured_at: Mapped[str] = mapped_column(String)
    source: Mapped[str] = mapped_column(String, default="mock")


class Claim(Base):
    __tablename__ = "claims"
    claim_id: Mapped[str] = mapped_column(String, primary_key=True)
    answer_id: Mapped[str] = mapped_column(String)
    product_id: Mapped[str | None] = mapped_column(String, nullable=True)
    text: Mapped[str] = mapped_column(String)
    claim_type: Mapped[str] = mapped_column(String)
    extracted_value: Mapped[str | None] = mapped_column(String, nullable=True)
    verified_value: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String)
    rule_id: Mapped[str | None] = mapped_column(String, nullable=True)
    fact_id: Mapped[str | None] = mapped_column(String, nullable=True)
    reason: Mapped[str] = mapped_column(String)
    checked_at: Mapped[str] = mapped_column(String)


class Incident(Base):
    __tablename__ = "incidents"
    incident_id: Mapped[str] = mapped_column(String, primary_key=True)
    claim_id: Mapped[str] = mapped_column(String)
    answer_id: Mapped[str] = mapped_column(String)
    product_id: Mapped[str | None] = mapped_column(String, nullable=True)
    rule_id: Mapped[str] = mapped_column(String)
    severity: Mapped[str] = mapped_column(String)
    handling: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    summary: Mapped[str] = mapped_column(String)
    ai_said: Mapped[str | None] = mapped_column(String, nullable=True)
    verified_fact: Mapped[str | None] = mapped_column(String, nullable=True)
    proposed_fix: Mapped[str | None] = mapped_column(String, nullable=True)
    owner_id: Mapped[str] = mapped_column(String)
    owner_name: Mapped[str] = mapped_column(String)
    false_alarm: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[str] = mapped_column(String)
    resolved_at: Mapped[str | None] = mapped_column(String, nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(String, nullable=True)


class AuditEntry(Base):
    """Append-only. There is no code path that edits or deletes a row."""

    __tablename__ = "audit"
    audit_id: Mapped[str] = mapped_column(String, primary_key=True)
    timestamp: Mapped[str] = mapped_column(String)
    actor: Mapped[str] = mapped_column(String)
    actor_type: Mapped[str] = mapped_column(String)
    action: Mapped[str] = mapped_column(String)
    target_id: Mapped[str] = mapped_column(String)
    details: Mapped[str] = mapped_column(String)


class DailyMetric(Base):
    __tablename__ = "daily_metrics"
    date: Mapped[str] = mapped_column(String, primary_key=True)  # "2026-09-29"
    accuracy_rate: Mapped[float] = mapped_column(Float)
    hallucination_rate: Mapped[float] = mapped_column(Float)
    claims_checked: Mapped[int] = mapped_column(Integer)
    incidents_opened: Mapped[int] = mapped_column(Integer)
    visibility_rate: Mapped[float] = mapped_column(Float)


def get_db():
    """FastAPI dependency: one database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
