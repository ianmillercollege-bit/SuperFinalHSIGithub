"""Request and response models, one per shape in BACKEND_CONTRACT.md sections 4 and 7.

Python uses snake_case; JSON uses camelCase (section 1).
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

import constants as C

Source = Literal["live", "mock", "fallback"]
Availability = Literal["in_stock", "low_stock", "out_of_stock"]
ClaimStatus = Literal["correct", "incorrect", "outdated", "unverifiable"]
Severity = Literal["low", "medium", "high", "critical"]
IncidentStatus = Literal["auto_fixed", "pending_approval", "approved", "rejected", "escalated", "resolved"]


class CamelModel(BaseModel):
    """Base for every request and response model."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class HealthResponse(CamelModel):
    status: str
    mock_mode: bool
    version: str


# ---- Shared objects (section 4) ----------------------------------------------------------------


class Specs(CamelModel):
    # int | float keeps whole numbers as 8 (not 8.0), matching the contract examples.
    # null = not on file (v1.3 onboarding lets a brand omit specs); extra keys a brand sent are kept.
    model_config = ConfigDict(extra="allow")

    ram_gb: int | float | None
    storage_gb: int | float | None
    screen_inches: int | float | None
    battery_hours: int | float | None
    weight_lb: int | float | None
    touchscreen: bool | None


class CommunityPledge(CamelModel):
    units_pledged: int
    units_placed: int
    condition_notes: str | None
    warranty_months: int | None


class ProductOut(CamelModel):
    product_id: str
    brand_id: str
    brand_name: str
    name: str
    price: float
    currency: str
    availability: Availability
    # v1.4.1: categories follow the catalog sheet.
    category: Literal["laptops", "headphones", "phones_tablets", "computer_hardware"]
    subcategory: str
    # Laptops: the six contract specs (Specs) plus extras. Other categories: the sheet's spec columns.
    specs: dict
    return_policy_days: int
    updated_at: str
    # v1.2 Verified Data Layer. factSource is not called "source": that word means live|mock|fallback.
    fact_source: Literal["Brand product feed", "Brand website", "Manufacturer spec sheet",
                         "Public listing (not verified by brand)"]
    fact_source_url: str
    verified_at: str
    # v1.5 section 7d: true only when the brand has opted in (facts checked against the brand's own data).
    verified: bool = True
    # v1.6 Community program.
    condition: Literal["new", "refurbished", "surplus"] = "new"
    community_pledge: CommunityPledge | None = None


class ComparisonOut(CamelModel):
    fact_id: str
    other_product_id: str
    other_product_name: str
    attribute: str
    text: str


class ProductDetailOut(ProductOut):
    """GET /products/{productId} (v1.7): the product plus its verified comparisons, for an assistant that
    wants depth on one option without inventing anything."""
    comparisons: list[ComparisonOut]


class ClaimOut(CamelModel):
    claim_id: str
    answer_id: str
    product_id: str | None
    text: str
    claim_type: Literal["price", "feature", "availability", "policy", "comparison", "safety_legal"]
    extracted_value: str | None
    verified_value: str | None
    status: ClaimStatus
    rule_id: str | None
    fact_id: str | None
    reason: str
    checked_at: str


class IncidentOut(CamelModel):
    incident_id: str
    claim_id: str
    answer_id: str
    product_id: str | None
    rule_id: str
    severity: Severity
    handling: Literal["auto_fix", "human_approval", "escalate"]
    status: IncidentStatus
    summary: str
    ai_said: str | None
    verified_fact: str | None
    proposed_fix: str | None
    owner_id: str
    owner_name: str
    false_alarm: bool
    created_at: str
    resolved_at: str | None
    resolved_by: str | None


# ---- Shopper funnel ------------------------------------------------------------------------------


class Option(CamelModel):
    option_id: str
    label: str


class Question(CamelModel):
    question_id: str
    type: Literal["single", "swipe"]
    prompt: str
    options: list[Option]


class QuestionsOut(CamelModel):
    opening_query: str
    questions: list[Question]


class AnswerIn(CamelModel):
    question_id: str
    option_id: str


class SwipeIn(CamelModel):
    option_id: str
    liked: bool


class RecommendIn(CamelModel):
    answers: list[AnswerIn] = []
    swipes: list[SwipeIn] = []


class Reason(CamelModel):
    text: str
    claim_status: ClaimStatus
    fact_id: str | None


class Recommendation(CamelModel):
    product_id: str
    name: str
    brand_name: str
    price: float
    currency: str
    availability: Availability
    match_score: float
    reasons: list[Reason]
    verified_at: str


