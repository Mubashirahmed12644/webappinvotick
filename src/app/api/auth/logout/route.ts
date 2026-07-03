import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { clearSession, getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();

  if (!config.mockMode && session?.token) {
    // Best-effort: tell the backend to revoke this session's token.
    await fetch(`${config.backendUrl}/v1/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
    }).catch(() => {});
  }

  await clearSession();
  return NextResponse.json({ success: true, message: "Logged out." });
}
