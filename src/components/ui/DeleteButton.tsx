"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./Button";
import { apiSend } from "@/lib/client-api";

interface Props {
  path: string; // e.g. /v1/clients/{id}
  redirectTo: string;
  label?: string;
  confirmText?: string;
}

export function DeleteButton({ path, redirectTo, label = "Delete", confirmText = "Delete this item? This cannot be undone." }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!globalThis.confirm(confirmText)) return;
    setBusy(true);
    const res = await apiSend(path, "DELETE");
    setBusy(false);
    if (res.success) {
      router.push(redirectTo);
      router.refresh();
    } else {
      globalThis.alert(res.message || "Could not delete.");
    }
  }

  return (
    <Button type="button" variant="danger" size="sm" loading={busy} onClick={onDelete}>
      {label}
    </Button>
  );
}
