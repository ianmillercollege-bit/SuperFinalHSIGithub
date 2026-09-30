import type { Metadata } from "next";
import DashboardHeader from "@/components/DashboardHeader";
import TrustDashboard from "@/components/screens/TrustDashboard";

export const metadata: Metadata = { title: "Trust dashboard · CIRQO" };

export default function Page() {
  return (
    <main className="page page-wide">
      <DashboardHeader />
      <TrustDashboard />
    </main>
  );
}
