import type { Metadata } from "next";
import { Archivo, Public_Sans } from "next/font/google";
import BrandLockup from "@/components/BrandLockup";
import NavBar from "@/components/NavBar";
import "@/styles/tokens.css";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
});

// Variable font with the width axis, for .brand-text (width 125%), headings and numbers.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const SIDEBAR_LOCKUP_WIDTH = 200; // 240px sidebar minus 20px padding each side

export const metadata: Metadata = {
  title: "CIRQO",
  description: "CIRQO hackathon demo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} ${archivo.variable}`}>
      <body>
        <div className="shell">
          <NavBar brand={<BrandLockup width={SIDEBAR_LOCKUP_WIDTH} />} />
          <div className="main-col">{children}</div>
        </div>
      </body>
    </html>
  );
}
