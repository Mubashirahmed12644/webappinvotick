"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}

function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Login failed.");
        return;
      }
      router.push(params.get("next") || "/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden flex-col justify-between bg-[var(--color-primary)] p-12 text-[var(--color-on-primary)] lg:flex">
        <Logo className="[&_span]:text-white" />
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold leading-tight">
            Invoices &amp; estimates,
            <br /> from any device.
          </h1>
          <p className="max-w-md text-white/80">
            Create, send, and track invoices on the web — perfectly in sync with your Invotick
            mobile app.
          </p>
        </div>
        <p className="text-sm text-white/60">© {new Date().getFullYear()} Invotick</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-2xl font-extrabold text-[var(--color-on-surface)]">Welcome back</h2>
          <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
            Sign in to your Invotick account.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <TextField
              name="email"
              type="email"
              label="Email"
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
            <TextField
              name="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-3 py-2 text-sm font-medium text-[var(--color-on-error-container)]">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-[var(--color-primary)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" size="lg" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--color-on-surface-variant)]">
            New to Invotick?{" "}
            <Link href="/signup" className="font-semibold text-[var(--color-primary)] hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
