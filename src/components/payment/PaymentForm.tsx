"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { apiSend, newId } from "@/lib/client-api";
import type { Client } from "@/lib/types";

export function PaymentForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientId, setClientId] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!clientId) return setError("Please choose a client.");
    const f = new FormData(e.currentTarget);
    const id = newId();
    const payload = {
      id, clientId,
      paymentNumber: String(f.get("paymentNumber") || `PAY-${Date.now().toString().slice(-5)}`),
      amount: Number(f.get("amount") || 0),
      paymentDate: String(f.get("paymentDate") || new Date().toISOString().slice(0, 10)),
      paymentInstructionId: null,
      referenceNumber: String(f.get("referenceNumber") || "") || null,
      notes: String(f.get("notes") || "") || null,
      status: "COMPLETED",
      customerCredit: null,
    };
    setSaving(true);
    const res = await apiSend("/v1/payments", "POST", payload);
    setSaving(false);
    if (!res.success) return setError(res.message || "Could not record the payment.");
    router.push("/payments");
    router.refresh();
  }

  const selectCls = "h-11 rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">Record payment</h1>
        <Button type="submit" loading={saving}>Save</Button>
      </div>
      {error && <div className="rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-4 py-2.5 text-sm font-medium text-[var(--color-on-error-container)]">{error}</div>}
      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-sm font-semibold text-[var(--color-on-surface)]">Client</label>
          <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={cn(selectCls)}>
            <option value="">Select a client…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <TextField name="amount" label="Amount" inputMode="decimal" required />
        <TextField name="paymentDate" type="date" label="Date" defaultValue={new Date().toISOString().slice(0, 10)} />
        <TextField name="paymentNumber" label="Payment number" placeholder="Auto" />
        <TextField name="referenceNumber" label="Reference" />
        <TextField name="notes" label="Notes" className="sm:col-span-2" />
      </Card>
    </form>
  );
}
