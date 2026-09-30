import type { Metadata } from "next";
import AssistantSimulator from "@/components/screens/AssistantSimulator";

export const metadata: Metadata = { title: "Preview as shopper · CIRQO" };

export default function Page() {
  return <AssistantSimulator />;
}
