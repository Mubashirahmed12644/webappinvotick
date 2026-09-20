# 0130 — One drift is one report, and a guest's stranded work is named

**Status:** built on the app branch `fix/147-one-drift-one-report` (off `VC_107_VN_147`), `c73b6da3`, pushed, not
merged, not released. `:data:testDebugUnitTest` **329/329**, Android and iOS-simulator compiles pass. No schema
change, no backend change, no version bump. **One question for the owner at the end.**

**Asked by the owner, 2026-09-20,** from a Live Events screenshot: one guest phone — Invotick ID **926717497**, PK,
Android, **1.4.7** — appearing to flood the stream with `sync_failed`.

**Related:** 0029 and 0125 (what is reported at all), 0050 (the evidence net), 0053 (a guest's work moves in one
step), 0129 (the same week's sibling); sync agent rules 7 and 8; **G3**.

## 1. What the phone is actually doing

| | |
|:--|--:|
| `sync_failed` it has ever sent | **145** |
| …of those, on **1.4.7** | **3** |
| `app_cold_start` it has sent | **5,381** |
| …of those, since 2026-08-23 | **3** |

So the volume in the stream is **not** sync failures on the current build. **5,378 of the cold starts carry no build
number at all** — they are from before the app sent one, the newest stamped 2026-08-23. The three on 1.4.7 are the
whole of that build's sync noise.

**It is one failure, not many.** All three 1.4.7 rows, and 30 before them on 1.4.4, say exactly the same sentence:

> `reconcile_drift` — *"invoiceItems 18 missing, inventoryItems 4 missing"*, `attempts=22`, `run=reconcile`

Unchanged since **2026-09-09**, repeated **23 times in the seven days to 2026-09-20** — once per reconcile pass
(every 6 h), for ever. One distinct fact, twenty-three reports.

**The jumping times are neither the clock nor a bug.** The panel lists by **arrival** and prints the phone's **own**
event time, and these rows are from different days: 19:13:34 is 2026-09-20 14:13:34 UTC, 21:10:49 is 2026-09-19
16:10:49 UTC, 13:41:32 is 2026-09-19 08:41:32 UTC — PKT is UTC+5. Arrival trails the stamp by 15–18 minutes on every
row, which is the analytics queue flushing. Nothing here says the clock is wrong.

## 2. Why the number can never fall — and what the guest has lost

The 22 records are not in flight. Every one was refused **`OWNERSHIP_VIOLATION`**, and the server was right:

- **4 products** — `2be4ad2f`, `838006c6`, `c238abbb`, `c90c8d2c` — carry ids that on the server belong to **another
  guest**, `a3c112fb` (short code 743020463), which created them on **2026-05-02**. That guest has no linked device
  and has not signed in since 2026-02-25.
- **18 invoice lines** of this guest were then refused too, each one *"inventory item reference … does not belong to
  authenticated user"*.

**The harm, read from the server: 6 of this guest's 7 invoices have zero lines.** Only the oldest, `ES2602001` from
February, has its 3. The other six — `XX2606001`, `ES2606002`, `ES2606003`, `ES2607004`, `ES2607005`, `ES2609987`,
June to August — exist on the server as invoices with no items and therefore no amounts. Everything that gives them
their value lives on that one phone, and cannot be sent under those ids by anyone. **This is a guest (G3): if the
phone is lost or reinstalled, those six invoices come back empty.**

How the ids came to be another guest's is not provable from what we store — this phone has never sent an event under
any other user id. Two facts sit beside it: `a3c112fb` never had a linked device (the table only filled up in
August), and **the phone's device id is the same string as its own guest user id**, which is true of **76 of the
4,326 phones** seen in the last seven days. On those phones a new guest is indistinguishable from a new phone, so the
question "was this the same handset under an older guest" cannot be answered from our data at all. That is written
down as open, not claimed.

## 3. What was fixed

**`reconcile_drift` says its sentence once, and again only when the sentence changes.** `reportFailed` has had an
interval guard since 0050, and `queue_stuck_backlog` reports only when its count moves; drift was the one still
reporting on every pass. It is now `DriftReport`, remembered **per user and across process starts** — a drift that
clears and comes back is news again.

**And it says how many operations the server has refused for good.** A drift standing still reads as "22 records are
on their way and have not arrived", when the truth is "22 records belong to somebody else". The count comes from the
queue (`status = 'TERMINAL'`), is counted rather than matched row by row, and rides in the sentence — so the report
claims only what it can prove, and `attempts` stays the missing count it has always been.

Guard: `OneDriftIsOneReportTest` (7 cases; it did not compile first, naming what the code had to add).

## 4. What survives every branch we have

Seven days, 2026-09-13 → 2026-09-20.

| | Rows | Phones |
|:--|--:|--:|
| `reconcile_drift`, all builds | 41 | 13 |
| …of which vc 106 (1.4.7) | 5 | 3 |
| Distinct facts behind those 41 rows (phone + sentence) | **11** | |
| This phone alone | 23 | 1 |

None of `fix/147-sync-failed-only-real-refusals`, `fix/147-a-phone-that-thought-it-was-online` or
`fix/147-a-deleted-payment-method-reaches-the-server` touches drift, so **all 41 would have survived them**. With this
branch the fleet's 41 become **11**, and this phone's 23 become **1** — and that one row now says why it cannot move.

## 5. The panel's "151 users report no build type" — not a hole in the app

Seven days: **280 rows carry no `build_type`, on 187 distinct ids — and every single one is `platform=Web`**
(`shared_invoice_page_view` 196, `shared_invoice_pdf_click` 49, `shared_invoice_approved` 21,
`shared_invoice_create_own_click` 8, `shared_invoice_rejected` 4, `shared_invoice_decision_failed` 2). Every one also
has no `app_version_code`, which is exactly what decision 0045 arranged: the share-link page is a browser, not a
build.

`build_type` is a generated column over `params.build_type`, and a browser has no debug or release build to report.
So **no app device is missing it**: the panel is counting web viewers in a list of app builds and calling them
"neither". The fix belongs to the panel — exclude `platform='Web'` from the build lists, or name them "web" — and it
is one filter, not a data defect. Not done here: another agent is working in the panel this week (0122, 0123).

## 6. Rejected

- **Reporting drift on a timer, as `reconcile_failed` does.** A timer still repeats a fact that has not changed; the
  honest key is the fact itself.
- **Counting only in memory.** A restart would have made old news new again, and this phone restarts often.
- **Leaving the refused count out.** Without it the same sentence reads as work still arriving, which is what sent
  this to the owner as a flood in the first place.
- **Excluding the refused records from the drift count.** The count comes from a per-entity comparison, not per id,
  so subtracting a separately-counted number would be arithmetic we cannot prove. The two numbers are reported side
  by side instead.
- **Blaming the device clock for the panel's jumping times.** Checked: arrival trails the stamp by 15–18 minutes on
  every row, and the rows are simply from different days.

## 7. Open

- **The 76 phones whose device id is their own guest id** (1.8% of the week's 4,326). On those, a new guest reads as a
  new phone, so every per-device count is slightly wrong and "was this the same handset" is unanswerable. Worth its
  own look; not touched here.
- **The panel filter** in §5.
- **This guest's 22 stranded records** — the question below.

## Question for the owner

**Is guest 926717497 ki wo 18 line aur 4 product wapas laane ki koshish karein?**

Aaj wo sirf us phone par hain, aur server par ja hi nahi sakte — kyunke un ke number kisi **doosre guest** ke naam
par pehle se darj hain, aur server (theek hi) mana kar deta hai. Nateeja: **us ke 7 mein se 6 invoice server par
khali padi hain** — koi item nahi, koi raqam nahi. Phone kho gaya ya app dobara install hui, to wo 6 invoice khali
wapas aayengi.

Wapas laane ka tareeqa: phone un 4 product ko **naye number** de kar bheje, aur us ki 18 line un naye number par
laga de. Faida: guest ka kaam mehfooz ho jata hai. Qeemat: ye kaam har us phone par chalega jis ka koi record kisi
aur ke naam nikla, aur agar kabhi purane record kisi tarah wapas aaye to aik hi cheez do baar dikh sakti hai.

**Meri raye: haan, magar alag kaam ke taur par** — pehle aik gin kar dekhein ke aise kitne phone aur kitne record
hain, phir aap ki ijazat se.
