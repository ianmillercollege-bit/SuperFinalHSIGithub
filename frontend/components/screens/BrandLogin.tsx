"use client";

import { useCallback } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import { ApiError, getDemoAccounts } from "@/lib/api";
import { signInAs, signOutBrand, useBrandSession } from "@/lib/auth/brandSession";
import { DEMO_ACCOUNTS_FALLBACK } from "@/lib/auth/demoAccountsFallback";
import { BUSINESS } from "@/lib/business";
import type { DemoAccount, DemoAccountsResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";

// Contract v1.3, section 7b. While the backend answers NOT_FOUND (not shipped yet), the contract's
// example accounts are shown and labeled as examples.
async function loadAccounts(): Promise<{ accounts: DemoAccount[]; example: boolean }> {
  try {
    const data: DemoAccountsResponse = await getDemoAccounts();
    return { accounts: data.accounts, example: false };
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") return { accounts: DEMO_ACCOUNTS_FALLBACK, example: true };
    throw error;
  }
}

export default function BrandLogin() {
  const loaded = useApi(useCallback(() => loadAccounts(), []));
  const session = useBrandSession();

  function choose(account: DemoAccount) {
    signInAs(account);
    // A full load, so every page starts fresh for the chosen brand.
    window.location.assign("/dashboard");
  }

  if (loaded.loading) return <Loading what="demo accounts" />;
  if (loaded.error !== undefined) return <ErrorNotice error={loaded.error} onRetry={loaded.reload} />;
  const { accounts, example } = loaded.data!;

  return (
    <div className="stack">
      <p className="muted">
        Now viewing as{" "}
        <strong>
          {session ? `${session.brandName} (${session.role})` : `${BUSINESS.name} (default, no account chosen)`}
        </strong>
        .
      </p>
      {example && (
        <p className="mock-note" role="note">
          <span className="estimate-badge">Example accounts</span> The backend has not shipped the demo-accounts list yet,
          so these are the examples from the contract.
        </p>
      )}
      <ul className="account-grid">
        {accounts.map((a) => {
          const current = session?.brandId === a.brandId && session.role === a.role;
          return (
            <li key={a.apiKey}>
              <button type="button" className="card account-card" onClick={() => choose(a)} aria-current={current ? "true" : undefined}>
                <span className="user-initials" aria-hidden>
                  {a.brandName.slice(0, 2).toUpperCase()}
                </span>
                <span className="account-text">
                  <span className="ring-label">
                    Sign in as {a.brandName} {a.role}
                  </span>
                  <span className="muted small">
                    {a.role === "owner" ? "Full access to this brand's dashboard" : "Read-only view of this brand's dashboard"}
                    {current ? " · current" : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="muted small">
        Demo accounts: no passwords, and nothing here is real authentication. Your choice is saved in this browser only.
      </p>
      {session && (
        <p>
          <button type="button" className="link-button" onClick={() => { signOutBrand(); window.location.assign("/dashboard"); }}>
            Use the default account ({BUSINESS.name})
          </button>
        </p>
      )}
    </div>
  );
}
