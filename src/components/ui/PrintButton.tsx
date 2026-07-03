"use client";

import { Button } from "./Button";

export function PrintButton({ label = "Print / PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={() => globalThis.print()}>
      {label}
    </Button>
  );
}
