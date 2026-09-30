import ThemeToggle from "@/components/ThemeToggle";

// The sign-in page stands alone: no sidebar, no dashboard. The kit's LoginView carries the one
// "Sample data" badge; the night/light switch floats in the corner.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="auth-theme">
        <ThemeToggle />
      </div>
    </>
  );
}
