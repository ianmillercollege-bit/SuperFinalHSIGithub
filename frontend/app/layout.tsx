import type { Metadata } from "next";
import { Archivo, Public_Sans } from "next/font/google";
import SplashScreen from "@/components/brand/SplashScreen";
import "@/styles/tokens.css";
import "./globals.css";
import "@/styles/cirqo-dashboard.css";
import "@/styles/cirqo-screens.css";
import "@/styles/cirqo-coach.css";
import "@/styles/cirqo-profile.css";
import "@/styles/cirqo-splash.css";
import "@/styles/cirqo-overrides.css";

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


export const metadata: Metadata = {
  title: "CIRQO",
  description: "CIRQO hackathon demo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} ${archivo.variable}`} suppressHydrationWarning>
      <head>
        {/* A small blocking script that runs before the first paint: it sets the saved theme and hides the opening splash when it has already played. */}
        <script src="/cirqo-init.js" />
      </head>
      <body>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
