import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import IncidentsList from "@/components/screens/IncidentsList";

export const metadata: Metadata = { title: "Incidents · FrontDoor" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Governance" title="Incidents" intro="Every wrong claim the checker found, with its severity, owner, and status." />
      <IncidentsList />
    </main>
  );
}
