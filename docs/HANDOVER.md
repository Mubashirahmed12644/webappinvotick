# HANDOVER — live state (stub on `main`)

> The long handover written 2026-09-15 (how to start, where knowledge lives, in-flight branches, the owner's open
> actions) is on branch `feat/m3-theme-and-label-verification` as `docs/HANDOVER.md` and has not been merged into
> `main`. When it is, merge that file and keep the section below at its top. Verify every line against git and
> production before acting on it.

---

## Servers (2026-10-06) — read before touching production

Production moved on **2026-10-05/06** from the old Hostinger VPS to a new one. Decision:
[0210](decisions/0210-production-moved-to-the-new-kvm-4.md). Memory: `new-server-live.md`.

| | **N — the new server (live)** | **O — the old server (stopped)** |
|---|---|---|
| Address | `72.61.95.120` — Hostinger KVM 4, Ubuntu | `82.112.253.168` — Hostinger KVM 2 |
| Status | Everything below runs here | **Expires 2026-10-22, auto-renew OFF.** Invotick backend STOPPED, DB user locked, crons OFF. nginx only forwards the stale DNS names to N. |

**What runs on N**

| Piece | How |
|---|---|
| Invotick backend | docker container `invotick-server` (port 8085 inside), against **native MySQL 8.0.46**, DB `invotick_prod` |
| Edge | **Caddy**: `stage`, `gw`, `go`, `grafana`, `excahnge` (sic), `jariya`, `next-api` |
| Exchange rates | systemd `exchange-rates.service`, `127.0.0.1:8083` |
| Jariya (another product) | systemd `jariya-api.service` + Postgres 16 |
| Monitoring | prometheus, grafana, loki, promtail in docker |
| Crons (ON) | nightly backup 02:00 UTC (mysql + uploads + secrets), 02:30 UTC postgres, watchdog, sentinel |
| Backups go to | rclone remote `gdrive_ahmed:Invotick-Backups`; secrets are `age`-encrypted. **The age private key is in the owner's password manager. It is never in a file, a doc or a chat.** |

**CI.** GitLab `invotick/invotick-apis`, branch `stage` = production. A push to `stage` runs `test → docker → deploy`; the deploy
goes to **N** through the forced command `deploy-invotick` (`DEPLOY_TARGET=new`). Tests run on the owner's Mac runner (see
memory `ci-shared-minutes-ran-out-2026-09-28.md`). `stage` head **`4361e503`** is live (2026-10-06). Never retry an old
pipeline once a newer commit has deployed (`invotick-apis/CLAUDE.md`).

**The cutover (all UTC, all verified)**

| What | When |
|---|---|
| Freeze of O -> data on N | 2026-10-05 09:58:20 -> 10:20:45 (**22 min 25 s**); diff **empty**: 78 tables, 20 checksums |
| First user write on N | 10:20:47 |
| DNS `stage`, `gw`, `go`, `grafana` -> N | 2026-10-05 10:57 |
| DNS `excahnge` -> N | 2026-10-06 ~12:3x |
| Jariya moved, DNS `api.jariya.net` -> N | 2026-10-06 14:00 (503 for 3 min 38 s) |
| Health Centre fix + index `idx_ae_delivery_cover` (built by hand, 63 s) | 2026-10-06 13:10 |

Scripts: `~/Documents/Invotick/kaam/ops-scripts/new-vps/` (`02-cutover.sh` etc.; logs in `cutover-state/`). Plans:
`~/Documents/Invotick/kaam/research/new-vps-2026-10-02/`. DNS zone backups (taken before every change):
`~/Documents/Invotick/kaam/releases/dns-backups/`.

**Rollback facts**

- **`rollback-a` is no longer valid** since the first user write on N (2026-10-05 10:20:47 UTC): N holds data O never saw.
- The Hostinger snapshot of O, **id 388838, expired 2026-10-06 09:53 UTC**. There is no snapshot of O any more.
- What is left is the nightly backup on Google Drive (a rebuild, not a switch). Jariya's rollback script on O is valid only
  until the first stored progress row on N, which has passed.

**Traps**

- **Every push to `stage` deploys to N now.** There is no staging box.
- Never run `docker logs -f` (or any follower) on N and leave it: orphaned readers throttled the old box on 2026-09-05.
- ufw on N allows **6 new ssh connections per 30 s**; a loop of ssh calls locks you out. Use one connection per batch.
- The Hostinger DNS token for `invotick.com` / `jariya.net` **expires about 2026-11-04**; ask the owner for a new one before
  any later DNS work. Zones are edited through Hostinger's DNS-zone API (`GET/PUT .../api/dns/v1/zones/<domain>`, validate
  first). The token is a file on this Mac, never in a doc.

**Open follow-ups** (from `memory/pending-work-queue.md`, "CUTOVER DONE")

1. **Google Play notification (RTDN):** recheck when a real purchase notification first arrives on N.
2. **`Duplicate entry users.PRIMARY` ERROR noise:** 27 in 36 h, all from `POST /v1/auth/login-as-guest`, harmless (no 5xx, the
   row exists once). Proposal, not built: insert-if-absent for those inserts, log 1062 at WARN, and look at the client's
   double-send on first login.
3. **Two nights of monitoring** on N (backups arrive on Drive, watchdog, sentinel, Health Centre).
4. **Before ~2026-10-21: clean O** (it expires 10-22 and is not renewed). Anything still wanted from it first.
5. **Container-memory Health Centre card** (`62b2d4f`): the owner allowed it to ship with the CI merge.
6. **Owner:** grant `claude-analytics` "View financial data" (App Optimisation project) for the 4G-only app finance report.
7. **Owner:** keep the age key safe; ask for a new DNS token after ~2026-11-04 if more DNS work is planned.

Done and no longer open: exchange DNS, Jariya DNS, merging the three migration branches and switching CI to N, the Health
Centre slow check.
