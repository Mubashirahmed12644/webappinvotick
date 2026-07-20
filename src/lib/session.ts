import { cookies } from "next/headers";
import { config } from "./config";
import type { User } from "./types";

// The session cookie stores the backend accessToken plus a small snapshot of
// the user so we can render the shell without an extra round-trip.
interface SessionData {
  token: string;
  user: User;
  /**
   * Which linked device this session is, so the backend can refuse it once it is signed out.
   *
   * Revocation is enforced per device: the backend only checks whether a session has been ended if
   * the request says which device it belongs to. Without this the phone's "sign out" marked the row
   * revoked, reported success, and the browser carried on working — a control that says it did
   * something and did not.
   */
  deviceId?: string;
}

const MAX_AGE = 60 * 60 * 24 * 60; // 60 days (backend token lives 90)

export async function createSession(data: SessionData) {
  const jar = await cookies();
  jar.set(config.authCookie, JSON.stringify(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<SessionData | null> {
  const jar = await cookies();
  const raw = jar.get(config.authCookie)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(config.authCookie);
}
