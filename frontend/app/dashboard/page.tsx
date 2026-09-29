import type { Metadata } from "next";
import UnderConstruction from "@/components/UnderConstruction";

export const metadata: Metadata = { title: "Business dashboard · FrontDoor" };

export default function DashboardPage() {
  return (
    <UnderConstruction
      title="Business dashboard"
      plannedData={[
        "GET /api/v1/visibility/summary",
        "GET /api/v1/metrics/trust",
        "GET /api/v1/sources",
        "GET /api/v1/answers",
        "GET /api/v1/claims",
        "GET /api/v1/incidents",
        "GET /api/v1/products",
        "GET /api/v1/report",
      ]}
    />
  );
}
