# 0089 — UXCam leaves the app

**Status:** decided by the owner on 2026-09-14 ("Nahi, nikal do"). **Built** for 1.4.6 as `d4fb2ac7`: 26 files, 355
lines fewer, 7 files deleted. `git grep -i uxcam` finds nothing.
- The two image-crop libraries had already left on 2026-09-13 (`f142237c`).
- **Found: on Android, UXCam started on every cold start, even with the key empty.** The app saved Remote Config's
  `""`, and the splash checked only for null, so it called `startWithConfiguration("")`. Our code cannot show what
  UXCam does with an empty key.
- **The `UX_Cam` Remote Config key must stay empty** while builds up to 1.4.5 are on phones. They still read it on
  every launch, so a key placed there would start recording on those phones at once.

**Related:**
- `memory/app-library-audit-2026-09-11.md`;
- G3, trust.

## Context

- **UXCam is session replay.** It can record a user's screens.
  - Here those screens hold invoices, client names, amounts and phone numbers.
  - The recordings go to an outside service.
- **It is switched on by Remote Config `UX_Cam`,** which defaults to empty. Nobody knew whether it was on. The owner does
  not watch the recordings.
- **Cost on the phone:** 379 KB, together with the Material library it pulls in.
  - It is declared in 5 modules that never import it.
  - Its `screenaction` part is one of the two sources of an exported `PreviewActivity` in release, a screen any app on
    the phone can open.

## Decided

- **Remove UXCam everywhere:** its dependencies, its start-up code, its gate and its rules.
- **With it, remove the two image-crop libraries that nothing imports,** `network.chaintech:cmp-image-pick-n-crop` and
  `com.attafitamim.krop`.
  - Their POMs pull test libraries into release.
  - They export three `InstrumentationActivityInvoker` test screens.

## Rejected

- **Keeping UXCam, and first checking whether it records.** The owner does not use the recordings, and data that is
  never recorded cannot leak.

## Consequences

- **About 0.39 MB less per phone,** plus the crop libraries' share.
- **The release manifest should lose the exported test screens.** Check that in the 1.4.6 build.
- **The Remote Config key `UX_Cam` stays on the server, unused.**