class Alternative(CamelModel):
    product_id: str
    name: str
    brand_name: str
    price: float
    match_score: float
    verified: bool = True  # v1.5 section 7d


class RecommendOut(CamelModel):
    recommendation: Recommendation | None
    alternatives: list[Alternative]
    ranking_note: str
    source: Source


# ---- Connector (v1.1) -------------------------------------------------------------------------


class ConnectorConstraints(CamelModel):
    # Finite only: "Infinity", NaN and numbers too big for a float are a 422, not a crash.
    max_price: float | None = Field(None, gt=0, allow_inf_nan=False)
    use_case: Literal["school", "work", "travel", "media"] | None = None
    must_have: list[Literal["battery", "light", "screen", "touch"]] = []
    # v1.6: refurbished and surplus products are left out unless the assistant asks for them.
    include_refurbished: bool = False


class ConnectorQueryIn(CamelModel):
    question: str = Field(max_length=C.MAX_QUESTION_CHARS)
    assistant_id: str
    constraints: ConnectorConstraints | None = None

    @field_validator("question")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _not_blank(v)


class ConnectorRecommendation(CamelModel):
    product_id: str
    name: str
    brand_name: str
    price: float
    currency: str
    availability: Availability
    match_score: float
    return_policy_days: int
    facts: list[Reason]
    verified_at: str
    verified: bool = True  # v1.5 section 7d


class ConnectorQueryOut(CamelModel):
    answer_id: str
    question: str
    assistant_id: str
    recommendation: ConnectorRecommendation | None
    alternatives: list[Alternative]
    answer_text: str
    claims: list[ClaimOut]
    ranking_note: str
    verified_at: str
    # v1.5 section 7d: how many of the named products come from opted-in brands.
    verified_count: int = 0
    unverified_count: int = 0
    source: Source


# ---- Connector search (v1.4 section 7c) ------------------------------------------------------


class SearchConstraintsIn(CamelModel):
    category: Literal["laptops", "headphones", "phones_tablets", "computer_hardware"] | None = None
    max_price: float | None = Field(None, gt=0, allow_inf_nan=False)
    use_case: Literal["school", "work", "travel", "media"] | None = None
    # Laptop words (battery, light, screen, touch) or a narrowing hint's attribute or split, e.g. wireless.
    must_have: list[str] = Field([], max_length=10)

    @field_validator("must_have")
    @classmethod
    def short_terms(cls, v: list[str]) -> list[str]:
        terms = [t.strip() for t in v]
        if any(not t or len(t) > 40 for t in terms):
            raise ValueError("each mustHave term must be 1 to 40 characters")
        return list(dict.fromkeys(terms))


class ConnectorSearchIn(CamelModel):
    question: str = Field(max_length=C.MAX_QUESTION_CHARS)
    assistant_id: str
    constraints: SearchConstraintsIn | None = None

    @field_validator("question")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _not_blank(v)


class SearchOption(CamelModel):
    product_id: str
    name: str
    brand_name: str
    price: float
    currency: str
    availability: Availability
    match_score: float
    verified: bool  # v1.5 section 7d: the brand has opted in and its facts are verified
    facts: list[Reason]


class NarrowingHint(CamelModel):
    attribute: str
    question: str
    splits: dict[str, int]


class ConnectorSearchOut(CamelModel):
    search_id: str
    question: str
    assistant_id: str
    category: Literal["laptops", "headphones", "phones_tablets", "computer_hardware"]
    option_count: int
    options: list[SearchOption]
    narrowing_hints: list[NarrowingHint]
    verified_count: int  # v1.5
    unverified_count: int
    ranking_note: str
    verified_at: str
    source: Source


# ---- Products, visibility, answers, sources -------------------------------------------------


class ProductsOut(CamelModel):
    products: list[ProductOut]


class CompetitorVisibility(CamelModel):
    brand_name: str
    visibility_rate: float
    average_rank: float
    share_of_voice: float


class AssistantVisibility(CamelModel):
    assistant_id: str
    name: str
    visibility_rate: float
    average_rank: float


class VisibilityOut(CamelModel):
    brand_id: str
    brand_name: str
    period_days: int
    visibility_rate: float
    average_rank: float
    share_of_voice: float
    competitors: list[CompetitorVisibility]
    by_assistant: list[AssistantVisibility]


class AnswerOut(CamelModel):
    answer_id: str
    query_text: str
    assistant_id: str
    assistant_name: str
    answer_text: str
    brand_mentioned: bool
    rank: int | None
    source_ids: list[str]
    captured_at: str
    source: Source


