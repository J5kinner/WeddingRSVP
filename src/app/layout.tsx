import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Dancing_Script } from "next/font/google";
import "./globals.css";

// Serif font for headings - modern, elegant
const cormorantGaramond = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Sans-serif font for body text - clean, readable
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

// Script font for couple's initials - elegant, timeless
const dancingScript = Dancing_Script({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Olivia & Jonah - Wedding RSVP",
  description: "Join us for our special day",
  icons: {
    icon: "/ojswoosh.webp",
    apple: "/ojswoosh.webp",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${cormorantGaramond.variable} ${inter.variable} ${dancingScript.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
