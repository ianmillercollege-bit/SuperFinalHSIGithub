import type { Metadata } from "next";
import { Suspense } from "react";
import { Loading } from "@/components/LoadState";
import LoginScreen from "@/components/screens/LoginScreen";

export const metadata: Metadata = { title: "Sign in · CIRQO" };

export default function Page() {
  // useSearchParams (for ?next=) needs a Suspense boundary.
  return (
    <Suspense fallback={<Loading what="the sign-in page" />}>
      <LoginScreen />
    </Suspense>
  );
}
