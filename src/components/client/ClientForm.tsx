"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { apiSend, newId } from "@/lib/client-api";
import type { ClientDetail } from "@/lib/data";

interface Props {
  primaryBusinessId: string | null;
  client?: ClientDetail;
}

export function ClientForm({ primaryBusinessId, client }: Props) {
  const router = useRouter();
  const isEdit = Boolean(client);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    if (!name) return setError("Client name is required.");

    const businessId = client?.businessId ?? primaryBusinessId;
    if (!businessId) return setError("No business found on your account. Create a business first in Settings.");

    const id = client?.id ?? newId();
    const payload = {
      id,
      businessId,
      name,
      currencyCode: String(f.get("currencyCode") || "") || null,
      emailAddress: String(f.get("emailAddress") || "") || null,
      phone: String(f.get("phone") || "") || null,
      companyName: String(f.get("companyName") || "") || null,
      addressLine1: String(f.get("addressLine1") || "") || null,
      city: String(f.get("city") || "") || null,
      state: String(f.get("state") || "") || null,
      zipcode: String(f.get("zipcode") || "") || null,
      country: String(f.get("country") || "") || null,
      additionalNotes: String(f.get("additionalNotes") || "") || null,
      credit: 0,
      openingBalance: Number(f.get("openingBalance") || 0),
      rating: 0,
    };

    setSaving(true);
    const res = await apiSend(isEdit ? `/v1/clients/${id}` : "/v1/clients", isEdit ? "PUT" : "POST", payload);
    setSaving(false);
    if (!res.success) return setError(res.message || "Could not save the client.");
    router.push(`/clients/${id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">{isEdit ? "Edit client" : "New client"}</h1>
        <Button type="submit" loading={saving}>{isEdit ? "Save changes" : "Create client"}</Button>
      </div>
      {error && (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-4 py-2.5 text-sm font-medium text-[var(--color-on-error-container)]">{error}</div>
      )}
      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <TextField name="name" label="Name *" defaultValue={client?.name} required />
        <TextField name="companyName" label="Company" defaultValue={client?.companyName ?? ""} />
        <TextField name="emailAddress" type="email" label="Email" defaultValue={client?.emailAddress ?? ""} />
        <TextField name="phone" label="Phone" defaultValue={client?.phone ?? ""} />
        <TextField name="currencyCode" label="Currency" defaultValue={client?.currencyCode ?? "USD"} maxLength={3} />
        <TextField name="openingBalance" label="Opening balance" inputMode="decimal" defaultValue={client?.openingBalance ?? ""} />
        <TextField name="addressLine1" label="Address" defaultValue={client?.addressLine1 ?? ""} className="sm:col-span-2" />
        <TextField name="city" label="City" defaultValue={client?.city ?? ""} />
        <TextField name="state" label="State" defaultValue={client?.state ?? ""} />
        <TextField name="zipcode" label="Zip code" defaultValue={client?.zipcode ?? ""} />
        <TextField name="country" label="Country" defaultValue={client?.country ?? ""} />
        <TextField name="additionalNotes" label="Notes" defaultValue={client?.additionalNotes ?? ""} className="sm:col-span-2" />
      </Card>
    </form>
  );
}
