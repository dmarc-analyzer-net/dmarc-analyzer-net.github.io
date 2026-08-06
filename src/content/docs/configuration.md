---
title: Configuration reference
description: Every environment variable DMARC Analyzer reads — runtime mode, database, encryption key, worker tuning, and OIDC single sign-on — with defaults.
section: Configuration
order: 1
---

Configuration comes from environment variables, and **the same variable means the
same thing however you deploy** — Docker Compose in any shape, or the Kubernetes
chart. There is no per-platform configuration format.

The app is ASP.NET Core, so nested settings use a **double underscore** for each
level of nesting: `Worker:ScheduleIntervalSeconds` is set as
`Worker__ScheduleIntervalSeconds`. A single underscore will not work and nothing
will warn you — the value is ignored and the default applies. If a setting seems to
have no effect, check the underscores first.

Only two settings are effectively required: the database connection string and the
credential encryption key.

> This page covers the settings people actually change. The **complete list**,
> including everything a release adds, lives in
> [`docs/ops/configuration.md`](https://github.com/dmarc-analyzer-net/DmarcAnalyzerApp/blob/main/docs/ops/configuration.md)
> in the application repository, where a test fails the build if a setting exists
> in code and is missing from the document. Treat that as canonical if the two ever
> disagree.

## Runtime

### `APP_MODE`
What the container is for. The same image serves all four.

| Value | Runs |
|---|---|
| `all` | Console and mailbox polling in one process. **What the quick-start compose file uses.** |
| `api` | HTTP API plus the web console. No polling. |
| `worker` | Mailbox polling only, no HTTP listener. |
| `migrate` | Applies pending database migrations and exits. Serves nothing. |

Anything else **fails at startup** rather than falling back to `api`. That is
deliberate: a typo like `APP_MODE=woker` would otherwise give you a container that
is up, serves the console, and passes its healthcheck while ingesting nothing.

`all` is the default shape for a single host — one container, one log stream.
Split into `api` + `worker` when ingestion is heavy enough to compete with the
console, or when you want them to restart independently. See [choosing a
deployment](/docs/choose-your-deployment/).

> **Only one worker may run against a database.** A container in `worker` or `all`
> mode takes a Postgres advisory lock at startup and exits if another already holds
> it. Two ingestion loops duplicate every sync pass and can send duplicate alert
> and digest email, so this is enforced rather than advised.

### `ASPNETCORE_URLS`
Default `http://+:8080`. Change the port the API listens on.

### `AllowedHosts`
Default `*`. Host-header allowlist.

## Database

### `ConnectionStrings__Default`
Npgsql connection string. Default points at `localhost`, which is only useful for
local development — set it explicitly:

```
ConnectionStrings__Default=Host=postgres;Port=5432;Database=dmarc_analyzer;Username=postgres;Password=…
```

### `DATABASE_URL`
A `postgres://user:pass@host:port/database` URI, accepted as an alternative to
`ConnectionStrings__Default` and converted internally — for platforms (Render,
Heroku, Railway, …) that hand you a managed database as a URI rather than an
ADO.NET string. Takes priority when both are set. A `sslmode` query parameter is
honored (`disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`).

### `Database__MigrateOnStartup`
`true` in the shipped compose files. When true, the API applies pending EF Core
migrations as it boots.

Set it `false` when something else owns schema changes — running more than one API
replica, for instance, where replicas would otherwise race to apply the same
migration. Then apply them with a `migrate`-mode container, which is what the
Kubernetes chart does:

```bash
docker compose run --rm -e APP_MODE=migrate app
```

`POST /api/v1/admin/database/migrate` also works, with an admin session. Worker
mode ignores this setting entirely — only the web host reads it.

## Security

### `Security__CredentialEncryptionKey`
**Base64-encoded 32 bytes.** Encrypts stored mailbox passwords at rest with
AES-256-GCM. Generate one with:

```bash
openssl rand -base64 32
```

If it is unset the app still starts and stores credentials **in plaintext**, with
a warning in the log — acceptable for a throwaway local test, not for anything
real. Existing plaintext rows are re-encrypted lazily the next time each mailbox
syncs, so adding a key later upgrades them without manual work.

> Back this key up separately from the database. Losing it means re-entering every
> mailbox password; leaking it alongside a database dump exposes them.

## Worker tuning

All optional. Defaults below are what ships in the image.

| Variable | Default | What it does |
|---|---|---|
| `Worker__ScheduleIntervalSeconds` | `3600` | Seconds between polling passes. 60 minutes, 24/7. Floor of 15s. |
| `Worker__MaxMessagesPerSync` | `500` | Messages fetched per **batch**, not per pass — a pass keeps drawing batches until the mailbox is drained or the drain budget below runs out, checkpointing between them. |
| `Worker__MailboxDrainBudgetMinutes` | `20` | How long one source may keep drawing batches before the pass moves on to the next source. |
| `Worker__MaxRetryAttempts` | `3` | Attempts per mailbox before the run is recorded as failed. |
| `Worker__RetryBaseDelaySeconds` | `2` | Base for exponential backoff between those attempts. |
| `Worker__StaleRunTimeoutMinutes` | `90` | A sync stuck in `running` this long is auto-closed as failed. |
| `Worker__SyncRunTimeoutMinutes` | `30` | Hard cap on a single mailbox sync. |
| `Worker__EnforceSingleInstance` | `true` | Refuse to start when another worker already holds the ingestion lock. Turning this off removes the only guard that works on every platform. |

A polling pass that fails (database unreachable, for instance) is retried sooner
than the normal interval — backing off from 5 seconds up to
`ScheduleIntervalSeconds` — so a transient outage doesn't idle ingestion for a
whole hour.

## Email delivery

Alerts (and the future digest) are sent over SMTP. **Until `Host` and
`FromAddress` are set, delivery is off** — alerts are still recorded and visible
in the API, they just aren't emailed. Nothing errors.

| Variable | Default | What it does |
|---|---|---|
| `Email__Host` | — | SMTP relay hostname. Setting this and `FromAddress` enables delivery. |
| `Email__Port` | `587` | |
| `Email__UseStartTls` | `true` | Set `false` only for a local relay that doesn't offer STARTTLS. |
| `Email__Username` | — | Leave blank for an unauthenticated relay (common for an in-cluster MTA). |
| `Email__Password` | — | |
| `Email__FromAddress` | — | Sender address. Make sure your own DMARC policy permits it. |
| `Email__FromName` | `DMARC Analyzer` | |
| `Email__BaseUrl` | — | e.g. `https://dmarc.example.com`, used to build links in emails. |

Check it works without waiting for something to break:

```bash
curl -s -b /tmp/cj -X POST \
  'https://dmarc.example.com/api/v1/admin/notifications/test?to=you@example.com'
```

Every `curl` on this page needs an admin session cookie — `-b /tmp/cj` sends the
one [signing in](/docs/using-the-api/#signing-in) saved. Without it the answer is
`401`, not a test email.

## Alerts

A worker pass raises an alert when a domain's **compliance drops sharply against
its own baseline**, or when its **published DMARC policy is weakened** (for
example `p=reject` back to `p=none`, which silently removes protection).

| Variable | Default | What it does |
|---|---|---|
| `Alerts__Enabled` | `true` | Master switch. |
| `Alerts__IntervalMinutes` | `60` | How often rules are evaluated. |
| `Alerts__ComplianceDropPercent` | `15` | Percentage-point drop from baseline that raises a failure spike. |
| `Alerts__MinMessages` | `100` | Ignore days quieter than this — a few failures on a quiet domain is noise. |
| `Alerts__BaselineDays` | `7` | Days of history used as the comparison baseline. |
| `Alerts__CooldownHours` | `24` | Don't re-raise the same alert for the same domain within this window. |

Per client you can override the thresholds or switch alerting off entirely
(Clients → edit, or `PATCH /api/v1/clients/{id}`):

```json
{ "alertsEnabled": true, "alertComplianceDropPercent": 25, "alertMinMessages": 500 }
```

Alerts are measured against **report data**, not the wall clock — a domain whose
reports arrive late won't look like an outage.

### Who gets notified

Add recipients with `POST /api/v1/notification-recipients`. Omit `clientId` to
have an address receive alerts for **every** client:

```bash
curl -s -b /tmp/cj -X POST https://dmarc.example.com/api/v1/notification-recipients \
  -H 'Content-Type: application/json' \
  -d '{"clientId":"<id>","email":"ops@client.example","kind":"alert"}'
```

`kind` is `alert`, `digest`, or `both`. Alert history is at
`GET /api/v1/alerts?days=30`, and `POST /api/v1/admin/alerts/evaluate` runs an
evaluation immediately instead of waiting for the next pass.

## Monthly digest

Once a month each client's recipients get a summary of the previous whole month:
compliance and how it moved, volume, unauthenticated sources, how many domains are
enforcing, and the domains needing attention.

| Variable | Default | What it does |
|---|---|---|
| `Digest__Enabled` | `true` | Master switch. |
| `Digest__DayOfMonth` | `1` | Earliest day of the month the previous month's digest may go out (1–28). |
| `Digest__CheckIntervalHours` | `6` | How often the worker checks whether one is due. |

Sending is **idempotent** — a month already sent is never sent again, even across
restarts — so the check interval is safe to lower.

Preview exactly what a client would receive, without sending it:

```bash
curl -s -b /tmp/cj 'https://dmarc.example.com/api/v1/admin/digest/preview?clientId=<id>'
```

`POST /api/v1/admin/digest/send` sends anything due immediately. Recipients need
`kind` of `digest` or `both` — see [who gets notified](#who-gets-notified).

## Retention

A daily worker pass deletes DMARC data older than each client's retention window
(`RetentionMonths` on the client, 27 by default). Clients with `LegalHold` set are
skipped entirely. See [upgrading and backup](/docs/upgrading-and-backup/#retention)
for the operational side.

| Variable | Default | What it does |
|---|---|---|
| `Worker__RetentionEnabled` | `true` | Master switch. Set `false` to keep everything indefinitely. |
| `Worker__RetentionIntervalHours` | `24` | How often the pass runs. Retention is measured in months, so daily is ample. |
| `Worker__RetentionBatchSize` | `500` | Reports deleted per transaction, so a large backlog doesn't hold locks across the table. |

Retention is measured against each report's **reporting window end**, not its
ingest date — a backfilled mailbox doesn't reset the clock on old reports. A
non-positive `RetentionMonths` is treated as misconfiguration and falls back to
27 rather than deleting everything.

Purging the database does nothing to the mailbox: ingestion only reads, so the
same report mail sits there indefinitely unless you turn on **mailbox
retention deletion** per source — off by default, and the one pass in this
application that removes data it does not own. See
[the mailbox copy](/docs/data-protection/#the-mailbox-copy) for what it does
and why it is opt-in.

| Variable | Default | What it does |
|---|---|---|
| `Worker__MailboxRetentionGraceDays` | `30` | Extra days on top of the retention window before mail is deleted, so a clock skew or a paused worker cannot destroy mail the database has not re-read yet. |
| `Worker__MailboxRetentionIntervalHours` | `24` | Gap between mailbox retention passes. |

## Backup offload

Ships the [configuration export](/docs/upgrading-and-backup/#the-configuration-export)
and the append-only history tables to S3-compatible object storage on a
schedule — MinIO, Cloudflare R2, Backblaze B2, or AWS itself.
**`Bucket` empty disables the whole feature**, the same way an empty
`Email__Host` above leaves alerts and digests inert.

| Variable | Default | What it does |
|---|---|---|
| `Backup__Bucket` | *(empty)* | Destination bucket. Empty disables offload. |
| `Backup__IntervalMinutes` | `30` | Gap between offload passes. |
| `Backup__Endpoint` | *(empty)* | Custom S3 endpoint for MinIO, R2, B2. Empty targets AWS. |
| `Backup__Region` | `us-east-1` | AWS region, or the signing region when `Endpoint` is set. |
| `Backup__AccessKeyId`, `Backup__SecretAccessKey` | *(empty)* | Leave both empty to use the ambient credential chain — an instance role or IRSA beats a long-lived key in configuration. |
| `Backup__Prefix` | `dmarc` | Key prefix, so one bucket can hold more than one install. |
| `Backup__IncludeHistory` | `true` | Ship the audit trail, alerts, digests, sync runs and ingest ledger as immutable dated objects. |
| `Backup__ArchiveReportMail` | `false` | Also archive raw report mail as it is ingested, so report history survives independently of the mailbox. Off by default — it is the largest thing this feature can store. |

**Refuses to run with no credential encryption key configured** — in that state
mailbox passwords are stored in plaintext, and shipping them to a bucket is
worse than leaving them in the database. See
[the configuration export](/docs/upgrading-and-backup/#the-configuration-export)
and [offloading it to object storage](/docs/upgrading-and-backup/#offloading-it-to-object-storage)
for the operational side, including why bucket versioning matters.

## Single sign-on (OIDC)

Off by default; see [single sign-on](/docs/single-sign-on/) for how it fits
together, or a provider walked through screen by screen:
[Microsoft Entra ID](/docs/single-sign-on/entra-id/), which requires
`ClientSecret`; [Zitadel](/docs/single-sign-on/zitadel/); and
[Keycloak](/docs/single-sign-on/keycloak/) — the latter two issue none.

| Variable | Default | What it does |
|---|---|---|
| `Auth__Oidc__Enabled` | `false` | Master switch. |
| `Auth__Oidc__Authority` | — | Issuer URL, e.g. `https://login.example.com`. |
| `Auth__Oidc__ClientId` | — | Client ID from your provider. |
| `Auth__Oidc__ClientSecret` | — | Client secret. |
| `Auth__Oidc__Scopes` | `openid profile email` | Requested scopes. |
| `Auth__Oidc__DisplayName` | `SSO` | Label on the login button. |
| `Auth__Oidc__AutoProvision` | `false` | Create a local user on first successful SSO login. |
| `Auth__Oidc__DefaultRole` | `client_viewer` | Role given to auto-provisioned users. Deliberately the least privileged. |
| `Auth__Oidc__RequireHttpsMetadata` | `true` | Only set `false` against a local test IdP over HTTP. |
| `Auth__Oidc__DisableLocalLogin` | `false` | Turn off password sign-in and redirect the login page straight to this provider. Requires `Enabled=true`. See [requiring SSO for everyone](/docs/single-sign-on/#requiring-sso-for-everyone). |

Local passwords and OIDC are interchangeable front doors by default — both mint
the same application session, and **authorisation is always evaluated in-app**,
never delegated to the identity provider.

## Logging

`Logging__LogLevel__Default` defaults to `Information`, and
`Logging__LogLevel__Microsoft.AspNetCore` to `Warning`. Set the former to `Debug`
when diagnosing ingestion.

## Sessions

Not configurable at present, documented so you know the behaviour: the
`dmarc_session` cookie is `HttpOnly`, times out after **12 hours idle**, and has a
**7 day** absolute maximum.
