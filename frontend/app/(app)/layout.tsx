import AppFrame from "@/components/dashboard/AppFrame";
import AppSidebar from "@/components/AppSidebar";
import SampleDataBar from "@/components/SampleDataBar";

// The dashboard: the kit's AppFrame and Sidebar, the "Sample data" bar, then the page.
// The sign-in page has its own layout.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppFrame sidebar={<AppSidebar />}>
      <SampleDataBar />
      {children}
    </AppFrame>
  );
}
