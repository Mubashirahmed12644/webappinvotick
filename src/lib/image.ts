// Backend images (/uploads/...) are auth-protected and some URLs come back as
// http://localhost:8081/... — normalize any raw value to a webapp proxy URL that
// streams the bytes with the auth token attached server-side.
/**
 * The file an image address names: the address without its fragment (decision 0181 — the app writes
 * `#generated-logo` on a logo it drew). Everywhere an address becomes a request goes through this, so the mark never
 * reaches a server or a cache key. The app (`ImageAddress.file`) and the backend (`ImageAddress.file`) do the same.
 */
export function imageFile(address: string): string {
  const hash = address.indexOf("#");
  return hash === -1 ? address : address.slice(0, hash);
}

export function imageProxyUrl(raw?: string | null): string | null {
  if (!raw) return null;
  // Already-usable client-side images (e.g. the free-invoice tool's locally
  // uploaded logo) are passed straight through — nothing to proxy.
  if (raw.startsWith("data:") || raw.startsWith("blob:")) return raw;
  // Locally-bundled system-default assets are served directly, not proxied.
  if (raw.startsWith("/system-assets/")) return raw;
  const file = imageFile(raw);
  let path = file;
  if (file.startsWith("http://") || file.startsWith("https://")) {
    const slash = file.indexOf("/", file.indexOf("//") + 2);
    path = slash === -1 ? "/" : file.slice(slash);
  }
  if (!path.startsWith("/uploads/")) return null;
  // /uploads/abc.png -> /api/img/abc.png
  return "/api/img" + path.slice("/uploads".length);
}
