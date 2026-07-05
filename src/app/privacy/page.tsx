import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Invotick",
  description: "How Invotick handles your data. Invoices you create with the free tool stay in your browser until you sign in.",
};

// Placeholder content — the owner will replace the body copy later.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      <nav className="mx-auto max-w-3xl px-4 py-4 sm:px-6">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-[var(--color-on-background)]">
          Invotick
        </Link>
      </nav>
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-6 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-on-background)]">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="mt-6 space-y-4 text-sm leading-relaxed text-[var(--color-on-surface)]">
          <p>
            <strong>Free invoice tool.</strong> Invoices you create with our free invoice generator are stored
            locally in your browser (IndexedDB). This data — including any client details or logo you add — is not
            sent to Invotick&apos;s servers unless you choose to sign in and back up your invoices.
          </p>
          <p>
            <strong>Accounts.</strong> When you create an account or sign in with Google, we process the
            information needed to provide the service (such as your email and the invoices you sync).
          </p>
          <p>
            <strong>Cookies.</strong> We use a small number of cookies required to keep you signed in and to
            operate the app.
          </p>
          <p className="text-[var(--color-on-surface-variant)]">
            This is placeholder text and will be replaced with the full policy. For questions, contact
            support@invotick.com.
          </p>
        </div>

        <p className="mt-8">
          <Link href="/" className="text-sm font-semibold text-[var(--color-primary)] underline">← Back to the invoice generator</Link>
        </p>
      </main>
    </div>
  );
}
