"use client";

import { useMemo } from "react";
import CoachPage from "@/components/coach/CoachPage";
import { useBrandSession } from "@/lib/auth/brandSession";
import { useUserSession } from "@/lib/auth/userSession";
import { BUSINESS } from "@/lib/business";
import { buildCoachContext, coachProfileKey } from "@/lib/coachApp";

/** /coach: the kit's coach in sample mode. It gives pre-written answers built from the dashboard's sample numbers, and says so. */
export default function CoachScreen() {
  const { user } = useUserSession();
  const brand = useBrandSession();
  const businessName = brand?.brandName ?? BUSINESS.name;
  const context = useMemo(() => buildCoachContext(businessName), [businessName]);
  return (
    <CoachPage
      mode="sample"
      profileKey={coachProfileKey(brand?.brandId, user?.name)}
      firstName={user && user.role === "owner" ? user.name.split(/\s+/)[0] : "there"}
      businessName={businessName}
      context={context}
      planHref="/dashboard"
    />
  );
}
