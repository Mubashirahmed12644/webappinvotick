# Feature registry: what each release changed, what number reads it, and whether it is measured

Owner of this file: the `release-impact` agent (`.claude/agents/release-impact.md`). Rule behind it:
[`docs/measurement-definition-of-done.md`](../measurement-definition-of-done.md). One row per measurable change.

States: **spec** (question written) / **built** (panel section exists) / **tested** (synthetic data + data-travel test
pass) / **silent-check** (Health Centre check exists) / **read** (verdict written). A row with nothing after "spec" is
measurement debt.

| Release | Feature (decision) | The ONE number | Declared expectation | Guardrails | State | Verdict (date) |
|---|---|---|---|---|---|---|
| 1.5.4 (planned) | Second-invoice nudges: next-step card, Repeat, unpaid reminder (feat/156-second-invoice) | first-invoice sharers who create a second invoice within 7 days | up from 14.2% (7 d, 1.4.9+, 2026-10-19 report) | duplicate numbers 0, ad revenue per user, uninstall, ANR | spec (mockup: second-invoice-nudges-mockup.html) | |
| 1.5.3 | Paywall exit question (0226) | answers per strip shown, reasons by door | none: it is a measuring tool | ad revenue, paywall conversion, Save/Share unaffected | built in app only; panel: none | |
| 1.5.3 | Support sheet + Rate Invotick straight to the store sheet (0225) | support-icon sessions that end in help sent or a rating press | more real ratings, fewer 1-star | average rating, 1-star share, Play-side counts (manual) | built in app only; panel: none | |
| 1.5.3 | PDF Save-to picker on Android 9 and older (`pdf_download_result`) | saved / (saved + failed) on Android 9- | fewer failed downloads | crash, ANR | built in app only; panel: none | |
| 1.5.3 | ANR diagnosis parameters on `app_cold_start` | share of ANR opens that carry a cause | every ANR open carries a cause | none | built in app only; panel: none | |
| 1.5.3 | Crash and ANR fixes (isolated process, settings recovery, WebView census) | crash-free and ANR rate, 1.5.3 vs 1.5.2 | ANR rate below 0.28% (1.5.2), no new cluster | all of the above | Play vitals only | |
| 1.5.0 to 1.5.2 | to be filled by the release-impact agent from the decision files and release notes | | | | | |

## Debt list (read first)
1. Events shipped in 1.5.3 that no panel page reads: `paywall_exit_reason`, `support_help_whatsapp`,
   `rate_sheet_result`, `pdf_download_result`, the ANR trace parameters.
2. The 1.5.4 nudges have a measurement section in their mockup but no panel or backend code.
3. There is no page that shows a release against the previous one.
