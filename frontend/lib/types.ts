// Types copied from BACKEND_CONTRACT.md (DRAFT v0.1). Do not add fields that
// are not in the contract; change this file only when the contract changes.
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
