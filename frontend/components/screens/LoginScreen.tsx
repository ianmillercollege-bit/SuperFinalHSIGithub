"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import LoginView from "@/components/screens/LoginView";
import { getDemoAccounts } from "@/lib/api";
import { DEMO_LOGINS, DEMO_PASSWORD } from "@/lib/auth/demoAccounts";
import { continueAsGuest, signInWithPassword } from "@/lib/auth/signIn";
import { useApi } from "@/lib/useApi";

/**
 * /login: the kit's LoginView. The demo usernames come from GET /auth/demo-accounts (contract v1.4) when the
 * backend sends them, on top of the seeded users the contract prints; the page shows them at once and
 * never waits for the backend, so the guest path always works.
 */
export default function LoginScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const next = useSearchParams().get("next");
  const accounts = useApi(useCallback(() => getDemoAccounts(), []));

  const rows = useMemo(() => {
    const local = DEMO_LOGINS.map((a) => ({ name: a.name, role: a.role, email: a.username, password: DEMO_PASSWORD }));
    const fromBackend = (accounts.data?.accounts ?? [])
      .filter((a) => a.username && !local.some((l) => l.email.toLowerCase() === a.username!.toLowerCase()))
      .map((a) => ({
        name: a.brandName,
        role: a.role === "owner" ? "Brand Data Owner" : "Viewer",
        email: a.username!,
        password: DEMO_PASSWORD,
      }));
    return [...local, ...fromBackend];
  }, [accounts.data]);

  async function submit(username: string, password: string) {
    setSubmitting(true);
    setError(undefined);
    const result = await signInWithPassword(username, password);
    setSubmitting(false);
    if (result.error) return setError(result.error);
    // A full load, so every page starts fresh for the signed-in person and company. Only same-site paths are followed.
    window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  }

  return (
    <>
      <LoginView
        accounts={rows}
        onSubmit={(username, password) => void submit(username, password)}
        submitting={submitting}
        error={error}
        warning={`Demo login: not real authentication. Don't enter a real password. All demo passwords: ${DEMO_PASSWORD}.`}
      />
      <button
        type="button"
        className="cq-btn guest-link"
        onClick={() => {
          continueAsGuest();
          window.location.assign("/dashboard");
        }}
      >
        Continue as guest (Kestrel)
      </button>
    </>
  );
}
