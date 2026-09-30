"use client";

import { useCallback, useState } from "react";
import Autocomplete, { resolveOption } from "@/components/Autocomplete";
import { ErrorNotice } from "@/components/LoadState";
import SampleSignInLabel from "@/components/SampleSignInLabel";
import { ApiError, getDemoAccounts, getOwners } from "@/lib/api";
import { signInAs } from "@/lib/auth/brandSession";
import { DEMO_ACCOUNTS_FALLBACK } from "@/lib/auth/demoAccountsFallback";
import { VIEWER_USER, signInUser } from "@/lib/auth/userSession";
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
  // Type-only: the fields start empty and the visitor types a name; suggestions complete it.
  const [personText, setPersonText] = useState("");
  const [brandText, setBrandText] = useState("");
  const [errors, setErrors] = useState<{ person?: string; brand?: string }>({});

  const people: SignedInUser[] = [
    ...(owners.data?.owners ?? []).map((o) => ({ name: o.name, role: "owner" as const, title: o.role })),
    VIEWER_USER,
  ];
  const accounts = brands.data?.accounts ?? [];

  const personKey = (p: SignedInUser) => `${p.role}:${p.name}`;
  const personOptions = people.map((p) => ({
    value: personKey(p),
    label: p.role === "viewer" ? "Viewer" : p.name,
    hint: p.role === "viewer" ? "Read-only: can look, not approve or file" : p.title ?? "Owner",
    avatar: initials(p.name),
  }));
  const brandOptions = accounts.map((a) => ({
    value: a.apiKey,
    label: brandLabel(a),
    hint: a.role === "owner" ? "Full access to this brand" : "Read-only view of this brand",
    avatar: a.brandName.slice(0, 2).toUpperCase(),
  }));

  const loading = owners.loading || brands.loading;
  const error = owners.error ?? brands.error;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const personOption = resolveOption(personOptions, personText);
    const brandOption = resolveOption(brandOptions, brandText);
    const next: { person?: string; brand?: string } = {};
    if (!personOption) next.person = personText.trim() ? "No match. Pick a name from the suggestions." : "Type your name.";
    if (!brandOption) next.brand = brandText.trim() ? "No match. Pick a brand from the suggestions." : "Type a brand name.";
    setErrors(next);
    if (!personOption || !brandOption) return;
    const person = people.find((p) => personKey(p) === personOption.value)!;
    const brand = accounts.find((a) => a.apiKey === brandOption.value)!;
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
      <Autocomplete
        label="Sign in as"
        text={personText}
        onText={(t) => {
          setPersonText(t);
          setErrors((e) => ({ ...e, person: undefined }));
        }}
        options={personOptions}
        placeholder={loading ? "Loading…" : "Type your name, for example Maria"}
        disabled={loading || people.length === 0}
        error={errors.person}
        autoFocus
      />
      <Autocomplete
        label="Brand"
        text={brandText}
        onText={(t) => {
          setBrandText(t);
          setErrors((e) => ({ ...e, brand: undefined }));
        }}
        options={brandOptions}
        placeholder={loading ? "Loading…" : "Type a brand, for example Kestrel"}
        disabled={loading || accounts.length === 0}
        error={errors.brand}
      />
      {brands.data?.example && <p className="muted small">Example brand list: the backend has not shipped the demo-accounts list yet.</p>}
      <button type="submit" className="button" disabled={loading}>
        Sign in
      </button>
      <p className="muted small">No password: just type a name. Your choice is saved in this browser only.</p>
    </form>
  );
}
