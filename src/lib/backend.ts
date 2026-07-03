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
  const session = await getSession();
  const res = await fetch(`${config.backendUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) {
    return { success: false, message: `Request failed (${res.status}).`, data: null };
  }
  return json;
}
