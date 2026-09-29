import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { CoachScreen } from "@/components/screens/Growth";

export const metadata: Metadata = { title: "AI Coach · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader
        eyebrow="Insights · sample data"
        title="AI Coach"
        intro="Ask about AI visibility for the sample brand. Demo: pre-written answers, not a live AI."
      />
      <CoachScreen />
    </main>
  );
}
