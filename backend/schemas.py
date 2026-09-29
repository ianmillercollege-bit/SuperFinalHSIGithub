"""Request and response models, one per shape in BACKEND_CONTRACT.md sections 4 and 7.

Python uses snake_case; JSON uses camelCase (section 1).
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

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
    ram_gb: int | float
    storage_gb: int | float
    screen_inches: int | float
    battery_hours: int | float
    weight_lb: int | float
    touchscreen: bool


class ProductOut(CamelModel):
    product_id: str
    brand_id: str
    brand_name: str
    name: str
    price: float
    currency: str
    availability: Availability
    specs: Specs
    return_policy_days: int
    updated_at: str
    # v1.2 Verified Data Layer. factSource is not called "source": that word means live|mock|fallback.
    fact_source: Literal["Brand product feed", "Brand website", "Manufacturer spec sheet"]
    fact_source_url: str
    verified_at: str


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


class RecommendOut(CamelModel):
    recommendation: Recommendation | None
    alternatives: list[Alternative]
    ranking_note: str
    source: Source


# ---- Connector (v1.1) -------------------------------------------------------------------------


class ConnectorConstraints(CamelModel):
    max_price: float | None = Field(None, gt=0)
    use_case: Literal["school", "work", "travel", "media"] | None = None
    must_have: list[Literal["battery", "light", "screen", "touch"]] = []


class ConnectorQueryIn(CamelModel):
    question: str
    assistant_id: str
    constraints: ConnectorConstraints | None = None


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
    answer_text: str | None = None
    assistant_id: str | None = None
    query_text: str | None = None


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


def _not_blank(value: str) -> str:
    if not value.strip():
        raise ValueError("must not be empty")
    return value.strip()


class ApproveIn(CamelModel):
    approver_name: str
    note: str | None = None

    @field_validator("approver_name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _not_blank(v)


class RejectIn(CamelModel):
    approver_name: str
    note: str
    false_alarm: bool = False

    @field_validator("approver_name", "note")
    @classmethod
    def not_blank(cls, v: str) -> str:
        return _not_blank(v)


class ResolveIn(CamelModel):
    resolver_name: str
    note: str

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
                    "rejected", "escalated", "resolved", "connector_query"]
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

