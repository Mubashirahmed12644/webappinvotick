"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { DeleteButton } from "@/components/ui/DeleteButton";
import { apiSend, newId } from "@/lib/client-api";

export interface ProductDetail {
  id: string;
  name: string;
  description?: string | null;
  unitPrice?: string | null;
}

export function ProductForm({ product }: { product?: ProductDetail }) {
  const router = useRouter();
  const isEdit = Boolean(product);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    if (!name) return setError("Product name is required.");
    const unitPrice = Number(f.get("unitPrice") || 0);
    const id = product?.id ?? newId();

    const payload = {
      id, name,
      description: String(f.get("description") || "") || null,
      unitPrice, netPrice: unitPrice,
      discount: null, discountType: null,
      taxId: null, unitTypeId: null, itemCategoryId: null,
    };

    setSaving(true);
    const res = await apiSend(isEdit ? `/v1/inventory-items/${id}` : "/v1/inventory-items", isEdit ? "PUT" : "POST", payload);
    setSaving(false);
    if (!res.success) return setError(res.message || "Could not save the product.");
    router.push("/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-[var(--color-on-surface)]">{isEdit ? "Edit product" : "New product"}</h1>
        <div className="flex gap-2">
          {isEdit && product && <DeleteButton path={`/v1/inventory-items/${product.id}`} redirectTo="/products" confirmText="Delete this product?" />}
          <Button type="submit" loading={saving}>{isEdit ? "Save" : "Create"}</Button>
        </div>
      </div>
      {error && <div className="rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-4 py-2.5 text-sm font-medium text-[var(--color-on-error-container)]">{error}</div>}
      <Card className="grid gap-4 p-6">
        <TextField name="name" label="Name *" defaultValue={product?.name} required />
        <TextField name="unitPrice" label="Unit price" inputMode="decimal" defaultValue={product?.unitPrice ?? ""} />
        <TextField name="description" label="Description" defaultValue={product?.description ?? ""} />
      </Card>
    </form>
  );
}
