import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import TrustDashboard from "@/components/screens/TrustDashboard";

export const metadata: Metadata = { title: "Trust dashboard · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Business dashboard" title="How accurately AI describes you" intro="Accuracy, hallucinations, and visibility across tracked AI answers." />
      <TrustDashboard />
    </main>
  );
}
