import SampleDataBar from "@/components/SampleDataBar";

// The sign-in page stands alone: no sidebar, no dashboard. It still shows the "Sample data" bar.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <SampleDataBar />
      {children}
    </div>
  );
}
