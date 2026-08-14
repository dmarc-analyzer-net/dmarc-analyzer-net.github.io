---
title: Upgrading and backup
description: Pull a new image, let migrations run, and know what to back up — a continuous configuration export, a pre-upgrade database dump, and the encryption key.
section: Operations
order: 1
publishDate: 2026-07-25
updatedDate: 2026-08-05
---

## Upgrading

Take a [database dump](#a-database-dump-before-an-upgrade) first — this is the one
job it is still the right tool for — then:

```bash
cd dmarc-analyzer
docker compose pull
docker compose up -d --force-recreate
```

The app applies pending database migrations as it boots, so there is no separate
migration step.

> **`--force-recreate` is not optional, and this is the one trap on this page.**
> Plain `docker compose up -d` recreates a container only when its *configuration
> or image* changes. A pending migration is a fact about your database and Compose
> cannot see it — so if the image you pulled turns out to be the one you already
> had, Compose leaves the container running and **nothing migrates**, while the
> healthcheck goes on returning 200 the whole time. A green healthcheck does not
> prove your schema is current.

So confirm it rather than assuming. Count the applied migrations:

```bash
docker compose exec -T postgres psql -U postgres -d dmarc_analyzer -tAc \
  'select count(*), max("MigrationId") from "__EFMigrationsHistory"'
```

The column names are quoted and case-sensitive — `select migration_id` fails.

Expect a few seconds of downtime while the app restarts, or a couple of minutes if
the release carries a large migration. The largest so far rewrites every report
record in one statement: about 94 seconds per 5.3 million rows. The app allows ten
minutes for it and does not accept HTTP until it finishes.

### Migrating without downtime

If you would rather the console stayed up, apply the schema change first with a
throwaway container that migrates and exits:

```bash
docker compose pull
docker compose run --rm -e APP_MODE=migrate app
docker compose up -d --force-recreate
```

`migrate` mode serves nothing, ingests nothing, and takes no locks, so the running
instance is undisturbed. It names each migration as it applies them; with nothing
pending it prints `No pending migrations; nothing to do.` and exits 0, so it is
safe to run twice.

This is how the Kubernetes chart does it, and it is the only approach that works
when you run more than one console replica — replicas would otherwise race to
apply the same migration. For a single-container Compose install the simpler
restart above is fine.

### Pinning a version

Tracking `latest` means you get changes whenever you pull. To control that, pin a
version tag in `compose.yml`:

```yaml
image: ghcr.io/dmarc-analyzer-net/dmarc-analyzer:0.11.0
```

Then upgrading is an explicit edit. Available tags: `latest`, `sha-<commit>`, and
semantic versions.

### Rolling back

Set the image back to the previous tag and `docker compose up -d --force-recreate`.
One caveat: **migrations are not automatically reversed.** If the newer version
changed the schema, an older image may not run against the migrated database —
which is why you take a backup before upgrading.

This is the practical argument for pinning: rolling back from `latest` means
working out which version you were on.

## What to back up

Three things, and they run on very different clocks: a small configuration export
continuously, a full database dump before each upgrade, and the encryption key
once.

### The configuration export

One JSON document holding everything a fresh install needs to become this one:
clients with their retention windows and alert thresholds, domains, mailbox
sources with their encrypted passwords, notification recipients, operator
accounts with their password hashes, SSO identity links, and per-client grants.

What it deliberately leaves out is the report data — millions of rows that
arrived over IMAP and can arrive again, against a few hundred rows of
configuration that someone typed by hand and would have to type again. That is
the whole argument for this file: it is the part of a recovery that actually
hurts, and it is small enough to copy every half hour.

An admin can download it at any time:

```bash
curl -fsS -o dmarc-config-$(date +%F).json \
  https://dmarc.example.com/api/v1/admin/config/export
```

Like every `/admin/` endpoint it needs an `agency_admin` session.

The manifest at the top states the file's own scope — format version, the
migration the schema was on, how many report rows were left out, which clients
are on legal hold, and a fingerprint of the encryption key that protected the
mailbox credentials inside. The fingerprint is the one that earns its place in a
recovery: it answers "do I hold the right key for this file?" *before* you import
it, rather than at the first failed mailbox sync afterwards. A mismatch is a
warning you acknowledge, not a dead end — the rest of the artifact still
imports, and the console tells you afterward which mailbox sources need their
password re-entered by hand.

> **This is a credential file, not a config file.** It carries encrypted mailbox
> passwords and password hashes, so handle it as you would a database dump. With
> no `DMARC_ENCRYPTION_KEY` configured those passwords are stored in plaintext and
> would be exported in plaintext, so the export refuses with a 409 unless you add
> `?allowPlaintextCredentials=true` — and the offload below refuses outright, since
> that would be copying plaintext credentials off the machine on a timer.

Because it is JSON and not SQL, reading it back is an application operation
rather than a `psql` one: bring up a clean install, create the first
administrator, and import as that account's first action. Import is **additive** —
it inserts and updates, and never deletes — so anything in the target install that
the artifact does not mention is left alone.

### Offloading it to object storage

Downloading it by hand is fine once. A backup you have to remember is not a
backup, so point the `Backup` section at an S3-compatible bucket and the worker
ships it on a schedule — AWS, MinIO, Cloudflare R2, Backblaze B2, anything that
speaks S3:

```bash
# .env
Backup__Bucket=dmarc-backups
Backup__Region=eu-central-1
Backup__AccessKeyId=AKIA...
Backup__SecretAccessKey=...
```

| Variable | Default | What it does |
|---|---|---|
| `Backup__Bucket` | — | Destination bucket. **Empty disables the feature**; there is no separate on switch to disagree with it. |
| `Backup__IntervalMinutes` | `30` | How often a pass runs. The worker's own loop is the floor, so with the shipped hourly `Worker__ScheduleIntervalSeconds` this is effectively hourly until you shorten that too. |
| `Backup__Endpoint` | — | Custom S3 endpoint for anything that is not AWS. Empty targets AWS itself. |
| `Backup__Region` | `us-east-1` | AWS region. With `Endpoint` set it is used only as the signing region. |
| `Backup__AccessKeyId`, `Backup__SecretAccessKey` | — | Static credentials. Leave both empty to use the ambient chain — an instance role or IRSA beats a long-lived key in `.env`. |
| `Backup__Prefix` | `dmarc` | Key prefix, so one bucket can hold more than one install. |
| `Backup__ForcePathStyle` | `true` | Address buckets as a path segment. Required by MinIO and most S3-compatible services, harmless on AWS. |
| `Backup__DailySnapshot` | `true` | Also write a dated copy of each snapshot beside `latest.json`. |
| `Backup__IncludeHistory` | `true` | Ship the append-only history too — audit trail, alerts, digests, sync runs, ingest ledger. These are the rows no report replay can reconstruct. |
| `Backup__ArchiveReportMail` | `false` | Archive the raw report mail as it is ingested: the only copy of report history that does not depend on the mailbox, and the largest thing this feature can be asked to store. |

What lands in the bucket:

```
s3://dmarc-backups/dmarc/
  config/latest.json                                    ← overwritten every pass
  config/2026-07-27.json                                ← dated daily copy
  history/audit_event/2026/07/2026-07-27T0800.jsonl     ← written once, never rewritten
  history/alert_event/…  history/digest_delivery/…  history/mailbox_sync_run/…
  reports/2026/07/27/<source-id>/<uidvalidity>-<uid>.eml.gz   ← only with the archive on
```

The history objects are named after the tables they hold and are never rewritten,
which is what makes shipping them every half hour cheap: each pass is one new
object per stream, plus a few minutes of deliberate overlap so a row committed
just after the previous pass read the clock is not skipped for good.

The report archive is date-partitioned first for one reason: it is what makes
"expire this after N months" expressible as a lifecycle rule.

**Never put `DMARC_ENCRYPTION_KEY` in this bucket.** The artifact holds the
encrypted mailbox passwords; the key decrypts them. Storing the two together is
storing the plaintext, and it is the same rule as the `.env` pair below — only
easier to break by accident, because a bucket feels like somewhere to put
everything.

**Turn on bucket versioning.** `config/latest.json` is overwritten on every pass,
which makes it the one destructive write in this design: a pass that succeeds
while producing a bad document replaces your good copy, and you find out during a
recovery. Two mitigations are built in — the pass writes to a staging key and
promotes it only after the document validates, and `DailySnapshot` keeps a dated
copy so a bad overwrite costs a day — but versioning is the one that makes *any*
bad overwrite recoverable. The app reads the bucket's versioning state and reports
it rather than refusing to run without it: some S3-compatible backends report it
inconsistently or deny the call outright, and a backup that will not start is
worse than an unversioned one. So it is reported, and turning it on is yours to do.

Two admin endpoints, so you can prove the destination works without waiting out
an interval:

```bash
curl -s -b /tmp/cj https://dmarc.example.com/api/v1/admin/backup/status
curl -s -b /tmp/cj -X POST https://dmarc.example.com/api/v1/admin/backup/offload
```

`status` reports the destination, whether credentials are protected, the bucket's
versioning state, the last successful pass and the per-stream watermarks. Both
require an `agency_admin` session — `-b /tmp/cj` sends the cookie from
[signing in](/docs/using-the-api/#signing-in), and without it you get a `401`.

Two things to decide rather than inherit. First, **the bucket must be private** —
it holds credential material: mailbox passwords that are one leaked key away from
plaintext, and password hashes that can be attacked offline. Second, if you
turn `Backup__ArchiveReportMail` on, put a **lifecycle rule** on the archive
prefix: nothing in the app expires those objects, so an archive with no rule is an
unbounded copy of personal data and a longer erasure horizon than the retention
window you configured — see
[data protection](/docs/data-protection/#archive-and-erasure-pull-in-opposite-directions).

One expectation to set about that archive: it is **evidence, not a restore path**.
It preserves the report mail beyond the mailbox, which is what makes bounding the
mailbox safe, but loading those objects back into a database is not something the
app does yet — today a rebuild re-ingests over IMAP.

### A database dump before an upgrade

All reports, clients, domains, users, and sync history — everything, in one file.

```bash
docker compose exec -T postgres \
  pg_dump -U postgres dmarc_analyzer | gzip > dmarc-$(date +%F).sql.gz
```

This used to be the whole backup story, and it is still the artifact that a
rollback across a migration needs: an older image may not run against a migrated
schema, and the dump is what gets you back to the old one. So take it **before
every upgrade** and keep a few.

What it is no longer is the day-to-day copy. It is gigabytes dominated by report
records, it is tied to this Postgres version and this schema revision, and
restoring it is [the long procedure below](#restoring-a-database-dump) — none of
which is a good fit for something you want happening every half hour. The
configuration export is that; this is the pre-upgrade insurance.

### `DMARC_ENCRYPTION_KEY`

The value in your `.env`. It decrypts stored mailbox passwords. **A database
backup without this key leaves you re-entering every mailbox credential after a
restore.** Store it in your password manager or secret store — not only next to
the dump, and never in the backup bucket.

> Treat the two as a pair with opposite risks: together they expose your mailbox
> passwords, so keep them in separate places; but restoring without both means
> extra manual work.

## Restoring a database dump

This is the path for a bad migration or a lost volume, where you want the reports
back too. Getting the *configuration* back — clients, domains, mailbox sources,
users — is the import described [above](#the-configuration-export) and involves no
`psql` at all.

The dump is a plain SQL script of `CREATE` and `COPY` statements, with no `DROP`s
in it. That matters: restoring it over a database that already has a schema fails
on every object, and **`psql` reports success anyway** unless you tell it not to.
So restore into an empty database, and make errors fatal:

```bash
# stop everything, then bring up only postgres
docker compose down
docker compose up -d postgres

# recreate the database empty (this discards the current contents)
docker compose exec -T postgres psql -U postgres -d postgres \
  -c 'DROP DATABASE IF EXISTS dmarc_analyzer;' -c 'CREATE DATABASE dmarc_analyzer;'

gunzip -c dmarc-2026-07-25.sql.gz | \
  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U postgres -d dmarc_analyzer

docker compose up -d
```

`-v ON_ERROR_STOP=1` is the important flag. Without it `psql` prints its errors,
carries on to the next statement, and exits 0 — so a restore that populated almost
nothing looks exactly like one that worked. With it, the first failure stops the
run and returns non-zero.

`docker compose down` before `DROP DATABASE` is not optional either: the drop fails
while the app still holds connections.

Restore `.env` with the original `DMARC_ENCRYPTION_KEY` before starting the API,
or mailbox syncs will fail to decrypt their credentials.

Then check the restore landed, rather than assuming:

```bash
docker compose exec -T postgres psql -U postgres -d dmarc_analyzer -tAc \
  'select count(*) from "__EFMigrationsHistory"'
docker compose exec -T postgres psql -U postgres -d dmarc_analyzer -tAc \
  'select count(*) from dmarc_report'
```

The migration count should match what the backed-up instance had, and a mailbox
source should sync successfully — that last one is the real test of the encryption
key, since nothing else exercises it.

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
- The purge is a **database** operation. The report mail it was built from is
  deleted only on sources where you enable mailbox retention deletion, which is off
  by default — otherwise the same sending IPs and authentication outcomes stay
  upstream, which is what makes a rebuild possible and also what keeps the data
  past your window. Rules, preview and settings: [data
  protection](/docs/data-protection/#the-mailbox-copy).

Change the window per client (Clients → edit → retention), or set
`LegalHold` on a client to exempt it from purging entirely — for a dispute or
investigation where data must be preserved regardless of the window:

```bash
curl -s -b /tmp/cj -X PATCH https://dmarc.example.com/api/v1/clients/<id> \
  -H 'Content-Type: application/json' -d '{"legalHold": true}'
```

### Previewing and running it manually

An admin can see exactly what the next pass would remove, without removing
anything:

```bash
curl -s -b /tmp/cj https://dmarc.example.com/api/v1/admin/retention/preview
```

It reports per client: the retention window, the cutoff date, how many reports
and ledger rows would go, and whether the client is on legal hold. To run the
purge immediately rather than waiting for the daily pass:

```bash
curl -s -b /tmp/cj -X POST https://dmarc.example.com/api/v1/admin/retention/purge
```

Both require an `agency_admin` session — see [using the
API](/docs/using-the-api/#signing-in) for where `/tmp/cj` comes from. Tuning
knobs — including switching the pass off entirely — are in the [configuration
reference](/docs/configuration/#retention).

## Moving to another host

1. Back up the database and `.env` as above.
2. Copy `compose.yml` and `.env` to the new host.
3. Restore the dump.
4. `docker compose up -d`.

Nothing is stored outside PostgreSQL and `.env`, so there are no application files
to migrate.

If you do not need the report history moved with you, the [configuration
export](#the-configuration-export) is the shorter route: clean install on the new
host, import the artifact, and let the mailboxes backfill — which reaches as far
back as the mail in them does.
