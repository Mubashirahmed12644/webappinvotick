# 0054 — The share link's card is rendered on demand and cached at the edge, with no Blob storage

**Status:** decided (the owner, 2026-09-11, item 13: "storage hata dein").
**Date:** 2026-09-11.
**Related:** AGENTS.md invariant 3 (storage is money).

## Context

- The OG route (`src/app/api/og/[token]/route.ts`) could store rendered cards in Vercel Blob.
- Production never had `BLOB_READ_WRITE_TOKEN`. Every response says `x-og-path: rendered-no-blob`,
  so nothing was ever stored.
- Each region's first fetch renders the card, taking 1.5–2.2 s. After that the edge cache answers,
  with `s-maxage` of 7 days.

## Decision

- Remove the Blob path.
- The card is rendered on demand and cached by the edge.
- Nothing is stored, so nothing needs a TTL or a clean-up job.

## Rejected

- **A Blob token plus a TTL clean-up job.** It pays for storage and a job to keep a copy of what the
  edge cache already keeps.

## Consequences

- The route loses its Blob code.
- `x-og-path` stays, reading `rendered`, for diagnosis.
