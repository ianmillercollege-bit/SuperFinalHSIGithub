import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ApprovalQueue from "@/components/screens/ApprovalQueue";

export const metadata: Metadata = { title: "Outstanding Claims · CIRQO" };

export default function Page() {
  return (
    <div className="page">
      <PageHeader eyebrow="Governance" title="Outstanding Claims" intro="Claims waiting for a named person: high-risk fixes to approve or reject, and escalated safety or legal claims to resolve." claims />
      <ApprovalQueue />
    </div>
  );
}
