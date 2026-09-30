"use client";

import { useCallback } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import SampleSignInLabel from "@/components/SampleSignInLabel";
import { getOwners } from "@/lib/api";
import { VIEWER_USER, signInUser, useUserSession } from "@/lib/auth/userSession";
import type { SignedInUser } from "@/lib/auth/userSession";
import { useApi } from "@/lib/useApi";

/** One click per account: the seeded owners (GET /api/v1/owners) and one read-only Viewer. No password. */
export default function SampleSignIn() {
  const owners = useApi(useCallback(() => getOwners(), []));
  const session = useUserSession();

  function choose(user: SignedInUser) {
    signInUser(user);
    window.location.assign("/dashboard");
  }

  const accounts: { user: SignedInUser; detail: string }[] = [
    ...(owners.data?.owners ?? []).map((o) => ({
      user: { name: o.name, role: "owner" as const, title: o.role },
      detail: `${o.role}. Can approve, reject and resolve the claims assigned to them.`,
    })),
    { user: VIEWER_USER, detail: "Viewer. Read-only: no approve, reject, resolve or file-a-claim buttons." },
  ];

  return (
    <section className="stack" aria-labelledby="signin-title">
      <div>
        <h2 id="signin-title">Sign in</h2>
        <p>
          <SampleSignInLabel />
        </p>
        <p className="muted small">
          {session.user ? `Signed in as ${session.user.name} (${session.user.role}).` : "You are signed out."}
        </p>
      </div>
      {owners.loading && <Loading what="owners" />}
      {owners.error !== undefined && <ErrorNotice error={owners.error} onRetry={owners.reload} />}
      <ul className="account-grid">
        {accounts.map((a) => {
          const current = session.user?.name === a.user.name && session.user.role === a.user.role;
          return (
            <li key={`${a.user.role}-${a.user.name}`}>
              <button type="button" className="card account-card" onClick={() => choose(a.user)} aria-current={current ? "true" : undefined}>
                <span className="user-initials" aria-hidden>
                  {a.user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <span className="account-text">
                  <span className="ring-label">Sign in as {a.user.name}</span>
                  <span className="muted small">
                    {a.detail}
                    {current ? " · current" : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
