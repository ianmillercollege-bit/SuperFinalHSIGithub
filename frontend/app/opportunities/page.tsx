import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = { title: "Opportunity Gaps · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Insights" title="Opportunity Gaps" />
    </main>
  );
}
