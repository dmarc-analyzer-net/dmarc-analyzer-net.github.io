---
title: Upgrading and backup
description: Pull a new image, let migrations run, and know exactly which two things to back up — the database and the credential encryption key.
section: Operations
order: 1
---

## Upgrading

```bash
cd dmarc-analyzer
docker compose pull
docker compose up -d
```

The API applies any pending database migrations at startup (assuming
`Database__MigrateOnStartup` is `true`, as in the shipped compose file), so there
is no separate migration step. Startup ordering means the worker waits for the API
to finish before it resumes polling.

Take a database backup first — see below — and expect a few seconds of downtime
while the API restarts.

### Pinning a version

Tracking `latest` means you get changes whenever you pull. To control that, pin a
version tag in `compose.yml`:

```yaml
image: ghcr.io/dmarc-analyzer-net/dmarc-analyzer:0.1.0
```

Then upgrading is an explicit edit. Available tags: `latest`, `sha-<commit>`, and
semantic versions.

### Rolling back

Set the image back to the previous tag and `docker compose up -d`. One caveat:
**migrations are not automatically reversed.** If the newer version changed the
schema, an older image may not run against the migrated database — which is why
you take a backup before upgrading.

## What to back up

Exactly two things:

### 1. The database

All reports, clients, domains, users, and sync history.

```bash
docker compose exec -T postgres \
  pg_dump -U postgres dmarc_analyzer | gzip > dmarc-$(date +%F).sql.gz
```

### 2. `DMARC_ENCRYPTION_KEY`

The value in your `.env`. It decrypts stored mailbox passwords. **A database
backup without this key leaves you re-entering every mailbox credential after a
restore.** Store it in your password manager or secret store — not only next to
the dump.

> Treat the two as a pair with opposite risks: together they expose your mailbox
> passwords, so keep them in separate places; but restoring without both means
> extra manual work.

## Restoring

```bash
# with the stack stopped except postgres
docker compose up -d postgres
gunzip -c dmarc-2026-07-25.sql.gz | \
  docker compose exec -T postgres psql -U postgres -d dmarc_analyzer
docker compose up -d
```

Restore `.env` with the original `DMARC_ENCRYPTION_KEY` before starting the API,
or mailbox syncs will fail to decrypt their credentials.

## Retention

Each client has a retention window, **27 months by default**, and a daily
background pass deletes DMARC data that has aged out of it. Volume is modest
regardless — aggregate reports are statistical summaries, not message content.

Two details worth knowing:

- Retention is measured against the report's **reporting window end**, not when
  you ingested it. A mailbox backfilling two years of history won't be granted a
  fresh 27 months on old reports.
- Deleting a report also removes its per-source records and their authentication
  results. **Purging is deletion, not archival** — nothing is copied elsewhere
  first, so take a [backup](#what-to-back-up) if you need the history.

Change the window per client (Clients → edit → retention), or set
`LegalHold` on a client to exempt it from purging entirely — for a dispute or
investigation where data must be preserved regardless of the window:

```bash
curl -X PATCH https://dmarc.example.com/api/v1/clients/<id> \
  -H 'Content-Type: application/json' -d '{"legalHold": true}'
```

### Previewing and running it manually

An admin can see exactly what the next pass would remove, without removing
anything:

```bash
curl https://dmarc.example.com/api/v1/admin/retention/preview
```

It reports per client: the retention window, the cutoff date, how many reports
and ledger rows would go, and whether the client is on legal hold. To run the
purge immediately rather than waiting for the daily pass:

```bash
curl -X POST https://dmarc.example.com/api/v1/admin/retention/purge
```

Both require an `agency_admin` session. Tuning knobs — including switching the
pass off entirely — are in the [configuration
reference](/docs/configuration#retention).

## Moving to another host

1. Back up the database and `.env` as above.
2. Copy `compose.yml` and `.env` to the new host.
3. Restore the dump.
4. `docker compose up -d`.

Nothing is stored outside PostgreSQL and `.env`, so there are no application files
to migrate.
