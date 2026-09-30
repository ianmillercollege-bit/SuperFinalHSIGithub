import type { Metadata } from "next";
import CoachRoute from "@/components/coach/CoachRoute";

export const metadata: Metadata = { title: "AI Coach · CIRQO" };

export default function Page() {
  return <CoachRoute />;
}
