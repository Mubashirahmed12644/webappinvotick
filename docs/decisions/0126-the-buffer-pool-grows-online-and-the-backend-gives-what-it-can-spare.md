# 0126 — The buffer pool grows online, and the backend gives only what it measurably has to spare

- **Date:** 2026-09-20
- **Status:** prepared, **nothing applied, nothing deployed**. Branch
  `invotick-apis` `infra/backend-memory-limit` (`2b6573d`) and
  `invotick-apis` `migration/analytics-covering-index` (`87f9e35`), both awaiting the owner's go.
- **Owner's decision, 2026-09-20 (0121 Q1):** raise MySQL to 2 GB and take the RAM from the
  backend's limit — not from monitoring, not from `jariya-api`, not waiting for the VPS migration.

## Decision

**Three of the four things asked for are safe and prepared. One is not, and is refused with the
measurement that refuses it.**

1. **MySQL's buffer pool is resized online. There is no restart and no downtime.**
   `innodb_buffer_pool_instances = 1` and `innodb_buffer_pool_chunk_size = 128 MB` on this server,
   so `SET GLOBAL innodb_buffer_pool_size` is valid at any multiple of 128 MB and MySQL 8.0.46 does
   the move in the background. The earlier plan's "restart window" does not exist.
2. **The first step is 512 MB → 1 GB, not 2 GB**, and it costs the backend nothing: it comes from
   the page cache, which is caching the same InnoDB files less usefully.
3. **The backend goes to 2.5 GB, not 1.5 GB.** It frees 500 MB — a third of what was asked for — and
   the reason is below.
4. **2 GB is reachable only after the CI runner leaves this box.** It takes 1.40 GB plus a 427 MB
   test MySQL on every push, and it is the only 1.8 GB here that serves no user.

## Why 1.5 GB for the backend is refused

From this box's own Prometheus, 30 days:

| | |
|:--|--:|
| heap ceiling today (`MaxRAMPercentage=75` of 3 GB) | 2,304 MB |
| **live data after a full GC, peak** | **994 MB** |
| the same figure two weeks earlier | 517 MB |
| heap used, peak 30 d | 1,979 MB |
| heap used, peak 7 d | 1,632 MB |

A 1.5 GB container gives a **1.125 GB heap**, which is **131 MB above the live set** — and the live
set has roughly doubled in a fortnight as the analytics table grew. The entrypoint carries
**`-XX:+ExitOnOutOfMemoryError`**, so the JVM does not slow down and struggle on: it **exits**. The
container restarts, and sync, the panel and the share-link mint go down together. The compose file
already carries the scar of the same mistake in the other direction — *"2g was not enough for the
all-users cache build"*.

**2.5 GB gives a 1.875 GB heap, 1.9× the live set.** That is a working margin, not a comfortable
one, and it is written into the file with the number to watch: if `jvm_gc_live_data_size_bytes`
passes ~1.2 GB, put it back to 3 GB and find the pool's memory elsewhere.

## Why the whole 1.5 GB is not on this box at all

Measured while a CI build was running (2026-09-20 11:4x UTC):

| holder | steady | during a CI build |
|:--|--:|--:|
| backend JVM (limit 3 GB) | 1.82 GB | 1.82 GB |
| mysqld | 1.23 GB resident **+ 535 MB already in swap** | same |
| **CI build container** | — | **1.40 GB** |
| **CI test MySQL** | — | **0.43 GB** |
| `jariya-api` (a different product) | 0.45 GB | 0.45 GB |
| exchange service | 0.17 GB | 0.17 GB |
| Loki, Grafana, Prometheus, promtail, cAdvisor, node-exporter | 0.46 GB | 0.46 GB |
| nginx, dockerd, the rest | 0.25 GB | 0.25 GB |
| **total against 7.94 GB** | **~4.9 GB** | **~6.7 GB** |

During that build: **free RAM 176 MB, 1,424 MB in swap**. Giving the pool +1.5 GB permanently would
mean ~8.2 GB demanded on a 7.94 GB box every time the owner pushes — and the first thing to swap
would be the buffer pool itself, which already has 535 MB on disk. **A swapped buffer pool is a disk
cache with extra steps**; it would be slower than the 512 MB it replaced.

## The runbook — backup, change, proof, rollback

Each is one runnable command. The agent runs them; the owner gives the word.

### Part A — the buffer pool, 512 MB → 1 GB (online, no restart, no downtime)

**Backup** *(records what it is now, and the config line)*
```
ssh -i ~/.ssh/invotick_ro root@82.112.253.168 'cp -a /etc/mysql/mysql.conf.d/mysqld.cnf /root/mysqld.cnf.bak-$(date +%F_%H%M%S) && mysql -u root -e "SELECT @@innodb_buffer_pool_size/1048576 AS pool_mb_before, @@innodb_buffer_pool_instances AS instances, @@innodb_buffer_pool_chunk_size/1048576 AS chunk_mb" && ls -l /root/mysqld.cnf.bak-*'
```

