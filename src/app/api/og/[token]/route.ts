import { renderOgCard } from "@/lib/og-card";

/**
 * The share link's OG card: rendered on demand, kept by the edge cache, stored nowhere (decision 0054).
 *
 * The first fetch of a card in a region renders it (1.5–2.2 s). After that the edge answers from its
 * cache for `s-maxage` (7 days), and `stale-while-revalidate` lets it go on answering while a single
 * request re-renders in the background. The page links the card as `?v=<hash of the invoice>`, so an
 * edited invoice is a different URL: it never waits out the old card, and crawlers fetch it afresh.
 *
 * The week is for the invoice's own card only. When the backend's answer was not the invoice (the
 * read failed, or the link is dead), the card is the generic one, and a week of that would outlast
 * the failure: the edge would go on handing crawlers "A business" long after the backend was back.
 * So the generic card is kept for a minute, and a failed render is not kept at all.
 *
 * There was a Vercel Blob path here. Production never had BLOB_READ_WRITE_TOKEN, so every response
 * said `rendered-no-blob` and nothing was ever stored. Making it store would have meant paying for the
 * storage plus a TTL and a clean-up job (AGENTS.md invariant 3) to keep a copy of what the edge cache
 * already keeps.
 *
 * `x-og-path: rendered` stays on every rendered response, for diagnosis, and `x-og-link-state` says
 * which card it is (the link states of shared-invoice.ts). A failed render answers `x-og-path: error`.
 */
const CARD_CACHE = "public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800";
const FALLBACK_CACHE = "public, max-age=0, s-maxage=60";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  try {
    const { image, state } = await renderOgCard(token);
    // Buffered rather than streamed: a render that fails has to fail here, inside this try, rather
    // than halfway through a 200. The headers are set here because ImageResponse brings its own
    // Cache-Control (immutable, one year).
    const png = await image.arrayBuffer();
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": state === "active" ? CARD_CACHE : FALLBACK_CACHE,
        "x-og-path": "rendered",
        "x-og-link-state": state,
      },
    });
  } catch (err) {
    console.error("[og] render failed", err);
    return new Response(null, {
      status: 500,
      headers: { "Cache-Control": "no-store", "x-og-path": "error" },
    });
  }
}
