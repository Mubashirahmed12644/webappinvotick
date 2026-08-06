# 0018 — The shared invoice image is gone; HTML is the only render

**Date:** 2026-08-07
**Status:** accepted, built
**Touches:** `Webinvotick`, `invoice-kmp-app`, `invotick-apis`

## The decision

A receiver is shown the **HTML render of the snapshot**, everywhere, and nothing else. The app no
longer renders an image of the invoice and uploads it, the backend no longer accepts or stores one,
and the web no longer has code to display one.

The other two share modes are untouched and stay as they are: **image** and **pdf** deliver a file
straight to the OS share sheet. They never involve a WebView, a link or the backend.

## Why

The upload chain was already dead at its last mile, and had been since the share page moved to the
HTML render. Traced end to end:

| Step | State |
|---|---|
| App renders a full-resolution image of the invoice | ran on every share |
| App uploads it (`POST /v2/shared-invoice/{token}/image`) | ran, on the user's data |
| Backend stores it under `uploads/shared/{token}.webp` | ran, on disk, forever until TTL |
| Web `/api/shared-invoice/{token}/image-url` serves it | existed |
| Web `ZoomableImage.tsx` displays it | **zero call sites** |
| `SharedInvoiceViewer` — what the page actually renders | `A4PagedFrame`, never touched `imageUrl` |

So senders paid a render, an upload and permanent server storage so that a component nobody mounted
could have shown a picture. That is invariant #3 (storage is money) being violated to no end.

The one real consumer was **inside the app**: the receiver's approval screen (`ReceivedInvoiceScreen`)
did show the uploaded image. It now renders `/embed/render?token=` in the same `InvoiceHtmlWebViewUrl`
every preview screen uses — so the receiver sees literally the sender's render, not a photo of it.

## What this fixes beyond the waste

The image had two failure modes the HTML render does not have:

1. **It expired.** The cleanup job TTL-deletes preview images, after which the receiver's screen said
   "Preview isn't available, but you can still respond below." The snapshot behind the token does not
   expire, so the render cannot.
2. **It arrived late.** The upload fired *after* the share sheet opened, so a receiver who opened the
   link quickly got nothing. Nothing to race now.

It also removes the reason the web page revalidated every 15 seconds — that window existed only to
catch the late upload. It is 300s now; approval status is pushed via `revalidateTag`, not polled.

## What was deliberately kept

- **The `image_url` column, and the cleanup job that nulls it.** Only the *write* path was removed.
  Deleting the drain along with the source would have stranded every file already on disk. Flyway has
  no rollback, so dropping the column is not something to do casually either — see
  `memory/deploy-safety-schema-changes.md`.
- **`FileStorageService.deleteSharedPreview`** — same reason, it is the drain.
- **The `image` and `pdf` share modes**, including the offline fallback that shares an image when
  minting a link fails. Those hand the receiver a file directly; they were never part of this.

## Rejected

- **Building `uploadShareImage` for estimates**, which is what the backlog actually asked for. It
  would have doubled a cost that produces nothing.
- **Giving estimates an `image` share mode.** Estimates have no native bitmap path, and adding one
  means a *new* dependency on the Compose-Canvas renderer that the north star (§3) exists to delete.
  Estimates keep `pdf` and `link`.
- **Dropping `image_url` and deleting `uploads/shared/` now.** Right eventually, wrong as part of a
  change whose point is to stop writing. Ship the stop, let the drain run, remove the column later.

## Note on released versions

App v90 and every earlier release still POST to `/{token}/image`, which now 404s. This is safe by
construction: the client call was fire-and-forget inside `runCatching` with the result discarded, so
a failure changes nothing the sender sees — and the 404 is what stops those versions from continuing
to fill the disk.
