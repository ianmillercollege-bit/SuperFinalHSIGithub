"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect } from "react";
import BackendStatus from "@/components/BackendStatus";
import { getIncidents } from "@/lib/api";
import { onIncidentsChanged } from "@/lib/events";
import { NAV, isActive } from "@/lib/nav";
import { useBrandSession } from "@/lib/auth/brandSession";
import { BUSINESS } from "@/lib/business";
import { useApi } from "@/lib/useApi";

// Open incidents = pending_approval + escalated (contract v1.1).
async function countOpenIncidents(): Promise<number> {
  const [pending, escalated] = await Promise.all([
    getIncidents({ status: "pending_approval", limit: 100 }),
    getIncidents({ status: "escalated", limit: 100 }),
  ]);
  return pending.incidents.length + escalated.incidents.length;
}

/** 240px navy sidebar: brand, sample user chip, navigation from lib/nav.ts, data badge, backend status. */
export default function NavBar({ brand }: { brand: React.ReactNode }) {
  const pathname = usePathname();
  const session = useBrandSession();
  const brandName = session?.brandName ?? BUSINESS.name;
  const open = useApi(useCallback(() => countOpenIncidents(), []));
  const { reload } = open;
  useEffect(() => onIncidentsChanged(reload), [reload]);
  const counts = { openIncidents: open.data ?? null };

  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="sidebar-brand" aria-label="CIRQO Analytics dashboard">
        {brand}
      </Link>

      <div className="user-chip">
        <span className="user-initials" aria-hidden>
          {brandName.slice(0, 2).toUpperCase()}
        </span>
        <span className="user-text">
          <span className="user-name">{brandName}</span>
          <span className="user-meta">{session ? `${session.role} account` : "Default account"}</span>
          <Link href="/login" className="user-switch">
            Switch account
          </Link>
        </span>
      </div>

      <nav aria-label="Main" className="sidebar-groups">
        {NAV.map((group) => (
          <div key={group.title} className={`nav-group nav-group-${group.tone}`}>
            <p className="nav-group-title">{group.title}</p>
            <ul className="sidebar-nav">
              {group.items.map((item) => {
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
                        <span className="nav-count" aria-label={`${count} open`}>
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

      <BackendStatus />
    </aside>
  );
}
