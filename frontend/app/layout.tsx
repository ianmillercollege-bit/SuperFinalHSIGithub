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
        {/* Sets the saved (or system) theme before the first paint, so there is no flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('cirqo.theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}",
          }}
        />
        {/* Opening splash: when it has already played in this tab (or motion is reduced), hide it before the first paint so it never flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var seen=sessionStorage.getItem('cirqo:splash:v1')==='1'&&!/[?&]splash=1/.test(location.search);if(seen||matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.setAttribute('data-splash','done')}catch(e){}",
          }}
        />
      </head>
      <body>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
