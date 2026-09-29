// Claim status rules. Pure: nothing here reads storage or the clock.
//
//   submitted  -> inReview, withdrawn
//   inReview   -> needsInfo, accepted, partlyAccepted, notUpheld, escalated, withdrawn
//   needsInfo  -> inReview (only after evidence is added), withdrawn
//   escalated  -> (none: NEEDS LEAD DECISION on how escalated claims close)
//   accepted, partlyAccepted, notUpheld, withdrawn: terminal
//
// Only the business withdraws; only CIRQO reviewers (or automatic routing) make
// review decisions. safetyLegal claims are escalated on creation and are never
// auto-resolved.
import { fail, ok, type ClaimErrorKind, type ClaimResult } from "./errors";
import type { Claim, ClaimStatus, ClaimTimelineEntry } from "./types";

export interface Actor {
  name: string;
  /** Shown in the timeline, e.g. "Owner" or "CIRQO Legal". */
  role: string;
  kind: "business" | "reviewer" | "system";
}

export const TRANSITIONS: Record<ClaimStatus, readonly ClaimStatus[]> = {
  submitted: ["inReview", "withdrawn"],
  inReview: ["needsInfo", "accepted", "partlyAccepted", "notUpheld", "escalated", "withdrawn"],
  needsInfo: ["inReview", "withdrawn"],
  escalated: [],
  accepted: [],
  partlyAccepted: [],
  notUpheld: [],
  withdrawn: [],
};

export const TERMINAL_STATUSES: readonly ClaimStatus[] = ["accepted", "partlyAccepted", "notUpheld", "withdrawn"];

const RESOLVED_STATUSES: readonly ClaimStatus[] = ["accepted", "partlyAccepted", "notUpheld"];

export const TRANSITION_ACTIONS: Record<ClaimStatus, string> = {
  submitted: "Claim filed",
  inReview: "Review started",
  needsInfo: "More evidence requested",
  escalated: "Escalated to Legal",
  accepted: "Claim accepted, correction sent to the assistant",
  partlyAccepted: "Claim partly accepted, partial correction sent",
  notUpheld: "Claim not upheld",
  withdrawn: "Claim withdrawn",
};

export const EVIDENCE_ADDED_ACTION = "Evidence added";

export const isTerminal = (status: ClaimStatus) => TERMINAL_STATUSES.includes(status);

/** True if evidence was added after the latest "More evidence requested" step. */
export function evidenceAddedSinceInfoRequest(claim: Claim): boolean {
  const requested = claim.timeline.map((t) => t.action).lastIndexOf(TRANSITION_ACTIONS.needsInfo);
  return requested >= 0 && claim.timeline.slice(requested + 1).some((t) => t.action === EVIDENCE_ADDED_ACTION);
}

export function canTransition(
  claim: Claim,
  to: ClaimStatus,
  actor: Actor,
): { ok: true } | { ok: false; kind: ClaimErrorKind; reason: string } {
  const from = claim.status;
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, kind: "invalidTransition", reason: `A claim that is ${from} can't move to ${to}.` };
  }
  if (to === "withdrawn") {
    return actor.kind === "business"
      ? { ok: true }
      : { ok: false, kind: "forbidden", reason: "Only the business can withdraw a claim." };
  }
  if (from === "needsInfo" && to === "inReview") {
    if (!evidenceAddedSinceInfoRequest(claim)) {
      return { ok: false, kind: "invalidTransition", reason: "Add the requested evidence before the review continues." };
    }
    return { ok: true };
  }
  if (actor.kind === "business") {
    return { ok: false, kind: "forbidden", reason: "Only a CIRQO reviewer can make review decisions." };
  }
  if (claim.errorType === "safetyLegal" && RESOLVED_STATUSES.includes(to) && actor.kind === "system") {
    return { ok: false, kind: "forbidden", reason: "Safety and legal claims are never resolved automatically." };
  }
  return { ok: true };
}

/** Adds a step to the timeline and updates updatedAt. */
export function appendTimeline(
  claim: Claim,
  actor: Actor,
  at: string,
  action: string,
  note?: string,
): Claim {
  const entry: ClaimTimelineEntry = { at, actor: actor.name, actorRole: actor.role, action, ...(note ? { note } : {}) };
  return { ...claim, updatedAt: at, timeline: [...claim.timeline, entry] };
}

/** Moves a claim to a new status and records who did it and when. */
export function transition(
  claim: Claim,
  to: ClaimStatus,
  actor: Actor,
  at: string,
  opts: { note?: string; whatChanged?: string } = {},
): ClaimResult {
  const allowed = canTransition(claim, to, actor);
  if (!allowed.ok) return fail(allowed.kind, allowed.reason);
  const moved = appendTimeline({ ...claim, status: to }, actor, at, TRANSITION_ACTIONS[to], opts.note ?? opts.whatChanged);
  if (RESOLVED_STATUSES.includes(to)) {
    return ok({ ...moved, resolution: { whatChanged: opts.whatChanged ?? "No change made.", resolvedAt: at } });
  }
  return ok(moved);
}
