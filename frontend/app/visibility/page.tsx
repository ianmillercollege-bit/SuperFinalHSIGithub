import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import AiVisibility from "@/components/screens/AiVisibility";

export const metadata: Metadata = { title: "AI Visibility · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Insights" title="AI Visibility" intro="How often AI assistants name your brand, where you rank, and the answers they gave." />
      <AiVisibility />
    </main>
  );
}
