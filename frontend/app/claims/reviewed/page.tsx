import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = { title: "Claims Reviewed · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Governance" title="Claims Reviewed" claims />
    </main>
  );
}
