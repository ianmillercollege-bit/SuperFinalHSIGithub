import type { Metadata } from "next";
import UnderConstruction from "@/components/UnderConstruction";

export const metadata: Metadata = { title: "Shopper demo · FrontDoor" };

export default function ShopperDemoPage() {
  return (
    <UnderConstruction
      title="Shopper demo"
      plannedData={["GET /api/v1/shopper/questions", "POST /api/v1/shopper/recommend"]}
    />
  );
}
