import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import CommunityRequests from "@/components/screens/CommunityRequests";

export const metadata: Metadata = { title: "Community requests · CIRQO" };

export default function Page() {
  return (
    <div className="stack">
      <PageHeader eyebrow="Community" title="Community requests" intro="Requests for pledged units, and the decision on each." />
      <CommunityRequests />
    </div>
  );
}
