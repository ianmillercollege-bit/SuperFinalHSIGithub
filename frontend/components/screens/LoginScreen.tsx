"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useId, useMemo, useState } from "react";
import AccountCombobox from "@/components/AccountCombobox";
import BrandLockup from "@/components/screens/BrandLockup";
import { Field, SampleBadge } from "@/components/screens/ui";
import { getDemoAccounts } from "@/lib/api";
import { COMMUNITY_LOGINS, DEMO_LOGINS, DEMO_PASSWORD } from "@/lib/auth/demoAccounts";
import { continueAsGuest, signInWithPassword } from "@/lib/auth/signIn";
import { useApi } from "@/lib/useApi";

/**
 * /login, built from the kit's login layout. The demo usernames come from GET /auth/demo-accounts (contract v1.4)
 * when the backend sends them, on top of the seeded users the contract prints; the page shows them at once and
 * never waits for the backend, so the guest path always works. Everyone is in one type-ahead dropdown so the
 * whole page fits without scrolling.
 */
export default function LoginScreen() {
  const uid = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [problems, setProblems] = useState<{ username?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const next = useSearchParams().get("next");
  const accounts = useApi(useCallback(() => getDemoAccounts(), []));

  const options = useMemo(() => {
    const local = DEMO_LOGINS.map((a) => ({ name: a.name, role: a.role, username: a.username }));
    const partners = COMMUNITY_LOGINS.map((a) => ({ name: a.name, role: a.role, username: a.username }));
    const fromBackend = (accounts.data?.accounts ?? [])
      // v1.5: login lists only opted-in companies (a missing flag means the backend is older, and its list is already opted-in only).
      .filter((a) => a.optedIn !== false)
      .filter((a) => a.username && !local.some((l) => l.username.toLowerCase() === a.username!.toLowerCase()))
      .map((a) => ({ name: a.brandName, role: a.role === "owner" ? "Brand Data Owner" : "Viewer", username: a.username! }));
    // Partner rows sent by the backend (contract v1.6) replace the sample ones, which exist only until it ships.
    const backendPartners = (accounts.data?.accounts ?? [])
      .filter((a) => a.orgName && a.username)
      .map((a) => ({ name: a.orgName!, role: "Community Partner", username: a.username! }));
    return [...local, ...fromBackend.filter((a) => !backendPartners.some((p) => p.username === a.username)), ...(backendPartners.length > 0 ? backendPartners : partners)];
  }, [accounts.data]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = { username: username.trim() ? undefined : "Enter your username.", password: password ? undefined : "Enter your password." };
    setProblems(found);
    if (found.username) return document.getElementById(`${uid}-user`)?.focus();
    if (found.password) return document.getElementById(`${uid}-pass`)?.focus();
    setSubmitting(true);
    setError(undefined);
    const result = await signInWithPassword(username.trim(), password);
    setSubmitting(false);
    if (result.error) return setError(result.error);
    // A full load, so every page starts fresh for the signed-in person and company. Only same-site paths are followed.
    window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : (result.landing ?? "/dashboard"));
  }

  return (
    <div className="cq-login">
      <div className="cq-login-brand">
        <BrandLockup large />
        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 540 }}>
          <h1>Know what AI tells shoppers about your business.</h1>
          <p>See how often assistants recommend you, check what they say against verified facts, and keep a named person in charge of every fix.</p>
        </div>
        <span style={{ fontSize: 13, color: "var(--cq-on-navy-muted)" }}>Ranking is never influenced by payment.</span>
      </div>
      <div className="cq-login-side">
        <div className="corner">
          <SampleBadge />
        </div>
        <form className="cq-login-card" onSubmit={(e) => void submit(e)} noValidate>
          <h2 className="cq-h1" style={{ fontSize: 28 }}>
            Sign in
          </h2>
          <Field id={`${uid}-user`} label="Username" error={problems.username}>
            <AccountCombobox
              id={`${uid}-user`}
              value={username}
              invalid={!!problems.username}
              accounts={options}
              onChange={(v) => {
                setUsername(v);
                setProblems({});
              }}
              onPick={(a) => {
                setUsername(a.username);
                setPassword(DEMO_PASSWORD);
                setProblems({});
              }}
            />
          </Field>
          <Field id={`${uid}-pass`} label="Password" error={problems.password}>
            <div style={{ display: "flex", gap: 8 }}>
              <input id={`${uid}-pass`} className="cq-input" type={show ? "text" : "password"} autoComplete="current-password" value={password} aria-invalid={!!problems.password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="cq-btn" aria-pressed={show} onClick={() => setShow(!show)}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </Field>
          {error && (
            <div className="cq-note" role="alert" style={{ background: "var(--cq-bad-bg)", color: "var(--cq-bad)" }}>
              {error}
            </div>
          )}
          <button type="submit" className="cq-btn is-primary" style={{ minHeight: 48, fontSize: 15 }} disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
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
          <span className="cq-note is-warn">{`Demo login: not real authentication. Don't enter a real password. All demo passwords: ${DEMO_PASSWORD}.`}</span>
        </form>
      </div>
    </div>
  );
}
