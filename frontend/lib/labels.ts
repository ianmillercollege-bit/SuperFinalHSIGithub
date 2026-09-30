// Plain-English labels for the contract's enum values, so screens never show
// raw codes on their own. Values come from BACKEND_CONTRACT.md.
import type {
  ActorType,
  ApiErrorCode,
  AuditAction,
  Availability,
  ClaimStatus,
  IncidentHandling,
  IncidentStatus,
  RuleId,
  Severity,
} from "./types";

/** Checker rules, contract section 5. */
export const RULE_LABELS: Record<RuleId, string> = {
  PRICE_MISMATCH: "Wrong price",
  PRICE_OUTDATED: "Outdated price",
  SPEC_MISMATCH: "Wrong spec",
  INVENTED_FEATURE: "Invented feature",
  AVAILABILITY_MISMATCH: "Wrong availability",
  POLICY_MISMATCH: "Wrong policy",
  UNFAIR_COMPARISON: "Unfair comparison",
  SAFETY_LEGAL: "Safety or legal claim",
  NO_FACT: "No verified fact",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const INCIDENT_STATUS_LABELS: Record<IncidentStatus, string> = {
  auto_fixed: "Auto-fixed",
  pending_approval: "Waiting for approval",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
  resolved: "Resolved",
};

export const HANDLING_LABELS: Record<IncidentHandling, string> = {
  auto_fix: "Fixed automatically",
  human_approval: "Needs human approval",
  escalate: "Escalated to a person, never auto-fixed",
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  correct: "Verified correct",
  incorrect: "Incorrect",
  outdated: "Outdated",
  unverifiable: "Unverifiable",
};

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

export const ACTOR_TYPE_LABELS: Record<ActorType, string> = {
  system: "System",
  human: "Person",
  ai: "AI",
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  claim_extracted: "Claim extracted",
  claim_checked: "Claim checked",
  incident_created: "Incident created",
  auto_fix_applied: "Auto-fix applied",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
  resolved: "Resolved",
  connector_query: "Assistant query answered",
  brand_onboarded: "Brand connected",
};

/** What each contract error code means for the person using the screen (section 2). */
export const ERROR_HINTS: Record<ApiErrorCode, string> = {
  BAD_REQUEST: "The request isn't allowed.",
  UNAUTHORIZED: "Missing or invalid API key.",
  FORBIDDEN: "Not allowed: only the assigned owner can act, and critical incidents can't be approved or rejected.",
  NOT_FOUND: "Not found.",
  CONFLICT: "This incident is no longer in a state that allows this action.",
  VALIDATION_ERROR: "Some required information is missing or invalid.",
  RATE_LIMITED: "Too many requests in a short time. Wait a minute and try again.",
  INTERNAL_ERROR: "The backend hit an unexpected error.",
};
