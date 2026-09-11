# 0051 — Sync and billing each have an owner agent, and its file is the policy

**Status:** decided (owner, 2026-09-11: *"sync and billing ye dono ky alag alag agents is project main
dedicated hon and unki md file maintain ho taky sari policy aik jagha per likhi jae"*) ·
**Date:** 2026-09-11 · **Related:** the `user-journey` agent (`AGENTS.md` §7.8)

## Why

- **Sync's rules were scattered.** The night's sync work needed context from seven memory files,
  four decisions, `AGENTS.md` and code comments, and every agent prompt had to restate it. Three of
  that night's errors came from what a prompt left out:
  - an agent built against an outdated contract;
  - a fix that covered creates but not updates;
  - a test guard that could never match on macOS.
- **Billing is Tier 1, and its rules were scattered too.** Play decides; only Google's refusal is
  final; one active base plan per product; what a defer does. They lived in 0047, 0048, a customer's
  memory file and the work queue.

## Decision

1. `.claude/agents/sync.md` and `.claude/agents/billing.md`, in the `user-journey` format. Each file
   holds:
   - the mandate;
   - what to read first;
   - where the mechanism lives;
   - the rules that were paid for;
   - how to get the data;
   - how to verify;
   - how to report.
2. **One home per fact:**
   - a rule lives in its agent file;
   - `AGENTS.md` points to it;
   - memory keeps incidents and dated state (the sync class table, the first customer);
   - a decision records why.
3. **Guard against drift:**
   - a rule goes into the agent file the moment it is decided;
   - every claim in the file is checked against the code before anyone relies on it;
   - a stale line is fixed, not worked around.
4. **Sync, premium or billing work loops in its agent**, the way journey and event work loops in
   `user-journey`.

## Rejected

- **Policy in `AGENTS.md` only.** It is already long, and a domain's rules scattered through a
  constitution get read once and skipped after that.
- **One "backend" agent for both.** Sync and billing fail differently (data loss vs money) and are
  verified differently (row fingerprints vs Google's answer).
- **Rules kept in memory only.** Memory is dated observation. A policy has to be current, and it has
  to live in the repo, where every session and every agent reads it.

## Consequences

- A prompt to either agent shrinks to the task itself; the file carries the rest.
- The files must be kept true — a wrong line in them is worse than none. Two such lines have already
  been believed: the `pgrep`/`comm` guard, and the "Merge Request" rule.
