# 0046 — A sent link retires only when its replacement is sent

**Status:** decided, built · **Date:** 2026-09-10 · **Goals:** G3 (trust), G2 (the share loop)

## What happened

A share link is the whole client loop: the sender taps Send, a card lands in the client's WhatsApp,
the client taps it. When the token behind the card is revoked, the client reads *"This link is no
longer available"* — from a business that has just invoiced them. Nothing fails on the sender's side,
so nobody saw it.

Measured on production:

| Window | Sent links | Died before the client opened them |
|---|---:|---:|
| 30 days to 2026-09-09 | 190 | **51 (27%)** |
| 2026-09-09 13:45 → 2026-09-10, after the first fix | 15 | **3** |

## Why

Three places mint a share for one invoice: the Invoice Created screen's pre-warm, the Online preview
tab, and Send. The server decided "is this the same invoice" by comparing the whole snapshot JSON, and
that snapshot is not byte-stable — its images are re-encoded from fresh bitmap instances each time a
screen opens, against a cache keyed on instance identity. Any difference revoked the existing link.

- **2026-09-09** closed the pre-warm path: re-opening an already-sent invoice ran the pre-warm and
  killed the client's link.
- **2026-09-10** found the same death through Send. All three post-fix cases, all on 1.4.4: the sender
  re-opened a sent invoice, pressed Send, and cancelled the sheet. The app mints the new link before
  the sheet opens, so the client's link was already gone and its replacement reached nobody. Two of
  the three were real edits — a signature or stamp added after sending — and one changed only image
  bytes (same two images, 43,786 → 47,218 bytes).

## Decision

1. **`create()` never revokes a sent link** — not for a pre-warm, not for a send. It mints the new
   token and leaves the sent one live.
2. **`markShared()` retires it.** When a newer token for the same document is confirmed sent, the
   owner's older, sent, active tokens are revoked and their preview images reclaimed.
3. **A token nobody holds is still replaced at once**, as before.
4. **Content, not bytes.** Every embedded `data:image` compares as the same marker: a re-encode is not
   an edit; an image appearing or disappearing still is.

The documented reason for superseding at all is kept whole: an edited invoice still reaches the
receiver as a new URL (a fresh OG card) with approval reset. Only the moment moved — from "a new link
exists" to "a new link was sent".

## Rejected

- **Keep revoking at `create()`** — the defect.
- **Never revoke old links** — a receiver could approve an amount that is no longer the amount.
- **Answer a changed, sent invoice with the old token** (the 2026-09-09 guard) — kept the link alive
  but handed new content the old URL, which the app then cached as the prepared link for the new
  content. Folded into rule 1.
- **Compare only total and number** — misses edits to items, notes and terms.
- **Hash each image instead of masking it** — would keep "logo swapped" as an edit; the swap is
  cosmetic on a link already sent, and not worth a hash over every re-share.

## Consequences

- A cancelled re-send is free. A confirmed re-send still retires the older link.
- An invoice can briefly have two live links, the sent one and an unsent successor. Harmless: the
  successor has no holder until it is sent, and a pre-warmed one expires on its TTL.
- A swapped logo is not treated as an edit.

## How we will know

`DeadSharedLinksCheck` in the Health Centre counts sent links revoked before anyone opened them over a
rolling 30 days, against the 26.8% baseline. It is not expected to reach zero — a sender who edits and
re-sends *should* retire the old link — but it should fall to that floor. If it does not, start at
`supersedeOlderSentLinks` and any explicit revoke.

Tests: `SentLinkSurvivesPrewarmTest` — 8 cases, both directions.
