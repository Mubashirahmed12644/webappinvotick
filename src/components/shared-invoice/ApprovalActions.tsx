"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Decision = "APPROVED" | "REJECTED";

/**
 * Receiver's Approve / Reject controls for a shared invoice.
 *
 * Web approval is allowed (low friction) — installing the app is a secondary growth
 * step, not a gate. On success we refresh so the server re-renders the page in its
 * decided state (the backend locks the decision after the first one).
 */
export function ApprovalActions({ token, compact = false }: { token: string; compact?: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<Decision | null>(null);
  const [decided, setDecided] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: Decision) {
    setError(null);
    setBusy(decision);
    try {
      const res = await fetch(`/api/shared-invoice/${encodeURIComponent(token)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(json?.error ?? "Something went wrong. Please try again.");
        setBusy(null);
        return;
      }
      // Show the outcome immediately (read-your-own-writes) and refresh in the
      // background so a later reload also reflects the server's decided state.
      setDecided(decision);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error. Please check your connection and try again.");
      setBusy(null);
    }
  }

  if (decided) {
    const approved = decided === "APPROVED";
    return (
      <section
        className={`rounded-2xl border text-center ${compact ? "p-3" : "mt-6 p-6"} ${
          approved ? "border-[#16A34A]/30 bg-[#16A34A]/5" : "border-[#DC2626]/30 bg-[#DC2626]/5"
        }`}
      >
        <p
          className={`${compact ? "text-base" : "text-lg"} font-semibold ${
            approved ? "text-[#15803D]" : "text-[#DC2626]"
          }`}
        >
          {approved ? "✓ You approved this invoice" : "✕ You rejected this invoice"}
        </p>
        <p className={`text-neutral-600 ${compact ? "text-xs" : "mt-1 text-sm"}`}>
          The sender has been notified.
        </p>
      </section>
    );
  }

  const disabled = busy !== null;

  if (compact) {
    return (
      <div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => decide("APPROVED")}
            disabled={disabled}
            className="flex-1 rounded-full bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#15803D] disabled:opacity-60"
          >
            {busy === "APPROVED" ? "Approving…" : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => decide("REJECTED")}
            disabled={disabled}
            className="flex-1 rounded-full border border-[#DC2626] px-4 py-2.5 text-sm font-semibold text-[#DC2626] transition hover:bg-[#DC2626]/5 disabled:opacity-60"
          >
            {busy === "REJECTED" ? "Rejecting…" : "Reject"}
          </button>
        </div>
        {error ? <p className="mt-1 text-center text-xs font-medium text-[#DC2626]">{error}</p> : null}
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-neutral-900">Do you approve this invoice?</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Let the sender know your decision — they&apos;ll be notified right away.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => decide("APPROVED")}
          disabled={disabled}
          className="w-full rounded-full bg-[#16A34A] px-6 py-3 font-semibold text-white transition hover:bg-[#15803D] disabled:opacity-60 sm:w-48"
        >
          {busy === "APPROVED" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => decide("REJECTED")}
          disabled={disabled}
          className="w-full rounded-full border border-[#DC2626] px-6 py-3 font-semibold text-[#DC2626] transition hover:bg-[#DC2626]/5 disabled:opacity-60 sm:w-48"
        >
          {busy === "REJECTED" ? "Rejecting…" : "Reject"}
        </button>
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-[#DC2626]">{error}</p> : null}
    </section>
  );
}
