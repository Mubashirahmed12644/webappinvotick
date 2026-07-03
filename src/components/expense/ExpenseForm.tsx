"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { apiSend, newId } from "@/lib/client-api";
import type { Merchant } from "@/lib/data";

export function ExpenseForm({ merchants }: { merchants: Merchant[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [merchantId, setMerchantId] = useState(merchants[0]?.id ?? "");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!merchantId) return setError("Please choose a merchant (add one under Merchants first).");
    const f = new FormData(e.currentTarget);
    const total = Number(f.get("total") || 0);
    const id = newId();
    const payload = {
      id, merchantId,
      date: String(f.get("date") || new Date().toISOString().slice(0, 10)),
      image: null,
      category: String(f.get("category") || "") || null,
      subTotal: total, total,
      tax: null,
      description: String(f.get("description") || "") || null,
    };
    setSaving(true);
    const res = await apiSend("/v1/expenses", "POST", payload);
    setSaving(false);
    if (!res.success) return setError(res.message || "Could not save the expense.");
    router.push("/expenses");
    router.refresh();
  }

  const selectCls = "h-11 rounded-[var(--radius-sm)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-on-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]";

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">New expense</h1>
        <Button type="submit" loading={saving}>Create</Button>
      </div>
      {error && <div className="rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-4 py-2.5 text-sm font-medium text-[var(--color-on-error-container)]">{error}</div>}
      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-[var(--color-on-surface)]">Merchant</label>
          <select value={merchantId} onChange={(e) => setMerchantId(e.target.value)} className={cn(selectCls)}>
            <option value="">Select…</option>
            {merchants.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <TextField name="date" type="date" label="Date" defaultValue={new Date().toISOString().slice(0, 10)} />
        <TextField name="total" label="Amount" inputMode="decimal" required />
        <TextField name="category" label="Category" placeholder="e.g. Travel" />
        <TextField name="description" label="Description" className="sm:col-span-2" />
      </Card>
    </form>
  );
}
