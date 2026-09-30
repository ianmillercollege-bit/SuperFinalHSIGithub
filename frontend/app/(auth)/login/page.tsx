import type { Metadata } from "next";
import BrandLockup from "@/components/BrandLockup";
import BrandLogin from "@/components/screens/BrandLogin";
import SampleSignIn from "@/components/screens/SampleSignIn";

export const metadata: Metadata = { title: "Sign in · CIRQO" };

export default function Page() {
  return (
    <main className="auth-main">
      <section className="auth-panel" aria-label="About CIRQO">
        <BrandLockup width={240} />
        <h1 className="auth-headline">Know what AI tells shoppers about your business.</h1>
        <p className="auth-sub">See how assistants describe your products, fix what they get wrong, and prove it over time.</p>
      </section>
      <section className="auth-form">
        <div className="card stack auth-card">
          <SampleSignIn />
          <section className="stack" aria-labelledby="brand-title">
            <h2 id="brand-title">Brand</h2>
            <BrandLogin />
          </section>
        </div>
      </section>
    </main>
  );
}
