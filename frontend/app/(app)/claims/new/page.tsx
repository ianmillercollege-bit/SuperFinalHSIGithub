import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import FileClaim from "@/components/screens/FileClaim";

export const metadata: Metadata = { title: "File a Claim · CIRQO" };

export default function Page() {
  return (
    <div className="page">
      <PageHeader eyebrow="Governance" title="File a Claim" intro="Paste what an AI assistant said. CIRQO checks every claim against verified facts and opens a claim for anything wrong." claims />
      <FileClaim />
    </div>
  );
}
