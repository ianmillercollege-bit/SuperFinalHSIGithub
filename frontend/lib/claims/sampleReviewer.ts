// DEMO ONLY: stands in for a CIRQO reviewer so the sample claims can move
// through review. Only the sample claims gateway uses it; real claims (if the
// contract ever adds them) would be reviewed by people on the backend.
import { fail, type ClaimResult } from "./errors";
import type { Claim, ClaimStatus } from "./types";
import { transition, type Actor } from "./workflow";

export type ReviewDecision = "startReview" | "askForInfo" | "accept" | "partlyAccept" | "notUphold";

export const CIRQO_REVIEWERS = {
  jordan: { name: "Jordan Lee", team: "Data Quality" },
  marcus: { name: "Marcus Webb", team: "Data Quality" },
  priya: { name: "Priya Shah", team: "Legal" },
} as const;

const TARGET: Record<ReviewDecision, ClaimStatus> = {
  startReview: "inReview",
  askForInfo: "needsInfo",
  accept: "accepted",
  partlyAccept: "partlyAccepted",
  notUphold: "notUpheld",
};

/** Keeps the assigned reviewer; otherwise Legal for safetyLegal, Data Quality for the rest. */
export function reviewerFor(claim: Claim): { name: string; team: string } {
  if (claim.reviewer) return claim.reviewer;
  if (claim.errorType === "safetyLegal") return CIRQO_REVIEWERS.priya;
  return Number(claim.id.slice(4)) % 2 === 0 ? CIRQO_REVIEWERS.jordan : CIRQO_REVIEWERS.marcus;
}

export function reviewerActor(reviewer: { name: string; team: string }): Actor {
  return { name: reviewer.name, role: `CIRQO ${reviewer.team}`, kind: "reviewer" };
}

/** Applies one reviewer decision at time `at`. accept and partlyAccept need whatChanged; askForInfo needs a note. */
export function reviewClaim(
  claim: Claim,
  decision: ReviewDecision,
  note: string,
  at: string,
  whatChanged?: string,
): ClaimResult {
  if ((decision === "accept" || decision === "partlyAccept") && !whatChanged?.trim()) {
    return fail("validation", "Describe what changed before accepting.", {});
  }
  if (decision === "askForInfo" && !note.trim()) {
    return fail("validation", "Say what evidence is needed.", {});
  }
  const reviewer = reviewerFor(claim);
  const result = transition(claim, TARGET[decision], reviewerActor(reviewer), at, {
    note: note.trim() || undefined,
    whatChanged: whatChanged?.trim() || (decision === "notUphold" ? note.trim() || undefined : undefined),
  });
  return result.ok ? { ok: true, claim: { ...result.claim, reviewer: { ...reviewer } } } : result;
}
