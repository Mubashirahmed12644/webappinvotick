# 0193 — Edit is one tap, in the saved invoice's and saved estimate's top bar

- **Date:** 2026-09-30
- **Status:** built, not merged, not released. App `invoice-kmp-app`: `feat/edit-out-of-more` off `VC_113_VN_149`
  (`3354f7806`, 1.5.0) @ `ae95e059b`, pushed. No schema change, no server change, no new dependency, no Remote Config key.
- **Asked by:** the owner, 2026-09-30 — *"Haan, bahar lao"*. He does not choose UI options; placement and look were
  decided by the design agent (`.claude/agents/design.md`).
- **Mockup:** `kaam/research/edit-out-of-more-2026-09-30/index.html` (375 px phone, real colours, light and dark,
  before and after, German at a large font, Arabic, the estimate), with the real screen drawn afterwards by the
  Screen Map harness in `img/`.

## Why

On the saved screen ("Invoice Created"), Edit lived only inside More. 30 days to 2026-09-30:

| | phones |
|---|---|
| saw the saved invoice | 1,776 |
| opened More | 619 (35%) |
| pressed Edit in More | 344 (19% of viewers, **56% of those who opened More**), about 2.5 times each |

More's main job had become "the way to Edit". The most-used item in a menu should not cost two taps.

## Decided (as built)

- **Edit sits in the top bar**, at the trailing end after the translate globe: a pencil and the word, drawn as an
  outlined pill (`core/ui` `TopBarLabeledAction`). One tap sends the same `EditClicked` intent More → Edit sent.
- **Outlined, never filled.** Send Invoice / Send Estimate stays the screen's one filled element.
- **Not in the action row.** The row (Templates, Download, Signature, Stamp, More) is full: five items at 52–76 dp, and
  French at font 1.5 already shrinks "Télécharger" to fit. A sixth item would cut a label. The code comment beside the
  globe had already rejected a sixth item there for the same reason.
- **Edit leaves More.** One action, one door, one event name (AGENTS-EVENTS §1.1). More now opens on Receive Payment
  (invoice) or Convert to Invoice (estimate).
- **The word is measured, never assumed to fit.** When the word is wider than 22% of the window
  (`TOP_BAR_ACTION_LABEL_SHARE`) — a long language at a large font — the pill becomes a round pencil button with the
  word as its spoken name. A word is never drawn cut, and the title and invoice number keep their room.
- **The saved screens' subtitle — the invoice or estimate number — shrinks before it ellipsizes** (`Topbar.kt`,
  `subtitleIsIdentifier = true`, min 8 sp): an identifier is never truncated (LAYOUT_RULES §3). Opt-in, off by
  default: turned on for every screen, the measuring pass moved an ordinary subtitle ("5 total" on the dashboard) by
  a pixel even where it fitted, and 17 more Screen Map pictures changed. Only the two saved screens ask for it.
- **The estimate's saved screen gets the same change.**
- **No remote flag.** This is structure, not a behaviour to switch off (LAYOUT_RULES §10); the staged rollout is the
  safety.
- **Words:** `saveinvoicescreen_edit` / `estimatesavescreen_edit` in all 16 interface languages plus `values-in`,
  the same words More → Edit already used (`rt_edit_*`): Bearbeiten, Modifier, Editar, تعديل, ویرایش, बदलें, Edit,
  ပြင်ဆင်ရန်, Bewerken, Edytuj, Redigera, แก้ไข, Düzenle, 编辑.

## Measured

`EditFitsTheTopBarBesideTheNumberTest` (core/ui, JVM) lays out the real bar — title, `INV-2026-00012`, globe, Edit —
at 320 / 360 / 411 dp and font 1.0 / 1.3 / 1.5 in English, German, French, Swedish, Turkish, Burmese and Arabic (RTL):
the number is never cut or ellipsized, the title is never ended in "…", Edit's word is whole or absent, and the
button is at least 36 dp tall (72 layouts). At 360 dp and font 1.0 every language shows its word. At font 1.3+ on narrow phones the long
words (Bearbeiten, Redigera, ပြင်ဆင်ရန်) show the pencil alone; English and Arabic keep the word at 1.5 on 320 dp.

`EditIsOneTapOnTheSavedDocumentTest` (composeApp, Robolectric) draws both real screens: Edit is on screen without
opening anything, its press reaches `EditClicked`, and More no longer offers Edit.

Dark-theme gate (`tools/darkaudit/gate.sh`): the same 20 light pictures moved on the untouched base `3354f780` and with
this change — the baseline is stale on the 1.5.1 integration line, not moved by this — and dark defects 1 = baseline 1.
In a debug build the render-mode pill ("Offline") also sits in the bar; at font 1.5 it pushes the title into "…".
Users' builds do not have it.

## Events (AGENTS-EVENTS §1.33)

- New, auto-captured, no coded twin: **`saved_inv_edit_click`** (saved invoice) and **`saved_est_edit_click`** (saved
  estimate), from the first build after 1.5.0 (versionCode > 114).
- Old: **`more_edit_click`** — one name on both screens, separated only by `screen` (`saved_inv_scr` /
  `save_estimate_scr`). Last sent by 1.5.0 (versionCode 114). Its config row stays as it is; it is **not** added to
  `tools/analytics/renamed-events.tsv`, because `rename-applied` would delete the old row's name and one old name
  cannot move to two new ones.
- Funnel join: *pressed Edit on the saved invoice* = `more_edit_click` with `screen='saved_inv_scr'` ∪
  `saved_inv_edit_click`. No build sends both, so nothing is counted twice; split by `app_version_code` to compare.
- Expected: `saved_inv_more_click` falls from the release that carries this. That fall is Edit moving out, not people
  editing less. It is also this decision's measure: before, 619 of 1,776 viewers opened More.

## Rejected

- **Edit as a sixth item in the action row** — cuts labels in long languages at a large font (see above).
- **Replacing a row item with Edit** — every item there is used; moving one out would just move the problem.
- **A filled or tonal Edit** — two loud buttons on one screen; Send must stay the loudest.
- **Edit on the invoice paper** (a chip over the preview) — covers the document and fights the stamp and signature
  drag.
- **Keeping Edit in More as well** — two doors split one action across two names, and More's count would stop
  saying whether the move worked.
- **Keeping the name `more_edit_click` for the new button** — it would say "More" for a press that never opened More,
  and it was already one name for two screens (§1.4).
- **An icon-only pencil everywhere** — the owner's number is about finding Edit; a word is found faster. The pencil
  alone is only the fallback when the word does not fit.
