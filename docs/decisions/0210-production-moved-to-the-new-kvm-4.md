# 0210 — Production moved to the new KVM 4 (72.61.95.120); the old VPS is not renewed

- **Date:** 2026-10-05 / 2026-10-06
- **Status:** decided and **done** — the cutover, the DNS flips and the CI switch are live
- **Decision:** All of Invotick's server side runs on one new Hostinger VPS, **N = 72.61.95.120** (KVM 4, Ubuntu). The
  old VPS **O = 82.112.253.168** (expires **2026-10-22**, auto-renew **OFF**) is left to expire; nothing is bought to keep it.
- **Why (owner):** two servers are not affordable, and the old one expires on 2026-10-22 with auto-renew OFF, so production had
  to be on the new box before then, with the data proven identical and a tested off-box backup running.

## What the owner decided (his words, kept as rules)

| Decision | Meaning |
|---|---|
| **The cutover happens only on his written word.** | The freeze and the cutover waited for his message; no agent started them on its own judgement. |
| **The DNS flip is a separate decision from the cutover.** | The data moved first and was proven identical; the names pointed at N only after that, on his "DNS badal do". |
| **Two servers are not affordable.** | O is not kept as a warm standby past its expiry. |
| **O is not renewed.** | Auto-renew stays OFF; the snapshot and the DB lock are the only safety until it expires. |

## What was done

| Step | When (UTC) | Fact |
|---|---|---|
| Freeze of O's writes | 2026-10-05 09:58:20 | Backend put in maintenance, writes stopped. |
| Data on N, verified | 10:20:45 | Window **22 min 25 s**. Verify diff **empty**: 78 tables, 20 checksums. |
| First user write on N | 10:20:47 | From here the old data is stale; **rollback-a is no longer valid**. |
| DNS `stage`, `gw`, `go`, `grafana` -> N | 2026-10-05 10:57 | Owner's word; zone backed up first (`kaam/releases/dns-backups/`). MX, `www`, `admin` untouched. |
| DNS `excahnge` (exchange rates) -> N | 2026-10-06 ~12:3x | Exchange service runs on N as the systemd unit `exchange-rates.service` (127.0.0.1:8083). |
| Jariya moved, DNS `api.jariya.net` -> N | 2026-10-06 14:00 | `jariya-api.service` + Postgres 16 on N; 32/32 tables identical (103,135 rows); clients saw 503 for 3 min 38 s. |
| CI switch | 2026-10-06 | `stage` deploys to N through the forced command `deploy-invotick` (`DEPLOY_TARGET=new`); stage head `4361e503` live. |
| Health Centre slow check | 2026-10-06 13:10 | Index `idx_ae_delivery_cover` built by hand on N (63 s, online); the check went from 17-18 s to 0.4-0.6 s. |

On N: the backend is the docker container `invotick-server` against the **native MySQL 8.0.46** (`invotick_prod`); **Caddy** is
the edge for stage/gw/go/grafana/excahnge/jariya/next-api; monitoring (prometheus, grafana, loki, promtail) runs in docker;
the nightly backup (02:00 UTC mysql + uploads + secrets, 02:30 UTC postgres), the watchdog and the sentinel are ON, to the
rclone remote `gdrive_ahmed:Invotick-Backups`, secrets encrypted with `age`. **The age private key is in the owner's
password manager and is never written in any document.**

On O: Invotick backend STOPPED, DB user locked, crons OFF, nginx forwards the stale DNS names to N. Left only until it expires.

## Rollback facts

- **Rollback to O (rollback-a) is no longer valid** since 2026-10-05 10:20:47 UTC: N holds user writes O never saw.
- The Hostinger snapshot of O (**id 388838**) **expired 2026-10-06 09:53 UTC**. There is no snapshot of O any more.
- The only rollback left is a restore from the nightly backup on Google Drive onto a server, which is a rebuild, not a switch.
- Jariya's rollback script on O is valid only until the first stored progress row on N (already past).

## Options rejected

| Rejected | Why |
|---|---|
| **Keep both servers** (O as standby or second node) | Not affordable (owner); and O would hold stale data that a stale DNS name or script could write to. |
| **Renew the old server** | Auto-renew stays OFF (owner): O is left to expire on 2026-10-22; nothing is bought to keep it. |
| **Move CI before the cutover** | CI was switched only after N served users. Until the new CI file was merged, `stage`'s old pipeline would have deployed to O the old way and started O's backend, so nobody pushed to `stage` in between. |

## Follow-ups that stay open

See `docs/HANDOVER.md` section "Servers (2026-10-06)": recheck Google's purchase notification when a real one arrives;
the harmless `Duplicate entry users.PRIMARY` ERROR noise (proposal, not built); two nights of monitoring; O cleanup before
2026-10-21; the DNS API token that expires about 2026-11-04.

## Where the proof is

Scripts `kaam/ops-scripts/new-vps/` (`02-cutover.sh`, logs in `cutover-state/`); plans `kaam/research/new-vps-2026-10-02/`;
DNS zone backups `kaam/releases/dns-backups/`. Memory: `new-server-live.md`.
