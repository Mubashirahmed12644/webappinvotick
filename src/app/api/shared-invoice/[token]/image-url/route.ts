import { NextResponse } from "next/server";
import { config } from "@/lib/config";

/**
 * Current app-rendered image URL for a shared invoice, read fresh (no cache).
 *
 * The page's data read is cached (revalidate) so the OG crawl + repeat opens are fast, but that
 * means a receiver opening the link right after it's minted can get a cached response from BEFORE
 * the app finished uploading the pixel-perfect image — showing the HTML fallback until the cache
 * revalidates. The client polls THIS route (no-store) so it can pick up the image the moment it
 * lands and swap it in, independent of the page cache. Returns { imageUrl: string | null }.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const res = await fetch(
      `${config.backendUrl}/v2/shared-invoice/${encodeURIComponent(token)}`,
      { headers: { "Content-Type": "application/json" }, cache: "no-store" },
    );
    if (!res.ok) return NextResponse.json({ imageUrl: null });
    const json = (await res.json()) as { data?: { imageUrl?: string | null } } | null;
    let imageUrl = json?.data?.imageUrl ?? null;
    if (imageUrl && imageUrl.startsWith("/")) {
      imageUrl = `${config.backendUrl.replace(/\/$/, "")}${imageUrl}`;
    }
    return NextResponse.json({ imageUrl });
  } catch {
    return NextResponse.json({ imageUrl: null });
  }
}
