// Internal claims errors. These are NOT the contract's API error codes (claims
// aren't in the contract); they describe why a demo action was refused.
import type { Claim } from "./types";
import type { ClaimFieldErrors } from "./validation";

export type ClaimErrorKind =
  | "notFound"
  | "forbidden"
  | "invalidTransition"
  | "validation"
  | "duplicate"
  | "evidenceLimit";

export interface ClaimError {
  kind: ClaimErrorKind;
  message: string;
  fieldErrors?: ClaimFieldErrors;
}

export type ClaimResult = { ok: true; claim: Claim } | { ok: false; error: ClaimError };

export const ok = (claim: Claim): ClaimResult => ({ ok: true, claim });
export const fail = (kind: ClaimErrorKind, message: string, fieldErrors?: ClaimFieldErrors): ClaimResult => ({
  ok: false,
  error: { kind, message, ...(fieldErrors ? { fieldErrors } : {}) },
});
