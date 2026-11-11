import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { SITE_NAME } from "@/lib/site";
import "./globals.css";

// Geist, self-hosted: the `geist` package ships the font files and loads them
// with next/font/local (the same --font-geist-sans and --font-geist-mono
// variables). next/font/google fetches them from Google at build time, which
// fails on GitHub's runners.
const geistSans = GeistSans;
const geistMono = GeistMono;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: SITE_NAME,
  description:
    "Algolia finds it. Supabase stores it. Cloudflare wires them. An open-source search starter.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
