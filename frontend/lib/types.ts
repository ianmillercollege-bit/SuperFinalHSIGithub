// Types copied from BACKEND_CONTRACT.md (FINAL v1.0). Do not add fields that
// are not in the contract; change this file only when the contract changes.
// "UNCONFIRMED" marks a nullability the contract implies but doesn't state.
//
// Every "rate" or "share" is a number from 0 to 1. Show it as a % with
// formatPercent() from lib/format.ts.

/** Number from 0 to 1. */
export type Rate = number;
/** ISO 8601 UTC timestamp, e.g. "2026-09-29T17:05:00Z". */
export type Timestamp = string;
/** Date, e.g. "2026-09-29". */
export type DateString = string;

// ---- Errors (contract section 2) ----

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

// ---- Health: GET /health ----

export interface HealthResponse {
  status: string;
  mockMode: boolean;
  version: string;
}

// ---- Visibility: GET /api/v1/visibility/summary ----

export interface CompetitorVisibility {
  brandName: string;
  visibilityRate: Rate;
  averageRank: number;
  shareOfVoice: Rate;
}

export interface AssistantVisibility {
  assistantId: string;
  name: string;
  visibilityRate: Rate;
  averageRank: number;
}

export interface VisibilitySummary {
  brandId: string;
  brandName: string;
  periodDays: number;
  /** Share of tracked answers mentioning the brand. */
  visibilityRate: Rate;
  /** Mean position when mentioned (1 = first). Not a rate. */
  averageRank: number;
  /** Brand mentions / all brand mentions. */
  shareOfVoice: Rate;
  competitors: CompetitorVisibility[];
  byAssistant: AssistantVisibility[];
}

// ---- Trust metrics: GET /api/v1/metrics/trust ----

export interface TrustCurrent {
  accuracyRate: Rate;
  hallucinationRate: Rate;
  medianTimeToResolveHours: number;
  falseAlarmRate: Rate;
  visibilityRate: Rate;
}

export interface TrustDaily {
  date: DateString;
  accuracyRate: Rate;
  hallucinationRate: Rate;
  claimsChecked: number;
  incidentsOpened: number;
  visibilityRate: Rate;
}

export interface TrustMetrics {
  periodDays: number;
  /** Values over the last 7 days. */
  current: TrustCurrent;
  /** Exactly periodDays entries, oldest first, ending today (UTC). */
  daily: TrustDaily[];
}

// ---- Incidents: GET /api/v1/incidents ----

export type RuleId =
  | "PRICE_MISMATCH"
  | "PRICE_OUTDATED"
  | "SPEC_MISMATCH"
  | "INVENTED_FEATURE"
  | "AVAILABILITY_MISMATCH"
  | "POLICY_MISMATCH"
  | "UNFAIR_COMPARISON"
  | "SAFETY_LEGAL"
  | "NO_FACT";

export type Severity = "low" | "medium" | "high" | "critical";

export type IncidentHandling = "auto_fix" | "human_approval" | "escalate";

export type IncidentStatus =
  | "auto_fixed"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "escalated"
  | "resolved";

export interface Incident {
  incidentId: string;
  claimId: string;
  answerId: string;
  productId: string;
  ruleId: RuleId;
  severity: Severity;
  handling: IncidentHandling;
  status: IncidentStatus;
  summary: string;
  aiSaid: string;
  verifiedFact: string;
  /** null when handling is "escalate". */
  proposedFix: string | null;
  ownerId: string;
  ownerName: string;
  falseAlarm: boolean;
  createdAt: Timestamp;
  /** null while open. */
  resolvedAt: Timestamp | null;
  /** null while open. */
  resolvedBy: string | null;
}

export interface IncidentsResponse {
  incidents: Incident[];
}

export interface IncidentFilters {
  status?: IncidentStatus;
  severity?: Severity;
  /** Default 50, max 100. */
  limit?: number;
}

/** Where AI-derived output came from (contract section 1). */
export type AiSource = "live" | "mock" | "fallback";

// ---- Products: GET /api/v1/products ----

export type Availability = "in_stock" | "low_stock" | "out_of_stock";

export interface ProductSpecs {
  ramGb: number;
  storageGb: number;
  screenInches: number;
  batteryHours: number;
  weightLb: number;
  touchscreen: boolean;
}

export interface Product {
  productId: string;
  brandId: string;
  brandName: string;
  name: string;
  price: number;
  currency: string;
  availability: Availability;
  specs: ProductSpecs;
  returnPolicyDays: number;
  updatedAt: Timestamp;
}

export interface ProductsResponse {
  products: Product[];
}

// ---- Claims: GET /api/v1/claims ----

export type ClaimType = "price" | "feature" | "availability" | "policy" | "comparison" | "safety_legal";

export type ClaimStatus = "correct" | "incorrect" | "outdated" | "unverifiable";

