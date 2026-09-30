"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import type { NavGroup as KitNavGroup } from "@/components/dashboard/Sidebar";
import { API_URL, checkHealth, getIncidents } from "@/lib/api";
import { useBrandSession } from "@/lib/auth/brandSession";
import { forgetLogin } from "@/lib/auth/signIn";
import { signOutUser, useUserSession } from "@/lib/auth/userSession";
import { BUSINESS } from "@/lib/business";
import { onIncidentsChanged } from "@/lib/events";
import { NAV } from "@/lib/nav";
import { useApi } from "@/lib/useApi";

// Open incidents = pending_approval + escalated (contract v1.1).
async function countOpenIncidents(): Promise<number> {
  const [pending, escalated] = await Promise.all([
    getIncidents({ status: "pending_approval", limit: 100 }),
    getIncidents({ status: "escalated", limit: 100 }),
  ]);
  return pending.incidents.length + escalated.incidents.length;
}

type Health = "checking" | "online" | "offline";

/** The kit's Sidebar, fed by lib/nav.ts, the sample sign-in session, lib/business.ts and the health check. */
export default function AppSidebar() {
  const router = useRouter();
  const brand = useBrandSession();
  const { user } = useUserSession();
  const open = useApi(useCallback(() => countOpenIncidents(), []));
  const { reload } = open;
  useEffect(() => onIncidentsChanged(reload), [reload]);

  const [health, setHealth] = useState<Health>("checking");
  useEffect(() => {
    let cancelled = false;
    checkHealth().then((ok) => {
      if (!cancelled) setHealth(ok ? "online" : "offline");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups: KitNavGroup[] = NAV.map((group) => ({
    title: group.title,
    tone: group.tone,
    items: group.items.map((item) => ({
      label: item.label,
      href: item.href,
      ...(item.count === "openIncidents" && open.data !== undefined ? { badge: open.data } : {}),
    })),
  }));

  const backend = !API_URL
    ? { state: "notConfigured" as const, label: "Backend: not set" }
    : health === "checking"
      ? { state: "waking" as const, label: "Backend: checking…" }
      : { state: health, label: `Backend: ${health}` };

  return (
    <Sidebar
      groups={groups}
      user={{
        name: user ? user.name : "Signed out",
        // A backend login shows the user's real role; the local sample check keeps its label (decision 32).
        role: user
          ? user.backend
            ? user.title ?? (user.role === "owner" ? "Owner" : "Viewer")
            : `${user.title?.split(" · ")[0] ?? (user.role === "owner" ? "Owner" : "Viewer")} (sample sign-in)`
          : "Guest",
        business: brand?.brandName ?? BUSINESS.name,
      }}
      backend={backend}
      // Sign out exists (decision 32): it marks the browser signed out and opens the sign-in page.
      onSignOut={
        user
          ? () => {
              forgetLogin();
              signOutUser();
              router.push("/login");
            }
          : undefined
      }
    />
  );
}
