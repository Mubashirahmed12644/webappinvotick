# 0134 — CI takes what is idle, and spends the free minutes we were throwing away

- **Date:** 2026-09-20
- **Status:** prepared on `invotick-apis` branch `ops/ci-runs-at-low-priority` (`46bf206`).
  **Nothing applied to the VPS, nothing deployed.**
- **Asked for by the owner, 2026-09-20:**
  - *"kia ye possible hy ky ham CI ki setting kuch aisy kerain ky jab hamain zaroorat ho us waqt
    uski deserve RAM and CPU increase kerdain, and kam ker ky wapis release ker dain?"*
  - *"jab tak GitLab ky free minutes mojood hon to pehly usko use kery, jab wo khatam ho jae to VPS
    sy run kery."*

## A correction I owe first

I reported this morning that a CI build was taking **157 % CPU** of a two-core box. That was `ps`'s
**cumulative average since process start**, not an instantaneous reading, and the build container is
pinned to `cpus = "1"` — it **cannot** exceed one core. Measured properly mid-build on 2026-09-20:
**48 % of its one core, 1.156 GiB of its 3 GB.** The build container has been capped since
2026-09-05. CI was never taking both cores.

## Decision — part 1: priority, not a manual up and down

The honest shape of the owner's idea is **a weight**. A manual increase-before-a-push and
decrease-after is something a person has to remember every time and will eventually forget. A weight
is applied by the kernel on every scheduling decision, thousands of times a second, and needs nobody.

**What was already right:** the build container's `cpus = "1"`, `memory = "3g"`, `memory_swap = "3g"`.

**What was missing, all three measured:**

| gap | measured | fix |
|:--|:--|:--|
| the **test MySQL service had no limit at all** — `Memory=0`, `NanoCpus=0` — sitting beside a capped build | 456 MiB, 0.77 % CPU | `service_memory = "768m"`, `service_cpus = "0.5"` |
| **nothing gave production priority**: every container at the default weight, so CI and the app competed as equals | `CpuShares=0` on all | `cpu_shares = 128` → production wins about **8 to 1** when both want CPU, and CI still gets its whole allowed core whenever the box is quiet |
| **MySQL runs on the host**, so no Docker limit reaches it: `CPUWeight` unset, `MemoryMax=infinity` | **535 MB of mysqld in swap** while its own pool was 512 MB | systemd drop-in: `CPUWeight=10000`, `IOWeight=1000`, `MemoryLow=1600M` |

`MemoryLow` is a **soft floor, not a cap** — the kernel reclaims from cgroups above their `MemoryLow`
before touching one below it. There is deliberately **no `MemoryMax`**: a hard cap on a database is a
way to be killed at the worst moment.

**What a build will feel like:** unchanged when the box is quiet, which is when most pushes land.
Slower only while production is genuinely busy. The test job's median is **1,088 s** and its worst
**1,315 s** (13 recent runs, GitLab API); the estimate under the weight is **~1,150–1,250 s**. That is
an estimate from the CPU share, **not a measurement** — the pipeline run after this lands is what
will say.

**What happens if a build wants more memory than its cap:** `oom_kill_disable` is false, so the
kernel kills the JVM and **the pipeline goes red**. That is why the build's 3 GB is left alone rather
than trimmed — the measured peak is 1.4–2.1 GB and the headroom is the point.

**Not done: `io.weight`.** This kernel (5.15, cgroup v2) uses the **mq-deadline** scheduler, and
`io.weight` needs BFQ. Changing the disk scheduler on a production box for an unmeasured gain is the
worse trade, and the 1 GB buffer pool has already cut disk reads 78–99 % (decision 0126).

## Decision — part 2: free minutes first

**Measured: the namespace is on the Free plan with 400 compute minutes a month and had used ZERO of
them** (`monthly_minutes_used: 0`), because every job is pinned to the VPS with `tags: [vps]`. The
whole allowance was being thrown away every month while the box it was meant to spare ran **126
pipelines in 30 days**.

