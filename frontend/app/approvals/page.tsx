import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ApprovalQueue from "@/components/screens/ApprovalQueue";

export const metadata: Metadata = { title: "Approvals · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Governance" title="Human approval queue" intro="High-risk fixes wait here for a named person. Nothing here is changed automatically." />
      <ApprovalQueue />
    </main>
  );
}
