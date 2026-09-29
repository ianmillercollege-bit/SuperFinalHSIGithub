import type { Metadata } from "next";
import IncidentDetail from "@/components/screens/IncidentDetail";

export const metadata: Metadata = { title: "Incident · FrontDoor" };

export default async function Page({ params }: PageProps<"/incidents/[id]">) {
  const { id } = await params;
  return (
    <main className="page">
      <IncidentDetail incidentId={id} />
    </main>
  );
}
