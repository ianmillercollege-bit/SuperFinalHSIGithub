import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Growth from "@/components/screens/Growth";

export const metadata: Metadata = { title: "Growth · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Extra · frontend sample business" title="Growth potential" intro="A what-if view for one sample small business, built on frontend-only sample data." />
      <Growth />
    </main>
  );
}
