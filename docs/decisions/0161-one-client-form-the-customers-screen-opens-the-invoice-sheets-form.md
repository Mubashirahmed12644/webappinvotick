# 0161 — One client form: the Customers screen opens the invoice sheet's form

- **Date:** 2026-09-22
- **Status:** decided by the owner, built on `invoice-kmp-app` `VC_108_VN_149` (1.4.9); not released
- **Decision:** Invotick has **one** Add / Edit Client form: the invoice/estimate sheet's
  (`feature/document/invoice/.../bottomSheet/client/create/CreateClientScreen.kt` + its ViewModel). The
  Customers screen's routes (`CustomerRoute.Create`, `CustomerRoute.Edit`) open that same form with
  `ClientFormEntry.CustomersScreen`. The Customers copy (`feature/customer/.../presentation/create/`:
  screen, ViewModel, UiState/Intent/Event, form fields, discard dialog, contact mapping and its test) is
  deleted.
- **Why:** the two copies had drifted. The Customers copy had no "Show More Details" (0160), no mic, no
  draft (0011), no events at all, a different star colour, its own discard dialog, and a race: the default
  business was read in `init`, so a fast first Save said "No business selected" to someone who had one.
  Every fix to one form had to be remembered on the other, and was not.

## What `entry` carries — and nothing else

`ClientFormEntry` (`InvoiceSheet | CustomersScreen`) is the only place the two doors differ:

| | Invoice sheet | Customers screen |
|:--|:--|:--|
| Host | bottom sheet: ✕, top bar swallows drags | full screen: back arrow, status-bar and keyboard padding |
| Close id | `client_form_close` (as before) | `customer_create_client_screen_close` (as before) |
| Business a save goes to | the invoice's; **pending** (not written, held on the invoice) when it has none | the app's default business, read **at save time**; none → "No business selected", nothing written |
| After save | client returned to the invoice (`BottomSheetResult.ClientSelected`) | back to the list |
| `entry` on events | `invoice_sheet` | `customers_screen` |

The last two rows were already callbacks in each navigation file and stay there; the rest is
`ClientFormEntry` + `clientSaveTarget()`.

## The difference table

| Difference | Sheet (kept) | Customers copy (removed) | Class |
|:--|:--|:--|:--|
| Sheet vs full screen, ✕ vs back, drag lock, insets | ✓ | ✓ | **needed** → `entry` |
| After save: return client to invoice vs pop to list | ✓ | ✓ | **needed** → nav callback |
| Business: invoice's / pending vs default business | ✓ | ✓ | **needed** → `clientSaveTarget` |
| Close tap id | `client_form_close` | `customer_create_client_screen_close` | **needed** (history) → `entry` |
| "Show More Details" (0160) | yes | all fields always open | accidental → sheet |
| Name field: label, helper, icon, autofocus, **mic (speech-to-text)** | yes | plain "Full Name *" | accidental → sheet |
| Contacts: "Add from Contacts" under the name once typing starts | yes | always-visible "Contacts" button in the top bar | accidental → sheet; **question 2** |
| Draft kept on every change (0011), one draft for the form | yes | none | accidental → sheet |
| Discard dialog on back | none (the draft keeps it) | yes, "cannot be undone" | accidental → dropped: with the draft nothing is lost, so the dialog would be untrue |
| Events `client_form_text_add`, `client_form_saved` | yes | none | accidental → both entries send them, with `entry` |
| Star colour | `primary` | `warning` | accidental → sheet |
| Loading | `InvotickLoading` | scrim + spinner | accidental → sheet |
| Default business read in `init` (race on first Save) | — | yes | accidental → read at save time |
| Edit keeps the client's own business | no (wrote the invoice's) | yes | accidental → **kept from the Customers copy** for both. The sheet lists only its own business's clients, so its writes do not change |
| Validation (name required), save use cases, sync | same | same | identical |
| Duplicate detection, delete, ledger link | neither form has them | | identical (delete and ledger live on the list and details screens) |
| Tutorial spotlight on Save | yes, never started | stubs | unchanged, still never started |

