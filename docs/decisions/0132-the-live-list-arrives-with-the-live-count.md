# 0132 — The live list arrives with the live count, and the two numbers say what they mean

- **Date:** 2026-09-20
- **Status:** built. `invotick-admin-panel` branch `fix/live-list-arrives-with-the-count` (`7c02d09`,
  stacked on `feat/live-events-show-build`). **Not deployed.** Panel only — no backend change, no
  migration, **no new query**.
- **Reported by the owner, 2026-09-20**, from the live panel: *"uper 5 live likha aa rha hy but list
  main user foran keon nhi dikhty"* — header "5 live", table "No matching active users".

## Decision

**The pushed stream's devices are merged into the user list, and the live number is counted off the
rows the page is about to draw.** A row now appears when the batch lands rather than at the next
poll, and the header can no longer contradict the table.

## Reproduced before changing anything

Against the current build, in a real browser:

| | before (`origin/main` 711c11e) | after (`7c02d09`) |
|:--|:--|:--|
| header | `Live users 1 live · 0 active` | `Live users 1 live (pichhle 1 minute) · 0 (22 Aug → 20 Sept)` |
| table | `No matching active users.` | the row |
| **a phone sends a batch → its row appears in** | **never (> 15 s)** | **33 ms** |

The "before" line is the owner's screenshot, reproduced.

## Three causes, one of them mine

1. **The two halves ran at different speeds.** The count comes from the pushed stream (instant); the
   list is a query — and decision 0121 had just slowed that query's beat from 5 s to 60 s. **"Live
   only" keeps a row only if `lastEventAt` is inside 60 s**, so rows arrived already 60–65 s old and
   the filter threw away nearly every one of them, permanently. That is a regression this file
   introduced, and this is the repair. It is also why the owner's table said *No matching active
   users* rather than showing stale rows.
2. **The two numbers meant different things on one line.** The count was **devices**, **last minute**,
   **no filters**. The list was **users**, **last thirty days**, **after the build and version
   filters**. Four differences, none of them written anywhere a reader could see.
3. **A device with no user id could be counted and never listed.** The count is keyed by device; the
   list's query is `user_id IS NOT NULL`. Measured on production the same day: **1 of 66** devices in
   an hour, **0 of 10** in five minutes. Small — but it is exactly the newest users, because the cold
   start fires before a guest session restores (the same reason decision 0114 keys the journey by
   device).

## What the two numbers mean now

| on screen | what it counts |
|:--|:--|
| **`N live (pichhle 1 minute)`** | phones that sent something in the last minute. **Counted off the rows about to be drawn**, so it cannot disagree with the table again. |
| **`M (22 Aug → 20 Sept)`** | users with any event in the chosen range, after the build and version filters. The range is printed beside it. |

A live phone that the page's own filters hide is **said out loud** — `2 filter ne chhupaye` — instead
of being left as an unexplained gap between the two numbers. A build filter hiding a live debug phone
is doing its job; a reader who cannot tell that it did is the defect.

## Cost

**None.** The stream already carried the devices — the server caps that list at 200 and the registry
at 1,000 (decision 0122). Reads per minute are **unchanged at 1** for the thirty-day list and **0**
for the live half. No heavy per-tick query was reintroduced.

## Details that matter

- **The stream's row wins on recency** (it is by definition the newer of the two). Everything that
  identifies a person — email, Invotick ID, role, country — comes from the polled row, because the
  stream does not carry it and inventing it would be a guess.
- **The page's build and version filters are applied to the streamed rows**, because the server
  applies them to the polled ones. Without that a debug phone would appear in a release-only list.
- **A phone with no user id is listed but not clickable**, with a tooltip saying why: the feed below
  is fetched by user id, so there is nothing to open. It is still listed, because it is on the app.
- **No flicker.** Rows keep stable keys, so React reuses the DOM node. An arriving row gets a 2.4 s
  tint that fades on its own and **never changes the row's height**, so nothing below it shifts. It
  honours `prefers-reduced-motion`.

## Verified

In a real browser against a stub that speaks the two real shapes, including the production 5.0 s cost
of the list read, for both the old build and the new one. `tsc --noEmit` clean, `next build` green,
lint unchanged at 27 problems / 7 errors, all pre-existing on `main`.

**Said plainly: this is not production traffic.** No admin credential is available here — the token in
memory is dead — so the 33 ms and the "never" are from that harness, not from the live panel. What
production would add is network latency to Vercel and back, which is tens of milliseconds, not
seconds.

## Rejected

- *Re-fetching the list whenever the pushed count changes.* It would reintroduce a 5 s, 671 MB read
  on every arrival — the exact cost decision 0122 removed.
- *Putting the range list's beat back to 5 s.* Same cost, and it would not fix causes 2 or 3.
- *Showing the stream's devices as a second list beside the first.* Two lists of the same people, and
  the reader would have to merge them by eye.
- *Widening "live" from 60 s so stale rows survive the filter.* That hides the lag rather than
  removing it, and makes the word "live" mean something the badge does not say.
- *Dropping the device-keyed rows so every row has a user.* It would keep the count and the list
  honest with each other by making both blind to the newest users.

## Open questions for the owner

1. Deploy order: this is stacked on `feat/live-events-show-build` (`ba9ff21`), which needs backend
   `df14db9`. Ship the two backend commits first, then the panel chain?
