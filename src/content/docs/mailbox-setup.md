---
title: Connecting a mailbox
description: Point DMARC Analyzer at where your rua= reports land — IMAP, POP3 or an S3 bucket, app passwords, and how domains are auto-created.
section: Configuration
order: 2
publishDate: 2026-07-25
updatedDate: 2026-08-18
---

DMARC aggregate reports arrive as email attachments. DMARC Analyzer reads them
from a mailbox you control over **IMAP** or **POP3**, or from an **S3 bucket**
something upstream drops them into — it never needs inbound SMTP.

## Choosing a mailbox

Use a **dedicated** mailbox or alias, e.g. `dmarc@yourdomain.com`, and put it in
your DMARC record's `rua=` tag. A busy portfolio generates a lot of mail, and
mixing it with a human inbox makes both worse.

One mailbox can serve many domains and many clients — every report says which
domain it's about, so you don't need one inbox per domain.

## Adding it

**Report sources → Add report source**. Pick the protocol first, because it
decides which of the remaining fields you get:

| Protocol | For |
|---|---|
| **IMAP (polled)** | The normal case. Port `993` with TLS. |
| **POP3 (polled)** | A mailbox that offers nothing else. Port `995` with TLS. Read [the caveats](#pop3) before choosing it. |
| **S3 bucket (polled)** | Reports already landing in object storage — see [an S3 bucket](#an-s3-bucket). |
| **API (pushed)** | Something else hands the reports over instead of being polled. See [pushing reports in](/docs/using-the-api/#pushing-reports-in-instead-of-polling-a-mailbox). |

For a mailbox, IMAP or POP3:

| Field | Notes |
|---|---|
| Source name | Free text for your own reference. |
| Host / Port | The mail server. `993` for IMAP, `995` for POP3 — the field follows the protocol you picked, unless you already typed something non-standard. |
| TLS | Leave enabled. |
| Username / Password | See [app passwords](#app-passwords) below. |
| Default client | Which client owns domains that get auto-created from this source ([below](#auto-created-domains-and-the-default-client)). |

All three polled protocols then run the **same** pass: the same per-pass message
budget, the same checkpointing, the same archive-before-parse rule, the same run
rows in Sync history, and the same optional retention deletion. What differs is
only what the protocol itself makes possible.

### POP3

POP3 works, with two consequences worth knowing before you point one at a large
mailbox:

- **The server must support UIDL.** It is optional in the protocol, and without it
  there is no durable position to resume from — every pass would re-read the whole
  mailbox for ever. Rather than do that, the sync refuses, and says so on the
  source's health row. If your server has no UIDL, use IMAP.
- **Retention deletion is the expensive half.** POP3 has no server-side date
  search, so if you enable deletion the pass reads every message's headers to find
  what has aged out. It logs how many it read. IMAP asks the server instead.

Two smaller differences: a message's arrival time comes from the sender's own
`Date` header rather than from the server, and deletions only take effect if the
session ends cleanly. If the checkpointed message is deleted from the mailbox by
something else, the next pass has no position to recover and re-reads everything —
correct, thanks to deduplication, but slow. The worker logs a warning saying so.

### An S3 bucket

An S3 source is polled like a mailbox but addressed by **bucket and key prefix**
rather than host and port. Use it when reports already land in object storage —
a gateway writing them there, or another system's archive.

| Field | Notes |
|---|---|
| Bucket | Required. |
| Key prefix | Optional, and worth setting. Every pass lists all keys under it, so on a bucket holding more than reports the prefix is what separates a cheap poll from reading a data lake. |
| Region | The bucket's region. Ignored when you set an endpoint. |
| Endpoint | Optional. For MinIO, R2, B2 and anything else S3-compatible, e.g. `https://minio.internal:9000`. |
| Access key ID / Secret access key | Optional — **leave both empty** to use the ambient credential chain (an instance role, or IRSA on Kubernetes), which is better than storing a key. Filling in one but not the other is refused. |

Three things to know:

- **Objects can be report files or whole email messages, and both work.** Each
  object is classified on its own content: an RFC822 message, gzipped or not, is
  parsed as mail and its attachments extracted; anything else goes to the same
  payload extractor the mailbox path uses. Pointing a source at this application's
  own [report-mail archive](/docs/data-protection/#the-mailbox-copy) prefix
  therefore replays it.
- **The credential needs `s3:ListBucket` and `s3:GetObject`** — plus
  `s3:DeleteObject` if you enable retention deletion, and nothing else.
- **A pass lists at most 100,000 keys.** A prefix bigger than that is covered over
  several passes rather than truncated: the pass records where its listing stopped
  and the next one resumes there, starting a fresh lap once it reaches the end. The
  cap exists so a bucket pointed at by mistake costs a bounded read.

## App passwords

Most providers won't accept your normal password from a third-party client:

- **Google Workspace / Gmail** — enable 2-Step Verification, then create an
  [App Password](https://support.google.com/accounts/answer/185833). Host
  `imap.gmail.com`, port `993`. IMAP must be enabled for the account.
- **Microsoft 365 / Outlook** — IMAP with basic auth is disabled on many tenants.
  If your tenant permits it, use an app password; otherwise use a mailbox on
  another provider for now. (OAuth via Microsoft Graph is on the roadmap.)
- **Anything else** — standard IMAP or POP3 credentials are fine.

Passwords and S3 secret keys are encrypted at rest with AES-256-GCM using
[`Security__CredentialEncryptionKey`](/docs/configuration/#security).

## Your mail is never modified

Mailbox processing is strictly **read-only** unless you turn on retention
deletion for a source. The sync never moves messages or marks them read, so
pointing the analyzer at a mailbox you also archive elsewhere is safe. Progress is
tracked by a checkpoint — the IMAP UID, the POP3 UIDL, or the S3 object's
last-modified time and key — rather than by changing anything at the source.

## Auto-created domains and the "default client"

When a report arrives for a domain the system doesn't know about, that domain is
**created automatically** and assigned to this source's *default client*. This is
what makes onboarding painless — publish a record, and the domain appears once
reports flow.

Two consequences worth knowing:

- Pick the default client deliberately. If one mailbox collects reports for many
  customers, new domains all land under that one client until you move them.
- Domains are globally unique, so a domain already claimed by another client is
  not re-assigned.

## Backfill

The first sync walks the source **oldest first**, checkpointing as it goes, so
years of history import without intervention. A pass keeps drawing batches of
[`Worker__MaxMessagesPerSync`](/docs/configuration/#worker-tuning) messages
or objects — 500 — until the source is drained or
`Worker__MailboxDrainBudgetMinutes` runs out, so one large mailbox cannot starve
the others. Whatever is left resumes from the checkpoint on the next pass.

Duplicate reports are ignored: the same report arriving twice, or via two
sources, is deduplicated on domain + report ID + date range. That is what makes it
safe to point a second source at overlapping data.

## Checking it worked

- **Report sources** lists each source with the outcome of its most recent sync.
  Filters cover failed runs, parse failures, and stale successes.
- **Sync history** shows per-run counters: messages scanned, attachments
  processed, reports inserted, duplicates skipped, parse failures.
- The **Checkpoint** column shows whichever checkpoint the source has, so a POP3
  or S3 source no longer reads as "never synced".
- Impatient? Trigger a sync by hand from the report source list rather than
  waiting for the next hourly pass.

If nothing appears, see [troubleshooting](/docs/troubleshooting/).
