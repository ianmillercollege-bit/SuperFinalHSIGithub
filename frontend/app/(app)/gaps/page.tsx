import type { Metadata } from "next";
import GapsScreen from "@/components/screens/GapsScreen";

export const metadata: Metadata = { title: "Opportunity Gaps · CIRQO" };

export default function Page() {
  return <GapsScreen />;
}
