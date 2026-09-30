import type { Metadata } from "next";
import DashboardScreen from "@/components/screens/DashboardScreen";

export const metadata: Metadata = { title: "Dashboard · CIRQO" };

export default function Page() {
  return (
    <div className="page page-wide">
      <DashboardScreen />
    </div>
  );
}
