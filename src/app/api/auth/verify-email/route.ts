import { NextResponse } from "next/server";
import { config, isEmailAllowed } from "@/lib/config";
import { createSession } from "@/lib/session";
import { mockUser } from "@/lib/mock";
import { isSameOrigin } from "@/lib/same-origin";
import type { ApiResponse, AuthResponse } from "@/lib/types";

/**
 * The sign-up code step: the browser's twin of the app's "Verify" button.
 *
 * Calls the EXISTING backend route `POST /v1/auth/verify-email`, which is also what signs the new
 * account in (verifying the code is the first sign-in; there is no second login). The pass goes into
 * the httpOnly session cookie exactly as `/api/auth/login` does it, so it never reaches the page.
 *
 * Two rules that are easy to break here:
 * - **The code is never logged**, not even on failure. Nothing in this file writes to a log.
 * - The backend's own sentence is passed through with its own status — "Invalid OTP", "OTP expired.
 *   Click Resend OTP.", and the 429 waits ("Too many OTP attempts. Try again in N minutes.") — because
 *   the page shows the server's words, and the status tells it a wait from a wrong code.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, message: "Request not allowed." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: unknown; otp?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const otp = typeof body.otp === "string" ? body.otp : "";

  if (!email || !/^\d{6}$/.test(otp)) {
    return NextResponse.json({ success: false, message: "Enter the 6-digit code." }, { status: 400 });
  }

  // Same lockdown as the login route: while testing, only the approved account gets in.
  if (!isEmailAllowed(email)) {
    return NextResponse.json(
      { success: false, message: "This app is in limited testing. Access is restricted to approved accounts." },
      { status: 403 },
    );
  }

  if (config.mockMode) {
    await createSession({ token: "mock-token", user: { ...mockUser, email } });
    return NextResponse.json({ success: true, message: "Email verified (demo)." });
  }

  try {
    const res = await fetch(`${config.backendUrl}/v1/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as ApiResponse<AuthResponse> | null;

    if (!res.ok || !data?.success || !data.data?.accessToken) {
      return NextResponse.json(
        { success: false, message: data?.message || "Verification failed." },
        { status: res.ok ? 502 : res.status },
      );
    }

    await createSession({ token: data.data.accessToken, user: data.data.user });
    return NextResponse.json({ success: true, message: "Email verified." });
  } catch {
    return NextResponse.json(
      { success: false, message: "Could not reach the server. Please try again." },
      { status: 502 },
    );
  }
}
