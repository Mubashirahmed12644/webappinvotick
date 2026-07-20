import "server-only";
import { config } from "./config";
import { getSession } from "./session";
import type { ApiResponse } from "./types";

// Server-side authenticated call to the Spring backend. The token lives in the
// httpOnly cookie and is attached here — it never reaches the browser.
export async function backendFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  return (await backendFetchWithStatus<T>(path, init)).body;
}

/**
 * The same call, with the HTTP status kept.
 *
 * The status matters in exactly one place: a session the backend has ended answers 401, and the
 * browser has to be sent back to sign-in rather than shown a failed request. Flattening every
 * failure to one shape lost that — a signed-out device looked identical to a validation error, so
 * the browser stayed on a page that could no longer load anything.
 */
export async function backendFetchWithStatus<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: ApiResponse<T> }> {
  const session = await getSession();
  const res = await fetch(`${config.backendUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      // Names the device on every call, which is what lets the backend refuse a session the owner
      // has signed out from their phone. It also keeps "Last active" honest in their device list.
      ...(session?.deviceId ? { "X-Device-Id": session.deviceId, "X-Platform": "WEB" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) {
    return {
      status: res.status,
      body: { success: false, message: `Request failed (${res.status}).`, data: null },
    };
  }
  return { status: res.status, body: json };
}
