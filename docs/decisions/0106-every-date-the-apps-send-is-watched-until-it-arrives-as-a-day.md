# 0106 — Every date the apps send is watched until it arrives as a calendar day

- **Date:** 2026-09-14
- **Status:** decided by the sync agent, on the owner's ask of 2026-09-14 (make sure the one-day shift of an invoice's
  date can never come back unnoticed). Built, not deployed.
- **Decision:** A Health Centre card, "Invoice dates arrive as calendar days", turns red when a build that should send an
  invoice's or a payment's date as `YYYY-MM-DD` sends anything else; and a test in the app pins that shape on the wire.
- **Why:** a day sent as a moment is lost the instant the server reads it. The server keeps the moment's UTC day, and
  nothing later can tell a shifted day from a real "yesterday". 4,340 live invoices already hold one (0093). The only
  place a returning shift can be seen is how the date arrives.

**Related:** 0093 (the invoice-date repair and the week of counting), 0104 (a payment's date travels as a calendar day),
0010 (a check is a card, never a page), `docs/INVOICE-DATE-REPAIR-PLAN.md`.

## What was built

- **Backend** `feat/date-shapes-arrive-as-days`, from `stage` `32b89cd`. Not pushed.
  - Tests `96b92f0` (4 of 4 failed first on stage) and `d8e1179` (did not compile first: 25 errors), code `62d45c2`.
  - Targeted 43/43; full suite 981/981 (201 classes) under the shared lock.
  - App: test `c2ae6d03`, then fix `1d2dde48`, on `fix/146-dates-travel-as-calendar-days`.
  - **The card** (`DatesArriveAsCalendarDaysCheck`, id `date-shapes`, every 30 minutes):
    - **Red:** any shape but `calendar_day`, in the last 7 days, from a build that should send days:
      - an invoice's date or due date from every build that sends its build number, every iPhone, and the web;
      - a payment's date or applied date from Android 102 (1.4.6) and iOS build 19 on (configuration).
    - **Shown, never judged:** the old builds' midnights, which are the owner's week of counting (0093), and payment
      dates from builds before 1.4.6.
    - **UNKNOWN:** Prometheus does not answer, or no invoice date was counted in 7 days.
  - **Where it reads:** Prometheus on the box (15 days kept across deploys), four instant queries per run.
  - **The counters:**
    - `sync.invoice.date.arrived` gains `platform`: the call's `X-Platform`, else what the phone declared in its
      analytics, else `unknown`;
    - `sync.payment.date.arrived{field, shape, build, platform}` is new;
    - the web's invoice form (REST `/v1/invoices`) is counted too.
- **App** `fix/146-dates-travel-as-calendar-days`, from `VC_102_VN_146` `598ccc8d`. Not pushed, not run yet.
  - `ADateTravelsAsItsCalendarDayTest` pins all six dates on the wire, in Karachi, New York and Tonga.
  - 0104's payment date is built there: out as a calendar day, and in at local midnight.

## Rejected

- **A tally table in MySQL.** A migration first, a write on every push, and it would begin counting only at its own
  deploy, a week late for the owner's question. Prometheus already keeps these counters across deploys.
- **`increase()` alone.** A counter series is born at its first value, and `increase()` reads that first count as 0. On
  2026-09-14 it read an old build's one midnight as nothing. The card adds each new series' lowest value.
- **Judging an invoice by `versionCode ≥ 91`.** An iPhone sends its build number (16 to 18) in the same field, and would
  read as an old Android build. The rule is instead: a build that sends any number sends days. The number reached the
  app in 1.4.2 (`6fca7076`), after the calendar day (`73879b2d`), and all four branches with the first carry the second.
- **The platform from the number alone** ("below 93 is an iPhone"). True today, and silent the day iPhone numbers pass
  92. It is used only where nothing else says, for the payment floor.
- **Sending `X-Platform` from the app's sync calls now.** The server's device list reads the same header, so it is a
  change of its own.
- **Changing only the payment's way out.** A phone west of Greenwich keeps a pulled day at UTC midnight, the day before
  there, and would have sent that earlier day back at the next edit. The reader changes with it.

## Consequences

- **The payment floors are configuration:** `health.date-shapes.payment-days-from-android-build=102` and
  `health.date-shapes.payment-days-from-ios-build=19`.
  - If an iOS build is archived before the app's change reaches it, raise the iOS number past that build.
  - A 1.4.6 test phone still on a build from before the app's change sends payment moments as build 102. The card is
    red for it until that phone updates: the card working, not a fault.
- **1.4.1 sends no build number,** so it is counted with the older builds. It adds only calendar days there.
- **A shape check cannot see a right shape carrying a wrong day.** The web's free-invoice tool defaults its date to
  `new Date().toISOString().slice(0, 10)` (`src/lib/free-invoice/adapter.ts:10`), which is the UTC day: in Pakistan
  between 00:00 and 05:00, yesterday. The user sees the default before saving. Reported, not fixed here.
- **A red card pages nobody.** It is not in `health.alert.emergency-checks`. Whether it should be is the owner's call.
