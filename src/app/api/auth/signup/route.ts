import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { createSession } from "@/lib/session";
import { mockUser } from "@/lib/mock";
import type { ApiResponse } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email, username, password } = body as {
    email?: string;
    username?: string;
    password?: string;
  };

  // Test lockdown: no new accounts may be created while testing.
  if (config.testMode) {
    return NextResponse.json(
      { success: false, message: "Sign-up is disabled during limited testing." },
      { status: 403 },
    );
  }

  if (!email || !username || !password) {
    return NextResponse.json({ success: false, message: "All fields are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ success: false, message: "Password must be at least 8 characters." }, { status: 400 });
  }

  if (config.mockMode) {
    await createSession({ token: "mock-token", user: { ...mockUser, email, username } });
    return NextResponse.json({ success: true, message: "Account created (demo).", verified: true });
  }

  try {
    const res = await fetch(`${config.backendUrl}/v1/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });
    const data = (await res.json()) as ApiResponse<unknown>;
    // Real backend sends an email OTP; verification happens on a follow-up step.
    return NextResponse.json(
      { success: data.success, message: data.message, verified: false },
      { status: res.ok ? 200 : res.status },
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Could not reach the server. Please try again." },
      { status: 502 },
    );
  }
}
