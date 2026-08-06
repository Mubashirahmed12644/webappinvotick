# 0017 — On the shared link, Android installs the app for a PDF; everyone else downloads in the browser

**Date:** 2026-08-07
**Status:** accepted, not yet built
**Touches:** `Webinvotick` — `src/app/i/[token]/page.tsx`, `src/lib/og-card.tsx`

## The decision

The receiver of a share link gets a PDF. How they get it depends on what they are holding:

| Platform | PDF |
|---|---|
| **Android** | install the app, and download it there |
| **iOS** | download and print in the browser |
| **Desktop** | download and print in the browser |

The page already knows which: `detectPlatform()` returns `"android" | "ios" | "desktop"` from the
user agent, and the desktop QR already branches on it.

## Why the split, and why it is not permanent

Android sends the receiver to the app because that is where the growth loop lives — G2 asks that our
users' clients become users themselves, and a shared document is the only moment they are already
holding the product and wanting something from it. A download that satisfies them in the browser
spends that moment.

Everyone else downloads in the browser for a plainer reason: **there is no iOS app to install.** The
iOS target is mostly stubs. Sending an iPhone user to an App Store listing that does not exist would
be worse than no PDF at all, and desktop has nowhere to send them either.

**So half of this rule has an expiry date.** The iOS branch exists because iOS cannot install, not
because browsers should download. When the iOS app ships, iOS moves to the Android behaviour and
this table has two rows, not three. Whoever ships iOS should come back here.

## What this is not

Not a paywall and not an ad gate. The document is fully readable on the page either way — the render
is the same `<InvoiceDocument>` the sender sees. Only the *file* is behind the install on Android.
Someone who does not want the app still gets the invoice, they just cannot save it as a PDF on that
device.

## Rejected

- **Browser download everywhere.** Simplest, and it throws away the single best moment in the growth
  loop: a person holding the product, on Android, wanting something from it.
- **Install-gate everywhere.** Would show iPhone and desktop users a wall with nothing behind it.
- **A "maybe later" download link under the install prompt on Android.** Every receiver takes it, so
  it is browser-download-everywhere with extra steps.

## Still open

The claim has to come back when the feature does. It was removed in `a7f35a3` because the OG card
promised "View & download the invoice (PDF)" and no download existed. Both places carry the promise
and must be changed together:

- `src/lib/og-card.tsx` — the line now reading "View this invoice" / "View this estimate"
- `src/app/i/[token]/page.tsx` — the `description` in `generateMetadata`

## What the OG card should say

The card promises the OUTCOME, not the mechanism: "download the PDF", on every platform.

That is true everywhere. The receiver does get a PDF — on iOS and desktop in one click, on Android
after installing. The path differs; the result does not, and a card that says "download the PDF" is
not lying to an Android user, it is just not listing the steps.

The card must NOT say "install the app to get the PDF", even though that is what Android will ask
for. Two reasons:

1. **It front-loads the cost before any value is shown.** The card is read before the link is
   opened. Someone who sees an install demand at that point has not yet seen the document, so the
   ask has nothing behind it — and many will simply not open it. The install belongs after the
   document is on screen, when the receiver has something they want to keep.
2. **The card cannot know the platform anyway.** It is rendered once and cached per token, long
   before anyone opens it, so any platform-specific wording would be wrong for someone.

An earlier draft of this decision said the card should "promise only what is true everywhere" and
treated that as a limitation. It is not one: downloading the PDF *is* true everywhere.
