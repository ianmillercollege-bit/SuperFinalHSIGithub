import type { Metadata } from "next";
import { Archivo, Public_Sans } from "next/font/google";
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


export const metadata: Metadata = {
  title: "CIRQO",
  description: "CIRQO hackathon demo",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${publicSans.variable} ${archivo.variable}`}>
      <body>
        {children}
      </body>
    </html>
  );
}