**Change** *(the running server first, then the file so it survives a restart)*
```
ssh -i ~/.ssh/invotick_ro root@82.112.253.168 'mysql -u root -e "SET GLOBAL innodb_buffer_pool_size = 1073741824" && sed -i "s/^innodb_buffer_pool_size = 512M/innodb_buffer_pool_size = 1G/" /etc/mysql/mysql.conf.d/mysqld.cnf && grep -n innodb_buffer_pool_size /etc/mysql/mysql.conf.d/mysqld.cnf'
```

**Proof** *(the resize is done, the file agrees, and the box did not start swapping)*
```
ssh -i ~/.ssh/invotick_ro root@82.112.253.168 'sleep 30; mysql -u root -e "SELECT @@innodb_buffer_pool_size/1048576 AS pool_mb_now; SHOW GLOBAL STATUS LIKE \"Innodb_buffer_pool_resize_status\"; SHOW GLOBAL STATUS LIKE \"Innodb_buffer_pool_pages_total\"" && free -m && grep -n innodb_buffer_pool_size /etc/mysql/mysql.conf.d/mysqld.cnf'
```

**Rollback** *(also online; nothing restarts)*
```
ssh -i ~/.ssh/invotick_ro root@82.112.253.168 'mysql -u root -e "SET GLOBAL innodb_buffer_pool_size = 536870912" && sed -i "s/^innodb_buffer_pool_size = 1G/innodb_buffer_pool_size = 512M/" /etc/mysql/mysql.conf.d/mysqld.cnf && mysql -u root -e "SELECT @@innodb_buffer_pool_size/1048576 AS pool_mb_after_rollback" && free -m'
```

### Part B — the backend's limit, 3 GB → 2.5 GB

**This cannot be done on the box.** The deploy `scp`s `docker-compose.yml` from the repo to the VPS
on every push, so an edit there is overwritten by the next one. It is a repo change and a normal
deploy: branch `infra/backend-memory-limit` (`2b6573d`) → merge to `stage`.

**Backup** *(the current limit, from the container itself)*
```
ssh -i ~/.ssh/invotick_ro root@82.112.253.168 'docker inspect invotick-server --format "Memory={{.HostConfig.Memory}} MemorySwap={{.HostConfig.MemorySwap}}" && cp -a /home/invotick-stage/htdocs/stage.invotick.com/docker-compose.yml /root/docker-compose.yml.bak-$(date +%F_%H%M%S) && ls -l /root/docker-compose.yml.bak-*'
```

**Change** — merge the branch to `stage` and let the pipeline deploy it. The backend restarts once,
as it does on every deploy.

**Proof** *(the new limit is in force and the heap ceiling moved with it)*
```
ssh -i ~/.ssh/invotick_ro root@82.112.253.168 'docker inspect invotick-server --format "Memory={{.HostConfig.Memory}}" && sleep 60 && curl -s http://127.0.0.1:8085/actuator/prometheus | grep -E "jvm_memory_max_bytes.*Old Gen|jvm_gc_live_data_size" && free -m'
```

**Rollback** *(revert the commit and deploy; or, to get RAM back in seconds without waiting for a pipeline)*
```
ssh -i ~/.ssh/invotick_ro root@82.112.253.168 'docker update --memory 3g --memory-swap 6g invotick-server && docker inspect invotick-server --format "Memory={{.HostConfig.Memory}}"'
```
The `docker update` is the emergency lever only — the next deploy puts the file's value back, so the
commit must be reverted as well.

### What stops, and for how long

| | |
|:--|--:|
| the buffer pool resize | **nothing stops.** No restart, no dropped connection |
| the backend limit | one ordinary deploy: the backend is down ~30–60 s |
| during the backend restart | app sync, the admin panel, share-link minting, `/i/{token}` server render. Devices queue their events and resend |
| CI | unaffected either way |

**The quietest hour is 00:00 UTC**, from the last seven days: 6,007 events (372 devices), then 23:00
(6,841) and 01:00 (7,806). That is 05:00 PKT. The busiest is the middle of the UTC day. The pool
resize needs no window at all; the deploy should use one.

## After — the proof the owner is paying for

Re-run on production and put beside today's numbers. Prepared and kept.

| read | before, 2026-09-20 | after |
|:--|--:|--:|
| Pehli invoice ka safar, 30 d | 17.1 s · 742 MB from disk | *(to fill)* |
| Muqabla, 30 d, 24 h window | 10.8 s · **3,167 MB from disk** | *(to fill)* |
| Live Events user list, 30 d | 5.0 s · 671 MB from disk | *(to fill)* |

The number to watch is the disk column, not the seconds: that is what a bigger pool changes.

