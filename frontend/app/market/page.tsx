import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import MarketPosition from "@/components/screens/MarketPosition";

export const metadata: Metadata = { title: "Market Position · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Insights" title="Market Position" intro="How your brand's share of AI answers compares with competitors." />
      <MarketPosition />
    </main>
  );
}
