import type { Metadata } from "next";
import Coach from "@/components/screens/Coach";

export const metadata: Metadata = { title: "AI Coach · CIRQO" };

export default function Page() {
  return <Coach />;
}
