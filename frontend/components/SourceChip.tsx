import type { AiSource } from "@/lib/types";

// The contract's `source` field: how the backend produced the response (live, mock or fallback).
// A small secondary chip, next to (never instead of) the "Sample data" badge.
export default function SourceChip({ source }: { source: AiSource }) {
  return (
    <span className="source-chip" title="How the backend produced this response">
      Source: {source}
    </span>
  );
}
