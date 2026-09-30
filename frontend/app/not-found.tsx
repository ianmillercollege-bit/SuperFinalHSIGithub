import Link from "next/link";
import SampleDataBar from "@/components/SampleDataBar";

// The 404 page sits outside the dashboard and sign-in layouts, so it carries the "Sample data" bar itself.
export default function NotFound() {
  return (
    <>
      <SampleDataBar />
      <main className="page">
        <h1>Page not found</h1>
        <p className="muted">That address doesn&apos;t match a CIRQO page.</p>
        <p>
          <Link className="button" href="/dashboard">
            Go to the dashboard
          </Link>
        </p>
      </main>
    </>
  );
}
