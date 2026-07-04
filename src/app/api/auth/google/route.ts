import { NextResponse } from "next/server";
import { config, isEmailAllowed } from "@/lib/config";
import { createSession } from "@/lib/session";
import { mockUser } from "@/lib/mock";
import type { ApiResponse, AuthResponse } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { idToken } = body as { idToken?: string };

  if (!idToken) {
    return NextResponse.json({ success: false, message: "Missing Google credential." }, { status: 400 });
  }

  if (config.mockMode) {
    await createSession({ token: "mock-token", user: { ...mockUser } });
    return NextResponse.json({ success: true, message: "Signed in with Google (demo)." });
  }

  try {
    const res = await fetch(`${config.backendUrl}/v1/auth/social-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google", idToken }),
    });
    const data = (await res.json()) as ApiResponse<AuthResponse>;

    if (!res.ok || !data.success || !data.data) {
      return NextResponse.json(
        { success: false, message: data.message || "Google sign-in failed." },
        { status: res.status || 401 },
      );
    }

    const { accessToken, user } = data.data;

    // Test lockdown: keep the same approved-account restriction as password login.
    if (!isEmailAllowed(user.email)) {
      return NextResponse.json(
        { success: false, message: "This app is in limited testing. Access is restricted to approved accounts." },
        { status: 403 },
      );
    }

    await createSession({ token: accessToken, user });
    return NextResponse.json({ success: true, message: "Signed in with Google." });
  } catch {
    return NextResponse.json(
      { success: false, message: "Could not reach the server. Please try again." },
      { status: 502 },
    );
  }
}
