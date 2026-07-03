"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo />
        </div>
        <h2 className="text-2xl font-extrabold text-[var(--color-on-surface)]">Reset password</h2>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          Enter your email and we&apos;ll send you a reset code.
        </p>

        {sent ? (
          <div className="mt-8 rounded-[var(--radius-sm)] bg-[var(--color-secondary-container)] px-4 py-3 text-sm font-medium text-[var(--color-on-secondary-container)]">
            If that email exists, a reset code has been sent. Check your inbox.
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
            className="mt-8 space-y-4"
          >
            <TextField name="email" type="email" label="Email" placeholder="you@company.com" required />
            <Button type="submit" size="lg" className="w-full">
              Send reset code
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-[var(--color-on-surface-variant)]">
          <Link href="/login" className="font-semibold text-[var(--color-primary)] hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
