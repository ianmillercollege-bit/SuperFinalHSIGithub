import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import BrandLogin from "@/components/screens/BrandLogin";
import SampleSignIn from "@/components/screens/SampleSignIn";

export const metadata: Metadata = { title: "Sign in · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader
        eyebrow="Sample sign-in"
        title="Sign in"
        intro="Pick who you are. Every page also works without signing in."
      />
      <SampleSignIn />
      <section className="stack" aria-labelledby="brand-title">
        <h2 id="brand-title">Brand</h2>
        <BrandLogin />
      </section>
    </main>
  );
}
