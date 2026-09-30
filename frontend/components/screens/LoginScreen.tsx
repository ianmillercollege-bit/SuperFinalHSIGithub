"use client";

import { useState } from "react";
import LoginView from "@/components/screens/LoginView";
import { DEMO_LOGINS, DEMO_PASSWORD } from "@/lib/auth/demoAccounts";
import { continueAsGuest, signInWithPassword } from "@/lib/auth/signIn";
import { useSearchParams } from "next/navigation";

/** /login: the kit's LoginView. The page owns the sign-in call and the guest link. */
export default function LoginScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const next = useSearchParams().get("next");

  async function submit(username: string, password: string) {
    setSubmitting(true);
    setError(undefined);
    const result = await signInWithPassword(username, password);
    setSubmitting(false);
    if (result.error) return setError(result.error);
    // A full load, so every page starts fresh for the signed-in person and brand. Only same-site paths are followed.
    window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
  }

  return (
    <>
      <LoginView
        accounts={DEMO_LOGINS.map((a) => ({ name: a.name, role: a.role, email: a.username, password: DEMO_PASSWORD }))}
        onSubmit={(username, password) => void submit(username, password)}
        submitting={submitting}
        error={error}
        warning="Demo login: not real authentication. Don't enter a real password. Until the backend login is live, the demo accounts are checked in this browser."
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
