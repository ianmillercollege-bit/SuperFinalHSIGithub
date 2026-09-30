import type { Metadata } from "next";
import AssistantSimulator from "@/components/screens/AssistantSimulator";

export const metadata: Metadata = { title: "Assistant Simulator · CIRQO" };

export default function Page() {
  return <AssistantSimulator />;
}
