import type { Metadata } from "next";
import UnderConstruction from "@/components/UnderConstruction";

export const metadata: Metadata = { title: "Approval queue · FrontDoor" };

export default function ApprovalsPage() {
  return (
    <UnderConstruction
      title="Human approval queue"
      plannedData={[
        "GET /api/v1/incidents?status=pending_approval",
        "GET /api/v1/incidents/{incidentId}",
        "POST /api/v1/incidents/{incidentId}/approve | reject | resolve",
        "GET /api/v1/owners",
        "GET /api/v1/audit",
      ]}
    />
  );
}
