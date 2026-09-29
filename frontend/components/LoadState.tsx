"use client";

import { describeError } from "@/lib/errors";

export function Loading({ what = "data" }: { what?: string }) {
  return (
    <p className="state" role="status">
      Loading {what}…
    </p>
  );
}

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <p>{describeError(error)}</p>
      {onRetry && (
        <button type="button" className="button button-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="state">{children}</p>;
}
