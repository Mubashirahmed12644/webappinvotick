"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trackWebEvent } from "@/lib/analytics/client";

type Decision = "APPROVED" | "REJECTED";

/** The backend keeps 1,024 characters; the sender's push quotes 160. A note is a sentence or two. */
const NOTE_MAX = 500;

/**
 * Receiver's Approve / Reject controls for a shared invoice.
 *
 * Web approval is allowed (low friction) — installing the app is a secondary growth
 * step, not a gate. On success we refresh so the server re-renders the page in its
 * decided state (the backend locks the decision after the first one).
 *
 * ## The events are the app's own names, and they fire where the app fires them
 *
 * `shared_invoice_approved` / `shared_invoice_rejected` on the backend's CONFIRMATION, and
 * `shared_invoice_decision_failed` with `decision` when it refuses — the same three names and the
 * same three moments as `ReceivedInvoiceViewModel.decide`. Approving from a browser and approving
 * from the app are one action on two surfaces, so they are one name with the surface as a parameter
 * (`AGENTS-EVENTS.md` §1.1); a web-only name would split one funnel step in two, and the first
 * query that forgot one half would report a smaller number with nothing saying so.
 *
 * Firing on the click instead would have been the quiet defect: the same name would then mean
 * "decided" for app rows and "tried" for web rows, and the approval rate would rise for a reason
 * that never happened.
 *
 * `http_status` separates "already decided" (409) from "our backend was down" (5xx). Both look
 * identical to the receiver and are completely different problems.
 */
export function ApprovalActions({ token, compact = false }: { token: string; compact?: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<Decision | null>(null);
  const [decided, setDecided] = useState<Decision | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What the receiver wants the sender to know, sent with the decision and quoted in the sender's
  // push. `decision_note` existed end to end and nothing had ever asked for one, so a decline
  // reached the sender as a bare "rejected" — they learned something was wrong, never what.
  const [note, setNote] = useState("");

  async function decide(decision: Decision) {
    setError(null);
    setBusy(decision);
    try {
      const res = await fetch(`/api/shared-invoice/${encodeURIComponent(token)}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note.trim() || null }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        trackWebEvent("shared_invoice_decision_failed", {
          decision,
          http_status: res.status,
        });
        setError(json?.error ?? "Something went wrong. Please try again.");
        setBusy(null);
        return;
      }
      // Show the outcome immediately (read-your-own-writes) and refresh in the
      // background so a later reload also reflects the server's decided state.
      trackWebEvent(decision === "APPROVED" ? "shared_invoice_approved" : "shared_invoice_rejected", {
        has_note: note.trim() ? "true" : "false",
      });
      setDecided(decision);
      startTransition(() => router.refresh());
    } catch {
      // No HTTP answer at all, so no `http_status` — absent means unknown, never a stand-in value.
      trackWebEvent("shared_invoice_decision_failed", { decision });
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
          {approved ? "✓ You approved this invoice" : "✕ You declined this invoice"}
        </p>
        <p className={`text-neutral-600 ${compact ? "text-xs" : "mt-1 text-sm"}`}>
          The sender has been notified.
        </p>
      </section>
    );
  }

  const disabled = busy !== null;

  // One field for both layouts. "I've paid" only writes words — it records no money; the sender
  // decides what the message means.
  const noteField = (
    <div className={compact ? "mb-2" : "mt-4 text-left"}>
      <label htmlFor={`note-${token}`} className="sr-only">
        Note for the sender (optional)
      </label>
      <textarea
        id={`note-${token}`}
        value={note}
        onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
        disabled={disabled}
        rows={compact ? 1 : 2}
        placeholder="Note for the sender (optional)"
        className="w-full resize-none rounded-xl border border-neutral-300 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => setNote((n) => (n.trim() ? `${n.trimEnd()} I've paid.` : "I've paid."))}
        disabled={disabled}
        className="mt-2 min-h-[44px] rounded-full border border-neutral-300 px-4 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
      >
        I&apos;ve paid
      </button>
    </div>
  );

  if (compact) {
    return (
      <div>
        {noteField}
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
            {busy === "REJECTED" ? "Declining…" : "Decline"}
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

      {noteField}

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
          {busy === "REJECTED" ? "Declining…" : "Decline"}
        </button>
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-[#DC2626]">{error}</p> : null}
    </section>
  );
}
