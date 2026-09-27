# 0177 — Every Save says "Save" and dims when there is nothing new to keep

**Date:** 2026-09-27 · **Owner:** "Hamesha 'Save', kuch na badla ho to halka." (approved on the 375 px mockup);
same day: "Invoice/estimate Save halka hona chahye." · **App:** `invoice-kmp-app` `feat/save-rule` (`c268dee6`),
merged into `VC_113_VN_149` at `b8264f10`. Unit 1563/1564, 1 skipped.

## Decision
- Anything kept in the user's lists says **Save** on a new and an existing record: client, business (both forms),
  tax, terms, unit, category, payment method, merchant, expense, discount, shipping, invoice number, signature, stamp,
  own footer, profile, the invoice line sheet, the details sheet, the invoice/estimate bar, the preview. Currency (a
  choice for this invoice) says **Done**. The item form keeps **Add** (it adds a line); its edit title is "Edit Product".
- **Dim rule.** Existing record: dim until something differs from what is stored, dim again when undone. Numbers
  compare by value; texts are trimmed as the save trims them. New record: dim only while empty; pressable once anything
  is entered, so the press can say what is missing.
- **Invoice/estimate bar.** An existing document left as it was dims (owner). A new document is never dimmed by this
  rule — protecting G1: the press is how a first-time user learns what is missing.
- **An untouched save writes nothing** — no version, no `dateUpdated`, no queued push, no status change — at the screen
  and in every repository `update*`, except payments (held for the Payments review).
- **A changed draft becomes "Unpaid" on Save**, as the create screen's Save already does (owner, 2026-09-27: "'Unpaid'
  ban jaye — jaisa aaj"). Only an **untouched** save leaves a draft alone.
- **Preview templates.** An unchanged design keeps the document's template. A changed design is written into the
  document's own custom template when no other invoice or estimate names it; otherwise a new row is made. Existing rows
  are untouched; any cleanup is a separate owner decision.
- **Analytics.** Labels moved, event names did not. Unnamed buttons pass their old word through `analyticsLabel`
  (`SaveButtonHistory`), and guard tests pin the names.

## Why
- Production, 30 days to 2026-09-27: 7,806 live "Template" rows, 2,067 made in 30 days by 678 users, one user with 50.
- Untouched saves wrote and synced every record they touched; an untouched invoice save turned a DRAFT into SENT.
- Six different words did one job: Save, Update, Save Changes, "Save " (trailing space), Save & Send (which sent
  nothing), Create.
- Found on the way: a client edit wiped the client's locked currency (invariant 6) — fixed in the same branch.

## Cost measured (monetisation rule)
- The ad gate no longer shows for untouched existing-invoice Saves. Upper bound (unchanged-ness isn't in the data),
  from an 8 % sample (523 of 6,380 release presses) scaled up: about 915 presses, ~512 interstitials, ~$0.60 a month —
  about 6 % of interstitial revenue ($9.46) and 22 % of interstitial shows (2,319). Estimates: 35 edit presses, 0 gates.

## Rejected
- "Update" once something changes, "Save" otherwise (the owner's own first idea, shown on the mockup): two words for one
  act, and an untouched Save could still be pressed.
- Keeping the invoice/estimate Save always pressable to protect ad impressions — the owner decided to dim it.
- Dimming a new invoice's Save while incomplete — strands first-time users (G1).
- Always updating the document's template in place — would change another invoice's look when the row is shared (G3).
- Deleting the duplicate template rows — a data change for the owner.
- Renaming stable ids that contain the old words (`save_changes_5`) — AGENTS-EVENTS §1.8.

## Open
- The estimate preview's Save marks the estimate SENT (pre-existing).
- Edit Item sheet treats a flat discount as 0 (`"FIXED"` vs `FLAT`) — Tier 1 money defect, being fixed separately.
- About 35 other screens (lists, share screens) still show raw exception text; payments excluded.