Data: same `ClientUseCases.addClient` / `updateClient`, same sync path, no schema change.

## Analytics continuity

Production, `analytics_events`, 30 days `2026-08-23` → `2026-09-23`, counts only:

- **0 rows of any event on `screen_name` `create_client` or `edit_client`**: no screen views, no taps.
  - The Customers form is **unreachable today**. The list's "Create Client" button and the drawer's
    "Create client" item are commented out. `ClientItem` ignores `onEditClick`. The details screen's
    Edit event is swallowed.
- **Ids that disappear, all 0 in 30 days:**
  - `CreateClientFormFields.rating_1`;
  - `components_DiscardChangesDialog_2.close_1`, `.yes_discard_changes_2`, `.keep_editing_3`;
  - `Contacts` (the top-bar button).
- **Ids that stay:**
  - `customer_create_client_screen_close`, still the Customers entry's close;
  - `Save` / `Update`, the same labels.
- **The sheet is untouched:** `client_form_close` 1,154, `client_form_text_add` 3,436, `client_form_saved`
  3,285, `add_from_contacts_4` 864 (release).
- **`entry` is a parameter, not a new name.** From 1.4.9, `client_form_text_add` and `client_form_saved`
  carry `entry` = `invoice_sheet | customers_screen`. Absent means an older build, which only the sheet could
  send.
  - The backend's journey step 6 counts `client_form_saved` by name. If a Customers button comes back, filter
    `entry` there.

## Rejected

- **Keep two forms.** Every fix already had to be made twice and was not: 0160 had to reject adding
  "Show More Details" to the Customers copy separately. Two forms guarantee the drift continues.
- **Move the form into a new shared module.** Correct in principle, but a large move for one screen.
  `feature:customer` now depends on `feature:document:invoice`, as `feature:document:estimate` already
  does. There is no cycle, and the targets are the same.
- **A form slot passed in from `composeApp`.** It hides the dependency without removing it, and needs a
  second wiring in the shell.
- **Keep the discard dialog for the Customers entry.** Its "all your unsaved changes will be permanently
  lost" is false once the draft keeps them.
- **New tap ids per entry.** The gateway's `screen` already separates them (`client_add_form_landed` vs
  `create_client`/`edit_client`). Only the two coded events needed `entry`.

## The owner's answers (2026-09-22) — built in `4f8c7340`

1. **Yes, bring back "Add Client" on Customers.**
   - The list's FAB is back as `customers_add_client_fab_click` and opens the one form with
     `entry=CustomersScreen`.
   - It had been commented out since the first commit (`161a9d10`, 2026-06-08). There was no switch.
   - The drawer's "Create client" item and Edit were not behind a switch either, so they stay as they are:
     - the drawer item is commented out in the same way;
     - the list row ignores `onEditClick`;
     - the details screen swallows its Edit event and has no Edit button.
2. **"Add from Contacts" is always visible, from both entries.**
   - It is a row under the client name from the moment the form opens. It is no longer a popup that
     appeared only after typing started.
   - It keeps `create_CreateClientScreen.add_from_contacts_4` (864 taps / 755 devices in 30 days) and has a
     48 dp minimum height.
   - The popup's ✕, `create_CreateClientScreen.close_contacts_1` (276 taps / 229 devices in 30 days), goes with
     the popup.

## Verification

`invoice-kmp-app` `VC_108_VN_149`:
- new `OneClientFormTwoEntriesTest` (11 tests);
- the unit suite, `:composeApp:assembleDebug`, `compileKotlinIosSimulatorArm64` and an Xcode simulator
  build. `ad31088b` (the one form) and `4f8c7340` (the answers): unit 1,182/1,182, `assembleDebug`,
  iOS sim compile, Xcode sim build succeeded, each time.
