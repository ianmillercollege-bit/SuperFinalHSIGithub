import AppShell from "@/components/AppShell";
import AppSidebar from "@/components/AppSidebar";
import RequireLogin from "@/components/RequireLogin";
import SampleDataBar from "@/components/SampleDataBar";

// The dashboard: the kit's AppFrame and Sidebar, the "Sample data" bar, then the page.
// The sign-in page has its own layout. RequireLogin sends anyone who did not come through it back to /login (decision 59).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireLogin>
      <AppShell sidebar={<AppSidebar />}>
        <SampleDataBar />
        {children}
      </AppShell>
    </RequireLogin>
  );
}
