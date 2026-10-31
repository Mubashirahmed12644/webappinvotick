# 0235 — A busy machine queues a deploy; it never refuses it

**Date:** 2026-10-24 · **Decided by:** the owner, for the principle only ("agar machine already 90% engage hai aur next deployment ko run karne ki
gunjaish nahi hai to usko queue mein laga do, mana nahi karna; jaise hi aik deployment complete ho to dosri start ho, system
farigh bhi na ho kaam ke load ke time par aur stuck bhi na ho") · **Applies to:** every project that builds on the owner's M3
and deploys to KVM4 (Invotick, Codlytics, Accplix, PMML, anything later).

## Why
The deploy scripts had grown refusals that project agents used as a reason to stop ("cooldown", "busy", "load", "window").
A refusal costs the owner a person-step (re-run, wait, ask). A queue costs nothing: the work happens when the machine can take it.

## The rule
**Busyness is never a reason to refuse. It is a reason to wait, in line, and to start the moment the line allows.**
A job is refused only for a reason that waiting cannot fix (list below).

### 1. The M3 (CI builds): one shared line, `ci-queue.sh`
- Reference implementation: `kaam/ops-scripts/ci-queue.sh` (copy it unchanged into your repo as `.github/scripts/ci-queue.sh`).
- Every project runs as its own macOS user, so the three runners could build at the same time and starve each other (a Next.js
  build under Rosetta hung for 45 minutes). One shared folder `/Users/Shared/ci-queue` (mode 1777, created once by the owner)
  holds the line.
- The first heavy step of each job is `ci-queue.sh acquire <project>`; the last step, with `if: always()`, is `ci-queue.sh release`.
- Rules in the script (**rewritten 2026-10-31, see Correction**): **oldest first**; **no limit on the number of jobs** - the owner's
  rule is only "queue when the machine is ~90% engaged", so a job starts the moment the Mac is under `CI_QUEUE_BUSY_PCT` (90) of its
  cores and has at least 10% memory free; the load figure lags a job that has just started, so the next start waits
  `CI_QUEUE_SETTLE_S` (45 s) after the previous one; `MAX_SLOTS` (8) is a safety ceiling for a runaway, not a rule; the head of the line is
  never starved (after `CI_QUEUE_STARVE_S`, 600 s, with nothing of ours running it starts even on a busy Mac); a waiting ticket not touched
  for 90 s belongs to a dead job and is dropped; a slot nobody released is taken back after 3 h; a job gives up only after 2 h of waiting
  (exit 75, "queue timeout", a message that says re-run, not a code failure). Workflows set `timeout-minutes` at least 180.
- A job waiting prints one line a minute ("waiting, N in line, M running"), so the log is alive and nobody thinks it is stuck.

### 2. KVM4 (deploys): one global line, one lock
- Every deploy script takes the **same** lock first: `flock -w 5400` on `/run/kvm4-deploy.lock` (90 minutes), then its own
  project lock. One deploy at a time on the box, in whatever order they arrive; the next starts the instant the lock frees.
- **No refusals for load, memory, cooldown, the 15-minute gap, the SSH-job limit or the quiet window.** Each of those becomes a wait:
  - Load / memory (MemAvailable below 3 GB, load above 3): check every 30 s, start after two good samples in a row.
  - The shared backup window 02:00-02:59 UTC: a request that arrives (or is still waiting) in it starts at 03:00.
  - No minimum gap between two deploys: the lock, the health gate and the rollback are the protection.
  - While waiting, print a line every 60 s (the ssh stream stays alive; the CI job sets `ServerAliveInterval=30`).
  - After 90 minutes without a start: exit 9, message "QUEUE TIMEOUT: the box stayed busy", and a note in the Health Centre/Slack
    for the owner. Nothing is dropped silently.
- **A newer request for the same project supersedes an older waiting one.** On arrival a request writes its run number to
  `/var/lib/<project>-deploy/latest-requested`; before it starts, a request whose run number is lower than that is finished with
  `SUPERSEDED by r<n>` and exit 0 (CI shows green; the newer deploy ships the newer code). A deploy that is running is never interrupted.
- A running deploy has a hard limit (20 minutes including the health wait). On timeout it rolls back, releases the lock and the
  line moves on. A lock whose holder is dead is released by the kernel (flock), so it can never stick.
- Invotick is the exception that wins ties: its own deploy may be marked `priority` and goes first when two are waiting. Others never.

### 2b. Addendum 2026-10-24 (found in the first independent review, Codlytics 32e796c): the three traps every deploy script must avoid
1. **Wait for the conditions OUTSIDE the lock.** The global lock is held only while a deploy actually runs. A request first waits for
   its conditions (window, load, memory, guard containers) WITHOUT any lock; then takes global then project lock; then samples the
   conditions once more; if they turned bad, it releases both locks (`flock -u 9; flock -u 8`) and goes back to waiting with the same
   elapsed counter. Waiting while holding the global lock blocks every other project, and waiting for `invotick-server` to be healthy
   while holding it would stop an Invotick fix from ever starting (a circular wait on production).
2. **A rollback ignores the deploy's deadline.** The 20-minute hard limit stops the forward deploy (pull, switch, health); the
   rollback after it gets its own full health wait and its own timeouts, never the leftover of the deadline. Otherwise the limit
   itself makes a clean rollback look like "ROLLBACK FAILED" (exit 7). Test it: limit 1 s, health recovers on the second probe,
   expect exit 1.
3. **Once a deploy has started, a dropped ssh must not kill it.** From the first change on: `trap '' HUP PIPE`, every status print
   `|| true`. While still waiting, a dropped ssh just ends the request (the kernel releases the flock), which is safe.
Also: a **missing guard container is a wait**, not a refusal (it is briefly absent while its own project recreates it); only a full
disk and policy problems refuse. The first good sample starts a quiet box at once; two good samples in a row are required only
after a bad one (recorded exception: a quiet box must not sit 30 s). `QUEUE TIMEOUT` is written to the deploy log and the manager
wires it to the Health Centre / Slack. A run number that is not strictly newer than the latest requested is not superseded by
accident: only `r<n>` greater than the waiting one supersedes it.

### 2c. Addendum 2026-10-24 (PMML review): background jobs never hold the box lock
Nightly dumps, weekly mirrors and any other timer job may WAIT for the box line (so a backup does not run on top of a deploy) but must
release the box lock (`flock -u 8`) the moment they have it: they keep only their own project lock. A 3-hour mirror holding the box
lock would stall every other project's deploy, Invotick's included, until its QUEUE TIMEOUT. A request that finds the project lock held
by someone who does not hold the box lock (a timer job, or an older script during a switch-over) releases the box lock and goes back
to waiting; it never waits for the project lock while holding the box lock. An "our own container is restarting" state is a note, not a
wait (the health gate and the rollback protect; a crash-looping stack must still be fixable by a forward deploy). Systemd units that wait
in the line need `TimeoutStartSec` longer than the wait plus the job. A host script must keep accepting an old config key for one
release and ignore it (Codlytics did), so a half-installed pair cannot refuse every deploy.

### 3. What stays a refusal (waiting cannot fix it)
Bad tag grammar; a tag older than the one deployed or one that was rolled back; wrong CPU architecture; a compose/policy violation;
missing secret or token; an image that does not exist; a rollback that failed (stop and report). These are correctness and safety.

## Who does what
- **Manager (Invotick session):** this decision, `ci-queue.sh`, the global lock file, `deploy-invotick`, the Health Centre note, review of each project's change.
- **Each project (its own agents, its own repo):** its deploy script change (queue instead of refuse, items in section 2), its
  workflow change (section 1 steps, timeouts, keepalive, treat `SUPERSEDED` as green), tests for both. Send the commit sha; the
  manager reviews against this page and installs the host file. "Waiting for the manager" is not an acceptable state.
- **Owner (once):** `mkdir -p /Users/Shared/ci-queue && chmod 1777 /Users/Shared/ci-queue`.

## Rejected
- Keeping a cooldown "to be safe": it was the excuse the owner objected to; the health gate and rollback are the safety.
- One daemon with a database queue: more to break; a lock plus tickets does the same with nothing to run or monitor.
- Refusing and letting CI retry: costs a person-step and starts a retry storm exactly when the machine is busy.

## Checks
- `ci-queue.sh` tested with four jobs and one slot: served in arrival order, each started the moment the previous released; a
  slot nobody released was taken back after its limit.
- Production check after each project's change: two deploys sent together run one after the other with no gap and no refusal.

## Correction 2026-10-31 (owner)
The first version of `ci-queue.sh` capped the Mac at "one heavy job, a second only when load < 40% and memory 25% free, never more than 2".
The owner never asked for that: he said **queue when the machine is 90% engaged**, nothing about a number of jobs. The cap and the 40% line were
the manager's own invention (fear of three builds starting in the same second: a Next.js build under Rosetta hung for 45 min on 2026-10-2x),
and this page wrongly put them under "Decided by: the owner". Rewritten the same day: busy test at 90% load / 10% free memory, no job-count limit,
a 45 s settle between starts, a 600 s anti-starvation start for the head of the line. Tested with 3 simultaneous projects on a not-busy Mac
(all 3 running, starts at 0 s, 2 s, 3 s with a 2 s settle) and on a busy Mac (the head waits, starts after the starvation time, the second waits).
Each project's copy `.github/scripts/ci-queue.sh` must be replaced by the new file (byte-identical copy of `kaam/ops-scripts/ci-queue.sh`).
