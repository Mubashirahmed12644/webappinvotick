# 0159 — No apology without a loss; a sync icon in the top bar instead of a sheet

- **Date:** 2026-09-22
- **Status:** built. App `invoice-kmp-app` `VC_108_VN_149`: test `4e149853` (red on today's rule, 3 of 4), code `80b438b3`
  (for 1.4.9, Android 111 / iOS 22+). Not released, not run on a phone. No schema change, no server change, no new
  server call. New Remote Config key `sync_blocking_screen_enabled` (on unless `false`).
- **Asked by:** the owner, 2026-09-22, after seeing "SYNC COMPLETE / Data Recovered Successfully / … this was our fault,
  we apologize / This message won't appear again / Got It" on iOS TestFlight 1.4.9 (22) after updating — and after every
  update before it. He approved the plan for 1.4.9.

## Root cause

The sheet (`SyncOnboardingSheet`) showed when `show_sync_sheet` (Remote Config) was on, the account was registered, and
an "entry" flag was up. `AppViewModel.loadSyncSheetEntryTrigger` raised that flag on **every version change** and
`onNavigatingToMainFromLogin` on **every sign-in**. The "never again" flag `HAS_SHOWN_SYNC_SHEET` was written on "Got It",
but commit `dde1f990` ("hotfix.", 2026-06-26) removed its read from the gate. Written, never read: the sheet returned
after every update. Its success text apologised whatever the sync found — nothing measured a loss.

Production, 30 days to 2026-09-22 (read-only): "Got It" was tapped 89 times on 76 phones.

## Decided

1. **The sheet and its gate are removed.** An update still asks for a full pull (sync rule 26); only the sheet goes.
2. **The apology shows only with evidence of a loss, once per account.** The evidence is the one a phone can see: a
   full pull that ended with records the server sent and this phone could not store (`SyncPullHandler`, the same count
   it reports as `pull_apply`). No such record, no apology. It is remembered per account in a phone-wide set
   (`recovery_apology_told_for`), so a switch cannot lose it. It is a notice in the prompts host, last in the order.
   - Sized: 30 days of `sync_failed stage=pull_apply` came from 30 of 6,598 phones — an upper bound, since a delta's
     failure is included.
   - "Once ever" holds on this phone. A reinstall starts a fresh set: a server-side record would be needed for more.
3. **A sync icon in the top bar** of Invoices, Estimates and the Dashboard (`TopBarSyncStatus`, provided by the shell,
   so the feature screens need no sync code). 48 dp, labelled for screen readers. It replaces the list's own spinner.

   | State | Icon | Its sheet says |
   |:--|:--|:--|
   | idle, nothing waiting | hidden | – |
   | a sync over 1 s | spinner | changes being sent, records (and invoices) being received, as counts |
   | a visible sync ended well | tick, gone after 2 s | "All safe. Last sync: just now." |
   | offline with work waiting | cloud-off + count | the count is safe on this phone and goes when online |
   | the last sync failed | small warning | a plain reason, and "Try now" (not for a removed phone, 0099) |

   - A sync shorter than a second shows nothing, not even the tick. While a sync is younger than a second the icon keeps
     what it showed (a warning does not blink off for a quick retry).
   - It reads only the open account's objects (its `SyncManager`, queue and pull), so a parked account's background push
     never shows. It calls the server for nothing.
   - **Conflict state: not built.** The app has no conflict that asks the person to choose; the server's rules decide
     (the conflict contract, 0058). There was no existing flow to open.
4. **The screen is covered only in three cases**, with a non-dismissible "Your data is arriving: 45/120 invoices":
   (a) a first restore into an empty file (the account's own rows were none, it is the file's first pull, and the server
   sent records); (b) a guest's work joining after the person said yes — to the question, the QR link's question, or
   "add it later"; never a sign-up's silent move; (c) a switch that fills an account's file for the first time. Only after
   it has lasted a second. Everywhere else the person keeps working and edits queue as before. Kill switch
   `sync_blocking_screen_enabled`.
5. **Events** (AGENTS-EVENTS): the icon's tap is auto-captured (`sync_status_icon`); the sheet announces itself as
   `sync_status_sheet` with `state` = `syncing|done|offline|failed` — the one event for opening it; one coded
   `data_arriving_ended` per block actually shown, with `reason` (`first_restore|account_switch|guest_merge`), `outcome`
   (`done|not_all_stored|failed|ended`), `duration_ms` and `records`. No event per icon state.

## Rejected

- **Keep the recovery dialog after updates** (and fix only its "never again" flag). An update is not evidence of a loss;
  an apology with no loss behind it tells the person their data may be wrong when it is not (G3), and it blocked the
  invoice list's first button.
- Restoring the `HAS_SHOWN_SYNC_SHEET` read alone: it would stop the repeat, but the one showing would still apologise
  for nothing, and a phone that never pressed "Got It" after success would still see it every update.
- A banner or snackbar per sync: noise on every edit, and it moves content.
- Blocking during every full pull (e.g. an update's): the person's file is already whole; the icon suffices.
- A coded event for the sheet opening or per icon state: the sheet's own `screen_view` already carries `state` (§1.2, §1.3).
- A new server call for "does the server have data": the pull's own answer already says it.

## Guards

`AnApologyNeedsALossTest` (4; 3 red on `4e149853`), `AnApologyIsOncePerAccountTest` (4), `TheSyncIconSaysWhatIsTrueTest`
(11: debounce, the 2 s tick, offline, failure, stopped ≠ failed), `OnlyThreeMomentsStopThePersonTest` (9: the three
cases, an update, a non-empty file, an empty server, the one-second rule), 3 cases in `GuestWorkCoordinatorTest`,
`APullSaysWhatIsArrivingTest` (2, real Room). Unit suite 1118/1118; `:composeApp:assembleDebug`, the iOS simulator
compile and the Xcode simulator build (`** BUILD SUCCEEDED **`) pass.

## Open

- Not seen on a phone yet, nor at `font_scale 1.5` (no phone or emulator was used, by instruction).
- The `show_sync_sheet` Remote Config key and the `synconboardingsheet_*` strings are now unused; they can go after 1.4.9.
