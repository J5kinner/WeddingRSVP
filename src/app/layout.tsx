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
        className={`${cormorant.variable} ${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
