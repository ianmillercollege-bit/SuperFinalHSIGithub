import type { Metadata } from "next";
import ProfileScreen from "@/components/screens/ProfileScreen";

export const metadata: Metadata = { title: "Profile · CIRQO" };

export default function Page() {
  return <ProfileScreen />;
}
