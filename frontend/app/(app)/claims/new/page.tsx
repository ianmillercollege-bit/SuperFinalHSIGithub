import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/LoadState";
import FileClaim from "@/components/screens/FileClaim";

export const metadata: Metadata = { title: "File a Claim · CIRQO" };

export default function Page() {
  return (
    <Suspense fallback={<Loading what="the form" />}>
      <FileClaim />
    </Suspense>
  );
}
