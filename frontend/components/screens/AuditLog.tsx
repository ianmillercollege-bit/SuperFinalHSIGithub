"use client";

import { useCallback, useState } from "react";
import AuditTable from "@/components/AuditTable";
import { ErrorNotice, Loading } from "@/components/LoadState";
import { getAudit } from "@/lib/api";
import { useApi } from "@/lib/useApi";

export default function AuditLog() {
  const [draft, setDraft] = useState("");
  const [targetId, setTargetId] = useState("");
  const audit = useApi(useCallback(() => getAudit({ targetId: targetId || undefined }), [targetId]));

  return (
    <div className="stack">
      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          setTargetId(draft.trim());
        }}
      >
        <label>
          Filter by target ID
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. inc_12" />
        </label>
        <button type="submit" className="button button-secondary">
          Apply
        </button>
        {targetId && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              setDraft("");
              setTargetId("");
            }}
          >
            Clear
          </button>
        )}
      </form>
      <p className="muted small">Append-only: entries cannot be edited or deleted. Newest first.</p>
      {audit.loading && <Loading what="audit log" />}
      {audit.error !== undefined && <ErrorNotice error={audit.error} onRetry={audit.reload} />}
      {audit.data && <AuditTable entries={audit.data.entries} />}
    </div>
  );
}
