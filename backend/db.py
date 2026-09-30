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
    billing_tier: Mapped[str | None] = mapped_column(String, nullable=True)  # public name: "plan" (v1.4)
    # v1.5 section 7d (public as optedIn): opted-in brands have verified facts, admins and a dashboard.
    # Never read by ranking code (test_ranking_neutral flips it).
    opted_in: Mapped[bool] = mapped_column(Boolean, default=True)
    # v1.4 company profile: tagline, categories, hqCity, founded, employees, ceo, website, otherNames, ...
    profile: Mapped[dict] = mapped_column(JSON, default=dict)


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
    updated_at: Mapped[str] = mapped_column(String)  # when the brand last changed the record
    # Verified Data Layer (contract v1.2): where the facts come from and when CIRQO last verified them.
    fact_source: Mapped[str] = mapped_column(String)
    fact_source_url: Mapped[str] = mapped_column(String)
    verified_at: Mapped[str] = mapped_column(String)
    price_history: Mapped[list] = mapped_column(JSON, default=list)  # previous prices, numbers only
    features: Mapped[list] = mapped_column(JSON, default=list)  # optional extra verified features
    # v1.4.1: categories follow the source spreadsheet.
    category: Mapped[str] = mapped_column(String, default="laptops")  # laptops | headphones | phones_tablets | computer_hardware
    subcategory: Mapped[str] = mapped_column(String, default="Laptop")  # the sheet's Product Category
    # v1.6 Community program: new | refurbished | surplus, and the brand's pledge (null when not pledged):
    # {"unitsPledged", "unitsPlaced", "conditionNotes", "warrantyMonths"}.
    condition: Mapped[str] = mapped_column(String, default="new")
    community_pledge: Mapped[dict | None] = mapped_column(JSON(none_as_null=True), nullable=True)


class ComparisonFact(Base):
    """A verified comparison between two products (the sheet's "Verified Comparisons" column, v1.4.1).
    "a is <attribute>-better than b": price = cheaper, weight = lighter, battery = longer battery."""

    __tablename__ = "comparison_facts"
    fact_id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(String, index=True)
    other_product_id: Mapped[str] = mapped_column(String)
    attribute: Mapped[str] = mapped_column(String)  # price | weight | battery
    text: Mapped[str] = mapped_column(String)


class User(Base):
    """Demo users (v1.4 login). Passwords are stored hashed. cirqo-demo works for everyone; v1.7: a sheet
    company's admin also accepts the company's own password from the sheet (sheet_password_hash)."""

    __tablename__ = "users"
    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)  # Brand Data Owner | Trust and Safety Lead | Viewer | CIRQO Staff
    title: Mapped[str | None] = mapped_column(String, nullable=True)  # e.g. staff job title
    brand_id: Mapped[str | None] = mapped_column(String, nullable=True)  # None for CIRQO Staff
    org_id: Mapped[str | None] = mapped_column(String, nullable=True)  # v1.6: Community Partner organization
    password_hash: Mapped[str] = mapped_column(String)
    sheet_password_hash: Mapped[str | None] = mapped_column(String, nullable=True)  # v1.7, decision #41


class CommunityOrg(Base):
    """A Community Partner organization (v1.6): fictional schools, nonprofits, veterans groups."""

    __tablename__ = "community_orgs"
    org_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(String)  # school_district | veterans_group | nonprofit


class CommunityRequest(Base):
    """A partner's request for pledged units (v1.6). No data about the people who receive them, ever."""

    __tablename__ = "community_requests"
    request_id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(String, index=True)
    brand_id: Mapped[str] = mapped_column(String, index=True)
    org_id: Mapped[str] = mapped_column(String, index=True)
    units: Mapped[int] = mapped_column(Integer)
    purpose: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)  # pending_approval | approved | rejected
    created_at: Mapped[str] = mapped_column(String)
    decided_at: Mapped[str | None] = mapped_column(String, nullable=True)
    decided_by: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str | None] = mapped_column(String, nullable=True)


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
    brand_id: Mapped[str] = mapped_column(String, default="brand_001")  # v1.3: owners belong to a brand


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
    # v1.7 (plan 5.2 KPI): how many hard constraints the shopper stated (maxPrice, each mustHave) and whether
    # every product CIRQO returned met all of them. Enforced by rule before display; measured here.
    constraints_stated: Mapped[int] = mapped_column(Integer, default=0)
    constraints_met: Mapped[bool] = mapped_column(Boolean, default=True)
    # v1.3: the brand whose tracked prompt produced this answer. None = brand-neutral (connector and
    # "File a claim" answers), visible to every brand.
    brand_id: Mapped[str | None] = mapped_column(String, nullable=True)


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
    brand_id: Mapped[str] = mapped_column(String, default="brand_001")  # v1.3: the product's brand


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
    brand_id: Mapped[str | None] = mapped_column(String, nullable=True)  # v1.3: None = brand-neutral target


class DailyMetric(Base):
    __tablename__ = "daily_metrics"
    brand_id: Mapped[str] = mapped_column(String, primary_key=True, default="brand_001")  # v1.3
    date: Mapped[str] = mapped_column(String, primary_key=True)  # "2026-09-29"
    accuracy_rate: Mapped[float] = mapped_column(Float)
    hallucination_rate: Mapped[float] = mapped_column(Float)
    claims_checked: Mapped[int] = mapped_column(Integer)
    incidents_opened: Mapped[int] = mapped_column(Integer)
    visibility_rate: Mapped[float] = mapped_column(Float)


class ApiKey(Base):
    """Client API keys (v1.3): each key belongs to one brand. Demo keys are seeded; onboarding adds more."""

    __tablename__ = "api_keys"
    api_key: Mapped[str] = mapped_column(String, primary_key=True)
    brand_id: Mapped[str] = mapped_column(String)
    role: Mapped[str] = mapped_column(String)  # owner | viewer


def get_db():
    """FastAPI dependency: one database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class LoginAlias(Base):
    """v1.7: another username that signs in as a user (the 9 renamed companies' original sheet emails)."""

    __tablename__ = "login_aliases"
    alias: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, index=True)


class Token(Base):
    """Login tokens (v1.4). Kept in the database, so they die on restart like everything else."""

    __tablename__ = "tokens"
    token: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String)
    expires_at: Mapped[str] = mapped_column(String)
