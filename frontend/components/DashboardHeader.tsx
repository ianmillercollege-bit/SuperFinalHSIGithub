"use client";

import PageHeader from "@/components/PageHeader";
import { useBrandSession } from "@/lib/auth/brandSession";
import { BUSINESS } from "@/lib/business";

/** The dashboard greeting names the chosen brand (Kestrel when no account is chosen). */
export default function DashboardHeader() {
  const session = useBrandSession();
  return (
    <PageHeader
      eyebrow="Business dashboard"
      title={`Welcome back, ${session?.brandName ?? BUSINESS.shortName}`}
      intro="How accurately AI describes you: accuracy, hallucinations, and visibility across tracked AI answers."
    />
  );
}
