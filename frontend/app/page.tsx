"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getUserSession } from "@/lib/auth/userSession";

// DECISIONS.md #29 and #32: "/" goes straight to the dashboard on a first visit; it goes to /login
// only after an explicit sign-out. This has to run in the browser because the choice is stored there.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const session = getUserSession();
    // The query string is kept, so "/?splash=1" still replays the opening splash on the page it redirects to.
    router.replace((session.signedOut ? "/login" : session.user?.partner ? "/community" : "/dashboard") + window.location.search);
  }, [router]);
  return (
    <main className="page">
      <p className="state" role="status">
        Loading…
      </p>
    </main>
  );
}
