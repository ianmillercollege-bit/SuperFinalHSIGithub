"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Shopper demo" },
  { href: "/dashboard", label: "Trust dashboard" },
  { href: "/incidents", label: "Incidents" },
  { href: "/approvals", label: "Approvals" },
  { href: "/audit", label: "Audit log" },
  { href: "/growth", label: "Growth (extra)" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Left sidebar: brand, navigation, and the "Sample data" badge. */
export default function NavBar({ brand }: { brand: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <Link href="/" className="sidebar-brand" aria-label="CIRQO Analytics home">
        {brand}
      </Link>
      <nav aria-label="Main">
        <ul className="sidebar-nav">
          {LINKS.map(({ href, label }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {/* DECISIONS.md #12: every screen shows this badge. */}
      <span
        className="sample-badge"
        title="Everything shown is seeded or simulated demo data, not real customer results."
      >
        Sample data
      </span>
    </aside>
  );
}
