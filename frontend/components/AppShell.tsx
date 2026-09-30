"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AppFrame from "@/components/dashboard/AppFrame";

/** The kit's AppFrame around every dashboard page. Claims pages get its orange top edge (the `claims` prop). */
export default function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <AppFrame claims={pathname === "/claims" || pathname.startsWith("/claims/")} sidebar={sidebar}>
      {children}
    </AppFrame>
  );
}
