import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ClaimsReviewed from "@/components/screens/ClaimsReviewed";

export const metadata: Metadata = { title: "Claims Reviewed · CIRQO" };

export default function Page() {
  return (
    <div className="page">
      <PageHeader eyebrow="Governance" title="Claims Reviewed" intro="Decided claims and the full Insights log of every action." claims />
      <ClaimsReviewed />
    </div>
  );
}
