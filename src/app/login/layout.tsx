import type { Metadata } from "next";

// Auth pages must never be indexed (kept crawlable so the noindex is seen).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
