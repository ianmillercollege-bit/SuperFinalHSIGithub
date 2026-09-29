// The one place pages get claims data from. Claims are sample-only (not in the
// contract), so this keeps them in the browser:
//   - key "cirqo.sample.v1.<profile>.claims" in localStorage (versioned; bump
//     STORAGE_VERSION when the shape changes, old data is then ignored)
//   - missing or corrupt data is reseeded from lib/sample/claims.ts
//   - without a browser (build, scripts) it keeps state in memory only
// Every method waits a little so loading states show. Subscribers are told after changes.
import { buildClaimsSeed, buildSpottedErrorsSeed } from "../sample/claims";
import { activityFrom, isOutstanding, isReviewed } from "./selectors";
import type { ActivityEntry, Claim, ClaimFilter, SpottedError } from "./types";

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

export function createClaimsGateway(profile = DEFAULT_PROFILE) {
  const key = storageKey(profile);
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
    return write(seed());
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

    /** "Reset demo data": reseeds claims and spotted errors, then notifies. */
    async resetDemoData(): Promise<void> {
      await wait();
      write(seed());
      notify();
    },
  };
}

export type ClaimsGateway = ReturnType<typeof createClaimsGateway>;

/** The app's gateway for the current (only) profile. */
export const claimsGateway = createClaimsGateway();
