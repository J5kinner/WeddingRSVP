import type { Metadata } from "next";
import { Cormorant, Inter } from "next/font/google";
import "./globals.css";

// Serif font for headings - modern, elegant
const cormorant = Cormorant({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

// Sans-serif font for body text - clean, readable
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Olivia & Jonah - Wedding RSVP",
  description: "Join us for our special day",
  metadataBase: new URL('https://oliviaandjonah.xyz'),
  icons: {
    icon: "/Favicon.svg",
    apple: "/Favicon.svg",
  },
  openGraph: {
    title: "Olivia & Jonah - Wedding RSVP",
    description: "Join us for our special day on May 18th, 2026",
    url: "https://oliviaandjonah.xyz",
    siteName: "Olivia & Jonah Wedding",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Olivia & Jonah Wedding Invitation",
      },
    ],
    locale: "en_AU",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Olivia & Jonah - Wedding RSVP",
    description: "Join us for our special day on May 18th, 2026",
    images: ["/api/og"],
  },
};

export const viewport = {
  themeColor: '#6B7D5E',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preload critical video assets for desktop */}
        <link
          rel="preload"
          href="/web_scrub.mp4"
          as="video"
          type="video/mp4"
          media="(min-width: 768px)"
        />
        {/* Preload critical video assets for mobile */}
        <link
          rel="preload"
          href="/mob_scrub.mp4"
          as="video"
          type="video/mp4"
          media="(max-width: 767px)"
        />
      </head>
      <body
        className={`${cormorant.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
