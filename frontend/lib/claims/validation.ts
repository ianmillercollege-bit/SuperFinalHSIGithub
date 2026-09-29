// Checks a new claim before it is filed. Pure: returns field errors, empty when valid.
import type { Claim, ClaimErrorType, ClaimEvidence } from "./types";
import { OUTSTANDING_STATUSES } from "./types";

export const TEXT_MIN = 10;
export const TEXT_MAX = 1000;
export const EVIDENCE_MIN = 1;
export const EVIDENCE_MAX = 5;
export const FILE_NAME_MAX = 100;

const ERROR_TYPES: readonly ClaimErrorType[] = [
  "price",
  "availability",
  "featureSpec",
  "policy",
  "unfairComparison",
  "safetyLegal",
];

export interface ClaimInput {
  product: string;
  assistant: string;
  errorType: ClaimErrorType | "";
  aiSaid: string;
  correctFact: string;
  evidence: ClaimEvidence[];
}

export type ClaimField = "product" | "assistant" | "errorType" | "aiSaid" | "correctFact" | "evidence" | "duplicate";
export type ClaimFieldErrors = Partial<Record<ClaimField, string>>;

/** One evidence item: a valid http(s) link, or a file name up to 100 characters. null when fine. */
export function validateEvidenceItem(item: ClaimEvidence): string | null {
  if (item.kind === "link") {
    try {
      const url = new URL((item.url ?? "").trim());
      return url.protocol === "http:" || url.protocol === "https:" ? null : "Links must start with http:// or https://.";
    } catch {
      return "Enter a full link, like https://example.com/page.";
    }
  }
  if (item.kind === "file") {
    const name = item.label.trim();
    if (!name) return "Add the file name.";
    return name.length > FILE_NAME_MAX ? `File names can be up to ${FILE_NAME_MAX} characters.` : null;
  }
  return "Evidence must be a link or a file.";
}

/** The open claim (same product, type and assistant) this would duplicate, if any. */
export function findDuplicateOpenClaim(input: ClaimInput, existing: Claim[]): Claim | undefined {
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return existing.find(
    (c) =>
      OUTSTANDING_STATUSES.includes(c.status) &&
      same(c.product, input.product) &&
      same(c.assistant, input.assistant) &&
      c.errorType === input.errorType,
  );
}

export function validateClaim(input: ClaimInput, existing: Claim[] = []): ClaimFieldErrors {
  const errors: ClaimFieldErrors = {};
  if (!input.product.trim()) errors.product = "Choose the product.";
  if (!input.assistant.trim()) errors.assistant = "Choose the AI assistant.";
  if (!ERROR_TYPES.includes(input.errorType as ClaimErrorType)) errors.errorType = "Choose what kind of error it is.";

  for (const field of ["aiSaid", "correctFact"] as const) {
    const length = input[field].trim().length;
    if (length < TEXT_MIN || length > TEXT_MAX) {
      errors[field] = `Use ${TEXT_MIN} to ${TEXT_MAX} characters (now ${length}).`;
    }
  }

  if (input.evidence.length < EVIDENCE_MIN || input.evidence.length > EVIDENCE_MAX) {
    errors.evidence = `Add ${EVIDENCE_MIN} to ${EVIDENCE_MAX} pieces of evidence.`;
  } else {
    const bad = input.evidence.map(validateEvidenceItem).findIndex((e) => e !== null);
    if (bad >= 0) errors.evidence = `Evidence ${bad + 1}: ${validateEvidenceItem(input.evidence[bad])}`;
  }

  const duplicate = findDuplicateOpenClaim(input, existing);
  if (duplicate) {
    errors.duplicate = `You already have an open claim (${duplicate.id}) for this product, assistant and error type.`;
  }
  return errors;
}

export const hasErrors = (errors: ClaimFieldErrors) => Object.keys(errors).length > 0;
