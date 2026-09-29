import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = { title: "Outstanding Claims · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Governance" title="Outstanding Claims" claims />
    </main>
  );
}
