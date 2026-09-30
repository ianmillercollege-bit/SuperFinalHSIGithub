import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/LoadState";
import PageHeader from "@/components/PageHeader";
import CompanyProfile from "@/components/screens/CompanyProfile";

export const metadata: Metadata = { title: "Company · CIRQO" };

export default function Page() {
  // useSearchParams (for ?brandId=) needs a Suspense boundary.
  return (
    <div className="stack">
      <PageHeader eyebrow="Insights" title="Company" intro="Who the company is, who runs its data, and how much it has in the catalog." />
      <Suspense fallback={<Loading what="the company profile" />}>
        <CompanyProfile />
      </Suspense>
    </div>
  );
}
