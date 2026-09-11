import { list, put } from "@vercel/blob";
import { renderOgCard } from "@/lib/og-card";

/**
 * Blob-backed OG card. The per-invoice card (real invoice summary) is rendered
 * ONCE and stored in Vercel Blob as a static PNG, then served from Blob's global
 * CDN — so every crawl in every region is instant (fixing the regional edge-cache
 * cold-MISS). Falls back to serving the freshly rendered image directly when Blob
 * isn't configured (e.g. local dev) or refuses the write.
 *
 * `x-og-path` on every response says which of those happened. From outside the two fallbacks were
 * the same 200 PNG: on 2026-09-11 production was found serving that on every fetch, and nothing said
 * whether Blob was missing or failing.
 *   blob-hit          — stored earlier; 302 to the Blob URL
 *   rendered-stored   — rendered and stored now; 302 to the Blob URL
 *   rendered-unstored — Blob is configured but failed (the error is logged); PNG served directly
 *   rendered-no-blob  — no Blob credentials in this deployment; PNG served directly
 */
type OgPath = "blob-hit" | "rendered-stored" | "rendered-unstored" | "rendered-no-blob";

// Built by hand because Response.redirect() returns immutable headers.
const redirectTo = (url: string, path: OgPath) =>
  new Response(null, { status: 302, headers: { Location: url, "x-og-path": path } });

const describe = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const safe = token.replace(/[^a-z0-9]/gi, "").slice(0, 40);
  // Version by content: the page passes ?v=<hash of the invoice> so an edited invoice (e.g. a new
  // total) maps to a NEW blob key and re-renders, instead of forever serving the first render. A
  // changed OG image URL also makes crawlers re-fetch on re-share.
  const v = (new URL(req.url).searchParams.get("v") ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 20);
  const blobPath = v ? `og/${safe}-${v}.png` : `og/${safe}.png`;
  // @vercel/blob 2.x resolves its own credentials: a read-write token, or — on Vercel — the request's
  // OIDC token plus BLOB_STORE_ID. Checking only the token skipped Blob for a store connected the
  // second way, so accept either and let the SDK decide.
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

  // 1. Already stored → redirect to the global Blob CDN.
  if (hasBlob) {
    try {
      const { blobs } = await list({ prefix: blobPath, limit: 1 });
      const hit = blobs.find((b) => b.pathname === blobPath);
      if (hit) return redirectTo(hit.url, "blob-hit");
    } catch (e) {
      console.error(`[og] Vercel Blob list() failed for ${blobPath}, rendering instead: ${describe(e)}`);
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
        // The path is versioned by the invoice's content, so a blob already there is this same card
        // (list() failed, or two first fetches raced). The SDK defaults this to false, and the server
        // then refuses the write — which would send this fetch down the unstored path.
        allowOverwrite: true,
        contentType: "image/png",
        cacheControlMaxAge: 31536000,
      });
      return redirectTo(url, "rendered-stored");
    } catch (e) {
      console.error(`[og] Vercel Blob put() failed for ${blobPath}, serving the card unstored: ${describe(e)}`);
    }
  }

  // 4. No Blob, or Blob refused → serve the rendered PNG directly.
  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800",
      "x-og-path": hasBlob ? "rendered-unstored" : "rendered-no-blob",
    },
  });
}
