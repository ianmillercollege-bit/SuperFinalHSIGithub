import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Companies from "@/components/screens/Companies";

export const metadata: Metadata = { title: "All companies · CIRQO" };

export default function Page() {
  return (
    <div className="stack">
      <PageHeader eyebrow="CIRQO Staff" title="All companies" intro="The cross-company view: where the most escalated incidents are." />
      <Companies />
    </div>
  );
}
