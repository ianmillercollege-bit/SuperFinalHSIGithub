"use client";

import { useCallback, useState } from "react";
import { ErrorNotice } from "@/components/LoadState";
import SampleSignInLabel from "@/components/SampleSignInLabel";
import { ApiError, getDemoAccounts, getOwners } from "@/lib/api";
import { signInAs, useBrandSession } from "@/lib/auth/brandSession";
import { DEMO_ACCOUNTS_FALLBACK } from "@/lib/auth/demoAccountsFallback";
import { VIEWER_USER, signInUser, useUserSession } from "@/lib/auth/userSession";
import type { SignedInUser } from "@/lib/auth/userSession";
import type { DemoAccount } from "@/lib/types";
import { useApi } from "@/lib/useApi";

// Contract v1.3, section 7b. While the backend answers NOT_FOUND (not shipped yet), the contract's
// example accounts are used instead, and the form says so.
async function loadBrandAccounts(): Promise<{ accounts: DemoAccount[]; example: boolean }> {
  try {
    return { accounts: (await getDemoAccounts()).accounts, example: false };
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") return { accounts: DEMO_ACCOUNTS_FALLBACK, example: true };
    throw error;
  }
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const brandLabel = (a: DemoAccount) => `${a.brandName} ${a.role}`;

/** One compact form: pick who you are and which brand to view, then one Sign in button. */
export default function LoginForm() {
  const owners = useApi(useCallback(() => getOwners(), []));
  const brands = useApi(useCallback(() => loadBrandAccounts(), []));
  const user = useUserSession().user;
  const brandSession = useBrandSession();
  const [personPick, setPersonPick] = useState<string | null>(null);
  const [brandPick, setBrandPick] = useState<string | null>(null);

  const people: SignedInUser[] = [
    ...(owners.data?.owners ?? []).map((o) => ({ name: o.name, role: "owner" as const, title: o.role })),
    VIEWER_USER,
  ];
  const accounts = brands.data?.accounts ?? [];

  // Selected values: what the visitor picked, else who is signed in now, else the first entry.
  const personKey = (p: SignedInUser) => `${p.role}:${p.name}`;
  const person =
    people.find((p) => personKey(p) === personPick) ?? people.find((p) => user && personKey(p) === personKey(user)) ?? people[0];
  const brand =
    accounts.find((a) => a.apiKey === brandPick) ??
    accounts.find((a) => brandSession && a.apiKey === brandSession.apiKey) ??
    accounts[0];

  const loading = owners.loading || brands.loading;
  const error = owners.error ?? brands.error;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!person || !brand) return;
    signInUser(person);
    signInAs(brand);
    // A full load, so every page starts fresh for the chosen person and brand.
    window.location.assign("/dashboard");
  }

  return (
    <form className="stack login-form" onSubmit={submit}>
      <div>
        <h2>Sign in</h2>
        <p>
          <SampleSignInLabel />
        </p>
      </div>
      {error !== undefined && <ErrorNotice error={error} onRetry={() => { owners.reload(); brands.reload(); }} />}
      <label className="field">
        Sign in as
        <span className="select-field">
          <span className="select-avatar" aria-hidden>
            {person ? initials(person.name) : "…"}
          </span>
          <select value={person ? personKey(person) : ""} onChange={(e) => setPersonPick(e.target.value)} disabled={loading || people.length === 0}>
            {loading && <option value="">Loading…</option>}
            {people.map((p) => (
              <option key={personKey(p)} value={personKey(p)}>
                {p.role === "viewer" ? "Viewer (read-only)" : `${p.name}, ${p.title ?? "Owner"}`}
              </option>
            ))}
          </select>
        </span>
      </label>
      <label className="field">
        Brand
        <span className="select-field">
          <span className="select-avatar" aria-hidden>
            {brand ? brand.brandName.slice(0, 2).toUpperCase() : "…"}
          </span>
          <select value={brand?.apiKey ?? ""} onChange={(e) => setBrandPick(e.target.value)} disabled={loading || accounts.length === 0}>
            {loading && <option value="">Loading…</option>}
            {accounts.map((a) => (
              <option key={a.apiKey} value={a.apiKey}>
                {brandLabel(a)}
              </option>
            ))}
          </select>
        </span>
      </label>
      {brands.data?.example && <p className="muted small">Example brand list: the backend has not shipped the demo-accounts list yet.</p>}
      <button type="submit" className="button" disabled={loading || !person || !brand}>
        Sign in
      </button>
      <p className="muted small">No password. Your choice is saved in this browser only.</p>
    </form>
  );
}
