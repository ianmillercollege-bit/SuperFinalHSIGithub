import AppShell from "@/components/AppShell";
import AppSidebar from "@/components/AppSidebar";
import SampleDataBar from "@/components/SampleDataBar";

// The dashboard: the kit's AppFrame and Sidebar, the "Sample data" bar, then the page.
// The sign-in page has its own layout.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell sidebar={<AppSidebar />}>
      <SampleDataBar />
      {children}
    </AppShell>
  );
}
