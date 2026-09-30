"use client";

import { useState } from "react";
import { getReport } from "@/lib/api";

/** Downloads GET /report?days=30 as cirqo-report.json. */
export default function ReportDownload() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const report = await getReport(30);
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "cirqo-report.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: 6, marginTop: 16 }}>
      <div>
        <button type="button" className="cq-btn is-orange" onClick={download} disabled={busy}>
          {busy ? "Preparing report…" : "Download quarterly report"}
        </button>
      </div>
      <p className="muted small">Impact, incidents, governance and top sources for the last 30 days.</p>
      {failed && (
        <p role="alert" className="small" style={{ color: "var(--cq-bad, #b42318)" }}>
          The report could not be downloaded. Try again.
        </p>
      )}
    </div>
  );
}
