import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import InventoryView from "@/components/screens/InventoryView";

export const metadata: Metadata = { title: "Inventory · CIRQO" };

export default function Page() {
  return (
    <div className="stack">
      <PageHeader eyebrow="Monitor" title="Inventory" intro="The verified catalog: your products, their stock and prices. Changes go straight in, and AI answers are checked against them." />
      <InventoryView />
    </div>
  );
}
