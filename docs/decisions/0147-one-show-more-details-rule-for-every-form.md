# 0147 — One "Show More Details" rule for every form, implemented once

- **Date:** 2026-09-22
- **Status:** decided, built on `invoice-kmp-app` branch `fix/show-more-details-single-rule` (off `VC_108_VN_149`)
- **Decision:** every collapsible "Show More Details" section in the app — business, client, product, the invoice
  line-item edit form — follows the same rule, implemented once as a shared pure helper
  (`core/common`'s `ShowMoreDetails`) plus a shared Compose controller and two shared composables
  (`core/ui`'s `ShowMoreDetailsSection.kt`), instead of five near-identical copies.
- **Why:** the five copies had already drifted apart from each other and from the rule the owner wants. The client
  sheet had lost its toggle entirely (fixed earlier today in `55d8a1fb` — an unrelated stale A/B flag had forced the
  section permanently open with no way to collapse it). The line-item edit form's toggle (`InvoiceItemScreen.kt`) was
  dead code: it only rendered `if (compactMode)`, and the only call site never passed `compactMode = true`, so it was
  always expanded and the toggle button never appeared. Every remaining copy — business (invoice-flow sheet),
  business (standalone `BusinessFormScreen`), client (invoice-flow sheet), product — forced the section open on
  **every edit**, regardless of whether anything was actually behind it, via either a raw `isEditMode ||` in a
  `remember{}` initializer or, on the standalone business form and the product form, no `hasHiddenContent` check at
  all. An edit of a business with nothing but a name showed every field expanded anyway.

## The rule (owner, 2026-09-22)

1. **On open, create or edit alike:** the section is EXPANDED only if a field it hides already has content;
   otherwise COLLAPSED. `isEditMode` plays no part in this decision at all — the fix is that the shared function,
   `ShowMoreDetails.initial(hasHiddenContent)`, does not take an `isEditMode` parameter, so there is nothing left to
   force it open by mistake.
2. **Content that arrives later opens it** — a load, a restored draft, a contact pick — the existing one-way latch
   from `e46058e1`, now `ShowMoreDetails.latch(currentlyExpanded, needsToBeSeen)`.
3. **The user's manual open/close sticks**, including across rotation. The Compose-side holder
   (`ShowMoreDetailsController`) is `rememberSaveable`, not a bare `remember` — three of the five copies
   (business/invoice, client/invoice, the standalone business form) used a bare `remember` before this, which lost
   the person's choice on rotate (`docs/LAYOUT_RULES.md`: "rememberSaveable for anything the user opened"). Clearing
   the last hidden field does not auto-collapse — the latch is a plain OR, never a source of collapsing.
4. **A validation error inside the collapsed section auto-expands it on Save/Add.** Of the five forms, only the
   standalone `BusinessFormScreen` actually validates a hidden field live (email/phone/website); none of the others
   have a hidden-field validation error today. There the Save button's `onClick` reads
   `viewModel.uiState.value.hasHiddenSectionError` right after dispatching `SaveClicked` (the ViewModel updates the
   `StateFlow` synchronously) and calls `showMoreDetails.expand()` if it is set, even if the person had since
   collapsed the section by hand. The shared controller also carries a `BringIntoViewRequester`, attached to the
   section's content, so a latch-driven open (never a manual one) scrolls the section into view once its 400ms
   expand animation finishes — "bring that field into view". No form here has focus-on-error wired for a *hidden*
   field today, so no new focus behaviour was added; the rule text conditions that on the form already doing it.

## Rejected

- **"Edit mode always expands."** This was the actual, undocumented behaviour on all four of the other forms before
  today (business/invoice's and client/invoice's own `LaunchedEffect(uiState.hasHiddenContent, uiState.isEditMode)`
  treated `isEditMode` as an equal trigger to `hasHiddenContent`; the standalone business form's
  `remember(uiState.isEditMode) { mutableStateOf(uiState.isEditMode) }` had nothing else; the product form's
  `loadProductForEdit` set `isFieldsExpanded = true` unconditionally). It reads as helpful — "show everything on an
  edit" — but it is indistinguishable, to the person looking at it, from every OTHER field having been force-expanded
  for no reason: a blank edit and a full one look identical, all-open, which is the exact "nothing to see, so why is
  this open" state the whole feature exists to avoid. Explicitly rejected in favour of rule 1.
- **A wholly new collapsible section for `feature/customer`'s standalone `CreateClientScreen`.** This module's own
  client form (`CreateClientFormFields.kt`, reached from `CustomerNavigation.kt`) has never had a "Show More Details"
  toggle at all — every field renders unconditionally, with no `hasHiddenContent`, no toggle button, nothing to
  restore. The owner's instruction named one `CreateClientScreen`; the one with an actual pattern to fix is the
  invoice-flow sheet (`feature/document/invoice/.../client/create/CreateClientScreen.kt`), already fixed once today
  in `55d8a1fb` and brought onto the shared helper here. Building a brand-new section on the customer-feature form
  would be adding a feature, not fixing one — left out; flag if this is wrong.
- **Moving the product form's `isFieldsExpanded` flag out of its ViewModel state by keeping it there.** It used to
  live in `CreateProductUiState`/`ItemFormDraft`, needing its own restore logic on every draft and every edit load.
  Moved to the same Compose-local `rememberShowMoreDetailsController` the other forms use — one fewer place the rule
  could drift, and `ItemFormDraft` no longer needs to carry UI-only state at all.
- **Estimate/expense equivalents.** Checked: the estimate module has no business/client/product/item screens of its
  own — `CreateEstimateViewModel` and `EditEstimateViewModel` reuse the exact same invoice-flow bottom-sheet screens
  fixed here (their own `compactMode = true` lines were removed earlier today in `55d8a1fb`), so this fix reaches
  them automatically. The expense create form has no "Show More Details" section of any kind — nothing to fix.

## Consequences

- One shared place — `core/common/.../ui/ShowMoreDetails.kt` (pure Kotlin: `initial`, `latch`) and
  `core/ui/.../components/ShowMoreDetailsSection.kt` (`ShowMoreDetailsController`, `rememberShowMoreDetailsController`,
  `ShowMoreDetailsToggle`, `ShowMoreDetailsContent`) — now owns this behaviour. A sixth form that needs the same
  section reuses these instead of copying a seventh block of `remember`/`LaunchedEffect`/`AnimatedVisibility`.
- `InvoiceItemScreen`'s `compactMode: Boolean` parameter is removed entirely (not restored) — it had exactly one
  caller and that caller never set it `true`.
- `BusinessFormUiState` and `InvoiceItemUiState` each gain a new `hasHiddenContent` computed property (mirroring the
  existing ones on `CreateBusinessUiState` / `CreateClientUiState` / `CreateProductUiState`); `BusinessFormUiState`
  also gains `hasHiddenSectionError` for rule 4.
- `CreateProductUiState.isFieldsExpanded` and `CreateProductUiIntent.ToggleFieldsExpanded` are removed; the toggle is
  local Compose state now, like the other four forms.
- Tests: `core/common`'s `ShowMoreDetailsTest` covers the six acceptance criteria directly (empty create collapsed,
  edit with nothing hidden collapsed, edit with a hidden value expanded, late content opens, clearing doesn't
  collapse, an error in hidden opens). Each form's own `hasHiddenContent`/`hasHiddenSectionError` gets a
  `TheMoreDetailsSectionOpensForHiddenContentTest` in its own module, proving that form's state feeds the shared
  rule correctly.
