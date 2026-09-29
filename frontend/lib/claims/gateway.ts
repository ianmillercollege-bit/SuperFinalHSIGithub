// The one place pages get claims data from. Claims are sample-only (not in the
// contract), so this keeps them in the browser:
//   - key "cirqo.sample.v1.<profile>.claims" in localStorage (versioned; bump
//     STORAGE_VERSION when the shape changes, old data is then ignored)
//   - missing or corrupt data is reseeded from lib/sample/claims.ts
//   - without a browser (build, scripts) it keeps state in memory only
// Every method waits a little so loading states show. Subscribers are told after changes.
import type { DemoAccount } from "../sample/demoAccounts";
import { buildClaimsSeed, buildSpottedErrorsSeed } from "../sample/claims";
import { fail, ok, type ClaimResult } from "./errors";
import { can } from "./permissions";
import { reviewClaim as sampleReview, reviewerActor, CIRQO_REVIEWERS, type ReviewDecision } from "./sampleReviewer";
import { activityFrom, isOutstanding, isReviewed } from "./selectors";
import type { ActivityEntry, Claim, ClaimEvidence, ClaimFilter, SpottedError } from "./types";
import { EVIDENCE_MAX, hasErrors, validateClaim, validateEvidenceItem, type ClaimInput } from "./validation";
import { EVIDENCE_ADDED_ACTION, TRANSITION_ACTIONS, appendTimeline, isTerminal, transition, type Actor } from "./workflow";

export const STORAGE_VERSION = 1;
export const DEFAULT_PROFILE = "demo";
const LATENCY_MS = 250;

interface ClaimsState {
  version: number;
  seededAt: string;
  claims: Claim[];
  spottedErrors: SpottedError[];
}

export function storageKey(profile: string): string {
  return `cirqo.sample.v${STORAGE_VERSION}.${profile}.claims`;
}

function seed(now = new Date()): ClaimsState {
  return {
    version: STORAGE_VERSION,
    seededAt: now.toISOString(),
    claims: buildClaimsSeed(now),
    spottedErrors: buildSpottedErrorsSeed(),
  };
}

