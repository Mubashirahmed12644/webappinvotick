"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import {
  CODE_LENGTH,
  OFFLINE_SENTENCE,
  RESEND_COOLDOWN_SECONDS,
  digitsOnly,
  helpIsDue,
  secondsLeft,
  secondsSince,
} from "@/lib/signup-code";

/**
 * The step the web sign-up was missing: type the code the server mailed, and be signed in.
 *
 * Until this existed, "Check your email for a verification code." was the end of the web sign-up:
 * there was no box to type the code in, so an account could be made on the web and never finished.
 *
 * What it does for a wrong address (spec `kaam/research/otp-wrong-email-spec.md` 2.3-2.5, 6.2):
 * - the address the code went to sits on its own bold line, with "Wrong email? Change it" under it;
 * - at 30 s, if the person has typed nothing, the quiet resend line becomes a help block saying to
 *   check spam and the address, with Resend and Change email side by side (stacked when they do not
 *   fit);
 * - Resend keeps the server's own wait: one minute here, and any longer wait is the server's 429
 *   sentence, shown under the buttons and not in something that disappears.
 *
 * The six boxes are drawn, not typed into: ONE real input sits over them. That is what lets a paste of
 * six digits, the phone's one-time-code suggestion and a password manager all work, and the boxes are
 * forced left to right so `482917` never reads `719284` in an Arabic or Persian browser.
 */
