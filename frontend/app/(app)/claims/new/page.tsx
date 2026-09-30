import type { Metadata } from "next";
import FileClaim from "@/components/screens/FileClaim";

export const metadata: Metadata = { title: "File a Claim · CIRQO" };

export default function Page() {
  return <FileClaim />;
}
