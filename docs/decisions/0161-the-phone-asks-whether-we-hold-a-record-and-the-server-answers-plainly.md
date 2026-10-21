# 0161 — The phone asks whether we hold a record, and the server answers plainly

*2026-09-25. Backend `POST /v2/sync/reconcile`, optional `ids` in and `held` out.*

## The problem

A record on a phone can be in a state the app had no word for before 1.4.9: **sent, with no answer**.
Waiting cannot resolve it, because only the server knows whether the record arrived. And nothing
already on the wire could be asked:

| Route | Takes | Can it answer "do you hold record X"? |
|:--|:--|:--|
| `GET /v2/sync/pull` | a **time** cursor | No — and the push moves that cursor past the record, so a delta pull can never re-offer it |
| `POST /v2/sync/reconcile` | **counts** per entity type | No — it can say four are missing, never *which* four |
| `POST /v2/sync/push` | the records | Only by re-sending them, which is the loop being ended |

So the phone guessed. Guessing wrong loses the record, or sends it for ever.

## Decided

`POST /v2/sync/reconcile` takes an optional `ids` map and answers an optional `held` map. Same route,
same schedule, same authentication; a finer grain of the same question.

```
{ "counts": { … },  "ids": { "invoices": ["…"], "invoiceItems": ["…"] } }
→ { "counts": { … }, "held": { "invoices": { "<id>": { "version": 4, "updatedAt": "…", "deleted": false },
                                             "<id>": null } } }
```

- **Ids and versions only.** No content, so nothing is worth reading if it leaks and nothing is worth
  weighing. A deleted row, a guest's row and a stranger's row all cost the same.
- **Only this account's rows.** Every query is scoped by user, so another account's id is simply not
  returned — indistinguishable from an id that never existed. This must not become a way to learn
  whether an id exists anywhere.
- **A soft-deleted row is HELD, and says so** (`deleted: true`). Answering "not held" would invite the
  phone to send it again, turning a deletion into a resurrection.
- **Absent is unknown; `null` means not held.** A group whose read failed is left out entirely rather
  than answered all-null, because all-null would make the phone queue every one of those records.
- **200 ids across all groups, and an ask above that is refused whole with 400.** Not answered in
  part: the ids left out would be absent from `held` and the phone has no way to tell that from "not
  held". This is the `duplicate-press` truncation defect (fixed the same day) with a user's data as
  the cost instead of a dashboard's honesty.
- `ids` absent or empty behaves exactly as this route behaved before the field existed, and `held` is
  then absent from the response.

Cost: at most 200 primary-key lookups across at most twelve `IN` queries, all user-scoped — cheaper
than the twelve COUNTs the same call already runs, and it grows with what the phone asks rather than
with the table (§5a / decision 0034).

## Rejected — "answer *I already hold this* before resolving references"

Proposed alongside this, as a one-line reorder in `createFromSync`, to unstick records refused with
`INVALID_REFERENCE` although the server holds them. Rejected on three grounds.

1. **The order it asks for already exists.** `requireIncomingWinsOnCreate` refuses a create whose copy
   loses the conflict — "the server already holds a newer version" — before any reference is touched,
   and `checkNotStale` does the same in the update path. The only case left is the one where the
   incoming copy **wins**.
2. **Changing that case is silent data loss.** Answering "already held" to a copy the conflict policy
   calls newer means discarding a user's edit without telling them. That is the same lever the owner
   already refused — a server saying "applied" about something it did not apply, to make a device be
   quiet — wearing a different name.
3. **Measured, it would heal nothing today.** Of the 14 records still refused with `INVALID_REFERENCE`
   in the 48 hours to 2026-09-25, **12 are not on the server at all**, so the refusal is honest. The 2
   that are held account for 4 refusals and were last seen on 2026-09-23. The record the proposal
   names, `43a9e342`, *is* held at version 1 since 2026-08-21 and was refused 19,517 times — but its
   loop stopped on 2026-09-17.

The masked class is real and was expensive when it burned. It is answered by the ask above, honestly:
the phone asks whether the record is held, the server says yes and at what version, the phone settles
the record — and the user's edit is not thrown away to achieve it.

## Also considered

- **A new route.** Rejected: reconcile is already authenticated, already called on a schedule, and
  already the place where "what do you have, what do I have" is asked.
- **Returning the record.** Rejected: it is a pull wearing a different name, with a payload and a
  privacy surface, to answer a yes/no question.
