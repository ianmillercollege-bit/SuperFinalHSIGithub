import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import { CoachScreen } from "@/components/screens/Growth";

export const metadata: Metadata = { title: "AI Coach · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader
        eyebrow="Insights · frontend sample business"
        title="AI Coach"
        intro="Ask about AI visibility for one sample small business. Answers are pre-written demo answers."
      />
      <CoachScreen />
    </main>
  );
}
