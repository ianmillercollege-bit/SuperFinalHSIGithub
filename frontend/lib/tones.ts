// Which color family each contract status uses. Pills always show text too.
import type { ClaimStatus, IncidentStatus, Severity } from "./types";

export type Tone = "good" | "bad" | "warn" | "neutral" | "info";

export const SEVERITY_TONES: Record<Severity, Tone> = {
  low: "neutral",
  medium: "warn",
  high: "bad",
  critical: "bad",
};

export const INCIDENT_STATUS_TONES: Record<IncidentStatus, Tone> = {
  auto_fixed: "good",
  pending_approval: "warn",
  approved: "good",
  rejected: "neutral",
  escalated: "bad",
  resolved: "good",
};

export const CLAIM_STATUS_TONES: Record<ClaimStatus, Tone> = {
  correct: "good",
  incorrect: "bad",
  outdated: "warn",
  unverifiable: "neutral",
};
