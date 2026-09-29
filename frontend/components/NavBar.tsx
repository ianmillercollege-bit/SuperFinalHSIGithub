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

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="nav">
      <Link href="/" className="brand">
        FrontDoor
      </Link>
      <nav>
        {LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={isActive(pathname, href) ? "active" : undefined}
            aria-current={isActive(pathname, href) ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {/* DECISIONS.md #12: every screen shows this badge. */}
      <span
        className="sample-badge"
        title="Everything shown is seeded or simulated demo data, not real customer results."
      >
        Sample data
      </span>
    </header>
  );
}
