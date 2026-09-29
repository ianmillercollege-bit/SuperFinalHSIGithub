import type { Metadata } from "next";
import { BUSINESS } from "@/lib/business";
import PageHeader from "@/components/PageHeader";
import TrustDashboard from "@/components/screens/TrustDashboard";

export const metadata: Metadata = { title: "Trust dashboard · CIRQO" };

export default function Page() {
  return (
    <main className="page page-wide">
      <PageHeader eyebrow="Business dashboard" title={`Welcome back, ${BUSINESS.shortName}`} intro="How accurately AI describes you: accuracy, hallucinations, and visibility across tracked AI answers." />
      <TrustDashboard />
    </main>
  );
}
