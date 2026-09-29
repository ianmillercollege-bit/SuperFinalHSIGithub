"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";
import BackendStatus from "@/components/BackendStatus";
import { claimsGateway } from "@/lib/claims/gateway";
import { outstandingCount } from "@/lib/claims/selectors";
import { NAV, isActive } from "@/lib/nav";
import { useApi } from "@/lib/useApi";
import { initialsOf, sampleUser } from "@/lib/sample/sampleUser";

/** 240px navy sidebar: brand, user chip, navigation from lib/nav.ts, data badge, backend status. */
export default function NavBar({ brand }: { brand: React.ReactNode }) {
  const pathname = usePathname();
  const claims = useApi(useCallback(() => claimsGateway.listClaims(), []));
  const { reload } = claims;
  useEffect(() => claimsGateway.subscribe(reload), [reload]);
  const counts = { outstandingClaims: claims.data ? outstandingCount(claims.data) : null };

  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="sidebar-brand" aria-label="CIRQO Analytics dashboard">
        {brand}
      </Link>

      <div className="user-chip">
        <span className="user-initials" aria-hidden>
          {initialsOf(sampleUser.name)}
        </span>
        <span className="user-text">
          <span className="user-name">{sampleUser.name}</span>
          <span className="user-meta">
            {sampleUser.role} · {sampleUser.business}
          </span>
        </span>
      </div>
      <button
        type="button"
        className="sign-out"
        disabled
        title="Sign-in isn't part of this demo yet."
      >
        Sign out <span className="soon-tag">Soon</span>
      </button>

      <nav aria-label="Main" className="sidebar-groups">
        {NAV.map((group) => (
          <div key={group.title} className={`nav-group nav-group-${group.tone}`}>
            <p className="nav-group-title">{group.title}</p>
            <ul className="sidebar-nav">
              {group.items.map((item) => {
                if (!("href" in item)) {
                  return (
                    <li key={item.label}>
                      <span className="nav-disabled" aria-disabled="true">
                        {item.label} <span className="soon-tag">Soon</span>
                      </span>
                    </li>
                  );
                }
                const active = isActive(pathname, item.href);
                const count = item.count ? counts[item.count] : null;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={active ? "active" : undefined}
                      aria-current={active ? "page" : undefined}
                    >
                      {item.label}
                      {count !== null && (
                        <span className="nav-count" aria-label={`${count} outstanding`}>
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* DECISIONS.md #12: every screen shows this badge. */}
      <span
        className="sample-badge"
        title="Everything shown is seeded or simulated demo data, not real customer results."
      >
        Sample data
      </span>

      <BackendStatus />
    </aside>
  );
}
