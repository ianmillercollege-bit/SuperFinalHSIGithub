"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { Empty, ErrorNotice, Loading } from "@/components/LoadState";
import { getBrands } from "@/lib/api";
import { useUserSession } from "@/lib/auth/userSession";
import { categoryLabel } from "@/lib/categories";
import { formatPercent } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const PAGE_SIZE = 25;

/** All companies = GET /brands (contract v1.4, CIRQO Staff token only), most escalated incidents first. */
export default function Companies() {
  const { user } = useUserSession();
  const [page, setPage] = useState(0);
  // Only CIRQO Staff can list companies (a guest gets a 401), so nobody else asks.
  const isStaff = Boolean(user?.staff);
  const brands = useApi(useCallback(() => (isStaff ? getBrands() : Promise.resolve({ brands: [] })), [isStaff]));
  const rows = useMemo(
    () => [...(brands.data?.brands ?? [])].sort((a, b) => b.escalatedIncidents - a.escalatedIncidents || b.openIncidents - a.openIncidents || a.brandName.localeCompare(b.brandName)),
    [brands.data],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const shown = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (!user?.staff) {
    return (
      <section className="card stack">
        <h2>Only CIRQO Staff can see all companies</h2>
        <p className="muted">Sign in with a CIRQO Staff account to open this page.</p>
      </section>
    );
  }
  if (brands.loading) return <Loading what="companies" />;
  if (brands.error !== undefined) return <ErrorNotice error={brands.error} onRetry={brands.reload} />;
  if (rows.length === 0) return <Empty>No companies yet.</Empty>;

  return (
    <section className="card stack">
      <div>
        <h2>
          Companies<span className="count">{rows.length}</span>
        </h2>
        <p className="muted small">Sorted by escalated incidents, then open incidents. Safety and legal claims are escalated.</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Opted in</th>
              <th>Categories</th>
              <th>Products</th>
              <th>Visibility</th>
              <th>Accuracy</th>
              <th>Open</th>
              <th>Escalated</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((b) => (
              <tr key={b.brandId}>
                <td>
                  <Link className="link" href={`/company?brandId=${encodeURIComponent(b.brandId)}`}>
                    {b.brandName}
                  </Link>
                </td>
                <td>{b.optedIn === undefined ? "—" : b.optedIn ? "Yes" : "No"}</td>
                <td>{b.categories.map(categoryLabel).join(", ")}</td>
                <td>{b.productCount.toLocaleString("en-US")}</td>
                <td>{formatPercent(b.visibilityRate)}</td>
                <td>{formatPercent(b.accuracyRate)}</td>
                <td>{b.openIncidents}</td>
                <td>{b.escalatedIncidents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="button-row">
          <button type="button" className="button button-secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </button>
          <span className="muted small">
            Page {page + 1} of {pages}
          </span>
          <button type="button" className="button button-secondary" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      )}
    </section>
  );
}
