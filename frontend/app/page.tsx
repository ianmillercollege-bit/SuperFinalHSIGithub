"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getUserSession } from "@/lib/auth/userSession";

// "/" goes to /login unless someone is already signed in (or chose guest); the choice is stored in the browser.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const session = getUserSession();
    // The query string is kept, so "/?splash=1" still replays the opening splash on the page it redirects to.
    router.replace((session.authenticated ? "/dashboard" : "/login") + window.location.search);
  }, [router]);
  return (
    <main className="page">
      <p className="state" role="status">
        Loading…
      </p>
    </main>
  );
}
