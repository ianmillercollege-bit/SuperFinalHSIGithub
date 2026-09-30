import BrandLockup from "@/components/BrandLockup";
import NavBar from "@/components/NavBar";
import SampleDataBar from "@/components/SampleDataBar";

const SIDEBAR_LOCKUP_WIDTH = 200; // 240px sidebar minus 20px padding each side

// The dashboard: sidebar, "Sample data" bar and the page. The sign-in page has its own layout.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <NavBar brand={<BrandLockup width={SIDEBAR_LOCKUP_WIDTH} />} />
      <div className="main-col">
        <SampleDataBar />
        {children}
      </div>
    </div>
  );
}
