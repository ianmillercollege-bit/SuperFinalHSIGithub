"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Shopper demo" },
  { href: "/dashboard", label: "Business dashboard" },
  { href: "/approvals", label: "Approvals" },
];

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
            className={pathname === href ? "active" : undefined}
            aria-current={pathname === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
