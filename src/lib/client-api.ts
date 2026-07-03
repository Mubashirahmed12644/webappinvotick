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
    return await res.json();
  } catch {
    return { success: false, message: "Network error. Please try again.", data: null };
  }
}

export const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
