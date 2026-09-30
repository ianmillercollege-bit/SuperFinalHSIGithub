import { redirect } from "next/navigation";

// Products and Inventory were one catalog shown twice; the Inventory page now holds both. Old links land there.
export default function Page() {
  redirect("/inventory");
}