function isValidState(value: unknown): value is ClaimsState {
  const s = value as ClaimsState | null;
  return (
    !!s &&
    s.version === STORAGE_VERSION &&
    Array.isArray(s.claims) &&
    Array.isArray(s.spottedErrors) &&
    s.claims.every((c) => typeof c?.id === "string" && typeof c?.status === "string" && Array.isArray(c?.timeline))
  );
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Next id after the highest clm_### so far (clm_016 -> clm_017). */
export function nextClaimId(claims: Claim[]): string {
  const highest = claims.reduce((max, c) => Math.max(max, Number(/^clm_(\d+)$/.exec(c.id)?.[1] ?? 0)), 0);
  return `clm_${String(highest + 1).padStart(3, "0")}`;
}

const isoNow = (date: Date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

function businessActor(account: DemoAccount): Actor {
  return { name: account.name, role: account.role, kind: "business" };
}

export function createClaimsGateway(profile = DEFAULT_PROFILE, options: { now?: () => Date } = {}) {
  const key = storageKey(profile);
  const clock = options.now ?? (() => new Date());
  let memory: ClaimsState | null = null;
  const subscribers = new Set<() => void>();

  function read(): ClaimsState {
    if (memory) return memory;
    const store = storage();
    try {
      const raw = store?.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (isValidState(parsed)) return (memory = parsed);
    } catch {
      // Corrupt JSON: fall through and reseed.
    }
    return write(seed(clock()));
  }

  function write(state: ClaimsState): ClaimsState {
    memory = state;
    try {
      storage()?.setItem(key, JSON.stringify(state));
    } catch {
      // Storage full or blocked: keep working from memory.
    }
    return state;
  }

  function notify() {
    subscribers.forEach((cb) => cb());
  }

  const wait = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  const copy = <T>(value: T): T => structuredClone(value);

  /** Saves a changed claim (or a new one) and tells subscribers. */
  function save(claim: Claim): ClaimResult {
    const state = read();
    const exists = state.claims.some((c) => c.id === claim.id);
    write({
      ...state,
      claims: exists ? state.claims.map((c) => (c.id === claim.id ? claim : c)) : [...state.claims, claim],
    });
    notify();
    return ok(copy(claim));
  }

  function find(id: string): Claim | undefined {
    return read().claims.find((c) => c.id === id);
  }

  return {
    async listClaims(filter: ClaimFilter = {}): Promise<Claim[]> {
      await wait();
      return copy(
        read().claims.filter(
          (c) =>
            (!filter.status || c.status === filter.status) &&
            (filter.group !== "outstanding" || isOutstanding(c)) &&
            (filter.group !== "reviewed" || isReviewed(c)),
        ),
      );
    },

    /** null when no claim has this id. */
    async getClaim(id: string): Promise<Claim | null> {
      await wait();
      const found = read().claims.find((c) => c.id === id);
      return found ? copy(found) : null;
    },

    async listSpottedErrors(): Promise<SpottedError[]> {
      await wait();
      return copy(read().spottedErrors);
    },

    /** Derived from the claim timelines, newest first. */
    async listActivity(): Promise<ActivityEntry[]> {
      await wait();
      return activityFrom(read().claims);
    },

    /** Calls `cb` after any change. Returns a function that stops the updates. */
    subscribe(cb: () => void): () => void {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },

    /** Files a new claim. safetyLegal claims are escalated to Legal straight away. */
    async createClaim(input: ClaimInput, account: DemoAccount): Promise<ClaimResult> {
      await wait();
      if (!can(account.role, "fileClaim")) return fail("forbidden", `${account.role}s can't file claims.`);
      const claims = read().claims;
      const errors = validateClaim(input, claims);
      if (hasErrors(errors)) {
        return errors.duplicate && Object.keys(errors).length === 1
          ? fail("duplicate", errors.duplicate, errors)
          : fail("validation", "Please fix the highlighted fields.", errors);
      }
      const at = isoNow(clock());
      const actor = businessActor(account);
      let claim: Claim = {
        id: nextClaimId(claims),
        product: input.product.trim(),
        assistant: input.assistant.trim(),
        errorType: input.errorType as Claim["errorType"],
        aiSaid: input.aiSaid.trim(),
        correctFact: input.correctFact.trim(),
        evidence: input.evidence.map((e) => ({ ...e, label: e.label.trim() || (e.url ?? "").trim() })),
        status: "submitted",
        filedBy: { name: account.name, role: account.role },
        filedAt: at,
        updatedAt: at,
        timeline: [{ at, actor: actor.name, actorRole: actor.role, action: TRANSITION_ACTIONS.submitted }],
      };
      if (claim.errorType === "safetyLegal") {
        const legal = CIRQO_REVIEWERS.priya;
        claim = appendTimeline(
          { ...claim, status: "escalated", reviewer: { ...legal } },
          reviewerActor(legal),
          at,
          TRANSITION_ACTIONS.escalated,
          "Safety and legal claims go straight to CIRQO Legal and are never resolved automatically.",
        );
      }
      return save(claim);
    },

    /** Adds evidence (up to 5 in total). A claim waiting for evidence goes back into review. */
    async addEvidence(id: string, items: ClaimEvidence[], account: DemoAccount): Promise<ClaimResult> {
      await wait();
      if (!can(account.role, "addEvidence")) return fail("forbidden", `${account.role}s can't add evidence.`);
      const claim = find(id);
      if (!claim) return fail("notFound", `Claim ${id} doesn't exist.`);
      if (isTerminal(claim.status)) return fail("invalidTransition", `Claim ${id} is closed.`);
      if (items.length === 0) return fail("validation", "Add at least one piece of evidence.", { evidence: "Add at least one piece of evidence." });
      if (claim.evidence.length + items.length > EVIDENCE_MAX) {
        return fail("evidenceLimit", `A claim can have up to ${EVIDENCE_MAX} pieces of evidence.`);
      }
      const bad = items.map(validateEvidenceItem).find((e) => e !== null);
      if (bad) return fail("validation", bad, { evidence: bad });
      const actor = businessActor(account);
      const at = isoNow(clock());
      let updated = appendTimeline(
        { ...claim, evidence: [...claim.evidence, ...items.map((e) => ({ ...e, label: e.label.trim() || (e.url ?? "").trim() }))] },
        actor,
        at,
        EVIDENCE_ADDED_ACTION,
        items.map((e) => e.label.trim() || e.url).join(", "),
      );
      if (updated.status === "needsInfo") {
        const back = transition(updated, "inReview", actor, at, { note: "Evidence received, review continues." });
        if (!back.ok) return back;
        updated = back.claim;
      }
      return save(updated);
    },

    /** Withdraws a claim that is submitted, in review, or waiting for evidence. */
    async withdrawClaim(id: string, account: DemoAccount, note?: string): Promise<ClaimResult> {
      await wait();
      if (!can(account.role, "withdrawClaim")) return fail("forbidden", `${account.role}s can't withdraw claims.`);
      const claim = find(id);
      if (!claim) return fail("notFound", `Claim ${id} doesn't exist.`);
      const result = transition(claim, "withdrawn", businessActor(account), isoNow(clock()), { note: note?.trim() || undefined });
      return result.ok ? save(result.claim) : result;
    },

    /** DEMO ONLY: a named CIRQO reviewer acts on a sample claim. */
    async reviewClaim(id: string, decision: ReviewDecision, note: string, whatChanged?: string): Promise<ClaimResult> {
      await wait();
      const claim = find(id);
      if (!claim) return fail("notFound", `Claim ${id} doesn't exist.`);
      const result = sampleReview(claim, decision, note, isoNow(clock()), whatChanged);
      return result.ok ? save(result.claim) : result;
    },

    /** "Reset demo data": reseeds claims and spotted errors, then notifies. */
    async resetDemoData(): Promise<void> {
      await wait();
      write(seed(clock()));
      notify();
    },
  };
}

export type ClaimsGateway = ReturnType<typeof createClaimsGateway>;

/** The app's gateway for the current (only) profile. */
export const claimsGateway = createClaimsGateway();
