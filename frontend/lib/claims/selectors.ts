// Pure functions: same claims (and `now`) in, same numbers out. Every claims
// summary number on screen comes from here.
import type { ActivityEntry, Claim } from "./types";
import { CORRECTED_STATUSES, OUTSTANDING_STATUSES, REVIEWED_STATUSES } from "./types";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export const isOutstanding = (c: Claim) => OUTSTANDING_STATUSES.includes(c.status);
export const isReviewed = (c: Claim) => REVIEWED_STATUSES.includes(c.status);

/** Claims still open: submitted, in review, needs info, or escalated. */
export function outstandingCount(claims: Claim[]): number {
  return claims.filter(isOutstanding).length;
}

/** Reviewed claims decided in the last `days` days. */
export function reviewedInWindow(claims: Claim[], now: Date, days = 30): Claim[] {
  const since = now.getTime() - days * DAY;
  return claims.filter((c) => isReviewed(c) && c.resolution && Date.parse(c.resolution.resolvedAt) >= since);
}

export function reviewedCount(claims: Claim[], now: Date, days = 30): number {
  return reviewedInWindow(claims, now, days).length;
}

/** Share of reviewed claims (last `days` days) that led to a correction, 0 to 1. null if none. */
export function correctionShare(claims: Claim[], now: Date, days = 30): number | null {
  const reviewed = reviewedInWindow(claims, now, days);
  if (reviewed.length === 0) return null;
  return reviewed.filter((c) => CORRECTED_STATUSES.includes(c.status)).length / reviewed.length;
}

/** Median hours from filing to decision, over reviewed claims (last `days` days). null if none. */
export function medianTimeToResolveHours(claims: Claim[], now: Date, days = 30): number | null {
  const hours = reviewedInWindow(claims, now, days)
    .map((c) => (Date.parse(c.resolution!.resolvedAt) - Date.parse(c.filedAt)) / HOUR)
    .sort((a, b) => a - b);
  if (hours.length === 0) return null;
  const mid = Math.floor(hours.length / 2);
  return hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2;
}

/** Claims waiting for the business to add evidence. */
export function waitingForEvidenceCount(claims: Claim[]): number {
  return claims.filter((c) => c.status === "needsInfo").length;
}

/** Average hours outstanding claims have been open (filed until `now`). null if none. */
export function averageWaitHours(claims: Claim[], now: Date): number | null {
  const open = claims.filter(isOutstanding);
  if (open.length === 0) return null;
  return open.reduce((sum, c) => sum + (now.getTime() - Date.parse(c.filedAt)) / HOUR, 0) / open.length;
}

/** Every timeline step across all claims, newest first. */
export function activityFrom(claims: Claim[]): ActivityEntry[] {
  return claims
    .flatMap((c) => c.timeline.map((t) => ({ at: t.at, actor: t.actor, actorRole: t.actorRole, action: t.action, claimId: c.id })))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
