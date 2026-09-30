import type { Metadata } from "next";
import CoachScreen from "@/components/screens/CoachScreen";

export const metadata: Metadata = { title: "AI Coach · CIRQO" };

export default function Page() {
  return <CoachScreen />;
}
