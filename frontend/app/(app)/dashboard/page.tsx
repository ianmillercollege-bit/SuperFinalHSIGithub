import type { Metadata } from "next";
import DashboardScreen from "@/components/screens/DashboardScreen";

export const metadata: Metadata = { title: "Dashboard · CIRQO" };

export default function Page() {
  return (
    <main className="page page-wide">
      <DashboardScreen />
    </main>
  );
}
