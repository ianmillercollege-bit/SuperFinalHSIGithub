import type { Metadata } from "next";
import VisibilityScreen from "@/components/screens/VisibilityScreen";

export const metadata: Metadata = { title: "AI Visibility · CIRQO" };

export default function Page() {
  return <VisibilityScreen />;
}