export interface Claim {
  claimId: string;
  answerId: string;
  productId: string | null;
  text: string;
  claimType: ClaimType;
  extractedValue: string | null;
  verifiedValue: string | null;
  status: ClaimStatus;
  /** UNCONFIRMED: correct claims have no rule (section 5), assumed null. */
  ruleId: RuleId | null;
  factId: string | null;
  reason: string;
  checkedAt: Timestamp;
}

export interface ClaimsResponse {
  claims: Claim[];
}

export interface ClaimFilters {
  status?: ClaimStatus;
  answerId?: string;
  limit?: number;
}

// ---- Answers: GET /api/v1/answers ----

export interface Answer {
  answerId: string;
  queryText: string;
  assistantId: string;
  assistantName: string;
  answerText: string;
  brandMentioned: boolean;
  /** UNCONFIRMED: assumed null when brandMentioned is false. */
  rank: number | null;
  sourceIds: string[];
  capturedAt: Timestamp;
  source: AiSource;
}

export interface AnswersResponse {
  answers: Answer[];
}

export interface AnswerFilters {
  assistantId?: string;
  limit?: number;
}

// ---- Sources: GET /api/v1/sources ----

export type CitationSourceType = "review_site" | "marketplace" | "brand_site" | "forum" | "news";

/** A website AI answers cite (called "source" in the contract). */
export interface CitationSource {
  sourceId: string;
  name: string;
  domain: string;
  type: CitationSourceType;
  citationCount: number;
  citationShare: Rate;
  /** Share of correct claims in answers citing this source. */
  accuracyRate: Rate;
  lastSeenAt: Timestamp;
}

export interface SourcesResponse {
  sources: CitationSource[];
}

// ---- Checker: POST /api/v1/checker/run ----

export type CheckerRunRequest =
  | { answerId: string }
  | { answerText: string; assistantId: string; queryText: string };

export interface CheckerRunResponse {
  answerId: string;
  claims: Claim[];
  incidentsCreated: string[];
  source: AiSource;
}

// ---- Incident actions: POST /api/v1/incidents/{id}/approve | reject | resolve ----

export interface ApproveRequest {
  approverName: string;
  note?: string;
}

export interface RejectRequest {
  approverName: string;
  note: string;
  falseAlarm: boolean;
}

export interface ResolveRequest {
  resolverName: string;
  note: string;
}

// ---- Owners: GET /api/v1/owners ----

export interface Owner {
  ownerId: string;
  name: string;
  role: string;
  incidentTypes: RuleId[];
}

export interface OwnersResponse {
  owners: Owner[];
}

// ---- Audit log: GET /api/v1/audit ----

export type ActorType = "system" | "human" | "ai";

export type AuditAction =
  | "claim_extracted"
  | "claim_checked"
  | "incident_created"
  | "auto_fix_applied"
  | "approved"
  | "rejected"
  | "escalated"
  | "resolved";

export interface AuditEntry {
  auditId: string;
  timestamp: Timestamp;
  actor: string;
  actorType: ActorType;
  action: AuditAction;
  targetId: string;
  details: string;
}

export interface AuditResponse {
  entries: AuditEntry[];
}

export interface AuditFilters {
  targetId?: string;
  limit?: number;
}

// ---- Report: GET /api/v1/report ----

export interface Report {
  generatedAt: Timestamp;
  periodDays: number;
  brandName: string;
  impact: {
    accuracyStart: Rate;
    accuracyEnd: Rate;
    hallucinationStart: Rate;
    hallucinationEnd: Rate;
    visibilityStart: Rate;
    visibilityEnd: Rate;
  };
  incidents: {
    total: number;
    autoFixed: number;
    humanApproved: number;
    rejected: number;
    escalated: number;
    open: number;
    medianTimeToResolveHours: number;
  };
  topSources: { sourceId: string; name: string; citationShare: Rate; accuracyRate: Rate }[];
  openHighRisk: string[];
  governance: {
    automated: string[];
    humanReviewed: string[];
    escalateOnly: string[];
    owners: { name: string; role: string }[];
  };
}

// ---- Shopper funnel: GET /api/v1/shopper/questions, POST /api/v1/shopper/recommend ----

export interface ShopperOption {
  optionId: string;
  label: string;
}

export interface ShopperQuestion {
  questionId: string;
  type: "single" | "swipe";
  prompt: string;
  options: ShopperOption[];
}

export interface ShopperQuestionsResponse {
  openingQuery: string;
  questions: ShopperQuestion[];
}

export interface RecommendRequest {
  answers: { questionId: string; optionId: string }[];
  swipes: { optionId: string; liked: boolean }[];
}

export interface Recommendation {
  productId: string;
  name: string;
  brandName: string;
  price: number;
  currency: string;
  availability: Availability;
  matchScore: Rate;
  reasons: { text: string; claimStatus: ClaimStatus; factId: string }[];
  verifiedAt: Timestamp;
}

export interface RecommendResponse {
  /** null when no product fits. */
  recommendation: Recommendation | null;
  alternatives: { productId: string; name: string; brandName: string; price: number; matchScore: Rate }[];
  rankingNote: string;
  source: AiSource;
}
