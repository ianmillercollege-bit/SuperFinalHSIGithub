"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import { ApiError, claimCompany, getBrand } from "@/lib/api";
import { signInAs, useBrandSession } from "@/lib/auth/brandSession";
import { BUSINESS } from "@/lib/business";
import { categoryLabel } from "@/lib/categories";
import { describeError } from "@/lib/errors";
import type { ClaimCompanyResponse } from "@/lib/types";
import { useApi } from "@/lib/useApi";

const PLAN_LABELS = { starter: "Starter", growth: "Growth", enterprise: "Enterprise" } as const;

/** Company = GET /brands/{brandId} (contract v1.4): the signed-in company, or ?brandId= for another one. */
export default function CompanyProfile() {
  const brand = useBrandSession();
  const brandId = useSearchParams().get("brandId") ?? brand?.brandId ?? BUSINESS.id;
  const profile = useApi(useCallback(() => getBrand(brandId), [brandId]));

  if (profile.loading) return <Loading what="the company profile" />;
  if (profile.error instanceof ApiError && profile.error.code === "NOT_FOUND") {
    return (
      <section className="card stack">
        <h2>Company profile isn&apos;t available yet</h2>
        <p className="muted">
          The backend doesn&apos;t have the company profile endpoint (GET /brands/{brandId}) yet, so there is nothing to show. It will
          appear here as soon as the backend ships it.
        </p>
      </section>
    );
  }
  if (profile.error !== undefined) return <ErrorNotice error={profile.error} onRetry={profile.reload} />;
  const p = profile.data!;

  return (
    <div className="stack">
      <section className="card stack">
        <div>
          <p className="eyebrow">{p.categories.map(categoryLabel).join(" · ")}</p>
          <h2>{p.brandName}</h2>
          <p className="muted">{p.tagline}</p>
        </div>
        <dl className="facts">
          <dt>Headquarters</dt>
          <dd>{p.hqCity}</dd>
          <dt>Founded</dt>
          <dd>{p.founded}</dd>
          <dt>Employees</dt>
          <dd>{p.employees.toLocaleString("en-US")}</dd>
          <dt>CEO</dt>
          <dd>{p.ceo.name}</dd>
          <dt>Website</dt>
          <dd>{p.website}</dd>
          <dt>Products</dt>
          <dd>
            {p.productCount.toLocaleString("en-US")}{" "}
            <Link className="link" href="/inventory">
              See the catalog
            </Link>
          </dd>
          <dt>Status</dt>
          <dd>{p.optedIn === false ? "Not opted in: products come from public listings and are not CIRQO Verified" : "Opted in: CIRQO Verified"}</dd>
          {p.plan && (
            <>
              <dt>Plan</dt>
              <dd>{PLAN_LABELS[p.plan]}</dd>
            </>
          )}
        </dl>
      </section>
      {p.optedIn === false && <ClaimCompany brandId={p.brandId} brandName={p.brandName} onDone={profile.reload} />}
      <section className="card stack">
        <h2>Admins</h2>
        <p className="muted small">The people who own this company&apos;s data and can approve fixes.</p>
        <ul className="queue">
          {p.admins.map((a) => (
            <li key={a.userId} className="queue-item">
              <strong>{a.name}</strong>
              <span className="muted small">{a.role}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/**
 * "Claim this company" (contract v1.5, section 7d): a not-opted-in company opts in. The backend then makes a Brand Data
 * Owner, verifies every product, and returns the same shape as onboarding. 409 means it is already opted in.
 */
function ClaimCompany({ brandId, brandName, onDone }: { brandId: string; brandName: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState("");
  const [sending, setSending] = useState(false);
  const [claimed, setClaimed] = useState<ClaimCompanyResponse | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ownerName.trim()) return setProblem("Enter the owner's name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setProblem("Enter a valid email address.");
    setProblem("");
    setSending(true);
    try {
      setClaimed(await claimCompany(brandId, { ownerName: ownerName.trim(), email: email.trim() }));
    } catch (error) {
      if (error instanceof ApiError && error.code === "CONFLICT") setProblem(`${brandName} has already been claimed.`);
      else if (error instanceof ApiError && error.code === "NOT_FOUND") setProblem("Claiming isn't available on the backend yet, so nothing was changed.");
      else setProblem(describeError(error));
    } finally {
      setSending(false);
    }
  }

  if (claimed) {
    return (
      <section className="card stack" aria-live="polite">
        <h2>{claimed.brandName} is now opted in</h2>
        <p>
          Its {claimed.productsCreated.toLocaleString("en-US")} products are CIRQO Verified, and {ownerName.trim()} is the Brand Data Owner.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="button"
            onClick={() => {
              signInAs({ brandId: claimed.brandId, brandName: claimed.brandName, role: "owner", apiKey: claimed.apiKey });
              window.location.assign("/dashboard");
            }}
          >
            Sign in as this company
          </button>
          <button type="button" className="button button-secondary" onClick={onDone}>
            Refresh this page
          </button>
        </div>
        <p className="muted small">{claimed.note}</p>
      </section>
    );
  }

  return (
    <section className="card stack">
      <h2>Is this your company?</h2>
      <p className="muted">
        {brandName} isn&apos;t opted in yet, so AI assistants show its products as &quot;not CIRQO Verified&quot;. Claim it to verify your products and get the
        dashboard.
      </p>
      {!open ? (
        <div>
          <button type="button" className="button" onClick={() => setOpen(true)}>
            Claim this company
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <div className="constraints-grid">
            <label className="field">
              Owner name
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} autoComplete="name" />
            </label>
            <label className="field">
              Work email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
          </div>
          {problem && (
            <p className="state-error" role="alert">
              {problem}
            </p>
          )}
          <div className="button-row">
            <button type="submit" className="button" disabled={sending}>
              {sending ? "Claiming…" : "Claim this company"}
            </button>
            <button type="button" className="button button-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
