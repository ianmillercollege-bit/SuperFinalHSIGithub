import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Products from "@/components/screens/Products";

export const metadata: Metadata = { title: "Products · CIRQO" };

export default function Page() {
  return (
    <div className="stack">
      <PageHeader eyebrow="Insights" title="Products" intro="The verified catalog, filtered by category." />
      <Products />
    </div>
  );
}