## 0121 question 2 — the three indexes: **yes, drop them**

The only one with a doubt was `idx_analytics_events_event_name`, because the optimizer picks it for
the UTM reads. Re-measured on production today, 30 days:

| | optimizer free (picks `_event_name`) | forced onto `idx_analytics_events_name_ts` |
|:--|--:|--:|
| install referrers of the range | 0.80 s | **0.69 s** |
| the shared-invoice variant | 0.51 s → 0.24 s | **0.31 s** |

`name_ts` is `(event_name, event_timestamp)` — a superset of `_event_name` — and it is **no slower
in either read**. So:

| index | size | why it goes |
|:--|--:|:--|
| `idx_analytics_events_event_name` | 103 MB | a strict prefix of `idx_analytics_events_name_ts`, measured no slower |
| `idx_analytics_events_screen_name` | 80 MB | a strict prefix of `idx_analytics_events_screen_ts` |
| `idx_analytics_events_item_id` | 55 MB | cardinality **1** |

**238 MB back, and three fewer index writes on every one of the ~53,575 events a day** — about
160,725 writes a day that buy nothing. Not prepared as a migration yet: it belongs in the *same*
`ALTER TABLE` as question 3's index, because one pass over a 2.24 GB table is cheaper than four.

## 0121 question 3 — the covering index: prepared, alone, not applied

Branch `migration/analytics-covering-index` (`87f9e35`), one SQL file, no code:
`idx_ae_instance_ts_cover (app_instance_id, event_timestamp, event_name, screen_name, country)`,
`ALGORITHM=INPLACE, LOCK=NONE`. Worth a measured **7.1 s** of Muqabla's 10.8 s; costs ~270 MB and one
more index write per event. **The pool belongs before it, not after** — an index that does not fit in
memory is another thing to read off disk. Nothing uses it until the hint in
`JourneyComparisonRepository` changes, which is the code half and ships separately.

## 0121 question 5 — the retention job: **it is running, and the 199 days was the wrong column**

- It purged **232 events at 10:26 UTC today**, cutoff `2026-03-24`, and the oldest `event_timestamp`
  in the table is `2026-03-24 10:26:17` — exactly the cutoff. It is working.
- The 199-day figure was read off **`created_at`** (arrival). Retention deletes by
  **`event_timestamp`** (when the app says it happened). **116 rows** arrived over 180 days ago and
  carry a newer `event_timestamp`, so they are kept deliberately. Nothing is broken.

Two things that *are* worth acting on, found while checking:

1. **503 rows carry an `event_timestamp` in the future**, so they can never reach the cutoff and will
   be kept for ever. A phone with a wrong clock is enough. Harmless at 503; a bad release makes it
   not harmless.
2. **The purge can clear 10,000 rows a day (`batch 500 × 20 slices`) against an intake of 53,575.**
   It looks fine today only because March's volume was small. When September's ~41–53k-a-day rows
   turn 180 days old — about **March 2027** — the purge falls behind by roughly 43,000 rows a day and
   the table never stops growing. **The cap is about five times too small**, and it is a
   configuration value (`analytics.cleanup.*`), not a code change.

## Rejected

- *Restarting MySQL for the resize.* Unnecessary: `innodb_buffer_pool_instances = 1` and
  `chunk_size = 128 MB` make the online resize valid, and 8.0.46 supports it.
- *1.5 GB for the backend.* Measured above. It is 131 MB above the live set, and the JVM exits
  rather than degrades.
- *2 GB for the pool today.* The box does not have the 1.5 GB while the CI runner takes 1.8 GB on
  every push; the pool would be the thing that swapped.
- *Editing `docker-compose.yml` on the VPS.* The deploy `scp`s it from the repo and would silently
  undo the change on the next push.
- *Taking the RAM from monitoring or `jariya-api`.* The owner excluded both.
- *Doing questions 2 and 3 as separate migrations.* Four passes over a 2.24 GB table instead of one.

## Open questions for the owner

1. **Do part A now** — pool 512 MB → 1 GB, online, no restart, nothing else touched, reversible in
   one command? *(Recommended. It is the only step with no cost to anything else.)*
2. **Then part B** — merge `infra/backend-memory-limit` so the backend goes to **2.5 GB**, not the
   1.5 GB asked for, and the pool can go to 1.5 GB after? Or leave the backend alone at 3 GB?
3. **Move the GitLab runner off this box?** It is 1.8 GB on every push, it is the only large thing
   here serving no user, and it is what makes 2 GB impossible today.
4. **Drop the three indexes and add the covering index in one `ALTER TABLE`** (net +32 MB, 7.1 s off
   Muqabla, minutes of online rebuild), after the pool is bigger?
5. **Raise the retention purge cap** from 10,000 a day to ~60,000 before March 2027, and decide what
   to do with the 503 future-dated rows?
