import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { getSession } from "@/lib/session";

// Streams an auth-protected backend image (/uploads/...) to the browser.
// The browser can't send the Bearer token, so we attach it here server-side.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const session = await getSession();
  if (!session?.token) {
    return new NextResponse(null, { status: 401 });
  }

  const safe = path.map(encodeURIComponent).join("/");
  const res = await fetch(`${config.backendUrl}/uploads/${safe}`, {
    headers: { Authorization: `Bearer ${session.token}` },
    cache: "no-store",
  });

  if (!res.ok || !res.body) {
    return new NextResponse(null, { status: res.status });
  }

  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
