# 0123 — A filter the reader chose stays chosen, and the build filter starts at release

- **Date:** 2026-09-20
- **Status:** built, on `invotick-admin-panel` branch `feat/live-now-stream` (`711c11e`, with 0122
  because both touch the Live Events page). **Not deployed.** Panel only.
- **Asked for by the owner, 2026-09-20:** *"is form main default main build release set kero. Aur
  main ny daikha hy ky bohat sary pages jab reload kerty hain to wo default setting per reload ho
  jaty hain, jabky unko last setting per reload hona chahiye — jo international asool hy us ke
  mutabiq setting kero."*

## Decision

1. **Live Events' build filter defaults to `release`.** It defaulted to `debug`
   (`useState<BuildFilter>("debug")`), which is why every request in the nginx log on 2026-09-20
   carried `buildType=debug`: the page had been answering about our own test phones unless the owner
   re-picked the filter each time.
2. **Every filter on every page survives a reload, Back, Forward and a copied link**, through one
   shared hook, `useStickyState` in `lib/stickyFilters.ts`.

**Where a value comes from, in this order:**

1. **the URL** — it always wins; it is what makes Back, Forward and a pasted link work, and the only
   one of the three a person can see and edit;
2. **what that page was last set to**, kept in `localStorage` under one key per page, used when the
   URL says nothing, so opening a page fresh returns the reader where they were;
3. **the default** (build = `release`).

## Pages and filters covered

| page | filters made sticky |
|:--|:--|
| Live Events | build, version, date range, sort, role, live-only, rows shown, and the reporting table's own build / range / sort |
| Funnel Analysis — Pehli invoice ka safar | date range, build, version, ui mode |
| Funnel Analysis — the funnel query | by, mode, platform, version, os, country, city, max step minutes |
| Users | activity, sort key, sort direction |
| Inventory items | sort key, sort direction |
| Screen flow | view (list / graph) |
| Users map | map style, cluster threshold, above, below |
| IP stats | minimum users, sort direction |

## Why it is built this way

- **The URL is read from `window.location`, not `useSearchParams`.** `useSearchParams` makes a page
  opt out of static rendering unless it sits inside a `<Suspense>` boundary. Every page here is
  `"use client"` and fetches in an effect anyway, so that would be a build-time constraint bought
  for nothing — and all 24 pages still build static.
- **The URL is written with `history.pushState`, not the router.** Next 16 patches
  `pushState`/`replaceState` so the App Router follows an external change
  (`next/dist/client/components/app-router.js`). The route is therefore not re-navigated: no server
  round trip, no remount, and the page's own state — the open live-now stream, the loaded feed —
  survives a filter change. `router.push` would remount the route for a value that never leaves the
  browser.
- **`pushState` for a change, `replaceState` on arrival.** A filter change is somewhere the reader
  can go Back from, which is what every other site does. Arriving at a page is not.
- **One write per change, not one per filter.** Setters add to one batch flushed on the next
  microtask, so picking a preset range — which sets two values — changes the URL once and every
  effect that depends on it runs once. That is the rule the polling work of 0121 and 0122 needs:
  changing a filter must not fire a heavy fetch more than once. Verified in a browser: two filters
  changed together added exactly **one** history entry.
- **The hook is shaped like `useState`**, value or updater, so a page adopts it one line at a time
  rather than being rewritten.
- **A value the URL does not recognise is ignored, not trusted.** `stickyOneOf` takes the allowed
  list; anything else falls through to what was remembered, then to the default.

## What never goes in the URL

**Free text.** The search boxes on these pages hold an email or a user id, and a URL is copied,
pasted into chat and kept in browser history. Those stay ordinary component state and are forgotten
when the page closes (`remember: false`). Nothing sensitive is written to `localStorage` either.

## Verified by hand

The panel has no test suite (its own `CLAUDE.md` says so), so the hook was driven in a real headless
browser against `next dev` on a throwaway page, since deleted. **14 checks, all pass:**

| | |
|:--|:--|
| first visit, nothing remembered | uses the default, `build=release` |
| first visit | writes what is on screen into the URL, so a copy is shareable |
| a change | reaches the URL **and** `localStorage` |
| reload | keeps the chosen value |
| Back / Forward | return to the previous / next filter |
| a shared link | beats what this browser remembered |
| two filters together | one history entry, both values in the one URL |
| a date range | readable as `2026-01-02..2026-01-09`, survives reload |
| a junk URL value | falls back to what was remembered, then to the default |

`tsc --noEmit` clean, `next build` green, all 24 pages still static, lint unchanged at 27 problems /
7 errors — every one of them already on `main`.

## Rejected

- *`useSearchParams` + `<Suspense>`.* A build-time constraint on every page, for a value that never
  leaves the browser.
- *`router.push` / `router.replace`.* Remounts the route, which would drop the live-now stream 0122
  just opened.
- *One opaque parameter per page (a packed object or base64).* The URL is meant to be read and
  edited; `?build=release&ver=106&range=2026-08-22..2026-09-20` is the point.
- *`localStorage` only, no URL.* It cannot be shared, and Back would do nothing.
- *The URL only, no memory.* Opening a page from the sidebar carries no parameters, so it would
  still land on defaults — which is exactly what the owner reported.
- *Remembering the search text.* Named above.
- *Per-page copies of the logic.* The owner asked for one behaviour; eight copies of it drift.

## Open questions for the owner

1. Should a page get a visible **"reset filters"** control now that it remembers? `forgetFilters` is
   written and not yet used anywhere.
