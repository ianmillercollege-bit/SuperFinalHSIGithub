"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import type { NavGroup as KitNavGroup } from "@/components/dashboard/Sidebar";
import { API_URL, checkHealth, getIncidents } from "@/lib/api";
import { signOutBrand, useBrandSession } from "@/lib/auth/brandSession";
import { forgetLogin } from "@/lib/auth/signIn";
import { signOutUser, useUserSession } from "@/lib/auth/userSession";
import { BUSINESS } from "@/lib/business";
import { onIncidentsChanged } from "@/lib/events";
import { buildNavGroups } from "@/lib/nav";
import { PROFILE_KEY, useProfileDefaults } from "@/lib/profile/defaults";
import { defaultProfile } from "@/lib/profile/types";
import { useSidebarUser } from "@/lib/profile/useProfile";
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
  // The user chip shows the saved profile (this device only) and links to /profile.
  const chip = useSidebarUser(PROFILE_KEY, defaultProfile(useProfileDefaults()));
  const open = useApi(useCallback(() => countOpenIncidents(), []));
  const { reload } = open;
  useEffect(() => onIncidentsChanged(reload), [reload]);

  // Signed out means no company either: clear a company left over from an earlier sign-in (it kept showing after "Sign out").
  useEffect(() => {
    if (!user && brand) signOutBrand();
  }, [user, brand]);

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

  // The one navigation definition is the kit's lib/nav.ts; only the routes are ours.
  const groups: KitNavGroup[] = buildNavGroups(
    {
      dashboard: "/dashboard", visibility: "/visibility", market: "/market",
      gaps: "/gaps", simulator: "/growth-simulator", coach: "/coach",
      fileClaim: "/claims/new", outstanding: "/claims/outstanding", reviewed: "/claims/reviewed",
    },
    open.data,
  );

  // With nobody signed in there is no Sign out button, so the sidebar offers the way back to the sign-in page.
  if (!user) groups.push({ title: "Account", tone: "default", items: [{ label: "Sign in", href: "/login" }] });

  const backend = !API_URL
    ? { state: "notConfigured" as const, label: "Backend: not set" }
    : health === "checking"
      ? { state: "waking" as const, label: "Backend: checking…" }
      : { state: health, label: `Backend: ${health}` };

  return (
    <Sidebar
      groups={groups}
      user={user ? chip : { name: "Signed out", role: "Guest", business: brand?.brandName ?? BUSINESS.name }}
      profileHref={user ? "/profile" : undefined}
      backend={backend}
      // Sign out exists (decision 32): it marks the browser signed out and opens the sign-in page.
      onSignOut={
        user
          ? () => {
              forgetLogin();
              signOutBrand();
              signOutUser();
              router.push("/login");
            }
          : undefined
      }
    />
  );
}
