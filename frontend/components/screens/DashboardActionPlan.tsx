"use client";

import { useMemo } from "react";
import ActionPlanPanel from "@/components/coach/ActionPlanPanel";
import { useBrandSession } from "@/lib/auth/brandSession";
import { useUserSession } from "@/lib/auth/userSession";
import { BUSINESS } from "@/lib/business";
import { sampleCoach } from "@/lib/coach/sampleCoach";
import { useActionPlan } from "@/lib/coach/useActionPlan";
import { buildCoachContext, coachProfileKey } from "@/lib/coachApp";

/** The dashboard's action plan: the built-in (sample) plan plus anything added from the coach. No AI refresh in sample mode. */
export default function DashboardActionPlan() {
  const { user } = useUserSession();
  const brand = useBrandSession();
  const context = useMemo(() => buildCoachContext(brand?.brandName ?? BUSINESS.name), [brand?.brandName]);
  const { plan, checks, toggle } = useActionPlan(coachProfileKey(brand?.brandId, user?.name), context, sampleCoach);
  return <ActionPlanPanel plan={plan} checks={checks} onToggle={toggle} askHref="/coach" />;
}
