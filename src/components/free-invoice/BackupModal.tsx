"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { Button } from "@/components/ui/Button";
import { backupLocalInvoices, type SyncResult } from "@/lib/free-invoice/sync";

type Phase = "prompt" | "syncing" | "done" | "error";

export function BackupModal({ open, onClose, count }: { open: boolean; onClose: () => void; count: number }) {
  const [phase, setPhase] = useState<Phase>("prompt");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSignedIn() {
    setPhase("syncing");
    try {
      const r = await backupLocalInvoices();
      setResult(r);
      setPhase("done");
    } catch {
      setError("We couldn't sync right now, but your invoices are safe on this device.");
      setPhase("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-[var(--radius-lg,16px)] bg-[var(--color-surface)] p-6 shadow-2xl">
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-variant)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>

        {phase === "prompt" && (
          <>
            <div className="mb-1 text-2xl">☁️</div>
            <h2 className="text-xl font-extrabold text-[var(--color-on-surface)]">Back up your invoices</h2>
            <p className="mt-1.5 text-sm text-[var(--color-on-surface-variant)]">
              {count > 0
                ? `You have ${count} invoice${count > 1 ? "s" : ""} saved on this device. Create a free account to back ${count > 1 ? "them" : "it"} up and open your invoices on any device.`
                : "Create a free account to back up your invoices and open them on any device."}
            </p>

            <div className="mt-5">
              <Suspense fallback={<div className="h-11" />}>
                <GoogleButton label="continue_with" onSuccess={onSignedIn} onError={setError} />
              </Suspense>
            </div>

            <div className="my-4 flex items-center gap-3 text-xs text-[var(--color-on-surface-variant)]">
              <span className="h-px flex-1 bg-[var(--color-outline-variant)]" /> or <span className="h-px flex-1 bg-[var(--color-outline-variant)]" />
            </div>

            <Link href="/signup" className="block w-full rounded-full border border-[var(--color-outline)] py-2.5 text-center text-sm font-semibold text-[var(--color-on-surface)] hover:bg-[var(--color-surface-variant)]">
              Sign up with email
            </Link>

            {error && <p className="mt-3 text-center text-xs font-medium text-[var(--color-error)]">{error}</p>}
            <p className="mt-4 text-center text-[11px] text-[var(--color-on-surface-variant)]">
              Your invoices stay on this device until you sign in. Nothing is shared before then.
            </p>
          </>
        )}

        {phase === "syncing" && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-outline-variant)] border-t-[var(--color-primary)]" />
            <p className="text-sm font-semibold text-[var(--color-on-surface)]">Signing you in and syncing…</p>
          </div>
        )}

        {phase === "done" && result && (
          <div className="py-4 text-center">
            <div className="mb-2 text-3xl">✅</div>
            <h2 className="text-xl font-extrabold text-[var(--color-on-surface)]">You&apos;re all set</h2>
            {result.needsBusiness ? (
              <p className="mt-1.5 text-sm text-[var(--color-on-surface-variant)]">
                You&apos;re signed in and your invoices are safe on this device. Set up your business to finish syncing them to your account.
              </p>
            ) : (
              <p className="mt-1.5 text-sm text-[var(--color-on-surface-variant)]">
                {result.synced > 0 ? `Backed up ${result.synced} invoice${result.synced > 1 ? "s" : ""} to your account. ` : ""}
                You can now open your invoices on any device.
              </p>
            )}
            <div className="mt-5 flex flex-col gap-2">
              <Link href={result.needsBusiness ? "/settings/business/new" : "/invoices"}>
                <Button className="w-full">{result.needsBusiness ? "Set up my business" : "Go to my invoices"}</Button>
              </Link>
              <button type="button" onClick={onClose} className="text-sm font-medium text-[var(--color-on-surface-variant)]">Keep editing here</button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="py-6 text-center">
            <div className="mb-2 text-3xl">⚠️</div>
            <p className="text-sm text-[var(--color-on-surface)]">{error}</p>
            <Button className="mt-5 w-full" variant="outline" onClick={onClose}>Close</Button>
          </div>
        )}
      </div>
    </div>
  );
}
