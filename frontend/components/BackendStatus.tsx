"use client";

import { useEffect, useState } from "react";
import { API_URL, USE_MOCK, checkHealth } from "@/lib/api";

type Status = "checking" | "online" | "offline";

export default function BackendStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    checkHealth().then((ok) => {
      if (!cancelled) setStatus(ok ? "online" : "offline");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="footer">
      <span className={`dot ${status}`} aria-hidden />
      <span>
        Backend: {status === "checking" ? "checking…" : status}
        {!API_URL && " (NEXT_PUBLIC_API_URL not set)"}
      </span>
      {USE_MOCK && <span className="mock-tag">Using example data</span>}
    </footer>
  );
}
