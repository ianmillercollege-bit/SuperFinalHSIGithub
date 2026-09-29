import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = { title: "File a Claim · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Governance" title="File a Claim" claims />
    </main>
  );
}
