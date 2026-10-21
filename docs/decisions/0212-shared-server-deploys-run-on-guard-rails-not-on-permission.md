# 0212 — Deploys on the shared server run on guard-rails, not on permission

**Date:** 2026-10-10 · **Status:** decided by the owner ("policy wo bana jo flexible ho, kisi ko bound nahi karna")

## Context
Invotick, Codlytics, Jariya and the exchange service share one VPS (16 GB). The owner made the Invotick agent the VPS
super manager ([[vps-super-manager-rules]]). The first Codlytics CI deploy was about to be fixed to a time of my choosing,
which bound the other project to my convenience.

## Decision
1. **No fixed deploy times, no per-deploy approval.** Whoever owns a project deploys whenever they want, by CI or by hand.
2. **Guard-rails decide, automatically and equally for everyone** (they live in the project's forced-command script):
   - never inside 02:00-02:59 UTC (Invotick's backup window; the only hard clock rule);
   - disk >= 10 GB free, MemAvailable >= 3 GB, load <= 3;
   - `invotick-server` healthy and up > 10 minutes (so nobody deploys on top of an Invotick restart);
   - 15 minutes between two deploys; a rolled-back sha is not retried;
   - compose policy (limits, no privileged, no docker.sock, localhost ports, internal network only);
   - health check after the deploy and an automatic rollback.
3. **My "go" is only for what touches SHARED things or Invotick** — the server's RAM/CPU/disk budget, the host (root-level files:
   cron.d, sshd, sudoers, systemd, firewall, Caddy edge), the docker daemon, and Invotick's own parts (MySQL, invotick-server, DNS).
   Never for an ordinary CI deploy, and **never for another project's own insides**: its database migrations, its schema, its
   containers' contents, its product choices. A bad migration in a project's own database breaks that project, not Invotick: the
   database is its own container, with its own memory cap, volume and network. That is the owner's line (2026-10-10): protect
   Invotick, do not police or interfere with the other projects. A new container or a higher limit is my business only because
   it spends the shared budget.
4. **The first deploy of a new pipeline and its rollback proof are watched** (a sampler writes load/RAM/health every 25-30 s and I
   read it afterwards); that is a measurement, not a gate, and the project does not wait for me.
5. **Emergency rule stays:** MemAvailable < 1.5 GB for 5 minutes -> I stop that project's web container only and tell the owner.
6. **Review:** after a month of clean deploys, loosen a guard if it only costs time.

## Rejected
- A time slot per project (binds people to my schedule).
- "Ready" confirmation from me before every deploy (a gate that adds waiting and no safety the script does not already give).
- No guards at all (one bad image could take Invotick down: 2026-09-21 outage).
