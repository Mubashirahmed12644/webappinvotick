// Backend images (/uploads/...) are auth-protected and some URLs come back as
// http://localhost:8081/... — normalize any raw value to a webapp proxy URL that
// streams the bytes with the auth token attached server-side.
export function imageProxyUrl(raw?: string | null): string | null {
  if (!raw) return null;
  // Locally-bundled system-default assets are served directly, not proxied.
  if (raw.startsWith("/system-assets/")) return raw;
  let path = raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const slash = raw.indexOf("/", raw.indexOf("//") + 2);
    path = slash === -1 ? "/" : raw.slice(slash);
  }
  if (!path.startsWith("/uploads/")) return null;
  // /uploads/abc.png -> /api/img/abc.png
  return "/api/img" + path.slice("/uploads".length);
}
