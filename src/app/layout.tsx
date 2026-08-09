import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/components/pwa/SwRegister";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Invotick — Invoices & Estimates",
  description: "Create and manage invoices, estimates, and clients from any device.",
  applicationName: "Invotick",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Invotick", statusBarStyle: "default" },
  // Favicon + apple icon come from the Invotick brand mark via the App Router
  // file convention (src/app/icon.png, src/app/apple-icon.png).
};

export const viewport: Viewport = {
  themeColor: "#0D4DC0",
  // Belt to the CSS braces: `color-scheme: only light` in globals.css is the rule browsers honour,
  // and this is the meta tag they read before the stylesheet arrives. Together they close the window
  // in which a page with no stated opinion can be algorithmically darkened.
  colorScheme: "only light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${nunito.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
