# 0076 — Server logs carry ids and codes, never a user's values

**Status:** decided by the owner on 2026-09-13 ("Haan, values band karein"). **Live 2026-09-13 14:58 UTC**
(`fix/logs-carry-no-values` → batch6 `14786cce`). Checked after the deploy: in 10 minutes, 0 sync-push lines carried
`properties`.
**Related:** 0050 (a sync failure carries its evidence as ids and codes only), `.claude/agents/sync.md` rule 2,
`docs/SUPPORT-VIEW-PLAN.md` (where this was found).

## Context (read-only, 2026-09-13)

- **`SyncV2Controller.pushSyncV2` logs every pushed record's values.** The line reads
  `Sync V2 values → VALUE | group={} | values={}`, at INFO, and it carries every property: client names, phone
  numbers, emails, amounts.
- **4,579 of 562,679 log lines in the last 24 h carried such values.**
- **Loki keeps logs with no retention,** so they stay for ever.
- **The sync-health trace endpoint** returns up to 200 of those lines to the admin panel.

## Decided

- **Logs name a record by its id, group, operation, version and error code,** never by the values a user typed. Sync
  reports already follow this rule (rule 2); logs follow it now.
- **The value line goes.** What a push needs for debugging is its ids and codes, and the stored row can always be
  looked up by id.

## Rejected

- **Keeping the values for debugging.** The ids already find the stored row. The values would sit in logs for ever,
  readable by anyone with log access.
- **Masking the values.** Partial data is still personal data, and masking every field type correctly is harder than
  not logging it.

## Consequences

- **Old lines that already hold values stay until retention removes them.** That is the next decision.
- **Guard:** a test pushes a record carrying a marker value, and fails if the marker reaches any log line.
