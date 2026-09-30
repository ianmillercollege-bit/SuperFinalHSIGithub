import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import BrandLogin from "@/components/screens/BrandLogin";

export const metadata: Metadata = { title: "Switch account · CIRQO" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader
        eyebrow="Demo accounts"
        title="Choose a brand to view"
        intro="Each brand sees only its own visibility, claims and audit log. Every page also works with no account chosen (it shows Kestrel)."
      />
      <BrandLogin />
    </main>
  );
}
