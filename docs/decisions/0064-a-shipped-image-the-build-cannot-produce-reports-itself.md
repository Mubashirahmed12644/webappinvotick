# 0064 — A shipped image the build cannot produce reports itself

- **Date:** 2026-09-12
- **Status:** decided (owner, 2026-09-12, on the user-journey agent's recommendation: "a panel-visible
  signal for a missing bundled image", shape left to the event owner); built for 1.4.6 on
  `invoice-kmp-app` `feat/146-journey-instrumentation`, not merged.
- **Decision:** A new coded event, **`bundled_image_unavailable`**, is sent when `BundledImage.read`
  cannot produce an image a row names. It is sent once per image and failure per process. Its
  parameters:
  - `image`: our asset name, e.g. `header_7`;
  - `stored_ext`: the extension the row was written with, `png` up to 1.4.4 and `webp` from 1.4.5;
  - `failure`: `not_in_build` (no image by that name in this build) or `read_failed` (the name
    exists and reading its bytes threw);
  - `exception_class`: on `read_failed` only.

  The gateway stamps `screen`, which tells where the image was needed. The event travels
  `data` → `BundledImageReportPort` → `AnalyticsBundledImageReporter` (composeApp) → `trackClick`.

## Why

- Until now the failure printed one line to logcat, on the user's phone.
- 1.4.5 turned the shipped images into WebP and deleted 34 duplicate files. Rows written by older
  builds keep `.png` paths for as long as the install lives, and `BundledImage` resolves them by name.
  A name that resolves to nothing leaves a header, template or background blank on the invoice. To the
  user that is lost data (G3).
- Production cannot count it today: no event about an image exists (0 rows under any
  `%bundled%` / `%image_missing%` name in 60 days).
- The decision it changes: which image name a release must restore or alias, and whether 1.4.5's
  image change left anyone with a blank document.

## Rejected

- **A parameter on an existing event.** Nothing fires at the moment an image is read. The readers are
  the invoice render, the template picker and the header lists; a parameter on any one user action
  would cover one of them.
- **`sync_failed` with a new stage.** It is not sync, and it would land on the Sync Health card.
- **An event per read.** A header is read on every render. One row per process answers "which
  devices, which image, which build".
- **The full stored path.** The name and extension are the facts. The path adds nothing and is a
  wider string to validate.
- **Two event names for the two failures.** One fact, one name; `failure` is the variation (§1.1).

## Consequences

- AGENTS.md §5b lists the event and its parameters.
- Live Events and Discovery show it without a mapping. Its display name and layer are set in Discovery
  once the first row arrives; no release is needed for that.
- **Owed, and a Health Centre card by the standing rule:** a `HealthCheck` counting devices with this
  event on the current build. Not built with this change.
- Tests: `BundledImageUnavailableTest` cover the report, once per image, a reporter that throws, the
  read-failed class, and out-of-shape values dropped.
