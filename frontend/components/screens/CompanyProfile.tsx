"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ErrorNotice, Loading } from "@/components/LoadState";
import { ApiError, getBrand } from "@/lib/api";
import { useBrandSession } from "@/lib/auth/brandSession";
import { BUSINESS } from "@/lib/business";
import { categoryLabel } from "@/lib/categories";
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
            <Link className="link" href="/products">
              See the catalog
            </Link>
          </dd>
          {p.plan && (
            <>
              <dt>Plan</dt>
              <dd>{PLAN_LABELS[p.plan]}</dd>
            </>
          )}
        </dl>
      </section>
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
