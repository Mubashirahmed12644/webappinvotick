import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { isSameOrigin } from "@/lib/same-origin";
import type { ApiResponse } from "@/lib/types";

/**
 * "Resend code" on the sign-up code step. Calls the EXISTING backend route `POST /v1/auth/resend-otp`.
 *
 * The backend decides how often a code may be sent (one minute apart for the first three, then five,
 * then fifteen; ten an hour per account; thirty an hour per address) and answers a refusal with 429
 * and a sentence like "Please wait 5 minutes before requesting another code." That sentence and
 * status are passed through untouched, because the page shows them under the buttons.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ success: false, message: "Request not allowed." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email) {
    return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 });
  }

  // Sign-up is closed during limited testing, so there is no pending sign-up to send a code for.
  if (config.testMode) {
    return NextResponse.json(
      { success: false, message: "Sign-up is disabled during limited testing." },
      { status: 403 },
    );
  }

  if (config.mockMode) {
    return NextResponse.json({ success: true, message: "Code sent (demo)." });
  }

  try {
    const res = await fetch(`${config.backendUrl}/v1/auth/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;

    if (!res.ok || !data?.success) {
      return NextResponse.json(
        { success: false, message: data?.message || "Could not send a new code." },
        { status: res.ok ? 502 : res.status },
      );
    }
    return NextResponse.json({ success: true, message: data.message || "Code sent." });
  } catch {
    return NextResponse.json(
      { success: false, message: "Could not reach the server. Please try again." },
      { status: 502 },
    );
  }
}