class AnswersOut(CamelModel):
    answers: list[AnswerOut]


class SourceOut(CamelModel):
    source_id: str
    name: str
    domain: str
    type: Literal["review_site", "marketplace", "brand_site", "forum", "news"]
    citation_count: int
    citation_share: float
    accuracy_rate: float
    last_seen_at: str | None


class SourcesOut(CamelModel):
    sources: list[SourceOut]


# ---- Checker ---------------------------------------------------------------------------------


class CheckerRunIn(CamelModel):
    """Exactly one form: {"answerId"} or {"answerText", "assistantId", "queryText"}."""

    answer_id: str | None = None
    answer_text: str | None = Field(None, max_length=C.MAX_ANSWER_CHARS)
    assistant_id: str | None = None
    query_text: str | None = Field(None, max_length=C.MAX_QUESTION_CHARS)


class CheckerRunOut(CamelModel):
    answer_id: str
    claims: list[ClaimOut]
    incidents_created: list[str]
    source: Source


class ClaimsOut(CamelModel):
    claims: list[ClaimOut]


# ---- Incidents, owners, audit ----------------------------------------------------------------


class IncidentsOut(CamelModel):
    incidents: list[IncidentOut]


def _not_blank(value: str | None) -> str | None:
    if value is None:
        return None  # optional names (v1.4); required notes are enforced by their type
    if not value.strip():
        raise ValueError("must not be empty")
    return value.strip()


