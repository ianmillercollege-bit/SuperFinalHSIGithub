import type { Metadata } from "next";
import { Geist } from "next/font/google";
import BackendStatus from "@/components/BackendStatus";
import NavBar from "@/components/NavBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FrontDoor",
  description: "FrontDoor hackathon demo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>
        <NavBar />
        {children}
        <BackendStatus />
      </body>
    </html>
  );
}
