import type { Metadata } from "next";
import ClaimsReviewed from "@/components/screens/ClaimsReviewed";

export const metadata: Metadata = { title: "Claims Reviewed · CIRQO" };

export default function Page() {
  return <ClaimsReviewed />;
}
