import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import AssistantSimulator from "@/components/screens/AssistantSimulator";

export const metadata: Metadata = { title: "Assistant Simulator · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Insights" title="Assistant Simulator" intro="Ask a shopping question the way a shopper would, and see the verified answer CIRQO gives the assistant." />
      <AssistantSimulator />
    </main>
  );
}
