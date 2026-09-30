"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ToastMessage {
  text: string;
  kind: "ok" | "error";
}

/** A message that appears for a few seconds. Pages own it: call show() from a handler. */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = useCallback(() => setToast(null), []);
  const show = useCallback((text: string, kind: ToastMessage["kind"] = "ok") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ text, kind });
    timer.current = setTimeout(() => setToast(null), 7000);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { toast, show, hide };
}

export function Toast({ toast, onClose }: { toast: ToastMessage | null; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
      <span>{toast.text}</span>
      <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss message">
        Dismiss
      </button>
    </div>
  );
}
