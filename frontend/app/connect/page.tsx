import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ConnectCatalog from "@/components/screens/ConnectCatalog";

export const metadata: Metadata = { title: "Connect your catalog · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader
        eyebrow="Setup"
        title="Connect your catalog"
        intro="Tell CIRQO about your brand and products. AI assistants can then get verified answers about them from the connector."
      />
      <ConnectCatalog />
    </main>
  );
}
