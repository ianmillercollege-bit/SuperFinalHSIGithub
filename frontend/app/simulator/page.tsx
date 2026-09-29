import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { SimulatorScreen } from "@/components/screens/Growth";

export const metadata: Metadata = { title: "Growth Simulator · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader
        eyebrow="Insights · frontend sample business"
        title="Growth Simulator"
        intro="A what-if view for one sample small business, built on frontend-only sample data."
      />
      <SimulatorScreen />
    </main>
  );
}
