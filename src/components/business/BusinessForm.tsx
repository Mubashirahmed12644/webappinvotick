"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { apiSend, newId } from "@/lib/client-api";
import type { BusinessDetail } from "@/lib/data";

export function BusinessForm({ business }: { business?: BusinessDetail }) {
  const router = useRouter();
  const isEdit = Boolean(business);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    if (!name) return setError("Business name is required.");
    const id = business?.id ?? newId();
    const payload = {
      id, name,
      shortName: String(f.get("shortName") || "") || null,
      emailAddress: String(f.get("emailAddress") || "") || null,
      phone: String(f.get("phone") || "") || null,
      website: String(f.get("website") || "") || null,
      addressLine1: String(f.get("addressLine1") || "") || null,
      city: String(f.get("city") || "") || null,
      state: String(f.get("state") || "") || null,
      country: String(f.get("country") || "") || null,
      currencyCode: String(f.get("currencyCode") || "") || null,
    };
    setSaving(true);
    const res = await apiSend(isEdit ? `/v1/businesses/${id}` : "/v1/businesses", isEdit ? "PUT" : "POST", payload);
    setSaving(false);
    if (!res.success) return setError(res.message || "Could not save the business.");
    router.push("/settings");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">{isEdit ? "Edit business" : "New business"}</h1>
        <Button type="submit" loading={saving}>{isEdit ? "Save" : "Create"}</Button>
      </div>
      {error && <div className="rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-4 py-2.5 text-sm font-medium text-[var(--color-on-error-container)]">{error}</div>}
      <Card className="grid gap-4 p-6 sm:grid-cols-2">
        <TextField name="name" label="Name *" defaultValue={business?.name} required />
        <TextField name="shortName" label="Short name" defaultValue={business?.shortName ?? ""} />
        <TextField name="emailAddress" type="email" label="Email" defaultValue={business?.emailAddress ?? ""} />
        <TextField name="phone" label="Phone" defaultValue={business?.phone ?? ""} />
        <TextField name="website" label="Website" defaultValue={business?.website ?? ""} />
        <TextField name="currencyCode" label="Currency" defaultValue={business?.currencyCode ?? "USD"} maxLength={3} />
        <TextField name="addressLine1" label="Address" defaultValue={business?.addressLine1 ?? ""} className="sm:col-span-2" />
        <TextField name="city" label="City" defaultValue={business?.city ?? ""} />
        <TextField name="state" label="State" defaultValue={business?.state ?? ""} />
        <TextField name="country" label="Country" defaultValue={business?.country ?? ""} />
      </Card>
    </form>
  );
}
