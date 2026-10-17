"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { EmailSuggestionChip } from "@/components/auth/EmailSuggestionChip";
import { SignupCodeStep } from "@/components/auth/SignupCodeStep";
import {
  EMPTY_GATE,
  gateOnAccept,
  gateOnBlur,
  gateOnEdit,
  gateOnSubmit,
  type SuggestionGate,
} from "@/lib/email-suggestion-gate";
import { emailKey } from "@/lib/signup-code";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupView />
    </Suspense>
  );
}

/** Puts the caret after the last character. `type=email` inputs refuse setSelectionRange, so it is
 *  switched to text for that one call. */
function placeCaretAtEnd(el: HTMLInputElement | null) {
  if (!el) return;
  el.focus();
  const type = el.type;
  const end = el.value.length;
  try {
    el.type = "text";
    el.setSelectionRange(end, end);
  } finally {
    el.type = type;
  }
}

function SignupView() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "code">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The three fields are controlled so "Change email" brings the form back exactly as it was left.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [gate, setGate] = useState<SuggestionGate>(EMPTY_GATE);
  const [announcement, setAnnouncement] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const focusEmailWhenFormReturns = useRef(false);

  /**
   * The addresses this visit already made a sign-up for, with the password each was made with.
   *
   * The server answers 409 "Email already exists. Please login." to a second sign-up for an address
   * with an unfinished one, so "Change email" followed by Create account on the SAME address must
   * not call the server again: it goes straight back to the code step. The account keeps its first
   * password, which is why that is remembered.
   */
  const [signedUp, setSignedUp] = useState<Record<string, string>>({});
  const [codeFor, setCodeFor] = useState("");

  // Back from the code step with "Change it": the e-mail field takes focus, caret at the end.
  useEffect(() => {
    if (step === "form" && focusEmailWhenFormReturns.current) {
      focusEmailWhenFormReturns.current = false;
      placeCaretAtEnd(emailRef.current);
    }
  }, [step]);

  // The press that only shows the chip must leave it in view.
  useEffect(() => {
    if (gate.suggestion) chipRef.current?.scrollIntoView({ block: "nearest" });
  }, [gate.suggestion]);

  function acceptSuggestion() {
    if (!gate.suggestion) return;
    const accepted = gate.suggestion;
    setEmail(accepted);
    setGate(gateOnAccept(gate));
    setAnnouncement(`Email changed to ${accepted}`);
    // Focus stays in the e-mail field (the tapped chip is about to disappear).
    requestAnimationFrame(() => placeCaretAtEnd(emailRef.current));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setAnnouncement("");

    const typed = email.trim();

    // The one pause: a suggestion never shown for this exact address is shown now, nothing is sent.
    const decision = gateOnSubmit(gate, typed);
    setGate(decision.gate);
    if (!decision.send) return;

    const key = emailKey(typed);
    if (key in signedUp) {
      setCodeFor(typed);
      setStep("code");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: typed, username: name, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || "Sign up failed.");
        return;
      }
      if (data.verified) {
        router.push("/invoices");
        router.refresh();
      } else {
        setSignedUp((prev) => ({ ...prev, [key]: password }));
        setCodeFor(typed);
        setStep("code");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "code") {
    return (
      <SignupCodeStep
        email={codeFor}
        passwordKept={signedUp[emailKey(codeFor)] !== password}
        onChangeEmail={() => {
          focusEmailWhenFormReturns.current = true;
          setError(null);
          setStep("form");
        }}
      />
    );
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
          <TextField
            name="username"
            label="Name"
            placeholder="John Doe"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div>
            <TextField
              ref={emailRef}
              name="email"
              type="email"
              label="Email"
              placeholder="you@company.com"
              autoComplete="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setGate((g) => gateOnEdit(g));
                setAnnouncement("");
              }}
              onBlur={() => setGate((g) => gateOnBlur(g, email))}
            />
            <EmailSuggestionChip
              suggestion={gate.suggestion}
              announcement={announcement}
              onAccept={acceptSuggestion}
              buttonRef={chipRef}
            />
          </div>
          <TextField
            name="password"
            type="password"
            label="Password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <div
              role="alert"
              className="rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-3 py-2 text-sm font-medium text-[var(--color-on-error-container)]"
            >
              {error}
            </div>
          )}

          <Button type="submit" size="lg" loading={loading} className="w-full">
            Create account
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3 text-xs text-[var(--color-on-surface-variant)]">
          <span className="h-px flex-1 bg-[var(--color-outline-variant)]" />
          <span>or</span>
          <span className="h-px flex-1 bg-[var(--color-outline-variant)]" />
        </div>

        <GoogleButton onError={setError} label="signup_with" />

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
