"use client";

// Small helper for client components to call the authenticated backend proxy.
export async function apiSend<T = unknown>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<{ success: boolean; message: string; data: T | null }> {
  try {
    const res = await fetch(`/api/backend${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body != null ? JSON.stringify(body) : undefined,
    });
    // A session the server has already ended.
    //
    // Signing this browser out happens on the phone, so nothing here hears about it. Left alone the
    // cookie stays, every call answers 401, and the app sits there broken with no way back to the
    // sign-in page — the redirect for logged-in users sends /login straight back to the app. Going
    // there with ?signout=1 is what drops the cookie.
    if (res.status === 401) {
      window.location.href = "/login?signout=1";
      return { success: false, message: "This device was signed out.", data: null };
    }

    return await res.json();
  } catch {
    return { success: false, message: "Network error. Please try again.", data: null };
  }
}

export const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
