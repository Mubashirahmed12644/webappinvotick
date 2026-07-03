import { NextResponse } from "next/server";
import { config, isEmailAllowed } from "@/lib/config";
import { createSession } from "@/lib/session";
import { mockUser } from "@/lib/mock";
import type { ApiResponse, AuthResponse } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { email, password } = body as { email?: string; password?: string };

  if (!email || !password) {
    return NextResponse.json({ success: false, message: "Email and password are required." }, { status: 400 });
  }

  // Test lockdown: refuse anyone who isn't the approved test account.
  if (!isEmailAllowed(email)) {
    return NextResponse.json(
      { success: false, message: "This app is in limited testing. Access is restricted to approved accounts." },
      { status: 403 },
    );
  }

  if (config.mockMode) {
    await createSession({ token: "mock-token", user: { ...mockUser, email } });
    return NextResponse.json({ success: true, message: "Login successful (demo)." });
  }

  try {
    const res = await fetch(`${config.backendUrl}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await res.json()) as ApiResponse<AuthResponse>;

    if (!res.ok || !data.success || !data.data) {
      return NextResponse.json(
        { success: false, message: data.message || "Login failed." },
        { status: res.status || 401 },
      );
    }

    await createSession({ token: data.data.accessToken, user: data.data.user });
    return NextResponse.json({ success: true, message: "Login successful." });
  } catch {
    return NextResponse.json(
      { success: false, message: "Could not reach the server. Please try again." },
      { status: 502 },
    );
  }
}
