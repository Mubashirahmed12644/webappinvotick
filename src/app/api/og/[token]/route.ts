import { list, put } from "@vercel/blob";
import { renderOgCard } from "@/lib/og-card";

/**
 * Blob-backed OG card. The per-invoice card (real invoice summary) is rendered
 * ONCE and stored in Vercel Blob as a static PNG, then served from Blob's global
 * CDN — so every crawl in every region is instant (fixing the regional edge-cache
 * cold-MISS). Falls back to serving the freshly rendered image directly when Blob
 * isn't configured (e.g. local dev without BLOB_READ_WRITE_TOKEN).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const safe = token.replace(/[^a-z0-9]/gi, "").slice(0, 40);
  const blobPath = `og/${safe}.png`;
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  // 1. Already stored → redirect to the global Blob CDN.
  if (hasBlob) {
    try {
      const { blobs } = await list({ prefix: blobPath, limit: 1 });
      const hit = blobs.find((b) => b.pathname === blobPath);
      if (hit) return Response.redirect(hit.url, 302);
    } catch {
      /* fall through to render */
    }
  }

  // 2. Render the card once.
  const image = await renderOgCard(token);
  const buffer = Buffer.from(await image.arrayBuffer());

  // 3. Store it so future/other-region crawls get the static Blob.
  if (hasBlob) {
    try {
      const { url } = await put(blobPath, buffer, {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/png",
        cacheControlMaxAge: 31536000,
      });
      return Response.redirect(url, 302);
    } catch {
      /* fall through to serve directly */
    }
  }

  // 4. No Blob available → serve the rendered PNG directly.
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800",
    },
  });
}
