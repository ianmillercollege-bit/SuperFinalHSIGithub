"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { hasEntered } from "@/lib/auth/entry";
import { getUserSession, isSignedIn } from "@/lib/auth/userSession";

// DECISIONS.md #58 and #59: "/" opens the sign-in page unless this tab already signed in with an account;
// then it goes to the dashboard. A guest sees the sign-in page again, with the guest link on it. This has to run in the browser because the choice is stored there.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const session = getUserSession();
    // The query string is kept, so "/?splash=1" still replays the opening splash on the page it redirects to.
    router.replace((hasEntered() && isSignedIn(session) ? "/dashboard" : "/login") + window.location.search);
  }, [router]);
  return (
    <main className="page">
      <p className="state" role="status">
        Loading…
      </p>
    </main>
  );
}
