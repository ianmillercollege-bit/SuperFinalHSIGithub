import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import AuditLog from "@/components/screens/AuditLog";

export const metadata: Metadata = { title: "Audit log · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Governance" title="Audit log" intro="Every automated and human action, in order." />
      <AuditLog />
    </main>
  );
}
