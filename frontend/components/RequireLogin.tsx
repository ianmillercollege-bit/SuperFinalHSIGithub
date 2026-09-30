"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { hasEntered } from "@/lib/auth/entry";

/**
 * Wraps every dashboard page (decision 59). Renders nothing until the browser confirms this tab came
 * through the sign-in page; otherwise it goes to /login and comes back to the same page afterwards.
 */
export default function RequireLogin({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (hasEntered()) {
      setAllowed(true);
      return;
    }
    const next = pathname && pathname !== "/dashboard" ? `?next=${encodeURIComponent(pathname)}` : "";
    router.replace(`/login${next}`);
  }, [pathname, router]);

  if (!allowed) {
    return (
      <main className="page">
        <p className="state" role="status">
          Loading…
        </p>
      </main>
    );
  }
  return <>{children}</>;
}