`choose-runner` runs first, **on the VPS** (spending shared minutes to find out how many shared
minutes are left would be its own joke), reads the namespace's monthly usage and writes
`$RUNNER_TAG`.

**Only `test` moves.** It is 1,088 s of a ~1,555 s pipeline and the one job that competes with
production for the box's two cores. `build:docker` (394 s) keeps the VPS's warm layer cache;
`deploy:staging` (73 s) stays because it must reach this machine.

**How much this is worth, honestly: 400 ÷ 18 ≈ 22 test jobs a month, out of 126 pipelines — about
one in six.** It is not a fix for the load. It is free, and free was going unused.

**Mid-month exhaustion — the margin is the point.** A test job is ~18 minutes and GitLab kills a
running job when the namespace runs dry, so choosing "shared" with 20 minutes left is choosing a red
pipeline. Below **60 minutes remaining** we stay on the VPS for the rest of the month. A missing
token, a network blip or an unexpected response shape all fall back to the VPS as well: the failure
mode must be *runs where it always ran*, never *waits for a runner that will not come*.

**What breaks on a shared runner — checked, each with a verdict:**

| | verdict |
|:--|:--|
| the deploy's SSH key | **fine, but not moved.** `SSH_PRIVATE_KEY` and `SSH_KNOWN_HOSTS` are CI file variables, not files on the box — so deploy *could* run anywhere. It stays on the VPS because it is 73 s and there is no reason to spend minutes on it. |
| registry push | **fine.** `CI_REGISTRY*` are predefined; nothing is local. |
| the test MySQL service | **fine.** `services: [mysql:8]` works on shared runners; it is where it used to run. |
| the test job's cache | **nothing to lose.** The job declares no `cache:` and uses `GIT_STRATEGY: clone`, so it starts cold on the VPS too. |
| a secret only on the VPS runner | **none found.** Everything the jobs read comes from CI variables. |
| `saas-linux-small-amd64` | confirmed present and `run_untagged=True` — which is exactly why the jobs were pinned in the first place (the CI file records pipelines being split at random between the two runners). Choosing the tag explicitly keeps that settled. |

**One new CI variable:** `GITLAB_QUOTA_TOKEN`, masked, **`read_api` scope only**. Without it the job
still runs and always answers `vps`.

## The runner config is at /srv, not /etc

`/etc/gitlab-runner` **does not exist on this host**. It exists only inside the `gitlab-runner`
container, which bind-mounts `/srv/gitlab-runner/config` over it. Confirmed by md5 on 2026-09-20.
Editing the path that looks right edits nothing, and the runner keeps its old behaviour while you
believe you changed it. Both files are now in `ops/vps/` so a rebuilt box keeps them.

## Rejected

- *A manual "increase before a push, decrease after".* It is what the owner described, and a weight
  gives him the same thing without anyone remembering.
- *Trimming the build's 3 GB.* Measured peak 1.4–2.1 GB; less headroom buys nothing and risks a red
  pipeline from an OOM kill.
- *`io.weight`.* Needs BFQ; see above.
- *Moving `build:docker` to shared runners too.* It would use 394 s of a 400-minute allowance per
  pipeline and lose the warm layer cache.
- *Leaving the VPS runner untagged as the catch-all.* Already tried and recorded in `.gitlab-ci.yml`:
  both runners took untagged jobs and GitLab split pipelines at random, which read as intermittent
  faults.
- *Reading the quota inside the test job.* Too late — by then the job has already been scheduled.

## Verified

GitLab's own `/ci/lint` on the changed file: **valid**. Nothing applied to the VPS.

## Open questions for the owner

1. Apply the runner limits and the MySQL drop-in? (Backup → change → proof → rollback commands are
   in the report; the agent runs them.)
2. Create `GITLAB_QUOTA_TOKEN` (masked, `read_api`) so the free minutes can be used? Shared runners on
   the Free tier need a validated credit card on the account — is one already on it?
