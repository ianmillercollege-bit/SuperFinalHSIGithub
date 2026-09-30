"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import SplashScreen from "@/components/brand/SplashScreen";
import AppFrame from "@/components/dashboard/AppFrame";

/**
 * The kit's AppFrame around every dashboard page. Claims pages get its orange top edge (the `claims` prop).
 * The opening splash is rendered here, so it plays only for the signed-in app and never on /login.
 */
export default function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <SplashScreen />
      <AppFrame claims={pathname === "/claims" || pathname.startsWith("/claims/")} sidebar={sidebar}>
        {children}
      </AppFrame>
    </>
  );
}
