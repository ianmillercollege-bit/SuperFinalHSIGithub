import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import ShopperDemo from "@/components/screens/ShopperDemo";

export const metadata: Metadata = { title: "Shopper demo · FrontDoor" };

export default function Page() {
  return (
    <main className="page">
      <PageHeader eyebrow="Shopper demo" title="Find the right laptop" intro="A shopper's question, answered with a neutral, fact-checked recommendation." />
      <ShopperDemo />
    </main>
  );
}
