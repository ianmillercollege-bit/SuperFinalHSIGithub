import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BackendStatus from "@/components/BackendStatus";
import NavBar from "@/components/NavBar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FrontDoor",
  description: "FrontDoor hackathon demo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <NavBar />
        {children}
        <BackendStatus />
      </body>
    </html>
  );
}
