---
title: Choosing a deployment
description: Bundled or external PostgreSQL, one container or two, Docker Compose or Kubernetes — what each choice costs and when it is worth making.
section: Getting started
order: 3
publishDate: 2026-07-26
---

There are three independent choices, and the defaults are right for most people.
This page exists so you can tell when they stop being right.

| Choice | Default | Change it when |
|---|---|---|
| Database | bundled PostgreSQL | you already run PostgreSQL, or you need backups and failover you trust |
| Topology | one container (`APP_MODE=all`) | ingestion is heavy enough to slow the console |
| Platform | Docker Compose | you already run Kubernetes |

They combine freely: bundled or external, combined or split, on either platform.
**Every combination reads the same environment variables**, so moving between them
is a deployment change, not a reconfiguration.

## Database: bundled or your own

The quick start bundles PostgreSQL because it makes the first run one command. It
is a single container with a named volume — no replication, no backups, no
connection pooling.

That is genuinely fine for a small internal deployment, as long as you are taking
[backups](/docs/upgrading-and-backup/#what-to-back-up). Point at your own
PostgreSQL when you want someone else's backup and failover story, or when your
organisation already has one.

```bash
curl -fsSL -O https://raw.githubusercontent.com/dmarc-analyzer-net/DmarcAnalyzerApp/main/deploy/compose.external-db.yml
```

```bash
# .env
DMARC_DB_HOST=db.internal
DMARC_DB_PORT=5432
DMARC_DB_NAME=dmarc_analyzer
DMARC_DB_USER=dmarc
DMARC_DB_PASSWORD=…
COMPOSE_FILE=compose.yml:compose.external-db.yml
```

The database must exist and the user must own it — the app creates its tables on
first boot, but not the database itself.

### Managed PostgreSQL

RDS, Cloud SQL, Neon and similar all work — the app is an ordinary Npgsql client
and uses no exotic SQL. Releases are tested against **PostgreSQL 17**, which is
what the bundled container runs; older majors are very likely fine but are not
something we test, so treat 17 as the known-good version.

Two things to get right:

- **TLS.** Most managed providers require it. Set the connection string directly
  rather than assembling it from the `DMARC_DB_*` pieces:

  ```bash
  ConnectionStrings__Default=Host=db.example.com;Port=5432;Database=dmarc_analyzer;Username=dmarc;Password=…;SSL Mode=Require
  ```

  Npgsql spells it `SSL Mode`, not `sslmode`.

- **Connection pooling — use session pooling, not transaction pooling.** The
  worker holds a PostgreSQL *advisory lock* for the life of the process to
  guarantee only one worker runs. Advisory locks belong to a session, so a pooler
  that hands the connection to someone else between statements makes that
  guarantee meaningless. With PgBouncer, `pool_mode = session`.

Nothing else changes: migrations, retention and the worker behave identically.

## Topology: one container or two

By default one container serves the console **and** runs the mailbox polling loop.
One container, one log stream, nothing to order at startup.

Split them when a sync pass is heavy enough to compete with the console for CPU,
when you want to restart one without the other, or when they need different
resource limits.

```bash
curl -fsSL -O https://raw.githubusercontent.com/dmarc-analyzer-net/DmarcAnalyzerApp/main/deploy/compose.split.yml
echo "COMPOSE_FILE=compose.yml:compose.split.yml" >> .env
docker compose up -d
```

The overlay flips the app to `APP_MODE=api` in the same file that adds the worker,
which is deliberate. Running a worker *beside* a container that is still in `all`
mode would mean two schedulers polling the same mailboxes.

> **Only one worker, whichever shape you pick.** The application takes a PostgreSQL
> advisory lock at startup and a second worker exits rather than starting, so
> `--scale worker=2` cannot quietly double-poll your mailboxes. Scale the console
> instead — `APP_MODE=api` containers take no lock.

## Platform: Compose or Kubernetes

Compose is the recommended path for a single host, and most self-hosted DMARC
Analyzer installs are a single host.

The [Helm chart](/docs/kubernetes/) exposes the same two choices as values —
`postgres.enabled` and `mode: combined | split` — so a deployment can move between
Compose and Kubernetes without relearning its configuration. Use it if you already
run Kubernetes; it is not a reason to start.

## Overlay reference

The overlays need Docker Compose **v2.24 or newer** (`docker compose version`).

| Want | Files |
|---|---|
| One container, bundled database *(default)* | `compose.yml` |
| One container, your database | `compose.yml` `compose.external-db.yml` |
| Console and worker split, bundled database | `compose.yml` `compose.split.yml` |
| Console and worker split, your database | all three |

Set `COMPOSE_FILE` in `.env` once and day-to-day use stays `docker compose up -d`.

## Sizing

Modest, and it does not grow the way people expect — aggregate reports are
statistical summaries, not copies of your mail.

- **~1 GB RAM** for the whole stack. A combined container idles well under 200 MB.
- **Disk** is dominated by report records. A busy domain produces a few MB a month;
  a hundred domains for two years still measures in gigabytes, and
  [retention](/docs/upgrading-and-backup/#retention) trims the tail.
- **CPU** matters only during a sync pass, which is why splitting helps once you
  have many mailboxes.