export function SignupCodeStep({
  email,
  passwordKept,
  onChangeEmail,
}: {
  /** The address the code was sent to, as typed (trimmed). */
  email: string;
  /** True when the form now holds a different password than the one this sign-up was made with. */
  passwordKept: boolean;
  onChangeEmail: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [code, setCode] = useState("");
  const [everTyped, setEverTyped] = useState(false);
  const [focused, setFocused] = useState(false);
  const [sentAt, setSentAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [helpShown, setHelpShown] = useState(false);
  const [busy, setBusy] = useState<"verify" | "resend" | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  // The clock only ticks the screen; every figure is worked out from timestamps, so a tab that was
  // in the background cannot show a stale countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Land with the keyboard up and ready for digits.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onScreen = secondsSince(sentAt, now);
  const resendIn = secondsLeft(sentAt, now, RESEND_COOLDOWN_SECONDS);

  // The help appears once and then stays: it must not vanish when the person starts typing, and it
  // must not appear later if they had already started. (Adjusting state while rendering is React's
  // documented way to derive state from other state without an extra pass.)
  if (!helpShown && helpIsDue(onScreen, everTyped)) setHelpShown(true);

  function onCodeChange(raw: string) {
    const next = digitsOnly(raw);
    setCode(next);
    if (next.length > 0) setEverTyped(true);
    setVerifyError(null);
  }

  function keepCaretAtEnd(el: HTMLInputElement) {
    const end = el.value.length;
    if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== CODE_LENGTH || busy) return;
    setVerifyError(null);
    setResendError(null);
    setResendNotice(null);
    setBusy("verify");
    try {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setVerifyError(data?.message || "Verification failed. Please try again.");
        return;
      }
      router.push("/invoices");
      router.refresh();
    } catch {
      setVerifyError(OFFLINE_SENTENCE);
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    if (busy || resendIn > 0) return;
    setVerifyError(null);
    setResendError(null);
    setResendNotice(null);
    setBusy("resend");
    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        // The server's own sentence ("Please wait 5 minutes before requesting another code."), kept
        // on screen until the next press.
        setResendError(data?.message || "Could not send a new code. Please try again.");
        return;
      }
      // A new code replaces the old one on the server, so the old digits are of no use. Both clocks
      // start again; the help stays up if it was already up.
      const t = Date.now();
      setSentAt(t);
      setNow(t);
      setCode("");
      setEverTyped(false);
      setResendNotice("A new code is on its way.");
      inputRef.current?.focus();
    } catch {
      setResendError(OFFLINE_SENTENCE);
    } finally {
      setBusy(null);
    }
  }

  const activeBox = focused ? Math.min(code.length, CODE_LENGTH - 1) : -1;
  const resendLabel = resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code";

  const outlineButton = cn(
    "inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-sm)] border px-3 py-2 text-center text-sm font-semibold",
    "border-[var(--color-outline)] text-[var(--color-primary)] transition",
    "hover:bg-[var(--color-surface-variant)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
    "disabled:cursor-not-allowed disabled:border-[var(--color-outline-variant)] disabled:text-[var(--color-on-surface-variant)] disabled:opacity-60 disabled:hover:bg-transparent",
  );

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <Logo />
        </div>
        <h2 className="text-2xl font-extrabold text-[var(--color-on-surface)]">Check your email</h2>
        <p className="mt-1 text-sm text-[var(--color-on-surface-variant)]">
          Enter the 6-digit code we sent to
        </p>
        {/* The address is an identifier: it wraps, it is never cut with an ellipsis, and it reads left
            to right in every language. */}
        <p className="mt-2 text-base font-extrabold text-[var(--color-on-surface)] [overflow-wrap:anywhere]">
          <bdi dir="ltr">
            {email}
          </bdi>
        </p>
        <button
          type="button"
          onClick={onChangeEmail}
          disabled={busy !== null}
          className="-ms-2 mt-1 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] px-2 text-sm text-[var(--color-on-surface-variant)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Wrong email?
          <span className="ms-1 font-extrabold text-[var(--color-primary)]">Change it</span>
        </button>

        <form onSubmit={verify} className="mt-4 space-y-4">
          <div className="relative">
            <div dir="ltr" aria-hidden="true" className="flex gap-2">
              {Array.from({ length: CODE_LENGTH }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex aspect-square min-w-0 flex-1 items-center justify-center rounded-lg border-2 text-xl font-extrabold",
                    "text-[var(--color-on-surface)]",
                    code[i]
                      ? "border-[var(--color-outline)] bg-[var(--color-surface-variant)]"
                      : "border-[var(--color-outline-variant)] bg-[var(--color-surface)]",
                    i === activeBox && "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/30",
                  )}
                >
                  {code[i] ?? ""}
                </div>
              ))}
            </div>
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              onPaste={(e) => {
                // maxLength would cut "482 917" at six characters, spaces included.
                e.preventDefault();
                onCodeChange(e.clipboardData.getData("text"));
              }}
              onFocus={(e) => {
                setFocused(true);
                keepCaretAtEnd(e.currentTarget);
              }}
              onBlur={() => setFocused(false)}
              onSelect={(e) => keepCaretAtEnd(e.currentTarget)}
              dir="ltr"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CODE_LENGTH}
              enterKeyHint="done"
              aria-label="6-digit code"
              aria-invalid={verifyError ? true : undefined}
              disabled={busy === "verify"}
              className="absolute inset-0 h-full w-full cursor-text bg-transparent text-base opacity-0"
            />
          </div>

          {verifyError && (
            <div
              role="alert"
              className="rounded-[var(--radius-sm)] bg-[var(--color-error-container)] px-3 py-2 text-sm font-medium text-[var(--color-on-error-container)]"
            >
              {verifyError}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            loading={busy === "verify"}
            disabled={code.length !== CODE_LENGTH}
            className="w-full"
          >
            {busy === "verify" ? "Verifying..." : "Verify"}
          </Button>
        </form>

        {passwordKept && (
          <p className="mt-4 text-xs text-[var(--color-on-surface-variant)]">
            This account keeps the password you entered the first time.
          </p>
        )}

        {helpShown ? (
          <div className="mt-6 space-y-2 border-t border-[var(--color-outline-variant)] pt-4">
            <h3 className="text-[15px] font-extrabold text-[var(--color-on-surface)]">
              Didn&apos;t receive the code?
            </h3>
            <p className="text-sm text-[var(--color-on-surface-variant)]">
              Check your spam folder, and check that the email above is right.
            </p>
            {/* Side by side while both labels fit at full size, stacked when they do not: the
                minimum is in rem, so a larger text size stacks them instead of cutting a label. */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-2.5 pt-1">
              <button type="button" onClick={resend} disabled={busy !== null || resendIn > 0} className={outlineButton}>
                {resendLabel}
              </button>
              <button type="button" onClick={onChangeEmail} disabled={busy !== null} className={outlineButton}>
                Change email
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-center text-sm text-[var(--color-on-surface-variant)]">
            Didn&apos;t receive the code?{" "}
            {resendIn > 0 ? (
              <span>Resend in {resendIn}s</span>
            ) : (
              <button
                type="button"
                onClick={resend}
                disabled={busy !== null}
                className="inline-flex min-h-11 items-center px-1 font-semibold text-[var(--color-primary)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] disabled:opacity-60"
              >
                Resend code
              </button>
            )}
          </p>
        )}

        {resendError && (
          <p role="alert" className="mt-2 text-sm font-semibold text-[var(--color-error)]">
            {resendError}
          </p>
        )}
        {resendNotice && (
          <p role="status" className="mt-2 text-sm font-medium text-[var(--color-on-surface-variant)]">
            {resendNotice}
          </p>
        )}
      </div>
    </div>
  );
}
