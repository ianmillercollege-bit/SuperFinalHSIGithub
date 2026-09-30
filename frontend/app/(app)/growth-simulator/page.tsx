import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/LoadState";
import GrowthSimulator from "@/components/screens/GrowthSimulator";

export const metadata: Metadata = { title: "Growth Simulator · CIRQO" };

export default function Page() {
  // useSearchParams (for ?lever=) needs a Suspense boundary.
  return (
    <Suspense fallback={<Loading what="the simulator" />}>
      <GrowthSimulator />
    </Suspense>
  );
}
