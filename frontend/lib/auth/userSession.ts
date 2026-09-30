// Sample sign-in (DECISIONS.md #32, frontend only). "Sample sign-in. No real authentication."
//
// The signed-in person lives in this browser only (localStorage). The backend accepts any caller;
// hiding buttons from the Viewer is a frontend convenience, not security.
//
// - First visit: signed in as the default owner, so "/" lands on the dashboard (decision 29).
// - After an explicit sign-out: `signedOut` is set, and "/" goes to /login. Every other page still works.
// - Owners are the seeded owners from GET /api/v1/owners; the approve and reject forms pre-fill the
//   signed-in owner's name, and a 403 for a mismatch is the demo of accountability.
import { useSyncExternalStore } from "react";

const KEY = "cirqo.userSession";
const CHANGED = "cirqo:user-session";

export type UserRole = "owner" | "viewer";

export interface SignedInUser {
  name: string;
  role: UserRole;
  /** The owner's job title from GET /api/v1/owners, for display. */
  title?: string;
  /** Signed in through POST /auth/login (a real token), not the local sample check. */
  backend?: boolean;
  /** Role "CIRQO Staff" (contract v1.4): sees the cross-company pages. */
  staff?: boolean;
}

/** Signed in as this owner on a first visit (a seeded owner, contract section 9). */
export const DEFAULT_USER: SignedInUser = { name: "Maria Lopez", role: "owner" };

export const VIEWER_USER: SignedInUser = { name: "Viewer", role: "viewer", title: "Read-only" };

export interface UserSession {
  /** null after an explicit sign-out. */
  user: SignedInUser | null;
  signedOut: boolean;
}

const FIRST_VISIT: UserSession = { user: DEFAULT_USER, signedOut: false };
const SIGNED_OUT: UserSession = { user: null, signedOut: true };

let cachedRaw: string | null = null;
let cachedValue: UserSession = FIRST_VISIT;

function isUser(value: unknown): value is SignedInUser {
  const v = value as Partial<SignedInUser> | null;
  return typeof v?.name === "string" && (v.role === "owner" || v.role === "viewer");
}

export function getUserSession(): UserSession {
  if (typeof window === "undefined") return FIRST_VISIT;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return FIRST_VISIT;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (parsed === "signed-out") cachedValue = SIGNED_OUT;
    else if (isUser(parsed)) cachedValue = { user: parsed, signedOut: false };
    else cachedValue = FIRST_VISIT;
  } catch {
    cachedValue = FIRST_VISIT;
  }
  return cachedValue;
}

function write(value: SignedInUser | "signed-out"): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Blocked storage: the app keeps working with the first-visit user.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function signInUser(user: SignedInUser): void {
  write(user);
}

/** Back to the first-visit state: the default owner, no sign-out marker (the guest path, DECISIONS.md #33). */
export function resetUserSession(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
  window.dispatchEvent(new Event(CHANGED));
}

export function signOutUser(): void {
  write("signed-out");
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useUserSession(): UserSession {
  return useSyncExternalStore(subscribe, getUserSession, () => FIRST_VISIT);
}

/** Only a signed-in owner can approve, reject, resolve or file claims. */
export function canAct(session: UserSession): boolean {
  return session.user?.role === "owner";
}
