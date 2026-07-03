"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { User } from "@/lib/types";

export function Topbar({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initials = (user.username || user.email).slice(0, 2).toUpperCase();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="no-print flex h-16 items-center justify-between border-b border-[var(--color-outline-variant)] bg-[var(--color-surface)] px-4 sm:px-6">
      <div className="text-sm font-semibold text-[var(--color-on-surface-variant)]">
        {user.isEmailVerified ? "" : "⚠ Verify your email to unlock all features"}
      </div>
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[var(--color-surface-variant)]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-[var(--color-on-primary)]">
            {initials}
          </span>
          <span className="hidden text-sm font-semibold text-[var(--color-on-surface)] sm:block">
            {user.username || user.email}
          </span>
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-2 w-52 rounded-[var(--radius-md)] border border-[var(--color-outline-variant)] bg-[var(--color-surface)] py-1 shadow-lg">
            <div className="border-b border-[var(--color-outline-variant)] px-4 py-2">
              <p className="truncate text-sm font-semibold text-[var(--color-on-surface)]">{user.username}</p>
              <p className="truncate text-xs text-[var(--color-on-surface-variant)]">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="w-full px-4 py-2 text-left text-sm font-semibold text-[var(--color-error)] hover:bg-[var(--color-surface-variant)]"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
