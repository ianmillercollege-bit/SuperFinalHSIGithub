// Turns any failed call into a sentence for the screen, using the contract's
// error codes (BACKEND_CONTRACT.md section 2). No other codes are invented.
import { ApiError } from "./api";
import { ERROR_HINTS } from "./labels";

export function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.code ? `${ERROR_HINTS[error.code]} ${error.message}` : error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
