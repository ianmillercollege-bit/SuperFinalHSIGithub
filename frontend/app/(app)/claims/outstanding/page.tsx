import type { Metadata } from "next";
import ApprovalQueue from "@/components/screens/ApprovalQueue";

export const metadata: Metadata = { title: "Outstanding Claims · CIRQO" };

export default function Page() {
  return <ApprovalQueue />;
}
