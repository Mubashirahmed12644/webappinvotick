"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          username: form.get("username"),
          password: form.get("password"),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Sign up failed.");
        return;
      }
      if (data.verified) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setNotice(data.message || "Check your email for a verification code.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo />
        </div>
        <h2 className="text-2xl font-extrabold text-[var(--color-on-surface)]">Create your account</h2>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          Start invoicing in minutes.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <TextField name="username" label="Name" placeholder="John Doe" autoComplete="name" required />
          <TextField name="email" type="email" label="Email" placeholder="you@company.com" autoComplete="email" required />
          <TextField name="password" type="password" label="Password" placeholder="At least 8 characters" autoComplete="new-password" required minLength={8} />

          {error && (
            <div className="rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-3 py-2 text-sm font-medium text-[var(--color-on-error-container)]">
              {error}
            </div>
          )}
          {notice && (
            <div className="rounded-[var(--radius-sm)] bg-[var(--color-secondary-container)] px-3 py-2 text-sm font-medium text-[var(--color-on-secondary-container)]">
              {notice}
            </div>
          )}

          <Button type="submit" size="lg" loading={loading} className="w-full">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--color-on-surface-variant)]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--color-primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
