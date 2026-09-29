// Claims are NOT in BACKEND_CONTRACT.md: sample-only (see INTEGRATION.md, NEEDS LEAD DECISION).
// IDs are prefixed strings; timestamps are ISO 8601 UTC ("2026-09-29T17:05:00Z").

export type ClaimErrorType =
  | "price"
  | "availability"
  | "featureSpec"
  | "policy"
  | "unfairComparison"
  | "safetyLegal";

export type ClaimStatus =
  | "submitted"
  | "inReview"
  | "needsInfo"
  | "escalated"
  | "accepted"
  | "partlyAccepted"
  | "notUpheld"
  | "withdrawn";

export interface ClaimEvidence {
  kind: "link" | "file";
  label: string;
  url?: string;
}

export interface ClaimTimelineEntry {
  at: string;
  actor: string;
  /** e.g. "Owner", "Approver", "CIRQO Legal". */
  actorRole?: string;
  action: string;
  note?: string;
}

export interface Claim {
  /** clm_### */
  id: string;
  product: string;
  assistant: string;
  errorType: ClaimErrorType;
  aiSaid: string;
  correctFact: string;
  evidence: ClaimEvidence[];
  status: ClaimStatus;
  filedBy: { name: string; role: string };
  filedAt: string;
  updatedAt: string;
  reviewer?: { name: string; team: string };
  resolution?: { whatChanged: string; resolvedAt: string };
  /** Oldest first. */
  timeline: ClaimTimelineEntry[];
}

/** An AI error CIRQO spotted that the business hasn't filed a claim for yet. */
export interface SpottedError {
  id: string;
  product: string;
  assistant: string;
  errorType: ClaimErrorType;
  aiSaid: string;
  verifiedFact: string;
}

export interface ActivityEntry {
  at: string;
  actor: string;
  actorRole?: string;
  action: string;
  claimId?: string;
}

export const OUTSTANDING_STATUSES: readonly ClaimStatus[] = ["submitted", "inReview", "needsInfo", "escalated"];
export const REVIEWED_STATUSES: readonly ClaimStatus[] = ["accepted", "partlyAccepted", "notUpheld"];
/** Reviewed outcomes that led to a correction. */
export const CORRECTED_STATUSES: readonly ClaimStatus[] = ["accepted", "partlyAccepted"];

export interface ClaimFilter {
  group?: "outstanding" | "reviewed";
  status?: ClaimStatus;
}
