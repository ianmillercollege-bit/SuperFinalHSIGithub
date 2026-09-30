// The chosen demo account, kept in this browser only (localStorage). No passwords exist: the
// demo accounts come from GET /api/v1/auth/demo-accounts (contract v1.3, section 7b) and their
// keys are demo-only keys that are already public in the repo.
//
// No account chosen means the default brand (brand_001), exactly as before. Every dashboard request
// sends the chosen `brandId`; see brandScope() and lib/api.ts.
import { useSyncExternalStore } from "react";
import type { DemoAccount } from "../types";

const KEY = "cirqo.brandSession";
const CHANGED = "cirqo:brand-session";

export type BrandSession = DemoAccount;

let cachedRaw: string | null = null;
let cachedValue: BrandSession | null = null;

function isSession(value: unknown): value is BrandSession {
  const v = value as Partial<BrandSession> | null;
  return (
    typeof v?.brandId === "string" &&
    typeof v?.brandName === "string" &&
    typeof v?.role === "string" &&
    typeof v?.apiKey === "string"
  );
}

/** The saved account, or null (meaning the default brand). Safe to call anywhere; null on the server. */
export function getBrandSession(): BrandSession | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    cachedValue = isSession(parsed) ? parsed : null;
  } catch {
    cachedValue = null;
  }
  return cachedValue;
}

export function signInAs(account: DemoAccount): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(account));
  } catch {
    // Private mode or blocked storage: the app keeps working as the default brand.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function signOutBrand(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The chosen account, or null. Re-renders when it changes (including in another tab). */
export function useBrandSession(): BrandSession | null {
  return useSyncExternalStore(subscribe, getBrandSession, () => null);
}

/** The `brandId` to send with a dashboard request, or undefined to use the default brand. */
export function brandScope(): string | undefined {
  return getBrandSession()?.brandId;
}
