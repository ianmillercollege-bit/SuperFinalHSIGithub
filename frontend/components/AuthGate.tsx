"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useUserSession } from "@/lib/auth/userSession";

/** Dashboard pages render only for a signed-in person (or a guest); everyone else goes to /login first. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { authenticated } = useUserSession();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !authenticated) {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname + window.location.search)}` : "";
      window.location.replace(`/login${next}`);
    }
  }, [mounted, authenticated, pathname]);
  if (!mounted || !authenticated) return null;
  return <>{children}</>;
}
