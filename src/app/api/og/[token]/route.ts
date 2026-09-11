import { renderOgCard } from "@/lib/og-card";

/**
 * The share link's OG card: rendered on demand, kept by the edge cache, stored nowhere (decision 0054).
 *
 * The first fetch of a card in a region renders it (1.5–2.2 s). After that the edge answers from its
 * cache for `s-maxage` (7 days), and `stale-while-revalidate` lets it go on answering while a single
 * request re-renders in the background. The page links the card as `?v=<hash of the invoice>`, so an
 * edited invoice is a different URL: it never waits out the old card, and crawlers fetch it afresh.
 *
 * There was a Vercel Blob path here. Production never had BLOB_READ_WRITE_TOKEN, so every response
 * said `rendered-no-blob` and nothing was ever stored. Making it store would have meant paying for the
 * storage plus a TTL and a clean-up job (AGENTS.md invariant 3) to keep a copy of what the edge cache
 * already keeps.
 *
 * `x-og-path: rendered` stays on every response, for diagnosis.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const image = await renderOgCard(token);
  // Buffered rather than streamed: a render that fails has to fail here, as an error the edge does
  // not keep, rather than halfway through a 200 it would keep for a week. The headers are set here
  // because ImageResponse brings its own Cache-Control (immutable, one year).
  const png = await image.arrayBuffer();
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=604800",
      "x-og-path": "rendered",
    },
  });
}
