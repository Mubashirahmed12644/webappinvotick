# 0090 — The QR scanner stays as it is

**Status:** decided by the owner on 2026-09-14 ("Jaisa hai").

**Related:** `memory/app-library-audit-2026-09-11.md`, "The owner's calls".

## Context

- **Device Link's QR scanner uses Google ML Kit** with its barcode model bundled in the app. That costs 323 KB per phone.
- **The scanner screen opened 12 times in 30 days,** as measured by the library audit of 2026-09-11.
- **Google Code Scanner does the same job and adds nothing to the app,** but it has two drawbacks:
  - it runs only where Google Play Services is present;
  - it would need new testing.

## Decided

- **Keep ML Kit.**

## Rejected

- **Google Code Scanner.** It saves 0.32 MB, about 2% of the app, but the scanner would stop working on phones without
  Play Services.

## Consequences

- **Nothing changes.** Revisit only if app size becomes a goal of its own.
