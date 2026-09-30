import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import CommunityCatalog from "@/components/screens/CommunityCatalog";

export const metadata: Metadata = { title: "Community catalog · CIRQO" };

export default function Page() {
  return (
    <div className="stack">
      <PageHeader eyebrow="Community" title="Community catalog" intro="Surplus and refurbished units companies have pledged to schools, veterans groups and nonprofits." />
      <CommunityCatalog />
    </div>
  );
}
