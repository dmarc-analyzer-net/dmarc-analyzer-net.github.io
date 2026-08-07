---
title: Monitoring and alerting
description: What to probe, what to alert on, and the one fact that matters most — the worker has no HTTP surface, so watch the data move, not just the endpoints.
section: Operations
order: 4
publishDate: 2026-07-27
updatedDate: 2026-08-02
---

The app exposes no `/metrics` endpoint and ships no OpenTelemetry today. The
monitoring surface is a handful of HTTP endpoints, two authenticated JSON
views, and the logs — which turns out to be enough, if you watch the right
things.

## The fact that shapes everything else

**The worker has no HTTP listener.** In split mode it is a plain background
process: no port, no probes (the Helm chart deliberately gives its Deployment
none), no way to ask it "are you alive?". It can die, or sit crash-looping, and
every green check on the console will stay green — the console serves fine
without it.

So the worker is monitored by its *output*: if reports stop moving, it is down,
whatever else looks healthy. That check is below.

## What to probe

| Endpoint | Auth | Healthy | It proves |
|---|---|---|---|
| `GET /health/live` | none | 200 | The process is up |
| `GET /health/ready` | none | 200 (503 when not) | The database is reachable |
| `GET /api/v1/auth/setup` | none | 200 | The database is reachable **and migrated** — this is what the Compose healthcheck and the chart's readiness probe use |
| `GET /` | none | 200 | The console serves (probe through your proxy, so TLS and the certificate get checked too) |

In combined mode (`APP_MODE=all`) these cover the ingestion loop's process too,
though not whether it is making progress.

## Watching ingestion — the check that matters

`GET /api/v1/mailbox-health` returns one row per mailbox source, and the field
to alert on is **`lastSuccessSyncAtUtc`**. The default poll interval is one
hour, so:

> Alert when `now − lastSuccessSyncAtUtc` exceeds **three poll intervals**
> (three hours on defaults) for any active source.

That single rule catches a dead worker, a lost advisory lock, a broken mailbox
password, a full disk, and an expired app password — everything that stops
reports arriving, whatever the cause. The endpoint needs a `dmarc_session` cookie
from an **agency staff** account, so a scripted check logs in first:

```bash
curl -s -c /tmp/cj -X POST https://dmarc.example.com/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"monitor@example.com","password":"…"}' > /dev/null
curl -s -b /tmp/cj https://dmarc.example.com/api/v1/mailbox-health \
  | jq -r '.[] | select(.isActive) | "\(.name) \(.lastSuccessSyncAtUtc) \(.lastRunStatus)"'
```

Use a **dedicated `agency_analyst` account** as the monitoring identity. An
analyst can read mailbox health and triage alerts but cannot reach any `/admin/*`
route, which is the least privilege this check can run with — a `client_viewer`
is *not* enough and gets a flat `403`, so a check built on one never succeeds and
never tells you anything. [Using the API](/docs/using-the-api/) covers the sign-in
mechanics, the role tiers, and the response shapes a scripted check should assert
on — including why a mistyped path returns `200`.

Two secondary signals from the same endpoint and
`GET /api/v1/mailbox-sync-runs`: `lastRunStatus: "failed"` with its
`lastRunError`, and a non-zero parse-failure count — reports arriving that
can't be read, which staleness alone won't show.

## Log lines worth matching

These are the exact strings the code emits:

| Log line | Meaning |
|---|---|
| `Queue worker started.` | The ingestion loop is running — its absence after a restart is the finding |
| `Another worker already holds the ingestion lock on this database.` | A second worker refused to start. After an unclean kill the old lock can linger a minute or two and the replacement crash-loops — persistent repeats are the problem |
| `Worker scheduler pass failed (N consecutive)` | The loop is erroring and backing off; a climbing count means DB or mailbox trouble |
| `Auto-closed N stale running mailbox sync runs older than M minutes` | Syncs are hanging past their timeout |
| `Failed to send "…" to N recipient(s)` | SMTP delivery failed — alert and digest email is not going out |

On email specifically: an alert with **Emailed: no** on the [Alerts
screen](/docs/alerts-and-notifications/) means no recipient covered it or SMTP
is unconfigured — the [test
email](/docs/configuration/#who-gets-notified) settles which in one click. Note
the division of labour: the in-app alert engine watches your *DMARC data*; this
page is about watching the *service itself*. You want both.

## The database

- **Disk is the resource that runs out.** Report volume is modest, but plan for
  growth and watch the Postgres volume like any other database. Large schema
  migrations can leave substantial dead tuples behind (one shipped migration
  left several hundred MB for autovacuum to reclaim) — a post-upgrade
  `VACUUM ANALYZE` is cheap insurance.
- **`user_session` grows forever.** Expired sessions are enforced at read time
  but never deleted, and each row carries an IP and user agent. Prune
  occasionally:

  ```sql
  delete from user_session where "ExpiresAtUtc" < now();
  ```

- Retention purging handles report data itself — see
  [retention](/docs/upgrading-and-backup/#retention).

## The five-line summary

Probe `/health/ready` and `/api/v1/auth/setup`; alert when any active mailbox's
`lastSuccessSyncAtUtc` goes stale by three poll intervals; match the five log
lines above; watch disk; and remember the worker's silence is only golden while
reports keep arriving.
