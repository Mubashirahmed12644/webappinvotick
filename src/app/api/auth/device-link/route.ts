import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { config } from "@/lib/config";
import { createSession } from "@/lib/session";
import type { ApiResponse } from "@/lib/types";

/**
 * Signing in by scanning a code with the phone.
 *
 * The only door most users have. Nearly all Invotick accounts are guests — no email, no password,
 * not tied to a Google account — so email sign-in and Google sign-in are both closed to them, and
 * without this the web app is something they can never open at all, premium or not.
 *
 * The browser is the side asking to be let in: it requests a code, shows it, and waits for the
 * phone to approve. Nothing here is secret until the phone agrees, which is why this route needs no
 * session of its own.
 */

/**
 * A name the person approving will recognise.
 *
 * The approval screen on the phone asks them to hand over the whole account, and "Web browser"
 * tells them nothing they can check against — every browser is a web browser. "Chrome on Windows"
 * is something they can compare with the machine actually in front of them, which is the only way
 * that screen protects anybody.
 *
 * Deliberately coarse. The point is recognition, not fingerprinting, and a full user-agent string
 * would be both unreadable and more than is needed.
 */
function describeBrowser(userAgent: string): string {
  const browser =
    /Edg\//.test(userAgent) ? "Edge"
    : /OPR\/|Opera/.test(userAgent) ? "Opera"
    : /Firefox\//.test(userAgent) ? "Firefox"
    // Chrome's user-agent also claims Safari, so Safari is only what is left after ruling Chrome out.
    : /Chrome\/|CriOS/.test(userAgent) ? "Chrome"
    : /Safari\//.test(userAgent) ? "Safari"
    : "Browser";

  const os =
    /Windows/.test(userAgent) ? "Windows"
    // iOS before Mac: an iPhone's user-agent says "like Mac OS X", so checking for Mac first
    // labels every iPhone a Mac — and the whole point of this name is that it matches the thing
    // the user is looking at.
    : /iPhone|iPad|iPod/.test(userAgent) ? "iOS"
    : /Android/.test(userAgent) ? "Android"
    : /Macintosh|Mac OS X/.test(userAgent) ? "Mac"
    : /Linux/.test(userAgent) ? "Linux"
    : null;

  return os ? `${browser} on ${os}` : browser;
}

/** Asks the backend for a code to display. */
export async function POST() {
  try {
    const userAgent = (await headers()).get("user-agent") ?? "";

    const res = await fetch(`${config.backendUrl}/v1/device-link/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // WEB also tells the backend to issue a shorter session than a phone gets: a browser is
      // often someone else's computer.
      body: JSON.stringify({ deviceName: describeBrowser(userAgent), platform: "WEB" }),
    });
    const data = (await res.json()) as ApiResponse<{ code: string; expiresAt: string }>;

    if (!data.success || !data.data) {
      return NextResponse.json(
        { success: false, message: data.message || "Could not start sign-in." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, data: data.data });
  } catch {
    return NextResponse.json({ success: false, message: "Could not reach the server." }, { status: 502 });
  }
}

/**
 * Polled by the browser while the user is at their phone.
 *
 * "Not yet" is the normal answer, so it comes back as a plain success:false rather than an error —
 * a browser polling every few seconds should not be filling a console with failures for behaving
 * exactly as intended.
 */
export async function PUT(request: Request) {
  const { code, deviceId } = (await request.json().catch(() => ({}))) as {
    code?: string;
    deviceId?: string;
  };
  if (!code) {
    return NextResponse.json({ success: false, message: "No code." }, { status: 400 });
  }

  try {
    const res = await fetch(`${config.backendUrl}/v1/device-link/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Sent so the browser is registered as a linked device. Without it the session worked but
      // never appeared in the owner's device list, which meant they could neither see the sign-in
      // nor end it.
      body: JSON.stringify({ code, deviceId }),
    });
    const data = (await res.json()) as ApiResponse<{
      accessToken: string;
      userId: string;
      shortCode: string | null;
    }>;

    if (!data.success || !data.data?.accessToken) {
      return NextResponse.json({ success: false, message: "Not approved yet." });
    }

    await createSession({
      token: data.data.accessToken,
      user: {
        id: data.data.userId,
        // A guest has no name or email to show; the Invotick id is what they can recognise, and
        // inventing a placeholder would only make the account look like somebody else's.
        username: data.data.shortCode ? `Invotick ${data.data.shortCode}` : "My account",
        email: "",
        role: "USER",
        isEmailVerified: false,
        createdAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, message: "Could not reach the server." }, { status: 502 });
  }
}