class ApproveIn(CamelModel):
    approver_name: str | None = Field(None, max_length=C.MAX_NAME_CHARS)  # v1.4: optional with a token
    note: str | None = Field(None, max_length=C.MAX_NOTE_CHARS)

    @field_validator("approver_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _not_blank(v)


class RejectIn(CamelModel):
    approver_name: str | None = Field(None, max_length=C.MAX_NAME_CHARS)  # v1.4: optional with a token
    note: str = Field(max_length=C.MAX_NOTE_CHARS)
    false_alarm: bool = False

    @field_validator("approver_name", "note")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _not_blank(v)


class ResolveIn(CamelModel):
    resolver_name: str | None = Field(None, max_length=C.MAX_NAME_CHARS)  # v1.4: optional with a token
    note: str = Field(max_length=C.MAX_NOTE_CHARS)

    @field_validator("resolver_name", "note")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _not_blank(v)


class OwnerOut(CamelModel):
    owner_id: str
    name: str
    role: str
    incident_types: list[str]


class OwnersOut(CamelModel):
    owners: list[OwnerOut]


class AuditOut(CamelModel):
    audit_id: str
    timestamp: str
    actor: str
    actor_type: Literal["system", "human", "ai"]
    action: Literal["claim_extracted", "claim_checked", "incident_created", "auto_fix_applied", "approved",
                    "rejected", "escalated", "resolved", "connector_query", "brand_onboarded",
                    "connector_search", "brand_claimed",
                    "community_request", "community_approved", "community_rejected"]
    target_id: str
    details: str


class AuditListOut(CamelModel):
    entries: list[AuditOut]


# ---- Trust metrics and report ----------------------------------------------------------------


class TrustCurrent(CamelModel):
    accuracy_rate: float
    hallucination_rate: float
    median_time_to_resolve_hours: float
    false_alarm_rate: float
    visibility_rate: float


class TrustDaily(CamelModel):
    date: str
    accuracy_rate: float
    hallucination_rate: float
    claims_checked: int
    incidents_opened: int
    visibility_rate: float


class TrustOut(CamelModel):
    period_days: int
    current: TrustCurrent
    daily: list[TrustDaily]


class Impact(CamelModel):
    accuracy_start: float
    accuracy_end: float
    hallucination_start: float
    hallucination_end: float
    visibility_start: float
    visibility_end: float


class IncidentCounts(CamelModel):
    total: int
    auto_fixed: int
    human_approved: int
    rejected: int
    escalated: int
    open: int
    median_time_to_resolve_hours: float


class TopSource(CamelModel):
    source_id: str
    name: str
    citation_share: float
    accuracy_rate: float


class GovernanceOwner(CamelModel):
    name: str
    role: str


class Governance(CamelModel):
    automated: list[str]
    human_reviewed: list[str]
    escalate_only: list[str]
    owners: list[GovernanceOwner]


class ReportOut(CamelModel):
    generated_at: str
    period_days: int
    brand_name: str
    impact: Impact
    incidents: IncidentCounts
    top_sources: list[TopSource]
    open_high_risk: list[str]
    governance: Governance



# ---- Brand accounts (v1.3 section 7b) ----------------------------------------------------------


class DemoAccount(CamelModel):
    brand_id: str
    brand_name: str
    role: Literal["owner", "viewer"]
    api_key: str
    username: str  # v1.4: log in with this and the shared demo password
    opted_in: bool = True  # v1.5: only opted-in companies are listed


class DemoAccountsOut(CamelModel):
    accounts: list[DemoAccount]
    password_note: str  # v1.4: every demo password is cirqo-demo


# ---- Login and company profiles (v1.4 section 7c) ----------------------------------------------


class LoginIn(CamelModel):
    username: str = Field(max_length=C.MAX_NAME_CHARS)
    password: str = Field(max_length=C.MAX_NAME_CHARS)


class UserOut(CamelModel):
    user_id: str
    name: str
    role: str
    username: str


class BrandRef(CamelModel):
    brand_id: str
    brand_name: str


class MeOut(CamelModel):
    expires_at: str
    user: UserOut
    brand: BrandRef | None  # None for CIRQO Staff, who belong to no brand


class LoginOut(MeOut):
    token: str


class OkOut(CamelModel):
    ok: bool


class ProfileAdmin(CamelModel):
    user_id: str
    name: str
    role: str


class Ceo(CamelModel):
    name: str


class BrandProfileOut(CamelModel):
    brand_id: str
    brand_name: str
    tagline: str | None = None
    categories: list[str]
    hq_city: str | None = None
    founded: int | None = None
    employees: int | None = None
    ceo: Ceo | None = None
    website: str | None = None
    admins: list[ProfileAdmin]
    product_count: int
    opted_in: bool = True  # v1.5 section 7d
    plan: Literal["starter", "growth", "enterprise"] | None = None  # only on the brand's own profile


class BrandSummary(CamelModel):
    brand_id: str
    brand_name: str
    categories: list[str]
    product_count: int
    visibility_rate: float
    open_incidents: int
    escalated_incidents: int
    accuracy_rate: float
    opted_in: bool = True  # v1.5 section 7d


class BrandsOut(CamelModel):
    brands: list[BrandSummary]


# ---- Onboarding: "Connect your catalog" (v1.3 section 7b) ------------------------------------------


class OnboardProductIn(CamelModel):
    name: str = Field(max_length=C.MAX_NAME_CHARS)
    category: Literal["laptops", "headphones", "phones_tablets", "computer_hardware"] = "laptops"  # v1.4.1
    subcategory: str | None = Field(None, max_length=60)
    price: float = Field(gt=0, allow_inf_nan=False)
    availability: Availability = "in_stock"
    specs: dict = {}
    return_policy_days: int = Field(30, ge=0, le=3650)
    fact_source: Literal["Brand product feed", "Brand website", "Manufacturer spec sheet"] = "Brand product feed"
    fact_source_url: str | None = Field(None, max_length=500, pattern=r"^https?://\S+$")

    @field_validator("name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _not_blank(v)

    @field_validator("specs")
    @classmethod
    def known_specs_have_the_right_type(cls, v: dict) -> dict:
        """Product spec keys must be finite numbers >= 0 (touchscreen a boolean); unknown keys are kept."""
        import math
        for key in ("ramGb", "storageGb", "screenInches", "batteryHours", "weightLb"):
            value = v.get(key)
            if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))
                                      or not math.isfinite(value) or value < 0):
                raise ValueError(f"{key} must be a number >= 0")
        if v.get("touchscreen") is not None and not isinstance(v["touchscreen"], bool):
            raise ValueError("touchscreen must be true or false")
        return v


class OnboardIn(CamelModel):
    brand_name: str = Field(max_length=100)
    owner_name: str = Field(max_length=C.MAX_NAME_CHARS)
    products: list[OnboardProductIn] = Field(min_length=1, max_length=50)

    @field_validator("brand_name", "owner_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _not_blank(v)


class OnboardOwner(CamelModel):
    owner_id: str
    name: str
    role: str


class OnboardOut(CamelModel):
    brand_id: str
    brand_name: str
    api_key: str
    products_created: int
    owners: list[OnboardOwner]
    connector_ready: bool
    note: str


class ClaimIn(CamelModel):
    """POST /brands/{brandId}/claim (v1.5 section 7d): a not-opted-in company opts in."""
    owner_name: str = Field(max_length=C.MAX_NAME_CHARS)
    email: str = Field(max_length=120)

    @field_validator("owner_name", "email")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _not_blank(v)


class ClaimOut(OnboardOut):
    opted_in: Literal[True] = True
