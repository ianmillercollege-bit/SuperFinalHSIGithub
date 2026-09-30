import type { Metadata } from "next";
import MarketScreen from "@/components/screens/MarketScreen";

export const metadata: Metadata = { title: "Market Position · CIRQO" };

export default function Page() {
  return <MarketScreen />;
}
